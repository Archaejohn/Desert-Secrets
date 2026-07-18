/**
 * Act 6 flow — the drowned reef (the crawlers' garden, a five-zone chain:
 * drowned stair → crawlers' garden → coral warren → glowing hollow →
 * crawler court), ported from tools/smoke/e2e.mjs:1319-1456, plus the
 * checkpoint check at :1324 (it belongs to THIS act — the zone it reads is
 * Act 6's own seeded start zone — mirroring how Act 5's leading checkpoint
 * check at :1192 was kept in Act 5's own flow despite sitting just above the
 * act's source comment). The Act5→6 hand-off itself (:1319-1323, the
 * "progress kept" / act6Started check) is the spine's job and is excluded.
 * Act 6→7's hand-off (:1457-1462, the "progress kept" / act7Started check)
 * is likewise excluded — it has no matching trailing checkpoint check for
 * Act 7's own start zone in the source (Act 7 doesn't have one), so nothing
 * else is deferred to Act 7's flow.
 *
 * Every check() is removed and a snapshot(page) is captured into `beats` at
 * each point the source asserts. The matching assertions live in
 * tools/smoke/acts/act6.spec.ts.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "../kit/snapshot";
import {
  driveTriggersUntil,
  exitTo,
  healUp,
  talkThrough,
  fightThrough,
  talkToNpc,
  restPointCheck,
} from "../kit/actions";

/** Walk all of Act 6, capturing a beat snapshot wherever the source asserts. */
export async function driveAct6(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // ---------- Act 6: The Reef (the crawlers' garden, a five-zone chain) ----------
  beats.reefDescentCheckpoint = await snapshot(page);

  // Zone 1 (descent): the arrival beat grounds the back-underwater reveal.
  await healUp(page);
  let s = await driveTriggersUntil(page, "reefDescent", (x) => x.state.flags.sawReefDescent);
  if (s.zoneKey !== "reefDescent") s = await waitFor(page, (x) => x.zoneKey === "reefDescent", 8000);
  beats.sawReefDescent = s;

  // Zone 1 → Zone 2: the south gate leads on into the crawlers' garden.
  s = await exitTo(page, "reefDescent", "reefGarden");
  beats.reefGarden = s;

  // Zone 2 (garden): entry beat + a reef encounter that confirms Fluffball keeps
  // fighting (the party is the three-strong hero + Slither + Fluffball) — same as
  // Act 5, now that Fluffball is a real combatant.
  await healUp(page);
  s = await driveTriggersUntil(page, "reefGarden", (x) => x.state.flags.sawReefGarden);
  if (s.zoneKey !== "reefGarden") s = await waitFor(page, (x) => x.zoneKey === "reefGarden", 8000);
  beats.sawReefGarden = s;

  // The mint-kelp rows rest point (Act 6): a free, repeatable full heal, right
  // before the reefstalker fight below.
  beats.reefGardenRest = await restPointCheck(page, "reefGarden", 21, 9, "Act 6 crawlers' garden");

  await page.evaluate(() => (window as any).__game.scene.getScene("reefGarden").startBattle(["reefstalker"]));
  s = await waitFor(page, (x) => x.battle, 6000);
  const reefParty = await page.evaluate(() =>
    Array.from((window as any).__game.scene.getScene("battle").partyCommands.keys())
  );
  beats.reefStalker = { ...s, partyKeys: reefParty };
  s = await fightThrough(page, { timeoutMs: 120_000 });
  s = await waitFor(page, (x) => x.zoneKey === "reefGarden", 12_000);

  // Zone 2 → Zone 3: the south gate drops into the coral warren.
  s = await exitTo(page, "reefGarden", "reefWarren");
  beats.reefWarren = s;

  // Zone 3 (warren): entry beat + the TENSE chase-and-turn (Piggy cornered for
  // real, frightened, slips through a gap; Fluffball — not Joseph — calls after).
  await healUp(page);
  s = await driveTriggersUntil(
    page,
    "reefWarren",
    (x) => x.state.flags.sawReefWarren && x.state.flags.sawReefChase
  );
  if (s.zoneKey !== "reefWarren") s = await waitFor(page, (x) => x.zoneKey === "reefWarren", 8000);
  beats.sawReefWarren = s;
  beats.sawReefChase = s;

  // Zone 3 → Zone 4: the south gate opens into the glowing hollow.
  s = await exitTo(page, "reefWarren", "reefHollow");
  beats.reefHollow = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "reefHollow", (x) => x.state.flags.sawReefHollow);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "reefHollow") s = await waitFor(page, (x) => x.zoneKey === "reefHollow", 8000);
  beats.sawReefHollow = s;

  // Zone 4 → Zone 5: the south gate leads on to the crawler court.
  s = await exitTo(page, "reefHollow", "reefCourt");
  beats.reefCourt = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "reefCourt", (x) => x.state.flags.sawReefCourt);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "reefCourt") s = await waitFor(page, (x) => x.zoneKey === "reefCourt", 8000);
  beats.sawReefCourt = s;

  // --- The diplomacy: a TRADE, not a fight (a queen-shaped branch point) ---
  // First, introspect the warden's live parley: both branches must be wired — a
  // courteous first choice leads on toward the trade, a rude one to `affront`.
  const parley = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("reefCourt");
    const scr = w.wardenScript(); // the reefParley branch point (pre-fight, pre-trade)
    const ids = scr.nodes.map((n: any) => n.id);
    const meet = scr.nodes.find((n: any) => n.id === scr.start);
    return { ids, good: meet.choices?.[0]?.next, bad: meet.choices?.[1]?.next, start: scr.start };
  });
  beats.wardenParley = { ...(await snapshot(page)), parley };

  // The AVOIDABLE fight-fallback path: a BAD approach (the rude first choice)
  // calls a reef predator down — an avoidable BattleScene, not an instant one.
  await talkToNpc(page, "reefCourt", 0);
  await talkThrough(page, { pickIndex: 1, maxSteps: 40 }); // grab the kelp → affront
  s = await waitFor(page, (x) => x.battle, 8000);
  beats.avoidableFight = s;
  s = await fightThrough(page, { timeoutMs: 150_000 });
  s = await waitFor(page, (x) => x.zoneKey === "reefCourt", 12_000);
  beats.reefFought = s;

  // Post-fight, the crawlers relent — talk again and they trade the kelp in peace
  // (the successful trade: seaweed, a new inventory item, changes hands).
  await talkToNpc(page, "reefCourt", 0);
  await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.gotSeaweed === true, 8000);
  beats.seaweed = s;

  // The Act 6 ending scrapes open a tunnel DOWN; the party must WALK to it (no
  // auto-teleport on the ending dialogue closing) — down into Act 7's descent.
  s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act6Complete === true, 9000);
  beats.act6Complete = s;
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.noAutoAdvance = s;

  return beats;
}
