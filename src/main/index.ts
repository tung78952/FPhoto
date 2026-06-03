import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import type { PhotoFile, PhotoScanResult } from '../shared/types'

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

function isPhotoFile(fileName: string): boolean {
  const dotIndex = fileName.lastIndexOf('.')
  if (dotIndex === -1) return false

  return photoExtensions.has(fileName.slice(dotIndex).toLowerCase())
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

function registerIpcHandlers(): void {
  ipcMain.handle('photo:select-folder', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Choose photo folder',
      properties: ['openDirectory']
    })

    if (result.canceled) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle('photo:scan-folder', async (_, folderPath: string) => {
    return scanPhotoFolder(folderPath)
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
