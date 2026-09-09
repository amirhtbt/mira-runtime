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
    globals: true,
    exclude: ['tests/visual/**', 'node_modules/**', 'dist/**']
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080'
    }
  }
});
