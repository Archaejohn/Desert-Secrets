import { writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// A fresh timestamp per `vite build` invocation — good enough as a version
// stamp (unique per deploy, human-readable) without depending on git being
// available in every build environment. Baked into the client bundle via
// `define` AND written to a small standalone `version.json` (see
// `writeVersionFile` below); the client compares the two at runtime to
// detect a newer deploy (src/game/updateCheck.ts).
const APP_VERSION = new Date().toISOString();

/** Emits dist/version.json alongside the single-file build output. Kept
 *  out of `public/` deliberately — writing there would dirty the working
 *  tree with a new timestamp on every single build/dev run; a build-only
 *  `writeBundle` hook only touches the (gitignored) dist/ directory. */
function writeVersionFile() {
  return {
    name: "write-version-file",
    apply: "build" as const,
    writeBundle(options: { dir?: string }) {
      writeFileSync(
        path.join(options.dir ?? "dist", "version.json"),
        JSON.stringify({ version: APP_VERSION })
      );
    }
  };
}

// Single-file output: all JS and generated art (as data URIs) are inlined so
// the built index.html runs standalone in a browser and inside the Capacitor
// Android WebView without a server.
export default defineConfig({
  base: "./",
  plugins: [viteSingleFile(), writeVersionFile()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION)
  },
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
