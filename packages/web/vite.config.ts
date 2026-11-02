import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    host: true,
    proxy: { '/ws': { target: 'ws://localhost:3020', ws: true }, '/api': 'http://localhost:3020', '/avatars': 'http://localhost:3020', '/privacy': 'http://localhost:3020', '/terms': 'http://localhost:3020' },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // three.js & react-three dipisah (di-cache browser terpisah dari kode game yang sering berubah)
        manualChunks: (id) => {
          if (/node_modules[\\/](three|three-stdlib|three-mesh-bvh|@react-three|troika|maath|camera-controls|meshline|stats-gl|@monogrid)/.test(id)) return 'three';
          if (/node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id) || id.includes('vite/preload-helper') || id.includes('commonjsHelpers')) return 'vendor';
        },
      },
    },
  },
});
