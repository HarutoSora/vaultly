// Test-only environment shims — never bundled into the real extension.
// Not under src/, so it's outside the project's tsc build too; vitest
// transpiles it directly.
import 'fake-indexeddb/auto'

// A minimal in-memory stand-in for chrome.storage.local, just enough for
// local-vault.ts's get/set/remove calls. Real Chrome types stay accurate in
// src/ — this is deliberately loose, it only needs to satisfy usage, not
// the full chrome.storage.local surface.
const store = new Map<string, unknown>()

;(globalThis as unknown as { chrome: unknown }).chrome = {
  storage: {
    local: {
      get: async (key: string) => ({ [key]: store.get(key) }),
      set: async (items: Record<string, unknown>) => {
        for (const [k, v] of Object.entries(items)) store.set(k, v)
      },
      remove: async (key: string) => {
        store.delete(key)
      },
    },
  },
}
