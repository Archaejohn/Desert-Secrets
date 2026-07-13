import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Single-file output: all JS and generated art (as data URIs) are inlined so
// the built index.html runs standalone in a browser and inside the Capacitor
// Android WebView without a server.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 8000,
    outDir: "dist"
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node"
  }
});
