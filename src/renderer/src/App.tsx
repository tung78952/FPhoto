import { useState } from 'react'
import type { PhotoFile } from '../../shared/types'

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

function App(): JSX.Element {
  const [folderPath, setFolderPath] = useState('')
  const [files, setFiles] = useState<PhotoFile[]>([])
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState('')

  const totalSize = files.reduce((sum, file) => sum + file.size, 0)

  async function handleChooseFolder(): Promise<void> {
    setError('')
    const selectedFolder = await window.api.selectPhotoFolder()

    if (!selectedFolder) return

    setFolderPath(selectedFolder)
    setFiles([])
    await handleScanFolder(selectedFolder)
  }

  async function handleScanFolder(path = folderPath): Promise<void> {
    if (!path) {
      setError('Choose a photo folder first.')
      return
    }

    setIsScanning(true)
    setError('')

    try {
      const result = await window.api.scanPhotoFolder(path)
      setFolderPath(result.folderPath)
      setFiles(result.files)
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'Could not scan this folder.')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <header className="flex items-center justify-between border-b border-slate-800 pb-6">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">FPhoto</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Photo Filter Workspace</h1>
            <p className="mt-3 max-w-2xl text-slate-400">
              Choose a photo folder and scan image files before filtering by client-selected codes.
            </p>
          </div>
          <div className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-200">
            Phase 2
          </div>
        </header>

        <div className="grid flex-1 gap-6 py-8 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-3xl border border-slate-800 bg-slate-900/60 p-5 shadow-2xl shadow-cyan-950/20">
            <h2 className="text-lg font-medium">Workflow</h2>
            <ol className="mt-5 space-y-4 text-sm text-slate-300">
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">1. Choose photo folder</li>
              <li className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-100">2. Scan image files</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">3. Enter image codes</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">4. Review matched files</li>
              <li className="rounded-2xl bg-slate-800/70 p-4">5. Copy safely</li>
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

            {error ? (
              <div className="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 sm:grid-cols-3">
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
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-800">
              <div className="grid grid-cols-[1fr_120px_180px] bg-slate-950 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>File</span>
                <span>Size</span>
                <span>Modified</span>
              </div>

              <div className="max-h-[360px] overflow-auto bg-slate-950/50">
                {files.length === 0 ? (
                  <div className="p-8 text-center text-slate-500">
                    {isScanning ? 'Scanning folder...' : 'Choose a folder to scan photo files.'}
                  </div>
                ) : (
                  files.slice(0, 500).map((file) => (
                    <div
                      className="grid grid-cols-[1fr_120px_180px] gap-3 border-t border-slate-900 px-4 py-3 text-sm"
                      key={file.path}
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-200">{file.name}</p>
                        <p className="truncate text-xs text-slate-500">{file.path}</p>
                      </div>
                      <span className="text-slate-400">{formatBytes(file.size)}</span>
                      <span className="text-slate-500">{formatDate(file.modifiedAt)}</span>
                    </div>
                  ))
                )}
              </div>

              {files.length > 500 ? (
                <div className="border-t border-slate-800 bg-slate-950 px-4 py-3 text-sm text-slate-500">
                  Showing first 500 files. Search filtering will use all {files.length} scanned files.
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

export default App
