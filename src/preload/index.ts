import { contextBridge, ipcRenderer } from 'electron'
import type { CopyProgress } from '../shared/types'
import type { FPhotoApi } from '../shared/types'

const api: FPhotoApi = {
  selectPhotoFolder: () => ipcRenderer.invoke('photo:select-folder'),
  selectDestinationFolder: () => ipcRenderer.invoke('photo:select-destination-folder'),
  scanPhotoFolder: (folderPath) => ipcRenderer.invoke('photo:scan-folder', folderPath),
  copyFiles: (request) => ipcRenderer.invoke('photo:copy-files', request),
  openFolder: (folderPath) => ipcRenderer.invoke('photo:open-folder', folderPath),
  onCopyProgress: (callback) => {
    const listener = (_: Electron.IpcRendererEvent, progress: CopyProgress): void => {
      callback(progress)
    }

    ipcRenderer.on('copy:progress', listener)
    return () => ipcRenderer.removeListener('copy:progress', listener)
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
