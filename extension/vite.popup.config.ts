import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Builds the popup as a normal single-page app — index.html + its JS/CSS —
// and copies public/ (manifest.json) into dist/. Runs first in the build
// script so its emptyOutDir doesn't wipe the other two entries' output.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})
