/**
 * Act 5 screenshot capture (not a pass/fail test) — drives the built bundle to
 * each grove zone and saves framed PNGs for human review. Writes act5v2-*.png
 * into the scratchpad dir passed as argv[2].
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = process.argv[2] || root;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";

const BASE_FLAGS = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
  act4Started: true, act4Complete: true, gotSocks: true, act5Started: true
};

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());
await page.keyboard.press("Space"); // NEW GAME
await page.waitForTimeout(1200);

async function enter(zone, flags, px, py) {
  await page.evaluate(
    ([zone, flags]) => {
      const g = window.__game;
      const st = g.registry.get("act1");
      g.registry.set("act1", { ...st, zone, hp: 999, xp: 9999, flags: { ...st.flags, ...flags } });
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, flags]
  );
  await page.waitForTimeout(1300);
  await page.evaluate((z) => (window.__zone = z), zone);
  if (px !== undefined) {
    await page.evaluate(([z, x, y]) => window.__game.scene.getScene(z).player.body.reset(x * 16 + 8, y * 16 + 8), [zone, px, py]);
  }
  await page.waitForTimeout(500);
}

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `act5v2-${name}.png`) });
  console.log("wrote", `act5v2-${name}.png`);
}

async function nudge(dir, ms = 350) {
  await page.keyboard.down(dir);
  await page.waitForTimeout(ms);
  await page.keyboard.up(dir);
  await page.waitForTimeout(250);
}

// Zone 1: the warm descent.
await enter("groveDescent", { ...BASE_FLAGS }, 10, 6);
await shot("1-descent");

// Zone 2: the grove approach — the needle-cactus thicket + windfall.
await enter("groveApproach", { ...BASE_FLAGS, sawGroveApproach: true }, 22, 9);
await shot("2-approach-needle");
// The scared chase, mid-dialogue.
await enter("groveApproach", { ...BASE_FLAGS }, 15, 9);
await page.evaluate(() => window.__game.scene.getScene("groveApproach").player.body.reset(15 * 16 + 8, 9 * 16 + 8));
await page.waitForTimeout(300);
await nudge("ArrowDown", 200);
await page.waitForTimeout(600);
await shot("3-approach-chase");

// Zone 3: the river grotto.
await enter("groveGrotto", { ...BASE_FLAGS, sawGroveGrotto: true }, 11, 11);
await shot("4-grotto-river");

// Zone 4: the sunlit chamber — the one orange tree, dead centre.
await enter("groveChamber", { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true }, 15, 14);
await page.waitForTimeout(300);
await nudge("ArrowUp", 150); // trail Slither + Fluffball into frame behind Joseph
await shot("5-chamber-tree-centered");
// Dialogue depth vs the overhead canopy: open a box while under the tree.
await page.evaluate(() => {
  const w = window.__game.scene.getScene("groveChamber");
  w.player.body.reset(15 * 16 + 8, 9 * 16 + 8); // under the canopy (overhead depth 5000)
  w.openScript({
    start: "n",
    nodes: [{ id: "n", lines: [
      { speaker: "Joseph", text: "One orange tree, dead center, lit by the sun." },
      { speaker: "Sahra", text: "Nobody finds my grove. Yet here you are." }
    ] }]
  });
});
await page.waitForTimeout(600);
await shot("6-chamber-dialogue-over-canopy");

// Fluffball joining: the gray chick edges out of the ferns at the tree and
// joins. Spawn his follower + a cosmetic chick and open the join dialogue.
await enter("groveChamber", { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true }, 15, 13);
await page.evaluate(() => {
  const w = window.__game.scene.getScene("groveChamber");
  const TILE = 16;
  const fluff = w.add.sprite(19 * TILE + 8, 12 * TILE + 8, "fluffball", 0).setDepth(9999);
  fluff.play("fluffball-walk");
  w.fluffball.spawn(w.player.x, w.player.y);
  w.openScript({
    start: "join",
    nodes: [{ id: "join", lines: [
      { speaker: "Fluffball", text: "You weren't chasing him to hurt him." },
      { speaker: "Fluffball", text: "You want to HELP Piggy. I see it now." }
    ] }]
  });
});
await page.waitForTimeout(600);
await shot("7-fluffball-joins");

// Zone 5: Sahra's grove — her reactive dialogue.
await enter("sahraGrove", { ...BASE_FLAGS, fluffballJoined: true, sawSahraGrove: true, rabbitTradedColdPack: true, parleyed: true }, 6, 8);
await shot("8-sahra-grove");
await page.evaluate(() => {
  const w = window.__game.scene.getScene("sahraGrove");
  const n = w["npcs"][0];
  w.player.body.reset(n.sprite.x, n.sprite.y + 20);
  // Open Sahra's live reactive script (mercy + parley branch) for review.
  w.openScript(w.sahraScript());
});
await page.waitForTimeout(500);
await shot("9-sahra-dialogue");

// A sunwasp battle (the new grove encounter).
await enter("groveChamber", { ...BASE_FLAGS, sawGroveChamber: true, fluffballJoined: true }, 15, 14);
await page.evaluate(() => window.__game.scene.getScene("groveChamber").startBattle(["sunwasp", "sunwasp"]));
await page.waitForTimeout(1800);
await shot("10-sunwasp-battle");

await browser.close();
console.log("done");
