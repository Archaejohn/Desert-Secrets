import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct3 } from "../flows/act3";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  const arr: string[] = [];
  (page as any).__pageErrors = arr;
  page.on("pageerror", (e) => arr.push(e.message));
});

test("Act 3 — the Sunless Sea", async ({ page }) => {
  await seed(page, fixture("act3-start"));
  const b = await driveAct3(page);

  // ---- zone 1: entry overlook ----
  expect(b.sunlessSeaCheckpoint.state.zone, "checkpoint updated to the sunless sea entry").toBe(
    "sunlessSea"
  );
  expect(b.sawChase.state.flags.sawChase, "Piggy's chase cutscene plays in the entry overlook").toBe(
    true
  );

  // ---- zone 1 -> zone 2: kelp forest ----
  expect(b.kelpForest.zoneKey, "the entry overlook leads into the kelp forest").toBe("kelpForest");
  expect(b.kelpForest.state.zone, "checkpoint updated to the kelp forest").toBe("kelpForest");
  expect(b.sawKelpForest.state.flags.sawKelpForest, "the kelp forest entry beat plays").toBe(true);
  expect(b.kelpRest.ok, b.kelpRest.label).toBeTruthy();

  // ---- zone 2 -> zone 3: sun temple ----
  expect(b.sunTemple.zoneKey, "the west spur reaches the flooded sun-temple").toBe("sunTemple");
  expect(b.sawTemple.state.flags.sawTemple, "the flooded sun-temple lore beat plays").toBe(true);

  // ---- back to kelp forest -> Fluffball's bed ----
  expect(b.backToKelp.zoneKey, "the sun-temple leads back to the kelp forest").toBe("kelpForest");
  expect(b.fluffballBed.zoneKey, "the south spur reaches Fluffball's kelp bed").toBe("fluffballBed");
  expect(b.metFluffball.state.flags.metFluffball, "Fluffball glimpsed, drops the silverfin clue").toBe(
    true
  );

  // ---- back to kelp forest -> deep bed ----
  expect(b.fluffballBackToKelp.zoneKey, "Fluffball's bed leads back to the kelp forest").toBe(
    "kelpForest"
  );
  expect(b.deepBed.zoneKey, "the east fork reaches the deep kelp bed").toBe("deepBed");

  // ---- zone 5: the fishing climax ----
  expect(b.lurkerFight.battle, "casting first makes the Lurker steal the line and start the fight").toBe(
    true
  );
  expect(
    b.lurkerDefeated.state.flags.lurkerDefeated === true &&
      b.lurkerDefeated.state.items.silverfin !== true,
    "the Lurker is fought off with the line still intact (no fish yet)"
  ).toBeTruthy();
  expect(b.fishingMenu.menuOpen, "recasting opens the fishing timing minigame").toBe(true);
  expect(b.fishCaught.caught, "the fishing minigame lands the silverfin").toBe(true);
  expect(
    b.silverfin.state.items.silverfin === true && b.silverfin.state.flags.silverfinCaught === true,
    "silverfin recorded in the inventory"
  ).toBeTruthy();

  // ---- ending ----
  expect(
    b.act3Complete.state.flags.act3Complete,
    "Act 3 completes (silverfin caught, ice path frozen)"
  ).toBe(true);

  // ---- no uncaught page errors across the whole run ----
  expect((page as any).__pageErrors, "no page errors").toEqual([]);
});
