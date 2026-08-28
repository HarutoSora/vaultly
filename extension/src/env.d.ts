/**
 * Injected at build time via Vite's `define` (see vite.popup.config.ts /
 * vite.background.config.ts) when built with `--mode store`. True only for
 * the Chrome Web Store build, which drops account/sync mode entirely — see
 * App.tsx and background.ts for what each side of the flag does.
 */
declare const __STORE_BUILD__: boolean
