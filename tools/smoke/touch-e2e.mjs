/**
 * Touch-specific regression coverage against the built bundle
 * (dist/index.html). Runs in a real touch-emulated Chromium context
 * (hasTouch + isMobile), separate from the keyboard-driven tools/smoke/e2e.mjs
 * playthrough, because these bugs only reproduce with `isTouchDevice()`
 * true: (1) tapping to use an InteractPoint (bucket/spigot/coop) — the
 * tap-to-interact path only ever checked NPCs, so touch players got no
 * response at all; (2) the dialogue choice list's on-screen ▲/A/▼ buttons,
 * added because precisely tapping a tiny choice row was unreliable.
 *
 * Usage:  npm run build && npm run smoke:touch
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`);
  if (!ok) failures++;
}

async function tap(page, code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-gl=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());

const isTouch = await page.evaluate(() => window.__game.device.input.touch);
check("game detects a touch device in this context", isTouch === true);

await tap(page, "Space"); // NEW GAME
await page.waitForTimeout(1500);

const canvasRect = async () => {
  const r = await page.evaluate(() => window.__game.canvas.getBoundingClientRect());
  return r;
};

// ---------- Tap-to-interact reaches an InteractPoint, not just NPCs ----------
await page.evaluate(() => {
  window.__game.scene.start("oasis", {});
});
await page.waitForTimeout(1200);
const coopPoint = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["interactPoints"][0]; // coop, added first in placeCoop()
});
await page.evaluate(
  ([x, y]) => window.__game.scene.getScene("oasis").player.body.reset(x, y),
  [coopPoint.x, coopPoint.y]
);
await page.waitForTimeout(250);
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(400);
const coopTapResult = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return { dialogueOpen: w.dialogue.isOpen, bucket: window.__game.registry.get("act1").items.bucket };
});
check(
  "tapping the right side at the coop (no bucket) opens the hint via touch",
  coopTapResult.dialogueOpen === true && coopTapResult.bucket === "none",
  JSON.stringify(coopTapResult)
);
// Close the hint the same way a touch player would: tap again (plain line, any tap advances).
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(300);

// ---------- Dialogue choice list: on-screen ▲ / A / ▼ buttons ----------
await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  const n = w["npcs"][0]; // John — homeAct1Script opens with a choice hub
  w.player.body.reset(n.sprite.x, n.sprite.y + 14);
});
await page.waitForTimeout(200);
const tapRightSide = async () => {
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
};
await tapRightSide(); // open dialogue
await page.waitForTimeout(300);
// homeAct1Script's choice hub ("Ask about Thomas / chickens / goodbye") is
// a few plain lines in — tap through them (any tap advances a plain line).
let dlgState = null;
for (let i = 0; i < 10; i++) {
  dlgState = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
  });
  if (!dlgState.open || dlgState.choices) break;
  await tapRightSide();
  await page.waitForTimeout(220);
}
check("talking to John opens a choice list", dlgState.open === true && Array.isArray(dlgState.choices), JSON.stringify(dlgState));

if (dlgState.choices) {
  const btnScreen = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    const dlg = w.dialogue;
    const rect = window.__game.canvas.getBoundingClientRect();
    const scaleX = rect.width / window.__game.scale.width;
    const scaleY = rect.height / window.__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    const btnX = dlg["btnX"];
    const btnTop = dlg["btnTop"];
    const BTN_GAP = 24;
    const BTN_SIZE = 22;
    const mid = (localY) => ({
      x: rect.x + (cx + btnX + BTN_SIZE / 2) * scaleX,
      y: rect.y + (cy + localY + BTN_SIZE / 2) * scaleY
    });
    return { up: mid(btnTop), a: mid(btnTop + BTN_GAP), down: mid(btnTop + BTN_GAP * 2) };
  });

  const selAfter = async () =>
    page.evaluate(() => window.__game.scene.getScene("oasis").dialogue["selected"]);

  await page.touchscreen.tap(btnScreen.down.x, btnScreen.down.y);
  await page.waitForTimeout(200);
  const selDown = await selAfter();
  check("tapping ▼ moves the choice selection down", selDown === 1, `selected=${selDown}`);

  await page.touchscreen.tap(btnScreen.up.x, btnScreen.up.y);
  await page.waitForTimeout(200);
  const selUp = await selAfter();
  check("tapping ▲ moves the choice selection back up", selUp === 0, `selected=${selUp}`);

  await page.touchscreen.tap(btnScreen.a.x, btnScreen.a.y);
  await page.waitForTimeout(300);
  const afterA = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    return { open: w.dialogue.isOpen, node: w.dialogue["runner"]?.currentNodeId ?? null };
  });
  check(
    "tapping A confirms the highlighted choice and advances the conversation",
    afterA.open === true && afterA.node !== null && afterA.node !== "hub",
    JSON.stringify(afterA)
  );
}

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} touch smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll touch smoke checks passed");
