import { ref } from 'vue'
import type { MarginConfig } from '../utils/types'
import { PAGE_SIZES } from '../utils/constants'
import { getAllStoredFonts } from '../utils/storage'
import { fontFamilyCSS } from '../utils/css'

// CSS as raw strings — inlined into the print iframe instead of <link> tags
import katexCSS from 'katex/dist/katex.min.css?raw'
import gmCSS from 'github-markdown-css/github-markdown-light.css?raw'
import hlCSS from 'highlight.js/styles/github.min.css?raw'

// paged.polyfill is copied to vendor/ via viteStaticCopy (not duplicated in assets)

// KaTeX fonts as hashed asset URLs — avoid duplicating the 60 files that
// Vite already extracts into dist/assets/ via the main app's CSS import.
const kaTeXFonts = import.meta.glob('/node_modules/katex/dist/fonts/*', {
  eager: true, query: '?url', import: 'default'
}) as Record<string, string>

// @fontsource fonts as hashed asset URLs — same reasoning, avoids duplication.
const fontSourceFonts = import.meta.glob([
  '/node_modules/@fontsource/open-sans/files/open-sans-latin-*-normal.woff2',
  '/node_modules/@fontsource/roboto/files/roboto-latin-*-normal.woff2',
  '/node_modules/@fontsource/montserrat/files/montserrat-latin-*-normal.woff2',
  '/node_modules/@fontsource/inter/files/inter-latin-*-normal.woff2',
  '/node_modules/@fontsource/lora/files/lora-latin-*-normal.woff2',
  '/node_modules/@fontsource/lato/files/lato-latin-*-normal.woff2',
  '/node_modules/@fontsource/source-code-pro/files/source-code-pro-latin-*-normal.woff2',
], {
  eager: true, query: '?url', import: 'default'
}) as Record<string, string>

// Build a filename → hashed-URL map so we can rewrite the KaTeX CSS font references.
const kaTeXFontMap: Record<string, string> = {}
for (const [filePath, url] of Object.entries(kaTeXFonts)) {
  kaTeXFontMap[filePath.split('/').pop()!] = url
}

// Pre-process KaTeX CSS: replace url(fonts/KaTeX_*.woff2) with the hashed asset URLs.
// This lets the inlined CSS find the fonts in dist/assets/ instead of dist/vendor/.
const processedKaTeXCSS = katexCSS.replace(
  /url\(fonts\/([^)]+)\)/g,
  (match, fontName: string) => {
    const url = kaTeXFontMap[fontName]
    return url ? `url(${url})` : match
  }
)

const FONT_LOCAL_CONFIG: Record<string, { pkg: string; weights: number[] }> = {
  'Open Sans': { pkg: 'open-sans', weights: [400, 600, 700] },
  'Roboto': { pkg: 'roboto', weights: [400, 600, 700] },
  'Montserrat': { pkg: 'montserrat', weights: [400, 600, 700] },
  'Inter': { pkg: 'inter', weights: [400, 600, 700] },
  'Lora': { pkg: 'lora', weights: [400, 700] },
  'Lato': { pkg: 'lato', weights: [400, 700] },
  'Source Code Pro': { pkg: 'source-code-pro', weights: [400, 700] },
}

function getLocalFontCSS(font: string): string {
  const config = FONT_LOCAL_CONFIG[font]
  if (!config) return ''
  return config.weights.map(w => {
    const globKey = `/node_modules/@fontsource/${config.pkg}/files/${config.pkg}-latin-${w}-normal.woff2`
    const url = fontSourceFonts[globKey]
    if (!url) return ''
    return `@font-face { font-family: '${font}'; font-style: normal; font-weight: ${w}; src: url('${url}') format('woff2'); }`
  }).filter(Boolean).join('\n')
}

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function getFormatFromMime(type: string): string {
  if (type.includes('woff2')) return 'woff2'
  if (type.includes('woff')) return 'woff'
  if (type.includes('truetype') || type.includes('ttf')) return 'truetype'
  if (type.includes('opentype') || type.includes('otf')) return 'opentype'
  return 'woff2'
}

async function getFontCSS(font: string): Promise<string> {
  if (font.startsWith('Custom-')) {
    const storedFonts = await getAllStoredFonts()
    const stored = storedFonts.find(f => f.family === font)
    if (stored) {
      const dataUri = await blobToDataUri(stored.blob)
      const format = getFormatFromMime(stored.blob.type)
      return `@font-face { font-family: '${font}'; src: url('${dataUri}') format('${format}'); }`
    }
    return ''
  }

  return getLocalFontCSS(font)
}

function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent)
}

async function waitForPagedjs(win: Window): Promise<void> {
  if (win.__pagedReady) return
  await new Promise<void>((resolve) => {
    const check = () => {
      if (win.__pagedReady) resolve()
      else setTimeout(check, 50)
    }
    check()
  })
}

export function usePDF() {
  const isGenerating = ref(false)
  const error = ref<string | null>(null)

  function getExplicitPageSize(pageSize: string, orientation: 'portrait' | 'landscape'): string {
    const size = PAGE_SIZES.find(p => p.name === pageSize)
    if (!size) return orientation === 'landscape' ? '297mm 210mm' : '210mm 297mm'

    const w = size.width
    const h = size.height
    return orientation === 'landscape' ? `${h} ${w}` : `${w} ${h}`
  }

  async function download(
    renderedHtml: string,
    pageSize: string = 'A4',
    margin: MarginConfig = { top: '1in', right: '0.75in', bottom: '1in', left: '0.75in' },
    orientation: 'portrait' | 'landscape' = 'portrait',
    font: string = 'Open Sans',
    fontSize: number = 14,
    contentScale: number = 1.0,
    rtl: boolean = false,
  ) {
    isGenerating.value = true
    error.value = null

    let iframe: HTMLIFrameElement | null = null

    // Safety fallback: reset isGenerating if beforeprint never fires
    const safetyTimer = setTimeout(() => {
      isGenerating.value = false
    }, 30000)

    try {
      iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:0;height:0;border:none'
      document.body.appendChild(iframe)

      const explicitSize = getExplicitPageSize(pageSize, orientation)
      const marginStr = `${margin.top} ${margin.right} ${margin.bottom} ${margin.left}`
      const fontCSS = await getFontCSS(font)
      const fontValue = fontFamilyCSS(font)
      const dirAttr = rtl ? ' dir="rtl"' : ''
      const bodyDirCSS = rtl ? 'direction: rtl;' : ''
      const effectiveFontSize = Math.round(fontSize * contentScale * 100) / 100

      const css = `
        ${processedKaTeXCSS}
        ${gmCSS}
        ${hlCSS}
        ${fontCSS}

        @page {
          size: ${explicitSize};
          margin: ${marginStr};
        }

        body {
          font-family: ${fontValue}, sans-serif;
          font-size: ${effectiveFontSize}px;
          color: #000;
          background: white;
          padding: 0;
          margin: 0;
          ${bodyDirCSS}
        }

        .markdown-body {
          font-family: inherit;
          font-size: inherit;
          box-sizing: border-box;
          padding: 0;
        }

        .markdown-body table,
        .markdown-body :has(> pre),
        .markdown-body :has(> code),
        .markdown-body :has(> blockquote) {
          break-inside: avoid;
        }

        .markdown-body table {
          display: table;
          width: 100%;
          table-layout: fixed;
        }

        .markdown-body table td,
        .markdown-body table th {
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        .markdown-body pre,
        .markdown-body pre code {
          white-space: pre-wrap;
          overflow-wrap: break-word;
          word-wrap: break-word;
        }

        [dir="rtl"].markdown-body ul,
        [dir="rtl"].markdown-body ol {
          padding-left: unset;
          padding-right: 2em;
          direction: rtl;
        }

        div[data-page-break="true"] {
          page-break-before: always;
          break-before: page;
        }

        * {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
      `

      const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>${css}</style>
  <script>
    window.PagedConfig = {
      after: function() { window.__pagedReady = true; }
    };
  </script>
  <script src="${import.meta.env.BASE_URL}vendor/paged.polyfill.js"></script>
</head>
<body${dirAttr}>
  <div class="markdown-body">${renderedHtml}</div>
</body>
</html>`

      // Android Chrome: use window.open() to bypass iframe print bug
      // (Chromium #41222716 - iframe.contentWindow.print() prints parent on Android)
      if (isAndroid()) {
        const printWindow = window.open('', '_blank')
        if (!printWindow) {
          throw new Error('Failed to open print window. Please allow popups for this site.')
        }

        printWindow.document.write(htmlContent)
        printWindow.document.close()
        await waitForPagedjs(printWindow)

        printWindow.addEventListener('beforeprint', () => {
          clearTimeout(safetyTimer)
          isGenerating.value = false
        }, { once: true })

        printWindow.print()
        return
      }

      const doc = iframe.contentDocument!
      doc.open()
      doc.write(htmlContent)
      doc.close()
      await waitForPagedjs(iframe.contentWindow!)

      iframe.contentWindow!.addEventListener('beforeprint', () => {
        clearTimeout(safetyTimer)
        isGenerating.value = false
      }, { once: true })

      iframe.contentWindow!.addEventListener('afterprint', () => {
        setTimeout(() => {
          if (document.body.contains(iframe!)) {
            document.body.removeChild(iframe!)
          }
        }, 5000)
      }, { once: true })

      iframe.contentWindow!.print()

    } catch (e) {
      clearTimeout(safetyTimer)
      error.value = e instanceof Error ? e.message : 'Unknown error'
      console.error('PDF print error:', error.value)
      isGenerating.value = false

      if (iframe && document.body.contains(iframe)) {
        document.body.removeChild(iframe)
      }
    }
  }

  return {
    download,
    isGenerating,
    error,
  }
}
