export type FileActionMode = 'copy' | 'move'

export type PhotoFile = {
  name: string
  path: string
  size: number
  modifiedAt: number
}

export type PhotoScanResult = {
  folderPath: string
  files: PhotoFile[]
  isRemovableDrive: boolean
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

export type ExifProgress = {
  completed: number
  total: number
  currentFileName: string
}

export type PhotoExif = {
  dateTaken: number | null
  iso: number | null
  aperture: number | null
  shutter: string | null
  focalLength: number | null
  lens: string | null
  camera: string | null
}

export type ExifEntry = {
  path: string
  exif: PhotoExif
}

export type CopyResult = {
  copied: number
  moved: number
  destinationFolder: string
}

export type FPhotoApi = {
  selectPhotoFolder: () => Promise<string | null>
  selectDestinationFolder: () => Promise<string | null>
  loadCachedPhotoFolder: (folderPath: string) => Promise<PhotoScanResult | null>
  scanPhotoFolder: (folderPath: string) => Promise<PhotoScanResult>
  copyFiles: (request: CopyRequest) => Promise<CopyResult>
  openFolder: (folderPath: string) => Promise<void>
  getPreviewDataUrl: (filePath: string) => Promise<string | null>
  getThumbnailDataUrl: (filePath: string) => Promise<string | null>
  getExif: (filePath: string) => Promise<PhotoExif | null>
  indexFolderExif: (files: PhotoFile[]) => Promise<ExifEntry[]>
  onCopyProgress: (callback: (progress: CopyProgress) => void) => () => void
  onExifProgress: (callback: (progress: ExifProgress) => void) => () => void
}
