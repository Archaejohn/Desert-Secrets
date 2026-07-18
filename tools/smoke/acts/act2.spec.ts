import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct2 } from "../flows/act2";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  const arr: string[] = [];
  (page as any).__pageErrors = arr;
  page.on("pageerror", (e) => arr.push(e.message));
});

test("Act 2 — miners rescue to Rime Warden", async ({ page }) => {
  await seed(page, fixture("act2-start"));
  const b = await driveAct2(page);

  // ---- crevasse: Mo ----
  expect(b.mo.state.flags.minerMo, "Mo rescued in the crevasse").toBe(true);
  expect(b.reopenMo.talkedMo, "can reopen dialogue with the rescued Mo").toBe(true);
  expect(
    b.reopenMo.state.items.owned.minersHat === 1 &&
      b.reopenMo.state.items.shinies === b.reopenMo.shiniesBeforeBuy - 2,
    "buying the miner's hat from Mo adds it to the pool and spends 2 shinies"
  ).toBeTruthy();
  expect(b.maze.zoneKey, "crevasse leads to the ice maze").toBe("maze");

  // ---- maze: Edda, Slither ----
  expect(b.edda.state.flags.minerEdda, "Edda rescued in the maze").toBe(true);
  expect(
    b.slither.state.flags.metSlither === true && b.slither.state.flags.mazeShortcutOpen === true,
    "Slither opens the maze shortcut"
  ).toBeTruthy();
  expect(b.galleries.zoneKey, "maze exits reach the galleries").toBe("galleries");

  // ---- galleries: Gus, miners bonus, rime door ----
  expect(b.gus.state.flags.minerGus, "Gus rescued in the galleries").toBe(true);
  expect(b.minersBonus.state.flags.minersBonusGiven, "all-miners bonus perk granted").toBe(true);
  expect(
    b.slitherJoined.state.flags.slitherJoined === true &&
      b.slitherJoined.state.flags.rimeDoorOpen === true,
    "Slither joins the party at the rime door"
  ).toBeTruthy();
  expect(b.sanctum.zoneKey, "rime door opens the sanctum").toBe("sanctum");

  // ---- sanctum: Rime Warden ----
  expect(b.warden.state.flags.wardenDefeated, "Rime Warden defeated").toBe(true);
  expect(b.wardenParty.hadSlither, "Warden battle included Slither in the party").toBeTruthy();

  // ---- ending ----
  expect(b.act2Complete.state.flags.act2Complete, "Act 2 completes (two penguins seen)").toBe(true);
  expect(
    b.noAutoAdvance.zoneKey,
    "Act 2 does NOT auto-advance on the ending dialogue closing"
  ).toBe("sanctum");

  // ---- no uncaught page errors across the whole run ----
  expect((page as any).__pageErrors, "no page errors").toEqual([]);
});
