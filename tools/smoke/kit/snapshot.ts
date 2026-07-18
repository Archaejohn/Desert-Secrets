import type { Page } from "@playwright/test";
import { ZONE_KEYS } from "./zones";

export type Snap = Awaited<ReturnType<typeof snapshot>>;

export async function waitForBoot(page: Page): Promise<void> {
  // __game is set before scenes register — wait for the boot scene to be active,
  // else the first snapshot() reads an empty scene manager.
  await page.waitForFunction(() => {
    const g = (window as any).__game;
    return !!(g && g.scene && g.scene.getScene("boot") && g.scene.getScene("boot").scene.isActive());
  }, null, { timeout: 25_000 });
}

export function snapshot(page: Page) {
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
  pred: (s: Awaited<ReturnType<typeof snapshot>>) => boolean,
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
