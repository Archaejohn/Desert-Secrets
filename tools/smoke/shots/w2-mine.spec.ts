/** W2 review capture — lands in the Cinnabar Mine (composite ground + the raised
 *  ledge / raycast wall) and screenshots the first chamber. Not pass/fail. */
import { test, expect } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { jumpTo } from "../kit/debug";

test("w2 — mine ledge", async ({ page }, testInfo) => {
  await seed(page, fixture("act2-start"));
  await jumpTo(page, {
    zone: "mine",
    flags: { mineOpen: true, actComplete: true, act2Started: true },
    hp: 999, settleMs: 1400, stand: { x: 16, y: 19 }, standSettleMs: 500
  });
  const s = await snapshot(page);
  expect(s.zoneKey, "reached mine").toBe("mine");
  await page.screenshot({ path: testInfo.outputPath("w2-mine.png") });
});
