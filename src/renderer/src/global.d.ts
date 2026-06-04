import type { FPhotoApi } from '../../shared/types'

declare module '*.png' {
  const value: string
  export default value
}

declare global {
  interface Window {
    api: FPhotoApi
  }
}

export {}
