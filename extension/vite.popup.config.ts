import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the popup as a normal single-page app — index.html + its JS/CSS —
// and copies public/ (manifest.json) into dist/. Runs first in the build
// script so its emptyOutDir doesn't wipe the other two entries' output.
//
// `vite build --mode store` (see package.json's build:store script) flips
// __STORE_BUILD__ to true, which the popup uses to hide account/sync mode
// entirely — see App.tsx. Same source, one compile-time switch, rather than
// a forked copy of the popup that could drift.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    __STORE_BUILD__: JSON.stringify(mode === 'store'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}))
