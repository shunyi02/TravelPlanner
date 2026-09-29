import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // @travel-planner/shared builds to CommonJS for the backend. The web app
  // reads its TypeScript source instead: Vite serves that as ESM directly,
  // so edits show up live. Pre-bundling the built CJS used to be cached in
  // node_modules/.vite and went stale whenever shared changed.
  resolve: {
    alias: {
      '@travel-planner/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)),
    },
  },

  server: {
    port: 5173,

    proxy: {
      '/auth': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },

      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
