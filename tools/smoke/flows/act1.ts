/**
 * Act 1 flow — the navigation half of the crash-to-Dust-Queen playthrough,
 * ported from tools/smoke/e2e.mjs:227-753 with every check() removed and a
 * snapshot(page) captured into `beats` at each point the source asserts.
 *
 * `newGameStart(page)` boots fresh and taps NEW GAME (returning the crash
 * snapshot); `driveAct1(page)` walks the act and returns the beats record.
 * The matching assertions live in tools/smoke/acts/act1.spec.ts — one
 * expect() per original check(). This is the template Acts 2-7 follow.
 */
import type { Page } from "@playwright/test";
import { snapshot, waitFor, waitForBoot, type Snap } from "../kit/snapshot";
import {
  tap,
  teleport,
  talkThrough,
  fightThrough,
  talkToNpc,
  fightIfBattle,
  healUp,
  standAt,
  walkUntilNear,
  exitTo,
} from "../kit/actions";

/**
 * Boot a clean session, confirm the title menu is up, and start a NEW GAME
 * (the first, highlighted option when no save exists). Returns the crash-site
 * snapshot augmented with `titleUp` so the spec can assert the title beat.
 */
export async function newGameStart(page: Page): Promise<Snap> {
  await page.addInitScript(() => localStorage.clear()); // deterministic: no save yet
  await page.goto("/");
  await waitForBoot(page);
  const titleUp = await page.evaluate(() => {
    const boot = (window as any).__game.scene.getScene("boot");
    return boot.scene.isActive();
  });
  await tap(page, "Space"); // NEW GAME
  const s = await waitFor(page, (x) => x.zoneKey === "crash", 8000);
  return { ...s, titleUp };
}

/** Walk all of Act 1, capturing a beat snapshot wherever the source asserts. */
export async function driveAct1(page: Page): Promise<Record<string, Snap>> {
  const beats: Record<string, Snap> = {};

  // ---------- Beat 1: crash site ----------
  beats.crashStart = await snapshot(page);

  // Movement + walk animation still work.
  await page.waitForTimeout(600);
  await page.keyboard.down("ArrowRight");
  await page.waitForTimeout(500);
  await page.keyboard.up("ArrowRight");
  beats.playerMoves = await snapshot(page);

  // Talk to Rosa (landmark from crashMap: she's near the truck).
  const rosaOpened = await talkToNpc(page, "crash", 0);
  beats.rosa = { ...(await snapshot(page)), rosaOpened };
  await talkThrough(page);
  beats.coldPack = await snapshot(page);

  // Frost feather pickup (+5 XP): the feather trigger tile is exported by the map.
  const trig = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("crash");
    return w["triggers"].map((t: any) => t.rect);
  });
  if (trig.length) {
    await teleport(page, trig[0].x1, trig[0].y1);
    await page.waitForTimeout(400);
  }
  beats.frostFeatherXp = await snapshot(page);

  // ---------- Beat 2: oasis ----------
  // The crash->oasis exit is a gated trigger; visit trigger rects until the zone changes.
  const crashTrigs = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("crash");
    return w["triggers"].map((t: any) => t.rect);
  });
  for (const r of crashTrigs) {
    const cur = await snapshot(page);
    if (cur.zoneKey !== "crash") break;
    await teleport(page, r.x1, r.y1);
    await page.waitForTimeout(600);
    const mid = await snapshot(page);
    if (mid.dialogueOpen) await talkThrough(page);
  }
  beats.oasisEast = await waitFor(page, (x) => x.zoneKey === "oasis");

  // ---------- Open Desert POC: oasis -> overworld -> mine entrance -> back ----------
  const oasisExits = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return w["exits"].map((e: any) => ({ rect: e.rect, target: e.target }));
  });
  const toOverworld = oasisExits.find((e: any) => e.target === "overworld");
  await teleport(page, toOverworld!.rect.x1, toOverworld!.rect.y1);
  const owSnap = await waitFor(page, (x) => x.zoneKey === "overworld", 8000);
  beats.overworldNorth = { ...owSnap, hasNorthExit: !!toOverworld };

  const owExits = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("overworld");
    return w["exits"].map((e: any) => ({ rect: e.rect, target: e.target }));
  });
  const toMineEntrance = owExits.find((e: any) => e.target === "mineEntrance");
  const hasOasisAndMine = owExits.some((e: any) => e.target === "oasis") && !!toMineEntrance;
  await teleport(page, toMineEntrance!.rect.x1, toMineEntrance!.rect.y1);
  const meSnap = await waitFor(page, (x) => x.zoneKey === "mineEntrance", 8000);
  // 160x160 vs the 480x270 viewport — also centered, not pinned.
  const cam = await page.evaluate(() => {
    const c = (window as any).__game.scene.getScene("mineEntrance").cameras.main;
    return { scrollX: c.scrollX, scrollY: c.scrollY };
  });
  // Sealed: mineOpen is still false at this point in the playthrough.
  const meTrigs = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("mineEntrance");
    return w["triggers"].map((t: any) => t.rect);
  });
  await teleport(page, meTrigs[0].x1, meTrigs[0].y1);
  await page.waitForTimeout(400);
  const sealed = await snapshot(page);
  beats.mineEntrance = { ...meSnap, hasOasisAndMine, cam, sealed };
  if (sealed.dialogueOpen) await talkThrough(page);

  // Force mineOpen just for this check, confirm the door opens, then restore.
  const beforeFlags = (await snapshot(page)).state.flags;
  await page.evaluate(() => {
    const st = (window as any).__game.registry.get("act1");
    (window as any).__game.registry.set("act1", { ...st, flags: { ...st.flags, mineOpen: true } });
  });
  await teleport(page, meTrigs[0].x1, meTrigs[0].y1);
  beats.mineOpenThreshold = await waitFor(page, (x) => x.zoneKey === "mine", 8000);
  await page.evaluate((flags) => {
    const st = (window as any).__game.registry.get("act1");
    (window as any).__game.registry.set("act1", { ...st, flags });
  }, beforeFlags); // restore: the real mine-open moment is Dusty's, later on the Trail

  // Back to the oasis via the overworld's own south exit. Stop every other
  // active scene first (a bare scene.start() does not stop the current one).
  await page.evaluate(() => {
    const g = (window as any).__game;
    for (const sc of g.scene.getScenes(true)) {
      if (sc.scene.key !== "boot") g.scene.stop(sc.scene.key);
    }
    g.scene.start("overworld", {});
  });
  await page.waitForTimeout(700);
  const owExits2 = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("overworld");
    return w["exits"].map((e: any) => ({ rect: e.rect, target: e.target }));
  });
  const toOasis = owExits2.find((e: any) => e.target === "oasis");
  await teleport(page, toOasis!.rect.x1, toOasis!.rect.y1);
  beats.overworldSouth = await waitFor(page, (x) => x.zoneKey === "oasis", 8000);

  // ---------- Beat 2b: parents, deliberate defeat, then tutorial win ----------
  const parentsOpened = await talkToNpc(page, "oasis", 0);
  beats.parents = { ...(await snapshot(page)), parentsOpened };
  await talkThrough(page, { exitIndex: 99 }); // always the LAST choice (goodbye)
  beats.tutorialStart = await waitFor(page, (x) => x.battle, 8000);

  // Lose on purpose: never act. Scarab needs ~5 hits.
  await fightThrough(page, { act: false, timeoutMs: 120_000 });
  const defeatSnap = await waitFor(page, (x) => x.zoneKey === "oasis", 10_000);
  const spawn = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return { x: w["cfg"].defaultSpawn.x * 16 + 8, y: w["cfg"].defaultSpawn.y * 16 + 8 };
  });
  const fullHp = await page.evaluate(() => (window as any).__game.registry.get("act1").hp);
  beats.respawn = { ...defeatSnap, spawn, fullHp };

  // Now win the tutorial battle.
  await talkToNpc(page, "oasis", 0);
  await talkThrough(page, { exitIndex: 99 });
  await waitFor(page, (x) => x.battle, 8000);
  await fightThrough(page);
  beats.tutorialWon = await waitFor(page, (x) => x.zoneKey === "oasis", 10_000);

  // ---------- Optional chore quest: bucket fetch ----------
  const xpBeforeChores = (await snapshot(page)).state.hero.xp;

  // 1) Pressing E at the coop with no bucket: a hint, no state change.
  const coopPoint = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return w["interactPoints"][0]; // coop is added first, in placeCoop()
  });
  await standAt(page, "oasis", coopPoint.x, coopPoint.y);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  const coopHint = await snapshot(page);
  if (coopHint.dialogueOpen) await talkThrough(page);

  // 2) South to the shed.
  const shedSnap = await exitTo(page, "oasis", "shed");
  const shedCam = await page.evaluate(() => {
    const c = (window as any).__game.scene.getScene("shed").cameras.main;
    return { scrollX: c.scrollX, scrollY: c.scrollY };
  });
  beats.shed = { ...shedSnap, coopHint, cam: shedCam };

  // Walk (real keypresses) down to the bucket, then pick it up.
  const bucketPoint = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("shed");
    return w["interactPoints"][0];
  });
  const walkSnap = await walkUntilNear(page, "ArrowDown", bucketPoint.x, bucketPoint.y);
  const reachedBucketDist = Math.hypot(walkSnap.px - bucketPoint.x, walkSnap.py - bucketPoint.y);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  const pickupSnap = await snapshot(page);

  // 2b) The stick sits just east: grabbing it AUTO-EQUIPS into the weapon slot.
  const stickPoint = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("shed");
    return w["interactPoints"][0];
  });
  await walkUntilNear(page, "ArrowRight", stickPoint.x, stickPoint.y);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  const stickSnap = await snapshot(page);
  beats.bucketPickup = { ...pickupSnap, reachedBucketDist, stick: stickSnap };

  // 3) Open the inventory, tab to Equipment, equip the bucket (hat slot).
  await tap(page, "KeyI");
  await page.waitForTimeout(250);
  const invOpened = await page.evaluate(
    () => !!(window as any).__game.scene.getScene("shed")["inventoryMenu"]
  );
  await tap(page, "ArrowRight"); // -> Party
  await tap(page, "ArrowRight"); // -> Skills
  await tap(page, "ArrowRight"); // -> Equipment
  await page.waitForTimeout(150);
  await tap(page, "Space"); // equip the bucket (hat slot)
  await page.waitForTimeout(200);
  const equipSnap = await snapshot(page);
  await tap(page, "KeyI"); // close
  await page.waitForTimeout(250);
  const invClosed = await page.evaluate(
    () => !!(window as any).__game.scene.getScene("shed")["inventoryMenu"]
  );
  beats.inventoryEquip = { ...equipSnap, invOpened, invClosed };

  // 4) Back to the oasis, fill the equipped bucket at the spigot.
  const backSnap = await exitTo(page, "shed", "oasis");
  const spigotPoint = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return w["interactPoints"][1]; // [0] coop, [1] spigot
  });
  await standAt(page, "oasis", spigotPoint.x, spigotPoint.y);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  beats.spigotFill = { ...(await snapshot(page)), backZone: backSnap.zoneKey };

  // 5) Deliver it to the coop: completes the chore and awards XP.
  await standAt(page, "oasis", coopPoint.x, coopPoint.y);
  await tap(page, "KeyE");
  await page.waitForTimeout(300);
  beats.choreComplete = { ...(await snapshot(page)), xpBeforeChores };

  // ---------- Beat 3: the trail ----------
  const backInOasis = await waitFor(page, (x) => x.zoneKey === "oasis", 8000);
  const oasisExits2 = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return w["exits"].map((e: any) => ({ rect: e.rect, target: e.target }));
  });
  const toTrail = oasisExits2.find((e: any) => e.target === "trail");
  await teleport(page, toTrail!.rect.x1, toTrail!.rect.y1);
  const trailSnap = await waitFor(page, (x) => x.zoneKey === "trail");
  await talkThrough(page); // radio check-in
  beats.trail = { ...trailSnap, backZone: backInOasis.zoneKey };

  // Random encounter: pace in the open lakebed until one fires.
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
  const encBattle = enc.battle;
  await fightThrough(page);
  const victorySnap = await waitFor(page, (x) => x.zoneKey === "trail", 10_000);
  const trailSpawn = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("trail");
    return { x: w["cfg"].defaultSpawn.x * 16 + 8, y: w["cfg"].defaultSpawn.y * 16 + 8 };
  });
  beats.randomEncounter = { ...victorySnap, encBattle, trailSpawn };

  // Ice chips: collect all three via their trigger rects.
  const chipRects = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("trail");
    return w["triggers"].filter((t: any) => !t.fired).map((t: any) => t.rect);
  });
  for (const r of chipRects) {
    await teleport(page, r.x1, r.y1);
    await page.waitForTimeout(350);
    const after = await snapshot(page);
    if (after.dialogueOpen) await talkThrough(page); // stray trigger (mine grate etc.)
  }
  beats.chips = await snapshot(page);

  // Talk to every trail NPC (jackrabbit: fight and win; Dusty: opens the mine).
  for (let pass = 0; pass < 2; pass++) {
    const npcCount = await page.evaluate(
      () => (window as any).__game.scene.getScene("trail")["npcs"].length
    );
    for (let i = 0; i < npcCount; i++) {
      await healUp(page);
      const opened = await talkToNpc(page, "trail", i);
      if (!opened) continue;
      await talkThrough(page, { pickIndex: 0 });
      await fightIfBattle(page, "trail");
    }
  }
  beats.jackrabbit = await snapshot(page);

  // ---------- Beat 4: the mine ----------
  const trailTrigs = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("trail");
    return w["triggers"].map((t: any) => t.rect);
  });
  for (const r of trailTrigs) {
    const cur = await snapshot(page);
    if (cur.zoneKey !== "trail") break;
    await teleport(page, r.x1, r.y1);
    await page.waitForTimeout(600);
    const mid = await snapshot(page);
    if (mid.dialogueOpen) await talkThrough(page);
  }
  beats.mineEnter = await waitFor(page, (x) => x.zoneKey === "mine");
  await talkThrough(page); // radio

  // Pull the lever, fight the Foreman.
  const mineTrigs = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("mine");
    return w["triggers"].map((t: any) => ({ rect: t.rect, fired: t.fired }));
  });
  let s = await snapshot(page);
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
  beats.leverForeman = s;

  // Elevator down.
  const mineExits = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("mine");
    return w["triggers"].map((t: any) => t.rect);
  });
  for (const r of mineExits) {
    const cur = await snapshot(page);
    if (cur.zoneKey !== "mine") break;
    await teleport(page, r.x1, r.y1);
    await page.waitForTimeout(700);
  }
  beats.depths = await waitFor(page, (x) => x.zoneKey === "depths", 8000);

  // ---------- Beat 5: Dust Queen + cliffhanger ----------
  beats.levelPerks = await snapshot(page);

  const depthTrigs = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("depths");
    return w["triggers"].map((t: any) => t.rect);
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
  beats.queenBattle = { ...(await snapshot(page)), queenBattleSeen };
  await fightThrough(page, { timeoutMs: 150_000 });
  beats.queenResolved = await waitFor(page, (x) => x.zoneKey === "depths", 12_000);

  // Cliffhanger: drive it round-by-round (animation gaps have no dialogue open).
  const cliffhangerStart = Date.now();
  while (Date.now() - cliffhangerStart < 15_000) {
    const cliff = await snapshot(page);
    if (cliff.state.flags.actComplete) break;
    if (cliff.dialogueOpen) await talkThrough(page, { maxSteps: 10 });
    else await page.waitForTimeout(300);
  }
  // Same snapshot backs both the completion and the no-auto-teleport checks.
  const endSnap = await snapshot(page);
  beats.actComplete = endSnap;
  beats.noAutoTeleport = endSnap;

  return beats;
}
