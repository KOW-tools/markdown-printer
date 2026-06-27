<template>
  <Teleport to="body">
    <Dialog v-model:visible="visible" header="Privacy Policy" modal :closable="true" :style="{ maxWidth: '90vw' }">
      <div class="privacy-content markdown-body" v-html="policyHtml"></div>
    </Dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Dialog from 'primevue/dialog'
import { marked } from 'marked'
import policyMd from '../POLICY.md?raw'

const visible = defineModel<boolean>({ default: false })

const policyHtml = computed(() => marked.parse(policyMd) as string)
</script>

<style scoped>
.privacy-content {
  color: var(--text-primary);
  background-color: transparent;
}

.privacy-content :deep(a) {
  color: var(--accent-color, #30b9f5);
}
</style>
