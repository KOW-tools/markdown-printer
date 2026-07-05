<template>
  <div class="tab-bar">
    <div class="tabs-container" @dblclick="handleContainerDblClick">
      <img :src="faviconUrl" alt="Markdown Printer" class="tabs-favicon" />
      <TransitionGroup name="tab" tag="div" class="tabs-inner">
        <TabItem
          v-for="tab in tabs"
          :key="tab.id"
          :tab="tab"
          :is-active="tab.id === activeTabId"
          :closable="tabs.length > 1 || !newTabIds.has(tab.id)"
          :is-new-tab="newTabIds.has(tab.id)"
          @select="$emit('select-tab', tab.id)"
          @close="$emit('close-tab', tab.id)"
          @rename="(name) => $emit('rename-tab', tab.id, name)"
        />
      </TransitionGroup>
      <Button severity="secondary" text size="small" class="add-tab-btn" @click="$emit('add-tab')" title="New tab">
        <Plus :size="14" />
      </Button>
    </div>
    <Button severity="secondary" text size="small" class="icon-btn" @click="toggleTheme" :title="themeLabel">
      <Sun v-if="themeMode === 'light'" :size="16" />
      <Moon v-else-if="themeMode === 'dark'" :size="16" />
      <Monitor v-else :size="14" />
    </Button>
    <Button severity="secondary" text size="small" class="icon-btn" @click="showAbout = true" title="About">
      <Info :size="14" />
    </Button>

    <Dialog v-model:visible="showAbout" header="About" modal :closable="true" :style="{ maxWidth: '90vw' }">
      <div class="about-content">
        <div class="about-header">
          <img :src="faviconUrl" alt="Markdown Printer" class="about-favicon" />
          <h2 class="about-title">Markdown Printer</h2>
        </div>
        <p class="about-desc">A paged markdown previewer that brings markdown to real-world paper. Write in markdown, preview with pagination, and print or export to PDF — exactly as it will appear on paper.</p>
        <p class="about-license">Released under the Apache 2.0 License.</p>
        <div class="about-actions">
          <Button severity="secondary" outlined as="a" href="https://github.com/KOW-tools/markdown-printer" target="_blank" rel="noopener noreferrer" class="about-link">
            <ExternalLink :size="16" />
            View Source Code
          </Button>
          <Button severity="secondary" outlined class="about-link" @click="showAbout = false; $emit('open-privacy')">
            <Shield :size="16" />
            Privacy Policy
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Tab } from '../utils/types'
import TabItem from './TabItem.vue'
import { Plus, Sun, Moon, Monitor, Info, ExternalLink, Shield } from '@lucide/vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import faviconUrl from '/favicon.svg?url'

defineProps<{
  tabs: Tab[]
  activeTabId: string | null
  newTabIds: Set<string>
}>()

const emit = defineEmits<{
  'select-tab': [id: string]
  'close-tab': [id: string]
  'rename-tab': [id: string, name: string]
  'add-tab': []
  'open-privacy': []
}>()

function handleContainerDblClick(e: MouseEvent) {
  if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('tabs-inner')) {
    emit('add-tab')
  }
}

const themeMode = ref<'light' | 'dark' | 'system'>('system')
const showAbout = ref(false)
let systemQuery: MediaQueryList | null = null
let handleSystemChange: ((e: MediaQueryListEvent) => void) | null = null

const themeLabel = computed(() => {
  if (themeMode.value === 'light') return 'Light mode'
  if (themeMode.value === 'dark') return 'Dark mode'
  return 'System theme'
})

function applyTheme(mode: 'light' | 'dark' | 'system') {
  document.documentElement.classList.remove('dark', 'light')
  if (mode === 'dark') {
    document.documentElement.classList.add('dark')
  } else if (mode === 'light') {
    document.documentElement.classList.add('light')
  } else {
    // System mode: mirror actual system preference so PrimeVue reacts
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.add(isDark ? 'dark' : 'light')
  }
}

function onSystemPreferenceChange(e: MediaQueryListEvent) {
  if (themeMode.value !== 'system') return
  document.documentElement.classList.remove('dark', 'light')
  document.documentElement.classList.add(e.matches ? 'dark' : 'light')
}

onMounted(() => {
  const saved = localStorage.getItem('theme') as 'light' | 'dark' | 'system' | null
  themeMode.value = saved || 'system'
  applyTheme(themeMode.value)

  systemQuery = window.matchMedia('(prefers-color-scheme: dark)')
  handleSystemChange = onSystemPreferenceChange
  systemQuery.addEventListener('change', handleSystemChange)
})

onUnmounted(() => {
  if (systemQuery && handleSystemChange) {
    systemQuery.removeEventListener('change', handleSystemChange)
  }
})

function toggleTheme() {
  const order: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
  const next = order[(order.indexOf(themeMode.value) + 1) % 3]
  themeMode.value = next
  applyTheme(next)
  localStorage.setItem('theme', next)
}
</script>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  height: 36px;
}

.tabs-container {
  display: flex;
  flex: 1;
  align-items: center;
  overflow-x: auto;
}

.tabs-container::-webkit-scrollbar {
  height: 0;
}

.tabs-inner {
  display: flex;
  flex: 1;
}

.add-tab-btn {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.icon-btn {
  width: 32px;
  height: 36px;
  flex-shrink: 0;
}

.tabs-favicon {
  width: 32px;
  height: 32px;
  padding: 0 4px;
  box-sizing: content-box;
}

/* Tab transition animations */
.tab-enter-active {
  transition: all 0.2s ease-out;
}

.tab-leave-active {
  transition: all 0.15s ease-in;
}

.tab-enter-from {
  opacity: 0;
  transform: scaleX(0);
  max-width: 0;
  min-width: 0;
  padding-left: 0;
  padding-right: 0;
}

.tab-enter-to {
  opacity: 1;
  transform: scaleX(1);
  max-width: 200px;
}

.tab-leave-from {
  opacity: 1;
  max-width: 200px;
}

.tab-leave-to {
  opacity: 0;
  transform: scaleX(0);
  max-width: 0;
  min-width: 0;
  padding-left: 0;
  padding-right: 0;
  border-right-width: 0;
}

.about-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 640px;
}

.about-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.about-favicon {
  width: 64px;
  height: 64px;
}

.about-title {
  font-size: 32px;
  font-weight: 400;
  margin: 0;
  color: var(--text-primary);
}

.about-desc {
  margin: 0;
  color: var(--text-primary);
  opacity: 0.8;
  line-height: 1.5;
}

.about-author {
  margin: 0;
  color: var(--text-primary);
}

.about-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.about-link {
  text-decoration: none;
}
</style>
