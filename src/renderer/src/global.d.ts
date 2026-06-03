import type { FPhotoApi } from '../../shared/types'

declare global {
  interface Window {
    api: FPhotoApi
  }
}

export {}
