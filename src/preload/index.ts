import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { CopyProgress, ExifProgress } from '../shared/types'
import type { FPhotoApi } from '../shared/types'

const api: FPhotoApi = {
  selectPhotoFolder: () => ipcRenderer.invoke('photo:select-folder'),
  selectDestinationFolder: () => ipcRenderer.invoke('photo:select-destination-folder'),
  loadCachedPhotoFolder: (folderPath) => ipcRenderer.invoke('photo:load-cached-folder', folderPath),
  scanPhotoFolder: (folderPath) => ipcRenderer.invoke('photo:scan-folder', folderPath),
  copyFiles: (request) => ipcRenderer.invoke('photo:copy-files', request),
  openFolder: (folderPath) => ipcRenderer.invoke('photo:open-folder', folderPath),
  readCodesFromImage: (imagePath) => ipcRenderer.invoke('photo:read-codes-from-image', imagePath),
  readCodesFromImageData: (request) => ipcRenderer.invoke('photo:read-codes-from-image-data', request),
  getDroppedFilePath: (file) => webUtils.getPathForFile(file),
  getPreviewDataUrl: (filePath) => ipcRenderer.invoke('photo:get-preview', filePath),
  getThumbnailDataUrl: (filePath) => ipcRenderer.invoke('photo:get-thumbnail', filePath),
  getExif: (filePath) => ipcRenderer.invoke('photo:get-exif', filePath),
  indexFolderExif: (files) => ipcRenderer.invoke('photo:index-exif', files),
  onCopyProgress: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, progress: CopyProgress): void => {
      callback(progress)
    }

    ipcRenderer.on('copy:progress', listener)
    return () => ipcRenderer.removeListener('copy:progress', listener)
  },
  onExifProgress: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, progress: ExifProgress): void => {
      callback(progress)
    }

    ipcRenderer.on('exif:progress', listener)
    return () => ipcRenderer.removeListener('exif:progress', listener)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-expect-error preload fallback for non-isolated contexts
  window.api = api
}
