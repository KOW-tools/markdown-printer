<template>
  <div class="toolbar">
    <div class="toolbar-scroll">
      <div class="toolbar-left" v-show="viewMode !== 'preview'">
        <Button severity="info" text size="small" @click="$emit('undo')" title="Undo (Ctrl+Z)">
          <Undo2 :size="16" />
        </Button>
        <Button severity="info" text size="small" @click="$emit('redo')" title="Redo (Ctrl+Shift+Z)">
          <Redo2 :size="16" />
        </Button>
        <span class="separator"></span>
        <Button severity="info" text size="small" @click="$emit('insert-page-break')" title="Insert page break">
          <StickyNotePlus :size="16" />
        </Button>
        <span class="separator"></span>
        <Button
          severity="info"
          text
          size="small"
          @click="$emit('update:rtl', !rtl)"
          :title="rtl ? 'Switch to LTR' : 'Switch to RTL'"
        >
          <TextAlignEnd v-if="rtl" :size="16" />
          <TextAlignStart v-else :size="16" />
        </Button>
        <Button
          :severity="softWrap ? 'info' : 'contrast'"
          text
          size="small"
          @click="$emit('update:softWrap', !softWrap)"
          title="Toggle soft wrap"
        >
          <WrapText :size="16" />
        </Button>
      </div>

      <div class="toolbar-center" v-show="viewMode !== 'editor'">
        <MarginPicker
          :model-value="margin"
          :page-size="pageSize"
          :orientation="orientation"
          @update:model-value="$emit('update:margin', $event)"
        />

        <!-- Orientation toggle -->
        <Button
          severity="info"
          text
          size="small"
          @click="$emit('update:orientation', orientation === 'portrait' ? 'landscape' : 'portrait')"
          :title="orientation === 'portrait' ? 'Switch to Landscape' : 'Switch to Portrait'"
        >
          <RectangleVertical v-if="orientation === 'portrait'" :size="16" />
          <RectangleHorizontal v-else :size="16" />
        </Button>

        <span class="separator"></span>

        <PageSizeSelector :model-value="pageSize" @update:model-value="$emit('update:pageSize', $event)" />
        <FontPicker :model-value="font" @update:model-value="$emit('update:font', $event)" />

        <!-- Content scale slider (A4-relative: 100% = A4 base) -->
        <div class="content-scale-control">
          <span class="content-scale-label">Aa</span>
          <Button
            severity="info"
            text
            size="small"
            class="content-scale-btn"
            @click="$emit('update:contentScale', Math.max(scaleRange.min, contentScale - 0.01))"
            title="Decrease scale"
          >
            <Minus :size="16" />
          </Button>
          <Slider
            :modelValue="displayScale"
            :min="Math.round(scaleRange.min * 100)"
            :max="Math.round(scaleRange.max * 100)"
            :step="1"
            class="content-scale-slider"
            @update:modelValue="$emit('update:contentScale', (Array.isArray($event) ? $event[0] : $event) / 100)"
          />
          <Button
            severity="info"
            text
            size="small"
            class="content-scale-btn"
            @click="$emit('update:contentScale', Math.min(scaleRange.max, contentScale + 0.01))"
            title="Increase scale"
          >
            <Plus :size="16" />
          </Button>
          <span class="content-scale-value">{{ displayScale }}%</span>
          <Button
            severity="info"
            text
            size="small"
            class="content-scale-reset"
            @click="resetContentScale"
            title="Reset to default"
          >
            <RotateCcw :size="16" />
          </Button>
        </div>
      </div>
    </div>

    <DownloadMenu
      :content="content"
      :rendered-html="renderedHtml"
      :is-generating="isGenerating"
      @download-pdf="$emit('download-pdf')"
      class="toolbar-print"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'
import type { MarginConfig, ViewMode } from '../utils/types'
import { PAGE_SIZES, getContentScaleRange } from '../utils/constants'
import { Undo2, Redo2, TextAlignStart, TextAlignEnd, RectangleVertical, RectangleHorizontal, StickyNotePlus, WrapText, Plus, Minus, RotateCcw } from '@lucide/vue'
import MarginPicker from './MarginPicker.vue'
import PageSizeSelector from './PageSizeSelector.vue'
import FontPicker from './FontPicker.vue'
import DownloadMenu from './DownloadMenu.vue'

const props = defineProps<{
  pageSize: string
  font: string
  rtl: boolean
  softWrap: boolean
  content: string
  renderedHtml: string
  isGenerating: boolean
  margin: MarginConfig
  orientation: 'portrait' | 'landscape'
  contentScale: number
  viewMode: ViewMode
}>()

const emit = defineEmits<{
  'update:pageSize': [value: string]
  'update:font': [value: string]
  'update:rtl': [value: boolean]
  'update:softWrap': [value: boolean]
  'update:margin': [value: MarginConfig]
  'update:orientation': [value: 'portrait' | 'landscape']
  'update:contentScale': [value: number]
  'undo': []
  'redo': []
  'insert-page-break': []
  'download-pdf': []
}>()

const scaleRange = computed(() => {
  const page = PAGE_SIZES.find(p => p.name === props.pageSize)
  return page ? getContentScaleRange(page) : { min: 0.01, max: 2.0, default: 1.0 }
})

const displayScale = computed(() => Math.round(props.contentScale * 100))

function resetContentScale() {
  emit('update:contentScale', scaleRange.value.default)
}
</script>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-info);
  border-bottom: 1px solid var(--border-color);
  gap: 8px;
  overflow: hidden;
}

.toolbar-scroll {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  overflow-x: auto;
  overflow-y: hidden;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.toolbar-scroll::-webkit-scrollbar {
  display: none;
}

.toolbar-print {
  flex-shrink: 0;
  margin-left: auto;
}

.toolbar-left,
.toolbar-center {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.separator {
  width: 1px;
  height: 20px;
  background: var(--border-color);
  flex-shrink: 0;
}

/* Content scale control */
.content-scale-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.content-scale-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  opacity: 0.7;
}

.content-scale-slider {
  width: 60px;
}

.content-scale-value {
  font-size: 11px;
  color: var(--text-primary);
  min-width: 32px;
  text-align: right;
}

.content-scale-btn {
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  font-size: 14px;
  line-height: 1;
}

.content-scale-reset {
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
  font-size: 12px;
  line-height: 1;
  opacity: 0.6;
}

.content-scale-reset:hover {
  opacity: 1;
}

</style>
