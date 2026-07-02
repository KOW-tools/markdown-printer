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
import { computed, ref, toRef, onMounted, onUnmounted, watch } from 'vue'
import { fontFamilyCSS } from '../utils/css'
import { PAGE_SIZES, getScaleRange } from '../utils/constants'
import type { MarginConfig } from '../utils/types'
import { usePagination } from '../composables/usePagination'
import { useImages } from '../composables/useImages'

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

const { getImageUrl, images } = useImages()

const previewContainer = ref<HTMLElement | null>(null)

const currentPageSize = computed(() => {
  return PAGE_SIZES.find(p => p.name === props.pageSize) || PAGE_SIZES[0]
})

const scaleRange = computed(() => getScaleRange(currentPageSize.value, props.orientation, props.containerWidth))

// --- Zoom: Ctrl+wheel ---
function onWheel(e: WheelEvent) {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const container = previewContainer.value
    if (!container) return

    const delta = -Math.sign(e.deltaY)
    const step = 0.05
    const raw = Math.round((props.scale + delta * step) * 100) / 100
    const clamped = Math.max(scaleRange.value.min, Math.min(scaleRange.value.max, raw))

    // Capture mouse position relative to container
    const rect = container.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scrollLeft = container.scrollLeft
    const scrollTop = container.scrollTop

    // The point in content space under the mouse cursor
    const contentX = scrollLeft + mouseX
    const contentY = scrollTop + mouseY

    emit('update:scale', clamped)

    // After scale changes, adjust scroll to keep mouse point in place
    const ratio = clamped / props.scale
    container.scrollLeft = contentX * ratio - mouseX
    container.scrollTop = contentY * ratio - mouseY
  }
}

// --- Zoom: pinch-to-touch ---
let pinchStartDist = 0
let pinchStartScale = 0
let pinchStartScrollLeft = 0
let pinchStartScrollTop = 0
let pinchStartRect: DOMRect | null = null
let pinchStartMidX = 0
let pinchStartMidY = 0

function touchDist(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX
  const dy = touches[0].clientY - touches[1].clientY
  return Math.sqrt(dx * dx + dy * dy)
}

function touchMidpoint(touches: TouchList, rect: DOMRect): { x: number; y: number } {
  const midX = (touches[0].clientX + touches[1].clientX) / 2
  const midY = (touches[0].clientY + touches[1].clientY) / 2
  return { x: midX - rect.left, y: midY - rect.top }
}

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 2) {
    pinchStartDist = touchDist(e.touches)
    pinchStartScale = props.scale
    const container = previewContainer.value
    if (container) {
      pinchStartScrollLeft = container.scrollLeft
      pinchStartScrollTop = container.scrollTop
      pinchStartRect = container.getBoundingClientRect()
      const mid = touchMidpoint(e.touches, pinchStartRect)
      pinchStartMidX = mid.x
      pinchStartMidY = mid.y
    }
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2 && pinchStartDist > 0) {
    e.preventDefault()
    const container = previewContainer.value
    if (!container || !pinchStartRect) return

    const curDist = touchDist(e.touches)
    const ratio = curDist / pinchStartDist
    const raw = Math.round(pinchStartScale * ratio * 100) / 100
    const clamped = Math.max(scaleRange.value.min, Math.min(scaleRange.value.max, raw))

    // The point in content space under the pinch midpoint
    const contentX = pinchStartScrollLeft + pinchStartMidX
    const contentY = pinchStartScrollTop + pinchStartMidY

    emit('update:scale', clamped)

    // Adjust scroll to keep pinch midpoint in place
    const scaleRatio = clamped / pinchStartScale
    container.scrollLeft = contentX * scaleRatio - pinchStartMidX
    container.scrollTop = contentY * scaleRatio - pinchStartMidY
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

const resolvedHtml = ref(props.html)

watch(
  [() => props.html, images],
  async () => {
    let html = props.html
    const imgRegex = /<img\s+([^>]*?)src="\.\/([^"]+)"([^>]*?)>/g
    const matches = [...html.matchAll(imgRegex)]

    for (const match of matches) {
      const filename = match[2]
      const img = images.value.find(i => i.name === filename)
      if (img) {
        const url = getImageUrl(img.id) || ''
        html = html.replace(match[0], `<img ${match[1]}src="${url}"${match[3]}>`)
      }
    }

    resolvedHtml.value = html
  },
  { immediate: true }
)

const htmlRef = resolvedHtml
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
  assembledHtml: computed(() => pages.value.map(p => p.elements.join('')).join('')),
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

.markdown-body table {
  display: table !important;
  width: 100% !important;
  table-layout: fixed !important;
}

.markdown-body table td,
.markdown-body table th {
  overflow-wrap: break-word;
  word-wrap: break-word;
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
</style>
