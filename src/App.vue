<template>
  <div class="app">
    <TabBar
      v-if="tabs.length > 0"
      :tabs="tabs"
      :active-tab-id="activeTabId"
      :new-tab-ids="newTabIds"
      @select-tab="activeTabId = $event"
      @close-tab="handleCloseTab"
      @rename-tab="renameTab"
      @add-tab="handleAddTab"
      @open-privacy="showPrivacy = true"
    />

    <template v-if="activeTabId">
      <Toolbar
        v-if="!isNewTab"
        :page-size="settings.pageSize"
        :font="settings.font"
        :rtl="settings.rtl"
        :soft-wrap="settings.softWrap"
        :margin="settings.margin"
        :orientation="settings.orientation"
        :content-scale="settings.contentScale"
        :content="activeTab?.content || ''"
        :rendered-html="renderedHtml"
        :is-generating="isGenerating"
        :view-mode="settings.viewMode"
        @update:pageSize="settings.pageSize = $event"
        @update:font="settings.font = $event"
        @update:rtl="settings.rtl = $event"
        @update:softWrap="settings.softWrap = $event"
        @update:margin="settings.margin = $event"
        @update:orientation="settings.orientation = $event"
        @update:contentScale="settings.contentScale = $event"
        @undo="editorRef?.undo()"
        @redo="editorRef?.redo()"
        @insert-page-break="insertPageBreak"
        @download-pdf="() => downloadPDF(previewRef?.assembledHtml || renderedHtml, settings.pageSize, settings.margin, settings.orientation, settings.font, settings.fontSize, settings.contentScale, settings.rtl)"
      />

      <NewPage
        v-if="isNewTab"
        @create-new="startWriting"
        @open-tab="(tab) => openHistoryTab(tab)"
        @upload-file="(content, name) => activateTabWithContent(content, name)"
      />

      <template v-else>
        <div class="main-content">
          <EditorPane
            v-show="settings.viewMode !== 'preview'"
            ref="editorRef"
            v-model="editorContent"
            :soft-wrap="settings.softWrap"
            :tab-id="activeTabId"
            class="editor-section"
            :class="{ 'full-width': settings.viewMode !== 'split' }"
            @editor-ready="onEditorReady"
            @update:selectedText="selectedText = $event"
          />

          <div v-if="settings.viewMode === 'split'" class="divider"></div>

          <PreviewPane
            v-show="settings.viewMode !== 'editor'"
            ref="previewRef"
            :html="renderedHtml"
            :page-size="settings.pageSize"
            :scale="settings.scale"
            :font="settings.font"
            :font-size="settings.fontSize"
            :content-scale="settings.contentScale"
            :rtl="settings.rtl"
            :margin="settings.margin"
            :orientation="settings.orientation"
            :container-width="previewContainerWidth"
            class="preview-section"
            :class="{ 'full-width': settings.viewMode !== 'split' }"
            @preview-click="onPreviewClick"
            @update:scale="settings.scale = $event"
          />
        </div>

        <FooterBar
          :content="activeTab?.content || ''"
          :selected-text="selectedText"
          :scale="settings.scale"
          :page-size="settings.pageSize"
          :orientation="settings.orientation"
          :view-mode="settings.viewMode"
          :container-width="previewContainerWidth"
          :llm-enabled="llmEnabled"
          :llm-connected="llmConnected"
          :llm-model="llmModel"
          @update:scale="settings.scale = $event"
          @update:viewMode="settings.viewMode = $event"
          @open-ai-settings="showAiSettings = true"
        />
      </template>
    </template>

    <PrivacyPolicy v-model="showPrivacy" />
    <AiSettings v-model="showAiSettings" @saved="refreshLlmState" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import TabBar from './components/TabBar.vue'
import NewPage from './components/NewPage.vue'
import Toolbar from './components/Toolbar.vue'
import EditorPane from './components/EditorPane.vue'
import PreviewPane from './components/PreviewPane.vue'
import FooterBar from './components/FooterBar.vue'
import AiSettings from './components/AiSettings.vue'
import PrivacyPolicy from './components/PrivacyPolicy.vue'
import { useTabs } from './composables/useTabs'
import { useMarkdown } from './composables/useMarkdown'
import { useScrollSync } from './composables/useScrollSync'
import { usePDF } from './composables/usePDF'
import { useImages } from './composables/useImages'
import { loadSettings, saveSettings, loadLlmConfig, isLlmEnabled } from './utils/storage'
import { PAGE_SIZES, getScaleRange, getContentScaleFactor } from './utils/constants'
import type { EditorSettings, Tab } from './utils/types'

// Tab management
const {
  tabs, activeTabId, createTab, closeTab, renameTab,
  updateTabContent, getActiveTab,
  replaceTabWithHistory,
} = useTabs()
const { loadImages } = useImages()

// Active tab content
const activeTab = computed(() => getActiveTab())
const editorContent = ref(activeTab.value?.content || '')
const newTabIds = ref(new Set<string>())
const showPrivacy = ref(false)
const showAiSettings = ref(false)
const llmEnabled = ref(false)
const llmConnected = ref(false)
const llmModel = ref('')

const isNewTab = computed(() => {
  if (!activeTabId.value) return false
  return newTabIds.value.has(activeTabId.value)
})

// Settings
const defaultScaleRange = getScaleRange(PAGE_SIZES.find(p => p.name === 'A4')!, 'portrait', window.innerWidth / 2)

const previewContainerWidth = computed(() =>
  settings.value.viewMode === 'preview' ? window.innerWidth : window.innerWidth / 2
)

const settings = ref<EditorSettings>({
  pageSize: 'A4',
  scale: defaultScaleRange.default,
  font: 'Open Sans',
  fontSize: 14,
  rtl: false,
  lineNumbers: true,
  margin: { top: '1in', right: '0.75in', bottom: '1in', left: '0.75in' },
  orientation: 'portrait',
  contentScale: 1.0,
  contentScaleMap: {} as Record<string, number>,
  softWrap: true,
  viewMode: window.innerWidth < 768 ? 'editor' : 'split',
})

// Load saved settings
onMounted(async () => {
  await loadImages()

  if (activeTabId.value && !getActiveTab()?.content) {
    newTabIds.value.add(activeTabId.value)
  }

  const saved = loadSettings()
  settings.value = { ...settings.value, ...saved }
  if (!settings.value.contentScaleMap) {
    settings.value.contentScaleMap = {}
  }
  PAGE_SIZES.forEach(p => {
    settings.value.contentScaleMap![p.name] = getContentScaleFactor(p)
  })
  const current = PAGE_SIZES.find(p => p.name === settings.value.pageSize)
  if (current) {
    settings.value.contentScale = settings.value.contentScaleMap![current.name]
  }

  await refreshLlmState()
})

// Save settings on change
watch(settings, (newSettings) => {
  saveSettings(newSettings)
}, { deep: true })

async function refreshLlmState() {
  llmEnabled.value = isLlmEnabled()
  const config = await loadLlmConfig()
  llmConnected.value = !!(config?.endpoint && config?.apiKey)
  llmModel.value = config?.model || ''
}

function recalcScaleToFit() {
  const size = PAGE_SIZES.find(p => p.name === settings.value.pageSize)
  if (size) {
    const range = getScaleRange(size, settings.value.orientation, previewContainerWidth.value)
    settings.value.scale = range.default
    if (!settings.value.contentScaleMap) {
      settings.value.contentScaleMap = {}
    }
    if (!(size.name in settings.value.contentScaleMap)) {
      settings.value.contentScaleMap[size.name] = getContentScaleFactor(size)
    }
    settings.value.contentScale = settings.value.contentScaleMap[size.name]
  }
}

// Auto-adjust scale when page size or orientation changes
watch(
  () => [settings.value.pageSize, settings.value.orientation],
  recalcScaleToFit,
)

// Auto-adjust scale when switching between split and preview-only
watch(
  () => settings.value.viewMode,
  (mode) => {
    if (mode === 'preview' || mode === 'split') {
      recalcScaleToFit()
    }
  },
)

// Markdown rendering
const { renderedHtml } = useMarkdown(editorContent)

// Editor and preview refs
const editorRef = ref<InstanceType<typeof EditorPane> | null>(null)
const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null)
const selectedText = ref('')

// Scroll sync
const { onPreviewClick } = useScrollSync(
  computed(() => editorRef.value?.editorView || null),
  computed(() => previewRef.value?.container || null),
)

// PDF download
const { download: downloadPDF, isGenerating } = usePDF()

// Update active tab content
watch(editorContent, (content) => {
  if (activeTabId.value) {
    updateTabContent(activeTabId.value, content)
  }
})

// Sync editor content when tab changes
watch(activeTabId, () => {
  const tab = getActiveTab()
  if (tab) {
    editorContent.value = tab.content
  }
})

// Insert page break
function insertPageBreak() {
  editorRef.value?.insertText('\n<div style="page-break-after: always;"></div>\n')
}

function handleAddTab() {
  const tab = createTab()
  newTabIds.value.add(tab.id)
}

// Start writing in current new tab
function startWriting() {
  if (activeTabId.value) {
    newTabIds.value.delete(activeTabId.value)
    renameTab(activeTabId.value, 'Untitled')
    editorContent.value = ''
  }
}

// Activate tab with uploaded content
function activateTabWithContent(content: string, name: string) {
  if (activeTabId.value) {
    newTabIds.value.delete(activeTabId.value)
    renameTab(activeTabId.value, name)
    updateTabContent(activeTabId.value, content)
    editorContent.value = content
  }
}

// Open history tab: switch if already open, otherwise load into current new tab
function openHistoryTab(historyTab: Tab) {
  const existing = tabs.value.find(t => t.id === historyTab.id)
  if (existing) {
    activeTabId.value = existing.id
  } else if (activeTabId.value) {
    newTabIds.value.delete(activeTabId.value)
    replaceTabWithHistory(activeTabId.value, historyTab)
    editorContent.value = historyTab.content
  }
}

// Editor ready callback
function onEditorReady() {}

function handleCloseTab(id: string) {
  newTabIds.value.delete(id)
  const wasLastTab = tabs.value.length === 1
  closeTab(id)
  if (wasLastTab && activeTabId.value) {
    newTabIds.value.add(activeTabId.value)
  }
}
</script>

<style scoped>
.app {
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.editor-section {
  flex: 1;
  min-width: 0;
}

.divider {
  width: 1px;
  background: var(--border-color);
}

.preview-section {
  flex: 1;
  min-width: 0;
}

.full-width {
  flex: 1;
}
</style>
