/**
 * Headless end-to-end playthrough of Act 1 against the built bundle
 * (dist/index.html). Not a unit test — it drives the real game in
 * Chromium: crash site → Rosa → oasis → Sahra → tutorial battle
 * (first lost on purpose to verify scene-start respawn, then won) →
 * trail (chips, random encounter, jackrabbit, Dusty) → mine (lever,
 * Foreman boss) → depths (Dust Queen, cliffhanger, end card).
 *
 * Usage:  npm run build && npm run smoke
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

/** Hold a key for one+ game frame — a bare press can fall between updates. */
async function tap(page, code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

const snapshot = (page) =>
  page.evaluate(() => {
    const g = window.__game;
    const active = g.scene.getScenes(true).map((s) => s.scene.key);
    const zoneKey = active.find((k) => ["crash", "oasis", "trail", "mine", "depths"].includes(k));
    const battle = active.includes("battle");
    const out = { active, zoneKey: zoneKey ?? null, battle, state: g.registry.get("act1") };
    if (zoneKey) {
      const w = g.scene.getScene(zoneKey);
      out.dialogueOpen = w.dialogue?.isOpen ?? false;
      out.choices = w.dialogue?.runner?.choices?.map((c) => c.text) ?? null;
      out.px = w.player?.x;
      out.py = w.player?.y;
    }
    return out;
  });

/** Teleport the player (physics-safe) to a tile in the active zone. */
async function teleport(page, tx, ty) {
  await page.evaluate(
    ([tx, ty]) => {
      const g = window.__game;
      const key = g.scene.getScenes(true).map((s) => s.scene.key).find((k) =>
        ["crash", "oasis", "trail", "mine", "depths"].includes(k)
      );
      const w = g.scene.getScene(key);
      w.player.body.reset(tx * 16 + 8, ty * 16 + 8);
    },
    [tx, ty]
  );
  await page.waitForTimeout(150);
}

/** Advance dialogue; when a choice list is up, pick by index. */
async function talkThrough(page, { pickIndex = 0, exitIndex = null, maxSteps = 30 } = {}) {
  for (let i = 0; i < maxSteps; i++) {
    const s = await snapshot(page);
    if (!s.dialogueOpen) return;
    if (s.choices) {
      const idx =
        exitIndex !== null
          ? Math.min(exitIndex, s.choices.length - 1)
          : Math.min(pickIndex, s.choices.length - 1);
      for (let k = 0; k < idx; k++) await tap(page, "ArrowDown", 60);
      await tap(page, "Space");
    } else {
      await tap(page, "Space");
    }
    await page.waitForTimeout(240);
  }
}

/** Fight the current battle by mashing confirm (attack → first target → perks). */
async function fightThrough(page, { act = true, timeoutMs = 90_000 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await snapshot(page);
    if (!s.battle) return s;
    if (act) await tap(page, "Space");
    await page.waitForTimeout(280);
  }
  return snapshot(page);
}

/** Walk up to a (possibly wandering) NPC and open its dialogue, retrying. */
async function talkToNpc(page, zone, npcIndex = 0, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const pos = await page.evaluate(
      ([zone, idx]) => {
        const w = window.__game.scene.getScene(zone);
        const n = w["npcs"][idx];
        if (!n || !n.sprite.active || !n.sprite.visible) return null;
        return { x: n.sprite.x, y: n.sprite.y };
      },
      [zone, npcIndex]
    );
    if (!pos) return false;
    await page.evaluate(
      ([zone, x, y]) => {
        const w = window.__game.scene.getScene(zone);
        w.player.body.reset(x, y + 14);
      },
      [zone, pos.x, pos.y]
    );
    await page.waitForTimeout(150);
    await tap(page, "KeyE");
    await page.waitForTimeout(350);
    const s = await snapshot(page);
    if (s.dialogueOpen) return true;
  }
  return false;
}

/** If a battle is starting (fade included), fight it through and return to the zone. */
async function fightIfBattle(page, zone) {
  const s = await waitFor(page, (x) => x.battle, 3000);
  if (!s.battle) return false;
  await fightThrough(page);
  await waitFor(page, (x) => x.zoneKey === zone, 12_000);
  return true;
}

/** Test determinism helper: top up current HP to max before a fight. */
async function healUp(page) {
  await page.evaluate(() => {
    const g = window.__game;
    const st = g.registry.get("act1");
    g.registry.set("act1", { ...st, hp: 999 }); // heroStats clamps to maxHp
  });
}

async function waitFor(page, pred, timeoutMs = 15_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const s = await snapshot(page);
    if (pred(s)) return s;
    await page.waitForTimeout(200);
  }
  return snapshot(page);
}

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-gl=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);

// ---------- Beat 1: crash site ----------
let s = await snapshot(page);
check("boots into the crash site", s.zoneKey === "crash", JSON.stringify(s.active));

// Movement + walk animation still work.
const px0 = s.px;
await page.keyboard.down("ArrowRight");
await page.waitForTimeout(500);
await page.keyboard.up("ArrowRight");
s = await snapshot(page);
check("player moves", s.px > px0 + 10);

// Talk to Rosa (landmark from crashMap: she's near the truck).
const rosaOpened = await talkToNpc(page, "crash", 0);
check("Rosa dialogue opens", rosaOpened);
await talkThrough(page);
s = await snapshot(page);
check("cold pack granted", s.state.items.coldPack === true && s.state.flags.metRosa === true);

// Frost feather pickup (+5 XP).
const featherTile = await page.evaluate(() => {
  const m = window.__game.scene.getScene("crash");
  return m["triggers"].length ? null : null;
});
void featherTile;
// The feather trigger tile is exported by the map; find it via the scene's triggers.
const trig = await page.evaluate(() => {
  const w = window.__game.scene.getScene("crash");
  return w["triggers"].map((t) => t.rect);
});
if (trig.length) {
  await teleport(page, trig[0].x1, trig[0].y1);
  await page.waitForTimeout(400);
}
s = await snapshot(page);
check("frost feather awards XP", s.state.hero.xp >= 5, `xp=${s.state.hero.xp}`);

// ---------- Beat 2: oasis, deliberate defeat, then tutorial win ----------
// The crash->oasis exit is a gated trigger; visit trigger rects until the zone changes.
const crashTrigs = await page.evaluate(() => {
  const w = window.__game.scene.getScene("crash");
  return w["triggers"].map((t) => t.rect);
});
for (const r of crashTrigs) {
  const cur = await snapshot(page);
  if (cur.zoneKey !== "crash") break;
  await teleport(page, r.x1, r.y1);
  await page.waitForTimeout(600);
  const mid = await snapshot(page);
  if (mid.dialogueOpen) await talkThrough(page);
}
s = await waitFor(page, (x) => x.zoneKey === "oasis");
check("east exit reaches the oasis", s.zoneKey === "oasis");
check("checkpoint updated to oasis", s.state.zone === "oasis");

// Talk to Sahra, exit via farewell (last choice), tutorial battle starts.
const sahraOpened = await talkToNpc(page, "oasis", 0);
check("Sahra dialogue opens", sahraOpened);
await talkThrough(page, { exitIndex: 99 }); // always pick the LAST choice (farewell)
s = await waitFor(page, (x) => x.battle, 8000);
check("tutorial battle starts after Sahra", s.battle === true);

// Lose on purpose: never act. Scarab needs ~5 hits.
s = await fightThrough(page, { act: false, timeoutMs: 120_000 });
s = await waitFor(page, (x) => x.zoneKey === "oasis", 10_000);
const spawn = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return { x: w["cfg"].defaultSpawn.x * 16 + 8, y: w["cfg"].defaultSpawn.y * 16 + 8 };
});
check("defeat returns to the START of the scene", s.zoneKey === "oasis" && Math.abs(s.px - spawn.x) < 2 && Math.abs(s.py - spawn.y) < 2, `at ${s.px},${s.py} vs ${spawn.x},${spawn.y}`);
const fullHp = await page.evaluate(() => {
  const st = window.__game.registry.get("act1");
  return st.hp;
});
check("respawn restores full HP and keeps XP", fullHp >= 32 && s.state.hero.xp >= 5);

// Now win the tutorial battle.
await talkToNpc(page, "oasis", 0);
await talkThrough(page, { exitIndex: 99 });
s = await waitFor(page, (x) => x.battle, 8000);
s = await fightThrough(page);
s = await waitFor(page, (x) => x.zoneKey === "oasis", 10_000);
check("tutorial battle won", s.state.flags.tutorialBattleWon === true, JSON.stringify(s.state.flags));
check("battle XP awarded", s.state.hero.xp >= 13, `xp=${s.state.hero.xp}`);

// ---------- Beat 3: the trail ----------
const oasisExits = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
});
const toTrail = oasisExits.find((e) => e.target === "trail");
await teleport(page, toTrail.rect.x1, toTrail.rect.y1);
s = await waitFor(page, (x) => x.zoneKey === "trail");
check("reaches the trail", s.zoneKey === "trail");
await talkThrough(page); // radio check-in
s = await snapshot(page);

// Random encounter: pace back and forth until one triggers (9%/s of
// movement after a 5s grace). Close any stray dialogue that interrupts.
await healUp(page);
let enc = await snapshot(page);
const encDeadline = Date.now() + 120_000;
while (!enc.battle && Date.now() < encDeadline) {
  const dir = Math.floor(Date.now() / 4000) % 2 ? "ArrowRight" : "ArrowLeft";
  await page.keyboard.down(dir);
  enc = await waitFor(page, (x) => x.battle || x.dialogueOpen, 4200);
  await page.keyboard.up(dir);
  if (enc.dialogueOpen) await talkThrough(page);
}
check("random encounter triggers while moving", enc.battle === true);
s = await fightThrough(page);
s = await waitFor(page, (x) => x.zoneKey === "trail", 10_000);
const trailSpawn = await page.evaluate(() => {
  const w = window.__game.scene.getScene("trail");
  return { x: w["cfg"].defaultSpawn.x * 16 + 8, y: w["cfg"].defaultSpawn.y * 16 + 8 };
});
check(
  "victory returns to where the encounter happened (not scene start)",
  s.zoneKey === "trail" && Math.hypot(s.px - trailSpawn.x, s.py - trailSpawn.y) > 40,
  `at ${s.px},${s.py}`
);

// Ice chips: collect all three via their trigger rects.
const chipRects = await page.evaluate(() => {
  const w = window.__game.scene.getScene("trail");
  return w["triggers"].filter((t) => !t.fired).map((t) => t.rect);
});
const xpBeforeChips = s.state.hero.xp;
for (const r of chipRects) {
  await teleport(page, r.x1, r.y1);
  await page.waitForTimeout(350);
  const after = await snapshot(page);
  if (after.dialogueOpen) await talkThrough(page); // stray trigger (mine grate etc.)
}
s = await snapshot(page);
check("ice chips collected", s.state.flags.chip1 && s.state.flags.chip2 && s.state.flags.chip3, JSON.stringify([s.state.flags.chip1, s.state.flags.chip2, s.state.flags.chip3, `xp ${xpBeforeChips}->${s.state.hero.xp}`]));

// Talk to every trail NPC (jackrabbit: pick "fight" and win, keeping the
// cold pack for the parley option later; Dusty: opens the mine).
// Two passes: battles restart the scene and rebuild the NPC list (the
// resolved rabbit is not re-placed), so indices shift between fights.
for (let pass = 0; pass < 2; pass++) {
  const npcCount = await page.evaluate(
    () => window.__game.scene.getScene("trail")["npcs"].length
  );
  for (let i = 0; i < npcCount; i++) {
    await healUp(page);
    const opened = await talkToNpc(page, "trail", i);
    if (!opened) continue;
    await talkThrough(page, { pickIndex: 0 });
    await fightIfBattle(page, "trail");
  }
}
s = await snapshot(page);
check("jackrabbit encounter resolved", s.state.flags.rabbitResolved === true, JSON.stringify(s.state.flags));
check("Dusty opens the mine", s.state.flags.mineOpen === true, JSON.stringify(s.state.flags));

// ---------- Beat 4: the mine ----------
// The trail->mine exit is a gated trigger.
const trailTrigs = await page.evaluate(() => {
  const w = window.__game.scene.getScene("trail");
  return w["triggers"].map((t) => t.rect);
});
for (const r of trailTrigs) {
  const cur = await snapshot(page);
  if (cur.zoneKey !== "trail") break;
  await teleport(page, r.x1, r.y1);
  await page.waitForTimeout(600);
  const mid = await snapshot(page);
  if (mid.dialogueOpen) await talkThrough(page);
}
s = await waitFor(page, (x) => x.zoneKey === "mine");
check("enters the mine", s.zoneKey === "mine");
await talkThrough(page); // radio

// Pull the lever (its trigger opens a yes/no; yes is first).
const mineTrigs = await page.evaluate(() => {
  const w = window.__game.scene.getScene("mine");
  return w["triggers"].map((t) => ({ rect: t.rect, fired: t.fired }));
});
for (const t of mineTrigs) {
  if (s.state.flags.leverPulled && s.state.flags.foremanDefeated) break;
  await healUp(page);
  await teleport(page, t.rect.x1, t.rect.y1);
  await page.waitForTimeout(400);
  const cur = await snapshot(page);
  if (cur.dialogueOpen) await talkThrough(page, { pickIndex: 0 });
  await fightIfBattle(page, "mine");
  s = await snapshot(page);
  if (s.zoneKey !== "mine") break; // elevator may have fired
}
check("lever pulled", s.state.flags.leverPulled === true, JSON.stringify(s.state.flags));
check("Foreman defeated", s.state.flags.foremanDefeated === true, JSON.stringify(s.state.flags));

// Elevator down.
const mineExitsToDepths = await page.evaluate(() => {
  const w = window.__game.scene.getScene("mine");
  return w["triggers"].map((t) => t.rect);
});
for (const r of mineExitsToDepths) {
  const cur = await snapshot(page);
  if (cur.zoneKey !== "mine") break;
  await teleport(page, r.x1, r.y1);
  await page.waitForTimeout(700);
}
s = await waitFor(page, (x) => x.zoneKey === "depths", 8000);
check("elevator reaches the depths", s.zoneKey === "depths");

// ---------- Beat 5: Dust Queen + cliffhanger ----------
const level = await page.evaluate(() => {
  const st = window.__game.registry.get("act1");
  return st;
});
console.log(`  (hero before boss: xp=${level.hero.xp}, perks=[${level.hero.perks}], hp=${level.hp})`);
check("leveling happened along the way", level.hero.xp >= 45, `xp=${level.hero.xp}`);
check("perk choices were made on level-up", level.hero.perks.length >= 1, `perks=${level.hero.perks}`);

const depthTrigs = await page.evaluate(() => {
  const w = window.__game.scene.getScene("depths");
  return w["triggers"].map((t) => t.rect);
});
await healUp(page);
let queenBattleSeen = false;
for (const r of depthTrigs) {
  const cur = await snapshot(page);
  if (cur.battle || cur.state.flags.queenResolved) break;
  await teleport(page, r.x1, r.y1);
  await page.waitForTimeout(400);
  const mid = await snapshot(page);
  if (mid.dialogueOpen) await talkThrough(page, { pickIndex: 0 });
  const started = await waitFor(page, (x) => x.battle, 4000);
  if (started.battle) {
    queenBattleSeen = true;
    break;
  }
}
check("Dust Queen battle starts", queenBattleSeen);
s = await fightThrough(page, { timeoutMs: 150_000 });
s = await waitFor(page, (x) => x.zoneKey === "depths", 12_000);
check("Queen resolved", s.state.flags.queenResolved === true, JSON.stringify(s.state.flags));

// Cliffhanger: shake → Piggy waddle → dialogue → end card.
await page.waitForTimeout(4200);
s = await snapshot(page);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
await page.waitForTimeout(800);
s = await snapshot(page);
check("act completes (cliffhanger played)", s.state.flags.actComplete === true, JSON.stringify(s.state.flags));
await page.screenshot({ path: path.join(root, "../end-card.png") }).catch(() => {});

// End card → SPACE restarts a fresh run at the crash site.
await tap(page, "Space");
s = await waitFor(page, (x) => x.zoneKey === "crash", 8000);
check("end card restarts Act 1 fresh", s.zoneKey === "crash" && s.state.hero.xp === 0, `xp=${s.state?.hero?.xp}`);

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll Act 1 smoke checks passed");
