import { defineConfig } from 'vite';

// GitHub Pages serves the site under /<repo>/, so the workflow sets VITE_BASE.
// Locally (dev / preview) the app lives at '/'.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1200,
  },
});
