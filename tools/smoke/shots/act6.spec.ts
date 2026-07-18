/**
 * Act 6 screenshot capture (not a pass/fail test) — drives to each reef zone
 * and saves framed PNGs for human review. Ported from act6-shots.mjs onto
 * the shared kit: seeds straight into Act 6 via the committed fixture
 * instead of a fresh NEW GAME + hand-rolled xp/flags, then reuses the
 * source's own zone/flag jump for every other shot in the chain. PNGs go to
 * the Playwright test output dir (test-results/, already gitignored) as
 * act6-<name>.png.
 */
import { test, expect, type Page } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, act4Complete: true, gotSocks: true,
  act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
  act6Started: true,
};

/** Jump into `zone` with `flags` merged onto the seeded state; optionally stand at (px,py). */
async function jump(page: Page, zone: string, flags: Record<string, boolean>, px?: number, py?: number) {
  await page.evaluate(
    ([zone, flags]) => {
      const g = (window as any).__game;
      const st = g.registry.get("act1");
      g.registry.set("act1", { ...st, zone, hp: 999, flags: { ...st.flags, ...(flags as object) } });
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, flags] as const
  );
  await page.waitForTimeout(1300);
  if (px !== undefined && py !== undefined) {
    await page.evaluate(
      ([z, x, y]) =>
        (window as any).__game.scene.getScene(z as string).player.body.reset(
          (x as number) * 16 + 8,
          (y as number) * 16 + 8
        ),
      [zone, px, py] as const
    );
  }
  await page.waitForTimeout(500);
  return snapshot(page);
}

async function nudge(page: Page, dir: string, ms = 350) {
  await page.keyboard.down(dir);
  await page.waitForTimeout(ms);
  await page.keyboard.up(dir);
  await page.waitForTimeout(250);
}

test("Act 6 shots — the drowned reef", async ({ page }, testInfo) => {
  const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`act6-${name}.png`) });

  await seed(page, fixture("act6-start")); // lands in reefDescent

  // Zone 1: the drowned stair (the Act 5 → 6 entry, back underwater).
  let s = await jump(page, "reefDescent", { ...BASE_FLAGS, sawReefDescent: true }, 10, 8);
  expect(s.zoneKey, "reached reefDescent before screenshotting").toBe("reefDescent");
  await nudge(page, "ArrowUp", 150); // trail Slither + Fluffball into frame
  await shot("1-descent");

  // Zone 2: the crawlers' garden — cultivated mint rows vs. wild kelp + canopy.
  s = await jump(page, "reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 21, 9);
  expect(s.zoneKey, "reached reefGarden before screenshotting").toBe("reefGarden");
  await shot("2-garden-mint-rows");
  // Dialogue depth vs the overhead kelp canopy: open a box while under the canopy.
  s = await jump(page, "reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 10, 6);
  expect(s.zoneKey, "reached reefGarden before screenshotting").toBe("reefGarden");
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("reefGarden");
    w.player.body.reset(10 * 16 + 8, 6 * 16 + 8); // under wild-kelp canopy (overhead depth 5000)
    w.openScript({
      start: "n",
      nodes: [
        {
          id: "n",
          lines: [
            { speaker: "Joseph", text: "This is a FARM. The crawlers grow it on purpose." },
            { speaker: "Fluffball", text: "They're not cruel. Just guarded. Their home." },
          ],
        },
      ],
    });
  });
  await page.waitForTimeout(600);
  await shot("3-garden-dialogue-over-canopy");

  // Zone 3: the coral warren — the TENSE chase-and-turn, mid-dialogue. The entry
  // beat is already seen (sawReefWarren) so stepping onto the trigger plays the
  // chase itself: the cosmetic Piggy bolts from the coral corner through the gap.
  s = await jump(page, "reefWarren", { ...BASE_FLAGS, sawReefWarren: true }, 13, 7);
  expect(s.zoneKey, "reached reefWarren before screenshotting").toBe("reefWarren");
  await page.evaluate(() =>
    (window as any).__game.scene.getScene("reefWarren").player.body.reset(13 * 16 + 8, 8 * 16 + 8)
  );
  await page.waitForTimeout(300);
  await nudge(page, "ArrowDown", 150); // step onto the chase trigger (y=8..10)
  await page.waitForTimeout(450); // catch Piggy mid-bolt toward the gap
  await shot("4-warren-chase");

  // Zone 4: the glowing hollow — the reef channel + stepping-stone crossing.
  s = await jump(page, "reefHollow", { ...BASE_FLAGS, sawReefHollow: true }, 11, 11);
  expect(s.zoneKey, "reached reefHollow before screenshotting").toBe("reefHollow");
  await shot("5-hollow-channel");

  // Zone 5: the crawler court — the diplomacy scene, the trade-not-fight parley.
  s = await jump(page, "reefCourt", { ...BASE_FLAGS, sawReefCourt: true }, 11, 6);
  expect(s.zoneKey, "reached reefCourt before screenshotting").toBe("reefCourt");
  await shot("6-court");
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("reefCourt");
    const n = w["npcs"][0];
    w.player.body.reset(n.sprite.x, n.sprite.y + 20);
    w.openScript(w.wardenScript()); // the live trade-not-fight parley
  });
  await page.waitForTimeout(500);
  await shot("7-court-parley");
  // Advance to the trade-vs-fight choice list for the diplomacy screenshot. The
  // meet node has 4 lines then the choices; advance to the last line so the
  // choice list renders (a held keypress registers reliably, unlike .press()).
  for (let i = 0; i < 12; i++) {
    const choices = await page.evaluate(
      () => (window as any).__game.scene.getScene("reefCourt").dialogue?.["runner"]?.choices ?? null
    );
    if (choices) break;
    await nudge(page, "Space", 90);
  }
  await page.waitForTimeout(300);
  await shot("8-court-choice");

  // A reef-stalker battle (the new reef encounter / the avoidable fallback fight).
  s = await jump(page, "reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 15, 9);
  expect(s.zoneKey, "reached reefGarden before screenshotting").toBe("reefGarden");
  await page.evaluate(() =>
    (window as any).__game.scene.getScene("reefGarden").startBattle(["reefstalker", "reefstalker"])
  );
  await page.waitForTimeout(1800);
  await shot("9-reefstalker-battle");
});
