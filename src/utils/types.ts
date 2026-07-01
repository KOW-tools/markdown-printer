export interface Tab {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface PageSize {
  name: string
  width: string
  height: string
  cssSize: string
  category: 'iso' | 'na' | 'photo'
}

export interface FontOption {
  name: string
  family: string
  source: 'google' | 'generic' | 'uploaded'
  group?: string
}

export interface MarginConfig {
  top: string
  right: string
  bottom: string
  left: string
}

export type Orientation = 'portrait' | 'landscape'

export type ViewMode = 'editor' | 'preview' | 'split'

export interface LlmConfig {
  endpoint: string
  apiKey: string
  model: string
}

export interface EditorSettings {
  pageSize: string
  scale: number
  font: string
  fontSize: number
  rtl: boolean
  lineNumbers: boolean
  margin: MarginConfig
  orientation: Orientation
  contentScale: number
  contentScaleMap: Record<string, number> | null
  softWrap: boolean
  viewMode: ViewMode
}

export interface StoredImage {
  id: string
  name: string
  mimeType: string
  blob: Blob
  createdAt: number
}
