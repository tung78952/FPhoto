export type PhotoFile = {
  name: string
  path: string
  size: number
  modifiedAt: number
}

export type PhotoScanResult = {
  folderPath: string
  files: PhotoFile[]
}

export type CopyRequest = {
  destinationFolder: string
  files: PhotoFile[]
}

export type CopyProgress = {
  completed: number
  total: number
  currentFileName: string
}

export type CopyResult = {
  copied: number
  destinationFolder: string
}

export type FPhotoApi = {
  selectPhotoFolder: () => Promise<string | null>
  selectDestinationFolder: () => Promise<string | null>
  scanPhotoFolder: (folderPath: string) => Promise<PhotoScanResult>
  copyFiles: (request: CopyRequest) => Promise<CopyResult>
  openFolder: (folderPath: string) => Promise<void>
  onCopyProgress: (callback: (progress: CopyProgress) => void) => () => void
}
