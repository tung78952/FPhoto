import type { PhotoFile } from './types'

export type ParsedSearch = {
  codes: number[]
  warnings: string[]
}

const maxRangeSize = 5000

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

export function parseSearchInput(input: string): ParsedSearch {
  const codes = new Set<number>()
  const warnings: string[] = []
  let remainingInput = input

  const rangePattern = /[a-z]*\s*(\d+)\s*-\s*[a-z]*\s*(\d+)/gi
  remainingInput = remainingInput.replace(rangePattern, (_, startValue: string, endValue: string) => {
    addRange(codes, Number(startValue), Number(endValue), warnings)
    return ' '
  })

  const numberPattern = /\d+/g
  for (const match of remainingInput.matchAll(numberPattern)) {
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
