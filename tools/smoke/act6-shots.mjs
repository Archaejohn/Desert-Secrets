/**
 * Act 6 screenshot capture (not a pass/fail test) — drives the built bundle to
 * each reef zone and saves framed PNGs for human review. Writes act6-*.png into
 * the scratchpad dir passed as argv[2].
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
  act4Started: true, act4Complete: true, gotSocks: true,
  act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
  act6Started: true
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
  if (px !== undefined) {
    await page.evaluate(([z, x, y]) => window.__game.scene.getScene(z).player.body.reset(x * 16 + 8, y * 16 + 8), [zone, px, py]);
  }
  await page.waitForTimeout(500);
}

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `act6-${name}.png`) });
  console.log("wrote", `act6-${name}.png`);
}

async function nudge(dir, ms = 350) {
  await page.keyboard.down(dir);
  await page.waitForTimeout(ms);
  await page.keyboard.up(dir);
  await page.waitForTimeout(250);
}

// Zone 1: the drowned stair (the Act 5 → 6 entry, back underwater).
await enter("reefDescent", { ...BASE_FLAGS, sawReefDescent: true }, 10, 8);
await nudge("ArrowUp", 150); // trail Slither + Fluffball into frame
await shot("1-descent");

// Zone 2: the crawlers' garden — cultivated mint rows vs. wild kelp + canopy.
await enter("reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 21, 9);
await shot("2-garden-mint-rows");
// Dialogue depth vs the overhead kelp canopy: open a box while under the canopy.
await enter("reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 10, 6);
await page.evaluate(() => {
  const w = window.__game.scene.getScene("reefGarden");
  w.player.body.reset(10 * 16 + 8, 6 * 16 + 8); // under wild-kelp canopy (overhead depth 5000)
  w.openScript({
    start: "n",
    nodes: [{ id: "n", lines: [
      { speaker: "Joseph", text: "This is a FARM. The crawlers grow it on purpose." },
      { speaker: "Fluffball", text: "They're not cruel. Just guarded. Their home." }
    ] }]
  });
});
await page.waitForTimeout(600);
await shot("3-garden-dialogue-over-canopy");

// Zone 3: the coral warren — the TENSE chase-and-turn, mid-dialogue. The entry
// beat is already seen (sawReefWarren) so stepping onto the trigger plays the
// chase itself: the cosmetic Piggy bolts from the coral corner through the gap.
await enter("reefWarren", { ...BASE_FLAGS, sawReefWarren: true }, 13, 7);
await page.evaluate(() => window.__game.scene.getScene("reefWarren").player.body.reset(13 * 16 + 8, 8 * 16 + 8));
await page.waitForTimeout(300);
await nudge("ArrowDown", 150); // step onto the chase trigger (y=8..10)
await page.waitForTimeout(450); // catch Piggy mid-bolt toward the gap
await shot("4-warren-chase");

// Zone 4: the glowing hollow — the reef channel + stepping-stone crossing.
await enter("reefHollow", { ...BASE_FLAGS, sawReefHollow: true }, 11, 11);
await shot("5-hollow-channel");

// Zone 5: the crawler court — the diplomacy scene, the trade-not-fight parley.
await enter("reefCourt", { ...BASE_FLAGS, sawReefCourt: true }, 11, 6);
await shot("6-court");
await page.evaluate(() => {
  const w = window.__game.scene.getScene("reefCourt");
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
    () => window.__game.scene.getScene("reefCourt").dialogue?.["runner"]?.choices ?? null
  );
  if (choices) break;
  await nudge("Space", 90);
}
await page.waitForTimeout(300);
await shot("8-court-choice");

// A reef-stalker battle (the new reef encounter / the avoidable fallback fight).
await enter("reefGarden", { ...BASE_FLAGS, sawReefGarden: true }, 15, 9);
await page.evaluate(() => window.__game.scene.getScene("reefGarden").startBattle(["reefstalker", "reefstalker"]));
await page.waitForTimeout(1800);
await shot("9-reefstalker-battle");

await browser.close();
console.log("done");
