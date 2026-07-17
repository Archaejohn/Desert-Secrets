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
    const zoneKey = active.find((k) => ["crash","oasis","shed","overworld","mineEntrance","trail","mine","depths","crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple","fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook","campGallery","campLedge","groveDescent","groveApproach","groveGrotto","groveChamber","sahraGrove","reefDescent","reefGarden","reefWarren","reefHollow","reefCourt","pizzaDescent","pizzaVent","pizzaApproach","pizzeria","pizzaAscent"].includes(k));
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
        ["crash","oasis","shed","overworld","mineEntrance","trail","mine","depths","crevasse","maze","galleries","sanctum","sunlessSea","kelpForest","sunTemple","fluffballBed","deepBed","seaAscent","minersCamp","campProper","laundryNook","campGallery","campLedge","groveDescent","groveApproach","groveGrotto","groveChamber","sahraGrove","reefDescent","reefGarden","reefWarren","reefHollow","reefCourt","pizzaDescent","pizzaVent","pizzaApproach","pizzeria","pizzaAscent"].includes(k)
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

const readHp = (page) => page.evaluate(() => window.__game.registry.get("act1").hp);
const setHp = (page, hp) =>
  page.evaluate((h) => {
    const g = window.__game;
    g.registry.set("act1", { ...g.registry.get("act1"), hp: h });
  }, hp);

/**
 * Exercise a rest point (Acts 3–7's mid-chain heal): stand on the rest tile,
 * use it once to learn the party's true max HP, damage the hero down to 1,
 * then use it again and confirm it heals back to that max — proving the point
 * is a repeatable, no-cost full heal (not a one-shot). The zone scene must be
 * active when called.
 */
async function restPointCheck(page, zone, tx, ty, label) {
  const usePoint = async () => {
    await standAt(page, zone, tx * 16 + 8, ty * 16 + 8);
    await tap(page, "KeyE");
    await page.waitForTimeout(250);
    if ((await snapshot(page)).dialogueOpen) await talkThrough(page); // dismiss flavor line
  };
  await usePoint();
  const full = await readHp(page); // the rest point's heal-to-full target
  await setHp(page, 1);
  await page.waitForTimeout(100);
  await usePoint();
  const after = await readHp(page);
  check(
    `rest point full-heals the party (repeatable) — ${label}`,
    full > 1 && after === full,
    `full=${full} damaged→1 then rested→${after}`
  );
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

// Joseph starts dressed: t-shirt/jeans/flip-flops OWNED and WORN in their
// torso/legs/shoes slots; the hat and weapon slots start empty.
{
  const it = s.state.items;
  const eq = it.equipped;
  check(
    "starts owning and wearing the default outfit",
    it.tshirt === true && it.jeans === true && it.flipFlops === true &&
      eq.torso === "tshirt" && eq.legs === "jeans" && eq.shoes === "flipFlops" &&
      eq.hat === null && eq.weapon === null,
    JSON.stringify(eq)
  );
}

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

// 2b) The stick sits just east of the bucket: grabbing it AUTO-EQUIPS into
// the (empty) weapon slot — an instant +1 ATK, no menu step needed. The bucket
// was a `once` interact and is filtered out after firing, so the stick is now
// the sole remaining interact point (index 0).
const stickPoint = await page.evaluate(() => {
  const w = window.__game.scene.getScene("shed");
  return w["interactPoints"][0];
});
s = await walkUntilNear(page, "ArrowRight", stickPoint.x, stickPoint.y);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check(
  "the stick auto-equips to the weapon slot on pickup",
  s.state.items.stick === true && s.state.items.equipped.weapon === "stick",
  `stick=${s.state.items.stick} weapon=${s.state.items.equipped.weapon}`
);

// 3) Open the inventory window and equip the bucket from the EQUIPMENT tab
// (the equip toggle moved there) — only an equipped item can be used out in
// the world. Tabs run Inventory · Party · Skills · Equipment, so three taps
// right lands on Equipment. Entries are grouped by slot (hat first), so the
// bucket is row 0 (selected); Space equips it into the HAT slot.
await tap(page, "KeyI");
await page.waitForTimeout(250);
let invOpen = await page.evaluate(() => !!window.__game.scene.getScene("shed")["inventoryMenu"]);
check("inventory window opens on I", invOpen === true);
await tap(page, "ArrowRight"); // -> Party
await tap(page, "ArrowRight"); // -> Skills
await tap(page, "ArrowRight"); // -> Equipment
await page.waitForTimeout(150);
await tap(page, "Space"); // equip the bucket (hat slot)
await page.waitForTimeout(200);
s = await snapshot(page);
check("equipping the bucket on the Equipment tab fills the hat slot", s.state.items.equipped.hat === "bucket", `equipped=${JSON.stringify(s.state.items.equipped)}`);
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

// 5) Deliver it to the coop: completes the chore and awards XP. The bucket is
// wearable headgear as well as a chore tool, so delivery only EMPTIES the pail
// (filled -> empty) — Joseph keeps it and it stays equipped, buff and all.
await standAt(page, "oasis", coopPointBefore.x, coopPointBefore.y);
await tap(page, "KeyE");
await page.waitForTimeout(300);
s = await snapshot(page);
check(
  "delivering the full bucket completes the chore and awards bonus XP",
  s.state.flags.choresDone === true &&
    s.state.hero.xp > xpBeforeChores &&
    s.state.items.bucket === "empty" &&
    s.state.items.equipped.hat === "bucket",
  `choresDone=${s.state.flags.choresDone} xp=${xpBeforeChores}->${s.state.hero.xp} bucket=${s.state.items.bucket} equipped=${JSON.stringify(s.state.items.equipped)}`
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
// The foreman room is where Thomas's broken transmission first cuts in (a
// one-time beat, guarded by heardThomasMine) — confirm it actually fired.
check(
  "Thomas's first transmission reached Joseph in the mine",
  s.state.flags.heardThomasMine === true,
  JSON.stringify(s.state.flags)
);

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

// Cliffhanger: four beats (aftershock, ice reveal, Piggy waddle, sealed),
// each separated by a real animation gap (wall crack, a 2.5s walk tween)
// where no dialogue is open — so drive it round-by-round instead of one
// long wait-then-talkThrough, which would bail out after the first beat.
const cliffhangerStart = Date.now();
while (Date.now() - cliffhangerStart < 15_000) {
  s = await snapshot(page);
  if (s.state.flags.actComplete) break;
  if (s.dialogueOpen) {
    await talkThrough(page, { maxSteps: 10 });
  } else {
    await page.waitForTimeout(300);
  }
}
s = await snapshot(page);
check("act completes (cliffhanger played)", s.state.flags.actComplete === true, JSON.stringify(s.state.flags));
await page.screenshot({ path: path.join(root, "../end-card.png") }).catch(() => {});

// No auto-teleport: after the cliffhanger the ice glows as a doorway and the
// player keeps control — the act must NOT end on its own.
const xpBeforeAct2 = s.state.hero.xp;
check("no auto-teleport: still in the depths after the cliffhanger", s.zoneKey === "depths", `zone=${s.zoneKey}`);
// Follow Piggy INTO the glowing ice (the walk-in that rolls the end card).
await teleport(page, 17, 2);
await page.waitForTimeout(500);
// End card → SPACE descends into Act 2 keeping all progress.
await tap(page, "Space");
s = await waitFor(page, (x) => x.zoneKey === "crevasse", 8000);
check(
  "following Piggy into the ice rolls the end card, then hands off to the crevasse with progress kept",
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

// Mo's shop: once rescued he sells the miner's hat for 2 shinies. Top up the
// purse, talk to him, take the "Buy" choice (index 0) and confirm the hat is
// granted and the shinies spent.
await page.waitForTimeout(2500); // let Mo finish walking to the camp corner
const shiniesBeforeBuy = 3;
await page.evaluate((n) => {
  const st = window.__game.registry.get("act1");
  window.__game.registry.set("act1", { ...st, items: { ...st.items, shinies: n } });
}, shiniesBeforeBuy);
const talkedMo = await talkToNpc(page, "crevasse", 0);
check("can reopen dialogue with the rescued Mo", talkedMo === true);
await talkThrough(page, { pickIndex: 0 }); // pick "Buy the miner's hat"
s = await snapshot(page);
check(
  "buying the miner's hat from Mo grants it and spends 2 shinies",
  s.state.items.minersHat === true && s.state.items.shinies === shiniesBeforeBuy - 2,
  `minersHat=${s.state.items.minersHat} shinies=${s.state.items.shinies}`
);

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

// The kelp-forest hub rest point (Act 3): a free, repeatable full heal.
await restPointCheck(page, "kelpForest", 16, 13, "Act 3 kelp forest");

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
// Five-stage chase now (sighted -> 2 flees + 2 planning asides -> cornered
// in the nook), each hop async (a ~550ms tween arms the next trigger) -
// extra rounds so the driver's re-poll of the trigger list catches each
// newly-armed stage.
s = await driveTriggersUntil("fluffballBed", (x) => x.state.flags.metFluffball, 14);
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

// The camp-stove rest point (Act 4): a free, repeatable full heal.
await restPointCheck(page, "campProper", 16, 11, "Act 4 miners' camp");

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

// The Act 4 ending now HANDS OFF into Act 5 (a real zone, not an end card) —
// dialogue → act4Complete + act5Started → the grove's warm descent.
s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act4Complete === true, 8000);
check("Act 4 completes (stinky socks earned)", s.state.flags.act4Complete === true, JSON.stringify(s.state.flags));
s = await waitFor(page, (x) => x.zoneKey === "groveDescent", 12_000);
check(
  "the camp hands off into Act 5 (a real zone, not an end card), progress kept",
  s.zoneKey === "groveDescent" && s.state.flags.act5Started === true,
  `zone=${s.zoneKey} act5Started=${s.state?.flags?.act5Started}`
);
check("checkpoint updated to the warm descent", s.state.zone === "groveDescent");

// ---------- Act 5: The Sunlit Cave-In (Sahra's grove, a five-zone chain) ----------

// Zone 1 (descent): the arrival beat grounds the warm-air/first-light reveal.
await healUp(page);
s = await driveTriggersUntil("groveDescent", (x) => x.state.flags.sawGroveDescent);
check("the warm-descent arrival beat plays", s.state.flags.sawGroveDescent === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "groveDescent") s = await waitFor(page, (x) => x.zoneKey === "groveDescent", 8000);
await page.screenshot({ path: path.join(root, "../act5-descent.png") }).catch(() => {});

// Zone 1 → Zone 2: the south gate leads on into the grove approach.
s = await exitTo("groveDescent", "groveApproach");
check("the descent leads into the grove approach", s.zoneKey === "groveApproach", `zone=${s.zoneKey}`);
check("checkpoint updated to the grove approach", s.state.zone === "groveApproach");

// Zone 2 (approach): entry beat + the scared near-catch chase (Piggy bolts
// into the needle-cactus, and for once it isn't funny).
await healUp(page);
s = await driveTriggersUntil("groveApproach", (x) => x.state.flags.sawGroveApproach && x.state.flags.sawGroveChase);
check("the grove-approach entry beat plays", s.state.flags.sawGroveApproach === true, JSON.stringify(s.state.flags));
check("the scared near-catch chase plays (Piggy bolts, not playing)", s.state.flags.sawGroveChase === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "groveApproach") s = await waitFor(page, (x) => x.zoneKey === "groveApproach", 8000);
await page.screenshot({ path: path.join(root, "../act5-approach-chase.png") }).catch(() => {});

// Zone 2 → Zone 3: the south gate drops into the river grotto.
s = await exitTo("groveApproach", "groveGrotto");
check("the approach leads into the river grotto", s.zoneKey === "groveGrotto", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("groveGrotto", (x) => x.state.flags.sawGroveGrotto);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("the river-grotto entry beat plays", s.state.flags.sawGroveGrotto === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "groveGrotto") s = await waitFor(page, (x) => x.zoneKey === "groveGrotto", 8000);

// Zone 3 → Zone 4: the south gate opens into the sunlit chamber.
s = await exitTo("groveGrotto", "groveChamber");
check("the grotto leads into the sunlit cave-in", s.zoneKey === "groveChamber", `zone=${s.zoneKey}`);
check("checkpoint updated to the sunlit cave-in", s.state.zone === "groveChamber");

// Zone 4 (chamber): the reveal beat + Fluffball JOINS for real at the tree.
await healUp(page);
s = await driveTriggersUntil("groveChamber", (x) => x.state.flags.sawGroveChamber && x.state.flags.fluffballJoined);
check("the sunlit-cave-in reveal beat plays", s.state.flags.sawGroveChamber === true, JSON.stringify(s.state.flags));
check("Fluffball joins the party in the grove chamber", s.state.flags.fluffballJoined === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "groveChamber") s = await waitFor(page, (x) => x.zoneKey === "groveChamber", 8000);
await page.screenshot({ path: path.join(root, "../act5-chamber-tree.png") }).catch(() => {});

// Fluffball is a NON-COMBAT companion: joining must NOT change the battle
// party. Force a grove encounter and confirm the party is hero + Slither only.
await page.evaluate(() => window.__game.scene.getScene("groveChamber").startBattle(["sunwasp"]));
s = await waitFor(page, (x) => x.battle, 6000);
check("a sunwasp guards the grove (Act 5 encounter starts)", s.battle === true);
const partyKeys = await page.evaluate(() =>
  Array.from(window.__game.scene.getScene("battle").partyCommands.keys())
);
check(
  "Fluffball is non-combat: the battle party stays hero + Slither only",
  partyKeys.includes("hero") && partyKeys.includes("slither") && !partyKeys.includes("fluffball"),
  JSON.stringify(partyKeys)
);
await page.screenshot({ path: path.join(root, "../act5-sunwasp-fight.png") }).catch(() => {});
s = await fightThrough(page, { timeoutMs: 120_000 });
s = await waitFor(page, (x) => x.zoneKey === "groveChamber", 12_000);

// Zone 4 → Zone 5: the east gate leads on to Sahra's corner.
s = await exitTo("groveChamber", "sahraGrove");
check("the chamber leads on to Sahra's grove", s.zoneKey === "sahraGrove", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("sahraGrove", (x) => x.state.flags.sawSahraGrove);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("Sahra's-grove entry beat plays", s.state.flags.sawSahraGrove === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "sahraGrove") s = await waitFor(page, (x) => x.zoneKey === "sahraGrove", 8000);

// Sahra's REACTIVE dialogue spot-check: her lines change with Act 1 choices.
// Read her live script under two different Act-1 flag sets and confirm the
// text genuinely differs (the game's first real callback payoff).
async function sahraTextWith(flags) {
  await page.evaluate((f) => {
    const st = window.__game.registry.get("act1");
    window.__game.registry.set("act1", { ...st, flags: { ...st.flags, ...f } });
  }, flags);
  return page.evaluate(() => {
    const w = window.__game.scene.getScene("sahraGrove");
    const script = w.sahraScript();
    return script.nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
  });
}
const mercyParley = await sahraTextWith({ rabbitTradedColdPack: true, rabbitResolved: false, parleyed: true, queenResolved: false });
check(
  "Sahra reacts to mercy (traded cold pack) + parley (talked to the Queen)",
  /mercy/i.test(mercyParley) && /(talked|words)/i.test(mercyParley),
  mercyParley
);
const gritForce = await sahraTextWith({ rabbitTradedColdPack: false, rabbitResolved: true, parleyed: false, queenResolved: true });
check(
  "Sahra reacts differently to grit (kept the ice) + force (fought the Queen)",
  /practical/i.test(gritForce) && /(fought|muscle)/i.test(gritForce) && gritForce !== mercyParley,
  gritForce
);

// Complete the trade (leave the grit+force flags in place): talk to Sahra,
// take the oranges, roll the ending.
await teleport(page, 11, 6); // just north of SAHRA_NPC (11,7)
await tap(page, "KeyE");
await page.waitForTimeout(300);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.gotOranges === true, 8000);
check(
  "Sahra trades the oldest-row oranges (a new inventory item)",
  s.state.flags.gotOranges === true && s.state.items.oranges === true,
  JSON.stringify(s.state.items)
);

// The Act 5 ending now HANDS OFF into Act 6 (a real zone, not an end card) —
// dialogue → act5Complete + act6Started → the reef's drowned stair.
s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act5Complete === true, 9000);
check("Act 5 completes (grove oranges earned)", s.state.flags.act5Complete === true, JSON.stringify(s.state.flags));
s = await waitFor(page, (x) => x.zoneKey === "reefDescent", 12_000);
check(
  "the grove hands off into Act 6 (a real zone, not an end card), progress kept",
  s.zoneKey === "reefDescent" && s.state.flags.act6Started === true,
  `zone=${s.zoneKey} act6Started=${s.state?.flags?.act6Started}`
);
check("checkpoint updated to the drowned stair", s.state.zone === "reefDescent");

// ---------- Act 6: The Reef (the crawlers' garden, a five-zone chain) ----------

// Zone 1 (descent): the arrival beat grounds the back-underwater reveal.
await healUp(page);
s = await driveTriggersUntil("reefDescent", (x) => x.state.flags.sawReefDescent);
check("the drowned-stair arrival beat plays", s.state.flags.sawReefDescent === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "reefDescent") s = await waitFor(page, (x) => x.zoneKey === "reefDescent", 8000);
await page.screenshot({ path: path.join(root, "../act6-descent.png") }).catch(() => {});

// Zone 1 → Zone 2: the south gate leads on into the crawlers' garden.
s = await exitTo("reefDescent", "reefGarden");
check("the descent leads into the crawlers' garden", s.zoneKey === "reefGarden", `zone=${s.zoneKey}`);
check("checkpoint updated to the crawlers' garden", s.state.zone === "reefGarden");

// Zone 2 (garden): entry beat + a reef encounter that confirms Fluffball stays
// NON-COMBAT (the party is hero + Slither, never Fluffball) — same as Act 5.
await healUp(page);
s = await driveTriggersUntil("reefGarden", (x) => x.state.flags.sawReefGarden);
check("the crawlers'-garden entry beat plays", s.state.flags.sawReefGarden === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "reefGarden") s = await waitFor(page, (x) => x.zoneKey === "reefGarden", 8000);

// The mint-kelp rows rest point (Act 6): a free, repeatable full heal, right
// before the reefstalker fight below.
await restPointCheck(page, "reefGarden", 21, 9, "Act 6 crawlers' garden");

await page.screenshot({ path: path.join(root, "../act6-garden.png") }).catch(() => {});
await page.evaluate(() => window.__game.scene.getScene("reefGarden").startBattle(["reefstalker"]));
s = await waitFor(page, (x) => x.battle, 6000);
check("a reef stalker hunts the garden (Act 6 encounter starts)", s.battle === true);
const reefParty = await page.evaluate(() =>
  Array.from(window.__game.scene.getScene("battle").partyCommands.keys())
);
check(
  "Fluffball stays non-combat in Act 6: the battle party is hero + Slither only",
  reefParty.includes("hero") && reefParty.includes("slither") && !reefParty.includes("fluffball"),
  JSON.stringify(reefParty)
);
s = await fightThrough(page, { timeoutMs: 120_000 });
s = await waitFor(page, (x) => x.zoneKey === "reefGarden", 12_000);

// Zone 2 → Zone 3: the south gate drops into the coral warren.
s = await exitTo("reefGarden", "reefWarren");
check("the garden leads into the coral warren", s.zoneKey === "reefWarren", `zone=${s.zoneKey}`);

// Zone 3 (warren): entry beat + the TENSE chase-and-turn (Piggy cornered for
// real, frightened, slips through a gap; Fluffball — not Joseph — calls after).
await healUp(page);
s = await driveTriggersUntil("reefWarren", (x) => x.state.flags.sawReefWarren && x.state.flags.sawReefChase);
check("the coral-warren entry beat plays", s.state.flags.sawReefWarren === true, JSON.stringify(s.state.flags));
check("the tense chase-and-turn plays (Piggy frightened, slips away)", s.state.flags.sawReefChase === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "reefWarren") s = await waitFor(page, (x) => x.zoneKey === "reefWarren", 8000);
await page.screenshot({ path: path.join(root, "../act6-warren-chase.png") }).catch(() => {});

// Zone 3 → Zone 4: the south gate opens into the glowing hollow.
s = await exitTo("reefWarren", "reefHollow");
check("the warren leads into the glowing hollow", s.zoneKey === "reefHollow", `zone=${s.zoneKey}`);
await healUp(page);
s = await driveTriggersUntil("reefHollow", (x) => x.state.flags.sawReefHollow);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("the glowing-hollow entry beat plays", s.state.flags.sawReefHollow === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "reefHollow") s = await waitFor(page, (x) => x.zoneKey === "reefHollow", 8000);

// Zone 4 → Zone 5: the south gate leads on to the crawler court.
s = await exitTo("reefHollow", "reefCourt");
check("the hollow leads on to the crawler court", s.zoneKey === "reefCourt", `zone=${s.zoneKey}`);
check("checkpoint updated to the crawler court", s.state.zone === "reefCourt");
await healUp(page);
s = await driveTriggersUntil("reefCourt", (x) => x.state.flags.sawReefCourt);
if ((await snapshot(page)).dialogueOpen) await talkThrough(page);
check("the crawler-court entry beat plays", s.state.flags.sawReefCourt === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "reefCourt") s = await waitFor(page, (x) => x.zoneKey === "reefCourt", 8000);
await page.screenshot({ path: path.join(root, "../act6-court.png") }).catch(() => {});

// --- The diplomacy: a TRADE, not a fight (a queen-shaped branch point) ---
// First, introspect the warden's live parley: both branches must be wired — a
// courteous first choice leads on toward the trade, a rude one to `affront`.
const parley = await page.evaluate(() => {
  const w = window.__game.scene.getScene("reefCourt");
  const scr = w.wardenScript(); // the reefParley branch point (pre-fight, pre-trade)
  const ids = scr.nodes.map((n) => n.id);
  const meet = scr.nodes.find((n) => n.id === scr.start);
  return { ids, good: meet.choices?.[0]?.next, bad: meet.choices?.[1]?.next, start: scr.start };
});
check(
  "the warden opens the trade-not-fight parley with BOTH branches wired",
  parley.start === "meet" &&
    parley.ids.includes("trade-end") &&
    parley.ids.includes("affront") &&
    parley.bad === "affront",
  JSON.stringify(parley)
);

// The AVOIDABLE fight-fallback path: a BAD approach (the rude first choice)
// calls a reef predator down — an avoidable BattleScene, not an instant one.
await talkToNpc(page, "reefCourt", 0);
await talkThrough(page, { pickIndex: 1, maxSteps: 40 }); // grab the kelp → affront
s = await waitFor(page, (x) => x.battle, 8000);
check("a bad approach starts the AVOIDABLE reef-stalker fight (not an instant one)", s.battle === true);
await page.screenshot({ path: path.join(root, "../act6-court-fight.png") }).catch(() => {});
s = await fightThrough(page, { timeoutMs: 150_000 });
s = await waitFor(page, (x) => x.zoneKey === "reefCourt", 12_000);
check(
  "winning the avoidable fight sets reefFought (the crawlers were tested, not slain)",
  s.state.flags.reefFought === true && s.state.flags.gotSeaweed !== true,
  JSON.stringify(s.state.flags)
);

// Post-fight, the crawlers relent — talk again and they trade the kelp in peace
// (the successful trade: seaweed, a new inventory item, changes hands).
await talkToNpc(page, "reefCourt", 0);
await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.gotSeaweed === true, 8000);
check(
  "the crawlers trade the mint kelp — the seaweed (a new inventory item)",
  s.state.flags.gotSeaweed === true && s.state.items.seaweed === true,
  JSON.stringify(s.state.items)
);

// The Act 6 ending: dialogue → act6Complete + act7Started → a REAL hand-off
// into Act 7's entry zone (not an end card, like every prior retrofit).
s = await waitFor(page, (x) => x.dialogueOpen === true, 8000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act6Complete === true, 9000);
check("Act 6 completes (reef mint kelp earned)", s.state.flags.act6Complete === true, JSON.stringify(s.state.flags));
s = await waitFor(page, (x) => x.zoneKey === "pizzaDescent", 9000);
check(
  "Act 6 hands off into Act 7 (a real zone, not a title-card placeholder)",
  s.zoneKey === "pizzaDescent" && s.state.flags.act7Started === true,
  `zone=${s.zoneKey}`
);

// ---------- Act 7: La Pizzeria Sotterranea (the finale — closing Part One) ----------

// Zone 1 (warm descent): the tomato-pie smell (the Act 2 seed) → into the vents.
await healUp(page);
s = await driveTriggersUntil("pizzaDescent", (x) => x.state.flags.sawPizzaDescent);
check("the warm-deep arrival beat plays (tomato-pie smell paid off)", s.state.flags.sawPizzaDescent === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "pizzaDescent") s = await waitFor(page, (x) => x.zoneKey === "pizzaDescent", 8000);
await page.screenshot({ path: path.join(root, "../act7-descent.png") }).catch(() => {});
s = await exitTo("pizzaDescent", "pizzaVent");
check("the descent leads into the lava vents", s.zoneKey === "pizzaVent", `zone=${s.zoneKey}`);

// Zone 2 (lava vents): entry beat → south into the old kitchens.
s = await driveTriggersUntil("pizzaVent", (x) => x.state.flags.sawPizzaVent);
check("the lava-vents entry beat plays", s.state.flags.sawPizzaVent === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "pizzaVent") s = await waitFor(page, (x) => x.zoneKey === "pizzaVent", 8000);
await page.screenshot({ path: path.join(root, "../act7-vents.png") }).catch(() => {});
s = await exitTo("pizzaVent", "pizzaApproach");
check("the vents lead into the old kitchens", s.zoneKey === "pizzaApproach", `zone=${s.zoneKey}`);

// Zone 3 (old kitchens): entry beat → south into the restaurant.
s = await driveTriggersUntil("pizzaApproach", (x) => x.state.flags.sawPizzaApproach);
check("the old-kitchens entry beat plays", s.state.flags.sawPizzaApproach === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "pizzaApproach") s = await waitFor(page, (x) => x.zoneKey === "pizzaApproach", 8000);
s = await exitTo("pizzaApproach", "pizzeria");
check("the kitchens lead into La Pizzeria Sotterranea", s.zoneKey === "pizzeria", `zone=${s.zoneKey}`);
check("checkpoint updated to the pizzeria", s.state.zone === "pizzeria");

// Zone 4 (the pizzeria): meet Testudo → the bake → the catch → the reveal.
s = await driveTriggersUntil("pizzeria", (x) => x.state.flags.metTestudo);
check("the restaurant arrival beat plays (Chef Testudo)", s.state.flags.metTestudo === true, JSON.stringify(s.state.flags));
if (s.zoneKey !== "pizzeria") s = await waitFor(page, (x) => x.zoneKey === "pizzeria", 8000);
await page.screenshot({ path: path.join(root, "../act7-testudo.png") }).catch(() => {});

// THE BAKE: talk to Testudo → "Bake the pizza." → the cooking timing minigame.
await talkToNpc(page, "pizzeria", 0);
await talkThrough(page, { pickIndex: 0, maxSteps: 40 }); // "Bake the pizza." → bake-end
await page.waitForTimeout(300);
const cookOpen = await page.evaluate(() => !!window.__game.scene.getScene("pizzeria").cookingMenu);
check("baking opens the cooking timing minigame", cookOpen === true);
await page.screenshot({ path: path.join(root, "../act7-cooking.png") }).catch(() => {});

// Drive the bake: read the pure cooking state, PLACE only when the heat marker
// is well inside the glowing band (four clean toppings → a perfect pizza).
const cookDeadline = Date.now() + 45_000;
let baked = false;
while (Date.now() < cookDeadline) {
  const cs = await page.evaluate(() => {
    const w = window.__game.scene.getScene("pizzeria");
    const m = w.cookingMenu;
    if (!m) return { open: false, baked: window.__game.registry.get("act1").flags.pizzaBaked === true };
    return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
  });
  if (!cs.open) { baked = cs.baked; break; }
  if (Math.abs(cs.p - cs.t) < cs.w * 0.5) await tap(page, "Space", 30);
  await page.waitForTimeout(25);
}
check("the cooking minigame bakes the perfect pizza", baked === true);
s = await waitFor(page, (x) => x.state.flags.pizzaBaked === true, 8000);
check("the pizza is baked", s.state.flags.pizzaBaked === true, JSON.stringify(s.state.flags));

// THE CATCH (a warm reunion, NOT a chase): Piggy comes to the smell, is caught.
s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.piggyCaught === true, 9000);
check("Piggy is finally, gently caught (the reunion payoff, not a chase)", s.state.flags.piggyCaught === true, JSON.stringify(s.state.flags));
await page.screenshot({ path: path.join(root, "../act7-reunion.png") }).catch(() => {});

// THE REVEAL (the glacier/old-ocean secret — the ONE mystery that resolves).
s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.heardReveal === true, 9000);
check("Testudo reveals the ice/ocean secret", s.state.flags.heardReveal === true, JSON.stringify(s.state.flags));
await page.screenshot({ path: path.join(root, "../act7-reveal.png") }).catch(() => {});

// Hand-off to the finale ascent (a real zone), Piggy now caught and following.
s = await waitFor(page, (x) => x.zoneKey === "pizzaAscent", 12_000);
check("the reveal hands off to the long climb up (a real zone)", s.zoneKey === "pizzaAscent", `zone=${s.zoneKey}`);

// Zone 5 (the ascent): the arrival beat (auto-fires on spawn), then the finale.
if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await snapshot(page);
if (!s.state.flags.sawPizzaAscent) {
  await teleport(page, 10, 14);
  await page.waitForTimeout(400);
  if ((await snapshot(page)).dialogueOpen) await talkThrough(page, { maxSteps: 40 });
  s = await snapshot(page);
}
check("the long-way-up arrival beat plays (Piggy following)", s.state.flags.sawPizzaAscent === true, JSON.stringify(s.state.flags));

// The finale: walk into the top trigger → Rosa's radio crackles back, then the
// floor gives way. A deliberate END OF PART ONE cliffhanger.
const finaleRect = await page.evaluate(() => {
  const w = window.__game.scene.getScene("pizzaAscent");
  return w.triggers[w.triggers.length - 1].rect; // the finale trigger (added last)
});
await teleport(page, finaleRect.x1, finaleRect.y1);
await page.waitForTimeout(500);
s = await waitFor(page, (x) => x.dialogueOpen === true, 9000);
if (s.dialogueOpen) await talkThrough(page, { maxSteps: 40 });
s = await waitFor(page, (x) => x.state.flags.act7Complete === true, 12_000);
check(
  "Part One completes on the finale (piggyCaught + partOneComplete)",
  s.state.flags.act7Complete === true &&
    s.state.flags.piggyCaught === true &&
    s.state.flags.partOneComplete === true,
  JSON.stringify(s.state.flags)
);
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(root, "../act7-endofpartone.png") }).catch(() => {});

// The END OF PART ONE card → hands off into the Part Two opening cutscene
// (Joseph and Thomas finally connecting over the radio).
await tap(page, "Space");
const atPartTwo = await waitFor(page, (x) => x.active?.includes("partTwoOpening"), 9000);
check(
  "the END OF PART ONE card hands off into the Part Two opening cutscene",
  atPartTwo.active?.includes("partTwoOpening") === true,
  JSON.stringify(atPartTwo.active)
);

// The cutscene plays its four radio lines; advance through them.
const cutsceneDialogueOpen = () =>
  page.evaluate(() => window.__game.scene.getScene("partTwoOpening")?.dialogue?.isOpen ?? false);
let linesSeen = 0;
for (let i = 0; i < 12; i++) {
  if (!(await cutsceneDialogueOpen())) break;
  linesSeen++;
  await tap(page, "Space");
  await page.waitForTimeout(200);
}
check("the Part Two opening plays its four radio lines", linesSeen >= 4, `saw ${linesSeen}`);

// The "to be continued" beat → SPACE returns to the title (Part Two's rest
// isn't built yet).
await page.waitForTimeout(200);
await tap(page, "Space");
const backAtTitle = await waitFor(page, (x) => x.active?.includes("boot"), 9000);
check(
  "the Part Two opening returns to the title (rest of Part Two not built yet)",
  backAtTitle.active?.includes("boot") === true,
  JSON.stringify(backAtTitle.active)
);

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll Act 1–7 smoke checks passed — the full game, fresh save through END OF PART ONE");
