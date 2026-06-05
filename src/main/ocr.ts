import { app, nativeImage } from 'electron'
import { mkdir, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, extname, join } from 'node:path'
import { createWorker, PSM } from 'tesseract.js'
import { parseOcrInput } from '../shared/search'
import type { OcrImageData, OcrResult } from '../shared/types'

const require = createRequire(import.meta.url)

const ocrTargetMaxEdge = 1800
const ocrMaxUpscale = 4
const imageExtensionByMimeType = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/bmp', '.bmp'],
  ['image/tiff', '.tif']
])
let ocrWorkerPromise: ReturnType<typeof createWorker> | null = null

type WindowsOcrResult = {
  Result?: {
    Text?: string
    Lines?: Array<{ Text?: string }>
  }
}

type WindowsOcrModule = {
  recognizeBatchFromPath: (
    imagePaths: string[],
    options?: { language?: string; moduleRoot?: string }
  ) => Promise<WindowsOcrResult[]>
}

function getOcrPaths(): { langPath: string; corePath: string; gzip: boolean } {
  if (app.isPackaged) {
    const ocrResourcesPath = join(process.resourcesPath, 'ocr')

    return {
      langPath: join(ocrResourcesPath, 'tessdata'),
      corePath: join(ocrResourcesPath, 'tesseract-core'),
      gzip: true
    }
  }

  const englishData = require('@tesseract.js-data/eng') as { langPath: string; gzip: boolean }

  return {
    langPath: englishData.langPath,
    corePath: dirname(require.resolve('tesseract.js-core/tesseract-core.wasm.js')),
    gzip: englishData.gzip
  }
}

async function getOcrWorker(): ReturnType<typeof createWorker> {
  if (!ocrWorkerPromise) {
    const ocrPaths = getOcrPaths()
    const cachePath = join(app.getPath('userData'), 'ocr-cache')

    await mkdir(cachePath, { recursive: true })

    ocrWorkerPromise = createWorker('eng', 1, {
      langPath: ocrPaths.langPath,
      gzip: ocrPaths.gzip,
      cachePath,
      corePath: ocrPaths.corePath,
      logger: () => undefined
    })

    const worker = await ocrWorkerPromise
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.SPARSE_TEXT,
      tessedit_char_whitelist: '0123456789,.;:-_ ',
      preserve_interword_spaces: '1',
      user_defined_dpi: '300'
    })
  }

  return ocrWorkerPromise
}

async function readTextWithWindowsOcr(imagePath: string): Promise<string | null> {
  if (process.platform !== 'win32') return null

  try {
    const { recognizeBatchFromPath } = require('node-windows-ocr') as WindowsOcrModule
    const moduleRoot = app.isPackaged
      ? join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'node-windows-ocr')
      : undefined
    const [result] = await recognizeBatchFromPath([imagePath], { moduleRoot })
    const lineText = result?.Result?.Lines?.map((line) => line.Text).filter(Boolean).join('\n')
    const text = lineText || result?.Result?.Text || ''

    return text.trim() || null
  } catch {
    return null
  }
}

async function createOcrInputImage(imagePath: string): Promise<string> {
  const image = nativeImage.createFromPath(imagePath)
  if (image.isEmpty()) return imagePath

  const size = image.getSize()
  const maxEdge = Math.max(size.width, size.height)
  if (maxEdge <= 0) return imagePath

  const scale = Math.min(ocrMaxUpscale, Math.max(1, ocrTargetMaxEdge / maxEdge))
  if (scale <= 1.05) return imagePath

  const resizedImage = image.resize({
    width: Math.round(size.width * scale),
    height: Math.round(size.height * scale),
    quality: 'best'
  })

  const ocrInputFolder = join(app.getPath('userData'), 'ocr-input')
  await mkdir(ocrInputFolder, { recursive: true })

  const resizedImagePath = join(ocrInputFolder, `ocr-${Date.now()}.png`)
  await writeFile(resizedImagePath, resizedImage.toPNG())
  return resizedImagePath
}

function getOcrImageDataExtension(request: OcrImageData): string {
  const mimeExtension = imageExtensionByMimeType.get(request.mimeType.toLowerCase())
  if (mimeExtension) return mimeExtension

  const fileExtension = extname(request.fileName).toLowerCase()
  return fileExtension || '.png'
}

export async function readCodesFromImageData(request: OcrImageData): Promise<OcrResult> {
  const pasteFolder = join(app.getPath('userData'), 'ocr-paste')
  await mkdir(pasteFolder, { recursive: true })

  const imagePath = join(pasteFolder, `ocr-paste-${Date.now()}${getOcrImageDataExtension(request)}`)
  await writeFile(imagePath, Buffer.from(new Uint8Array(request.data)))
  return readCodesFromImage(imagePath)
}

export async function readCodesFromImage(imagePath: string): Promise<OcrResult> {
  const windowsOcrText = await readTextWithWindowsOcr(imagePath)
  if (windowsOcrText) {
    const parsedSearch = parseOcrInput(windowsOcrText)

    if (parsedSearch.codes.length > 0) {
      return {
        imagePath,
        text: windowsOcrText,
        codes: parsedSearch.codes,
        warnings: parsedSearch.warnings
      }
    }
  }

  const worker = await getOcrWorker()
  const ocrInputPath = await createOcrInputImage(imagePath)
  const {
    data: { text }
  } = await worker.recognize(ocrInputPath)
  const parsedSearch = parseOcrInput(text)

  return {
    imagePath,
    text: text.trim(),
    codes: parsedSearch.codes,
    warnings: parsedSearch.warnings
  }
}
