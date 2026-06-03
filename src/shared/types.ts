export type FileActionMode = 'copy' | 'move'

export type PhotoFile = {
  name: string
  path: string
  size: number
  modifiedAt: number
}

export type ScanSummary = {
  indexed: number
  newFiles: number
  updatedFiles: number
  missingFiles: number
}

export type PhotoScanResult = {
  folderPath: string
  files: PhotoFile[]
  isRemovableDrive: boolean
  scanSummary: ScanSummary
}

export type CopyRequest = {
  destinationFolder: string
  files: PhotoFile[]
  action: FileActionMode
}

export type CopyProgress = {
  completed: number
  total: number
  currentFileName: string
}

export type CopyResult = {
  copied: number
  moved: number
  destinationFolder: string
}

export type FPhotoApi = {
  selectPhotoFolder: () => Promise<string | null>
  selectDestinationFolder: () => Promise<string | null>
  scanPhotoFolder: (folderPath: string) => Promise<PhotoScanResult>
  copyFiles: (request: CopyRequest) => Promise<CopyResult>
  openFolder: (folderPath: string) => Promise<void>
  getPreviewDataUrl: (filePath: string) => Promise<string | null>
  onCopyProgress: (callback: (progress: CopyProgress) => void) => () => void
}
