import { app, BrowserWindow, dialog, ipcMain, nativeImage, shell } from 'electron'
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
import {
  getCachedExif,
  getCachedExifMap,
  getCachedPhotos,
  getCachedPhotosByVolume,
  indexScannedPhotos,
  saveExifBatch
} from './photo-index'
import type {
  CopyRequest,
  CopyResult,
  ExifEntry,
  PhotoExif,
  PhotoFile,
  PhotoScanResult
} from '../shared/types'

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
const maxThumbnailSourceBytes = 120 * 1024 * 1024
const thumbnailMaxEdge = 420
const thumbnailJpegQuality = 78

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

function createThumbnailDataUrlFromBuffer(buffer: Buffer, mimeType: string): string | null {
  const image = nativeImage.createFromBuffer(buffer)
  if (image.isEmpty()) return null

  const size = image.getSize()
  if (size.width <= 0 || size.height <= 0) return null

  const scale = Math.min(1, thumbnailMaxEdge / Math.max(size.width, size.height))
  const thumbnail =
    scale < 1
      ? image.resize({
          width: Math.max(1, Math.round(size.width * scale)),
          height: Math.max(1, Math.round(size.height * scale)),
          quality: 'good'
        })
      : image

  if (thumbnail.isEmpty()) return null

  const encoded = mimeType === 'image/png' ? thumbnail.toPNG() : thumbnail.toJPEG(thumbnailJpegQuality)
  return `data:${mimeType === 'image/png' ? 'image/png' : 'image/jpeg'};base64,${encoded.toString('base64')}`
}

async function getWebFormatThumbnailDataUrl(filePath: string, fileSize: number): Promise<string | null> {
  const fileExtension = extname(filePath).toLowerCase()
  const mimeType = previewMimeTypes.get(fileExtension)
  if (!mimeType || fileSize > maxThumbnailSourceBytes) return null

  const fileBuffer = await readFile(filePath)
  return createThumbnailDataUrlFromBuffer(fileBuffer, mimeType)
}

function getDataUrlBuffer(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(dataUrl)
  if (!match) return null

  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64')
  }
}

function resizeDataUrlToThumbnail(dataUrl: string): string | null {
  const parsed = getDataUrlBuffer(dataUrl)
  if (!parsed) return null

  return createThumbnailDataUrlFromBuffer(parsed.buffer, parsed.mimeType)
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

async function getThumbnailDataUrl(filePath: string): Promise<string | null> {
  const fileStat = await stat(filePath).catch(() => null)
  if (!fileStat) return null

  const cacheKey = createHash('sha1')
    .update(`${filePath}:${fileStat.size}:${fileStat.mtimeMs}:thumb-v2:${thumbnailMaxEdge}:${thumbnailJpegQuality}`)
    .digest('hex')
  const cacheFolder = join(app.getPath('userData'), 'preview-cache')
  const cachePath = join(cacheFolder, `${cacheKey}.txt`)

  try {
    return await readFile(cachePath, 'utf8')
  } catch {
    // Cache miss; fall through and extract a thumbnail.
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
    dataUrl = createThumbnailDataUrlFromBuffer(previewBuffer, getEmbeddedPreviewMimeType(previewBytes))
  }

  dataUrl ??= await getWebFormatThumbnailDataUrl(filePath, fileStat.size)

  const extractedPreview = dataUrl ? null : await extractExifToolPreview(filePath, cacheFolder, cacheKey)
  dataUrl ??= extractedPreview ? resizeDataUrlToThumbnail(extractedPreview) : null

  if (!dataUrl) return null
  await writeFile(cachePath, dataUrl, 'utf8')

  return dataUrl
}

const emptyExif: PhotoExif = {
  dateTaken: null,
  iso: null,
  aperture: null,
  shutter: null,
  focalLength: null,
  lens: null,
  camera: null
}

function firstNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (Array.isArray(value) && typeof value[0] === 'number' && Number.isFinite(value[0])) return value[0]
  return null
}

function formatShutter(exposureTime: unknown): string | null {
  if (typeof exposureTime !== 'number' || !(exposureTime > 0)) return null
  if (exposureTime >= 1) return `${Number(exposureTime.toFixed(1))}s`
  return `1/${Math.round(1 / exposureTime)}`
}

async function readExifData(filePath: string): Promise<PhotoExif> {
  try {
    const tags = await exifr.parse(filePath, {
      pick: ['DateTimeOriginal', 'CreateDate', 'ISO', 'FNumber', 'ExposureTime', 'FocalLength', 'LensModel', 'Make', 'Model']
    })

    if (!tags) return { ...emptyExif }

    const dateValue = tags.DateTimeOriginal ?? tags.CreateDate
    const dateTaken =
      dateValue instanceof Date ? dateValue.getTime() : typeof dateValue === 'number' ? dateValue : null
    const camera = [tags.Make, tags.Model]
      .filter((part): part is string => typeof part === 'string' && part.length > 0)
      .join(' ')
      .trim()

    return {
      dateTaken: dateTaken !== null && Number.isFinite(dateTaken) ? dateTaken : null,
      iso: firstNumber(tags.ISO),
      aperture: firstNumber(tags.FNumber),
      shutter: formatShutter(tags.ExposureTime),
      focalLength: firstNumber(tags.FocalLength),
      lens: typeof tags.LensModel === 'string' && tags.LensModel.length > 0 ? tags.LensModel : null,
      camera: camera.length > 0 ? camera : null
    }
  } catch {
    return { ...emptyExif }
  }
}

async function indexFolderExif(files: PhotoFile[], sender: Electron.WebContents): Promise<ExifEntry[]> {
  const cachedMap = await getCachedExifMap()
  const entries: ExifEntry[] = []
  const toSave: Array<{ path: string; modifiedAt: number; exif: PhotoExif }> = []

  for (const [index, file] of files.entries()) {
    const cached = cachedMap.get(file.path)
    let exif: PhotoExif

    if (cached && cached.modifiedAt === file.modifiedAt) {
      exif = cached.exif
    } else {
      exif = await readExifData(file.path)
      toSave.push({ path: file.path, modifiedAt: file.modifiedAt, exif })
    }

    entries.push({ path: file.path, exif })
    sender.send('exif:progress', {
      completed: index + 1,
      total: files.length,
      currentFileName: file.name
    })
  }

  await saveExifBatch(toSave)
  return entries
}

function getDriveLetter(targetPath: string): string | null {
  const match = /^([a-zA-Z]):/.exec(targetPath)
  return match ? `${match[1].toUpperCase()}:` : null
}

type DriveInfo = { driveType: number | null; volumeSerial: string | null }

// Returns the Win32 drive type and volume serial for a path's drive in one query,
// or nulls if they cannot be determined (non-Windows, no drive letter, failure).
async function getDriveInfo(targetPath: string): Promise<DriveInfo> {
  const empty: DriveInfo = { driveType: null, volumeSerial: null }
  if (process.platform !== 'win32') return empty

  const driveLetter = getDriveLetter(targetPath)
  if (!driveLetter) return empty

  try {
    const { stdout } = await execAsync(
      `powershell -NoProfile -NonInteractive -Command "$d = Get-CimInstance Win32_LogicalDisk -Filter \\"DeviceID='${driveLetter}'\\"; Write-Output \\"$($d.DriveType)|$($d.VolumeSerialNumber)\\""`
    )
    const [driveTypeRaw, volumeSerialRaw] = stdout.trim().split('|')
    const driveType = Number.parseInt((driveTypeRaw ?? '').trim(), 10)
    const volumeSerial = (volumeSerialRaw ?? '').trim()

    return {
      driveType: Number.isNaN(driveType) ? null : driveType,
      volumeSerial: volumeSerial.length > 0 ? volumeSerial : null
    }
  } catch {
    return empty
  }
}

async function getDriveType(targetPath: string): Promise<number | null> {
  return (await getDriveInfo(targetPath)).driveType
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

  const driveInfo = await getDriveInfo(folderPath)
  const isRemovableDrive = driveInfo.driveType === removableDriveType
  await indexScannedPhotos(folderPath, files, isRemovableDrive, driveInfo.volumeSerial)

  return { folderPath, files, isRemovableDrive }
}

async function loadCachedPhotoFolder(folderPath: string): Promise<PhotoScanResult | null> {
  const driveInfo = await getDriveInfo(folderPath)
  const isRemovableDrive = driveInfo.driveType === removableDriveType

  let files = await getCachedPhotos(folderPath)

  // A memory card can mount under a different drive letter each time. If the exact
  // path has no cache, recognize the same card by its volume serial and remap paths.
  if (files.length === 0 && isRemovableDrive && driveInfo.volumeSerial) {
    files = await getCachedPhotosByVolume(driveInfo.volumeSerial, folderPath)
  }

  if (files.length === 0) return null

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

  ipcMain.handle('photo:load-cached-folder', async (_, folderPath: string) => {
    return loadCachedPhotoFolder(folderPath)
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

  ipcMain.handle('photo:get-thumbnail', async (_, filePath: string) => {
    return getThumbnailDataUrl(filePath)
  })

  ipcMain.handle('photo:get-exif', async (_, filePath: string) => {
    const fileStat = await stat(filePath).catch(() => null)
    if (!fileStat) return null

    const cached = await getCachedExif(filePath, fileStat.mtimeMs)
    if (cached) return cached

    const exif = await readExifData(filePath)
    await saveExifBatch([{ path: filePath, modifiedAt: fileStat.mtimeMs, exif }])
    return exif
  })

  ipcMain.handle('photo:index-exif', async (event, files: PhotoFile[]) => {
    return indexFolderExif(files, event.sender)
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
