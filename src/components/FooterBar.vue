<template>
  <div class="footer-bar">
    <div class="footer-left" v-show="viewMode !== 'preview'">
      <span class="stat">{{ wordCount }} words</span>
      <span class="separator">|</span>
      <span class="stat">{{ charCount }} chars</span>
    </div>
    <span class="separator" v-show="viewMode !== 'preview'">|</span>
    <div class="footer-spacer"></div>
    <div class="footer-right">
      <div class="scale-control" v-show="viewMode !== 'editor'">
        <Button severity="secondary" text size="small" class="scale-btn" @click="decrement" :disabled="scale <= scaleRange.min">
          <ZoomOut :size="14" />
        </Button>
        <Slider
          :modelValue="scale"
          :min="scaleRange.min"
          :max="scaleRange.max"
          :step="0.01"
          @update:modelValue="$emit('update:scale', Array.isArray($event) ? $event[0] : $event)"
          class="scale-slider"
        />
        <Button severity="secondary" text size="small" class="scale-btn" @click="increment" :disabled="scale >= scaleRange.max">
          <ZoomIn :size="14" />
        </Button>
        <span class="scale-label">{{ Math.round(scale * 100) }}%</span>
      </div>
      <div class="view-mode-control">
        <Button
          :severity="viewMode === 'editor' ? 'info' : 'secondary'"
          text
          size="small"
          class="view-mode-btn"
          @click="$emit('update:viewMode', 'editor')"
          title="Editor only"
        >
          <FileEdit :size="14" />
        </Button>
        <Button
          :severity="viewMode === 'preview' ? 'info' : 'secondary'"
          text
          size="small"
          class="view-mode-btn"
          @click="$emit('update:viewMode', 'preview')"
          title="Preview only"
        >
          <Eye :size="14" />
        </Button>
        <Button
          :severity="viewMode === 'split' ? 'info' : 'secondary'"
          text
          size="small"
          class="view-mode-btn"
          @click="$emit('update:viewMode', 'split')"
          title="Side by side"
        >
          <Columns2 :size="14" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { PAGE_SIZES, getScaleRange } from '../utils/constants'
import type { ViewMode } from '../utils/types'
import { ZoomIn, ZoomOut, FileEdit, Eye, Columns2 } from '@lucide/vue'
import Button from 'primevue/button'
import Slider from 'primevue/slider'

const props = defineProps<{
  content: string
  selectedText: string
  scale: number
  pageSize: string
  orientation: 'portrait' | 'landscape'
  viewMode: ViewMode
  containerWidth: number
}>()

const emit = defineEmits<{
  'update:scale': [value: number]
  'update:viewMode': [value: ViewMode]
}>()

function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '')
}

const effectiveContent = computed(() => props.selectedText || props.content)

const wordCount = computed(() => {
  const text = stripHtml(effectiveContent.value).replace(/[#*`~\[\]()>_\-|]/g, ' ').trim()
  return text ? text.split(/\s+/).length : 0
})

const charCount = computed(() => effectiveContent.value.length)

const currentPageSize = computed(() => PAGE_SIZES.find(p => p.name === props.pageSize) || PAGE_SIZES[0])
const scaleRange = computed(() => getScaleRange(currentPageSize.value, props.orientation, props.containerWidth))

function increment() {
  const next = Math.round(props.scale * 10 + 1) / 10
  emit('update:scale', Math.min(next, scaleRange.value.max))
}

function decrement() {
  const next = Math.round(props.scale * 10 - 1) / 10
  emit('update:scale', Math.max(next, scaleRange.value.min))
}
</script>

<style scoped>
.footer-bar {
  display: flex;
  align-items: center;
  padding: 4px 12px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
  font-size: 11px;
  color: var(--text-primary);
  opacity: 0.8;
  min-height: 28px;
  flex-shrink: 0;
}

.footer-spacer {
  flex: 1;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.stat {
  text-align: center;
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.separator {
  color: var(--border-color);
}

.view-mode-control {
  display: flex;
  align-items: center;
  gap: 2px;
}

.view-mode-btn {
  min-width: 22px;
  height: 22px;
  padding: 0 4px;
}

.scale-control {
  display: flex;
  align-items: center;
  gap: 4px;
}

.scale-btn {
  min-width: 20px;
  height: 20px;
  padding: 0 4px;
  font-size: 13px;
  line-height: 1;
}

.scale-slider {
  width: 80px;
}

.scale-label {
  min-width: 3em;
  text-align: right;
}
</style>
