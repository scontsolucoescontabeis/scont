/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build estático em ./app, versionado: o deploy publica toda pasta 'Projeto *'.
// `base: './'` permite publicar em qualquer subpasta.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'app', emptyOutDir: true },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
