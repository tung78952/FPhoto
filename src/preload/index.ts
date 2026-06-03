import { contextBridge, ipcRenderer } from 'electron'
import type { FPhotoApi } from '../shared/types'

const api: FPhotoApi = {
  selectPhotoFolder: () => ipcRenderer.invoke('photo:select-folder'),
  scanPhotoFolder: (folderPath) => ipcRenderer.invoke('photo:scan-folder', folderPath)
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
