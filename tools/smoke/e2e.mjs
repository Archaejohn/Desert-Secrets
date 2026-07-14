/**
 * Headless end-to-end playthrough of Act 1 against the built bundle
 * (dist/index.html). Not a unit test — it drives the real game in
 * Chromium: crash site → Rosa → oasis → parents → tutorial battle
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
    const zoneKey = active.find((k) => ["crash","oasis","trail","mine","depths","crevasse","maze","galleries","sanctum"].includes(k));
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
        ["crash","oasis","trail","mine","depths","crevasse","maze","galleries","sanctum"].includes(k)
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

// ---------- Title menu ----------
await page.evaluate(() => localStorage.clear()); // deterministic: no save yet
const titleUp = await page.evaluate(() => {
  const boot = window.__game.scene.getScene("boot");
  return boot.scene.isActive();
});
check("title menu shows on boot", titleUp === true);
await tap(page, "Space"); // NEW GAME
let s = await waitFor(page, (x) => x.zoneKey === "crash", 8000);

// ---------- Beat 1: crash site ----------
check("New Game starts the crash site", s.zoneKey === "crash", JSON.stringify(s.active));

// Movement + walk animation still work.
await page.waitForTimeout(600);
s = await snapshot(page);
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

// Talk to John, exit via farewell (last choice), tutorial battle starts.
const parentsOpened = await talkToNpc(page, "oasis", 0);
check("parents' dialogue opens", parentsOpened);
await talkThrough(page, { exitIndex: 99 }); // always pick the LAST choice (goodbye)
s = await waitFor(page, (x) => x.battle, 8000);
check("tutorial battle starts after meeting the parents", s.battle === true);

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

// Optional side quest: feed and water the chickens, for bonus XP.
const xpBeforeChores = (await snapshot(page)).state.hero.xp;
const coopTrig = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["triggers"].map((t) => t.rect)[0];
});
await teleport(page, coopTrig.x1, coopTrig.y1);
await page.waitForTimeout(300);
s = await snapshot(page);
check(
  "the chicken side quest is optional and awards bonus XP",
  s.state.flags.choresDone === true && s.state.hero.xp > xpBeforeChores,
  `choresDone=${s.state.flags.choresDone} xp=${xpBeforeChores}->${s.state.hero.xp}`
);

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

// Random encounter: pace in the open lakebed (away from all triggers)
// until one fires (9%/s of movement after a 5s grace).
await healUp(page);
await teleport(page, 8, 10); // open dry-lake area, no triggers nearby
let enc = await snapshot(page);
const encDeadline = Date.now() + 150_000;
while (!enc.battle && Date.now() < encDeadline) {
  const dir = Math.floor(Date.now() / 3000) % 2 ? "ArrowUp" : "ArrowDown";
  await page.keyboard.down(dir);
  enc = await waitFor(page, (x) => x.battle || x.dialogueOpen, 3200);
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

// End card → SPACE descends into Act 2 keeping all progress.
const xpBeforeAct2 = s.state.hero.xp;
await tap(page, "Space");
s = await waitFor(page, (x) => x.zoneKey === "crevasse", 8000);
check(
  "act 1 end card hands off to the crevasse with progress kept",
  s.zoneKey === "crevasse" && s.state.flags.act2Started === true && s.state.hero.xp === xpBeforeAct2,
  `zone=${s.zoneKey} xp=${s.state?.hero?.xp}`
);

// ---------- Save / Continue: reload mid-run ----------
await page.reload();
await page.waitForTimeout(2600);
await tap(page, "Space"); // CONTINUE is first when a save exists
s = await waitFor(page, (x) => x.zoneKey !== null, 8000);
check(
  "reload + Continue restores the checkpoint save",
  s.zoneKey === "crevasse" && s.state.hero.xp === xpBeforeAct2,
  `zone=${s.zoneKey} xp=${s.state?.hero?.xp}`
);

// ---------- Act 2, zone by zone ----------
// Generic driver: talk to every NPC, then visit triggers/exits to advance.
async function talkAllNpcs(zone) {
  for (let pass = 0; pass < 2; pass++) {
    const count = await page.evaluate(
      (z) => window.__game.scene.getScene(z)["npcs"].length,
      zone
    );
    for (let i = 0; i < count; i++) {
      await healUp(page);
      const opened = await talkToNpc(page, zone, i);
      if (!opened) continue;
      await talkThrough(page, { pickIndex: 0 });
      await fightIfBattle(page, zone);
    }
  }
}
/** Visit TRIGGER rects only (never exits) until pred holds. */
async function driveTriggersUntil(zone, pred, maxRounds = 3) {
  for (let round = 0; round < maxRounds; round++) {
    const rects = await page.evaluate((z) => {
      const w = window.__game.scene.getScene(z);
      return w["triggers"].map((t) => t.rect);
    }, zone);
    for (const r of rects) {
      let cur = await snapshot(page);
      if (pred(cur)) return cur;
      if (cur.zoneKey !== zone) return cur;
      await healUp(page);
      await teleport(page, r.x1, r.y1);
      await page.waitForTimeout(500);
      cur = await snapshot(page);
      if (cur.dialogueOpen) await talkThrough(page, { pickIndex: 0 });
      await fightIfBattle(page, zone);
      cur = await snapshot(page);
      if (pred(cur)) return cur;
      if (cur.zoneKey !== zone) return cur;
    }
  }
  return snapshot(page);
}

/** Leave `zone` for `target` via a declared exit (or gated trigger fallback). */
async function exitTo(zone, target) {
  const exits = await page.evaluate((z) => {
    const w = window.__game.scene.getScene(z);
    return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
  }, zone);
  const match = exits.find((e) => e.target === target);
  if (match) {
    await teleport(page, match.rect.x1, match.rect.y1);
    return waitFor(page, (x) => x.zoneKey === target, 8000);
  }
  // Gated exits live in triggers; visit them until the zone flips.
  return driveTriggersUntil(zone, (x) => x.zoneKey === target);
}

// Crevasse: rescue Mo, move on to the maze.
await talkAllNpcs("crevasse");
s = await snapshot(page);
check("Mo rescued in the crevasse", s.state.flags.minerMo === true, JSON.stringify(s.state.flags));
s = await exitTo("crevasse", "maze");
check("crevasse leads to the ice maze", s.zoneKey === "maze");

// Maze: Edda, Slither's crack, shards, then out to the galleries.
await talkAllNpcs("maze");
s = await driveTriggersUntil("maze", (x) => x.state.flags.metSlither && x.state.flags.minerEdda);
s = await snapshot(page);
check("Edda rescued in the maze", s.state.flags.minerEdda === true, JSON.stringify(s.state.flags));
check("Slither opens the maze shortcut", s.state.flags.metSlither === true && s.state.flags.mazeShortcutOpen === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "maze") {
  // A trigger bounced us to a neighbouring zone; walk back in.
  s = await exitTo(s.zoneKey, "maze");
}
s = await exitTo("maze", "galleries");
check("maze exits reach the galleries", s.zoneKey === "galleries");

// Galleries: Gus, miners bonus, rime door -> Slither joins.
await talkAllNpcs("galleries");
s = await snapshot(page);
check("Gus rescued in the galleries", s.state.flags.minerGus === true, JSON.stringify(s.state.flags));
check("all-miners bonus perk granted", s.state.flags.minersBonusGiven === true, `pendingPerks=${s.state.pendingPerks}`);
s = await driveTriggersUntil("galleries", (x) => x.state.flags.slitherJoined);
s = await snapshot(page);
check("Slither joins the party at the rime door", s.state.flags.slitherJoined === true && s.state.flags.rimeDoorOpen === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "galleries") s = await exitTo(s.zoneKey, "galleries");
s = await exitTo("galleries", "sanctum");
check("rime door opens the sanctum", s.zoneKey === "sanctum");

// Sanctum: Warden boss with the two-member party.
await healUp(page);
// The trigger driver plays the intro dialogue and fights the boss itself.
s = await driveTriggersUntil("sanctum", (x) => x.state.flags.wardenDefeated === true);
if (s.battle) {
  s = await fightThrough(page, { timeoutMs: 180_000 });
  s = await waitFor(page, (x) => x.zoneKey === "sanctum", 12_000);
}
check("Rime Warden defeated", s.state.flags.wardenDefeated === true, JSON.stringify(s.state.flags));
// The battle scene retains its last battle: confirm the party was two-strong.
const partySize = await page.evaluate(() => {
  const b = window.__game.scene.getScene("battle");
  return b["battle"] ? b["battle"].livingOn("party").length + (b["battle"].getCombatant("slither") ? 0 : 0) : 0;
});
const hadSlither = await page.evaluate(() => {
  const b = window.__game.scene.getScene("battle");
  try {
    return !!b["battle"]?.getCombatant("slither");
  } catch {
    return false;
  }
});
check("Warden battle included Slither in the party", hadSlither === true, `living=${partySize}`);

// Ending: the crack-and-crossing cutscene runs long — wait for its
// dialogue, play it through, then wait for the completion flag.
s = await waitFor(page, (x) => x.dialogueOpen === true, 30_000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act2Complete === true, 10_000);
check("Act 2 completes (two penguins seen)", s.state.flags.act2Complete === true, JSON.stringify(s.state.flags));
await page.waitForTimeout(800);
await tap(page, "Space");
const backAtTitle = await waitFor(page, (x) => x.active?.includes("boot"), 9000);
check("act 2 end card returns to the title", backAtTitle.active?.includes("boot") === true, JSON.stringify(backAtTitle.active));

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll Act 1 + Act 2 smoke checks passed");
