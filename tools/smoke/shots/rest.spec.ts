/**
 * Rest-point screenshot capture (not a pass/fail test) — drives to two rest
 * points, shows the HUD at low HP, uses the point, and shows the HUD healed
 * to full. Ported from rest-shots.mjs onto the shared kit: seeds straight
 * into the furthest-along committed fixture (act6-start, which already
 * carries sawKelpForest and the rest of the Act 3-6 flags the source's own
 * BASE_FLAGS hand-rolled) instead of a fresh NEW GAME, then reuses the
 * source's own zone/flag jump to visit both rest points (Act 3's kelp forest
 * and Act 6's crawlers' garden). PNGs go to the Playwright test output dir
 * (test-results/, already gitignored) as heal-<name>.png.
 */
import { test, expect, type Page } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";
import { tap, standAt } from "../kit/actions";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, sawOutskirts: true, sawCamp: true, sawCrateChase: true,
  sawKelpForest: true, sawReefDescent: true, sawReefGarden: true,
  act5Started: true, act5Complete: true, gotOranges: true, fluffballJoined: true,
  act6Started: true,
};

/** Jump into `zone` with BASE_FLAGS merged onto the seeded state, then stand at (tx,ty). */
async function jump(page: Page, zone: string, tx: number, ty: number) {
  await page.evaluate(
    ([zone, flags]) => {
      const g = (window as any).__game;
      const st = g.registry.get("act1");
      // xp high enough for a meaningful HP bar; flags so scenes populate fully.
      g.registry.set("act1", { ...st, zone, xp: 4000, flags: { ...st.flags, ...(flags as object) } });
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, BASE_FLAGS] as const
  );
  await page.waitForTimeout(1400);
  await standAt(page, zone, tx * 16 + 8, ty * 16 + 8);
  await page.waitForTimeout(250);
  return snapshot(page);
}

async function setHp(page: Page, hp: number): Promise<void> {
  await page.evaluate((h) => {
    const g = (window as any).__game;
    g.registry.set("act1", { ...g.registry.get("act1"), hp: h });
    // Force the HUD to redraw the damaged value immediately.
    const z = g.scene.getScenes(true).map((s: any) => s.scene.key).find((k: string) => k !== "boot" && k !== "battle");
    if (z) g.scene.getScene(z).hud?.update(g.registry.get("act1"));
  }, hp);
}

test("rest-point shots — Act 3 kelp forest, Act 6 crawlers' garden", async ({ page }, testInfo) => {
  const shot = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`heal-${name}.png`) });
  };

  await seed(page, fixture("act6-start")); // furthest-along committed fixture

  // ---- Act 3: the kelp-forest hub rest point (16,13) ----
  let s = await jump(page, "kelpForest", 16, 13);
  expect(s.zoneKey, "reached kelpForest before screenshotting").toBe("kelpForest");
  await setHp(page, 4); // badly hurt
  await page.waitForTimeout(200);
  await shot("act3-before");
  await tap(page, "KeyE"); // use the rest point
  await page.waitForTimeout(350);
  await shot("act3-after-heal"); // HUD now full; flavor line showing
  if ((await snapshot(page)).dialogueOpen) await tap(page, "Space");

  // ---- Act 6: the crawlers'-garden mint-kelp rest point (21,9) ----
  s = await jump(page, "reefGarden", 21, 9);
  expect(s.zoneKey, "reached reefGarden before screenshotting").toBe("reefGarden");
  await setHp(page, 5);
  await page.waitForTimeout(200);
  await shot("act6-before");
  await tap(page, "KeyE");
  await page.waitForTimeout(350);
  await shot("act6-after-heal");
});
