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
    const zoneKey = active.find((k) => ["crash","oasis","shed","overworld","mineEntrance","trail","mine","depths","crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple","fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook","campGallery","campLedge"].includes(k));
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
        ["crash","oasis","shed","overworld","mineEntrance","trail","mine","depths","crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple","fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook","campGallery","campLedge"].includes(k)
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

/**
 * Walk (real key-driven, collision-respecting movement — not a teleport)
 * toward a px target until within range, tapping the direction in short
 * bursts. Used for the one reachability check that must catch real map
 * bugs: teleporting bypasses collision entirely and would silently mask a
 * wall sealing off a pickup (as the shed's bucket once was).
 */
async function walkUntilNear(page, dir, targetX, targetY, range = 22, maxSteps = 14) {
  for (let i = 0; i < maxSteps; i++) {
    const cur = await snapshot(page);
    if (Math.hypot(cur.px - targetX, cur.py - targetY) < range) return cur;
    await page.keyboard.down(dir);
    await page.waitForTimeout(120);
    await page.keyboard.up(dir);
    await page.waitForTimeout(60);
  }
  return snapshot(page);
}

/** Move the player directly onto a px point (spawn-safe; not a physics walk). */
async function standAt(page, zone, x, y) {
  await page.evaluate(
    ([zone, x, y]) => {
      window.__game.scene.getScene(zone).player.body.reset(x, y);
    },
    [zone, x, y]
  );
  await page.waitForTimeout(150);
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

// ---------- Open Desert POC: a small side-trip before the main story ----------
// Oasis -> Overworld -> Mine Entrance (sealed) -> Mine Entrance (open) -> Mine,
// then back out through the Overworld to the Oasis. Optional, additive path;
// doesn't touch any Act 1 story flags.
{
  const oasisExits = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
  });
  const toOverworld = oasisExits.find((e) => e.target === "overworld");
  check("oasis has a north exit to the overworld", !!toOverworld, JSON.stringify(oasisExits.map((e) => e.target)));
  await teleport(page, toOverworld.rect.x1, toOverworld.rect.y1);
  s = await waitFor(page, (x) => x.zoneKey === "overworld", 8000);
  check("oasis's north exit reaches the overworld", s.zoneKey === "overworld");

  const owExits = await page.evaluate(() => {
    const w = window.__game.scene.getScene("overworld");
    return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
  });
  const toMineEntrance = owExits.find((e) => e.target === "mineEntrance");
  check(
    "the overworld has exits back to the oasis and on to the mine entrance",
    owExits.some((e) => e.target === "oasis") && !!toMineEntrance,
    JSON.stringify(owExits.map((e) => e.target))
  );
  await teleport(page, toMineEntrance.rect.x1, toMineEntrance.rect.y1);
  s = await waitFor(page, (x) => x.zoneKey === "mineEntrance", 8000);
  check("the overworld's north exit reaches the mine entrance", s.zoneKey === "mineEntrance");

  {
    // 160x160 vs the 480x270 viewport — also centered, not pinned.
    const cam = await page.evaluate(() => {
      const c = window.__game.scene.getScene("mineEntrance").cameras.main;
      return { scrollX: c.scrollX, scrollY: c.scrollY };
    });
    check(
      "the mine entrance (smaller than the viewport) renders centered, not pinned to a corner",
      cam.scrollX === -160 && cam.scrollY === -55,
      JSON.stringify(cam)
    );
  }

  // Sealed: mineOpen is still false at this point in the playthrough.
  const meTrigs = await page.evaluate(() => {
    const w = window.__game.scene.getScene("mineEntrance");
    return w["triggers"].map((t) => t.rect);
  });
  await teleport(page, meTrigs[0].x1, meTrigs[0].y1);
  await page.waitForTimeout(400);
  s = await snapshot(page);
  check(
    "the mine entrance is sealed before Dusty opens the mine",
    s.zoneKey === "mineEntrance" && s.dialogueOpen === true
  );
  if (s.dialogueOpen) await talkThrough(page);

  // Force mineOpen (Dusty's flag) just for this check, then confirm the
  // second door onto the mine actually opens too — restored after.
  const beforeFlags = (await snapshot(page)).state.flags;
  await page.evaluate(() => {
    const st = window.__game.registry.get("act1");
    window.__game.registry.set("act1", { ...st, flags: { ...st.flags, mineOpen: true } });
  });
  await teleport(page, meTrigs[0].x1, meTrigs[0].y1);
  s = await waitFor(page, (x) => x.zoneKey === "mine", 8000);
  check("once mineOpen, the mine entrance's threshold leads into Cinnabar Mine", s.zoneKey === "mine");
  await page.evaluate((flags) => {
    const st = window.__game.registry.get("act1");
    window.__game.registry.set("act1", { ...st, flags });
  }, beforeFlags); // restore: the real mine-open moment is still Dusty's, later on the Trail

  // Back to the oasis via the overworld's own south exit. Explicitly stop
  // every other active scene first — a bare global scene.start() (unlike
  // the in-game goToZone(), which runs via the calling scene's own
  // this.scene plugin) does NOT stop whatever scene is currently running,
  // leaving stray scenes' input handlers alive to interfere with later
  // steps (this caused the inventory-equip checks below to fail silently
  // once, before this fix).
  await page.evaluate(() => {
    const g = window.__game;
    for (const s of g.scene.getScenes(true)) {
      if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
    }
    g.scene.start("overworld", {});
  });
  await page.waitForTimeout(700);
  const owExits2 = await page.evaluate(() => {
    const w = window.__game.scene.getScene("overworld");
    return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
  });
  const toOasis = owExits2.find((e) => e.target === "oasis");
  await teleport(page, toOasis.rect.x1, toOasis.rect.y1);
  s = await waitFor(page, (x) => x.zoneKey === "oasis", 8000);
  check("the overworld's south exit returns to the oasis", s.zoneKey === "oasis");
}

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

// Optional side quest: feed and water the chickens. Now a fetch-quest with
// a real inventory: grab the bucket, open the bag and equip it, fill it at
// the spigot, deliver it to the coop. All skippable, none blocking
// progress to the trail. Every step here is a press-E InteractPoint, never
// a walk-over trigger, so standing still can't cause a stray re-fire.
const xpBeforeChores = (await snapshot(page)).state.hero.xp;

// 1) Pressing E at the coop with no bucket yet: a hint, no state change.
const coopPointBefore = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["interactPoints"][0]; // coop is added first, in placeCoop()
});
await standAt(page, "oasis", coopPointBefore.x, coopPointBefore.y);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check(
  "coop hints instead of completing with no bucket",
  s.state.items.bucket === "none" && s.state.flags.choresDone !== true,
  `bucket=${s.state.items.bucket}`
);
if (s.dialogueOpen) await talkThrough(page); // close the hint before moving on

// 2) South to the shed. WALK there with real keypresses (not a teleport) —
// the one genuine collision-respecting traversal check in this script, to
// catch a map wall sealing off the pickup the way teleporting would miss.
s = await exitTo("oasis", "shed");
check("south exit reaches the shed", s.zoneKey === "shed");
{
  // The shed is smaller than the viewport in both dimensions (256x192 vs
  // 480x270) — it should render centered, not pinned to a corner.
  const cam = await page.evaluate(() => {
    const c = window.__game.scene.getScene("shed").cameras.main;
    return { scrollX: c.scrollX, scrollY: c.scrollY };
  });
  check(
    "the shed (smaller than the viewport) renders centered, not pinned to a corner",
    cam.scrollX === -112 && cam.scrollY === -39,
    JSON.stringify(cam)
  );
}
const bucketPoint = await page.evaluate(() => {
  const w = window.__game.scene.getScene("shed");
  return w["interactPoints"][0];
});
s = await walkUntilNear(page, "ArrowDown", bucketPoint.x, bucketPoint.y);
check(
  "walking down from the shed spawn reaches the bucket",
  Math.hypot(s.px - bucketPoint.x, s.py - bucketPoint.y) < 22,
  `at ${s.px},${s.py} vs ${bucketPoint.x},${bucketPoint.y}`
);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check("picking up the bucket sets its state to empty", s.state.items.bucket === "empty");

// 3) Open the inventory window and equip the bucket — only an equipped
// item can be used out in the world.
await tap(page, "KeyI");
await page.waitForTimeout(250);
let invOpen = await page.evaluate(() => !!window.__game.scene.getScene("shed")["inventoryMenu"]);
check("inventory window opens on I", invOpen === true);
await tap(page, "Space"); // the bucket is the only (selected) row
await page.waitForTimeout(200);
s = await snapshot(page);
check("selecting the bucket in the inventory equips it", s.state.items.equipped === "bucket", `equipped=${s.state.items.equipped}`);
await tap(page, "KeyI"); // close
await page.waitForTimeout(250);
invOpen = await page.evaluate(() => !!window.__game.scene.getScene("shed")["inventoryMenu"]);
check("inventory window closes on I", invOpen === false);

// 4) Back to the oasis, fill the equipped bucket at the spigot.
s = await exitTo("shed", "oasis");
check("shed exit returns to the oasis", s.zoneKey === "oasis");
const spigotPoint = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["interactPoints"][1]; // [0] coop, [1] spigot — added in that order
});
await standAt(page, "oasis", spigotPoint.x, spigotPoint.y);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check("filling the equipped bucket at the spigot sets its state to filled", s.state.items.bucket === "filled");

// 5) Deliver it to the coop: completes the chore, awards XP, spends and
// un-equips the bucket.
await standAt(page, "oasis", coopPointBefore.x, coopPointBefore.y);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check(
  "delivering the full bucket completes the chore and awards bonus XP",
  s.state.flags.choresDone === true &&
    s.state.hero.xp > xpBeforeChores &&
    s.state.items.bucket === "none" &&
    s.state.items.equipped === null,
  `choresDone=${s.state.flags.choresDone} xp=${xpBeforeChores}->${s.state.hero.xp} bucket=${s.state.items.bucket} equipped=${s.state.items.equipped}`
);

// ---------- Beat 3: the trail ----------
s = await waitFor(page, (x) => x.zoneKey === "oasis", 8000);
check("back in the oasis after chores", s.zoneKey === "oasis", JSON.stringify(s.active));
const oasisExits = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["exits"].map((e) => ({ rect: e.rect, target: e.target }));
});
const toTrail = oasisExits.find((e) => e.target === "trail");
await teleport(page, toTrail.rect.x1, toTrail.rect.y1);
s = await waitFor(page, (x) => x.zoneKey === "trail");
check("reaches the trail", s.zoneKey === "trail", JSON.stringify(s.active));
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
// The Act 2 end card now DIVES into Act 3 (the crack Piggy vanished
// through), keeping all progress — it no longer returns to the title.
await tap(page, "Space");
s = await waitFor(page, (x) => x.zoneKey === "sunlessSea", 9000);
check(
  "act 2 end card dives into the Sunless Sea with progress kept",
  s.zoneKey === "sunlessSea" && s.state.flags.act3Started === true,
  `zone=${s.zoneKey} act3Started=${s.state?.flags?.act3Started}`
);

// ---------- Act 3: The Sunless Sea (a six-zone chain) ----------
check("checkpoint updated to the sunless sea entry", s.state.zone === "sunlessSea");

// Zone 1 (entry overlook): the comic Piggy-chase is a walk-over trigger.
await healUp(page);
s = await driveTriggersUntil("sunlessSea", (x) => x.state.flags.sawChase);
check("Piggy's chase cutscene plays in the entry overlook", s.state.flags.sawChase === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "sunlessSea") s = await waitFor(page, (x) => x.zoneKey === "sunlessSea", 8000);

// Zone 1 → Zone 2: the south gate leads on into the kelp forest.
s = await exitTo("sunlessSea", "kelpForest");
check("the entry overlook leads into the kelp forest", s.zoneKey === "kelpForest", `zone=${s.zoneKey}`);
check("checkpoint updated to the kelp forest", s.state.zone === "kelpForest");

// Zone 2 (kelp forest): the entry cutscene grounds the player in the traversal zone.
await healUp(page);
s = await driveTriggersUntil("kelpForest", (x) => x.state.flags.sawKelpForest);
check("the kelp forest entry beat plays", s.state.flags.sawKelpForest === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "kelpForest") s = await waitFor(page, (x) => x.zoneKey === "kelpForest", 8000);

// Zone 2 → Zone 3 (dead-end pocket): the west spur drops into the sun-temple ruin.
s = await exitTo("kelpForest", "sunTemple");
check("the west spur reaches the flooded sun-temple", s.zoneKey === "sunTemple", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("sunTemple", (x) => x.state.flags.sawTempleEntry);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
// Inspect the carved sun-glyph for the lore beat.
await teleport(page, 7, 7); // SUNTEMPLE_GLYPH
await tap(page, "KeyE");
await page.waitForTimeout(300);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
s = await snapshot(page);
check("the flooded sun-temple lore beat plays", s.state.flags.sawTemple === true, JSON.stringify(s.state.flags));

// Back to the kelp forest, then down the south spur to Fluffball's kelp bed.
s = await exitTo("sunTemple", "kelpForest");
check("the sun-temple leads back to the kelp forest", s.zoneKey === "kelpForest", `zone=${s.zoneKey}`);
s = await exitTo("kelpForest", "fluffballBed");
check("the south spur reaches Fluffball's kelp bed", s.zoneKey === "fluffballBed", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("fluffballBed", (x) => x.state.flags.metFluffball);
check("Fluffball glimpsed, drops the silverfin clue", s.state.flags.metFluffball === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "fluffballBed") s = await waitFor(page, (x) => x.zoneKey === "fluffballBed", 8000);

// Back to the kelp forest, then the east fork on to the deep kelp bed.
s = await exitTo("fluffballBed", "kelpForest");
check("Fluffball's bed leads back to the kelp forest", s.zoneKey === "kelpForest", `zone=${s.zoneKey}`);
s = await exitTo("kelpForest", "deepBed");
check("the east fork reaches the deep kelp bed", s.zoneKey === "deepBed", `zone=${s.zoneKey}`);

// Zone 5 (deep bed): the fishing climax, with the fixed pacing. The player
// CASTS FIRST; the Lurker steals the line (that theft is what starts the
// fight); once it's beaten off the line is intact and a recast lands the fish.
await healUp(page);
s = await driveTriggersUntil("deepBed", (x) => x.state.flags.sawDeepBed);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
if (s.zoneKey !== "deepBed") s = await waitFor(page, (x) => x.zoneKey === "deepBed", 8000);
await healUp(page);
await teleport(page, 15, 9); // DEEP_FISHING
await tap(page, "KeyE");
await page.waitForTimeout(300);
// seaFirstCast ("the line goes taut...") → lurkerIntro (the steal) → the fight.
for (let i = 0; i < 8; i++) {
  const d = await snapshot(page);
  if (d.battle) break;
  if (d.dialogueOpen) await talkThrough(page);
  await page.waitForTimeout(200);
}
s = await waitFor(page, (x) => x.battle, 6000);
check("casting first makes the Lurker steal the line and start the fight", s.battle === true);
s = await fightThrough(page, { timeoutMs: 180_000 });
s = await waitFor(page, (x) => x.zoneKey === "deepBed", 12_000);
check(
  "the Lurker is fought off with the line still intact (no fish yet)",
  s.state.flags.lurkerDefeated === true && s.state.items.silverfin !== true,
  JSON.stringify(s.state.flags)
);

// Recast: cast the line again and play the timing minigame. Read the pure
// fishing state and only hook when the marker is well inside the glow.
await healUp(page);
await teleport(page, 15, 9);
await tap(page, "KeyE");
await page.waitForTimeout(300);
await talkThrough(page, { pickIndex: 0 }); // "Cast the line" → cast-end → opens the gauge
await page.waitForTimeout(300);
const menuOpen = await page.evaluate(() => !!window.__game.scene.getScene("deepBed").fishingMenu);
check("recasting opens the fishing timing minigame", menuOpen === true);

const fishDeadline = Date.now() + 40_000;
let caught = false;
while (Date.now() < fishDeadline) {
  const fs = await page.evaluate(() => {
    const w = window.__game.scene.getScene("deepBed");
    const m = w.fishingMenu;
    if (!m) return { open: false, caught: window.__game.registry.get("act1").items.silverfin === true };
    return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
  });
  if (!fs.open) {
    caught = fs.caught;
    break;
  }
  if (Math.abs(fs.p - fs.t) < fs.w * 0.5) await tap(page, "Space", 30);
  await page.waitForTimeout(25);
}
check("the fishing minigame lands the silverfin", caught === true);
s = await snapshot(page);
check("silverfin recorded in the inventory", s.state.items.silverfin === true && s.state.flags.silverfinCaught === true, JSON.stringify(s.state.items));

// The catch beat → act3Complete → the party climbs out via the ascent zone.
s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act3Complete === true, 8000);
check("Act 3 completes (silverfin caught)", s.state.flags.act3Complete === true, JSON.stringify(s.state.flags));
s = await waitFor(page, (x) => x.zoneKey === "seaAscent", 9000);
check("the catch hands off to the ascent zone (a real zone, not an end card)", s.zoneKey === "seaAscent", `zone=${s.zoneKey}`);
await page.screenshot({ path: path.join(root, "../act3-ascent.png") }).catch(() => {});

// Zone 6 (ascent): the climb beat plays, then the top gate hands off to Act 4.
await healUp(page);
s = await driveTriggersUntil("seaAscent", (x) => x.state.flags.sawAscent || x.zoneKey === "minersCamp");
check("the ascent climb beat plays", s.state.flags.sawAscent === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "minersCamp") s = await exitTo("seaAscent", "minersCamp");
check(
  "the ascent's top gate climbs into the Miners' Camp with progress kept",
  s.zoneKey === "minersCamp" && s.state.flags.act4Started === true,
  `zone=${s.zoneKey} act4Started=${s.state?.flags?.act4Started}`
);

// ---------- Act 4: Dirty Laundry (the Miners' Camp, a five-zone chain) ----------
check("checkpoint updated to the camp outskirts", s.state.zone === "minersCamp");

// Zone 1 (outskirts): the arrival beat grounds the night-raid storytelling.
await healUp(page);
s = await driveTriggersUntil("minersCamp", (x) => x.state.flags.sawOutskirts);
check("the camp-outskirts arrival beat plays", s.state.flags.sawOutskirts === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "minersCamp") s = await waitFor(page, (x) => x.zoneKey === "minersCamp", 8000);

// Zone 1 → Zone 2: the south gate leads on into the camp proper.
s = await exitTo("minersCamp", "campProper");
check("the outskirts lead into the camp proper", s.zoneKey === "campProper", `zone=${s.zoneKey}`);
check("checkpoint updated to the camp proper", s.state.zone === "campProper");

// Zone 2 (camp proper): the entry beat and the comic crate chase (walk-overs).
await healUp(page);
s = await driveTriggersUntil("campProper", (x) => x.state.flags.sawCamp && x.state.flags.sawCrateChase);
check("the camp-proper entry beat plays", s.state.flags.sawCamp === true, JSON.stringify(s.state.flags));
check("Piggy's crate-raid chase plays", s.state.flags.sawCrateChase === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "campProper") s = await waitFor(page, (x) => x.zoneKey === "campProper", 8000);

// Talk to a miner: the favor-quest hook (clear the mites for the socks).
const favorOpened = await talkToNpc(page, "campProper", 0);
check("a miner explains the favor-quest", favorOpened);
if (favorOpened) await talkThrough(page);

// Zone 2 → Zone 3 (dead-end pocket): the west gap drops into the laundry nook.
s = await exitTo("campProper", "laundryNook");
check("the west gap reaches the laundry nook", s.zoneKey === "laundryNook", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("laundryNook", (x) => x.state.flags.sawNook);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("the laundry-nook entry beat plays", s.state.flags.sawNook === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "laundryNook") s = await waitFor(page, (x) => x.zoneKey === "laundryNook", 8000);

// The midden-mite nest: an InteractPoint (press E) → forced swarm battle.
await healUp(page);
await teleport(page, 4, 7); // NOOK_NEST
await tap(page, "KeyE");
await page.waitForTimeout(300);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // nest intro → battle
s = await waitFor(page, (x) => x.battle, 6000);
check("the midden-mite nest battle starts in the laundry nook", s.battle === true);
await page.screenshot({ path: path.join(root, "../act4-mite-fight.png") }).catch(() => {});
s = await fightThrough(page, { timeoutMs: 120_000 });
s = await waitFor(page, (x) => x.zoneKey === "laundryNook", 12_000);
check("the midden-mite nest is cleared", s.state.flags.middenCleared === true, JSON.stringify(s.state.flags));

// Zone 3 → back to the camp proper, then east and up the back gallery.
s = await exitTo("laundryNook", "campProper");
check("the laundry nook leads back to the camp proper", s.zoneKey === "campProper", `zone=${s.zoneKey}`);
s = await exitTo("campProper", "campGallery");
check("the east gate reaches the back gallery", s.zoneKey === "campGallery", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("campGallery", (x) => x.state.flags.sawGallery);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("the back-gallery entry beat plays", s.state.flags.sawGallery === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "campGallery") s = await waitFor(page, (x) => x.zoneKey === "campGallery", 8000);

// Zone 4 → Zone 5 (dead-end vantage): the gallery climbs to Fluffball's ledge.
s = await exitTo("campGallery", "campLedge");
check("the gallery climbs to the overlook ledge", s.zoneKey === "campLedge", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("campLedge", (x) => x.state.flags.fluffballLedge);
check("Fluffball glimpsed on the ledge, drops clue #2", s.state.flags.fluffballLedge === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "campLedge") s = await waitFor(page, (x) => x.zoneKey === "campLedge", 8000);

// Back down through the gallery to the camp proper for the sock hand-over.
s = await exitTo("campLedge", "campGallery");
check("the ledge leads back down to the gallery", s.zoneKey === "campGallery", `zone=${s.zoneKey}`);
s = await exitTo("campGallery", "campProper");
check("the gallery leads back to the camp proper", s.zoneKey === "campProper", `zone=${s.zoneKey}`);

// The sock line: an InteractPoint that hands over the reeking socks.
await teleport(page, 6, 6); // CAMPP_SOCKS
await tap(page, "KeyE");
await page.waitForTimeout(300);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // reward dialogue
s = await waitFor(page, (x) => x.state.flags.gotSocks === true, 8000);
check(
  "the miners hand over the stinky socks (a new inventory item)",
  s.state.flags.gotSocks === true && s.state.items.stinkySocks === true,
  JSON.stringify(s.state.items)
);

// The "reeks" mechanic has a concrete, testable effect on encounters: while
// the socks are held, the scene swaps in the reek-adjusted table, dropping
// every frost-scarab group's weight to 1 (mites, who love the smell, keep
// their weight). encounterTable() is the live source the encounter clock uses.
const reekEffect = await page.evaluate(() => {
  const w = window.__game.scene.getScene("campProper");
  const held = w.encounterTable(); // reads items.stinkySocks live
  return { weights: held.weights, stinky: window.__game.registry.get("act1").items.stinkySocks };
});
check(
  "carrying the socks reweights encounters so frost scarabs avoid the party",
  reekEffect.stinky === true && JSON.stringify(reekEffect.weights) === JSON.stringify([3, 1, 2, 1]),
  JSON.stringify(reekEffect)
);

// The Act 4 ending: dialogue → act4Complete → end card → back to title.
s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act4Complete === true, 8000);
check("Act 4 completes (stinky socks earned)", s.state.flags.act4Complete === true, JSON.stringify(s.state.flags));
await page.screenshot({ path: path.join(root, "../act4-end-card.png") }).catch(() => {});
await page.waitForTimeout(600);
await tap(page, "Space");
const backAtTitle = await waitFor(page, (x) => x.active?.includes("boot"), 9000);
check("act 4 end card returns to the title", backAtTitle.active?.includes("boot") === true, JSON.stringify(backAtTitle.active));

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll Act 1 + Act 2 + Act 3 + Act 4 smoke checks passed");
