import { useEffect, useRef, useState } from 'react'
import { filterFilesByCodes, parseSearchInput } from '../../shared/search'
import type { CopyProgress, ExifProgress, FileActionMode, PhotoExif, PhotoFile } from '../../shared/types'

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

const jpegExtensions = new Set(['.jpg', '.jpeg'])
const rawExtensions = new Set(['.cr2', '.cr3', '.nef', '.arw', '.raf', '.orf', '.rw2', '.dng'])
const previewableExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'])

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / 1024 ** index

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`
}

function formatDate(timestamp: number): string {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp)
}

function getFileExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.')
  return dotIndex === -1 ? '' : fileName.slice(dotIndex).toLowerCase()
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
      types: [...new Set(groupFiles.map((file) => getFileType(file.name).toUpperCase()))].sort()
    }))
    .sort((left, right) => left.baseName.localeCompare(right.baseName, undefined, { numeric: true }))
}

function getBestPreviewFile(files: PhotoFile[]): PhotoFile {
  return files.find((file) => canPreviewFile(file.name)) ?? files[0]
}

type ExifFilter = {
  dateFromMs: number | null
  dateToMs: number | null
  isoMin: number | null
  isoMax: number | null
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

function getExifRows(exif: PhotoExif): Array<{ label: string; value: string }> {
  const rows: Array<{ label: string; value: string }> = []

  if (exif.dateTaken !== null) rows.push({ label: 'Taken', value: formatDate(exif.dateTaken) })
  if (exif.camera) rows.push({ label: 'Camera', value: exif.camera })
  if (exif.lens) rows.push({ label: 'Lens', value: exif.lens })
  if (exif.iso !== null) rows.push({ label: 'ISO', value: String(exif.iso) })
  if (exif.aperture !== null) rows.push({ label: 'Aperture', value: `f/${exif.aperture}` })
  if (exif.shutter) rows.push({ label: 'Shutter', value: exif.shutter })
  if (exif.focalLength !== null) rows.push({ label: 'Focal', value: `${exif.focalLength}mm` })

  return rows
}

type ThumbnailCellProps = {
  file: PhotoFile
  isSelected: boolean
  cache: Map<string, string | null>
  onSelect: (file: PhotoFile) => void
}

function ThumbnailCell({ file, isSelected, cache, onSelect }: ThumbnailCellProps): JSX.Element {
  const [dataUrl, setDataUrl] = useState<string | null>(cache.get(file.path) ?? null)
  const [loaded, setLoaded] = useState<boolean>(cache.has(file.path))
  const buttonRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    // Already resolved (value came from the shared cache via the initializer).
    if (cache.has(file.path)) return

    const element = buttonRef.current
    if (!element) return
    let cancelled = false

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()

        window.api
          .getThumbnailDataUrl(file.path)
          .then((url) => {
            cache.set(file.path, url)
            if (cancelled) return
            setDataUrl(url)
            setLoaded(true)
          })
          .catch(() => {
            cache.set(file.path, null)
            if (cancelled) return
            setLoaded(true)
          })
      },
      { rootMargin: '200px' }
    )

    observer.observe(element)
    return () => {
      cancelled = true
      observer.disconnect()
    }
  }, [file.path, cache])

  return (
    <button
      className={`group relative flex aspect-square items-center justify-center overflow-hidden rounded-xl border bg-slate-950 transition ${
        isSelected ? 'border-cyan-400' : 'border-slate-800 hover:border-slate-600'
      }`}
      onClick={() => onSelect(file)}
      ref={buttonRef}
      title={file.name}
      type="button"
    >
      {dataUrl ? (
        <img alt={file.name} className="h-full w-full object-cover" loading="lazy" src={dataUrl} />
      ) : (
        <span className="px-2 text-center text-[10px] text-slate-600">{loaded ? 'No preview' : '…'}</span>
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-[10px] text-slate-200">
        {file.name}
      </span>
    </button>
  )
}

function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState('')
  const [destinationFolder, setDestinationFolder] = useState('')
  const [files, setFiles] = useState<PhotoFile[]>([])
  const [isRemovableSource, setIsRemovableSource] = useState(false)
  const [searchInput, setSearchInput] = useState('')
  const [fileTypeFilter, setFileTypeFilter] = useState<FileTypeFilter>('all')
  const [resultMode, setResultMode] = useState<ResultMode>('matched')
  const [fileActionMode, setFileActionMode] = useState<FileActionMode>('copy')
  const [listViewMode, setListViewMode] = useState<ListViewMode>('files')
  const [selectedFile, setSelectedFile] = useState<PhotoFile | null>(null)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [copyProgress, setCopyProgress] = useState<CopyProgress | null>(null)
  const [copyMessage, setCopyMessage] = useState('')
  const [folderMessage, setFolderMessage] = useState('')
  const [error, setError] = useState('')
  const [exifByPath, setExifByPath] = useState<Map<string, PhotoExif>>(new Map())
  const [exifLoaded, setExifLoaded] = useState(false)
  const [isLoadingExif, setIsLoadingExif] = useState(false)
  const [exifProgress, setExifProgress] = useState<ExifProgress | null>(null)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [isoMin, setIsoMin] = useState('')
  const [isoMax, setIsoMax] = useState('')
  const [selectedExif, setSelectedExif] = useState<PhotoExif | null>(null)

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)
  const typeFilteredFiles = filterFilesByType(files, fileTypeFilter)
  const exifFilter: ExifFilter = {
    dateFromMs: parseDateInput(dateFrom, false),
    dateToMs: parseDateInput(dateTo, true),
    isoMin: parseNumberInput(isoMin),
    isoMax: parseNumberInput(isoMax)
  }
  const isExifFilterActive = exifLoaded && hasActiveExifFilter(exifFilter)
  const exifFilteredFiles = isExifFilterActive
    ? applyExifFilter(typeFilteredFiles, exifByPath, exifFilter)
    : typeFilteredFiles
  const parsedSearch = parseSearchInput(searchInput)
  const hasParsedCodes = parsedSearch.codes.length > 0
  const effectiveResultMode: ResultMode = hasParsedCodes ? resultMode : 'matched'
  const matchedFiles = hasParsedCodes ? filterFilesByCodes(exifFilteredFiles, parsedSearch.codes) : exifFilteredFiles
  const matchedPathSet = new Set(matchedFiles.map((file) => file.path))
  const unmatchedFiles = hasParsedCodes ? exifFilteredFiles.filter((file) => !matchedPathSet.has(file.path)) : []
  const resultFiles = effectiveResultMode === 'matched' ? matchedFiles : unmatchedFiles
  const resultGroups = groupFilesByBaseName(resultFiles)
  const resultSize = resultFiles.reduce((sum, file) => sum + file.size, 0)
  const previewRequestId = useRef(0)
  const thumbnailCache = useRef<Map<string, string | null>>(new Map())

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

  function resetFolderDerivedState(): void {
    setExifByPath(new Map())
    setExifLoaded(false)
    setExifProgress(null)
    setSelectedExif(null)
    thumbnailCache.current.clear()
  }

  async function handleChooseFolder(): Promise<void> {
    setError('')
    const selectedFolder = await window.api.selectPhotoFolder()

    if (!selectedFolder) return

    setFolderPath(selectedFolder)
    setFiles([])
    setSelectedFile(null)
    setIsRemovableSource(false)
    setFolderMessage('')
    resetFolderDerivedState()

    try {
      const cachedResult = await window.api.loadCachedPhotoFolder(selectedFolder)

      if (cachedResult) {
        setFolderPath(cachedResult.folderPath)
        setFiles(cachedResult.files)
        setIsRemovableSource(cachedResult.isRemovableDrive)
        setFolderMessage('Loaded previous scan from cache. Press Rescan to refresh this folder.')
        if (cachedResult.isRemovableDrive) setFileActionMode('copy')
        return
      }
    } catch {
      // Cache is optional; fall back to a normal scan if it cannot be loaded.
    }

    await handleScanFolder(selectedFolder)
  }

  async function handleScanFolder(path = folderPath): Promise<void> {
    if (!path) {
      setError('Choose a photo folder first.')
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
      // Force the safe action on memory cards so Move can never delete originals.
      if (result.isRemovableDrive) setFileActionMode('copy')
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not scan this folder.')
    } finally {
      setIsScanning(false)
    }
  }

  async function handleChooseDestinationFolder(): Promise<void> {
    setError('')
    const selectedFolder = await window.api.selectDestinationFolder()

    if (!selectedFolder) return
    setDestinationFolder(selectedFolder)
    setCopyMessage('')
  }

  async function handleCopyMatchedFiles(): Promise<void> {
    if (!destinationFolder) {
      setError('Choose a destination folder first.')
      return
    }

    if (resultFiles.length === 0) {
      setError(`There are no ${effectiveResultMode === 'matched' ? 'matched' : 'non-matched'} files to process.`)
      return
    }

    if (isRemovableSource && fileActionMode === 'move') {
      setError('Move is disabled because the source is on a removable drive (memory card). Use Copy instead.')
      return
    }

    if (fileActionMode === 'move') {
      const shouldMove = window.confirm(
        `Move ${resultFiles.length} file(s)? This will remove them from the source folder after copying is verified.`
      )

      if (!shouldMove) return
    }

    setIsCopying(true)
    setError('')
    setCopyMessage('')
    setCopyProgress({ completed: 0, total: resultFiles.length, currentFileName: '' })

    try {
      const result = await window.api.copyFiles({ destinationFolder, files: resultFiles, action: fileActionMode })
      setCopyMessage(
        fileActionMode === 'move'
          ? `Moved ${result.moved} file(s) to ${result.destinationFolder}`
          : `Copied ${result.copied} file(s) to ${result.destinationFolder}`
      )
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : 'Could not copy matched files.')
    } finally {
      setIsCopying(false)
    }
  }

  async function handleOpenDestinationFolder(): Promise<void> {
    if (!destinationFolder) return
    await window.api.openFolder(destinationFolder)
  }

  async function handleLoadExif(): Promise<void> {
    if (files.length === 0) {
      setError('Scan a photo folder first.')
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
      setError(exifError instanceof Error ? exifError.message : 'Could not read EXIF data.')
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
        setPreviewError('No supported embedded preview is available for this RAW file.')
        return
      }

      if (previewRequestId.current === requestId) setPreviewDataUrl(dataUrl)
    } catch (error) {
      if (previewRequestId.current === requestId) {
        setPreviewError(error instanceof Error ? error.message : 'Could not load preview.')
      }
    } finally {
      if (previewRequestId.current === requestId) setIsPreviewLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[1800px] flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">FPhoto</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Photo Filter Workspace</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Choose a photo folder and scan image files before filtering by client-selected codes.
            </p>
          </div>
          <div className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200">
            MVP
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-cyan-950/20">
            <h2 className="text-lg font-medium">Workflow</h2>
            <ol className="mt-5 space-y-4 text-sm text-slate-300">
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">1. Choose photo folder</li>
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">2. Scan image files</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">3. Enter image codes</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">4. Review matched files</li>
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">5. Copy safely</li>
            </ol>
          </aside>

          <section className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Selected folder</p>
                <p className="mt-2 truncate text-sm text-slate-300">{folderPath || 'No folder selected yet'}</p>
              </div>
              <div className="flex gap-3">
                <button
                  className="rounded-2xl bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isScanning}
                  onClick={handleChooseFolder}
                  type="button"
                >
                  Choose Folder
                </button>
                <button
                  className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isScanning || !folderPath}
                  onClick={() => void handleScanFolder()}
                  type="button"
                >
                  Rescan
                </button>
              </div>
            </div>

            {isRemovableSource ? (
              <div className="mt-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
                This folder is on a removable drive (memory card). Move is disabled to protect your originals — only
                Copy is allowed.
              </div>
            ) : null}

            {folderMessage ? (
              <div className="mt-4 rounded-2xl border border-cyan-400/30 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                {folderMessage}
              </div>
            ) : null}

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-500">Files scanned</p>
                <p className="mt-2 text-3xl font-semibold">{files.length}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-500">Total size</p>
                <p className="mt-2 text-3xl font-semibold">{formatBytes(totalSize)}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-500">Status</p>
                <p className="mt-2 text-3xl font-semibold">{isScanning ? 'Scanning' : 'Ready'}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm text-slate-500">Result size</p>
                <p className="mt-2 text-3xl font-semibold">{formatBytes(resultSize)}</p>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <label className="block flex-1">
                  <span className="text-sm uppercase tracking-[0.25em] text-slate-500">Search codes</span>
                  <textarea
                    className="mt-3 h-28 w-full resize-none rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-400"
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="EX0001, EX0005, EX0010-EX0020 or 1, 5, 10-20"
                    value={searchInput}
                  />
                </label>
                <div className="grid min-w-52 grid-cols-3 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-slate-500">Parsed codes</p>
                    <p className="mt-2 text-2xl font-semibold">{parsedSearch.codes.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-slate-500">Matched</p>
                    <p className="mt-2 text-2xl font-semibold">{matchedFiles.length}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-900 p-4">
                    <p className="text-slate-500">Not matched</p>
                    <p className="mt-2 text-2xl font-semibold">{unmatchedFiles.length}</p>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                    effectiveResultMode === 'matched'
                      ? 'bg-cyan-300 text-slate-950'
                      : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                  onClick={() => setResultMode('matched')}
                  type="button"
                >
                  Use matched files
                </button>
                <button
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                    effectiveResultMode === 'unmatched'
                      ? 'bg-amber-300 text-slate-950'
                      : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                  disabled={!hasParsedCodes}
                  onClick={() => setResultMode('unmatched')}
                  type="button"
                >
                  Use non-matched files
                </button>
              </div>

              <div className="mt-5">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">File type</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    ['all', 'All'],
                    ['jpeg', 'JPEG'],
                    ['raw', 'RAW'],
                    ['other', 'Other']
                  ].map(([value, label]) => (
                    <button
                      className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                        fileTypeFilter === value
                          ? 'bg-violet-300 text-slate-950'
                          : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                      key={value}
                      onClick={() => setFileTypeFilter(value as FileTypeFilter)}
                      type="button"
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Empty search means all scanned files in the selected file type.
                </p>
              </div>

              <div className="mt-5">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">List view</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      listViewMode === 'files'
                        ? 'bg-slate-200 text-slate-950'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    onClick={() => setListViewMode('files')}
                    type="button"
                  >
                    Files
                  </button>
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      listViewMode === 'groups'
                        ? 'bg-slate-200 text-slate-950'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    onClick={() => setListViewMode('groups')}
                    type="button"
                  >
                    Groups ({resultGroups.length})
                  </button>
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      listViewMode === 'grid'
                        ? 'bg-slate-200 text-slate-950'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    onClick={() => setListViewMode('grid')}
                    type="button"
                  >
                    Grid
                  </button>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  Groups combine files with the same base name, for example RAW and JPEG versions of one photo. Grid
                  shows thumbnails and loads them as you scroll.
                </p>
              </div>

              {effectiveResultMode === 'unmatched' ? (
                <p className="mt-3 text-sm text-amber-300">
                  Inverse mode is active. Copy will use files that do not match the parsed codes.
                </p>
              ) : null}

              {parsedSearch.codes.length > 0 ? (
                <p className="mt-3 text-sm text-slate-500">
                  Codes: {parsedSearch.codes.slice(0, 40).join(', ')}
                  {parsedSearch.codes.length > 40 ? `, +${parsedSearch.codes.length - 40} more` : ''}
                </p>
              ) : null}

              {parsedSearch.warnings.map((warning) => (
                <p className="mt-3 text-sm text-amber-300" key={warning}>
                  {warning}
                </p>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500">EXIF filter</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Read camera metadata to filter by date taken and ISO. EXIF is read on demand.
                  </p>
                </div>
                <button
                  className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isLoadingExif || files.length === 0}
                  onClick={() => void handleLoadExif()}
                  type="button"
                >
                  {isLoadingExif ? 'Reading EXIF...' : exifLoaded ? 'Reload EXIF' : 'Load EXIF'}
                </button>
              </div>

              {exifProgress ? (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>
                      {exifProgress.completed}/{exifProgress.total} files
                    </span>
                    <span className="truncate pl-4">{exifProgress.currentFileName}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-violet-300 transition-all"
                      style={{
                        width: `${exifProgress.total === 0 ? 0 : (exifProgress.completed / exifProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {exifLoaded ? (
                <>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Date from</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-400"
                        onChange={(event) => setDateFrom(event.target.value)}
                        type="date"
                        value={dateFrom}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">Date to</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-400"
                        onChange={(event) => setDateTo(event.target.value)}
                        type="date"
                        value={dateTo}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">ISO min</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-400"
                        min="0"
                        onChange={(event) => setIsoMin(event.target.value)}
                        placeholder="e.g. 100"
                        type="number"
                        value={isoMin}
                      />
                    </label>
                    <label className="block">
                      <span className="text-xs uppercase tracking-[0.2em] text-slate-500">ISO max</span>
                      <input
                        className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-slate-100 outline-none transition focus:border-violet-400"
                        min="0"
                        onChange={(event) => setIsoMax(event.target.value)}
                        placeholder="e.g. 3200"
                        type="number"
                        value={isoMax}
                      />
                    </label>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      className="rounded-2xl border border-slate-700 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500"
                      onClick={() => {
                        setDateFrom('')
                        setDateTo('')
                        setIsoMin('')
                        setIsoMax('')
                      }}
                      type="button"
                    >
                      Clear EXIF filter
                    </button>
                    <span className="text-sm text-slate-500">
                      EXIF loaded for {exifByPath.size} file(s).
                      {isExifFilterActive ? ` Filter active: ${exifFilteredFiles.length} match.` : ''}
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-slate-500">
                  EXIF not loaded yet. Loading reads metadata from each scanned file and caches it.
                </p>
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
              <div className="mb-5">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">File action</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition ${
                      fileActionMode === 'copy'
                        ? 'bg-emerald-300 text-slate-950'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    disabled={isCopying}
                    onClick={() => setFileActionMode('copy')}
                    type="button"
                  >
                    Copy
                  </button>
                  <button
                    className={`rounded-2xl px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      fileActionMode === 'move'
                        ? 'bg-rose-300 text-slate-950'
                        : 'border border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                    disabled={isCopying || isRemovableSource}
                    onClick={() => setFileActionMode('move')}
                    type="button"
                  >
                    Move
                  </button>
                </div>
                {isRemovableSource ? (
                  <p className="mt-3 text-sm text-amber-300">
                    Move is disabled while the source is on a removable drive (memory card).
                  </p>
                ) : fileActionMode === 'move' ? (
                  <p className="mt-3 text-sm text-rose-300">
                    Move deletes files from the source only after the copied file size is verified.
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Destination folder</p>
                  <p className="mt-2 truncate text-sm text-slate-300">
                    {destinationFolder || 'No destination folder selected yet'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <button
                    className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isCopying}
                    onClick={handleChooseDestinationFolder}
                    type="button"
                  >
                    Choose Destination
                  </button>
                  <button
                    className="rounded-2xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={
                      isCopying ||
                      resultFiles.length === 0 ||
                      !destinationFolder
                    }
                    onClick={() => void handleCopyMatchedFiles()}
                    type="button"
                  >
                    {isCopying
                      ? fileActionMode === 'move'
                        ? 'Moving...'
                        : 'Copying...'
                      : `${fileActionMode === 'move' ? 'Move' : 'Copy'} ${resultFiles.length} File(s)`}
                  </button>
                  <button
                    className="rounded-2xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={!destinationFolder}
                    onClick={() => void handleOpenDestinationFolder()}
                    type="button"
                  >
                    Open Folder
                  </button>
                </div>
              </div>

              <p className="mt-3 truncate text-sm text-slate-500">
                Copy target: {destinationFolder || 'Choose an existing folder or create a new one in the Windows dialog'}
              </p>

              {copyProgress ? (
                <div className="mt-5">
                  <div className="flex justify-between text-sm text-slate-400">
                    <span>
                      {copyProgress.completed}/{copyProgress.total} files
                    </span>
                    <span className="truncate pl-4">{copyProgress.currentFileName}</span>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-300 transition-all"
                      style={{
                        width: `${copyProgress.total === 0 ? 0 : (copyProgress.completed / copyProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              ) : null}

              {copyMessage ? <p className="mt-4 text-sm text-emerald-300">{copyMessage}</p> : null}
            </div>

            <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
              <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-800">
                {listViewMode !== 'grid' ? (
                  <div className="grid grid-cols-[minmax(0,1fr)_96px_120px_150px] gap-3 bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                    <span className="min-w-0 truncate">
                      {listViewMode === 'files'
                        ? effectiveResultMode === 'matched'
                          ? 'Matched file'
                          : 'Non-matched file'
                        : 'Photo group'}
                    </span>
                    <span className="truncate">{listViewMode === 'files' ? 'Size' : 'Files'}</span>
                    <span className="truncate">Type</span>
                    <span className="truncate">Modified</span>
                  </div>
                ) : null}

                <div className="max-h-[460px] overflow-auto bg-slate-950/50">
                  {resultFiles.length === 0 ? (
                    <div className="p-8 text-center text-slate-500">
                      {isScanning
                        ? 'Scanning folder...'
                        : hasParsedCodes
                          ? `No ${effectiveResultMode === 'matched' ? 'matched' : 'non-matched'} files found.`
                          : 'Choose a folder to scan photo files.'}
                    </div>
                  ) : listViewMode === 'grid' ? (
                    <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                      {resultFiles.slice(0, 500).map((file) => (
                        <ThumbnailCell
                          cache={thumbnailCache.current}
                          file={file}
                          isSelected={selectedFile?.path === file.path}
                          key={file.path}
                          onSelect={(selected) => void handleSelectFile(selected)}
                        />
                      ))}
                    </div>
                  ) : listViewMode === 'files' ? (
                    resultFiles.slice(0, 500).map((file) => (
                      <button
                        className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_96px_120px_150px] gap-3 border-t border-slate-900 px-4 py-3 text-left text-sm transition hover:bg-slate-900/80 ${
                          selectedFile?.path === file.path ? 'bg-cyan-400/10' : ''
                        }`}
                        key={file.path}
                        onClick={() => void handleSelectFile(file)}
                        type="button"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-200">{file.name}</p>
                          <p className="truncate text-xs text-slate-500">{file.path}</p>
                        </div>
                        <span className="truncate text-slate-400">{formatBytes(file.size)}</span>
                        <span className="truncate text-slate-500">{getFileType(file.name).toUpperCase()}</span>
                        <span className="truncate text-slate-500">{formatDate(file.modifiedAt)}</span>
                      </button>
                    ))
                  ) : (
                    resultGroups.slice(0, 500).map((group) => {
                      const previewFile = getBestPreviewFile(group.files)

                      return (
                        <button
                          className={`grid w-full min-w-0 grid-cols-[minmax(0,1fr)_96px_120px_150px] gap-3 border-t border-slate-900 px-4 py-3 text-left text-sm transition hover:bg-slate-900/80 ${
                            selectedFile ? group.files.some((file) => file.path === selectedFile.path) ? 'bg-cyan-400/10' : '' : ''
                          }`}
                          key={group.baseName}
                          onClick={() => void handleSelectFile(previewFile)}
                          type="button"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-200">{group.baseName}</p>
                            <p className="truncate text-xs text-slate-500">
                              {group.files.map((file) => getFileExtension(file.name).slice(1).toUpperCase()).join(' + ')}
                            </p>
                          </div>
                          <span className="truncate text-slate-400">
                            {group.files.length} ({formatBytes(group.totalSize)})
                          </span>
                          <span className="truncate text-slate-500">{group.types.join(' + ')}</span>
                          <span className="truncate text-slate-500">{formatDate(group.modifiedAt)}</span>
                        </button>
                      )
                    })
                  )}
                </div>

                {(listViewMode === 'groups' ? resultGroups.length : resultFiles.length) > 500 ? (
                  <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-500">
                    Showing first 500 {listViewMode === 'groups' ? 'groups' : listViewMode === 'grid' ? 'thumbnails' : 'files'}.
                    Search filtering used all {files.length} scanned files and found{' '}
                    {listViewMode === 'groups' ? resultGroups.length : resultFiles.length}{' '}
                    {listViewMode === 'groups'
                      ? 'groups'
                      : effectiveResultMode === 'matched'
                        ? 'matches'
                        : 'non-matches'}.
                  </div>
                ) : null}
              </div>

              <aside className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                <p className="text-sm uppercase tracking-[0.25em] text-slate-500">Preview</p>

                {selectedFile ? (
                  <div className="mt-4">
                    <div className="flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-slate-800 bg-black/50">
                      {isPreviewLoading ? (
                        <p className="text-sm text-slate-500">Loading preview...</p>
                      ) : previewDataUrl ? (
                        <img
                          alt={selectedFile.name}
                          className="max-h-[420px] w-full object-contain"
                          loading="lazy"
                          src={previewDataUrl}
                        />
                      ) : (
                        <div className="px-6 text-center text-slate-500">
                          <p className="text-lg font-semibold text-slate-300">Preview not available</p>
                          <p className="mt-2 text-sm">
                            {previewError ||
                              'RAW files need a supported embedded preview thumbnail. Some formats, including some RAF files, may not provide one.'}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="mt-4 space-y-2 text-sm">
                      <p className="break-all font-medium text-slate-200">{selectedFile.name}</p>
                      <p className="text-slate-500">Type: {getFileType(selectedFile.name).toUpperCase()}</p>
                      <p className="text-slate-500">Size: {formatBytes(selectedFile.size)}</p>
                      <p className="break-all text-slate-600">{selectedFile.path}</p>

                      {selectedExif && getExifRows(selectedExif).length > 0 ? (
                        <div className="mt-3 space-y-1 border-t border-slate-800 pt-3">
                          {getExifRows(selectedExif).map((row) => (
                            <p className="flex justify-between gap-3" key={row.label}>
                              <span className="text-slate-500">{row.label}</span>
                              <span className="truncate text-right text-slate-300">{row.value}</span>
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 flex min-h-72 items-center justify-center rounded-2xl border border-dashed border-slate-800 text-center text-sm text-slate-500">
                    Click a file in the list to preview it.
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
