/**
 * Act 2 flow — miners rescue → Rime Warden, ported from
 * tools/smoke/e2e.mjs:777-921 (the crevasse→maze→galleries→sanctum chain;
 * the Act1→Act2 tunnel-walk transition at :754-764/922-932 and the
 * reload/Continue check at :766-776 are the spine's job, not this act's —
 * see the Task 4 report). Every check() is removed and a snapshot(page) is
 * captured into `beats` at each point the source asserts. The matching
 * assertions live in tools/smoke/acts/act2.spec.ts.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "../kit/snapshot";
import {
  talkAllNpcs,
  driveTriggersUntil,
  exitTo,
  talkToNpc,
  talkThrough,
  fightThrough,
  healUp,
} from "../kit/actions";

/** Walk all of Act 2, capturing a beat snapshot wherever the source asserts. */
export async function driveAct2(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // Crevasse: rescue Mo, move on to the maze.
  await talkAllNpcs(page, "crevasse");
  let s = await snapshot(page);
  beats.mo = s;

  // Mo's shop: once rescued he sells the miner's hat for 2 shinies. Top up the
  // purse, talk to him, take the "Buy" choice (index 0) and confirm the hat is
  // granted and the shinies spent.
  await page.waitForTimeout(2500); // let Mo finish walking to the camp corner
  const shiniesBeforeBuy = 3;
  await page.evaluate((n) => {
    const st = (window as any).__game.registry.get("act1");
    (window as any).__game.registry.set("act1", { ...st, items: { ...st.items, shinies: n } });
  }, shiniesBeforeBuy);
  const talkedMo = await talkToNpc(page, "crevasse", 0);
  await talkThrough(page, { pickIndex: 0 }); // pick "Buy the miner's hat"
  s = await snapshot(page);
  beats.reopenMo = { ...s, talkedMo, shiniesBeforeBuy };

  s = await exitTo(page, "crevasse", "maze");
  beats.maze = s;

  // Maze: Edda, Slither's crack, shards, then out to the galleries.
  await talkAllNpcs(page, "maze");
  s = await driveTriggersUntil(page, "maze", (x) => x.state.flags.metSlither && x.state.flags.minerEdda);
  s = await snapshot(page);
  beats.edda = s;
  beats.slither = s;
  if (s.zoneKey !== "maze") {
    // A trigger bounced us to a neighbouring zone; walk back in.
    s = await exitTo(page, s.zoneKey, "maze");
  }
  s = await exitTo(page, "maze", "galleries");
  beats.galleries = s;

  // Galleries: Gus, miners bonus, rime door -> Slither joins.
  await talkAllNpcs(page, "galleries");
  s = await snapshot(page);
  beats.gus = s;
  beats.minersBonus = s;
  s = await driveTriggersUntil(page, "galleries", (x) => x.state.flags.slitherJoined);
  s = await snapshot(page);
  beats.slitherJoined = s;
  if (s.zoneKey !== "galleries") s = await exitTo(page, s.zoneKey, "galleries");
  s = await exitTo(page, "galleries", "sanctum");
  beats.sanctum = s;

  // Sanctum: Warden boss with the two-member party.
  await healUp(page);
  // The trigger driver plays the intro dialogue and fights the boss itself.
  s = await driveTriggersUntil(page, "sanctum", (x) => x.state.flags.wardenDefeated === true);
  if (s.battle) {
    s = await fightThrough(page, { timeoutMs: 180_000 });
    s = await waitFor(page, (x) => x.zoneKey === "sanctum", 12_000);
  }
  beats.warden = s;
  // The battle scene retains its last battle: confirm the party was two-strong.
  const partySize = await page.evaluate(() => {
    const b = (window as any).__game.scene.getScene("battle");
    return b["battle"]
      ? b["battle"].livingOn("party").length + (b["battle"].getCombatant("slither") ? 0 : 0)
      : 0;
  });
  const hadSlither = await page.evaluate(() => {
    const b = (window as any).__game.scene.getScene("battle");
    try {
      return !!b["battle"]?.getCombatant("slither");
    } catch {
      return false;
    }
  });
  beats.wardenParty = { ...(await snapshot(page)), hadSlither, partySize };

  // Ending: the crack-and-crossing cutscene runs long — wait for its
  // dialogue, play it through, then wait for the completion flag.
  s = await waitFor(page, (x) => x.dialogueOpen === true, 30_000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act2Complete === true, 10_000);
  beats.act2Complete = s;
  // No forced advance: the party must FOLLOW the penguins into the far tunnel.
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.noAutoAdvance = s;

  return beats;
}
