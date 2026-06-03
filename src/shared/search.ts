import type { PhotoFile } from './types'

export type ParsedSearch = {
  codes: number[]
  warnings: string[]
}

const maxRangeSize = 5000

function normalizeSearchText(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

function removeNoise(input: string): string {
  return input
    .replace(/\b\d{1,2}\s*[/.]\s*\d{1,2}(?:\s*[/.]\s*\d{2,4})?\b/g, ' ')
    .replace(/\bthu\s*[2-7]\b/g, ' ')
    .replace(/\b\d{1,2}\s*(?:h|gio)(?:\s*\d{1,2})?\b/g, ' ')
    .replace(/\b\d{1,2}\s*(?:am|pm)\b/g, ' ')
    .replace(/\b(?:m\d{1,2}|\d\s*m\s*\d{1,2})\b/g, ' ')
    .replace(/\b\d{1,3}\s*(?:kg|ki|ky|can)\b/g, ' ')
    .replace(/\b(?:chuyen|ck|coc|thanh toan|gui tien)\s*\d{1,6}\b/g, ' ')
    .replace(/\b\d{1,6}\s*(?:k|nghin|ngan|trieu|vnd|d)\b/g, ' ')
    .replace(/\b(?:cao|chan|keo chan|giam|xuong con|om|map|can nang)[^\d]{0,16}\d{1,3}\b/g, ' ')
}

function addRange(codes: Set<number>, start: number, end: number, warnings: string[]): void {
  const first = Math.min(start, end)
  const last = Math.max(start, end)
  const rangeSize = last - first + 1

  if (rangeSize > maxRangeSize) {
    warnings.push(`Range ${start}-${end} is too large and was skipped.`)
    return
  }

  for (let code = first; code <= last; code += 1) {
    codes.add(code)
  }
}

function shouldSkipNumber(input: string, index: number, rawValue: string): boolean {
  if (rawValue.length >= 7) return true

  const before = input.slice(Math.max(0, index - 36), index)
  const after = input.slice(index + rawValue.length, index + rawValue.length + 36)

  if (/^\s*(?:h|gio|am|pm)\b/.test(after)) return true
  if (/\bthu\s*$/.test(before)) return true
  if (/\b(?:sdt|so dien thoai|phone|zalo)\s*$/.test(before)) return true
  if (/\b(?:chuyen|ck|coc|thanh toan|gui tien)\s*$/.test(before)) return true
  if (/\b(?:ngay|thang|nam)\s*$/.test(before)) return true
  if (/^\s*(?:ngay|thang|nam)\b/.test(after)) return true
  if (/^\s*(?:k|nghin|ngan|trieu|vnd|d|gb|mb|%|kg|ki|ky|can)\b/.test(after)) return true
  if (/\b(?:cao|chan|keo chan|giam|xuong con|om|map|can nang)\b/.test(before)) return true

  const looksLikeQuantity = /^\s*(?:tam|hinh|anh|file)\b/.test(after)
  const quantityContext = /\b(?:chon|lay|can|gui|tong|tong cong|khoang)\s*$/.test(before)
  if (looksLikeQuantity && quantityContext) return true

  return false
}

function isContextualNumber(input: string, index: number, rawValue: string): boolean {
  const before = input.slice(Math.max(0, index - 28), index)
  const after = input.slice(index + rawValue.length, index + rawValue.length + 12)

  if (/\b(?:anh|tam|hinh|file)\s*(?:so|ma)?\s*$/.test(before)) return true
  if (/\b(?:ex|img|dsc|dscf)[_-]?\s*$/.test(before)) return true
  if (/\b(?:lay|chon)\s*$/.test(before) && !/^\s*(?:tam|hinh|anh|file)\b/.test(after)) return true

  return false
}

function isListNumber(input: string, index: number, rawValue: string): boolean {
  const before = input.slice(Math.max(0, index - 40), index)
  const after = input.slice(index + rawValue.length, index + rawValue.length + 4)

  const hasListSeparatorBefore = /(?:^|[,;]\s*)$/.test(before) || /\bva\s*$/.test(before)
  const hasListSeparatorAfter = /^(?:\s*(?:,|;)\s*|\s*va\b|\s*$)/.test(after)
  const hasPhotoListContext = /\b(?:anh|tam|hinh|file|lay|chon)\b/.test(before)

  return hasListSeparatorBefore && hasListSeparatorAfter && hasPhotoListContext
}

function isPlainCodeList(input: string): boolean {
  const trimmedInput = input.trim()
  if (!trimmedInput) return false

  return /\d/.test(trimmedInput) && /^[\d\s,;._-]+$/.test(trimmedInput)
}

function hasPhotoNumberContext(input: string): boolean {
  return /\b(?:anh|tam|hinh|file|lay|chon|ex|img|dsc|dscf)\b/.test(input)
}

function parseRanges(input: string, codes: Set<number>, warnings: string[]): string {
  const rangePattern = /(?:tu\s+)?[a-z]{0,8}[_-]?\s*((?<!\d)\d{1,6}(?!\d))\s*(?:-|–|—|den|toi)\s*[a-z]{0,8}[_-]?\s*((?<!\d)\d{1,6}(?!\d))/gi

  return input.replace(rangePattern, (_, startValue: string, endValue: string) => {
    addRange(codes, Number(startValue), Number(endValue), warnings)
    return ' '
  })
}

function parseExcludedCodes(input: string, codes: Set<number>): string {
  const exclusionPattern = /\b(?:bo|khong lay|loai|tru)\s*(?:anh|tam|hinh|file)?\s*([a-z]{0,8}[_-]?\s*\d{1,6}(?:\s*(?:,|va)\s*[a-z]{0,8}[_-]?\s*\d{1,6})*)/gi

  return input.replace(exclusionPattern, (match: string, values: string) => {
    for (const valueMatch of values.matchAll(/(?<!\d)\d{1,6}(?!\d)/g)) {
      codes.delete(Number(valueMatch[0]))
    }

    return ' '.repeat(match.length)
  })
}

export function parseSearchInput(input: string): ParsedSearch {
  const codes = new Set<number>()
  const warnings: string[] = []
  let remainingInput = removeNoise(normalizeSearchText(input))

  remainingInput = parseRanges(remainingInput, codes, warnings)
  remainingInput = parseExcludedCodes(remainingInput, codes)
  const allowPlainNumbers = isPlainCodeList(remainingInput) || hasPhotoNumberContext(remainingInput)

  const numberPattern = /(?<!\d)\d{1,6}(?!\d)/g
  for (const match of remainingInput.matchAll(numberPattern)) {
    if (shouldSkipNumber(remainingInput, match.index ?? 0, match[0])) continue
    if (
      !allowPlainNumbers &&
      !isContextualNumber(remainingInput, match.index ?? 0, match[0]) &&
      !isListNumber(remainingInput, match.index ?? 0, match[0])
    ) {
      continue
    }

    codes.add(Number(match[0]))
  }

  return {
    codes: [...codes].sort((left, right) => left - right),
    warnings
  }
}

export function getFileCodeNumbers(fileName: string): number[] {
  const baseName = fileName.replace(/\.[^.]+$/, '')
  const matches = baseName.match(/\d+/g)

  if (!matches) return []
  return matches.map((match) => Number(match))
}

export function filterFilesByCodes(files: PhotoFile[], codes: number[]): PhotoFile[] {
  if (codes.length === 0) return []

  const codeSet = new Set(codes)
  return files.filter((file) => getFileCodeNumbers(file.name).some((code) => codeSet.has(code)))
}
