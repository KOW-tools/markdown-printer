import { ref, watch, type Ref } from 'vue'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import markedKatex from 'marked-katex-extension'
import { markedSmartypants } from 'marked-smartypants'
import markedBidi from 'marked-bidi'
import markedAlert from 'marked-alert'
import markedExtendedTables from 'marked-extended-tables'
import hljs from 'highlight.js'

export function useMarkdown(content: Ref<string>) {
  const renderedHtml = ref('')
  const error = ref<string | null>(null)

  let currentSource = ''
  let sourceSearchPos = 0

  function lineAtRaw(raw: string): number {
    const idx = currentSource.indexOf(raw, sourceSearchPos)
    const useIdx = idx >= 0 ? idx : currentSource.indexOf(raw)
    if (useIdx < 0) return 1
    sourceSearchPos = useIdx + raw.length
    return currentSource.slice(0, useIdx).split('\n').length
  }

  // Wrap marked-extended-tables renderer to emit data-source-line
  const extendedTablesPlugin = (() => {
    const plugin = markedExtendedTables()
    return {
      extensions: plugin.extensions.map((ext: { name: string; renderer: any }) => {
        if (ext.name !== 'spanTable') return ext
        const origRenderer = ext.renderer
        return {
          ...ext,
          renderer(this: any, token: any) {
            const output = origRenderer.call(this, token)
            if (token.sourceLine !== undefined) {
              return output.replace('<table', `<table data-source-line="${token.sourceLine}"`)
            }
            return output
          },
        }
      }),
    }
  })()

  const marked = new Marked(
    markedHighlight({
      langPrefix: 'hljs language-',
      highlight(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value
          } catch {}
        }
        return hljs.highlightAuto(code).value
      }
    }),
    markedKatex({
      throwOnError: false,
    }),
    markedSmartypants(),
    markedBidi(),
    markedAlert(),
    extendedTablesPlugin,
  )

  marked.setOptions({
    gfm: true,
    breaks: true,
  })

  marked.use({
    walkTokens(token) {
      if (token.type === 'heading' || token.type === 'paragraph' || token.type === 'code'
          || token.type === 'list_item' || token.type === 'table' || token.type === 'hr'
          || token.type === 'spanTable') {
        ;(token as { sourceLine?: number }).sourceLine = lineAtRaw(token.raw)
      }
    },
    renderer: {
      paragraph({ tokens, sourceLine }: any) {
        const text = this.parser.parseInline(tokens)
        if (sourceLine !== undefined) {
          return `<p data-source-line="${sourceLine}">${text}</p>`
        }
        return `<p>${text}</p>`
      },
      heading({ tokens, depth, sourceLine }: any) {
        const text = this.parser.parseInline(tokens)
        if (sourceLine !== undefined) {
          return `<h${depth} data-source-line="${sourceLine}">${text}</h${depth}>`
        }
        return `<h${depth}>${text}</h${depth}>`
      },
      code({ text, lang, sourceLine }: any) {
        const langClass = lang ? ` class="language-${lang}"` : ''
        const attr = sourceLine !== undefined ? ` data-source-line="${sourceLine}"` : ''
        return `<pre${attr}><code${langClass}>${text}</code></pre>`
      },
      listitem({ tokens, checked, sourceLine }: any) {
        const attr = sourceLine !== undefined ? ` data-source-line="${sourceLine}"` : ''
        if (checked !== null && checked !== undefined) {
          return `<li data-checked="${checked}"${attr}>${this.parser.parse(tokens)}</li>`
        }
        return `<li${attr}>${this.parser.parse(tokens)}</li>`
      },
      table({ header, rows, sourceLine }: any) {
        const attr = sourceLine !== undefined ? ` data-source-line="${sourceLine}"` : ''
        const renderCell = (cell: any, tag: string) => {
          const alignAttr = cell.align ? ` align="${cell.align}"` : ''
          return `<${tag}${alignAttr}>${this.parser.parseInline(cell.tokens)}</${tag}>`
        }
        const headerHtml = header.map((cell: any) => renderCell(cell, 'th')).join('')
        const rowsHtml = rows.map((row: any) =>
          `<tr>${row.map((cell: any) => renderCell(cell, 'td')).join('')}</tr>`
        ).join('')
        return `<table${attr}><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`
      },
      hr({ sourceLine }: any) {
        const attr = sourceLine !== undefined ? ` data-source-line="${sourceLine}"` : ''
        return `<hr${attr}>`
      },
      html({ text }: { text: string }) {
        const trimmed = text.trim()
        if (/page-break-after\s*:\s*always/i.test(trimmed)) {
          return '<div data-page-break="true"></div>'
        }
        return text
      },
    }
  })

  function preprocessMarkdown(src: string): string {
    let result = src.replace(/^(\${1,2})([^\n$]+)\1$/gm, (_match: string, delim: string, expr: string) => {
      return `${delim}\n${expr}\n${delim}`
    })

    result = result.replace(/([^\n])\n(\$\$\n)/g, '$1\n\n$2')
    result = result.replace(/(\n\$\$)\n([^\n])/g, '$1\n\n$2')
    if (result.endsWith('$$') && !result.endsWith('$$\n')) {
      result += '\n'
    }

    return result
  }

  async function render() {
    try {
      const preprocessed = preprocessMarkdown(content.value)
      currentSource = preprocessed
      sourceSearchPos = 0
      const html = await marked.parse(preprocessed)
      renderedHtml.value = html
      error.value = null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Render error'
    }
  }

  let renderTimeout: ReturnType<typeof setTimeout>
  watch(content, () => {
    clearTimeout(renderTimeout)
    renderTimeout = setTimeout(render, 150)
  }, { immediate: true })

  return {
    renderedHtml,
    error,
  }
}
