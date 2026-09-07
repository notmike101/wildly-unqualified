import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  publicDir: "public",
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      "/api": "http://127.0.0.1:4316",
      "/ws": { target: "ws://127.0.0.1:4316", ws: true },
    },
  },
  build: { outDir: "dist", target: "es2022", assetsInlineLimit: 0 },
});
