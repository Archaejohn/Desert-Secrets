import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct6 } from "../flows/act6";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  const arr: string[] = [];
  (page as any).__pageErrors = arr;
  page.on("pageerror", (e) => arr.push(e.message));
});

test("Act 6 — the drowned reef (the crawlers' garden)", async ({ page }) => {
  await seed(page, fixture("act6-start"));
  const b = await driveAct6(page);

  // ---- zone 1: drowned stair ----
  expect(b.reefDescentCheckpoint.state.zone, "checkpoint updated to the drowned stair").toBe(
    "reefDescent"
  );
  expect(b.sawReefDescent.state.flags.sawReefDescent, "the drowned-stair arrival beat plays").toBe(
    true
  );

  // ---- zone 1 -> zone 2: crawlers' garden ----
  expect(b.reefGarden.zoneKey, "the descent leads into the crawlers' garden").toBe("reefGarden");
  expect(b.reefGarden.state.zone, "checkpoint updated to the crawlers' garden").toBe("reefGarden");
  expect(b.sawReefGarden.state.flags.sawReefGarden, "the crawlers'-garden entry beat plays").toBe(true);
  expect(b.reefGardenRest.ok, b.reefGardenRest.label).toBeTruthy();

  // ---- Fluffball keeps fighting ----
  expect(b.reefStalker.battle, "a reef stalker hunts the garden (Act 6 encounter starts)").toBe(true);
  expect(
    b.reefStalker.partyKeys.length === 3 &&
      b.reefStalker.partyKeys.includes("hero") &&
      b.reefStalker.partyKeys.includes("slither") &&
      b.reefStalker.partyKeys.includes("fluffball"),
    "Fluffball keeps fighting in Act 6: the party is hero + Slither + Fluffball (3 members)"
  ).toBeTruthy();

  // ---- zone 2 -> zone 3: coral warren ----
  expect(b.reefWarren.zoneKey, "the garden leads into the coral warren").toBe("reefWarren");
  expect(b.sawReefWarren.state.flags.sawReefWarren, "the coral-warren entry beat plays").toBe(true);
  expect(
    b.sawReefChase.state.flags.sawReefChase,
    "the tense chase-and-turn plays (Piggy frightened, slips away)"
  ).toBe(true);

  // ---- zone 3 -> zone 4: glowing hollow ----
  expect(b.reefHollow.zoneKey, "the warren leads into the glowing hollow").toBe("reefHollow");
  expect(b.sawReefHollow.state.flags.sawReefHollow, "the glowing-hollow entry beat plays").toBe(true);

  // ---- zone 4 -> zone 5: crawler court ----
  expect(b.reefCourt.zoneKey, "the hollow leads on to the crawler court").toBe("reefCourt");
  expect(b.reefCourt.state.zone, "checkpoint updated to the crawler court").toBe("reefCourt");
  expect(b.sawReefCourt.state.flags.sawReefCourt, "the crawler-court entry beat plays").toBe(true);

  // ---- the diplomacy: a trade, not a fight ----
  expect(
    b.wardenParley.parley.start === "meet" &&
      b.wardenParley.parley.ids.includes("trade-end") &&
      b.wardenParley.parley.ids.includes("affront") &&
      b.wardenParley.parley.bad === "affront",
    "the warden opens the trade-not-fight parley with BOTH branches wired"
  ).toBeTruthy();
  expect(
    b.avoidableFight.battle,
    "a bad approach starts the AVOIDABLE reef-stalker fight (not an instant one)"
  ).toBe(true);
  expect(
    b.reefFought.state.flags.reefFought === true && b.reefFought.state.flags.gotSeaweed !== true,
    "winning the avoidable fight sets reefFought (the crawlers were tested, not slain)"
  ).toBeTruthy();
  expect(
    b.seaweed.state.flags.gotSeaweed === true && b.seaweed.state.items.seaweed === true,
    "the crawlers trade the mint kelp — the seaweed (a new inventory item)"
  ).toBeTruthy();

  // ---- ending ----
  expect(
    b.act6Complete.state.flags.act6Complete,
    "Act 6 completes (reef mint kelp earned, tunnel opened)"
  ).toBe(true);
  expect(b.noAutoAdvance.zoneKey, "Act 6 does NOT auto-advance — still in the court").toBe("reefCourt");

  // ---- no uncaught page errors across the whole run ----
  expect((page as any).__pageErrors, "no page errors").toEqual([]);
});
