<template>
  <div class="preview-pane">
    <div
      ref="previewContainer"
      class="preview-container"
      @click="$emit('preview-click', $event)"
    >
      <div
        v-for="(page, i) in pages"
        :key="i"
        class="page-wrapper"
        :style="pageWrapperStyle"
      >
        <div class="preview-page" :style="pageStyle">
          <div class="preview-content markdown-body" :dir="rtl ? 'rtl' : 'ltr'" v-html="page.elements.join('')"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, toRef, onMounted, onUnmounted } from 'vue'
import { fontFamilyCSS } from '../utils/css'
import { PAGE_SIZES, getScaleRange } from '../utils/constants'
import type { MarginConfig } from '../utils/types'
import { usePagination } from '../composables/usePagination'

const props = defineProps<{
  html: string
  pageSize: string
  scale: number
  font: string
  fontSize: number
  rtl: boolean
  margin: MarginConfig
  orientation: 'portrait' | 'landscape'
  contentScale: number
  containerWidth: number
}>()

const emit = defineEmits<{
  'preview-click': [event: MouseEvent]
  'update:scale': [value: number]
}>()

const previewContainer = ref<HTMLElement | null>(null)

const currentPageSize = computed(() => {
  return PAGE_SIZES.find(p => p.name === props.pageSize) || PAGE_SIZES[0]
})

const scaleRange = computed(() => getScaleRange(currentPageSize.value, props.orientation, props.containerWidth))

// --- Zoom: Ctrl+wheel ---
function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const delta = -Math.sign(e.deltaY)
    const step = 0.05
    const raw = Math.round((props.scale + delta * step) * 100) / 100
    const clamped = Math.max(scaleRange.value.min, Math.min(scaleRange.value.max, raw))
    emit('update:scale', clamped)
  }
}

// --- Zoom: pinch-to-touch ---
let pinchStartDist = 0
let pinchStartScale = 0

function touchDist(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    pinchStartDist = touchDist(e.touches)
    pinchStartScale = props.scale
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2 && pinchStartDist > 0) {
    e.preventDefault()
    const curDist = touchDist(e.touches)
    const ratio = curDist / pinchStartDist
    const raw = Math.round(pinchStartScale * ratio * 100) / 100
    const clamped = Math.max(scaleRange.value.min, Math.min(scaleRange.value.max, raw))
    emit('update:scale', clamped)
  }
}

onMounted(() => {
  const container = previewContainer.value
  if (container) {
    container.addEventListener('wheel', onWheel, { passive: false })
    container.addEventListener('touchstart', onTouchStart, { passive: true })
    container.addEventListener('touchmove', onTouchMove, { passive: false })
  }
})

onUnmounted(() => {
  const container = previewContainer.value
  if (container) {
    container.removeEventListener('wheel', onWheel)
    container.removeEventListener('touchstart', onTouchStart)
    container.removeEventListener('touchmove', onTouchMove)
  }
})

const MM_TO_PX = 96 / 25.4

const pageHeight = computed(() => {
  const size = currentPageSize.value
  const h = props.orientation === 'landscape' ? size.width : size.height
  return parseFloat(h) * MM_TO_PX
})

const htmlRef = toRef(props, 'html')
const scaleRef = toRef(props, 'scale')
const pageHeightRef = pageHeight
const pageSizeRef = toRef(props, 'pageSize')
const marginRef = toRef(props, 'margin')
const fontRef = toRef(props, 'font')
const effectiveFontSize = computed(() => props.fontSize * props.contentScale)

const { pages } = usePagination(htmlRef, pageHeightRef, scaleRef, pageSizeRef, marginRef, fontRef, effectiveFontSize)

const scaledWidth = computed(() => {
  const size = currentPageSize.value
  const w = props.orientation === 'landscape' ? size.height : size.width
  return parseFloat(w) * MM_TO_PX * props.scale
})

const scaledHeight = computed(() => {
  const size = currentPageSize.value
  const h = props.orientation === 'landscape' ? size.width : size.height
  return parseFloat(h) * MM_TO_PX * props.scale
})

const pageWrapperStyle = computed(() => ({
  width: `${scaledWidth.value}px`,
  height: `${scaledHeight.value}px`,
  marginBottom: '20px',
  flexShrink: 0,
  overflow: 'hidden',
  marginLeft: 'auto',
  marginRight: 'auto',
}))

const pageStyle = computed(() => {
  const size = currentPageSize.value
  const width = props.orientation === 'landscape' ? size.height : size.width
  const height = props.orientation === 'landscape' ? size.width : size.height

  return {
    width,
    height,
    fontFamily: `${fontFamilyCSS(props.font)}, sans-serif`,
    fontSize: `${effectiveFontSize.value}px`,
    padding: `${props.margin.top} ${props.margin.right} ${props.margin.bottom} ${props.margin.left}`,
    transform: `scale(${props.scale})`,
    transformOrigin: 'top left',
    background: 'white',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
    overflow: 'hidden',
  }
})

defineExpose({
  container: previewContainer,
})
</script>

<style scoped>
.preview-pane {
  height: 100%;
  overflow: hidden;
  background: var(--bg-secondary);
  display: flex;
  justify-content: center;
  /* Force light mode - preview always renders with white background regardless of system theme */
  color-scheme: light;
}

.preview-pane :deep(*) {
  color-scheme: light;
}

.preview-container {
  height: 100%;
  overflow: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: start;
}

.preview-content {
  width: 100%;
}

.preview-content.markdown-body {
  font-family: inherit;
  font-size: inherit;
}
</style>

<style>
[dir="rtl"].markdown-body ul,
[dir="rtl"].markdown-body ol {
  padding-left: unset;
  padding-right: 2em;
  direction: rtl;
}
</style>
