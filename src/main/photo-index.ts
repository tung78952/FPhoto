import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, extname, join } from 'node:path'
import initSqlJs from 'sql.js'
import type { Database, SqlJsStatic } from 'sql.js'
import type { PhotoFile, ScanSummary } from '../shared/types'

type IndexedPhoto = PhotoFile & {
  extension: string
  baseName: string
  fileType: string
}

const require = createRequire(import.meta.url)

let sqlPromise: Promise<SqlJsStatic> | null = null
let databasePromise: Promise<Database> | null = null

function getFileType(fileName: string): string {
  const extension = extname(fileName).toLowerCase()

  if (extension === '.jpg' || extension === '.jpeg') return 'jpeg'
  if (['.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng'].includes(extension)) return 'raw'
  return 'other'
}

function toIndexedPhoto(file: PhotoFile): IndexedPhoto {
  const extension = extname(file.name).toLowerCase()
  return {
    ...file,
    extension,
    baseName: basename(file.name, extension),
    fileType: getFileType(file.name)
  }
}

function getDbPath(): string {
  return join(app.getPath('userData'), 'fphoto.sqlite')
}

async function getSql(): Promise<SqlJsStatic> {
  sqlPromise ??= initSqlJs({
    locateFile: (file) => require.resolve(`sql.js/dist/${file}`)
  })

  return sqlPromise
}

function ensureSchema(db: Database): void {
  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      volume_serial TEXT,
      is_removable INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      size INTEGER NOT NULL,
      modified_at REAL NOT NULL,
      extension TEXT NOT NULL,
      base_name TEXT NOT NULL,
      file_type TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0,
      first_seen_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_photos_folder_id ON photos(folder_id);
    CREATE INDEX IF NOT EXISTS idx_photos_base_name ON photos(base_name);
    CREATE INDEX IF NOT EXISTS idx_photos_file_type ON photos(file_type);

    CREATE TABLE IF NOT EXISTS scan_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      folder_id INTEGER NOT NULL,
      started_at INTEGER NOT NULL,
      finished_at INTEGER NOT NULL,
      total_files INTEGER NOT NULL,
      new_files INTEGER NOT NULL,
      updated_files INTEGER NOT NULL,
      missing_files INTEGER NOT NULL,
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE
    );
  `)
}

async function loadDatabase(): Promise<Database> {
  const SQL = await getSql()
  const dbPath = getDbPath()

  try {
    const dbBytes = await readFile(dbPath)
    const db = new SQL.Database(dbBytes)
    ensureSchema(db)
    return db
  } catch {
    const db = new SQL.Database()
    ensureSchema(db)
    return db
  }
}

async function getDatabase(): Promise<Database> {
  databasePromise ??= loadDatabase()
  return databasePromise
}

async function saveDatabase(db: Database): Promise<void> {
  const dbPath = getDbPath()
  await mkdir(app.getPath('userData'), { recursive: true })
  await writeFile(dbPath, Buffer.from(db.export()))
}

function getFolderId(db: Database, folderPath: string, isRemovable: boolean, now: number): number {
  db.run(
    `INSERT INTO folders (path, is_removable, created_at, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET is_removable = excluded.is_removable, updated_at = excluded.updated_at`,
    [folderPath, isRemovable ? 1 : 0, now, now]
  )

  const result = db.exec('SELECT id FROM folders WHERE path = ?', [folderPath])
  const folderId = result[0]?.values[0]?.[0]

  if (typeof folderId !== 'number') {
    throw new Error('Could not resolve folder index row.')
  }

  return folderId
}

export async function indexScannedPhotos(
  folderPath: string,
  files: PhotoFile[],
  isRemovable: boolean
): Promise<ScanSummary> {
  const db = await getDatabase()
  const now = Date.now()
  const startedAt = now
  const folderId = getFolderId(db, folderPath, isRemovable, now)
  const currentPaths = new Set(files.map((file) => file.path))
  let newFiles = 0
  let updatedFiles = 0
  let missingFiles = 0

  db.run('BEGIN TRANSACTION')

  try {
    const existingByPath = new Map<string, { size: number; modifiedAt: number; isDeleted: number }>()
    const existingRows = db.exec('SELECT path, size, modified_at, is_deleted FROM photos WHERE folder_id = ?', [folderId])

    for (const row of existingRows[0]?.values ?? []) {
      existingByPath.set(String(row[0]), {
        size: Number(row[1]),
        modifiedAt: Number(row[2]),
        isDeleted: Number(row[3])
      })
    }

    const insertOrUpdate = db.prepare(`
      INSERT INTO photos (
        folder_id, path, name, size, modified_at, extension, base_name, file_type,
        is_deleted, first_seen_at, last_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        folder_id = excluded.folder_id,
        name = excluded.name,
        size = excluded.size,
        modified_at = excluded.modified_at,
        extension = excluded.extension,
        base_name = excluded.base_name,
        file_type = excluded.file_type,
        is_deleted = 0,
        last_seen_at = excluded.last_seen_at
    `)

    for (const file of files.map(toIndexedPhoto)) {
      const existing = existingByPath.get(file.path)

      if (!existing) {
        newFiles += 1
      } else if (existing.size !== file.size || existing.modifiedAt !== file.modifiedAt || existing.isDeleted) {
        updatedFiles += 1
      }

      insertOrUpdate.run([
        folderId,
        file.path,
        file.name,
        file.size,
        file.modifiedAt,
        file.extension,
        file.baseName,
        file.fileType,
        now,
        now
      ])
    }

    insertOrUpdate.free()

    const markDeleted = db.prepare('UPDATE photos SET is_deleted = 1, last_seen_at = ? WHERE folder_id = ? AND path = ?')

    for (const [path, existing] of existingByPath) {
      if (!currentPaths.has(path) && !existing.isDeleted) {
        missingFiles += 1
        markDeleted.run([now, folderId, path])
      }
    }

    markDeleted.free()

    db.run(
      `INSERT INTO scan_runs (folder_id, started_at, finished_at, total_files, new_files, updated_files, missing_files)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [folderId, startedAt, Date.now(), files.length, newFiles, updatedFiles, missingFiles]
    )

    db.run('COMMIT')
  } catch (error) {
    db.run('ROLLBACK')
    throw error
  }

  await saveDatabase(db)

  return {
    indexed: files.length,
    newFiles,
    updatedFiles,
    missingFiles
  }
}
