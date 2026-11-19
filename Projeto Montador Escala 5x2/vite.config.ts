/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build estático em ../montador-escala (mesmo padrão do CRM em ../crm).
// `base: './'` permite publicar em qualquer subpasta.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: '../montador-escala', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
