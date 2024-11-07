import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    dts(),
    nodePolyfills({
      include: ['events'],
    }),
    react(),
  ],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: {
      external: ['react', '@tanstack/react-query'],
      onwarn(warning, warn) {
        // Ignore "use client" directive warnings
        if (
          warning.code === 'MODULE_LEVEL_DIRECTIVE' &&
          (warning.message.includes('"use client"') ||
            warning.message.includes("'use client'"))
        ) {
          return;
        }
        warn(warning);
      },
    },
  },
});
