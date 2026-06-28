<template>
  <div class="new-page">
    <div class="new-page-content">
      <span class="title">Markdown Printer</span>

      <div
        class="drop-area"
        @dragover.prevent="isDragging = true"
        @dragleave="isDragging = false"
        @drop.prevent="handleDrop"
        :class="{ dragging: isDragging }"
      >
        <div class="start-box" @click="$emit('create-new')">
          <FileEdit :size="28" />
          <span>New</span>
        </div>

        <div class="upload-box" @click="triggerUpload">
          <Upload :size="28" />
          <span>Open</span>
        </div>
        <input ref="fileInputRef" type="file" accept=".md,.markdown,.txt" @change="handleUpload" hidden />

        <div v-if="isDragging" class="drop-overlay">
          <FileUp :size="40" />
          <span>Drop markdown file here</span>
        </div>
      </div>

      <Button
        severity="secondary"
        text
        class="learn-btn"
        @click="$emit('upload-file', exampleContent, 'Markdown Example')"
      >
        <CircleQuestionMark :size="16" />
        <span>Learn Markdown</span>
      </Button>

      <div v-if="history.length > 0" class="history-section">
        <div class="history-header">
          <h2>History</h2>
          <Button severity="secondary" text size="small" @click="handleClearHistory">
            <Trash2 :size="14" />
          </Button>
        </div>
        <div class="history-list">
          <div
            v-for="tab in history"
            :key="tab.id"
            class="history-item"
            @click="$emit('open-tab', tab)"
          >
            <FileText :size="14" class="history-icon" />
            <div class="history-info">
              <span class="history-name">{{ tab.name }}</span>
              <span class="history-date">{{ formatDate(tab.updatedAt) }}</span>
            </div>
            <button class="history-delete" @click.stop="handleDeleteHistory(tab.id)" title="Remove">
              <X :size="12" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import Button from 'primevue/button'
import type { Tab } from '../utils/types'
import { loadTabHistory, removeTabFromHistory, clearTabHistory } from '../utils/storage'
import { FileEdit, Upload, FileUp, Trash2, FileText, X, CircleQuestionMark } from '@lucide/vue'
import exampleContent from '../EXAMPLE.md?raw'

const emit = defineEmits<{
  'create-new': []
  'open-tab': [tab: Tab]
  'upload-file': [content: string, name: string]
}>()

const fileInputRef = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
const history = ref<Tab[]>([])

onMounted(async () => {
  history.value = await loadTabHistory()
  document.addEventListener('dragenter', onDragEnter)
  document.addEventListener('dragleave', onDragLeave)
  document.addEventListener('drop', onGlobalDrop)
})

async function handleDeleteHistory(id: string) {
  if (!window.confirm('Remove from history?')) return
  await removeTabFromHistory(id)
  history.value = history.value.filter(t => t.id !== id)
}

async function handleClearHistory() {
  if (!window.confirm('Clear all history?')) return
  await clearTabHistory()
  history.value = []
}

onUnmounted(() => {
  document.removeEventListener('dragenter', onDragEnter)
  document.removeEventListener('dragleave', onDragLeave)
  document.removeEventListener('drop', onGlobalDrop)
})

function triggerUpload() {
  fileInputRef.value?.click()
}

async function handleUpload(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const content = await file.text()
  emit('upload-file', content, file.name.replace(/\.(md|markdown|txt)$/, ''))
  input.value = ''
}

function handleDrop(e: DragEvent) {
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (!file) return

  file.text().then(text => {
    emit('upload-file', text, file.name.replace(/\.(md|markdown|txt)$/, ''))
  })
}

let dragCounter = 0

function onDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  isDragging.value = true
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) isDragging.value = false
}

function onGlobalDrop(e: DragEvent) {
  e.preventDefault()
  dragCounter = 0
  isDragging.value = false
  const file = e.dataTransfer?.files[0]
  if (!file) return
  file.text().then(text => {
    emit('upload-file', text, file.name.replace(/\.(md|markdown|txt)$/, ''))
  })
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}
</script>

<style scoped>
.new-page {
  height: 100%;
  display: flex;
  justify-content: center;
  background: var(--bg-primary);
  overflow: scroll;
}

.new-page-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  width: 100%;
  max-width: 800px;
  padding: 64px 16px;
  box-sizing: border-box;
  margin-top: auto;
  margin-bottom: auto;
}

.title {
  width: 100%;
  font-size: 48px;
  margin-bottom: 28px;
  text-align: center;
  color: var(--text-primary);
  opacity: 0.85;
  user-select: none;
}

.drop-area {
  position: relative;
  width: 100%;
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-bottom: 36px;
  padding: 20px;
  border: 2px dashed var(--border-color);
  border-radius: 10px;
  transition: all 0.2s;
}

.drop-area.dragging {
  border-color: var(--accent-color);
  background: rgba(0, 102, 204, 0.05);
}

.start-box,
.upload-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  flex: 1;
  padding: 20px 28px;
  border-radius: 8px;
  cursor: pointer;
  color: var(--text-primary);
  background: var(--bg-secondary);
  transition: all 0.15s;
}

.start-box:hover,
.upload-box:hover {
  background: var(--border-color);
}

.start-box span,
.upload-box span {
  font-size: 13px;
  font-weight: 600;
}

.drop-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: var(--bg-primary);
  border-radius: 8px;
  color: var(--accent-color);
  font-size: 14px;
  font-weight: 600;
}

.learn-btn {
  width: fit-content;
  font-size: 13px;
}

.history-section {
  text-align: left;
  width: 100%;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  user-select: none;
}

.history-header h2 {
  font-size: 14px;
  margin: 0;
  color: var(--text-primary);
  opacity: 0.7;
  user-select: none;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 220px;
  overflow-y: auto;
  padding: 4px;
  box-sizing: border-box;
  border: 2px solid var(--border-color);
  border-radius: 10px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: var(--bg-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.history-item:hover {
  background: var(--border-color);
}

.history-icon {
  flex-shrink: 0;
  color: var(--text-primary);
  opacity: 0.5;
}

.history-info {
  flex: 1;
  min-width: 0;
}

.history-name {
  display: block;
  font-size: 13px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-date {
  font-size: 11px;
  color: var(--text-primary);
  opacity: 0.4;
}

.history-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  opacity: 0;
  padding: 4px;
  border-radius: 3px;
}

.history-item:hover .history-delete {
  opacity: 0.5;
}

.history-delete:hover {
  opacity: 1 !important;
  background: rgba(255, 68, 68, 0.1);
  color: #ff4444;
}
</style>
