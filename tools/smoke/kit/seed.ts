import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Page } from "@playwright/test";
import { SAVE_KEY } from "./zones";
import { snapshot, waitForBoot, waitFor, type Snap } from "./snapshot";
import { tap } from "./actions";

const fixturesDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

export function fixture(name: string): unknown {
  return JSON.parse(readFileSync(path.join(fixturesDir, `${name}.json`), "utf8"));
}

/** Seed a checkpoint save, boot, and CONTINUE straight into its zone. */
export async function seed(page: Page, state: unknown): Promise<Snap> {
  await page.addInitScript(
    ([key, save]) => localStorage.setItem(key, save),
    [SAVE_KEY, JSON.stringify({ v: 1, state })] as const
  );
  await page.goto("/");
  await waitForBoot(page);
  // Title menu is up; with a save present CONTINUE is the first, highlighted option.
  await waitFor(page, (x) => x.active?.includes("boot"));
  await tap(page, "Space");
  const zone = (state as any).zone as string;
  return waitFor(page, (x) => x.zoneKey === zone, 12_000);
}

/** In CAPTURE mode, dump the current checkpoint state to fixtures/<name>.json. */
export async function captureCheckpoint(page: Page, name: string): Promise<void> {
  if (!process.env.CAPTURE) return;
  const s = await snapshot(page);
  mkdirSync(fixturesDir, { recursive: true });
  writeFileSync(path.join(fixturesDir, `${name}.json`), JSON.stringify(s.state, null, 2) + "\n");
}
