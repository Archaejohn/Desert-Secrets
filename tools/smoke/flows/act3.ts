/**
 * Act 3 flow — the Sunless Sea (a six-zone chain: entry overlook → kelp
 * forest → sun temple → Fluffball's bed → deep bed → ascent), ported from
 * tools/smoke/e2e.mjs:935-1066. The Act2→Act3 tunnel-walk transition
 * (:922-932) is the spine's job, not this act's. Zone 6 (seaAscent) IS this
 * act's job — it's Act-3-internal content (the noAutoAdvance check, the
 * ice-path walk, and the sawAscent climb beat), ending just before the
 * genuine Act3→Act4 spine handoff (:1068-1072, the top gate into
 * minersCamp with act4Started) which this flow does not touch — mirroring
 * the Act1→Act2 boundary decision in the Task 4 report: an act's own
 * driveActN starts at the "checkpoint updated" check for its seeded zone
 * and ends at its own actNComplete flag (here, extended through the
 * in-act zone-6 beats that were mislabeled as spine handoff).
 * Every check() is removed and a snapshot(page) is captured into `beats` at
 * each point the source asserts. The matching assertions live in
 * tools/smoke/acts/act3.spec.ts.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "../kit/snapshot";
import {
  driveTriggersUntil,
  exitTo,
  healUp,
  teleport,
  tap,
  talkThrough,
  fightThrough,
  restPointCheck,
} from "../kit/actions";

/** Walk all of Act 3, capturing a beat snapshot wherever the source asserts. */
export async function driveAct3(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // ---------- Act 3: The Sunless Sea (a six-zone chain) ----------
  let s = await snapshot(page);
  beats.sunlessSeaCheckpoint = s;

  // Zone 1 (entry overlook): the comic Piggy-chase is a walk-over trigger.
  await healUp(page);
  s = await driveTriggersUntil(page, "sunlessSea", (x) => x.state.flags.sawChase);
  if (s.zoneKey !== "sunlessSea") s = await waitFor(page, (x) => x.zoneKey === "sunlessSea", 8000);
  beats.sawChase = s;

  // Zone 1 → Zone 2: the south gate leads on into the kelp forest.
  s = await exitTo(page, "sunlessSea", "kelpForest");
  beats.kelpForest = s;

  // Zone 2 (kelp forest): the entry cutscene grounds the player in the traversal zone.
  await healUp(page);
  s = await driveTriggersUntil(page, "kelpForest", (x) => x.state.flags.sawKelpForest);
  if (s.zoneKey !== "kelpForest") s = await waitFor(page, (x) => x.zoneKey === "kelpForest", 8000);
  beats.sawKelpForest = s;

  // The kelp-forest hub rest point (Act 3): a free, repeatable full heal.
  beats.kelpRest = await restPointCheck(page, "kelpForest", 16, 13, "Act 3 kelp forest");

  // Zone 2 → Zone 3 (dead-end pocket): the west spur drops into the sun-temple ruin.
  s = await exitTo(page, "kelpForest", "sunTemple");
  beats.sunTemple = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "sunTemple", (x) => x.state.flags.sawTempleEntry);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  // Inspect the carved sun-glyph for the lore beat.
  await teleport(page, 7, 7); // SUNTEMPLE_GLYPH
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  s = await snapshot(page);
  beats.sawTemple = s;

  // Back to the kelp forest, then down the south spur to Fluffball's kelp bed.
  s = await exitTo(page, "sunTemple", "kelpForest");
  beats.backToKelp = s;
  s = await exitTo(page, "kelpForest", "fluffballBed");
  beats.fluffballBed = s;
  await healUp(page);
  // Five-stage chase now (sighted -> 2 flees + 2 planning asides -> cornered
  // in the nook), each hop async (a ~550ms tween arms the next trigger) -
  // extra rounds so the driver's re-poll of the trigger list catches each
  // newly-armed stage.
  s = await driveTriggersUntil(page, "fluffballBed", (x) => x.state.flags.metFluffball, 14);
  if (s.zoneKey !== "fluffballBed") s = await waitFor(page, (x) => x.zoneKey === "fluffballBed", 8000);
  beats.metFluffball = s;

  // Back to the kelp forest, then the east fork on to the deep kelp bed.
  s = await exitTo(page, "fluffballBed", "kelpForest");
  beats.fluffballBackToKelp = s;
  s = await exitTo(page, "kelpForest", "deepBed");
  beats.deepBed = s;

  // Zone 5 (deep bed): the fishing climax, with the fixed pacing. The player
  // CASTS FIRST; the Lurker steals the line (that theft is what starts the
  // fight); once it's beaten off the line is intact and a recast lands the fish.
  await healUp(page);
  s = await driveTriggersUntil(page, "deepBed", (x) => x.state.flags.sawDeepBed);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "deepBed") s = await waitFor(page, (x) => x.zoneKey === "deepBed", 8000);
  await healUp(page);
  await teleport(page, 15, 9); // DEEP_FISHING
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  // seaFirstCast ("the line goes taut...") → lurkerIntro (the steal) → the fight.
  for (let i = 0; i < 8; i++) {
    const d = await snapshot(page);
    if (d.battle) break;
    if (d.dialogueOpen) await talkThrough(page);
    await page.waitForTimeout(200);
  }
  s = await waitFor(page, (x) => x.battle, 6000);
  beats.lurkerFight = s;
  s = await fightThrough(page, { timeoutMs: 180_000 });
  s = await waitFor(page, (x) => x.zoneKey === "deepBed", 12_000);
  beats.lurkerDefeated = s;

  // Recast: cast the line again and play the timing minigame. Read the pure
  // fishing state and only hook when the marker is well inside the glow.
  await healUp(page);
  await teleport(page, 15, 9);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  await talkThrough(page, { pickIndex: 0 }); // "Cast the line" → cast-end → opens the gauge
  await page.waitForTimeout(300);
  const menuOpen = await page.evaluate(
    () => !!(window as any).__game.scene.getScene("deepBed").fishingMenu
  );
  beats.fishingMenu = { ...(await snapshot(page)), menuOpen };

  const fishDeadline = Date.now() + 40_000;
  let caught = false;
  while (Date.now() < fishDeadline) {
    const fs = await page.evaluate(() => {
      const w = (window as any).__game.scene.getScene("deepBed");
      const m = w.fishingMenu;
      if (!m) return { open: false, caught: (window as any).__game.registry.get("act1").items.silverfin === true };
      return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
    });
    if (!fs.open) {
      caught = (fs as any).caught;
      break;
    }
    if (Math.abs(fs.p - fs.t) < fs.w * 0.5) await tap(page, "Space", 30);
    await page.waitForTimeout(25);
  }
  beats.fishCaught = { ...(await snapshot(page)), caught };
  s = await snapshot(page);
  beats.silverfin = s;

  // The catch freezes an ice path out of the bed; the party must WALK it to
  // leave (no auto-teleport on the ending dialogue closing).
  s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act3Complete === true, 8000);
  beats.act3Complete = s;

  // The catch freezes an ice path out of the bed; the party must WALK it
  // (no auto-teleport on the ending dialogue closing) to reach zone 6.
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.deepBedNoAutoAdvance = s;
  s = await exitTo(page, "deepBed", "seaAscent");
  beats.seaAscent = s;

  // Zone 6 (ascent): the climb beat plays.
  await healUp(page);
  s = await driveTriggersUntil(page, "seaAscent", (x) => x.state.flags.sawAscent === true);
  beats.sawAscent = s;

  return beats;
}
