<template>
  <Dialog v-model:visible="visible" header="AI Autocomplete Settings" modal :style="{ width: '480px' }">
    <div class="ai-settings">
      <div class="field">
        <label for="ai-endpoint">API Endpoint</label>
        <InputText id="ai-endpoint" v-model="form.endpoint" placeholder="https://api.openai.com" class="w-full" />
      </div>
      <div class="field">
        <label for="ai-apikey">API Key</label>
        <InputText
          id="ai-apikey"
          v-model="form.apiKey"
          type="password"
          :placeholder="hasSavedKey ? '•••••••• (saved)' : 'sk-...'"
          class="w-full"
        />
        <small class="field-hint">Your key is stored locally in your browser and is never shared.</small>
      </div>
      <div class="field">
        <label for="ai-model">Model</label>
        <div class="model-row">
          <Select
            id="ai-model"
            v-model="form.model"
            :options="models"
            option-value="name"
            option-label="name"
            placeholder="Select or type a model"
            class="model-select"
            :loading="fetchingModels"
            :disabled="!form.endpoint || !getEffectiveApiKey()"
            filter
            :filter-fields="['name']"
            :show-clear="false"
          />
          <Button
            icon="pi pi-refresh"
            severity="secondary"
            size="small"
            :loading="fetchingModels"
            :disabled="!form.endpoint || !getEffectiveApiKey()"
            @click="loadModels"
            title="Fetch available models"
          />
        </div>
      </div>
      <div class="field row">
        <label>Enable AI Autocomplete</label>
        <ToggleSwitch v-model="form.enabled" />
      </div>
      <div class="test-row">
        <Button
          label="Test Connection"
          severity="secondary"
          size="small"
          :loading="testing"
          :disabled="!form.endpoint || !getEffectiveApiKey() || !form.model"
          @click="testConnection"
        />
        <span v-if="testResult === 'success'" class="test-success">Connected</span>
        <span v-else-if="testResult === 'error'" class="test-error">{{ testError }}</span>
      </div>
      <div v-if="testResult === 'error' && testError.includes('CORS')" class="cors-hint">
        <strong>CORS Error:</strong> The API server must include <code>Access-Control-Allow-Origin</code> headers to allow browser requests. Contact your API provider to enable CORS.
      </div>
    </div>
    <template #footer>
      <Button label="Cancel" severity="secondary" text @click="visible = false" />
      <Button label="Save" :disabled="!form.endpoint || !getEffectiveApiKey() || !form.model" @click="save" />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import ToggleSwitch from 'primevue/toggleswitch'
import Select from 'primevue/select'
import Button from 'primevue/button'
import { loadLlmConfig, saveLlmConfig, isLlmEnabled, setLlmEnabled } from '../utils/storage'
import { streamCompletion, fetchModels } from '../services/llm'

const visible = defineModel<boolean>({ default: false })

const emit = defineEmits<{
  saved: []
}>()

const form = reactive({
  endpoint: '',
  apiKey: '',
  model: '',
  enabled: false,
})

const models = ref<{ name: string }[]>([])
const fetchingModels = ref(false)
const testing = ref(false)
const testResult = ref<'success' | 'error' | null>(null)
const testError = ref('')
const hasSavedKey = ref(false)
let savedApiKey = ''

watch(visible, async (v) => {
  if (v) {
    testResult.value = null
    testError.value = ''
    models.value = []
    form.apiKey = ''
    hasSavedKey.value = false
    savedApiKey = ''
    const config = await loadLlmConfig()
    if (config) {
      form.endpoint = config.endpoint
      form.model = config.model
      if (config.apiKey) {
        hasSavedKey.value = true
        savedApiKey = config.apiKey
      }
      if (form.endpoint && hasSavedKey.value) {
        loadModels()
      }
    }
    form.enabled = isLlmEnabled()
  }
})

function getEffectiveApiKey(): string {
  return form.apiKey || savedApiKey
}

async function loadModels() {
  const key = getEffectiveApiKey()
  if (!form.endpoint || !key) return
  fetchingModels.value = true
  try {
    const list = await fetchModels(form.endpoint, key)
    models.value = list.filter(Boolean).map(m => ({ name: m }))
  } catch (e: any) {
    console.error('[AiSettings] Failed to fetch models:', e)
    models.value = []
  } finally {
    fetchingModels.value = false
  }
}

async function testConnection() {
  const key = getEffectiveApiKey()
  testing.value = true
  testResult.value = null
  testError.value = ''
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000)
    const gen = streamCompletion({
      endpoint: form.endpoint,
      apiKey: key,
      model: form.model,
      messages: [{ role: 'user', content: 'Hi' }],
      signal: controller.signal,
    })
    await gen.next()
    clearTimeout(timeout)
    controller.abort()
    testResult.value = 'success'
  } catch (e: any) {
    testResult.value = 'error'
    testError.value = e?.message || 'Connection failed'
  } finally {
    testing.value = false
  }
}

async function save() {
  const key = getEffectiveApiKey()
  await saveLlmConfig({
    endpoint: form.endpoint,
    apiKey: key,
    model: form.model,
  })
  setLlmEnabled(form.enabled)
  emit('saved')
  visible.value = false
}
</script>

<style scoped>
.ai-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.field.row {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
}

.model-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.model-select {
  flex: 1;
}

.test-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 4px;
}

.test-success {
  color: #22c55e;
  font-size: 13px;
}

.test-error {
  color: #ef4444;
  font-size: 13px;
}

.cors-hint {
  background: #fef3cd;
  border: 1px solid #ffc107;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 12px;
  color: #856404;
  line-height: 1.5;
}

.cors-hint code {
  background: rgba(0, 0, 0, 0.06);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 11px;
}

.field-hint {
  font-size: 12px;
  color: var(--text-secondary, #6b7280);
  margin-top: 2px;
}

.w-full {
  width: 100%;
}
</style>
