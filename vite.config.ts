import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsDir: 'assets'
  },
  test: {
    environment: 'node',
    globals: true
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080'
    }
  }
});
