import { memo, useCallback, useEffect, useMemo, useRef, useState, type ClipboardEvent, type DragEvent } from 'react'
import logoMark from './assets/logo-mark.png'
import { filterFilesByCodes, parseSearchInput } from '../../shared/search'
import type { CopyProgress, ExifProgress, FileActionMode, PhotoExif, PhotoFile } from '../../shared/types'

type ThemeMode = 'light' | 'dark'
type LanguageMode = 'vi' | 'en'
type ResultMode = 'matched' | 'unmatched'
type FileTypeFilter = 'all' | 'jpeg' | 'raw' | 'other'
type ListViewMode = 'files' | 'groups' | 'grid'

type PhotoFileGroup = {
  baseName: string
  files: PhotoFile[]
  totalSize: number
  modifiedAt: number
  types: string[]
}

type ExifFilter = {
  dateFromMs: number | null
  dateToMs: number | null
  isoMin: number | null
  isoMax: number | null
}

type Toast =
  | { kind: 'copy' | 'move'; count: number; destinationFolder: string }
  | { kind: 'open'; destinationFolder: string }

type IconName =
  | 'check'
  | 'copy'
  | 'exif'
  | 'folder'
  | 'grid'
  | 'groups'
  | 'image'
  | 'list'
  | 'lock'
  | 'moon'
  | 'move'
  | 'open'
  | 'refresh'
  | 'search'
  | 'settings'
  | 'sun'

const jpegExtensions = new Set(['.jpg', '.jpeg'])
const rawExtensions = new Set(['.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng'])
const previewableExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])
const ocrImageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tif', '.tiff'])
const ocrImageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff'])
const resultCap = 500
const gridGap = 12
const gridMinCellWidth = 168
const gridOverscanRows = 3
const gridPadding = 20
const thumbnailMemoryCacheLimit = 900

const translations = {
  vi: {
    settings: 'Cài đặt',
    language: 'Ngôn ngữ',
    languageDescription: 'Đổi ngôn ngữ giao diện. Cài đặt được lưu tự động.',
    vietnamese: 'Tiếng Việt',
    english: 'English',
    close: 'Đóng',
    themeToggle: 'Đổi giao diện sáng / tối',
    selectedFolder: 'Thư mục đã chọn',
    dropFolderToScan: 'Thả thư mục để quét',
    dragFolderHere: 'Kéo thư mục ảnh vào đây',
    orChooseFolder: 'hoặc bấm Chọn thư mục',
    chooseFolder: 'Chọn thư mục',
    scanning: 'Đang quét...',
    rescan: 'Quét lại',
    removableSourceRail: 'Nguồn là thẻ nhớ/ổ rời. Move đã bị khóa để bảo vệ ảnh gốc.',
    searchCodesLabel: 'Mã ảnh cần lọc',
    searchPlaceholder: 'EX0001, EX0005, EX0010-EX0020 hoặc 1, 5, 10-20',
    readingImage: 'Đang đọc ảnh...',
    pasteImageHint: 'Có thể dán/thả ảnh text vào đây',
    dropToReadCodes: 'Thả để đọc mã',
    recognized: 'nhận diện',
    matched: 'khớp',
    unmatched: 'không khớp',
    useMatched: 'Dùng file khớp',
    useUnmatched: 'Dùng file không khớp',
    scannedFiles: 'file đã quét',
    totalSize: 'tổng dung lượng',
    fileType: 'Loại file',
    all: 'Tất cả',
    other: 'Khác',
    exifFilter: 'Lọc theo EXIF',
    reading: 'Đang đọc...',
    readAgain: 'Đọc lại',
    readExif: 'Đọc EXIF',
    fromDate: 'Từ ngày',
    toDate: 'Đến ngày',
    isoMin: 'ISO nhỏ nhất',
    isoMax: 'ISO lớn nhất',
    clearFilter: 'Xóa lọc',
    exifNotLoaded: 'Chưa đọc EXIF. Bấm để đọc metadata từng file và lưu đệm.',
    workspaceLabel: 'Không gian lọc ảnh',
    filteredResults: 'Kết quả lọc',
    allResults: 'Tất cả',
    groupsWord: 'nhóm',
    photosWord: 'ảnh',
    list: 'Danh sách',
    groups: 'Nhóm',
    grid: 'Lưới',
    chooseFolderToStart: 'Chọn thư mục để bắt đầu',
    dropFolderToStart: 'Thả thư mục để bắt đầu',
    scanningFolder: 'Đang quét thư mục...',
    noMatchingFiles: 'Không tìm thấy file khớp',
    countingFiles: 'Đếm file và dung lượng',
    emptyFolderHelp: 'Kéo thư mục ảnh vào đây hoặc bấm Chọn thư mục.',
    noMatchHelp: 'Thử đổi mã ảnh hoặc loại file.',
    photoGroups: 'Nhóm ảnh',
    fileCount: 'Số file',
    type: 'Loại',
    modifiedAt: 'Sửa lúc',
    matchedFile: 'File khớp',
    unmatchedFile: 'File không khớp',
    size: 'Dung lượng',
    preview: 'Xem trước',
    loadingPreview: 'Đang tải xem trước...',
    previewUnavailable: 'Không xem trước được',
    rawPreviewHelp: 'File RAW cần ảnh preview nhúng được hỗ trợ.',
    noExifForFile: 'File này không có EXIF hoặc chưa đọc được EXIF.',
    selectFileForPreview: 'Bấm một file trong danh sách để xem trước.',
    noDestination: 'Chưa chọn thư mục đích',
    chooseDestination: 'Chọn đích',
    open: 'Mở',
    moving: 'Đang chuyển',
    copying: 'Đang copy',
    movingDots: 'Đang chuyển...',
    copyingDots: 'Đang copy...',
    removableSourceTransfer: 'Nguồn là thẻ nhớ/ổ rời. Đã khóa Move để bảo vệ ảnh gốc, chỉ cho phép Copy.',
    byTung: 'A product by Tùng',
    openingDestination: 'Đang mở thư mục đích',
    movedFiles: 'Đã chuyển',
    copiedFiles: 'Đã copy',
    openFolder: 'Mở thư mục',
    cancel: 'Hủy',
    moveQuestion: 'Chuyển',
    moveWarning: 'Move sẽ xóa file khỏi nguồn sau khi đã copy và kiểm tra dung lượng bản đích. Thao tác này không thể hoàn tác.',
    moveAction: 'Chuyển',
    loadedCache: 'Đã tải kết quả quét trước từ bộ nhớ đệm. Bấm "Quét lại" để làm mới.',
    chooseFolderFirst: 'Chọn thư mục ảnh trước.',
    scanFolderError: 'Không quét được thư mục này.',
    chooseDestinationFirst: 'Chọn thư mục đích trước.',
    noFilesToTransfer: 'Không có file {mode} để xử lý.',
    moveLockedError: 'Move bị khóa vì nguồn đang nằm trên thẻ nhớ/ổ rời. Hãy dùng Copy.',
    transferError: 'Không xử lý được các file đã chọn.',
    unsupportedOcrImage: 'Ảnh không hỗ trợ. Dùng JPG, PNG, WEBP, BMP hoặc TIFF.',
    noOcrCodes: 'Chưa nhận ra mã ảnh. Thử ảnh rõ hơn hoặc nhập tay.',
    ocrNotice: 'Đã nhận {count} mã từ ảnh.',
    ocrReadError: 'Không đọc được ảnh này.',
    dropImageHere: 'Kéo ảnh vào ô này.',
    dropPhotoFolder: 'Kéo thư mục ảnh vào đây.',
    dropFolderNotFile: 'Kéo thư mục ảnh vào đây, không phải file.',
    scanBeforeExif: 'Quét một thư mục ảnh trước.',
    exifReadError: 'Không đọc được EXIF.',
    rawNoEmbeddedPreview: 'File RAW này không có ảnh xem trước nhúng được hỗ trợ.',
    previewLoadError: 'Không tải được preview.',
    exifLoadedStatus: 'Đã đọc EXIF cho {count} file{filter}.',
    exifFilterOn: ' · bật lọc: {count} khớp',
    cappedNotice: 'Đang hiện {cap} mục đầu. Bộ lọc đã dùng toàn bộ {total} file và tìm thấy {count} kết quả.',
    exifDateTaken: 'Ngày chụp',
    exifCamera: 'Máy ảnh',
    exifLens: 'Ống kính',
    exifAperture: 'Khẩu độ',
    exifShutter: 'Tốc độ',
    exifFocalLength: 'Tiêu cự'
  },
  en: {
    settings: 'Settings',
    language: 'Language',
    languageDescription: 'Change the interface language. Your choice is saved automatically.',
    vietnamese: 'Tiếng Việt',
    english: 'English',
    close: 'Close',
    themeToggle: 'Switch light / dark theme',
    selectedFolder: 'Selected folder',
    dropFolderToScan: 'Drop folder to scan',
    dragFolderHere: 'Drag a photo folder here',
    orChooseFolder: 'or click Choose folder',
    chooseFolder: 'Choose folder',
    scanning: 'Scanning...',
    rescan: 'Rescan',
    removableSourceRail: 'Source is a memory card/removable drive. Move is locked to protect original photos.',
    searchCodesLabel: 'Image codes to filter',
    searchPlaceholder: 'EX0001, EX0005, EX0010-EX0020 or 1, 5, 10-20',
    readingImage: 'Reading image...',
    pasteImageHint: 'Paste/drop a text image here',
    dropToReadCodes: 'Drop to read codes',
    recognized: 'recognized',
    matched: 'matched',
    unmatched: 'unmatched',
    useMatched: 'Use matched files',
    useUnmatched: 'Use unmatched files',
    scannedFiles: 'scanned files',
    totalSize: 'total size',
    fileType: 'File type',
    all: 'All',
    other: 'Other',
    exifFilter: 'EXIF filter',
    reading: 'Reading...',
    readAgain: 'Read again',
    readExif: 'Read EXIF',
    fromDate: 'From date',
    toDate: 'To date',
    isoMin: 'Min ISO',
    isoMax: 'Max ISO',
    clearFilter: 'Clear filter',
    exifNotLoaded: 'EXIF has not been loaded. Read metadata for each file and cache it.',
    workspaceLabel: 'Photo filtering workspace',
    filteredResults: 'Filtered results',
    allResults: 'All',
    groupsWord: 'groups',
    photosWord: 'photos',
    list: 'List',
    groups: 'Groups',
    grid: 'Grid',
    chooseFolderToStart: 'Choose a folder to start',
    dropFolderToStart: 'Drop folder to start',
    scanningFolder: 'Scanning folder...',
    noMatchingFiles: 'No matching files found',
    countingFiles: 'Counting files and size',
    emptyFolderHelp: 'Drag a photo folder here or click Choose folder.',
    noMatchHelp: 'Try different image codes or file type.',
    photoGroups: 'Photo groups',
    fileCount: 'File count',
    type: 'Type',
    modifiedAt: 'Modified',
    matchedFile: 'Matched file',
    unmatchedFile: 'Unmatched file',
    size: 'Size',
    preview: 'Preview',
    loadingPreview: 'Loading preview...',
    previewUnavailable: 'Preview unavailable',
    rawPreviewHelp: 'This RAW file needs a supported embedded preview.',
    noExifForFile: 'This file has no EXIF or EXIF could not be read yet.',
    selectFileForPreview: 'Select a file in the list to preview it.',
    noDestination: 'No destination folder selected',
    chooseDestination: 'Choose destination',
    open: 'Open',
    moving: 'Moving',
    copying: 'Copying',
    movingDots: 'Moving...',
    copyingDots: 'Copying...',
    removableSourceTransfer: 'Source is a memory card/removable drive. Move is locked to protect originals; Copy only.',
    byTung: 'A product by Tùng',
    openingDestination: 'Opening destination folder',
    movedFiles: 'Moved',
    copiedFiles: 'Copied',
    openFolder: 'Open folder',
    cancel: 'Cancel',
    moveQuestion: 'Move',
    moveWarning: 'Move deletes files from the source after copying and verifying the destination size. This cannot be undone.',
    moveAction: 'Move',
    loadedCache: 'Loaded previous scan from cache. Press "Rescan" to refresh.',
    chooseFolderFirst: 'Choose a photo folder first.',
    scanFolderError: 'Could not scan this folder.',
    chooseDestinationFirst: 'Choose a destination folder first.',
    noFilesToTransfer: 'No {mode} files to process.',
    moveLockedError: 'Move is locked because the source is on a memory card/removable drive. Use Copy.',
    transferError: 'Could not process the selected files.',
    unsupportedOcrImage: 'Unsupported image. Use JPG, PNG, WEBP, BMP, or TIFF.',
    noOcrCodes: 'No image codes recognized. Try a clearer image or type them manually.',
    ocrNotice: 'Recognized {count} codes from the image.',
    ocrReadError: 'Could not read this image.',
    dropImageHere: 'Drop an image into this box.',
    dropPhotoFolder: 'Drop a photo folder here.',
    dropFolderNotFile: 'Drop a photo folder here, not a file.',
    scanBeforeExif: 'Scan a photo folder first.',
    exifReadError: 'Could not read EXIF.',
    rawNoEmbeddedPreview: 'This RAW file has no supported embedded preview.',
    previewLoadError: 'Could not load preview.',
    exifLoadedStatus: 'Read EXIF for {count} files{filter}.',
    exifFilterOn: ' · filter on: {count} matched',
    cappedNotice: 'Showing the first {cap} items. The filter used all {total} files and found {count} results.',
    exifDateTaken: 'Date taken',
    exifCamera: 'Camera',
    exifLens: 'Lens',
    exifAperture: 'Aperture',
    exifShutter: 'Shutter',
    exifFocalLength: 'Focal length'
  }
} as const

class ThumbnailQueue {
  private activeCount = 0
  private readonly queuedTasks: Array<() => void> = []

  constructor(private readonly concurrency: number) {}

  enqueue(task: () => Promise<string | null>): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const run = (): void => {
        this.activeCount += 1
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.activeCount -= 1
            this.queuedTasks.shift()?.()
          })
      }

      if (this.activeCount < this.concurrency) {
        run()
      } else {
        this.queuedTasks.push(run)
      }
    })
  }
}

const thumbnailQueue = new ThumbnailQueue(4)

function rememberThumbnail(cache: Map<string, string | null>, filePath: string, dataUrl: string | null): void {
  if (cache.has(filePath)) cache.delete(filePath)
  cache.set(filePath, dataUrl)

  while (cache.size > thumbnailMemoryCacheLimit) {
    const oldestKey = cache.keys().next().value
    if (!oldestKey) break
    cache.delete(oldestKey)
  }
}

function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

function Icon({ name, size = 16 }: { name: IconName; size?: number }): JSX.Element {
  const props = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const
  }

  switch (name) {
    case 'check':
      return (
        <svg {...props}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case 'copy':
      return (
        <svg {...props}>
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h8" />
        </svg>
      )
    case 'exif':
      return (
        <svg {...props}>
          <path d="M4 6h16M4 12h16M4 18h16" />
          <circle cx="9" cy="6" r="2" fill="currentColor" stroke="none" />
          <circle cx="15" cy="12" r="2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="18" r="2" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'folder':
      return (
        <svg {...props}>
          <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...props}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'groups':
      return (
        <svg {...props}>
          <rect x="3" y="4" width="18" height="6" rx="1.5" />
          <rect x="3" y="14" width="18" height="6" rx="1.5" />
        </svg>
      )
    case 'image':
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <circle cx="8" cy="10" r="1.7" />
          <path d="m4 17 5-5 4 4 2-2 5 5" />
        </svg>
      )
    case 'list':
      return (
        <svg {...props}>
          <path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
      )
    case 'lock':
      return (
        <svg {...props}>
          <rect x="4" y="11" width="16" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
      )
    case 'moon':
      return (
        <svg {...props}>
          <path d="M21 12.8A8 8 0 1 1 11.2 3a6.3 6.3 0 0 0 9.8 9.8z" />
        </svg>
      )
    case 'move':
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      )
    case 'open':
      return (
        <svg {...props}>
          <path d="M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
        </svg>
      )
    case 'refresh':
      return (
        <svg {...props}>
          <path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />
        </svg>
      )
    case 'search':
      return (
        <svg {...props}>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.2-3.2" />
        </svg>
      )
    case 'settings':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.8 1.8 0 0 0 .36 2l.05.05a2.1 2.1 0 1 1-3 3l-.05-.05a1.8 1.8 0 0 0-2-.36 1.8 1.8 0 0 0-1.1 1.65V22a2.1 2.1 0 0 1-4.2 0v-.08a1.8 1.8 0 0 0-1.18-1.65 1.8 1.8 0 0 0-2 .36l-.05.05a2.1 2.1 0 1 1-3-3l.05-.05a1.8 1.8 0 0 0 .36-2 1.8 1.8 0 0 0-1.65-1.1H2a2.1 2.1 0 0 1 0-4.2h.08a1.8 1.8 0 0 0 1.65-1.18 1.8 1.8 0 0 0-.36-2l-.05-.05a2.1 2.1 0 1 1 3-3l.05.05a1.8 1.8 0 0 0 2 .36H8.5A1.8 1.8 0 0 0 9.6 2.7V2a2.1 2.1 0 0 1 4.2 0v.08a1.8 1.8 0 0 0 1.1 1.65 1.8 1.8 0 0 0 2-.36l.05-.05a2.1 2.1 0 1 1 3 3l-.05.05a1.8 1.8 0 0 0-.36 2v.13a1.8 1.8 0 0 0 1.65 1.1H22a2.1 2.1 0 0 1 0 4.2h-.08A1.8 1.8 0 0 0 19.4 15z" />
        </svg>
      )
    case 'sun':
      return (
        <svg {...props}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5.6 5.6 4.2 4.2M19.8 19.8l-1.4-1.4M18.4 5.6l1.4-1.4M4.2 19.8l1.4-1.4" />
        </svg>
      )
  }
}

function readStoredValue<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const value = localStorage.getItem(key)
    return value && allowed.includes(value as T) ? (value as T) : fallback
  } catch {
    return fallback
  }
}

function readStoredText(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 100 || index === 0 ? 0 : 1).replace('.', ',')} ${units[index]}`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatDateFull(timestamp: number): string {
  const date = new Date(timestamp)
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase()
}

function isLikelyPhotoFilePath(path: string): boolean {
  const extension = getFileExtension(path)
  return previewableExtensions.has(extension) || rawExtensions.has(extension) || extension === '.tif' || extension === '.tiff' || extension === '.heic'
}

function isSupportedOcrImage(file: File): boolean {
  return ocrImageExtensions.has(getFileExtension(file.name)) || ocrImageMimeTypes.has(file.type.toLowerCase())
}

function hasDraggedFiles(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes('Files')
}

function hasDraggedDirectory(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.items).some((item) => {
    const entry = (item as DataTransferItem & { webkitGetAsEntry?: () => { isDirectory: boolean } | null }).webkitGetAsEntry?.()
    return entry?.isDirectory
  })
}

function getParentFolderPath(path: string): string {
  const separatorIndex = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return separatorIndex === -1 ? path : path.slice(0, separatorIndex)
}

function getImageFileFromTransfer(dataTransfer: DataTransfer): File | null {
  const files = Array.from(dataTransfer.files)
  const fileFromFiles = files.find(isSupportedOcrImage)
  if (fileFromFiles) return fileFromFiles

  for (const item of Array.from(dataTransfer.items)) {
    if (item.kind !== 'file' || !item.type.startsWith('image/')) continue

    const file = item.getAsFile()
    if (file && isSupportedOcrImage(file)) return file
  }

  return null
}

function getBaseName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? fileName : fileName.slice(0, dotIndex)
}

function getFileType(fileName: string): Exclude<FileTypeFilter, 'all'> {
  const extension = getFileExtension(fileName)

  if (jpegExtensions.has(extension)) return 'jpeg'
  if (rawExtensions.has(extension)) return 'raw'
  return 'other'
}

function getTypeLabel(fileName: string): string {
  return getFileType(fileName).toUpperCase()
}

function filterFilesByType(files: PhotoFile[], fileType: FileTypeFilter): PhotoFile[] {
  if (fileType === 'all') return files
  return files.filter((file) => getFileType(file.name) === fileType)
}

function canPreviewFile(fileName: string): boolean {
  const extension = getFileExtension(fileName)
  return previewableExtensions.has(extension) || rawExtensions.has(extension)
}

function groupFilesByBaseName(files: PhotoFile[]): PhotoFileGroup[] {
  const groups = new Map<string, PhotoFile[]>()

  for (const file of files) {
    const baseName = getBaseName(file.name)
    const groupFiles = groups.get(baseName) ?? []
    groupFiles.push(file)
    groups.set(baseName, groupFiles)
  }

  return [...groups.entries()]
    .map(([baseName, groupFiles]) => ({
      baseName,
      files: groupFiles,
      totalSize: groupFiles.reduce((sum, file) => sum + file.size, 0),
      modifiedAt: Math.max(...groupFiles.map((file) => file.modifiedAt)),
      types: [...new Set(groupFiles.map((file) => getFileExtension(file.name).slice(1).toUpperCase()))].sort()
    }))
    .sort((left, right) => left.baseName.localeCompare(right.baseName, undefined, { numeric: true }))
}

function getBestPreviewFile(files: PhotoFile[]): PhotoFile {
  return files.find((file) => canPreviewFile(file.name)) ?? files[0]
}

function parseDateInput(value: string, endOfDay: boolean): number | null {
  if (!value) return null
  const time = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}`).getTime()
  return Number.isNaN(time) ? null : time
}

function parseNumberInput(value: string): number | null {
  if (!value.trim()) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function hasActiveExifFilter(filter: ExifFilter): boolean {
  return filter.dateFromMs !== null || filter.dateToMs !== null || filter.isoMin !== null || filter.isoMax !== null
}

function applyExifFilter(files: PhotoFile[], exifByPath: Map<string, PhotoExif>, filter: ExifFilter): PhotoFile[] {
  if (!hasActiveExifFilter(filter)) return files

  return files.filter((file) => {
    const exif = exifByPath.get(file.path)
    if (!exif) return false

    if (filter.dateFromMs !== null && (exif.dateTaken === null || exif.dateTaken < filter.dateFromMs)) return false
    if (filter.dateToMs !== null && (exif.dateTaken === null || exif.dateTaken > filter.dateToMs)) return false
    if (filter.isoMin !== null && (exif.iso === null || exif.iso < filter.isoMin)) return false
    if (filter.isoMax !== null && (exif.iso === null || exif.iso > filter.isoMax)) return false
    return true
  })
}

function getExifRows(exif: PhotoExif, t: (typeof translations)[LanguageMode]): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []

  if (exif.dateTaken !== null) rows.push({ label: t.exifDateTaken, value: formatDateFull(exif.dateTaken) })
  if (exif.camera) rows.push({ label: t.exifCamera, value: exif.camera })
  if (exif.lens) rows.push({ label: t.exifLens, value: exif.lens })
  if (exif.iso !== null) rows.push({ label: 'ISO', value: String(exif.iso) })
  if (exif.aperture !== null) rows.push({ label: t.exifAperture, value: `f/${exif.aperture}` })
  if (exif.shutter) rows.push({ label: t.exifShutter, value: exif.shutter })
  if (exif.focalLength !== null) rows.push({ label: t.exifFocalLength, value: `${exif.focalLength} mm` })

  return rows
}

type ThumbnailCellProps = {
  file: PhotoFile
  isSelected: boolean
  cache: Map<string, string | null>
  loadThumbnail: (file: PhotoFile) => Promise<string | null>
  onSelect: (file: PhotoFile) => void
}

const ThumbnailCell = memo(function ThumbnailCell({
  file,
  isSelected,
  cache,
  loadThumbnail,
  onSelect
}: ThumbnailCellProps): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(cache.get(file.path) ?? null)
  const [loaded, setLoaded] = useState<boolean>(cache.has(file.path))

  useEffect(() => {
    if (cache.has(file.path)) return undefined

    let cancelled = false

    loadThumbnail(file)
      .then((url) => {
        if (cancelled) return
        setDataUrl(url)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setDataUrl(null)
        setLoaded(true)
      })

    return () => {
      cancelled = true
    }
  }, [cache, file, loadThumbnail])

  return (
    <button
      className={cx(
        'group relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl border bg-[var(--panel2)] transition',
        isSelected ? 'border-[var(--acc)] ring-2 ring-[var(--acc)]' : 'border-[var(--line)] hover:border-[var(--line2)]'
      )}
      onClick={() => onSelect(file)}
      title={file.name}
      type="button"
    >
      {dataUrl ? (
        <img alt={file.name} className="h-full w-full object-cover opacity-100 transition-opacity duration-300" src={dataUrl} />
      ) : (
        <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,var(--panel2)_0_13px,var(--panel)_13px_26px)]" />
      )}
      {!dataUrl ? (
        <span className="relative z-10 font-mono text-xs text-[var(--faint)]">{loaded ? 'No preview' : '...'}</span>
      ) : null}
      <span className="absolute right-2 top-2 rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
        {getFileExtension(file.name).slice(1).toUpperCase() || getTypeLabel(file.name)}
      </span>
      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-2 pt-6 font-mono text-[11px] text-[#f3ede4]">
        {file.name}
      </span>
    </button>
  )
})

type VirtualizedPhotoGridProps = {
  files: PhotoFile[]
  selectedPath: string | null
  cache: Map<string, string | null>
  loadThumbnail: (file: PhotoFile) => Promise<string | null>
  onSelect: (file: PhotoFile) => void
}

function VirtualizedPhotoGrid({
  files,
  selectedPath,
  cache,
  loadThumbnail,
  onSelect
}: VirtualizedPhotoGridProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const scrollFrameRef = useRef<number | null>(null)
  const pendingScrollTopRef = useRef(0)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined

    const updateViewport = (): void => {
      setViewport({
        width: Math.max(0, element.clientWidth - gridPadding * 2),
        height: element.clientHeight
      })
    }

    updateViewport()
    const observer = new ResizeObserver(updateViewport)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    return () => {
      if (scrollFrameRef.current !== null) window.cancelAnimationFrame(scrollFrameRef.current)
    }
  }, [])

  const columns = Math.max(1, Math.floor((viewport.width + gridGap) / (gridMinCellWidth + gridGap)))
  const cellWidth = Math.max(gridMinCellWidth, (viewport.width - gridGap * (columns - 1)) / columns)
  const cellHeight = Math.round(cellWidth * 0.6667)
  const rowStride = cellHeight + gridGap
  const rowCount = Math.ceil(files.length / columns)
  const totalHeight = Math.max(0, rowCount * rowStride - gridGap)
  const startRow = Math.max(0, Math.floor(scrollTop / rowStride) - gridOverscanRows)
  const endRow = Math.min(rowCount - 1, Math.ceil((scrollTop + viewport.height) / rowStride) + gridOverscanRows)
  const visibleCells = []

  for (let rowIndex = startRow; rowIndex <= endRow; rowIndex += 1) {
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
      const fileIndex = rowIndex * columns + columnIndex
      const file = files[fileIndex]
      if (!file) continue

      visibleCells.push({
        file,
        height: cellHeight,
        left: columnIndex * (cellWidth + gridGap),
        top: rowIndex * rowStride,
        width: cellWidth
      })
    }
  }

  return (
    <div
      className="min-h-0 flex-1 overflow-y-auto p-5"
      onScroll={(event) => {
        pendingScrollTopRef.current = event.currentTarget.scrollTop
        if (scrollFrameRef.current !== null) return

        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null
          setScrollTop(pendingScrollTopRef.current)
        })
      }}
      ref={containerRef}
    >
      <div className="relative" style={{ height: totalHeight }}>
        {visibleCells.map(({ file, height, left, top, width }) => (
          <div
            className="absolute"
            key={file.path}
            style={{
              height,
              left,
              top,
              width
            }}
          >
            <ThumbnailCell
              cache={cache}
              file={file}
              isSelected={selectedPath === file.path}
              key={file.path}
              loadThumbnail={loadThumbnail}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

function App(): JSX.Element {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredValue('fp_theme', 'light', ['light', 'dark']))
  const [language, setLanguage] = useState<LanguageMode>(() => readStoredValue('fp_language', 'vi', ['vi', 'en']))
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [folderPath, setFolderPath] = useState('')
  const [destinationFolder, setDestinationFolder] = useState('')
  const [files, setFiles] = useState<PhotoFile[]>([])
  const [isRemovableSource, setIsRemovableSource] = useState(false)
  const [searchInput, setSearchInput] = useState(() => readStoredText('fp_codes', ''))
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all')
  const [resultMode, setResultMode] = useState<ResultMode>('matched')
  const [fileActionMode, setFileActionMode] = useState<FileActionMode>('copy')
  const [listViewMode, setListViewMode] = useState<ListViewMode>(() =>
    readStoredValue('fp_view', 'files', ['files', 'groups', 'grid'])
  )
  const [selectedFile, setSelectedFile] = useState<PhotoFile | null>(null)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [copyProgress, setCopyProgress] = useState<CopyProgress | null>(null)
  const [folderMessage, setFolderMessage] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState<Toast | null>(null)
  const [isMoveConfirmOpen, setIsMoveConfirmOpen] = useState(false)
  const [isReadingOcr, setIsReadingOcr] = useState(false)
  const [ocrError, setOcrError] = useState('')
  const [ocrNotice, setOcrNotice] = useState('')
  const [isSearchDropActive, setIsSearchDropActive] = useState(false)
  const [isFolderDropActive, setIsFolderDropActive] = useState(false)
  const [exifByPath, setExifByPath] = useState<Map<string, PhotoExif>>(new Map())
  const [exifLoaded, setExifLoaded] = useState(false)
  const [isLoadingExif, setIsLoadingExif] = useState(false)
  const [exifProgress, setExifProgress] = useState<ExifProgress | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isoMin, setIsoMin] = useState('')
  const [isoMax, setIsoMax] = useState('')
  const [selectedExif, setSelectedExif] = useState<PhotoExif | null>(null)

  const previewRequestId = useRef(0)
  const thumbnailCache = useRef<Map<string, string | null>>(new Map())
  const thumbnailRequests = useRef<Map<string, Promise<string | null>>>(new Map())
  const searchDropDepth = useRef(0)
  const folderDropDepth = useRef(0)
  const t = translations[language]
  const numberLocale = language === 'vi' ? 'vi-VN' : 'en-US'

  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files])
  const typeFilteredFiles = useMemo(() => filterFilesByType(files, fileTypeFilter), [files, fileTypeFilter])
  const exifFilter: ExifFilter = useMemo(
    () => ({
      dateFromMs: parseDateInput(dateFrom, false),
      dateToMs: parseDateInput(dateTo, true),
      isoMin: parseNumberInput(isoMin),
      isoMax: parseNumberInput(isoMax)
    }),
    [dateFrom, dateTo, isoMax, isoMin]
  )
  const isExifFilterActive = exifLoaded && hasActiveExifFilter(exifFilter)
  const exifFilteredFiles = useMemo(
    () => (isExifFilterActive ? applyExifFilter(typeFilteredFiles, exifByPath, exifFilter) : typeFilteredFiles),
    [exifByPath, exifFilter, isExifFilterActive, typeFilteredFiles]
  )
  const parsedSearch = useMemo(() => parseSearchInput(searchInput), [searchInput])
  const shouldShowSearchHint = searchInput.trim().length === 0 || isReadingOcr || isSearchDropActive
  const hasParsedCodes = parsedSearch.codes.length > 0
  const effectiveResultMode: ResultMode = hasParsedCodes ? resultMode : 'matched'
  const matchedFiles = useMemo(
    () => (hasParsedCodes ? filterFilesByCodes(exifFilteredFiles, parsedSearch.codes) : exifFilteredFiles),
    [exifFilteredFiles, hasParsedCodes, parsedSearch.codes]
  )
  const matchedPathSet = useMemo(() => new Set(matchedFiles.map((file) => file.path)), [matchedFiles])
  const unmatchedFiles = useMemo(
    () => (hasParsedCodes ? exifFilteredFiles.filter((file) => !matchedPathSet.has(file.path)) : []),
    [exifFilteredFiles, hasParsedCodes, matchedPathSet]
  )
  const resultFiles = effectiveResultMode === 'matched' ? matchedFiles : unmatchedFiles
  const resultGroups = useMemo(() => groupFilesByBaseName(resultFiles), [resultFiles])
  const resultSize = useMemo(() => resultFiles.reduce((sum, file) => sum + file.size, 0), [resultFiles])
  const visibleFiles = resultFiles.slice(0, resultCap)
  const visibleGroups = resultGroups.slice(0, resultCap)
  const isCapped = listViewMode === 'groups' ? resultGroups.length > resultCap : listViewMode === 'files' && resultFiles.length > resultCap
  const headlineCount = listViewMode === 'groups' ? resultGroups.length : resultFiles.length
  const headlineWord = listViewMode === 'groups' ? t.groupsWord : t.photosWord
  const canTransfer =
    !isCopying && resultFiles.length > 0 && destinationFolder.length > 0 && !(fileActionMode === 'move' && isRemovableSource)

  const loadThumbnail = useCallback((file: PhotoFile): Promise<string | null> => {
    if (thumbnailCache.current.has(file.path)) {
      return Promise.resolve(thumbnailCache.current.get(file.path) ?? null)
    }

    const pendingRequest = thumbnailRequests.current.get(file.path)
    if (pendingRequest) return pendingRequest

    const request = thumbnailQueue
      .enqueue(() => window.api.getThumbnailDataUrl(file.path))
      .then((dataUrl) => {
        rememberThumbnail(thumbnailCache.current, file.path, dataUrl)
        return dataUrl
      })
      .catch(() => {
        rememberThumbnail(thumbnailCache.current, file.path, null)
        return null
      })
      .finally(() => {
        thumbnailRequests.current.delete(file.path)
      })

    thumbnailRequests.current.set(file.path, request)
    return request
  }, [])

  useEffect(() => {
    localStorage.setItem('fp_theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('fp_language', language)
  }, [language])

  useEffect(() => {
    localStorage.setItem('fp_codes', searchInput)
  }, [searchInput])

  useEffect(() => {
    localStorage.setItem('fp_view', listViewMode)
  }, [listViewMode])

  useEffect(() => {
    return window.api.onCopyProgress((progress) => {
      setCopyProgress(progress)
    })
  }, [])

  useEffect(() => {
    return window.api.onExifProgress((progress) => {
      setExifProgress(progress)
    })
  }, [])

  useEffect(() => {
    if (!toast) return undefined
    const timeout = window.setTimeout(() => setToast(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [toast])

  function resetFolderDerivedState(): void {
    setExifByPath(new Map())
    setExifLoaded(false)
    setExifProgress(null)
    setSelectedExif(null)
    setDateFrom('')
    setDateTo('')
    setIsoMin('')
    setIsoMax('')
    thumbnailCache.current.clear()
    thumbnailRequests.current.clear()
  }

  async function loadPhotoFolder(selectedFolder: string): Promise<void> {
    setFolderPath(selectedFolder)
    setFiles([])
    setSelectedFile(null)
    setPreviewDataUrl(null)
    setIsRemovableSource(false)
    setFolderMessage('')
    resetFolderDerivedState()

    try {
      const cachedResult = await window.api.loadCachedPhotoFolder(selectedFolder)

      if (cachedResult) {
        setFolderPath(cachedResult.folderPath)
        setFiles(cachedResult.files)
        setIsRemovableSource(cachedResult.isRemovableDrive)
        setFolderMessage(t.loadedCache)
        if (cachedResult.isRemovableDrive) setFileActionMode('copy')
        return
      }
    } catch {
      // Cache is optional; fall back to a normal scan if it cannot be loaded.
    }

    await handleScanFolder(selectedFolder)
  }

  async function handleChooseFolder(): Promise<void> {
    setError('')
    const selectedFolder = await window.api.selectPhotoFolder()

    if (!selectedFolder) return

    await loadPhotoFolder(selectedFolder)
  }

  async function handleScanFolder(path = folderPath): Promise<void> {
    if (!path) {
      setError(t.chooseFolderFirst)
      return
    }

    setIsScanning(true)
    setError('')
    setFolderMessage('')
    resetFolderDerivedState()

    try {
      const result = await window.api.scanPhotoFolder(path)
      setFolderPath(result.folderPath)
      setFiles(result.files)
      setIsRemovableSource(result.isRemovableDrive)
      if (result.isRemovableDrive) setFileActionMode('copy')
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : t.scanFolderError)
    } finally {
      setIsScanning(false)
    }
  }

  async function handleChooseDestinationFolder(): Promise<void> {
    setError('')
    const selectedFolder = await window.api.selectDestinationFolder()

    if (!selectedFolder) return
    setDestinationFolder(selectedFolder)
  }

  async function runTransfer(): Promise<void> {
    if (!destinationFolder) {
      setError(t.chooseDestinationFirst)
      return
    }

    if (resultFiles.length === 0) {
      setError(t.noFilesToTransfer.replace('{mode}', effectiveResultMode === 'matched' ? t.matched : t.unmatched))
      return
    }

    if (isRemovableSource && fileActionMode === 'move') {
      setError(t.moveLockedError)
      return
    }

    setIsMoveConfirmOpen(false)
    setIsCopying(true)
    setError('')
    setCopyProgress({ completed: 0, total: resultFiles.length, currentFileName: '' })

    try {
      const result = await window.api.copyFiles({ destinationFolder, files: resultFiles, action: fileActionMode })
      setToast({
        kind: fileActionMode === 'move' ? 'move' : 'copy',
        count: fileActionMode === 'move' ? result.moved : result.copied,
        destinationFolder: result.destinationFolder
      })
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : t.transferError)
    } finally {
      setIsCopying(false)
    }
  }

  function handleTransferClick(): void {
    if (fileActionMode === 'move') {
      setIsMoveConfirmOpen(true)
      return
    }

    void runTransfer()
  }

  async function readCodesFromImageFile(file: File): Promise<void> {
    setError('')
    setOcrError('')
    setOcrNotice('')

    if (!isSupportedOcrImage(file)) {
      setOcrError(t.unsupportedOcrImage)
      return
    }

    setIsReadingOcr(true)

    try {
      const imagePath = window.api.getDroppedFilePath(file)
      const result = imagePath
        ? await window.api.readCodesFromImage(imagePath)
        : await window.api.readCodesFromImageData({
            fileName: file.name || 'clipboard.png',
            mimeType: file.type || 'image/png',
            data: await file.arrayBuffer()
          })

      if (result.codes.length === 0) {
        setOcrError(t.noOcrCodes)
        return
      }

      setSearchInput(result.codes.join(', '))
      setOcrNotice(t.ocrNotice.replace('{count}', String(result.codes.length)))
    } catch (readError) {
      setOcrError(readError instanceof Error ? readError.message : t.ocrReadError)
    } finally {
      setIsReadingOcr(false)
    }
  }

  function resetSearchDropState(): void {
    searchDropDepth.current = 0
    setIsSearchDropActive(false)
  }

  function handleSearchDragEnter(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    searchDropDepth.current += 1
    setIsSearchDropActive(true)
  }

  function handleSearchDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsSearchDropActive(true)
  }

  function handleSearchDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    searchDropDepth.current = Math.max(0, searchDropDepth.current - 1)
    if (searchDropDepth.current === 0) setIsSearchDropActive(false)
  }

  function handleSearchDrop(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    resetSearchDropState()

    if (isReadingOcr) return

    const file = Array.from(event.dataTransfer.files).find(isSupportedOcrImage) ?? event.dataTransfer.files[0]
    if (!file) {
      setOcrError(t.dropImageHere)
      return
    }

    void readCodesFromImageFile(file)
  }

  function handleSearchPaste(event: ClipboardEvent<HTMLTextAreaElement>): void {
    const file = getImageFileFromTransfer(event.clipboardData)
    if (!file) return

    event.preventDefault()

    if (isReadingOcr) return
    void readCodesFromImageFile(file)
  }

  function resetFolderDropState(): void {
    folderDropDepth.current = 0
    setIsFolderDropActive(false)
  }

  function handleFolderDragEnter(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    folderDropDepth.current += 1
    setIsFolderDropActive(true)
  }

  function handleFolderDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
    setIsFolderDropActive(true)
  }

  function handleFolderDragLeave(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    folderDropDepth.current = Math.max(0, folderDropDepth.current - 1)
    if (folderDropDepth.current === 0) setIsFolderDropActive(false)
  }

  function handleFolderDrop(event: DragEvent<HTMLDivElement>): void {
    if (!hasDraggedFiles(event.dataTransfer)) return

    event.preventDefault()
    resetFolderDropState()

    if (isScanning) return

    const isDirectoryDrop = hasDraggedDirectory(event.dataTransfer)
    let droppedPath = Array.from(event.dataTransfer.files)
      .map((file) => window.api.getDroppedFilePath(file))
      .find(Boolean)

    if (!droppedPath) {
      setError(t.dropPhotoFolder)
      return
    }

    if (isDirectoryDrop && isLikelyPhotoFilePath(droppedPath)) {
      droppedPath = getParentFolderPath(droppedPath)
    } else if (isLikelyPhotoFilePath(droppedPath)) {
      setError(t.dropFolderNotFile)
      return
    }

    void loadPhotoFolder(droppedPath)
  }

  async function handleOpenDestinationFolder(): Promise<void> {
    if (!destinationFolder) return
    await window.api.openFolder(destinationFolder)
  }

  async function handleLoadExif(): Promise<void> {
    if (files.length === 0) {
      setError(t.scanBeforeExif)
      return
    }

    setIsLoadingExif(true)
    setError('')
    setExifProgress({ completed: 0, total: files.length, currentFileName: '' })

    try {
      const entries = await window.api.indexFolderExif(files)
      setExifByPath(new Map(entries.map((entry) => [entry.path, entry.exif])))
      setExifLoaded(true)
    } catch (exifError) {
      setError(exifError instanceof Error ? exifError.message : t.exifReadError)
    } finally {
      setIsLoadingExif(false)
      setExifProgress(null)
    }
  }

  async function handleSelectFile(file: PhotoFile): Promise<void> {
    const requestId = previewRequestId.current + 1
    previewRequestId.current = requestId
    setSelectedFile(file)
    setPreviewDataUrl(null)
    setPreviewError('')

    const cachedExif = exifByPath.get(file.path)
    if (cachedExif) {
      setSelectedExif(cachedExif)
    } else {
      setSelectedExif(null)
      void window.api
        .getExif(file.path)
        .then((exif) => {
          if (previewRequestId.current === requestId) setSelectedExif(exif)
        })
        .catch(() => undefined)
    }

    if (!canPreviewFile(file.name)) {
      setIsPreviewLoading(false)
      return
    }

    setIsPreviewLoading(true)

    try {
      const dataUrl = await window.api.getPreviewDataUrl(file.path)
      if (!dataUrl) {
        setPreviewError(t.rawNoEmbeddedPreview)
        return
      }

      if (previewRequestId.current === requestId) setPreviewDataUrl(dataUrl)
    } catch (previewErrorValue) {
      if (previewRequestId.current === requestId) {
        setPreviewError(previewErrorValue instanceof Error ? previewErrorValue.message : t.previewLoadError)
      }
    } finally {
      if (previewRequestId.current === requestId) setIsPreviewLoading(false)
    }
  }

  return (
    <div className="app-shell h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)]" data-theme={theme}>
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[336px] shrink-0 flex-col border-r border-[var(--line)] bg-[var(--rail-bg)] max-[1180px]:w-[300px]">
          <div className="flex items-center justify-between px-4 pb-3 pt-4">
            <div className="flex items-center gap-3">
              <img alt="FPhoto" className="h-8 w-8 rounded-[9px] border border-black/10 object-cover shadow-sm dark:border-white/10" src={logoMark} />
              <div className="text-base font-extrabold tracking-normal">FPhoto</div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--panel2)] text-[var(--mut)] transition hover:border-[var(--acc)] hover:text-[var(--acc)]"
                onClick={() => setIsSettingsOpen(true)}
                title={t.settings}
                type="button"
              >
                <Icon name="settings" />
              </button>
              <button
                className="inline-flex h-[34px] w-[34px] items-center justify-center rounded-[10px] border border-[var(--line)] bg-[var(--panel2)] text-[var(--mut)] transition hover:border-[var(--acc)] hover:text-[var(--acc)]"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={t.themeToggle}
                type="button"
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-4 pb-5">
            <section className="flex flex-col gap-2.5">
              <div className="ui-label">{t.selectedFolder}</div>
              <div
                className={cx(
                  'flex items-center gap-2.5 rounded-[var(--rad)] border border-[var(--line)] bg-[var(--panel2)] px-3 py-2.5 transition',
                  isFolderDropActive && 'border-[var(--acc)] bg-[var(--acc-soft)]'
                )}
                onDragEnter={handleFolderDragEnter}
                onDragLeave={handleFolderDragLeave}
                onDragOver={handleFolderDragOver}
                onDrop={handleFolderDrop}
              >
                <span className="text-[var(--acc)]">
                  <Icon name="folder" size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx('block truncate text-xs', folderPath && 'font-mono', !folderPath && 'font-semibold text-[var(--mut)]')}>
                    {isFolderDropActive ? t.dropFolderToScan : folderPath || t.dragFolderHere}
                  </span>
                  {!folderPath ? <span className="block truncate text-[11px] text-[var(--faint)]">{t.orChooseFolder}</span> : null}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn-primary" disabled={isScanning} onClick={handleChooseFolder} type="button">
                  <Icon name="folder" size={15} />
                  {t.chooseFolder}
                </button>
                <button className="btn-ghost" disabled={isScanning || !folderPath} onClick={() => void handleScanFolder()} type="button">
                  <Icon name="refresh" size={15} />
                  {isScanning ? t.scanning : t.rescan}
                </button>
              </div>
            </section>

            {isRemovableSource ? (
              <div className="rounded-xl border border-[var(--danger)]/30 bg-[var(--acc-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                {t.removableSourceRail}
              </div>
            ) : null}
            {folderMessage ? (
              <div className="rounded-xl border border-[var(--acc)]/30 bg-[var(--acc-soft)] px-3 py-2 text-xs text-[var(--mut)]">
                {folderMessage}
              </div>
            ) : null}
            {error ? (
              <div className="rounded-xl border border-[var(--danger)]/40 bg-[var(--acc-soft)] px-3 py-2 text-xs text-[var(--danger)]">
                {error}
              </div>
            ) : null}

            <section className="flex flex-col gap-3 rounded-[var(--rad)] border-[1.5px] border-[var(--acc)] bg-[var(--panel)] p-3.5 shadow-[var(--shadow-sm),0_14px_32px_-20px_var(--acc-d)]">
              <div className="flex items-center gap-1.5 text-[12.5px] font-bold uppercase tracking-[0.05em] text-[var(--acc)]">
                <Icon name="search" />
                {t.searchCodesLabel}
              </div>
              <div
                className={cx(
                  'relative rounded-[var(--rad)] border border-[var(--acc-soft)] bg-[var(--bg)] transition',
                  isSearchDropActive && 'border-[var(--acc)] bg-[var(--acc-soft)]'
                )}
                onDragEnter={handleSearchDragEnter}
                onDragLeave={handleSearchDragLeave}
                onDragOver={handleSearchDragOver}
                onDrop={handleSearchDrop}
              >
                <textarea
                  className={cx(
                    'min-h-[86px] w-full resize-y rounded-[var(--rad)] bg-transparent px-3 py-2.5 font-mono text-sm leading-relaxed text-[var(--text)] outline-none',
                    shouldShowSearchHint ? 'pb-8' : 'pb-2.5'
                  )}
                  onChange={(event) => {
                    setSearchInput(event.target.value)
                    setOcrError('')
                    setOcrNotice('')
                  }}
                  onPaste={handleSearchPaste}
                  placeholder={t.searchPlaceholder}
                  spellCheck={false}
                  value={searchInput}
                />
                {shouldShowSearchHint ? (
                  <div className="pointer-events-none absolute bottom-2.5 left-3 right-3 flex items-center justify-between gap-2 text-[11.5px] font-medium text-[var(--faint)]">
                    <span>{isReadingOcr ? t.readingImage : t.pasteImageHint}</span>
                    {isSearchDropActive ? <span className="text-[var(--acc)]">{t.dropToReadCodes}</span> : null}
                  </div>
                ) : null}
              </div>
              {ocrError ? <p className="text-xs font-medium text-[var(--danger)]">{ocrError}</p> : null}
              {ocrNotice ? <p className="text-xs font-medium text-[var(--acc)]">{ocrNotice}</p> : null}
              <div className="grid grid-cols-3 gap-2">
                <div className="counter-box">
                  <b>{parsedSearch.codes.length}</b>
                  <span>{t.recognized}</span>
                </div>
                <div className="counter-box text-[var(--acc)]">
                  <b>{matchedFiles.length}</b>
                  <span>{t.matched}</span>
                </div>
                <div className="counter-box text-[var(--faint)]">
                  <b>{unmatchedFiles.length}</b>
                  <span>{t.unmatched}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className={cx('toggle-pill', effectiveResultMode === 'matched' && 'active')} onClick={() => setResultMode('matched')} type="button">
                  {t.useMatched}
                </button>
                <button
                  className={cx('toggle-pill', effectiveResultMode === 'unmatched' && 'active')}
                  disabled={!hasParsedCodes}
                  onClick={() => setResultMode('unmatched')}
                  type="button"
                >
                  {t.useUnmatched}
                </button>
              </div>
              {parsedSearch.warnings.map((warning) => (
                <p className="text-xs text-[var(--warn)]" key={warning}>
                  {warning}
                </p>
              ))}
            </section>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="stat-box">
                <span>{isScanning ? '...' : files.length.toLocaleString(numberLocale)}</span>
                <small>{t.scannedFiles}</small>
              </div>
              <div className="stat-box">
                <span>{formatBytes(totalSize)}</span>
                <small>{t.totalSize}</small>
              </div>
            </div>

            <section className="flex flex-col gap-2.5">
              <div className="ui-label">{t.fileType}</div>
              <div className="segmented segmented-equal grid-cols-4">
                {[
                  ['all', t.all],
                  ['jpeg', 'JPEG'],
                  ['raw', 'RAW'],
                  ['other', t.other]
                ].map(([value, label]) => (
                  <button
                    className={cx('segmented-btn', fileTypeFilter === value && 'active')}
                    key={value}
                    onClick={() => setFileTypeFilter(value as FileTypeFilter)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <section className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="ui-label">
                  <Icon name="exif" size={14} />
                  {t.exifFilter}
                </div>
                <button className="btn-ghost-xs" disabled={isLoadingExif || files.length === 0} onClick={() => void handleLoadExif()} type="button">
                  <Icon name="exif" size={13} />
                  {isLoadingExif ? t.reading : exifLoaded ? t.readAgain : t.readExif}
                </button>
              </div>

              {exifProgress ? (
                <div className="flex flex-col gap-1.5">
                  <div className="progress-track">
                    <i style={{ width: `${exifProgress.total === 0 ? 0 : (exifProgress.completed / exifProgress.total) * 100}%` }} />
                  </div>
                  <div className="flex justify-between gap-2 text-[11px] text-[var(--mut)]">
                    <span>
                      {exifProgress.completed}/{exifProgress.total} file
                    </span>
                    <span className="truncate font-mono">{exifProgress.currentFileName}</span>
                  </div>
                </div>
              ) : null}

              {exifLoaded ? (
                <>
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <label className="exif-field">
                      {t.fromDate}
                      <input onChange={(event) => setDateFrom(event.target.value)} type="date" value={dateFrom} />
                    </label>
                    <label className="exif-field">
                      {t.toDate}
                      <input onChange={(event) => setDateTo(event.target.value)} type="date" value={dateTo} />
                    </label>
                    <label className="exif-field">
                      {t.isoMin}
                      <input min="0" onChange={(event) => setIsoMin(event.target.value)} placeholder="100" type="number" value={isoMin} />
                    </label>
                    <label className="exif-field">
                      {t.isoMax}
                      <input min="0" onChange={(event) => setIsoMax(event.target.value)} placeholder="3200" type="number" value={isoMax} />
                    </label>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-[var(--mut)]">
                      {t.exifLoadedStatus
                        .replace('{count}', String(exifByPath.size))
                        .replace(
                          '{filter}',
                          isExifFilterActive ? t.exifFilterOn.replace('{count}', String(exifFilteredFiles.length)) : ''
                        )}
                    </span>
                    {isExifFilterActive ? (
                      <button
                        className="btn-ghost-xs"
                        onClick={() => {
                          setDateFrom('')
                          setDateTo('')
                          setIsoMin('')
                          setIsoMax('')
                        }}
                        type="button"
                      >
                        {t.clearFilter}
                      </button>
                    ) : null}
                  </div>
                </>
              ) : (
                <p className="text-[11.5px] text-[var(--mut)]">
                  {t.exifNotLoaded}
                </p>
              )}
            </section>
          </div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-end justify-between gap-4 border-b border-[var(--line)] px-6 py-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--acc)]">{t.workspaceLabel}</p>
              <h1 className="headline-title mt-1 whitespace-nowrap text-[27px] tracking-normal">
                {hasParsedCodes ? t.filteredResults : t.allResults}{' '}
                <b className="bg-gradient-to-r from-[var(--acc)] to-[#D98A5E] bg-clip-text font-semibold text-transparent">
                  {headlineCount}
                </b>{' '}
                {headlineWord}
              </h1>
            </div>
            <div className="segmented shrink-0">
              {[
                ['files', 'list', t.list],
                ['groups', 'groups', `${t.groups} (${resultGroups.length})`],
                ['grid', 'grid', t.grid]
              ].map(([value, icon, label]) => (
                <button
                  className={cx('segmented-btn', listViewMode === value && 'active')}
                  key={value}
                  onClick={() => setListViewMode(value as ListViewMode)}
                  type="button"
                >
                  <Icon name={icon as IconName} size={15} />
                  {label}
                </button>
              ))}
            </div>
          </header>

          <div className="flex min-h-0 flex-1">
            <section className="flex min-w-0 flex-1 flex-col">
              {isCapped ? (
                <div className="border-b border-[var(--line)] bg-[var(--panel2)] px-6 py-2 text-[11.5px] text-[var(--warn)]">
                  {t.cappedNotice
                    .replace('{cap}', String(resultCap))
                    .replace('{total}', String(files.length))
                    .replace('{count}', String(listViewMode === 'groups' ? resultGroups.length : resultFiles.length))}
                </div>
              ) : null}

              {resultFiles.length === 0 ? (
                <div
                  className={cx(
                    'grid flex-1 place-items-center p-10 text-center text-[var(--mut)] transition',
                    files.length === 0 && isFolderDropActive && 'bg-[var(--acc-soft)]'
                  )}
                  onDragEnter={handleFolderDragEnter}
                  onDragLeave={handleFolderDragLeave}
                  onDragOver={handleFolderDragOver}
                  onDrop={handleFolderDrop}
                >
                  <div>
                    {!isScanning && files.length === 0 ? (
                      <div
                        className={cx(
                          'mx-auto mb-4 grid h-12 w-12 place-items-center rounded-xl border border-[var(--line)] bg-[var(--panel2)] text-[var(--acc)] transition',
                          isFolderDropActive && 'border-[var(--acc)] bg-[var(--panel)]'
                        )}
                      >
                        <Icon name="image" size={24} />
                      </div>
                    ) : null}
                    {!isScanning && files.length > 0 ? <img alt="" className="mx-auto mb-4 h-11 w-11 rounded-xl object-cover" src={logoMark} /> : null}
                    <p className="mb-1 text-[15px] font-semibold text-[var(--text)]">
                      {isScanning
                        ? t.scanningFolder
                        : files.length === 0
                          ? isFolderDropActive
                            ? t.dropFolderToStart
                            : t.chooseFolderToStart
                          : t.noMatchingFiles}
                    </p>
                    <p>{isScanning ? t.countingFiles : files.length === 0 ? t.emptyFolderHelp : t.noMatchHelp}</p>
                  </div>
                </div>
              ) : listViewMode === 'grid' ? (
                <VirtualizedPhotoGrid
                  cache={thumbnailCache.current}
                  files={resultFiles}
                  loadThumbnail={loadThumbnail}
                  onSelect={(selected) => void handleSelectFile(selected)}
                  selectedPath={selectedFile?.path ?? null}
                />
              ) : listViewMode === 'groups' ? (
                <>
                  <div className="result-head grid-cols-[16px_minmax(0,1fr)_110px_120px_104px]">
                    <span />
                    <span>{t.photoGroups}</span>
                    <span>{t.fileCount}</span>
                    <span>{t.type}</span>
                    <span>{t.modifiedAt}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {visibleGroups.map((group) => {
                      const previewFile = getBestPreviewFile(group.files)
                      const isSelected = selectedFile ? group.files.some((file) => file.path === selectedFile.path) : false

                      return (
                        <button
                          className={cx('result-row grid-cols-[16px_minmax(0,1fr)_110px_120px_104px]', isSelected && 'selected')}
                          key={group.baseName}
                          onClick={() => void handleSelectFile(previewFile)}
                          type="button"
                        >
                          <span className="type-dot multi" />
                          <span className="min-w-0 text-left">
                            <span className="block truncate text-[13px] font-semibold">{group.baseName}</span>
                            <span className="block truncate font-mono text-[11px] text-[var(--faint)]">{group.types.join(' · ')}</span>
                          </span>
                          <span className="font-mono text-xs text-[var(--mut)]">{group.files.length} file</span>
                          <span className="text-[11px] font-semibold text-[var(--mut)]">{formatBytes(group.totalSize)}</span>
                          <span className="font-mono text-[11.5px] text-[var(--faint)]">{formatDate(group.modifiedAt)}</span>
                        </button>
                      )
                    })}
                  </div>
                </>
              ) : (
                <>
                  <div className="result-head grid-cols-[16px_minmax(0,1fr)_96px_64px_104px]">
                    <span />
                    <span>{effectiveResultMode === 'matched' ? t.matchedFile : t.unmatchedFile}</span>
                    <span>{t.size}</span>
                    <span>{t.type}</span>
                    <span>{t.modifiedAt}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {visibleFiles.map((file) => (
                      <button
                        className={cx('result-row grid-cols-[16px_minmax(0,1fr)_96px_64px_104px]', selectedFile?.path === file.path && 'selected')}
                        key={file.path}
                        onClick={() => void handleSelectFile(file)}
                        type="button"
                      >
                        <span className={cx('type-dot', getFileType(file.name))} />
                        <span className="min-w-0 text-left">
                          <span className="block truncate text-[13px] font-semibold">{file.name}</span>
                          <span className="block truncate font-mono text-[11px] text-[var(--faint)]">{file.path}</span>
                        </span>
                        <span className="font-mono text-xs text-[var(--mut)]">{formatBytes(file.size)}</span>
                        <span className="text-[11px] font-semibold text-[var(--mut)]">{getTypeLabel(file.name)}</span>
                        <span className="font-mono text-[11.5px] text-[var(--faint)]">{formatDate(file.modifiedAt)}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>

            <aside className="hide-narrow flex w-[396px] shrink-0 flex-col gap-3 overflow-y-auto border-l border-[var(--line)] bg-[var(--panel)] p-[18px] max-[1180px]:w-[340px] max-[980px]:hidden">
              <p className="ui-label">{t.preview}</p>
              {selectedFile ? (
                <>
                  <div className="grid min-h-[250px] place-items-center overflow-hidden rounded-[var(--rad)] border border-[var(--line)] bg-[var(--panel2)]">
                    {isPreviewLoading ? (
                      <p className="px-5 text-center font-mono text-xs text-[var(--faint)]">{t.loadingPreview}</p>
                    ) : previewDataUrl ? (
                      <img alt={selectedFile.name} className="max-h-[420px] w-full object-contain" src={previewDataUrl} />
                    ) : (
                      <p className="px-5 text-center font-mono text-xs text-[var(--faint)]">
                        {t.previewUnavailable}
                        <br />
                        <span>{previewError || t.rawPreviewHelp}</span>
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="break-all text-[15px] font-bold">{selectedFile.name}</p>
                    <p className="text-xs text-[var(--mut)]">
                      {getTypeLabel(selectedFile.name)} · {formatBytes(selectedFile.size)}
                    </p>
                    <p className="break-all font-mono text-[10.5px] text-[var(--faint)]">{selectedFile.path}</p>
                  </div>
                  {selectedExif && getExifRows(selectedExif, t).length > 0 ? (
                    <div className="mt-1">
                      {getExifRows(selectedExif, t).map((row) => (
                        <p className="flex justify-between gap-3 border-b border-[var(--line)] py-1.5 text-xs" key={row.label}>
                          <span className="text-[var(--mut)]">{row.label}</span>
                          <b className="truncate text-right font-semibold">{row.value}</b>
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-[var(--mut)]">{t.noExifForFile}</p>
                  )}
                </>
              ) : (
                <div className="grid flex-1 place-items-center rounded-[var(--rad)] border border-dashed border-[var(--line2)] p-8 text-center text-sm text-[var(--faint)]">
                  {t.selectFileForPreview}
                </div>
              )}
            </aside>
          </div>

          <section className="m-3.5 flex flex-col gap-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] px-4 py-3 shadow-[var(--action-shadow)]">
            {copyProgress && isCopying ? (
              <div className="flex flex-col gap-1.5">
                <div className="progress-track">
                  <i style={{ width: `${copyProgress.total === 0 ? 0 : (copyProgress.completed / copyProgress.total) * 100}%` }} />
                </div>
                <div className="flex justify-between gap-2 text-[11px] text-[var(--mut)]">
                  <span>
                    {fileActionMode === 'move' ? t.moving : t.copying} {copyProgress.completed}/{copyProgress.total}
                  </span>
                  <span className="truncate font-mono">{copyProgress.currentFileName}</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-lg font-extrabold text-[var(--acc)]">{resultFiles.length} file</span>
                <span className="text-[var(--faint)]">·</span>
                <span className="text-sm font-semibold text-[var(--mut)]">{formatBytes(resultSize)}</span>
                {destinationFolder ? (
                  <span className="truncate font-mono text-[11.5px] text-[var(--faint)]">→ {destinationFolder}</span>
                ) : (
                  <span className="font-mono text-[11.5px] text-[var(--warn)]">{t.noDestination}</span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="segmented segmented-safe">
                  <button className={cx('segmented-btn', fileActionMode === 'copy' && 'active')} disabled={isCopying} onClick={() => setFileActionMode('copy')} type="button">
                    Copy
                  </button>
                  <button
                    className={cx('segmented-btn text-[var(--danger)]', fileActionMode === 'move' && 'active')}
                    disabled={isCopying || isRemovableSource}
                    onClick={() => setFileActionMode('move')}
                    type="button"
                  >
                    {isRemovableSource ? <Icon name="lock" size={13} /> : null}
                    Move
                  </button>
                </div>
                <button className="btn-ghost" disabled={isCopying} onClick={handleChooseDestinationFolder} type="button">
                  <Icon name="folder" size={15} />
                  {t.chooseDestination}
                </button>
                <button className="btn-ghost" disabled={!destinationFolder} onClick={() => void handleOpenDestinationFolder()} type="button">
                  <Icon name="open" size={15} />
                  {t.open}
                </button>
                <button className="btn-safe" disabled={!canTransfer} onClick={handleTransferClick} type="button">
                  <Icon name={fileActionMode === 'move' ? 'move' : 'copy'} size={17} />
                  {isCopying ? (fileActionMode === 'move' ? t.movingDots : t.copyingDots) : `${fileActionMode === 'move' ? 'Move' : 'Copy'} ${resultFiles.length} file`}
                </button>
              </div>
            </div>
            {isRemovableSource ? (
              <p className="flex items-center gap-1.5 text-[11px] text-[var(--danger)]">
                <Icon name="lock" size={13} />
                {t.removableSourceTransfer}
              </p>
            ) : null}
          </section>
        </main>
      </div>

      <footer className="flex items-center justify-between border-t border-[var(--line)] bg-[var(--panel)] px-5 py-2">
        <div className="flex items-center gap-2.5">
          <img alt="" className="h-[21px] w-[21px] rounded-md object-cover" src={logoMark} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--faint)]">{t.byTung}</span>
        </div>
        <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--faint)]">FPhoto · v1.0</span>
      </footer>

      {toast ? (
        <div className="pointer-events-none fixed bottom-16 left-1/2 z-50 -translate-x-1/2">
          <div className="pointer-events-auto flex min-w-[360px] items-center gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--panel)] p-3.5 shadow-[0_20px_50px_-20px_rgba(40,35,25,.5)]">
            <div className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-[11px] bg-[var(--acc-soft)] text-[var(--acc)]">
              <Icon name={toast.kind === 'open' ? 'open' : 'check'} size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold">
                {toast.kind === 'open'
                  ? t.openingDestination
                  : toast.kind === 'move'
                    ? `${t.movedFiles} ${toast.count} file`
                    : `${t.copiedFiles} ${toast.count} file`}
              </p>
              <p className="truncate font-mono text-[11.5px] text-[var(--mut)]">{toast.destinationFolder}</p>
            </div>
            {toast.kind !== 'open' ? (
              <button
                className="btn-ghost"
                onClick={() => {
                  void window.api.openFolder(toast.destinationFolder)
                  setToast({ kind: 'open', destinationFolder: toast.destinationFolder })
                }}
                type="button"
              >
                <Icon name="open" size={15} />
                {t.openFolder}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isSettingsOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={() => setIsSettingsOpen(false)}>
          <div
            className="w-[420px] max-w-[92vw] rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_30px_70px_-20px_rgba(0,0,0,.55)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4">
              <div>
                <h2 className="text-[18px] font-bold">{t.settings}</h2>
                <p className="mt-1 text-sm leading-relaxed text-[var(--mut)]">{t.languageDescription}</p>
              </div>
            </div>

            <section className="flex flex-col gap-2.5">
              <div className="ui-label">{t.language}</div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  ['vi', t.vietnamese],
                  ['en', t.english]
                ].map(([value, label]) => (
                  <button
                    className={cx('language-option', language === value && 'active')}
                    key={value}
                    onClick={() => setLanguage(value as LanguageMode)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            <div className="mt-5 flex justify-end">
              <button className="btn-primary" onClick={() => setIsSettingsOpen(false)} type="button">
                {t.close}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMoveConfirmOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 backdrop-blur-sm" onClick={() => setIsMoveConfirmOpen(false)}>
          <div className="w-[420px] max-w-[90vw] rounded-[18px] border border-[var(--line)] bg-[var(--panel)] p-5 shadow-[0_30px_70px_-20px_rgba(0,0,0,.55)]" onClick={(event) => event.stopPropagation()}>
            <h2 className="mb-2 text-[17px] font-bold">
              {t.moveQuestion} {resultFiles.length} file?
            </h2>
            <p className="mb-5 text-sm leading-relaxed text-[var(--mut)]">
              {t.moveWarning}
            </p>
            <div className="flex justify-end gap-2.5">
              <button className="btn-ghost" onClick={() => setIsMoveConfirmOpen(false)} type="button">
                {t.cancel}
              </button>
              <button className="btn-danger" onClick={() => void runTransfer()} type="button">
                <Icon name="move" />
                {t.moveAction} {resultFiles.length} file
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
