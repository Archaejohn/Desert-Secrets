/**
 * Act 5 flow — the Sunlit Cave-In (Sahra's underground orange grove inside
 * Cinnabar Mine, a five-zone chain: warm descent → grove approach → river
 * grotto → sunlit chamber → Sahra's corner), ported from
 * tools/smoke/e2e.mjs:1187-1317, plus the checkpoint check at :1192 (it sits
 * just above the "---------- Act 5:" source comment but reads the ZONE this
 * act is seeded into, so — mirroring how Act 4's own leading checkpoint
 * check at :1075 was kept in-act — it belongs here, not to the Act4→5
 * hand-off). The Act4→5 hand-off itself (:1187-1191, the "progress kept" /
 * act5Started check) is the spine's job and is excluded, as is the trailing
 * checkpoint check for Act 6's own start zone at :1324 (that one belongs to
 * Act 6, not Act 5 — see flows/act6.ts).
 *
 * The local `sahraTextWith` helper (originally a closure over `page` at
 * e2e.mjs:1272) is ported below as a file-local function that takes `page`
 * as its first argument instead.
 *
 * Every check() is removed and a snapshot(page) is captured into `beats` at
 * each point the source asserts. The matching assertions live in
 * tools/smoke/acts/act5.spec.ts.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "../kit/snapshot";
import { driveTriggersUntil, exitTo, healUp, teleport, tap, talkThrough, fightThrough } from "../kit/actions";

/**
 * Sahra's REACTIVE dialogue spot-check: her lines change with Act 1 choices.
 * Force a given Act-1 flag combination, then read her live script text.
 */
async function sahraTextWith(page: Page, flags: Record<string, boolean>): Promise<string> {
  await page.evaluate((f) => {
    const st = (window as any).__game.registry.get("act1");
    (window as any).__game.registry.set("act1", { ...st, flags: { ...st.flags, ...f } });
  }, flags);
  return page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("sahraGrove");
    const script = w.sahraScript();
    return script.nodes.flatMap((n: any) => n.lines.map((l: any) => l.text)).join(" ");
  });
}

/** Walk all of Act 5, capturing a beat snapshot wherever the source asserts. */
export async function driveAct5(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // ---------- Act 5: The Sunlit Cave-In (Sahra's grove, a five-zone chain) ----------
  beats.groveDescentCheckpoint = await snapshot(page);

  // Zone 1 (descent): the arrival beat grounds the warm-air/first-light reveal.
  await healUp(page);
  let s = await driveTriggersUntil(page, "groveDescent", (x) => x.state.flags.sawGroveDescent);
  if (s.zoneKey !== "groveDescent") s = await waitFor(page, (x) => x.zoneKey === "groveDescent", 8000);
  beats.sawGroveDescent = s;

  // Zone 1 → Zone 2: the south gate leads on into the grove approach.
  s = await exitTo(page, "groveDescent", "groveApproach");
  beats.groveApproach = s;

  // Zone 2 (approach): entry beat + the scared near-catch chase (Piggy bolts
  // into the needle-cactus, and for once it isn't funny).
  await healUp(page);
  s = await driveTriggersUntil(
    page,
    "groveApproach",
    (x) => x.state.flags.sawGroveApproach && x.state.flags.sawGroveChase
  );
  if (s.zoneKey !== "groveApproach") s = await waitFor(page, (x) => x.zoneKey === "groveApproach", 8000);
  beats.sawGroveApproach = s;
  beats.sawGroveChase = s;

  // Zone 2 → Zone 3: the south gate drops into the river grotto.
  s = await exitTo(page, "groveApproach", "groveGrotto");
  beats.groveGrotto = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "groveGrotto", (x) => x.state.flags.sawGroveGrotto);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "groveGrotto") s = await waitFor(page, (x) => x.zoneKey === "groveGrotto", 8000);
  beats.sawGroveGrotto = s;

  // Zone 3 → Zone 4: the south gate opens into the sunlit chamber.
  s = await exitTo(page, "groveGrotto", "groveChamber");
  beats.groveChamber = s;

  // Zone 4 (chamber): the reveal beat + Fluffball JOINS for real at the tree.
  await healUp(page);
  s = await driveTriggersUntil(
    page,
    "groveChamber",
    (x) => x.state.flags.sawGroveChamber && x.state.flags.fluffballJoined
  );
  if (s.zoneKey !== "groveChamber") s = await waitFor(page, (x) => x.zoneKey === "groveChamber", 8000);
  beats.sawGroveChamber = s;
  beats.fluffballJoined = s;

  // Fluffball is now a REAL combatant: joining adds him to the battle party.
  // Force a grove encounter and confirm the party is a three-strong
  // hero + Slither + Fluffball (the roster-driven 3-member layout).
  await page.evaluate(() => (window as any).__game.scene.getScene("groveChamber").startBattle(["sunwasp"]));
  s = await waitFor(page, (x) => x.battle, 6000);
  const partyKeys = await page.evaluate(() =>
    Array.from((window as any).__game.scene.getScene("battle").partyCommands.keys())
  );
  beats.sunwasp = { ...s, partyKeys };
  s = await fightThrough(page, { timeoutMs: 120_000 });
  s = await waitFor(page, (x) => x.zoneKey === "groveChamber", 12_000);

  // Zone 4 → Zone 5: the east gate leads on to Sahra's corner.
  s = await exitTo(page, "groveChamber", "sahraGrove");
  beats.sahraGrove = s;
  await healUp(page);
  s = await driveTriggersUntil(page, "sahraGrove", (x) => x.state.flags.sawSahraGrove);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
  if (s.zoneKey !== "sahraGrove") s = await waitFor(page, (x) => x.zoneKey === "sahraGrove", 8000);
  beats.sawSahraGrove = s;

  // Sahra's REACTIVE dialogue spot-check: read her live script under two
  // different Act-1 flag sets and confirm the text genuinely differs (the
  // game's first real callback payoff).
  const mercyParley = await sahraTextWith(page, {
    rabbitTradedColdPack: true,
    rabbitResolved: false,
    parleyed: true,
    queenResolved: false,
  });
  beats.sahraMercyParley = { ...(await snapshot(page)), text: mercyParley };
  const gritForce = await sahraTextWith(page, {
    rabbitTradedColdPack: false,
    rabbitResolved: true,
    parleyed: false,
    queenResolved: true,
  });
  beats.sahraGritForce = { ...(await snapshot(page)), text: gritForce };

  // Complete the trade (leave the grit+force flags in place): talk to Sahra,
  // take the oranges, roll the ending.
  await teleport(page, 11, 6); // just north of SAHRA_NPC (11,7)
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.gotOranges === true, 8000);
  beats.oranges = s;

  // The Act 5 ending opens Sahra's hidden door DOWN; the party must WALK to it
  // (no auto-teleport on the ending dialogue closing) — down into Act 6's reef.
  s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act5Complete === true, 9000);
  beats.act5Complete = s;
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.noAutoAdvance = s;

  return beats;
}
