import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct5 } from "../flows/act5";
import { installPageErrors, getPageErrors } from "../kit/errors";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  installPageErrors(page);
});

test("Act 5 — the Sunlit Cave-In (Sahra's underground orange grove)", async ({ page }) => {
  await seed(page, fixture("act5-start"));
  const b = await driveAct5(page);

  // ---- zone 1: warm descent ----
  expect(b.groveDescentCheckpoint.state.zone, "checkpoint updated to the warm descent").toBe(
    "groveDescent"
  );
  expect(
    b.sawGroveDescent.state.flags.sawGroveDescent,
    "the warm-descent arrival beat plays"
  ).toBe(true);

  // ---- zone 1 -> zone 2: grove approach ----
  expect(b.groveApproach.zoneKey, "the descent leads into the grove approach").toBe("groveApproach");
  expect(b.groveApproach.state.zone, "checkpoint updated to the grove approach").toBe("groveApproach");
  expect(
    b.sawGroveApproach.state.flags.sawGroveApproach,
    "the grove-approach entry beat plays"
  ).toBe(true);
  expect(
    b.sawGroveChase.state.flags.sawGroveChase,
    "the scared near-catch chase plays (Piggy bolts, not playing)"
  ).toBe(true);

  // ---- zone 2 -> zone 3: river grotto ----
  expect(b.groveGrotto.zoneKey, "the approach leads into the river grotto").toBe("groveGrotto");
  expect(b.sawGroveGrotto.state.flags.sawGroveGrotto, "the river-grotto entry beat plays").toBe(true);

  // ---- zone 3 -> zone 4: sunlit chamber ----
  expect(b.groveChamber.zoneKey, "the grotto leads into the sunlit cave-in").toBe("groveChamber");
  expect(b.groveChamber.state.zone, "checkpoint updated to the sunlit cave-in").toBe("groveChamber");
  expect(
    b.sawGroveChamber.state.flags.sawGroveChamber,
    "the sunlit-cave-in reveal beat plays"
  ).toBe(true);
  expect(
    b.fluffballJoined.state.flags.fluffballJoined,
    "Fluffball joins the party in the grove chamber"
  ).toBe(true);

  // ---- Fluffball's first fight as a real combatant ----
  expect(b.sunwasp.battle, "a sunwasp guards the grove (Act 5 encounter starts)").toBe(true);
  expect(
    b.sunwasp.partyKeys.length === 3 &&
      b.sunwasp.partyKeys.includes("hero") &&
      b.sunwasp.partyKeys.includes("slither") &&
      b.sunwasp.partyKeys.includes("fluffball"),
    "Fluffball fights: the Act 5 party is hero + Slither + Fluffball (3 members)"
  ).toBeTruthy();

  // ---- zone 4 -> zone 5: Sahra's corner ----
  expect(b.sahraGrove.zoneKey, "the chamber leads on to Sahra's grove").toBe("sahraGrove");
  expect(b.sawSahraGrove.state.flags.sawSahraGrove, "Sahra's-grove entry beat plays").toBe(true);

  // ---- Sahra's reactive dialogue spot-check ----
  expect(
    /mercy/i.test(b.sahraMercyParley.text) && /(talked|words)/i.test(b.sahraMercyParley.text),
    "Sahra reacts to mercy (traded cold pack) + parley (talked to the Queen)"
  ).toBeTruthy();
  expect(
    /practical/i.test(b.sahraGritForce.text) &&
      /(fought|muscle)/i.test(b.sahraGritForce.text) &&
      b.sahraGritForce.text !== b.sahraMercyParley.text,
    "Sahra reacts differently to grit (kept the ice) + force (fought the Queen)"
  ).toBeTruthy();

  // ---- the trade ----
  expect(
    b.oranges.state.flags.gotOranges === true && b.oranges.state.items.oranges === true,
    "Sahra trades the oldest-row oranges (a new inventory item)"
  ).toBeTruthy();

  // ---- ending ----
  expect(
    b.act5Complete.state.flags.act5Complete,
    "Act 5 completes (grove oranges earned, hidden door opened)"
  ).toBe(true);
  expect(b.noAutoAdvance.zoneKey, "Act 5 does NOT auto-advance — still in the grove").toBe("sahraGrove");

  // ---- no uncaught page errors across the whole run ----
  expect(getPageErrors(page), "no page errors").toEqual([]);
});
