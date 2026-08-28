import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import mkcert from 'vite-plugin-mkcert'

// mkcert gives the dev server a locally-trusted HTTPS cert so the Secure,
// HttpOnly session cookie the API sets actually round-trips in dev —
// without it the browser silently drops the cookie. Its first run installs
// a local CA into the OS trust store, which needs an interactive
// environment; skip it (plain HTTP) in a sandboxed/CI shell with
// VAULTLY_NO_HTTPS=1 — auth won't fully work over plain HTTP, but the rest
// of the UI is still usable for that kind of check.
const useHttps = !process.env.VAULTLY_NO_HTTPS

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(useHttps ? [mkcert()] : [])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    https: useHttps ? {} : undefined,
    proxy: {
      '/api': {
        target: 'https://localhost:5201',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})
