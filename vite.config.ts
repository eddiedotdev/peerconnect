import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/'],
      exclude: ['src/**/__tests__/**'],
    }),
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
      entry: {
        index: resolve(__dirname, 'src/core/index.ts'),
        react: resolve(__dirname, 'src/react/index.ts'),
      },
      formats: ['es'],
      fileName: (entryName) => `${entryName}.js`,
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
