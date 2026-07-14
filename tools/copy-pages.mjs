/**
 * Copy the built game (dist/) into docs/play/ so GitHub Pages can serve it
 * as an installable PWA at https://<owner>.github.io/<repo>/play/.
 * Run via `npm run pages`, then commit docs/play.
 */
import { cpSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const out = path.join(root, "docs", "play");

mkdirSync(out, { recursive: true });
for (const f of readdirSync(dist)) {
  cpSync(path.join(dist, f), path.join(out, f), { recursive: true });
}
console.log(`pages: copied ${readdirSync(dist).length} files from dist/ to docs/play/`);
