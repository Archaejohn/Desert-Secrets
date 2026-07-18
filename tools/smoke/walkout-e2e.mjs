/**
 * Focused verification for the "no forced advancement" retrofit: every act
 * boundary must be crossed by WALKING into a revealed exit, never by a dialogue
 * dismissal / catch / trade auto-teleporting. Drives the built bundle
 * (dist/index.html), jumping to each act-end state (its reload/epilogue guard,
 * which runs the SAME armWalkoutExit code as the live ending) and asserting:
 *   1. the scene does NOT auto-advance (still the same zone a beat later),
 *   2. a real walk-in exit to the next zone now exists,
 *   3. walking into it actually crosses.
 * Usage:  npm run build && node tools/smoke/walkout-e2e.mjs
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

const ZONES = ["crash","oasis","shed","overworld","mineEntrance","trail","mine","depths","crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple","fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook","campGallery","campLedge","groveDescent","groveApproach","groveGrotto","groveChamber","sahraGrove","reefDescent","reefGarden","reefWarren","reefHollow","reefCourt","pizzaDescent","pizzaVent","pizzaApproach","pizzeria","pizzaAscent"];

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox", "--use-gl=swiftshader"] });
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));
await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());
await page.waitForTimeout(200);

async function tap(code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

// NEW GAME — initializes the "act1" registry state the cases below build on.
await tap("Space");
await page.waitForTimeout(1500);

const curZone = async () =>
  page.evaluate((zs) => {
    const active = window.__game.scene.getScenes(true).map((s) => s.scene.key);
    return active.find((k) => zs.includes(k)) ?? active.join(",");
  }, ZONES);

const exitsOf = async (zone) =>
  page.evaluate((z) => {
    const w = window.__game.scene.getScene(z);
    return (w["exits"] ?? []).map((e) => e.target);
  }, zone);

/** Jump into `zone` with `flags` merged onto a fresh Act-1 state. */
async function enter(zone, flags, items = {}) {
  await page.evaluate(
    ([zone, flags, items]) => {
      const g = window.__game;
      const st = g.registry.get("act1");
      for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
      g.registry.set("act1", {
        ...st,
        zone,
        hp: 999,
        items: { ...st.items, ...items },
        flags: { ...st.flags, ...flags }
      });
      g.scene.start(zone, {});
    },
    [zone, flags, items]
  );
  await page.waitForTimeout(1300);
}

/** Move the player onto a tile (spawn-safe reset, not a physics walk). */
async function standAt(zone, tx, ty) {
  await page.evaluate(
    ([zone, x, y]) => window.__game.scene.getScene(zone).player.body.reset(x, y),
    [zone, tx * 16 + 8, ty * 16 + 8]
  );
  await page.waitForTimeout(200);
}

async function waitZone(target, ms = 6000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if ((await curZone()) === target) return true;
    await page.waitForTimeout(150);
  }
  return false;
}

// Common ancestor flags so followers/objectives are consistent.
const BASE = {
  actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
  slitherJoined: true, act3Started: true, silverfinCaught: true, act3Complete: true,
  lurkerDefeated: true, metFluffball: true, sawDeepBed: true
};

// ---- A walk-in exit case: enter state, confirm no auto-advance, then cross. ----
async function walkoutCase(label, zone, flags, target, exitTile, items = {}) {
  await enter(zone, flags, items);
  const z0 = await curZone();
  check(`${label}: lands in ${zone} (no auto-teleport into ${target})`, z0 === zone, `zone=${z0}`);
  const exits = await exitsOf(zone);
  check(`${label}: a walk-in exit to ${target} is revealed`, exits.includes(target), `exits=${exits.join(",")}`);
  // Confirm it does not advance on its own over a beat.
  await page.waitForTimeout(600);
  const z1 = await curZone();
  check(`${label}: does NOT advance without movement`, z1 === zone, `zone=${z1}`);
  // Now walk into the exit.
  await standAt(zone, exitTile.x, exitTile.y);
  const crossed = await waitZone(target);
  check(`${label}: walking into the exit crosses to ${target}`, crossed, `zone=${await curZone()}`);
}

// Act 3 → 4: the frozen ice path out of the deep bed.
await walkoutCase(
  "Act 3→4 (ice path)", "deepBed",
  { ...BASE, act4Started: false },
  "seaAscent", { x: 15, y: 1 },
  { silverfin: true }
);

// Act 4 → 5: the stairwell down opens in the camp.
await walkoutCase(
  "Act 4→5 (stairwell)", "campProper",
  { ...BASE, sawAscent: true, act4Started: true, sawOutskirts: true, sawCamp: true,
    sawCrateChase: true, sawNook: true, middenCleared: true, fluffballLedge: true,
    gotSocks: true, act4Complete: true },
  "groveDescent", { x: 15, y: 18 },
  { stinkySocks: true }
);

// Act 5 → 6: Sahra's hidden door down.
await walkoutCase(
  "Act 5→6 (hidden door)", "sahraGrove",
  { ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
    fluffballJoined: true, sawSahraGrove: true, gotOranges: true, act5Complete: true },
  "reefDescent", { x: 11, y: 14 },
  { stinkySocks: true, oranges: true }
);

// Act 6 → 7: the crawlers' opened tunnel down.
await walkoutCase(
  "Act 6→7 (crawler tunnel)", "reefCourt",
  { ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
    fluffballJoined: true, act5Complete: true, gotOranges: true, act6Started: true,
    sawReefCourt: true, gotSeaweed: true, act6Complete: true },
  "pizzaDescent", { x: 11, y: 14 },
  { stinkySocks: true, oranges: true, seaweed: true }
);

// Act 7 → ascent: Testudo's revealed stairs up.
await walkoutCase(
  "Act 7→ascent (stairs up)", "pizzeria",
  { ...BASE, act4Started: true, act4Complete: true, gotSocks: true, act5Started: true,
    fluffballJoined: true, act5Complete: true, gotOranges: true, act6Started: true,
    gotSeaweed: true, act6Complete: true, act7Started: true, metTestudo: true,
    pizzaBaked: true, piggyCaught: true, heardReveal: true },
  "pizzaAscent", { x: 2, y: 16 },
  { silverfin: true, stinkySocks: true, oranges: true, seaweed: true }
);

// Act 2 → 3: follow the penguins into the tunnel → END OF ACT 2 card → the sea.
// (Sanctum uses a walk-in trigger to the card, not a plain addExit.)
{
  await enter("sanctum", { wardenDefeated: true, act2Complete: true, slitherJoined: true });
  const z0 = await curZone();
  check("Act 2→3 (tunnel): lands in sanctum (no auto-teleport)", z0 === "sanctum", `zone=${z0}`);
  await page.waitForTimeout(600);
  check("Act 2→3 (tunnel): does NOT advance without movement", (await curZone()) === "sanctum");
  await standAt("sanctum", 23, 4); // SANCTUM_TUNNEL
  await page.waitForTimeout(800); // the END OF ACT 2 card appears
  await tap("Space"); // dismiss the card → dive into the sea
  const crossed = await waitZone("sunlessSea", 8000);
  check("Act 2→3 (tunnel): walking into the tunnel + card dives into the sea", crossed, `zone=${await curZone()}`);
}

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} walkout check(s) failed`);
  process.exit(1);
}
console.log("\nAll walk-out act-boundary checks passed — no forced advancement");
