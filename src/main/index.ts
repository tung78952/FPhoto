import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { exec } from 'node:child_process'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { basename, extname, join } from 'node:path'
import { promisify } from 'node:util'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import exifr from 'exifr'
import type { exiftool as exiftoolType } from 'exiftool-vendored'
import type { CopyRequest, CopyResult, PhotoFile, PhotoScanResult } from '../shared/types'

const require = createRequire(import.meta.url)
const { exiftool } = require('exiftool-vendored') as { exiftool: typeof exiftoolType }

const execAsync = promisify(exec)

// Win32_LogicalDisk.DriveType: 2 = Removable (SD/CF via reader, USB sticks).
const removableDriveType = 2

const photoExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.tif',
  '.tiff',
  '.bmp',
  '.gif',
  '.webp',
  '.heic',
  '.cr2',
  '.cr3',
  '.nef',
  '.arw',
  '.raf',
  '.orf',
  '.rw2',
  '.dng'
])

const previewMimeTypes = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.gif', 'image/gif'],
  ['.bmp', 'image/bmp']
])

const rawExtensions = new Set(['.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng'])

const maxPreviewBytes = 80 * 1024 * 1024

function isPhotoFile(fileName: string): boolean {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return false

  return photoExtensions.has(fileName.slice(dotIndex).toLowerCase())
}

async function getPreviewDataUrl(filePath: string): Promise<string | null> {
  const fileExtension = extname(filePath).toLowerCase()
  const mimeType = previewMimeTypes.get(fileExtension)
  if (!mimeType) return null

  const fileStat = await stat(filePath)
  if (fileStat.size > maxPreviewBytes) return null

  const fileBuffer = await readFile(filePath)
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`
}

function getEmbeddedPreviewMimeType(previewBytes: Uint8Array): string {
  if (previewBytes[0] === 0xff && previewBytes[1] === 0xd8) return 'image/jpeg'
  if (previewBytes[0] === 0x89 && previewBytes[1] === 0x50 && previewBytes[2] === 0x4e && previewBytes[3] === 0x47) {
    return 'image/png'
  }

  return 'image/jpeg'
}

async function extractExifToolPreview(filePath: string, cacheFolder: string, cacheKey: string): Promise<string | null> {
  const extractionAttempts = [
    { name: 'preview', extract: (outputPath: string) => exiftool.extractPreview(filePath, outputPath) },
    { name: 'jpg-from-raw', extract: (outputPath: string) => exiftool.extractJpgFromRaw(filePath, outputPath) },
    { name: 'thumbnail', extract: (outputPath: string) => exiftool.extractThumbnail(filePath, outputPath) }
  ]

  for (const attempt of extractionAttempts) {
    const outputPath = join(cacheFolder, `${cacheKey}-${attempt.name}.jpg`)

    try {
      await unlink(outputPath).catch(() => undefined)
      await attempt.extract(outputPath)

      const previewBuffer = await readFile(outputPath)
      await unlink(outputPath).catch(() => undefined)

      if (previewBuffer.length === 0) continue

      return `data:${getEmbeddedPreviewMimeType(previewBuffer)};base64,${previewBuffer.toString('base64')}`
    } catch {
      await unlink(outputPath).catch(() => undefined)
    }
  }

  return null
}

async function getRawPreviewDataUrl(filePath: string): Promise<string | null> {
  if (!rawExtensions.has(extname(filePath).toLowerCase())) return null

  const fileStat = await stat(filePath)
  const cacheKey = createHash('sha1')
    .update(`${filePath}:${fileStat.size}:${fileStat.mtimeMs}`)
    .digest('hex')
  const cacheFolder = join(app.getPath('userData'), 'preview-cache')
  const cachePath = join(cacheFolder, `${cacheKey}.txt`)

  try {
    return await readFile(cachePath, 'utf8')
  } catch {
    // Cache miss; fall through and extract from the RAW file.
  }

  await mkdir(cacheFolder, { recursive: true })

  let dataUrl: string | null = null
  let previewBytes: Uint8Array | Buffer | undefined
  try {
    previewBytes = await exifr.thumbnail(filePath)
  } catch {
    previewBytes = undefined
  }

  if (previewBytes && previewBytes.length > 0) {
    const previewBuffer = Buffer.from(previewBytes)
    const previewMimeType = getEmbeddedPreviewMimeType(previewBytes)
    dataUrl = `data:${previewMimeType};base64,${previewBuffer.toString('base64')}`
  }

  dataUrl ??= await extractExifToolPreview(filePath, cacheFolder, cacheKey)

  if (!dataUrl) return null
  await writeFile(cachePath, dataUrl, 'utf8')

  return dataUrl
}

function getDriveLetter(targetPath: string): string | null {
  const match = /^([a-zA-Z]):/.exec(targetPath)
  return match ? `${match[1].toUpperCase()}:` : null
}

// Returns the Win32 drive type for a path's drive, or null if it cannot be
// determined (non-Windows, no drive letter, or query failure).
async function getDriveType(targetPath: string): Promise<number | null> {
  if (process.platform !== 'win32') return null

  const driveLetter = getDriveLetter(targetPath)
  if (!driveLetter) return null

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "(Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}'\\").DriveType"`
    )
    const driveType = Number.parseInt(stdout.trim(), 10)
    return Number.isNaN(driveType) ? null : driveType
  } catch {
    return null
  }
}

async function isRemovablePath(targetPath: string): Promise<boolean> {
  return (await getDriveType(targetPath)) === removableDriveType
}

async function scanPhotoFolder(folderPath: string): Promise<PhotoScanResult> {
  const files: PhotoFile[] = []
  const pendingFolders = [folderPath]

  while (pendingFolders.length > 0) {
    const currentFolder = pendingFolders.pop()
    if (!currentFolder) continue

    let entries
    try {
      entries = await readdir(currentFolder, { withFileTypes: true })
    } catch {
      continue
    }

    for (const entry of entries) {
      const entryPath = join(currentFolder, entry.name)

      if (entry.isDirectory()) {
        pendingFolders.push(entryPath)
        continue
      }

      if (!entry.isFile() || !isPhotoFile(entry.name)) continue

      try {
        const fileStat = await stat(entryPath)
        files.push({
          name: entry.name,
          path: entryPath,
          size: fileStat.size,
          modifiedAt: fileStat.mtimeMs
        })
      } catch {
        continue
      }
    }
  }

  files.sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))

  const isRemovableDrive = await isRemovablePath(folderPath)

  return { folderPath, files, isRemovableDrive }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function getAvailableDestinationPath(destinationFolder: string, fileName: string): Promise<string> {
  const extension = extname(fileName)
  const nameWithoutExtension = basename(fileName, extension)
  let attempt = 1

  while (true) {
    const suffix = attempt === 1 ? '' : ` (${attempt})`
    const destinationPath = join(destinationFolder, `${nameWithoutExtension}${suffix}${extension}`)

    if (!(await pathExists(destinationPath))) return destinationPath
    attempt += 1
  }
}

// Refuses Move when any source file lives on a removable drive, so originals on
// a memory card can never be deleted even if the renderer guard is bypassed.
async function assertSourcesAreNotRemovable(files: CopyRequest['files']): Promise<void> {
  const driveTypeByLetter = new Map<string, number | null>()

  for (const file of files) {
    const driveLetter = getDriveLetter(file.path)
    if (!driveLetter) continue

    if (!driveTypeByLetter.has(driveLetter)) {
      driveTypeByLetter.set(driveLetter, await getDriveType(driveLetter))
    }

    if (driveTypeByLetter.get(driveLetter) === removableDriveType) {
      throw new Error('Move is disabled because the source is on a removable drive (memory card).')
    }
  }
}

async function copyPhotoFiles(
  request: CopyRequest,
  sender: Electron.WebContents
): Promise<CopyResult> {
  if (request.action === 'move') {
    await assertSourcesAreNotRemovable(request.files)
  }

  await mkdir(request.destinationFolder, { recursive: true })
  let moved = 0

  for (const [index, file] of request.files.entries()) {
    const destinationPath = await getAvailableDestinationPath(request.destinationFolder, file.name)
    await copyFile(file.path, destinationPath)

    if (request.action === 'move') {
      const destinationStat = await stat(destinationPath)

      if (destinationStat.size !== file.size) {
        throw new Error(`Move verification failed for ${file.name}. Source file was not deleted.`)
      }

      await unlink(file.path)
      moved += 1
    }

    sender.send('copy:progress', {
      completed: index + 1,
      total: request.files.length,
      currentFileName: file.name
    })
  }

  return {
    copied: request.files.length,
    moved,
    destinationFolder: request.destinationFolder
  }
}

function registerIpcHandlers(): void {
  ipcMain.handle('photo:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose photo folder',
      properties: ['openDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('photo:select-destination-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose destination folder',
      properties: ['openDirectory', 'createDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('photo:scan-folder', async (_, folderPath: string) => {
    return scanPhotoFolder(folderPath)
  })

  ipcMain.handle('photo:copy-files', async (event, request: CopyRequest) => {
    return copyPhotoFiles(request, event.sender)
  })

  ipcMain.handle('photo:open-folder', async (_, folderPath: string) => {
    await shell.openPath(folderPath)
  })

  ipcMain.handle('photo:get-preview', async (_, filePath: string) => {
    return (await getPreviewDataUrl(filePath)) ?? getRawPreviewDataUrl(filePath)
  })
}

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fphoto.app')
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  void exiftool.end()
})
