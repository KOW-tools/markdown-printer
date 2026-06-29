import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const FONT_COPY_TARGETS = [
  { src: 'node_modules/@fontsource/open-sans/files/open-sans-latin-400-normal.woff2', dest: 'vendor/fonts/open-sans/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/open-sans/files/open-sans-latin-600-normal.woff2', dest: 'vendor/fonts/open-sans/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/open-sans/files/open-sans-latin-700-normal.woff2', dest: 'vendor/fonts/open-sans/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/roboto/files/roboto-latin-400-normal.woff2', dest: 'vendor/fonts/roboto/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/roboto/files/roboto-latin-600-normal.woff2', dest: 'vendor/fonts/roboto/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/roboto/files/roboto-latin-700-normal.woff2', dest: 'vendor/fonts/roboto/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/montserrat/files/montserrat-latin-400-normal.woff2', dest: 'vendor/fonts/montserrat/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/montserrat/files/montserrat-latin-600-normal.woff2', dest: 'vendor/fonts/montserrat/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/montserrat/files/montserrat-latin-700-normal.woff2', dest: 'vendor/fonts/montserrat/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff2', dest: 'vendor/fonts/inter/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff2', dest: 'vendor/fonts/inter/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/inter/files/inter-latin-700-normal.woff2', dest: 'vendor/fonts/inter/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/lora/files/lora-latin-400-normal.woff2', dest: 'vendor/fonts/lora/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/lora/files/lora-latin-700-normal.woff2', dest: 'vendor/fonts/lora/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/lato/files/lato-latin-400-normal.woff2', dest: 'vendor/fonts/lato/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/lato/files/lato-latin-700-normal.woff2', dest: 'vendor/fonts/lato/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/source-code-pro/files/source-code-pro-latin-400-normal.woff2', dest: 'vendor/fonts/source-code-pro/files', rename: { stripBase: 4 } },
  { src: 'node_modules/@fontsource/source-code-pro/files/source-code-pro-latin-700-normal.woff2', dest: 'vendor/fonts/source-code-pro/files', rename: { stripBase: 4 } },
]

export default defineConfig({
  base: '/markdown-printer/',
  plugins: [
    vue(),
    viteStaticCopy({
      targets: [
        {
          src: 'node_modules/pagedjs/dist/paged.polyfill.min.js',
          dest: 'vendor',
          rename: { stripBase: 3, name: 'paged.polyfill.js' },
        },
        {
          src: 'node_modules/github-markdown-css/github-markdown-light.css',
          dest: 'vendor',
          rename: { stripBase: 2 },
        },
        {
          src: 'node_modules/katex/dist/katex.min.css',
          dest: 'vendor',
          rename: { stripBase: 3 },
        },
        {
          src: 'node_modules/katex/dist/fonts/*',
          dest: 'vendor/fonts',
          rename: { stripBase: 4 },
        },
        {
          src: 'node_modules/highlight.js/styles/github.min.css',
          dest: 'vendor',
          rename: { stripBase: 3 },
        },
        ...FONT_COPY_TARGETS,
      ],
    }),
  ],
  server: {
    proxy: {
      '/api': 'http://localhost:2711'
    }
  },
  build: {
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1700,
    rolldownOptions: {
      output: {
        manualChunks(id: string | string[]) {
          if (id.includes('node_modules/vue') || id.includes('node_modules/@vue') || id.includes('node_modules/primevue') || id.includes('node_modules/@primeuix')) return 'vendor-vue'
          if (id.includes('node_modules/@codemirror') || id.includes('node_modules/codemirror') || id.includes('node_modules/vue-codemirror')) return 'vendor-codemirror'
          if (id.includes('node_modules/marked') || id.includes('node_modules/highlight.js') || id.includes('node_modules/katex')) return 'vendor-markdown'
        },
      },
    },
  }
})
