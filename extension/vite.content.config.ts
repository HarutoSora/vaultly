import { defineConfig } from 'vite'

// Content scripts can't use ES module imports at runtime in the page
// context, so this bundles to a single self-contained IIFE.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/content-script.ts',
      formats: ['iife'],
      name: 'VaultlyContentScript',
      fileName: () => 'content-script.js',
    },
  },
})
