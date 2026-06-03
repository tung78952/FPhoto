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

export type FPhotoApi = {
  selectPhotoFolder: () => Promise<string | null>
  scanPhotoFolder: (folderPath: string) => Promise<PhotoScanResult>
}
