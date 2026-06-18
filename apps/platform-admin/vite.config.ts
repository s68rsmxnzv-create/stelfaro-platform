import { fileURLToPath, URL } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@stelfaro/billing': fileURLToPath(new URL('../../packages/billing/src/index.ts', import.meta.url))
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5174,
    proxy: {
      '/platform-api': {
        target: 'http://127.0.0.1:8002',
        changeOrigin: true
      },
      '/notifications-api': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/notifications-api/, '/api')
      },
      '/core-api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/core-api/, '/api')
      }
    }
  }
});
