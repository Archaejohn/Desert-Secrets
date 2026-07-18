import type { Page } from "@playwright/test";

/**
 * Shared "debug jump" — patch the `act1` registry (zone/hp/xp/flags/items),
 * stop every non-boot scene, and `scene.start(zone)`: the direct
 * state-injection technique walkout.spec.ts, touch.spec.ts and the
 * shots/*.spec.ts specs each used to land on a specific mid-run state without
 * replaying the acts that lead there. Ported by hand from six near-identical
 * inline copies — see each call site for which options it needs and why:
 * some set hp, some set xp instead (never both), some merge items, some
 * additionally stand the player on a tile afterward, and the settle timeouts
 * vary (1300ms vs 1400ms after scene.start; 0/250/400/500/900ms after
 * standing) because a couple of call sites need longer for the camera/lights
 * to settle before a screenshot. Every option below is OPT-IN so each
 * call site can reproduce its original timing exactly.
 */
export interface JumpToOptions {
  /** Zone key to jump into (patched onto act1.zone, then scene.start'd). */
  zone: string;
  /** Merged onto act1.flags (shallow). */
  flags?: Record<string, unknown>;
  /** Merged onto act1.items (shallow) — omit to leave items untouched. */
  items?: Record<string, unknown>;
  /** Overwrites act1.hp — omit to leave hp untouched. */
  hp?: number;
  /** Overwrites act1.xp — omit to leave xp untouched. */
  xp?: number;
  /** Tile coords (not px) to stand the player on after the zone settles. */
  stand?: { x: number; y: number };
  /** Wait after scene.start, before any `stand`. Default 1300 (the common case). */
  settleMs?: number;
  /** Extra wait after the (optional) stand — or unconditionally, if no `stand`
   *  was given and a caller still wants a trailing settle. Default 0. */
  standSettleMs?: number;
}

export async function jumpTo(page: Page, opts: JumpToOptions): Promise<void> {
  const { zone, flags = {}, items, hp, xp, stand, settleMs = 1300, standSettleMs = 0 } = opts;
  await page.evaluate(
    ([zone, flags, items, hp, xp]) => {
      const g = (window as any).__game;
      const st = g.registry.get("act1");
      const next: any = { ...st, zone, flags: { ...st.flags, ...(flags as object) } };
      if (items) next.items = { ...st.items, ...(items as object) };
      if (hp !== undefined) next.hp = hp;
      if (xp !== undefined) next.xp = xp;
      g.registry.set("act1", next);
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, flags, items ?? null, hp ?? null, xp ?? null] as const
  );
  await page.waitForTimeout(settleMs);
  if (stand) {
    await page.evaluate(
      ([zone, x, y]) => {
        (window as any).__game.scene.getScene(zone as string).player.body.reset(x as number, y as number);
      },
      [zone, stand.x * 16 + 8, stand.y * 16 + 8] as const
    );
  }
  if (standSettleMs) await page.waitForTimeout(standSettleMs);
}
