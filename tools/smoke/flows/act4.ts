/**
 * Act 4 flow — Dirty Laundry, the Miners' Camp (a five-zone chain:
 * outskirts → camp proper → laundry nook → back gallery → ledge), ported
 * from tools/smoke/e2e.mjs:1075-1185. The Act3→Act4 ascent/hand-off
 * (:1057-1074, Act 3's own zone 6) is the spine's job, not this act's —
 * mirroring the Act1→Act2 and Act2→Act3 boundary decisions: an act's own
 * driveActN starts at the "checkpoint updated" check for its seeded zone
 * and ends at its own actNComplete flag + no-auto-advance check. Every
 * check() is removed and a snapshot(page) is captured into `beats` at each
 * point the source asserts. The matching assertions live in
 * tools/smoke/acts/act4.spec.ts.
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
  talkToNpc,
  restPointCheck,
  type RestPointResult,
} from "../kit/actions";

/** Walk all of Act 4, capturing a beat snapshot wherever the source asserts.
 *  `campRest` is restPointCheck's own {ok,label,detail} result, not a Snap —
 *  called out in the return type so specs can read it typed. */
export async function driveAct4(
  page: Page
): Promise<Record<string, Snap> & { campRest: RestPointResult }> {
  const beats: Record<string, Snap> = {};

  // ---------- Act 4: Dirty Laundry (the Miners' Camp, a five-zone chain) ----------
  let s = await snapshot(page);
  beats.minersCampCheckpoint = s;

  // Zone 1 (outskirts): the arrival beat grounds the night-raid storytelling.
  await healUp(page);
  s = await driveTriggersUntil(page, "minersCamp", (x) => x.state.flags.sawOutskirts);
  if (s.zoneKey !== "minersCamp") s = await waitFor(page, (x) => x.zoneKey === "minersCamp", 8000);
  beats.sawOutskirts = s;

  // Zone 1 → Zone 2: the south gate leads on into the camp proper.
  s = await exitTo(page, "minersCamp", "campProper");
  beats.campProper = s;

  // Zone 2 (camp proper): the entry beat and the comic crate chase (walk-overs).
  await healUp(page);
  s = await driveTriggersUntil(
    page,
    "campProper",
    (x) => x.state.flags.sawCamp && x.state.flags.sawCrateChase
  );
  if (s.zoneKey !== "campProper") s = await waitFor(page, (x) => x.zoneKey === "campProper", 8000);
  beats.campEntry = s;

  // The camp-stove rest point (Act 4): a free, repeatable full heal.
  // Not a Snap shape — see the function's return type.
  (beats as any).campRest = await restPointCheck(page, "campProper", 16, 11, "Act 4 miners' camp");

  // Talk to a miner: the favor-quest hook (clear the mites for the socks).
  const favorOpened = await talkToNpc(page, "campProper", 0);
  if (favorOpened) await talkThrough(page);
  beats.favorQuest = { ...(await snapshot(page)), favorOpened };

  // Zone 2 → Zone 3 (dead-end pocket): the west gap drops into the laundry nook.
  s = await exitTo(page, "campProper", "laundryNook");
  beats.laundryNook = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "laundryNook", (x) => x.state.flags.sawNook);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "laundryNook") s = await waitFor(page, (x) => x.zoneKey === "laundryNook", 8000);
  beats.sawNook = s;

  // The midden-mite nest: an InteractPoint (press E) → forced swarm battle.
  await healUp(page);
  await teleport(page, 4, 7); // NOOK_NEST
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // nest intro → battle
  s = await waitFor(page, (x) => x.battle, 6000);
  beats.miteBattle = s;
  s = await fightThrough(page, { timeoutMs: 120_000 });
  s = await waitFor(page, (x) => x.zoneKey === "laundryNook", 12_000);
  beats.middenCleared = s;

  // Zone 3 → back to the camp proper, then east and up the back gallery.
  s = await exitTo(page, "laundryNook", "campProper");
  beats.nookToCampProper = s;
  s = await exitTo(page, "campProper", "campGallery");
  beats.campGallery = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "campGallery", (x) => x.state.flags.sawGallery);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "campGallery") s = await waitFor(page, (x) => x.zoneKey === "campGallery", 8000);
  beats.sawGallery = s;

  // Zone 4 → Zone 5 (dead-end vantage): the gallery climbs to Fluffball's ledge.
  s = await exitTo(page, "campGallery", "campLedge");
  beats.campLedge = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "campLedge", (x) => x.state.flags.fluffballLedge);
  if (s.zoneKey !== "campLedge") s = await waitFor(page, (x) => x.zoneKey === "campLedge", 8000);
  beats.fluffballLedge = s;

  // Back down through the gallery to the camp proper for the sock hand-over.
  s = await exitTo(page, "campLedge", "campGallery");
  beats.backToGallery = s;
  s = await exitTo(page, "campGallery", "campProper");
  beats.backToCampProper = s;

  // The sock line: an InteractPoint that hands over the reeking socks.
  await teleport(page, 6, 6); // CAMPP_SOCKS
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // reward dialogue
  s = await waitFor(page, (x) => x.state.flags.gotSocks === true, 8000);
  beats.socks = s;

  // The "reeks" mechanic has a concrete, testable effect on encounters: while
  // the socks are held, the scene swaps in the reek-adjusted table, dropping
  // every frost-scarab group's weight to 1 (mites, who love the smell, keep
  // their weight). encounterTable() is the live source the encounter clock uses.
  const reekEffect = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("campProper");
    const held = w.encounterTable(); // reads items.stinkySocks live
    return { weights: held.weights, stinky: (window as any).__game.registry.get("act1").items.stinkySocks };
  });
  beats.reekEffect = { ...(await snapshot(page)), reekEffect };

  // The Act 4 ending opens a stairwell DOWN; the party must WALK to it (no auto-
  // teleport on the ending dialogue closing) — down into Act 5's warm descent.
  s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act4Complete === true, 8000);
  beats.act4Complete = s;
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.noAutoAdvance = s;

  return beats as Record<string, Snap> & { campRest: RestPointResult };
}
