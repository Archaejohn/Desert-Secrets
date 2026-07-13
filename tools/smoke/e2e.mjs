/**
 * Headless end-to-end smoke test of the built game (dist/index.html).
 *
 * Not a unit test — it drives the real bundle in Chromium and asserts the
 * three demo pillars work: the world boots and animates, the NPC
 * conversation opens/branches/closes, and touching the scarab starts an
 * ATB battle that can be won.
 *
 * Usage:  npm run build && npm run smoke
 * Uses PLAYWRIGHT_EXECUTABLE_PATH or a preinstalled Chromium.
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const executablePath =
  process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";

let failures = 0;
function check(name, ok) {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) failures++;
}

/** Hold a key for one+ game frame — a bare press can fall between updates. */
async function tap(page, code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

const worldState = (page) =>
  page.evaluate(() => {
    const g = window.__game;
    const w = g.scene.getScene("World");
    const b = g.scene.getScene("Battle");
    const out = {
      world: !!w?.scene.isActive(),
      battle: !!b?.scene.isActive()
    };
    if (out.world) {
      out.dialogueOpen = w.dialogue.isOpen;
      out.scarab = !!w.scarab;
      out.anim = w.player.anims.currentAnim?.key ?? null;
      out.playerPos = { x: w.player.x, y: w.player.y };
    }
    if (out.battle) out.menu = b.menuMode;
    return out;
  });

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-gl=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2500);

// --- 1) Boot & movement/animation ---
let s = await worldState(page);
check("world scene boots", s.world);
const startPos = s.playerPos;
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(600);
s = await worldState(page);
await page.keyboard.up("ArrowRight");
check("player moves", s.playerPos.x > startPos.x + 20);
check("walk animation plays", s.anim === "hero-walk-right");
await page.waitForTimeout(300);
s = await worldState(page);
check("idle animation resumes", s.anim === "hero-idle-right");

// --- 2) NPC conversation ---
await page.evaluate(() => {
  const w = window.__game.scene.getScene("World");
  w.player.setPosition(w.npc.x, w.npc.y + 18);
});
await page.waitForTimeout(250);
await tap(page, "KeyE");
await page.waitForTimeout(400);
s = await worldState(page);
check("dialogue opens near NPC", s.dialogueOpen === true);
for (let i = 0; i < 20 && (await worldState(page)).dialogueOpen; i++) {
  const hasChoices = await page.evaluate(() => {
    const w = window.__game.scene.getScene("World");
    return !!w.dialogue.runner?.choices;
  });
  if (hasChoices) {
    await tap(page, "ArrowDown");
    await tap(page, "ArrowDown"); // farewell is the last option
  }
  await tap(page, "Space");
  await page.waitForTimeout(250);
}
s = await worldState(page);
check("dialogue closes via farewell", s.dialogueOpen === false);

// --- 3) ATB battle ---
await page.evaluate(() => {
  const w = window.__game.scene.getScene("World");
  w.player.setPosition(w.scarab.x, w.scarab.y);
});
await page.waitForTimeout(2000);
s = await worldState(page);
check("touching the scarab starts a battle", s.battle === true);
const battleStart = Date.now();
let won = false;
while (Date.now() - battleStart < 60_000) {
  s = await worldState(page);
  if (s.world) {
    won = s.scarab === false;
    break;
  }
  if (s.menu && s.menu !== "hidden") await tap(page, "Space"); // Attack → first target
  await page.waitForTimeout(250);
}
check("battle reaches a verdict and returns to the world", s.world === true);
check("victory removes the scarab from the world", won);
check("no page errors", pageErrors.length === 0);
if (pageErrors.length) console.log("page errors:", pageErrors);

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll smoke checks passed");
