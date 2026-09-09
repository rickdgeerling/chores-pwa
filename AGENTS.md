# Household app

An offline-first, static-hosted PWA for managing chores

- Alpine.js reactive SPA with hash routing
- localStorage persistence with backup/restore via JSON import/export
- esbuild build pipeline: JS/CSS bundling, HTML template assembly, static asset copying
- Service worker: network-first + 3s timeout, pre-cache, offline fallback
- marx-css classless base with component classes for cards, toasts, layout
