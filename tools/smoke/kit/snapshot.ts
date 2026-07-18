import type { Page } from "@playwright/test";
import { ZONE_KEYS } from "./zones";
// Type-only import — no runtime cost/cycle risk (erased at compile time), and
// gameState.ts is pure TypeScript per CLAUDE.md's engine conventions (no
// Phaser imports), so this stays cheap.
import type { Act1State } from "../../../src/core/gameState";

/**
 * The shape snapshot() itself returns. The four core fields are always set;
 * dialogueOpen/choices/px/py only when a zone is active (see below). Flows
 * routinely fold extra ad-hoc fields onto individual beat snapshots (timing
 * results, camera rects, nested sub-snapshots — see flows/act3.ts's
 * restPointCheck result, flows/act1.ts's `cam`/`sealed`, etc.) and specs read
 * them back, sometimes several levels deep — the index signature is `any`
 * (not `unknown`) specifically so those ad-hoc reads keep compiling without
 * requiring every fold site to be individually typed.
 */
export interface Snap {
  active: string[];
  zoneKey: string | null;
  battle: boolean;
  state: Act1State;
  dialogueOpen?: boolean;
  choices?: string[] | null;
  px?: number;
  py?: number;
  [k: string]: any;
}

export async function waitForBoot(page: Page): Promise<void> {
  // __game is set before scenes register — wait for the boot scene to be active,
  // else the first snapshot() reads an empty scene manager.
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return !!(g && g.scene && g.scene.getScene("boot") && g.scene.getScene("boot").scene.isActive());
  }, null, { timeout: 25_000 });
}

export function snapshot(page: Page): Promise<Snap> {
  return page.evaluate((zoneKeys) => {
    const g = (window as any).__game;
    const active = g.scene.getScenes(true).map((s: any) => s.scene.key);
    const zoneKey = active.find((k: string) => zoneKeys.includes(k));
    const battle = active.includes("battle");
    const out: any = { active, zoneKey: zoneKey ?? null, battle, state: g.registry.get("act1") };
    if (zoneKey) {
      const w = g.scene.getScene(zoneKey);
      out.dialogueOpen = w.dialogue?.isOpen ?? false;
      out.choices = w.dialogue?.runner?.choices?.map((c: any) => c.text) ?? null;
      out.px = w.player?.x;
      out.py = w.player?.y;
    }
    return out;
  }, ZONE_KEYS as unknown as string[]);
}

export async function waitFor(
  page: Page,
  pred: (s: Snap) => boolean,
  timeoutMs = 15_000
) {
  // Loop shape/timing preserved from e2e.mjs:176-191 (200ms poll,
  // timeout checked before each snapshot) for behavior parity.
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await snapshot(page);
    if (pred(s)) return s;
    await page.waitForTimeout(200);
  }
  return snapshot(page);
}

export function readHp(page: Page): Promise<number> {
  return page.evaluate(() => (window as any).__game.registry.get("act1").hp);
}
