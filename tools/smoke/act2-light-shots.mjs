/**
 * Act 2 lighting screenshot capture (not a pass/fail test) — drives the built
 * bundle into the three ice zones and captures the new LightMask lighting:
 * amber lantern flicker + blue ice pulse (crevasse, maze) and the frozen-lake
 * blue wash (sanctum epilogue). Writes act2light-*.png into argv[2].
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const outDir = process.argv[2] || root;
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";

const FLAGS = {
  actComplete: true,
  act2Started: true,
  wardenDefeated: true,
  act2Complete: true,
  slitherJoined: true,
  minerMo: true,
  minerEdda: true,
  minerGus: true
};

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));
await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());
await page.keyboard.press("Space"); // NEW GAME
await page.waitForTimeout(1200);

async function enter(zone, tx, ty) {
  await page.evaluate(
    ([zone, flags]) => {
      const g = window.__game;
      const st = g.registry.get("act1");
      g.registry.set("act1", { ...st, zone, xp: 4000, flags: { ...st.flags, ...flags } });
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.scene.start(zone, {});
    },
    [zone, FLAGS]
  );
  await page.waitForTimeout(1400);
  await page.evaluate(
    ([z, x, y]) => window.__game.scene.getScene(z).player.body.reset(x * 16 + 8, y * 16 + 8),
    [zone, tx, ty]
  );
  // let the camera settle and the pulses reach a lit phase
  await page.waitForTimeout(900);
}

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, `act2light-${name}.png`) });
  console.log("wrote", `act2light-${name}.png`);
}

// Crevasse — amber lantern at the camp corner + blue ice crystals.
await enter("crevasse", 5, 4);
await shot("crevasse");

// Maze — lantern posts at the junctions + blue crystals.
await enter("maze", 9, 4);
await shot("maze");

// Sanctum epilogue — the frozen lake's blue wash + crystals (no darkening).
await enter("sanctum", 12, 9);
await shot("sanctum");

await browser.close();
console.log("done");
