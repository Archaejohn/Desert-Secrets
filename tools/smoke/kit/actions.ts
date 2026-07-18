import type { Page } from "@playwright/test";
import { snapshot, waitFor, readHp } from "./snapshot";
import { ZONE_KEYS } from "./zones";

/** Hold a key for one+ game frame — a bare press can fall between updates. */
export async function tap(page: Page, code: string, ms = 70): Promise<void> {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

/** Teleport the player (physics-safe) to a tile in the active zone. */
export async function teleport(page: Page, tx: number, ty: number): Promise<void> {
  await page.evaluate(
    ([tx, ty, zoneKeys]) => {
      const g = (window as any).__game;
      const key = g.scene.getScenes(true).map((s: any) => s.scene.key).find((k: string) =>
        (zoneKeys as unknown as string[]).includes(k)
      );
      const w = g.scene.getScene(key);
      w.player.body.reset((tx as number) * 16 + 8, (ty as number) * 16 + 8);
    },
    [tx, ty, ZONE_KEYS] as const
  );
  await page.waitForTimeout(150);
}

/** Advance dialogue; when a choice list is up, pick by index. */
export async function talkThrough(
  page: Page,
  { pickIndex = 0, exitIndex = null as number | null, maxSteps = 30 } = {}
): Promise<void> {
  for (let i = 0; i < maxSteps; i++) {
    const s = await snapshot(page);
    if (!s.dialogueOpen) return;
    if (s.choices) {
      const idx =
        exitIndex !== null
          ? Math.min(exitIndex, s.choices.length - 1)
          : Math.min(pickIndex, s.choices.length - 1);
      for (let k = 0; k < idx; k++) await tap(page, "ArrowDown", 60);
      await tap(page, "Space");
    } else {
      await tap(page, "Space");
    }
    await page.waitForTimeout(240);
  }
}

/** Fight the current battle by mashing confirm (attack → first target → perks). */
export async function fightThrough(
  page: Page,
  { act = true, timeoutMs = 90_000 } = {}
) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await snapshot(page);
    if (!s.battle) return s;
    if (act) await tap(page, "Space");
    await page.waitForTimeout(280);
  }
  return snapshot(page);
}

/** Walk up to a (possibly wandering) NPC and open its dialogue, retrying. */
export async function talkToNpc(
  page: Page,
  zone: string,
  npcIndex = 0,
  attempts = 6
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const pos = await page.evaluate(
      ([zone, idx]) => {
        const w = (window as any).__game.scene.getScene(zone as string);
        const n = w["npcs"][idx as number];
        if (!n || !n.sprite.active || !n.sprite.visible) return null;
        return { x: n.sprite.x, y: n.sprite.y };
      },
      [zone, npcIndex]
    );
    if (!pos) return false;
    await page.evaluate(
      ([zone, x, y]) => {
        const w = (window as any).__game.scene.getScene(zone as string);
        w.player.body.reset(x, (y as number) + 14);
      },
      [zone, pos.x, pos.y]
    );
    await page.waitForTimeout(150);
    await tap(page, "KeyE");
    await page.waitForTimeout(350);
    const s = await snapshot(page);
    if (s.dialogueOpen) return true;
  }
  return false;
}

/** If a battle is starting (fade included), fight it through and return to the zone. */
export async function fightIfBattle(page: Page, zone: string): Promise<boolean> {
  const s = await waitFor(page, (x) => x.battle, 3000);
  if (!s.battle) return false;
  await fightThrough(page);
  await waitFor(page, (x) => x.zoneKey === zone, 12_000);
  return true;
}

/** Test determinism helper: top up current HP to max before a fight. */
export async function healUp(page: Page): Promise<void> {
  await page.evaluate(() => {
    const g = (window as any).__game;
    const st = g.registry.get("act1");
    g.registry.set("act1", { ...st, hp: 999 }); // heroStats clamps to maxHp
  });
}

async function setHp(page: Page, hp: number): Promise<void> {
  await page.evaluate((h) => {
    const g = (window as any).__game;
    g.registry.set("act1", { ...g.registry.get("act1"), hp: h });
  }, hp);
}

/**
 * Exercise a rest point (Acts 3–7's mid-chain heal): stand on the rest tile,
 * use it once to learn the party's true max HP, damage the hero down to 1,
 * then use it again and confirm it heals back to that max — proving the point
 * is a repeatable, no-cost full heal (not a one-shot). The zone scene must be
 * active when called.
 */
export interface RestPointResult {
  ok: boolean;
  label: string;
  detail?: string;
}

export async function restPointCheck(
  page: Page,
  zone: string,
  tx: number,
  ty: number,
  label: string
): Promise<RestPointResult> {
  const usePoint = async () => {
    await standAt(page, zone, tx * 16 + 8, ty * 16 + 8);
    await tap(page, "KeyE");
    await page.waitForTimeout(250);
    if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // dismiss flavor line
  };
  await usePoint();
  const full = await readHp(page); // the rest point's heal-to-full target
  await setHp(page, 1);
  await page.waitForTimeout(100);
  await usePoint();
  const after = await readHp(page);
  return {
    ok: full > 1 && after === full,
    label: `rest point full-heals the party (repeatable) — ${label}`,
    detail: `full=${full} damaged→1 then rested→${after}`,
  };
}

/**
 * Walk (real key-driven, collision-respecting movement — not a teleport)
 * toward a px target until within range, tapping the direction in short
 * bursts. Used for the one reachability check that must catch real map
 * bugs: teleporting bypasses collision entirely and would silently mask a
 * wall sealing off a pickup (as the shed's bucket once was).
 */
export async function walkUntilNear(
  page: Page,
  dir: string,
  targetX: number,
  targetY: number,
  range = 22,
  maxSteps = 14
) {
  for (let i = 0; i < maxSteps; i++) {
    const cur = await snapshot(page);
    // px/py are only unset when no zone is active, which cannot be true here
    // (this walks a live zone) — non-null since Snap types them optional.
    if (Math.hypot(cur.px! - targetX, cur.py! - targetY) < range) return cur;
    await page.keyboard.down(dir);
    await page.waitForTimeout(120);
    await page.keyboard.up(dir);
    await page.waitForTimeout(60);
  }
  return snapshot(page);
}

/** Move the player directly onto a px point (spawn-safe; not a physics walk). */
export async function standAt(page: Page, zone: string, x: number, y: number): Promise<void> {
  await page.evaluate(
    ([zone, x, y]) => {
      (window as any).__game.scene.getScene(zone as string).player.body.reset(x, y);
    },
    [zone, x, y]
  );
  await page.waitForTimeout(150);
}

// ---------- Act 2, zone by zone ----------
// Generic driver: talk to every NPC, then visit triggers/exits to advance.
export async function talkAllNpcs(page: Page, zone: string): Promise<void> {
  for (let pass = 0; pass < 2; pass++) {
    const count = await page.evaluate(
      (z) => (window as any).__game.scene.getScene(z)["npcs"].length,
      zone
    );
    for (let i = 0; i < count; i++) {
      await healUp(page);
      const opened = await talkToNpc(page, zone, i);
      if (!opened) continue;
      await talkThrough(page, { pickIndex: 0 });
      await fightIfBattle(page, zone);
    }
  }
}

/** Visit TRIGGER rects only (never exits) until pred holds. */
export async function driveTriggersUntil(
  page: Page,
  zone: string,
  pred: (s: Awaited<ReturnType<typeof snapshot>>) => boolean,
  maxRounds = 3
) {
  for (let round = 0; round < maxRounds; round++) {
    const rects = await page.evaluate((z) => {
      const w = (window as any).__game.scene.getScene(z);
      return w["triggers"].map((t: any) => t.rect);
    }, zone);
    for (const r of rects) {
      let cur = await snapshot(page);
      if (pred(cur)) return cur;
      if (cur.zoneKey !== zone) return cur;
      await healUp(page);
      await teleport(page, r.x1, r.y1);
      // Wait for the trigger's reaction rather than a fixed delay: some
      // triggers only open their dialogue after a ~900ms tween (e.g. the reef
      // warren chase), which races a hardcoded 500ms wait and flakes.
      cur = await waitFor(page, (x) => x.dialogueOpen || x.battle || x.zoneKey !== zone, 2500);
      if (cur.dialogueOpen) await talkThrough(page, { pickIndex: 0 });
      await fightIfBattle(page, zone);
      cur = await snapshot(page);
      if (pred(cur)) return cur;
      if (cur.zoneKey !== zone) return cur;
    }
  }
  return snapshot(page);
}

/** Leave `zone` for `target` via a declared exit (or gated trigger fallback). */
export async function exitTo(page: Page, zone: string, target: string) {
  const exits = await page.evaluate((z) => {
    const w = (window as any).__game.scene.getScene(z);
    return w["exits"].map((e: any) => ({ rect: e.rect, target: e.target }));
  }, zone);
  const match = exits.find((e: any) => e.target === target);
  if (match) {
    await teleport(page, match.rect.x1, match.rect.y1);
    return waitFor(page, (x) => x.zoneKey === target, 8000);
  }
  // Gated exits live in triggers; visit them until the zone flips.
  return driveTriggersUntil(page, zone, (x) => x.zoneKey === target);
}
