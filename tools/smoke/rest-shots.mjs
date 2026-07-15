/**
 * Rest-point screenshot capture (not a pass/fail test) — drives the built
 * bundle to two rest points, shows the HUD at low HP, uses the point, and
 * shows the HUD healed to full. Writes heal-*.png into the dir passed as
 * argv[2] for human review.
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
  act4Started: true, sawOutskirts: true, sawCamp: true, sawCrateChase: true,
  sawKelpForest: true, sawReefDescent: true, sawReefGarden: true,
  act5Started: true, act5Complete: true, gotOranges: true, fluffballJoined: true,
  act6Started: true
};

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());
await page.keyboard.press("Space"); // NEW GAME
await page.waitForTimeout(1200);

async function tap(code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

async function enter(zone, tx, ty) {
  await page.evaluate(
    ([zone, flags]) => {
      const g = window.__game;
      const st = g.registry.get("act1");
      // xp high enough for a meaningful HP bar; flags so scenes populate fully.
      g.registry.set("act1", { ...st, zone, xp: 4000, flags: { ...st.flags, ...flags } });
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, BASE_FLAGS]
  );
  await page.waitForTimeout(1400);
  await page.evaluate(([z, x, y]) => window.__game.scene.getScene(z).player.body.reset(x * 16 + 8, y * 16 + 8), [zone, tx, ty]);
  await page.waitForTimeout(400);
}

const setHp = (hp) => page.evaluate((h) => {
  const g = window.__game;
  g.registry.set("act1", { ...g.registry.get("act1"), hp: h });
  // Force the HUD to redraw the damaged value immediately.
  const z = g.scene.getScenes(true).map((s) => s.scene.key).find((k) => k !== "boot" && k !== "battle");
  if (z) g.scene.getScene(z).hud?.update(g.registry.get("act1"));
}, hp);

const hp = () => page.evaluate(() => window.__game.registry.get("act1").hp);

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `heal-${name}.png`) });
  console.log("wrote", `heal-${name}.png`, "hp=", await hp());
}

// ---- Act 3: the kelp-forest hub rest point (16,13) ----
await enter("kelpForest", 16, 13);
await setHp(4); // badly hurt
await page.waitForTimeout(200);
await shot("act3-before");
await tap("KeyE"); // use the rest point
await page.waitForTimeout(350);
await shot("act3-after-heal"); // HUD now full; flavor line showing
if (await page.evaluate(() => window.__game.scene.getScene("kelpForest").dialogue.isOpen)) {
  await tap("Space");
}

// ---- Act 6: the crawlers'-garden mint-kelp rest point (21,9) ----
await enter("reefGarden", 21, 9);
await setHp(5);
await page.waitForTimeout(200);
await shot("act6-before");
await tap("KeyE");
await page.waitForTimeout(350);
await shot("act6-after-heal");

await browser.close();
console.log("done");
