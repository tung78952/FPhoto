import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { constants } from 'node:fs'
import { access, copyFile, mkdir, readFile, readdir, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import type { CopyRequest, CopyResult, PhotoFile, PhotoScanResult } from '../shared/types'

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

const maxPreviewBytes = 80 * 1024 * 1024

function isPhotoFile(fileName: string): boolean {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return false

  return photoExtensions.has(fileName.slice(dotIndex).toLowerCase())
}

async function getPreviewDataUrl(filePath: string): Promise<string | null> {
  const mimeType = previewMimeTypes.get(extname(filePath).toLowerCase())
  if (!mimeType) return null

  const fileStat = await stat(filePath)
  if (fileStat.size > maxPreviewBytes) return null

  const fileBuffer = await readFile(filePath)
  return `data:${mimeType};base64,${fileBuffer.toString('base64')}`
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

  return { folderPath, files }
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

async function copyPhotoFiles(
  request: CopyRequest,
  sender: Electron.WebContents
): Promise<CopyResult> {
  await mkdir(request.destinationFolder, { recursive: true })

  for (const [index, file] of request.files.entries()) {
    const destinationPath = await getAvailableDestinationPath(request.destinationFolder, file.name)
    await copyFile(file.path, destinationPath)

    sender.send('copy:progress', {
      completed: index + 1,
      total: request.files.length,
      currentFileName: file.name
    })
  }

  return {
    copied: request.files.length,
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
    return getPreviewDataUrl(filePath)
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
