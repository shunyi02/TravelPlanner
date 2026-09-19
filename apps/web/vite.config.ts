import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],

  // @travel-planner/shared builds to CommonJS (the backend needs to
  // `require()` it), but Vite dev serves workspace-linked packages as
  // native ESM source by default, so a plain CJS `exports.X` isn't visible
  // as a named import. Forcing it through esbuild's pre-bundling step gives
  // it proper CJS->ESM interop, same as what `vite build` already does.
  optimizeDeps: {
    include: ['@travel-planner/shared'],
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
