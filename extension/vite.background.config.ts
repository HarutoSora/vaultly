import { defineConfig } from 'vite'

// MV3 service worker: a single self-contained ES module, all dependencies
// inlined (library mode does this by default — no shared chunks, since
// nothing else on the page can import them at runtime).
//
// `vite build --mode store` flips __STORE_BUILD__ to true — see the popup
// config's comment for why, and background.ts for what it skips (the one
// automatic network call, fetchCurrentUser() inside getStatus()).
export default defineConfig(({ mode }) => ({
  define: {
    __STORE_BUILD__: JSON.stringify(mode === 'store'),
  },
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
}))
