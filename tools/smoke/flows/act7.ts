/**
 * Act 7 flow — La Pizzeria Sotterranea, the finale that closes Part One (a
 * five-zone chain: warm descent → lava vents → old kitchens → the pizzeria
 * itself → the finale ascent), ported from tools/smoke/e2e.mjs:1464-1611.
 * The Act6→7 hand-off (:1457-1462, the "progress kept" / act7Started check)
 * is the spine's job and is excluded — mirroring every prior act boundary —
 * but unlike Acts 4-6, the source has NO separate trailing "checkpoint
 * updated to X" check for Act 7's own start zone (pizzaDescent), so nothing
 * else is deferred out of this flow.
 *
 * Act 7 is the last act: there is no Act7→8 hand-off to exclude. This flow
 * covers EVERYTHING through act7Complete/partOneComplete, the END OF PART
 * ONE card, the Part-Two-opening cutscene's four radio lines, and the final
 * return to the title (`boot`) scene.
 *
 * Every check() is removed and a snapshot(page) is captured into `beats` at
 * each point the source asserts. The matching assertions live in
 * tools/smoke/acts/act7.spec.ts.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, type Snap } from "../kit/snapshot";
import { driveTriggersUntil, exitTo, healUp, teleport, tap, talkThrough, talkToNpc } from "../kit/actions";

/** Walk all of Act 7 through the END OF PART ONE card and back to the title. */
export async function driveAct7(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // ---------- Act 7: La Pizzeria Sotterranea (the finale — closing Part One) ----------
  beats.pizzaDescentCheckpoint = await snapshot(page);

  // Zone 1 (warm descent): the tomato-pie smell (the Act 2 seed) → into the vents.
  await healUp(page);
  let s = await driveTriggersUntil(page, "pizzaDescent", (x) => x.state.flags.sawPizzaDescent);
  if (s.zoneKey !== "pizzaDescent") s = await waitFor(page, (x) => x.zoneKey === "pizzaDescent", 8000);
  beats.sawPizzaDescent = s;
  s = await exitTo(page, "pizzaDescent", "pizzaVent");
  beats.pizzaVent = s;

  // Zone 2 (lava vents): entry beat → south into the old kitchens.
  s = await driveTriggersUntil(page, "pizzaVent", (x) => x.state.flags.sawPizzaVent);
  if (s.zoneKey !== "pizzaVent") s = await waitFor(page, (x) => x.zoneKey === "pizzaVent", 8000);
  beats.sawPizzaVent = s;
  s = await exitTo(page, "pizzaVent", "pizzaApproach");
  beats.pizzaApproach = s;

  // Zone 3 (old kitchens): entry beat → south into the restaurant.
  s = await driveTriggersUntil(page, "pizzaApproach", (x) => x.state.flags.sawPizzaApproach);
  if (s.zoneKey !== "pizzaApproach") s = await waitFor(page, (x) => x.zoneKey === "pizzaApproach", 8000);
  beats.sawPizzaApproach = s;
  s = await exitTo(page, "pizzaApproach", "pizzeria");
  beats.pizzeria = s;

  // Zone 4 (the pizzeria): meet Testudo → the bake → the catch → the reveal.
  s = await driveTriggersUntil(page, "pizzeria", (x) => x.state.flags.metTestudo);
  if (s.zoneKey !== "pizzeria") s = await waitFor(page, (x) => x.zoneKey === "pizzeria", 8000);
  beats.metTestudo = s;

  // THE BAKE: talk to Testudo → "Bake the pizza." → the cooking timing minigame.
  await talkToNpc(page, "pizzeria", 0);
  await talkThrough(page, { pickIndex: 0, maxSteps: 40 }); // "Bake the pizza." → bake-end
  await page.waitForTimeout(300);
  const cookOpen = await page.evaluate(() => !!(window as any).__game.scene.getScene("pizzeria").cookingMenu);
  beats.cookOpen = { ...(await snapshot(page)), cookOpen };

  // Drive the bake: read the pure cooking state, PLACE only when the heat marker
  // is well inside the glowing band (four clean toppings → a perfect pizza).
  const cookDeadline = Date.now() + 45_000;
  let baked = false;
  while (Date.now() < cookDeadline) {
    const cs = await page.evaluate(() => {
      const w = (window as any).__game.scene.getScene("pizzeria");
      const m = w.cookingMenu;
      if (!m) return { open: false, baked: (window as any).__game.registry.get("act1").flags.pizzaBaked === true };
      return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
    });
    if (!cs.open) {
      baked = (cs as any).baked;
      break;
    }
    if (Math.abs(cs.p - cs.t) < cs.w * 0.5) await tap(page, "Space", 30);
    await page.waitForTimeout(25);
  }
  beats.baked = { ...(await snapshot(page)), baked };
  s = await waitFor(page, (x) => x.state.flags.pizzaBaked === true, 8000);
  beats.pizzaBaked = s;

  // THE CATCH (a warm reunion, NOT a chase): Piggy comes to the smell, is caught.
  s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.piggyCaught === true, 9000);
  beats.piggyCaught = s;

  // THE REVEAL (the glacier/old-ocean secret — the ONE mystery that resolves).
  s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.heardReveal === true, 9000);
  beats.heardReveal = s;

  // The reveal opens the stairs UP; the party must WALK to them (no auto-teleport
  // on the reveal dialogue closing) — up into the finale climb, Piggy following.
  await page.waitForTimeout(400);
  s = await snapshot(page);
  beats.noAutoAdvanceReveal = s;
  s = await exitTo(page, "pizzeria", "pizzaAscent");
  beats.pizzaAscent = s;

  // Zone 5 (the ascent): the arrival beat (auto-fires on spawn), then the finale.
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await snapshot(page);
  if (!s.state.flags.sawPizzaAscent) {
    await teleport(page, 10, 14);
    await page.waitForTimeout(400);
    if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
    s = await snapshot(page);
  }
  beats.sawPizzaAscent = s;

  // The finale: walk into the top trigger → Rosa's radio crackles back, then the
  // floor gives way. A deliberate END OF PART ONE cliffhanger.
  const finaleRect = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("pizzaAscent");
    return w.triggers[w.triggers.length - 1].rect; // the finale trigger (added last)
  });
  await teleport(page, finaleRect.x1, finaleRect.y1);
  await page.waitForTimeout(500);
  s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
  if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await waitFor(page, (x) => x.state.flags.act7Complete === true, 12_000);
  beats.act7Complete = s;
  await page.waitForTimeout(700);

  // The END OF PART ONE card → hands off into the Part Two opening cutscene
  // (Joseph and Thomas finally connecting over the radio).
  await tap(page, "Space");
  const atPartTwo = await waitFor(page, (x) => x.active?.includes("partTwoOpening"), 9000);
  beats.partTwoOpening = atPartTwo;

  // The cutscene plays its four radio lines; advance through them.
  const cutsceneDialogueOpen = () =>
    page.evaluate(() => (window as any).__game.scene.getScene("partTwoOpening")?.dialogue?.isOpen ?? false);
  let linesSeen = 0;
  for (let i = 0; i < 12; i++) {
    if (!(await cutsceneDialogueOpen())) break;
    linesSeen++;
    await tap(page, "Space");
    await page.waitForTimeout(200);
  }
  beats.fourRadioLines = { ...(await snapshot(page)), linesSeen };

  // The "to be continued" beat → SPACE returns to the title (Part Two's rest
  // isn't built yet).
  await page.waitForTimeout(200);
  await tap(page, "Space");
  const backAtTitle = await waitFor(page, (x) => x.active?.includes("boot"), 9000);
  beats.backAtTitle = backAtTitle;

  return beats;
}
