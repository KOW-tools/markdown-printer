import { EditorView, Decoration, DecorationSet, WidgetType, keymap, ViewPlugin, ViewUpdate } from '@codemirror/view'
import { StateField, StateEffect, type EditorState } from '@codemirror/state'
import { streamCompletion, GHOST_TEXT_SYSTEM_PROMPT } from '../services/llm'
import { loadLlmConfig, isLlmEnabled } from '../utils/storage'

class GhostTextWidget extends WidgetType {
  constructor(readonly text: string) {
    super()
  }

  toDOM() {
    const span = document.createElement('span')
    span.className = 'cm-ghost-text'
    span.textContent = this.text
    return span
  }

  eq(other: GhostTextWidget) {
    return other.text === this.text
  }
}

interface GhostTextData {
  text: string
  pos: number
}

const setGhostText = StateEffect.define<GhostTextData>()
const clearGhostText = StateEffect.define<void>()

const ghostTextField = StateField.define<GhostTextData | null>({
  create() {
    return null
  },
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setGhostText)) return e.value
      if (e.is(clearGhostText)) return null
    }
    if (tr.docChanged) return null
    return value
  },
})

function buildDecorations(state: EditorState): DecorationSet {
  const data = state.field(ghostTextField)
  if (!data || !data.text) return Decoration.none
  const widget = Decoration.widget({
    widget: new GhostTextWidget(data.text),
    side: 1,
  }).range(data.pos)
  return Decoration.set([widget])
}

const ghostTextDecorations = EditorView.decorations.compute([ghostTextField], (state) => {
  return buildDecorations(state)
})

let pendingVersion = 0

const ghostTextViewPlugin = ViewPlugin.fromClass(
  class {
    private abortController: AbortController | null = null
    private debounceTimer: ReturnType<typeof setTimeout> | null = null
    private myVersion = 0

    constructor(_view: EditorView) {}

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet) {
        this.scheduleCompletion(update.view)
      }
    }

    private scheduleCompletion(view: EditorView) {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      if (this.abortController) this.abortController.abort()

      const { from, empty } = view.state.selection.main
      if (from === 0 || !empty) {
        // Defer dispatch to avoid "update in progress" crash
        requestAnimationFrame(() => {
          if (view.state.field(ghostTextField)) {
            view.dispatch({ effects: clearGhostText.of() })
          }
        })
        return
      }

      this.abortController = new AbortController()
      this.myVersion = ++pendingVersion

      this.debounceTimer = setTimeout(() => {
        this.fetchCompletion(view, this.myVersion, from)
      }, 300)
    }

    private async fetchCompletion(view: EditorView, version: number, pos: number) {
      const config = await loadLlmConfig()
      if (!config || !isLlmEnabled()) return
      if (version !== pendingVersion) return

      const docText = view.state.doc.toString()
      const context = docText.slice(0, pos)
      if (context.trim().length === 0) return

      try {
        let accumulated = ''
        for await (const token of streamCompletion({
          endpoint: config.endpoint,
          apiKey: config.apiKey,
          model: config.model,
          messages: [
            { role: 'system', content: GHOST_TEXT_SYSTEM_PROMPT },
            { role: 'user', content: context },
          ],
          signal: this.abortController?.signal,
        })) {
          if (version !== pendingVersion) return
          accumulated += token
          view.dispatch({
            effects: setGhostText.of({ text: accumulated, pos }),
          })
        }

        if (!accumulated.trim()) {
          view.dispatch({ effects: clearGhostText.of() })
        }
      } catch (e: any) {
        if (e?.name === 'AbortError') return
        console.error('[GhostText]', e)
        view.dispatch({ effects: clearGhostText.of() })
      }
    }

    destroy() {
      if (this.debounceTimer) clearTimeout(this.debounceTimer)
      if (this.abortController) this.abortController.abort()
    }
  },
)

const ghostTextKeymap = keymap.of([
  {
    key: 'Tab',
    run(view) {
      const data = view.state.field(ghostTextField)
      if (!data) return false
      view.dispatch({
        changes: { from: data.pos, insert: data.text },
        selection: { anchor: data.pos + data.text.length },
        effects: clearGhostText.of(),
      })
      return true
    },
  },
  {
    key: 'Escape',
    run(view) {
      const data = view.state.field(ghostTextField)
      if (!data) return false
      view.dispatch({ effects: clearGhostText.of() })
      return true
    },
  },
])

export const ghostTextExtension = [
  ghostTextField,
  ghostTextDecorations,
  ghostTextViewPlugin,
  ghostTextKeymap,
]
