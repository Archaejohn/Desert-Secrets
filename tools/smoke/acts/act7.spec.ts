import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { driveAct7 } from "../flows/act7";
import { installPageErrors, getPageErrors } from "../kit/errors";

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  installPageErrors(page);
});

test("Act 7 — La Pizzeria Sotterranea, End of Part One", async ({ page }) => {
  await seed(page, fixture("act7-start"));
  const b = await driveAct7(page);

  // ---- zone 1: warm descent -> lava vents ----
  expect(
    b.sawPizzaDescent.state.flags.sawPizzaDescent,
    "the warm-deep arrival beat plays (tomato-pie smell paid off)"
  ).toBe(true);
  expect(b.pizzaVent.zoneKey, "the descent leads into the lava vents").toBe("pizzaVent");

  // ---- zone 2: lava vents -> old kitchens ----
  expect(b.sawPizzaVent.state.flags.sawPizzaVent, "the lava-vents entry beat plays").toBe(true);
  expect(b.pizzaApproach.zoneKey, "the vents lead into the old kitchens").toBe("pizzaApproach");

  // ---- zone 3: old kitchens -> the pizzeria ----
  expect(b.sawPizzaApproach.state.flags.sawPizzaApproach, "the old-kitchens entry beat plays").toBe(
    true
  );
  expect(b.pizzeria.zoneKey, "the kitchens lead into La Pizzeria Sotterranea").toBe("pizzeria");
  expect(b.pizzeria.state.zone, "checkpoint updated to the pizzeria").toBe("pizzeria");

  // ---- zone 4: the pizzeria — Testudo, the bake, the catch, the reveal ----
  expect(b.metTestudo.state.flags.metTestudo, "the restaurant arrival beat plays (Chef Testudo)").toBe(
    true
  );
  expect(b.cookOpen.cookOpen, "baking opens the cooking timing minigame").toBe(true);
  expect(b.baked.baked, "the cooking minigame bakes the perfect pizza").toBe(true);
  expect(b.pizzaBaked.state.flags.pizzaBaked, "the pizza is baked").toBe(true);
  expect(
    b.piggyCaught.state.flags.piggyCaught,
    "Piggy is finally, gently caught (the reunion payoff, not a chase)"
  ).toBe(true);
  expect(b.heardReveal.state.flags.heardReveal, "Testudo reveals the ice/ocean secret").toBe(true);

  // ---- the reveal does not auto-advance; walk up to the ascent ----
  expect(
    b.noAutoAdvanceReveal.zoneKey,
    "the reveal does NOT auto-advance — still in the pizzeria"
  ).toBe("pizzeria");
  expect(
    b.pizzaAscent.zoneKey,
    "walking the opened stairs up climbs to the finale (a real zone)"
  ).toBe("pizzaAscent");

  // ---- zone 5: the ascent, the finale, END OF PART ONE ----
  expect(
    b.sawPizzaAscent.state.flags.sawPizzaAscent,
    "the long-way-up arrival beat plays (Piggy following)"
  ).toBe(true);
  expect(
    b.act7Complete.state.flags.act7Complete === true &&
      b.act7Complete.state.flags.piggyCaught === true &&
      b.act7Complete.state.flags.partOneComplete === true,
    "Part One completes on the finale (piggyCaught + partOneComplete)"
  ).toBeTruthy();

  // ---- the END OF PART ONE card hands off into the Part Two opening cutscene ----
  expect(
    b.partTwoOpening.active?.includes("partTwoOpening"),
    "the END OF PART ONE card hands off into the Part Two opening cutscene"
  ).toBe(true);

  // ---- the cutscene plays its four radio lines ----
  expect(
    b.fourRadioLines.linesSeen,
    "the Part Two opening plays its four radio lines"
  ).toBeGreaterThanOrEqual(4);

  // ---- the "to be continued" beat returns to the title ----
  expect(
    b.backAtTitle.active?.includes("boot"),
    "the Part Two opening returns to the title (rest of Part Two not built yet)"
  ).toBe(true);

  // ---- no uncaught page errors across the whole run ----
  expect(getPageErrors(page), "no page errors").toEqual([]);
});
