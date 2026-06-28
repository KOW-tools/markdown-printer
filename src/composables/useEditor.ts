import { ref, shallowRef, onMounted, onUnmounted, type Ref } from 'vue'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { EditorState, Compartment } from '@codemirror/state'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import { languages } from '@codemirror/language-data'
import { defaultKeymap, history, historyKeymap, indentWithTab, undo as cmUndo, redo as cmRedo, deleteLine } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { autocompletion, completionKeymap } from '@codemirror/autocomplete'
import { lintKeymap } from '@codemirror/lint'
import { ghostTextExtension } from '../plugins/ghostText'

const lightTheme = EditorView.theme({
  '&': { backgroundColor: '#ffffff' },
  '.cm-content': { caretColor: '#333333' },
  '.cm-cursor': { borderLeftColor: '#333333' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#d4e6ff' },
  '.cm-gutters': { backgroundColor: '#f5f5f5', borderRight: '1px solid #e0e0e0' },
})

const darkTheme = EditorView.theme({
  '&': { backgroundColor: '#1a1a1a' },
  '.cm-content': { caretColor: '#e0e0e0' },
  '.cm-cursor': { borderLeftColor: '#e0e0e0' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': { backgroundColor: '#264f78' },
  '.cm-gutters': { backgroundColor: '#2a2a2a', borderRight: '1px solid #444444' },
  '.cm-activeLineGutter': { backgroundColor: '#333333' },
  '.cm-activeLine': { backgroundColor: '#2a2a2a' },
})

function isDarkMode(): boolean {
  if (document.documentElement.classList.contains('dark')) return true
  if (document.documentElement.classList.contains('light')) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getThemeForSystemPreference(): { dark: boolean } {
  return { dark: window.matchMedia('(prefers-color-scheme: dark)').matches }
}

function getInitialDark(): boolean {
  const saved = localStorage.getItem('theme')
  if (saved === 'dark') return true
  if (saved === 'light') return false
  return getThemeForSystemPreference().dark
}

export function useEditor(
  containerRef: Ref<HTMLElement | null>,
  initialContent: string,
  onUpdate: (content: string) => void,
  initialSoftWrap: boolean = true
) {
  const editorView = shallowRef<EditorView | null>(null)
  const content = ref(initialContent)
  const selectedText = ref('')
  const themeCompartment = new Compartment()
  const softWrapCompartment = new Compartment()
  const llmCompartment = new Compartment()
  let mediaQuery: MediaQueryList | null = null
  let handleThemeChange: ((e: MediaQueryListEvent) => void) | null = null
  let themeObserver: MutationObserver | null = null

  function createEditor() {
    if (!containerRef.value) return

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        const newContent = update.state.doc.toString()
        content.value = newContent
        onUpdate(newContent)
      }
      if (update.selectionSet) {
        const sel = update.state.selection.main
        selectedText.value = sel.empty ? '' : update.state.sliceDoc(sel.from, sel.to)
      }
    })

    const pageBreakPattern = '<div style="page-break-after: always;"></div>'

    // --- Table navigation (Tab/Shift+Tab between cells) ---

    function findPipePositions(text: string): number[] {
      const pos: number[] = []
      for (let i = 0; i < text.length; i++) {
        if (text[i] === '|') {
          let bs = 0
          for (let j = i - 1; j >= 0 && text[j] === '\\'; j--) bs++
          if (bs % 2 === 0) pos.push(i)
        }
      }
      return pos
    }

    function isSeparatorRow(text: string): boolean {
      return /^\|[\s:\-]+(\|[\s:\-]+)*\|$/.test(text.trim())
    }

    function selectCellInRow(view: EditorView, row: { num: number; pipes: number[] }, cellIdx: number) {
      const line = view.state.doc.line(row.num)
      const cellStart = line.from + row.pipes[cellIdx] + 1
      const cellEnd = line.from + row.pipes[cellIdx + 1]
      const content = view.state.sliceDoc(cellStart, cellEnd)
      const trimmed = content.trim()
      if (trimmed) {
        const leadingWS = content.length - content.trimStart().length
        const trailingWS = content.length - content.trimEnd().length
        view.dispatch({
          selection: { anchor: cellStart + leadingWS, head: cellEnd - trailingWS },
          scrollIntoView: true,
        })
      } else {
        view.dispatch({
          selection: { anchor: cellStart },
          scrollIntoView: true,
        })
      }
    }

    function navigateTableCell(view: EditorView, forward: boolean): boolean {
      const { state } = view
      const { head } = state.selection.main
      const curLine = state.doc.lineAt(head)

      if (!curLine.text.trim().startsWith('|')) return false

      // Collect all contiguous table rows (lines starting with |)
      interface TRow { num: number; text: string; pipes: number[] }
      const rows: TRow[] = []

      for (let n = curLine.number; n >= 1; n--) {
        const l = state.doc.line(n)
        if (!l.text.trim().startsWith('|')) break
        const pipes = findPipePositions(l.text)
        if (pipes.length < 2) break
        rows.unshift({ num: n, text: l.text, pipes })
      }
      for (let n = curLine.number + 1; n <= state.doc.lines; n++) {
        const l = state.doc.line(n)
        if (!l.text.trim().startsWith('|')) break
        const pipes = findPipePositions(l.text)
        if (pipes.length < 2) break
        rows.push({ num: n, text: l.text, pipes })
      }

      if (rows.length === 0) return false

      // If on separator row, jump to adjacent data row
      if (isSeparatorRow(curLine.text)) {
        if (forward) {
          const next = rows.find(r => r.num > curLine.number && !isSeparatorRow(r.text))
          if (next) { selectCellInRow(view, next, 0); return true }
        } else {
          const prev = rows.slice().reverse().find(r => r.num < curLine.number && !isSeparatorRow(r.text))
          if (prev) { selectCellInRow(view, prev, prev.pipes.length - 2); return true }
        }
        return false
      }

      // Filter to data rows only
      const dataRows = rows.filter(r => !isSeparatorRow(r.text))
      const curRowIdx = dataRows.findIndex(r => r.num === curLine.number)
      if (curRowIdx === -1) return false

      const curRow = dataRows[curRowIdx]
      const numCells = curRow.pipes.length - 1

      // Find which cell cursor is in
      const colOff = head - curLine.from
      let curCell = -1
      for (let i = 0; i < numCells; i++) {
        if (colOff >= curRow.pipes[i] && colOff < curRow.pipes[i + 1]) { curCell = i; break }
      }
      if (curCell === -1) return false

      if (forward) {
        const nextCell = curCell + 1
        if (nextCell < numCells) {
          selectCellInRow(view, curRow, nextCell)
          return true
        }
        // End of row → next data row, first cell
        if (curRowIdx + 1 < dataRows.length) {
          selectCellInRow(view, dataRows[curRowIdx + 1], 0)
          return true
        }
        return false // last cell of last row → default Tab
      } else {
        const prevCell = curCell - 1
        if (prevCell >= 0) {
          selectCellInRow(view, curRow, prevCell)
          return true
        }
        // Start of row → previous data row, last cell
        if (curRowIdx - 1 >= 0) {
          const prevRow = dataRows[curRowIdx - 1]
          selectCellInRow(view, prevRow, prevRow.pipes.length - 2)
          return true
        }
        return false // first cell of first row → default Shift+Tab
      }
    }

    const tableNavigationKeymap = keymap.of([
      { key: 'Tab', run: (view) => navigateTableCell(view, true) },
      { key: 'Shift-Tab', run: (view) => navigateTableCell(view, false) },
    ])

    const pageBreakKeymap = keymap.of([{
      key: 'Backspace',
      run(view) {
        const { state } = view
        const { from } = state.selection.main
        const line = state.doc.lineAt(from)
        const lineText = line.text.trim()

        if (lineText === pageBreakPattern) {
          const lineStart = line.from
          const lineEnd = line.to
          let deleteFrom = lineStart
          let deleteTo = lineEnd

          if (lineStart > 0) {
            const prevChar = state.sliceDoc(lineStart - 1, lineStart)
            if (prevChar === '\n') {
              deleteFrom = lineStart - 1
              if (deleteFrom > 0) {
                const prevPrevChar = state.sliceDoc(deleteFrom - 1, deleteFrom)
                if (prevPrevChar === '\n') {
                  deleteFrom = deleteFrom - 1
                }
              }
            }
          }

          const afterPos = Math.min(deleteTo + 1, state.doc.length)
          if (afterPos < state.doc.length) {
            const nextChar = state.sliceDoc(deleteTo, afterPos)
            if (nextChar === '\n') {
              deleteTo = afterPos
              const afterAfterPos = Math.min(deleteTo + 1, state.doc.length)
              if (afterAfterPos < state.doc.length) {
                const nextNextChar = state.sliceDoc(deleteTo, afterAfterPos)
                if (nextNextChar === '\n') {
                  deleteTo = afterAfterPos
                }
              }
            }
          }

          view.dispatch({
            changes: { from: deleteFrom, to: deleteTo },
            selection: { anchor: deleteFrom },
          })
          return true
        }

        return false
      },
    }])

    const state = EditorState.create({
      doc: initialContent,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        highlightSelectionMatches(),
        autocompletion(),
        markdown({ base: markdownLanguage, codeLanguages: languages }),
        llmCompartment.of([]),
        pageBreakKeymap,
        tableNavigationKeymap,
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...searchKeymap,
          ...completionKeymap,
          ...lintKeymap,
          indentWithTab,
        ]),
        updateListener,
        themeCompartment.of(getInitialDark() ? darkTheme : lightTheme),
        softWrapCompartment.of(initialSoftWrap ? EditorView.lineWrapping : []),
        EditorView.theme({
          '&': {
            height: '100%',
            fontSize: '14px',
          },
          '.cm-scroller': {
            overflow: 'auto',
          },
          '.cm-content': {
            fontFamily: "'Source Code Pro', 'Fira Code', monospace",
            paddingBottom: '20vh',
          },
          '.cm-ghost-text': {
            color: 'inherit',
            opacity: '0.4',
            fontStyle: 'italic',
            pointerEvents: 'none',
            whiteSpace: 'pre-wrap',
          },
        }),
      ],
    })

    editorView.value = new EditorView({
      state,
      parent: containerRef.value,
    })
  }

  function undo() {
    if (editorView.value) cmUndo(editorView.value)
  }

  function redo() {
    if (editorView.value) cmRedo(editorView.value)
  }

  function insertText(text: string) {
    if (!editorView.value) return
    const { from, to } = editorView.value.state.selection.main
    editorView.value.dispatch({
      changes: { from, to, insert: text },
      selection: { anchor: from + text.length },
    })
  }

  function getLineCount(): number {
    return editorView.value?.state.doc.lines || 0
  }

  function scrollToLine(line: number) {
    if (!editorView.value) return
    const pos = editorView.value.state.doc.line(Math.min(line, getLineCount())).from
    editorView.value.dispatch({
      selection: { anchor: pos },
      effects: EditorView.scrollIntoView(pos, { y: 'center' }),
    })
  }

  function focus() {
    editorView.value?.focus()
  }

  function setSoftWrap(enabled: boolean) {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: softWrapCompartment.reconfigure(enabled ? EditorView.lineWrapping : []),
      })
    }
  }

  function setLlmEnabled(enabled: boolean) {
    if (editorView.value) {
      editorView.value.dispatch({
        effects: llmCompartment.reconfigure(enabled ? ghostTextExtension : []),
      })
    }
  }

  onMounted(() => {
    createEditor()

    // Watch for class changes on <html> (manual theme toggle)
    themeObserver = new MutationObserver(() => {
      if (editorView.value) {
        editorView.value.dispatch({
          effects: themeCompartment.reconfigure(isDarkMode() ? darkTheme : lightTheme),
        })
      }
    })
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })

    // Also watch system preference as fallback
    mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    handleThemeChange = (e: MediaQueryListEvent) => {
      const saved = localStorage.getItem('theme')
      if (saved) return // manual override active, ignore system
      if (editorView.value) {
        editorView.value.dispatch({
          effects: themeCompartment.reconfigure(e.matches ? darkTheme : lightTheme),
        })
      }
    }
    mediaQuery.addEventListener('change', handleThemeChange)
  })

  onUnmounted(() => {
    themeObserver?.disconnect()
    if (mediaQuery && handleThemeChange) {
      mediaQuery.removeEventListener('change', handleThemeChange)
    }
    editorView.value?.destroy()
  })

  return {
    editorView,
    content,
    selectedText,
    undo,
    redo,
    insertText,
    getLineCount,
    scrollToLine,
    focus,
    setSoftWrap,
    setLlmEnabled,
  }
}
