import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";
import { nodePolyfills } from 'vite-plugin-node-polyfills'

export default defineConfig({
  plugins: [
    dts(),
    nodePolyfills({
      include: ['events']
    })
  ],
  server: {
    port: 3000,
  },
  optimizeDeps: {
    include: ['@tanstack/react-query'],
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["react", "@tanstack/react-query"],
    },
  },
});
