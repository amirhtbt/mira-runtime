import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    ...(mode === 'android' ? [{
      name: 'android-standalone-entry',
      transformIndexHtml: {
        order: 'pre' as const,
        handler: (html: string) => html.replace('/src/main.tsx', '/src/mobile/main.tsx'),
      },
    }] : []),
  ],
  build: {
    target: 'es2022',
    outDir: mode === 'android' ? 'dist-android' : 'dist',
    sourcemap: true,
    assetsDir: 'assets'
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['tests/visual/**', 'tests/e2e/**', 'node_modules/**', 'dist/**']
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080'
    }
  }
}));
