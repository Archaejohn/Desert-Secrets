/**
 * Focused verification for the "no forced advancement" retrofit: every act
 * boundary must be crossed by WALKING into a revealed exit, never by a dialogue
 * dismissal / catch / trade auto-teleporting. Ported from walkout-e2e.mjs onto
 * the shared kit (playwright-core -> @playwright/test). Drives a fresh game,
 * jumping to each act-end state (a direct registry + scene.start injection —
 * the same technique the source used, since these states aren't a single
 * "continue from a checkpoint" fixture but many different mid-run flag
 * combinations visited back-to-back in one session) and asserting:
 *   1. the scene does NOT auto-advance (still the same zone a beat later),
 *   2. a real walk-in exit to the next zone now exists,
 *   3. walking into it actually crosses.
 */
import { test, expect, type Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "./kit/snapshot";
import { tap, standAt } from "./kit/actions";
import { newGameStart } from "./flows/act1";
import { jumpTo } from "./kit/debug";
import { installPageErrors, getPageErrors } from "./kit/errors";

test.beforeEach(async ({ page }) => {
  installPageErrors(page);
});

// Common ancestor flags so followers/objectives are consistent.
const BASE = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, silverfinCaught: true, act3Complete: true,
  lurkerDefeated: true, metFluffball: true, sawDeepBed: true,
};

/** Jump into `zone` with `flags` merged onto the current act1 state (a debug
 *  jump / state injection — not a normal scene transition). */
async function enter(
  page: Page,
  zone: string,
  flags: Record<string, boolean>,
  items: Record<string, unknown> = {}
): Promise<void> {
  await jumpTo(page, { zone, flags, items, hp: 999, settleMs: 1300 });
}

/** The zone's declared walk-in exit targets. */
async function exitsOf(page: Page, zone: string): Promise<string[]> {
  return page.evaluate((z) => {
    const w = (window as any).__game.scene.getScene(z);
    return (w["exits"] ?? []).map((e: any) => e.target);
  }, zone);
}

/** Move the player onto a tile (spawn-safe reset, not a physics walk). */
async function standAtTile(page: Page, zone: string, tile: { x: number; y: number }): Promise<void> {
  await standAt(page, zone, tile.x * 16 + 8, tile.y * 16 + 8);
}

function zoneLabel(s: Snap): string {
  return s.zoneKey ?? s.active.join(",");
}

// ---- A walk-in exit case: enter state, confirm no auto-advance, then cross. ----
async function walkoutCase(
  page: Page,
  label: string,
  zone: string,
  flags: Record<string, boolean>,
  target: string,
  exitTile: { x: number; y: number },
  items: Record<string, unknown> = {}
): Promise<void> {
  await enter(page, zone, flags, items);
  const s0 = await snapshot(page);
  expect(s0.zoneKey, `${label}: lands in ${zone} (no auto-teleport into ${target}) — zone=${zoneLabel(s0)}`).toBe(
    zone
  );
  const exits = await exitsOf(page, zone);
  expect(exits, `${label}: a walk-in exit to ${target} is revealed — exits=${exits.join(",")}`).toContain(target);
  // Confirm it does not advance on its own over a beat.
  await page.waitForTimeout(600);
  const s1 = await snapshot(page);
  expect(s1.zoneKey, `${label}: does NOT advance without movement — zone=${zoneLabel(s1)}`).toBe(zone);
  // Now walk into the exit.
  await standAtTile(page, zone, exitTile);
  const crossed = await waitFor(page, (x) => x.zoneKey === target);
  expect(crossed.zoneKey, `${label}: walking into the exit crosses to ${target} — zone=${zoneLabel(crossed)}`).toBe(
    target
  );
}

test("walk-out act boundaries — no forced advancement", async ({ page }) => {
  // NEW GAME — initializes the "act1" registry state the cases below build on.
  await newGameStart(page);

  // Act 3 → 4: the frozen ice path out of the deep bed.
  await walkoutCase(
    page,
    "Act 3→4 (ice path)",
    "deepBed",
    { ...BASE, act4Started: false },
    "seaAscent",
    { x: 15, y: 1 },
    { silverfin: true }
  );

  // Act 4 → 5: the stairwell down opens in the camp.
  await walkoutCase(
    page,
    "Act 4→5 (stairwell)",
    "campProper",
    {
      ...BASE, sawAscent: true, act4Started: true, sawOutskirts: true, sawCamp: true,
      sawCrateChase: true, sawNook: true, middenCleared: true, fluffballLedge: true,
      gotSocks: true, act4Complete: true,
    },
    "groveDescent",
    { x: 15, y: 18 },
    { stinkySocks: true }
  );

  // Act 5 → 6: Sahra's hidden door down.
  await walkoutCase(
    page,
    "Act 5→6 (hidden door)",
    "sahraGrove",
    {
      ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
      fluffballJoined: true, sawSahraGrove: true, gotOranges: true, act5Complete: true,
    },
    "reefDescent",
    { x: 11, y: 14 },
    { stinkySocks: true, oranges: true }
  );

  // Act 6 → 7: the crawlers' opened tunnel down.
  await walkoutCase(
    page,
    "Act 6→7 (crawler tunnel)",
    "reefCourt",
    {
      ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
      fluffballJoined: true, act5Complete: true, gotOranges: true, act6Started: true,
      sawReefCourt: true, gotSeaweed: true, act6Complete: true,
    },
    "pizzaDescent",
    { x: 11, y: 14 },
    { stinkySocks: true, oranges: true, seaweed: true }
  );

  // Act 7 → ascent: Testudo's revealed stairs up.
  await walkoutCase(
    page,
    "Act 7→ascent (stairs up)",
    "pizzeria",
    {
      ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
      fluffballJoined: true, act5Complete: true, gotOranges: true, act6Started: true,
      gotSeaweed: true, act6Complete: true, act7Started: true, metTestudo: true,
      pizzaBaked: true, piggyCaught: true, heardReveal: true,
    },
    "pizzaAscent",
    { x: 2, y: 16 },
    { silverfin: true, stinkySocks: true, oranges: true, seaweed: true }
  );

  // Act 2 → 3: follow the penguins into the tunnel → END OF ACT 2 card → the sea.
  // (Sanctum uses a walk-in trigger to the card, not a plain addExit.)
  {
    await enter(page, "sanctum", { wardenDefeated: true, act2Complete: true, slitherJoined: true });
    const s0 = await snapshot(page);
    expect(
      s0.zoneKey,
      `Act 2→3 (tunnel): lands in sanctum (no auto-teleport) — zone=${zoneLabel(s0)}`
    ).toBe("sanctum");
    await page.waitForTimeout(600);
    const s1 = await snapshot(page);
    expect(s1.zoneKey, "Act 2→3 (tunnel): does NOT advance without movement").toBe("sanctum");
    await standAtTile(page, "sanctum", { x: 23, y: 4 }); // SANCTUM_TUNNEL
    await page.waitForTimeout(800); // the END OF ACT 2 card appears
    await tap(page, "Space"); // dismiss the card → dive into the sea
    const crossed = await waitFor(page, (x) => x.zoneKey === "sunlessSea", 8000);
    expect(
      crossed.zoneKey,
      `Act 2→3 (tunnel): walking into the tunnel + card dives into the sea — zone=${zoneLabel(crossed)}`
    ).toBe("sunlessSea");
  }

  // ---- no uncaught page errors across the whole run ----
  expect(getPageErrors(page), "no page errors").toEqual([]);
});
