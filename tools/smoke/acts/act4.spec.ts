import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct4 } from "../flows/act4";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  const arr: string[] = [];
  (page as any).__pageErrors = arr;
  page.on("pageerror", (e) => arr.push(e.message));
});

test("Act 4 — the Miners' Camp (Dirty Laundry)", async ({ page }) => {
  await seed(page, fixture("act4-start"));
  const b = await driveAct4(page);

  // ---- zone 1: outskirts ----
  expect(b.minersCampCheckpoint.state.zone, "checkpoint updated to the camp outskirts").toBe(
    "minersCamp"
  );
  expect(b.sawOutskirts.state.flags.sawOutskirts, "the camp-outskirts arrival beat plays").toBe(true);

  // ---- zone 1 -> zone 2: camp proper ----
  expect(b.campProper.zoneKey, "the outskirts lead into the camp proper").toBe("campProper");
  expect(b.campProper.state.zone, "checkpoint updated to the camp proper").toBe("campProper");
  expect(b.campEntry.state.flags.sawCamp, "the camp-proper entry beat plays").toBe(true);
  expect(b.campEntry.state.flags.sawCrateChase, "Piggy's crate-raid chase plays").toBe(true);
  expect(b.campRest.ok, b.campRest.label).toBeTruthy();
  expect(b.favorQuest.favorOpened, "a miner explains the favor-quest").toBeTruthy();

  // ---- zone 2 -> zone 3: laundry nook, midden-mite nest ----
  expect(b.laundryNook.zoneKey, "the west gap reaches the laundry nook").toBe("laundryNook");
  expect(b.sawNook.state.flags.sawNook, "the laundry-nook entry beat plays").toBe(true);
  expect(b.miteBattle.battle, "the midden-mite nest battle starts in the laundry nook").toBe(true);
  expect(b.middenCleared.state.flags.middenCleared, "the midden-mite nest is cleared").toBe(true);

  // ---- back to camp proper -> zone 4: back gallery ----
  expect(b.nookToCampProper.zoneKey, "the laundry nook leads back to the camp proper").toBe(
    "campProper"
  );
  expect(b.campGallery.zoneKey, "the east gate reaches the back gallery").toBe("campGallery");
  expect(b.sawGallery.state.flags.sawGallery, "the back-gallery entry beat plays").toBe(true);

  // ---- zone 4 -> zone 5: Fluffball's ledge ----
  expect(b.campLedge.zoneKey, "the gallery climbs to the overlook ledge").toBe("campLedge");
  expect(b.fluffballLedge.state.flags.fluffballLedge, "Fluffball glimpsed on the ledge, drops clue #2").toBe(
    true
  );

  // ---- back down to camp proper for the sock hand-over ----
  expect(b.backToGallery.zoneKey, "the ledge leads back down to the gallery").toBe("campGallery");
  expect(b.backToCampProper.zoneKey, "the gallery leads back to the camp proper").toBe("campProper");
  expect(
    b.socks.state.flags.gotSocks === true && b.socks.state.items.stinkySocks === true,
    "the miners hand over the stinky socks (a new inventory item)"
  ).toBeTruthy();
  expect(
    b.reekEffect.reekEffect.stinky === true &&
      JSON.stringify(b.reekEffect.reekEffect.weights) === JSON.stringify([3, 1, 2, 1]),
    "carrying the socks reweights encounters so frost scarabs avoid the party"
  ).toBeTruthy();

  // ---- ending ----
  expect(
    b.act4Complete.state.flags.act4Complete,
    "Act 4 completes (stinky socks earned, stairwell opened)"
  ).toBe(true);
  expect(b.noAutoAdvance.zoneKey, "Act 4 does NOT auto-advance — still in the camp").toBe("campProper");

  // ---- no uncaught page errors across the whole run ----
  expect((page as any).__pageErrors, "no page errors").toEqual([]);
});
