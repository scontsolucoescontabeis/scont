/// <reference types="vitest" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Build estático em ./app, versionado: o deploy publica toda pasta 'Projeto *'.
// `base: './'` permite publicar em qualquer subpasta.
// O bundle sai como script CLÁSSICO (IIFE, sem type="module"/crossorigin) para
// também funcionar abrindo o index.html direto por file://.
const scriptClassico: Plugin = {
  name: 'script-classico',
  transformIndexHtml: {
    order: 'post',
    handler: (html) =>
      html
        .replace(/<script type="module" crossorigin/g, '<script defer')
        .replace(/ crossorigin/g, ''),
  },
}

export default defineConfig({
  plugins: [react(), scriptClassico],
  base: './',
  build: {
    outDir: 'app',
    emptyOutDir: true,
    rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } },
  },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
