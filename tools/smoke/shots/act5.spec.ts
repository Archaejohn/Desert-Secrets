/**
 * Act 5 screenshot capture (not a pass/fail test) — drives to each grove
 * zone and saves framed PNGs for human review. Ported from act5-shots.mjs
 * onto the shared kit: seeds straight into Act 5 via the committed fixture
 * instead of a fresh NEW GAME + hand-rolled xp/flags, then reuses the
 * source's own zone/flag jump for every other shot in the chain. PNGs go to
 * the Playwright test output dir (test-results/, already gitignored) as
 * act5v2-<name>.png.
 */
import { test, expect, type Page } from "@playwright/test";
import { seed, fixture } from "../kit/seed";
import { snapshot } from "../kit/snapshot";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
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

test("Act 5 shots — the grove chain", async ({ page }, testInfo) => {
  const shot = (name: string) => page.screenshot({ path: testInfo.outputPath(`act5v2-${name}.png`) });

  await seed(page, fixture("act5-start")); // lands in groveDescent

  // Zone 1: the warm descent.
  let s = await jump(page, "groveDescent", { ...BASE_FLAGS }, 10, 6);
  expect(s.zoneKey, "reached groveDescent before screenshotting").toBe("groveDescent");
  await shot("1-descent");

  // Zone 2: the grove approach — the needle-cactus thicket + windfall.
  s = await jump(page, "groveApproach", { ...BASE_FLAGS, sawGroveApproach: true }, 22, 9);
  expect(s.zoneKey, "reached groveApproach before screenshotting").toBe("groveApproach");
  await shot("2-approach-needle");
  // The scared chase, mid-dialogue.
  s = await jump(page, "groveApproach", { ...BASE_FLAGS }, 15, 9);
  await page.evaluate(() =>
    (window as any).__game.scene.getScene("groveApproach").player.body.reset(15 * 16 + 8, 9 * 16 + 8)
  );
  await page.waitForTimeout(300);
  await nudge(page, "ArrowDown", 200);
  await page.waitForTimeout(600);
  expect((await snapshot(page)).zoneKey, "still in groveApproach before screenshotting").toBe("groveApproach");
  await shot("3-approach-chase");

  // Zone 3: the river grotto.
  s = await jump(page, "groveGrotto", { ...BASE_FLAGS, sawGroveGrotto: true }, 11, 11);
  expect(s.zoneKey, "reached groveGrotto before screenshotting").toBe("groveGrotto");
  await shot("4-grotto-river");

  // Zone 4: the sunlit chamber — the one orange tree, dead centre.
  s = await jump(
    page,
    "groveChamber",
    { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true },
    15,
    14
  );
  expect(s.zoneKey, "reached groveChamber before screenshotting").toBe("groveChamber");
  await page.waitForTimeout(300);
  await nudge(page, "ArrowUp", 150); // trail Slither + Fluffball into frame behind Joseph
  await shot("5-chamber-tree-centered");
  // Dialogue depth vs the overhead canopy: open a box while under the tree.
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("groveChamber");
    w.player.body.reset(15 * 16 + 8, 9 * 16 + 8); // under the canopy (overhead depth 5000)
    w.openScript({
      start: "n",
      nodes: [
        {
          id: "n",
          lines: [
            { speaker: "Joseph", text: "One orange tree, dead center, lit by the sun." },
            { speaker: "Sahra", text: "Nobody finds my grove. Yet here you are." },
          ],
        },
      ],
    });
  });
  await page.waitForTimeout(600);
  await shot("6-chamber-dialogue-over-canopy");

  // Fluffball joining: the gray chick edges out of the ferns at the tree and
  // joins. Spawn his follower + a cosmetic chick and open the join dialogue.
  s = await jump(
    page,
    "groveChamber",
    { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true },
    15,
    13
  );
  expect(s.zoneKey, "reached groveChamber before screenshotting").toBe("groveChamber");
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("groveChamber");
    const TILE = 16;
    const fluff = w.add.sprite(19 * TILE + 8, 12 * TILE + 8, "fluffball", 0).setDepth(9999);
    fluff.play("fluffball-walk");
    w.fluffball.spawn(w.player.x, w.player.y);
    w.openScript({
      start: "join",
      nodes: [
        {
          id: "join",
          lines: [
            { speaker: "Fluffball", text: "You weren't chasing him to hurt him." },
            { speaker: "Fluffball", text: "You want to HELP Piggy. I see it now." },
          ],
        },
      ],
    });
  });
  await page.waitForTimeout(600);
  await shot("7-fluffball-joins");

  // Zone 5: Sahra's grove — her reactive dialogue.
  s = await jump(
    page,
    "sahraGrove",
    { ...BASE_FLAGS, fluffballJoined: true, sawSahraGrove: true, rabbitTradedColdPack: true, parleyed: true },
    6,
    8
  );
  expect(s.zoneKey, "reached sahraGrove before screenshotting").toBe("sahraGrove");
  await shot("8-sahra-grove");
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("sahraGrove");
    const n = w["npcs"][0];
    w.player.body.reset(n.sprite.x, n.sprite.y + 20);
    // Open Sahra's live reactive script (mercy + parley branch) for review.
    w.openScript(w.sahraScript());
  });
  await page.waitForTimeout(500);
  await shot("9-sahra-dialogue");

  // A sunwasp battle (the new grove encounter).
  s = await jump(
    page,
    "groveChamber",
    { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true },
    15,
    14
  );
  expect(s.zoneKey, "reached groveChamber before screenshotting").toBe("groveChamber");
  await page.evaluate(() =>
    (window as any).__game.scene.getScene("groveChamber").startBattle(["sunwasp", "sunwasp"])
  );
  await page.waitForTimeout(1800);
  await shot("10-sunwasp-battle");
});
