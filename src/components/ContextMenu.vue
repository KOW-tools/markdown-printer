<template>
  <Teleport to="body">
    <div
      v-if="visible && mode === 'normal'"
      ref="menuRef"
      class="context-menu"
      :style="{ left: `${adjustedX}px`, top: `${adjustedY}px` }"
      @click.stop
    >
      <div class="icon-row">
        <Button :severity="activeFormats?.bold ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('bold')" title="Bold">
          <template #icon>
            <Bold :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.italic ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('italic')" title="Italic">
          <template #icon>
            <Italic :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.underline ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('underline')" title="Underline">
          <template #icon>
            <Underline :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.strikethrough ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('strikethrough')" title="Strikethrough">
          <template #icon>
            <Strikethrough :size="16" />
          </template>
        </Button>
      </div>
      <div class="icon-row">
        <Button
          v-for="level in 6"
          :key="level"
          :severity="activeFormats?.heading === level ? 'info' : 'contrast'"
          size="small" variant="outlined"
          @click="handleAction(`heading${level}`)"
          :title="`Heading ${level}`"
        >
          <template #icon>
            <component :is="headingComponents[level - 1]" :size="16" />
          </template>
        </Button>
      </div>
      <div class="icon-row">
        <Button :severity="activeFormats?.listType === 'ul' ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('unorderedList')" title="Unordered List">
          <template #icon>
            <List :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.listType === 'ol' ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('orderedList')" title="Ordered List">
          <template #icon>
            <ListOrdered :size="16" />
          </template>
        </Button>
      </div>
      <div class="icon-row">
        <Button :severity="activeFormats?.alignment === 'left' ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('alignLeft')" title="Align Left">
          <template #icon>
            <TextAlignStart :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.alignment === 'center' ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('alignCenter')" title="Align Center">
          <template #icon>
            <TextAlignCenter :size="16" />
          </template>
        </Button>
        <Button :severity="activeFormats?.alignment === 'right' ? 'info' : 'contrast'" size="small" variant="outlined" @click="handleAction('alignRight')" title="Align Right">
          <template #icon>
            <TextAlignEnd :size="16" />
          </template>
        </Button>
      </div>
      <Divider />
      <div class="text-row">
        <Button severity="contrast" text size="small" @click="handleAction('link')">Link</Button>
        <Button severity="contrast" text size="small" @click="handleAction('image')">Image</Button>
        <Button severity="contrast" text size="small" @click="handleAction('code')">Code</Button>
        <Button severity="contrast" text size="small" @click="handleAction('blockquote')">Blockquote</Button>
        <Button severity="contrast" text size="small" @click="handleAction('horizontalRule')">Horizontal Rule</Button>
        <Button severity="contrast" text size="small" @click="switchToTableMode">Table</Button>
      </div>
    </div>

    <!-- Table picker mode -->
    <div
      v-if="visible && mode === 'table'"
      ref="tableMenuRef"
      class="context-menu table-picker"
      :style="{ left: `${adjustedX}px`, top: `${adjustedY}px` }"
      @click.stop
    >
      <div
        class="table-grid"
        @mouseleave="hoverRows = 0; hoverCols = 0"
      >
        <div
          v-for="row in 7"
          :key="row"
          class="table-grid-row"
        >
          <div
            v-for="col in 7"
            :key="col"
            class="table-cell"
            :class="{ selected: row <= hoverRows && col <= hoverCols }"
            @mouseenter="onTableCellHover(row, col)"
            @click="insertTable(row, col)"
          ></div>
        </div>
      </div>
      <div class="table-size-label">
        <template v-if="hoverRows > 0 && hoverCols > 0">
          {{ hoverRows }} × {{ hoverCols }}
        </template>
        <template v-else>&nbsp;</template>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, markRaw } from 'vue'
import Button from 'primevue/button'
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  TextAlignStart,
  TextAlignCenter,
  TextAlignEnd,
} from '@lucide/vue'
import Divider from 'primevue/divider'

interface ActiveFormats {
  bold: boolean
  italic: boolean
  underline: boolean
  strikethrough: boolean
  heading: 0 | 1 | 2 | 3 | 4 | 5 | 6
  alignment: 'left' | 'center' | 'right' | null
  listType: 'ul' | 'ol' | null
}

const props = defineProps<{
  visible: boolean
  x: number
  y: number
  selectedText?: string
  activeFormats?: ActiveFormats
}>()

const emit = defineEmits<{
  action: [type: string, value?: string]
  close: []
}>()

const headingComponents = [
  markRaw(Heading1),
  markRaw(Heading2),
  markRaw(Heading3),
  markRaw(Heading4),
  markRaw(Heading5),
  markRaw(Heading6),
]

const menuRef = ref<HTMLElement | null>(null)
const tableMenuRef = ref<HTMLElement | null>(null)
const adjustedX = ref(0)
const adjustedY = ref(0)

const mode = ref<'normal' | 'table'>('normal')
const hoverRows = ref(0)
const hoverCols = ref(0)

watch(
  () => [props.visible, props.x, props.y],
  async ([isVisible]) => {
    if (isVisible) {
      mode.value = 'normal'
      adjustPosition()
    }
  },
  { immediate: true }
)

async function adjustPosition() {
  adjustedX.value = props.x + 4
  adjustedY.value = props.y + 4

  await nextTick()

  const refToUse = mode.value === 'table' ? tableMenuRef : menuRef
  if (refToUse.value) {
    const rect = refToUse.value.getBoundingClientRect()
    const padding = 8

    if (adjustedX.value + rect.width > window.innerWidth - padding) {
      adjustedX.value = window.innerWidth - rect.width - padding
    }

    if (adjustedY.value + rect.height > window.innerHeight - padding) {
      adjustedY.value = window.innerHeight - rect.height - padding
    }
  }
}

function switchToTableMode() {
  mode.value = 'table'
  hoverRows.value = 0
  hoverCols.value = 0
  adjustPosition()
}

function onTableCellHover(row: number, col: number) {
  hoverRows.value = row
  hoverCols.value = col
}

function insertTable(rows: number, cols: number) {
  emit('action', 'table', `${rows}x${cols}`)
  emit('close')
}

function handleAction(type: string) {
  emit('action', type, props.selectedText)
  emit('close')
}

function handleClickOutside(e: MouseEvent) {
  if (props.visible) {
    emit('close')
  }
}

function handleEscape(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.visible) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleEscape)
})
</script>

<style scoped>
.context-menu {
  position: fixed;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 6px;
  padding: 4px 0;
  z-index: 1000;
  min-width: 160px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.icon-row {
  display: flex;
  gap: 2px;
  padding: 2px 4px;
}

.text-row {
  display: flex;
  flex-direction: column;
  padding: 2px 4px;
}

.text-row :deep(.p-button) {
  justify-content: flex-start;
}

.table-picker {
  padding: 8px;
  min-width: unset;
}

.table-grid {
  display: inline-flex;
  flex-direction: column;
  gap: 2px;
}

.table-grid-row {
  display: flex;
  gap: 2px;
}

.table-cell {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-color);
  border-radius: 2px;
  cursor: pointer;
  background: transparent;
  transition: background 0.08s ease;
}

.table-cell.selected {
  background: var(--accent-color);
  border-color: var(--accent-color);
}

.table-size-label {
  text-align: center;
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-primary);
  opacity: 0.7;
  min-height: 16px;
}
</style>
