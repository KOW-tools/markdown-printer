import type { PageSize, FontOption, MarginConfig } from './types'

export const PAGE_CATEGORIES = {
  iso: 'ISO A-Series',
  na: 'North American',
  photo: 'Photo Print Sizes',
} as const

export const PAGE_SIZES: PageSize[] = [
  { name: 'A0', width: '841mm', height: '1189mm', cssSize: 'A0', category: 'iso' },
  { name: 'A1', width: '594mm', height: '841mm', cssSize: 'A1', category: 'iso' },
  { name: 'A2', width: '420mm', height: '594mm', cssSize: 'A2', category: 'iso' },
  { name: 'A3', width: '297mm', height: '420mm', cssSize: 'A3', category: 'iso' },
  { name: 'A4', width: '210mm', height: '297mm', cssSize: 'A4', category: 'iso' },
  { name: 'A5', width: '148mm', height: '210mm', cssSize: 'A5', category: 'iso' },
  { name: 'A6', width: '105mm', height: '148mm', cssSize: 'A6', category: 'iso' },
  { name: 'Letter', width: '215.9mm', height: '279.4mm', cssSize: 'Letter', category: 'na' },
  { name: 'Legal', width: '215.9mm', height: '355.6mm', cssSize: 'Legal', category: 'na' },
  { name: 'Tabloid', width: '279.4mm', height: '431.8mm', cssSize: 'Tabloid', category: 'na' },
  { name: 'Junior Legal', width: '127mm', height: '203.2mm', cssSize: 'Junior Legal', category: 'na' },
  { name: 'Gov. Letter', width: '203.2mm', height: '266.7mm', cssSize: 'Gov. Letter', category: 'na' },
  { name: 'Wallet', width: '63.5mm', height: '88.9mm', cssSize: 'Wallet', category: 'photo' },
  { name: '4R Photo', width: '101.6mm', height: '152.4mm', cssSize: '4R Photo', category: 'photo' },
  { name: '5R Photo', width: '127mm', height: '177.8mm', cssSize: '5R Photo', category: 'photo' },
  { name: '8R Photo', width: '203.2mm', height: '254mm', cssSize: '8R Photo', category: 'photo' },
]

export const GENERIC_FONTS: FontOption[] = [
  { name: 'Serif', family: 'serif', source: 'generic', group: 'Generic' },
  { name: 'Sans-serif', family: 'sans-serif', source: 'generic', group: 'Generic' },
  { name: 'Monospace', family: 'monospace', source: 'generic', group: 'Generic' },
  { name: 'Cursive', family: 'cursive', source: 'generic', group: 'Generic' },
  { name: 'Fantasy', family: 'fantasy', source: 'generic', group: 'Generic' },
  { name: 'System UI', family: 'system-ui', source: 'generic', group: 'Generic' },
  { name: 'UI Serif', family: 'ui-serif', source: 'generic', group: 'Generic' },
  { name: 'UI Sans-serif', family: 'ui-sans-serif', source: 'generic', group: 'Generic' },
  { name: 'UI Monospace', family: 'ui-monospace', source: 'generic', group: 'Generic' },
  { name: 'UI Rounded', family: 'ui-rounded', source: 'generic', group: 'Generic' },
]

export const GOOGLE_FONTS: FontOption[] = [
  { name: 'Open Sans', family: 'Open Sans', source: 'google', group: 'Google Fonts' },
  { name: 'Roboto', family: 'Roboto', source: 'google', group: 'Google Fonts' },
  { name: 'Montserrat', family: 'Montserrat', source: 'google', group: 'Google Fonts' },
  { name: 'Inter', family: 'Inter', source: 'google', group: 'Google Fonts' },
  { name: 'Lora', family: 'Lora', source: 'google', group: 'Google Fonts' },
  { name: 'Lato', family: 'Lato', source: 'google', group: 'Google Fonts' },
  { name: 'Source Code Pro', family: 'Source Code Pro', source: 'google', group: 'Google Fonts' },
]

export function getAllFonts(): FontOption[] {
  return [...GENERIC_FONTS, ...GOOGLE_FONTS]
}

export const DEFAULT_CONTENT = `# Welcome to Markdown Printer

Start typing your markdown here...

## Features

- **Bold text** and *italic text*
- [Links](https://example.com)
- Code blocks with syntax highlighting
- Math equations: $E = mc^2$
- Tables, lists, and more

---

## Code Example

\`\`\`javascript
function greet(name) {
  return \`Hello, \${name}!\`
}
\`\`\`

## Math

Inline math: $\\alpha + \\beta = \\gamma$

Block math:
$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$
`

export const STORAGE_KEYS = {
  TABS: 'markdown-printer-tabs',
  SETTINGS: 'markdown-printer-settings',
  ACTIVE_TAB: 'markdown-printer-active-tab',
  LLM_CONFIG: 'markdown-printer-llm-config',
  LLM_ENABLED: 'markdown-printer-llm-enabled',
} as const

export const IMAGES_STORE = 'images'

export const MARGIN_PRESETS: Record<string, MarginConfig> = {
  moderate: { top: '1in', right: '0.75in', bottom: '1in', left: '0.75in' },
  standard: { top: '1in', right: '1.25in', bottom: '1in', left: '1.25in' },
  narrow: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  wide: { top: '1in', right: '2in', bottom: '1in', left: '2in' },
}

export const MM_TO_PX = 96 / 25.4

export function getPageWidthPx(pageSize: PageSize, orientation: 'portrait' | 'landscape' = 'portrait'): number {
  const w = orientation === 'landscape' ? pageSize.height : pageSize.width
  return parseFloat(w) * MM_TO_PX
}

const LARGEST_DIM_MM = Math.max(...PAGE_SIZES.map(s => Math.max(parseFloat(s.width), parseFloat(s.height))))

// containerWidth = available preview area width in px (default 500)
export function getScaleRange(
  pageSize: PageSize,
  orientation: 'portrait' | 'landscape' = 'portrait',
  containerWidth: number = 500,
): { min: number; default: number; max: number } {
  const pageW = getPageWidthPx(pageSize, orientation)
  const fitScale = containerWidth / pageW
  const min = Math.max(0.05, Math.round(fitScale * 0.3 * 100) / 100)
  const max = Math.round(fitScale * 3 * 100) / 100
  const def = Math.round(fitScale * 0.95 * 100) / 100
  return { min, default: def, max }
}

// sqrt compression so small pages stay visible in the dropdown
export function getPreviewScale(pageSize: PageSize): number {
  const pageMaxDim = Math.max(parseFloat(pageSize.width), parseFloat(pageSize.height))
  return Math.sqrt(pageMaxDim / LARGEST_DIM_MM)
}

// Content scale factor: A4 = 1.0 base, derived dynamically from PAGE_SIZES
const A4_SIZE = PAGE_SIZES.find(p => p.name === 'A4')!
const A4_AREA = parseFloat(A4_SIZE.width) * parseFloat(A4_SIZE.height)

export function getContentScaleFactor(pageSize: PageSize): number {
  const area = parseFloat(pageSize.width) * parseFloat(pageSize.height)
  return Math.round(Math.sqrt(area / A4_AREA) * 100) / 100
}

export function getContentScaleRange(pageSize: PageSize): { min: number; max: number; default: number } {
  const defaultScale = getContentScaleFactor(pageSize)
  return {
    min: Math.max(0.01, defaultScale - 1.0),
    max: defaultScale + 1.0,
    default: defaultScale,
  }
}
