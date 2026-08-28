import { defineConfig } from 'vite'

// MV3 service worker: a single self-contained ES module, all dependencies
// inlined (library mode does this by default — no shared chunks, since
// nothing else on the page can import them at runtime).
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: 'src/background.ts',
      formats: ['es'],
      fileName: () => 'background.js',
    },
    rollupOptions: {
      output: { codeSplitting: false },
    },
  },
})
