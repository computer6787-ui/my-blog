import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// https://vite.dev/config/
export default defineConfig({
  base: '/static/chat/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../backend/static/chat'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'src/main.tsx'),
      output: {
        entryFileNames: 'chat-bundle.js',
        chunkFileNames: 'chunks/[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0]?.endsWith('.css') || (assetInfo.name && assetInfo.name.endsWith('.css'))) {
            return 'chat-bundle.css';
          }
          return 'assets/[name][extname]';
        },
        manualChunks: (id) => {
        if (id.includes('react') || id.includes('react-dom')) {
          return 'vendor-react';
        }
      },
      },
    },
  },
  define: {
    'process.env': {},
  },
});

