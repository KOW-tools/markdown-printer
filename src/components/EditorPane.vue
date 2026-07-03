<template>
  <div
    class="editor-pane"
    @contextmenu.prevent="handleContextMenu"
    @dragover.prevent="onDragOver"
    @dragleave.prevent="dragActive = false"
    @drop.prevent="onDrop"
    :class="{ 'drag-active': dragActive }"
  >
    <div ref="editorContainer" class="editor-container"></div>
    <ContextMenu
      ref="contextMenuRef"
      :selected-text="contextMenuText"
      :active-formats="activeFormats"
      @action="handleContextAction"
      @close="closeContextMenu"
    />
    <Gallery v-model:visible="showGallery" @select="onGallerySelect" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useEditor } from '../composables/useEditor'
import { useImages } from '../composables/useImages'
import ContextMenu from './ContextMenu.vue'
import Gallery from './Gallery.vue'

const props = defineProps<{
  modelValue: string
  softWrap: boolean
  tabId: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'editor-ready': [view: any]
  'update:selectedText': [value: string]
}>()

const editorContainer = ref<HTMLElement | null>(null)
const tabIdRef = ref(props.tabId)

const { editorView, content, selectedText, undo, redo, insertText, scrollToLine, focus, setSoftWrap } = useEditor(
  editorContainer,
  props.modelValue,
  (value) => emit('update:modelValue', value),
  props.softWrap,
  tabIdRef,
)

const { uploadImage } = useImages()

watch(selectedText, (val) => {
  emit('update:selectedText', val)
})

watch(() => props.softWrap, (val) => {
  setSoftWrap(val)
})

watch(() => props.tabId, (val) => {
  tabIdRef.value = val
})

watch(() => props.modelValue, (newVal) => {
  if (editorView.value && editorView.value.state.doc.toString() !== newVal) {
    editorView.value.dispatch({
      changes: { from: 0, to: editorView.value.state.doc.length, insert: newVal },
    })
  }
})

// Active formats interface
interface ActiveFormats {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  code: boolean
  heading: 0 | 1 | 2 | 3 | 4 | 5 | 6
  alignment: 'left' | 'center' | 'right' | null
  listType: 'ul' | 'ol' | null
}

// Context menu state
const contextMenuRef = ref<InstanceType<typeof ContextMenu> | null>(null)
const contextMenuOpen = ref(false)
const contextMenuText = ref('')
const activeFormats = ref<ActiveFormats>({
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  code: false,
  heading: 0,
  alignment: null,
  listType: null,
})
const headingLevel = ref(0)
const lineFrom = ref(0)
const lineTo = ref(0)
const wasLineFallback = ref(false)

const dragActive = ref(false)

function onDragOver(e: DragEvent) {
  if (e.dataTransfer?.types.includes('Files')) {
    dragActive.value = true
  }
}

async function onDrop(e: DragEvent) {
  dragActive.value = false
  const files = e.dataTransfer?.files
  if (!files || files.length === 0) return

  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    const saved = await uploadImage(file)
    if (saved) {
      const insertText = `![${saved.name}](./${encodeURIComponent(saved.name)})`
      handleContextAction('paste', insertText)
    }
  }
}

const showGallery = ref(false)

function openGalleryDialog() {
  showGallery.value = true
}

function onGallerySelect(filename: string) {
  const insertText = `![${filename}](./${encodeURIComponent(filename)})`
  handleContextAction('paste', insertText)
}

function detectActiveFormats(
  text: string,
  effectiveText: string,
  view: any,
  workFrom: number,
  workTo: number
): ActiveFormats {
  const bold = text.length > 4 && text.startsWith('**') && text.endsWith('**')
  const italic = !bold && text.length > 2 && text.startsWith('*') && text.endsWith('*')
  const underline = text.length > 7 && text.startsWith('<u>') && text.endsWith('</u>')
  const strikethrough = text.length > 4 && text.startsWith('~~') && text.endsWith('~~')
  const code = text.length > 2 && text.startsWith('`') && text.endsWith('`')

  // Heading detection from first line
  const headingMatch = effectiveText.match(/^(#{1,6})\s*/)
  const heading: 0 | 1 | 2 | 3 | 4 | 5 | 6 = headingMatch
    ? (headingMatch[1].length as 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : 0

  // Alignment detection from line
  const alignMatch = effectiveText.match(/<div align="(left|center|right)">/)
  const alignment: 'left' | 'center' | 'right' | null = alignMatch
    ? (alignMatch[1] as 'left' | 'center' | 'right')
    : null

  // List detection: check ALL lines in the selection range (skip empty lines)
  const firstLine = view.state.doc.lineAt(workFrom)
  const lastLine = view.state.doc.lineAt(workTo)
  const lines: string[] = []
  for (let i = firstLine.number; i <= lastLine.number; i++) {
    lines.push(view.state.doc.line(i).text)
  }

  const isEmptyLine = (line: string) => line.replace(/^#{1,6}\s*/, '').trim() === ''
  const isUlLine = (line: string) => {
    const stripped = line.replace(/^#{1,6}\s*/, '')
    return /^-\s/.test(stripped)
  }
  const isOlLine = (line: string) => {
    const stripped = line.replace(/^#{1,6}\s*/, '')
    return /^\d+\.\s/.test(stripped)
  }

  const nonEmpty = lines.filter(l => !isEmptyLine(l))
  const allUl = nonEmpty.length > 0 && nonEmpty.every(isUlLine)
  const allOl = nonEmpty.length > 0 && nonEmpty.every(isOlLine)
  const anyList = nonEmpty.some(l => isUlLine(l) || isOlLine(l))

  let listType: 'ul' | 'ol' | null = null
  if (allUl) {
    listType = 'ul'
  } else if (allOl) {
    listType = 'ol'
  } else if (anyList) {
    // Mixed list types — report as the dominant type, or 'ul' if mixed
    const ulCount = nonEmpty.filter(isUlLine).length
    const olCount = nonEmpty.filter(isOlLine).length
    listType = ulCount >= olCount ? 'ul' : 'ol'
  }

  return { bold, italic, underline, strikethrough, code, heading, alignment, listType }
}

function handleContextMenu(e: MouseEvent) {
  if (!editorView.value) return
  showContextMenu(e)
}

function showContextMenu(e: MouseEvent) {
  if (!editorView.value) return

  const state = editorView.value.state
  const selection = state.selection.main

  let effectiveText = ''
  let cursorLine: ReturnType<typeof state.doc.lineAt> | null = null

  if (!selection.empty) {
    // Use the actual selection
    effectiveText = state.sliceDoc(selection.from, selection.to)
    cursorLine = state.doc.lineAt(selection.from)
  } else {
    // Line fallback: use the entire current line
    cursorLine = state.doc.lineAt(selection.head)
    effectiveText = cursorLine.text
  }

  // Detect heading level from the full line
  const headingMatch = effectiveText.match(/^(#{1,6})\s*/)
  const detectedLevel = headingMatch
    ? (headingMatch[1].length as 0 | 1 | 2 | 3 | 4 | 5 | 6)
    : 0

  // Strip heading prefix for the effective text passed to ContextMenu
  let strippedText = effectiveText
  if (detectedLevel > 0) {
    strippedText = effectiveText.replace(/^#{1,6}\s*/, '')
  }

  // Store state
  headingLevel.value = detectedLevel
  lineFrom.value = cursorLine.from
  lineTo.value = cursorLine.to
  wasLineFallback.value = selection.empty
  contextMenuText.value = strippedText

  // Detect active formats (pass full selection range for multi-line list detection)
  const workFrom = selection.empty ? cursorLine.from : selection.from
  const workTo = selection.empty ? cursorLine.to : selection.to
  activeFormats.value = detectActiveFormats(strippedText, effectiveText, editorView.value, workFrom, workTo)

  contextMenuRef.value?.show(e)
  contextMenuOpen.value = true
}

function closeContextMenu() {
  contextMenuOpen.value = false
}

function handleContextAction(type: string, _text?: string) {
  if (!editorView.value) return

  const state = editorView.value.state
  const { from, to } = state.selection.main

  // Determine the working range
  let workFrom = from
  let workTo = to
  let selected = ''

  if (wasLineFallback.value) {
    // We were working on the whole line
    workFrom = lineFrom.value
    workTo = lineTo.value
    selected = state.sliceDoc(workFrom, workTo)
  } else {
    selected = state.sliceDoc(from, to) || ''
  }

  // Detect current heading from the line text
  const lineText = state.sliceDoc(workFrom, workTo)
  const headingMatch = lineText.match(/^(#{1,6})\s*/)
  const currentLevel = headingMatch ? headingMatch[1].length : 0
  const textWithoutHeading = currentLevel > 0
    ? lineText.replace(/^#{1,6}\s*/, '')
    : lineText

  // For formatting actions, use stripped text (no heading prefix)
  let formatText = selected
  if (wasLineFallback.value && currentLevel > 0) {
    formatText = textWithoutHeading
  }

  let insert = ''
  let selectionFrom = workFrom
  let selectionTo = workTo

  switch (type) {
    case 'bold': {
      if (formatText.length > 4 && formatText.startsWith('**') && formatText.endsWith('**')) {
        // Already bold: unwrap
        insert = formatText.slice(2, -2)
      } else {
        // Empty or not bold: wrap with placeholder
        const text = formatText || 'bold'
        insert = `**${text}**`
      }
      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom + (formatText ? 0 : 2)
      selectionTo = workFrom + insert.length - (formatText ? 0 : 2)
      break
    }
    case 'italic': {
      if (formatText.length > 2 && formatText.startsWith('*') && !formatText.startsWith('**') && formatText.endsWith('*')) {
        // Already italic: unwrap
        insert = formatText.slice(1, -1)
      } else {
        // Empty or not italic: wrap with placeholder
        const text = formatText || 'italic'
        insert = `*${text}*`
      }
      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom + (formatText ? 0 : 1)
      selectionTo = workFrom + insert.length - (formatText ? 0 : 1)
      break
    }
    case 'underline': {
      if (formatText.length > 7 && formatText.startsWith('<u>') && formatText.endsWith('</u>')) {
        // Already underlined: unwrap
        insert = formatText.slice(3, -4)
      } else {
        // Empty or not underlined: wrap with placeholder
        const text = formatText || 'underline'
        insert = `<u>${text}</u>`
      }
      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom + (formatText ? 0 : 3)
      selectionTo = workFrom + insert.length - (formatText ? 0 : 4)
      break
    }
    case 'strikethrough': {
      if (formatText.length > 4 && formatText.startsWith('~~') && formatText.endsWith('~~')) {
        // Already strikethrough: unwrap
        insert = formatText.slice(2, -2)
      } else {
        // Empty or not strikethrough: wrap with placeholder
        const text = formatText || 'strikethrough'
        insert = `~~${text}~~`
      }
      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom + (formatText ? 0 : 2)
      selectionTo = workFrom + insert.length - (formatText ? 0 : 2)
      break
    }
    case 'heading1':
    case 'heading2':
    case 'heading3':
    case 'heading4':
    case 'heading5':
    case 'heading6': {
      const targetLevel = parseInt(type.replace('heading', '')) as 1 | 2 | 3 | 4 | 5 | 6
      const prefix = '#'.repeat(targetLevel) + ' '
      const text = textWithoutHeading || `Heading ${targetLevel}`
      insert = prefix + text
      selectionFrom = workFrom + prefix.length
      selectionTo = workFrom + insert.length
      break
    }
    case 'link': {
      insert = `[${textWithoutHeading || 'link'}](url)`
      selectionFrom = workFrom + 1
      selectionTo = workFrom + 1 + (textWithoutHeading || 'link').length
      break
    }
    case 'image': {
      insert = `![${textWithoutHeading || 'alt text'}](url)`
      selectionFrom = workFrom + 2
      selectionTo = workFrom + 2 + (textWithoutHeading || 'alt text').length
      break
    }
    case 'code': {
      if (formatText.length > 1 && formatText.startsWith('`') && formatText.endsWith('`')) {
        // Already inline code: unwrap
        insert = formatText.slice(1, -1)
      } else {
        const text = formatText || 'code'
        insert = `\`${text}\``
      }
      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom + (formatText ? 0 : 1)
      selectionTo = workFrom + insert.length - (formatText ? 0 : 1)
      break
    }
    case 'codeBlock': {
      const lang = 'python'
      const codeContent = textWithoutHeading || 'print("Hello, World!")'
      insert = '```' + lang + '\n' + codeContent + '\n```'
      selectionFrom = workFrom + 4 + lang.length
      selectionTo = selectionFrom + codeContent.length
      break
    }
    case 'blockquote': {
      insert = `> ${textWithoutHeading || 'quote'}`
      selectionFrom = workFrom + 2
      selectionTo = workFrom + 2 + (textWithoutHeading || 'quote').length
      break
    }
    case 'alertNote': {
      const text0 = textWithoutHeading || 'Useful information that users should know, even when skimming content.'
      insert = `> [!NOTE]\n> ${text0}`
      selectionFrom = workFrom + insert.indexOf(text0)
      selectionTo = selectionFrom + text0.length
      break
    }
    case 'alertTip': {
      const text0 = textWithoutHeading || 'Helpful advice for doing things better or more easily.'
      insert = `> [!TIP]\n> ${text0}`
      selectionFrom = workFrom + insert.indexOf(text0)
      selectionTo = selectionFrom + text0.length
      break
    }
    case 'alertImportant': {
      const text0 = textWithoutHeading || 'Key information users need to know to achieve their goal.'
      insert = `> [!IMPORTANT]\n> ${text0}`
      selectionFrom = workFrom + insert.indexOf(text0)
      selectionTo = selectionFrom + text0.length
      break
    }
    case 'alertWarning': {
      const text0 = textWithoutHeading || 'Urgent info that needs immediate user attention to avoid problems.'
      insert = `> [!WARNING]\n> ${text0}`
      selectionFrom = workFrom + insert.indexOf(text0)
      selectionTo = selectionFrom + text0.length
      break
    }
    case 'alertCaution': {
      const text0 = textWithoutHeading || 'Advises about risks or negative outcomes of certain actions.'
      insert = `> [!CAUTION]\n> ${text0}`
      selectionFrom = workFrom + insert.indexOf(text0)
      selectionTo = selectionFrom + text0.length
      break
    }
    case 'unorderedList': {
      // Handle multi-line: always work at line level for list operations
      const firstLine = state.doc.lineAt(workFrom)
      const lastLine = state.doc.lineAt(workTo)
      const lines: string[] = []
      for (let i = firstLine.number; i <= lastLine.number; i++) {
        lines.push(state.doc.line(i).text)
      }

      // Check if ALL non-empty lines are already unordered/ordered lists
      const nonEmptyLines = lines.filter(l => l.replace(/^#{1,6}\s*/, '').trim() !== '')
      const allUl = nonEmptyLines.length > 0 && nonEmptyLines.every(l => /^-\s/.test(l.replace(/^#{1,6}\s*/, '')))
      const allOl = nonEmptyLines.length > 0 && nonEmptyLines.every(l => /^\d+\.\s/.test(l.replace(/^#{1,6}\s*/, '')))

      const transformed = lines.map(line => {
        const stripped = line.replace(/^#{1,6}\s*/, '')
        const heading = line.match(/^(#{1,6})\s*/)?.[0] || ''
        // Skip empty lines — don't add list prefix
        if (stripped.trim() === '') return line
        const isUl = /^-\s/.test(stripped)
        const olMatch = stripped.match(/^\d+\.\s/)
        if (allUl) {
          // Remove list from all lines
          return heading + stripped.replace(/^-\s/, '')
        } else if (allOl) {
          // Swap all lines to unordered
          return heading + '- ' + stripped.replace(/^\d+\.\s/, '')
        } else if (isUl) {
          // Remove list
          return heading + stripped.replace(/^-\s/, '')
        } else if (olMatch) {
          // Swap to unordered
          return heading + '- ' + stripped.replace(/^\d+\.\s/, '')
        } else {
          // Add unordered
          return heading + '- ' + stripped
        }
      })

      insert = transformed.join('\n')
      workFrom = firstLine.from
      workTo = lastLine.to
      selectionFrom = workFrom
      selectionTo = workFrom + insert.length
      break
    }
    case 'orderedList': {
      // Handle multi-line: always work at line level for list operations
      const firstLine = state.doc.lineAt(workFrom)
      const lastLine = state.doc.lineAt(workTo)
      const lines: string[] = []
      for (let i = firstLine.number; i <= lastLine.number; i++) {
        lines.push(state.doc.line(i).text)
      }

      // Check if ALL non-empty lines are already ordered/unordered lists
      const nonEmptyLines = lines.filter(l => l.replace(/^#{1,6}\s*/, '').trim() !== '')
      const allOl = nonEmptyLines.length > 0 && nonEmptyLines.every(l => /^\d+\.\s/.test(l.replace(/^#{1,6}\s*/, '')))
      const allUl = nonEmptyLines.length > 0 && nonEmptyLines.every(l => /^-\s/.test(l.replace(/^#{1,6}\s*/, '')))

      let counter = 1
      const transformed = lines.map(line => {
        const stripped = line.replace(/^#{1,6}\s*/, '')
        const heading = line.match(/^(#{1,6})\s*/)?.[0] || ''
        // Skip empty lines — don't add list prefix
        if (stripped.trim() === '') return line
        const isUl = /^-\s/.test(stripped)
        const olMatch = stripped.match(/^\d+\.\s/)
        if (allOl) {
          // Remove list from all lines
          return heading + stripped.replace(/^\d+\.\s/, '')
        } else if (allUl) {
          // Swap all lines to ordered
          return heading + `${counter++}. ` + stripped.replace(/^-\s/, '')
        } else if (olMatch) {
          // Remove list
          return heading + stripped.replace(/^\d+\.\s/, '')
        } else if (isUl) {
          // Swap to ordered
          return heading + `${counter++}. ` + stripped.replace(/^-\s/, '')
        } else {
          // Add ordered
          return heading + `${counter++}. ` + stripped
        }
      })

      insert = transformed.join('\n')
      workFrom = firstLine.from
      workTo = lastLine.to
      selectionFrom = workFrom
      selectionTo = workFrom + insert.length
      break
    }
    case 'horizontalRule': {
      insert = `\n---\n`
      selectionFrom = workFrom + 5
      selectionTo = workFrom + 5
      break
    }
    case 'table': {
      const [rows, cols] = (_text || '3x3').split('x').map(Number)
      const header = '| ' + Array.from({ length: cols }, (_, i) => `col${i + 1} `).join('| ') + '|'
      const separator = '| ' + Array.from({ length: cols }, () => '--- ').join('| ') + '|'
      const dataRows = Array.from({ length: Math.max(0, rows - 1) }, () => {
        return '| ' + Array.from({ length: cols }, () => 'cell ').join('| ') + '|'
      })
      insert = '\n' + [header, separator, ...dataRows].join('\n') + '\n'
      selectionFrom = workFrom + 3
      selectionTo = workFrom + 3 + 'col1'.length
      break
    }
    case 'paste': {
      insert = _text || ''
      selectionFrom = workFrom + insert.length
      selectionTo = workFrom + insert.length
      break
    }
    case 'alignLeft':
    case 'alignCenter':
    case 'alignRight': {
      const alignValue = type === 'alignLeft' ? 'left' : type === 'alignCenter' ? 'center' : 'right'

      // Check current alignment
      const alignRegex = /^<div align="(left|center|right)">/
      const hasAlignment = alignRegex.test(textWithoutHeading)

      if (hasAlignment) {
        const currentAlign = textWithoutHeading.match(alignRegex)![1]
        if (currentAlign === alignValue) {
          // Same alignment: remove it (unwrap)
          insert = textWithoutHeading.replace(alignRegex, '').replace(/<\/div>$/, '')
        } else {
          // Different alignment: swap
          insert = textWithoutHeading.replace(alignRegex, `<div align="${alignValue}">`)
        }
      } else {
        // No alignment: add it
        insert = `<div align="${alignValue}">${textWithoutHeading}</div>`
      }

      if (currentLevel > 0) {
        insert = `${'#'.repeat(currentLevel)} ${insert}`
      }
      selectionFrom = workFrom
      selectionTo = workFrom + insert.length
      break
    }
    case 'image-gallery': {
      openGalleryDialog()
      return
    }
    case 'focus-editor': {
      editorView.value?.focus()
      return
    }
  }

  editorView.value.dispatch({
    changes: { from: workFrom, to: workTo, insert },
    selection: { anchor: selectionFrom, head: selectionTo },
  })

  editorView.value.focus()

  // Refresh active formats so context menu buttons update immediately
  refreshActiveFormats(editorView.value, type)
}

function refreshActiveFormats(_view: any, actionType: string) {
  const cur = activeFormats.value

  if (['bold', 'italic', 'underline', 'strikethrough', 'code'].includes(actionType)) {
    activeFormats.value = { ...cur, [actionType]: !cur[actionType as keyof ActiveFormats] }
  } else if (actionType.startsWith('heading')) {
    const level = parseInt(actionType.replace('heading', ''), 10) as 1 | 2 | 3 | 4 | 5 | 6
    activeFormats.value = { ...cur, heading: cur.heading === level ? 0 : level }
  } else if (['alignLeft', 'alignCenter', 'alignRight'].includes(actionType)) {
    const target = actionType === 'alignLeft' ? 'left' : actionType === 'alignCenter' ? 'center' : 'right' as 'left' | 'center' | 'right'
    activeFormats.value = { ...cur, alignment: cur.alignment === target ? null : target }
  } else if (actionType === 'unorderedList') {
    activeFormats.value = { ...cur, listType: cur.listType === 'ul' ? null : 'ul' }
  } else if (actionType === 'orderedList') {
    activeFormats.value = { ...cur, listType: cur.listType === 'ol' ? null : 'ol' }
  }
}

// Expose methods to parent
defineExpose({
  undo,
  redo,
  insertText,
  scrollToLine,
  focus,
  editorView,
  selectedText,
})

// Emit editor view when ready
setTimeout(() => {
  if (editorView.value) {
    emit('editor-ready', editorView.value)
  }
}, 100)
</script>

<style scoped>
.editor-pane {
  height: 100%;
  overflow: hidden;
}

.editor-container {
  height: 100%;
}

.editor-container :deep(.cm-editor) {
  height: 100%;
}

.editor-pane.drag-active {
  outline: 2px dashed var(--accent-color);
  outline-offset: -4px;
  background: color-mix(in srgb, var(--accent-color) 5%, transparent);
}
</style>
