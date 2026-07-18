import { test, expect } from "@playwright/test";
import { newGameStart, driveAct1 } from "../flows/act1";

// A full Act-1 walkthrough (deliberate tutorial defeat, a paced random
// encounter, several fights, the Queen boss + cliffhanger) runs well past
// the 180s default; give it room.
test.setTimeout(600_000);

// Capture uncaught page errors for the final "no page errors" assertion.
test.beforeEach(async ({ page }) => {
  const arr: string[] = [];
  (page as any).__pageErrors = arr;
  page.on("pageerror", (e) => arr.push(e.message));
});

test("Act 1 — crash to Dust Queen cliffhanger", async ({ page }) => {
  const start = await newGameStart(page);
  const b = await driveAct1(page);

  // ---- boot / crash site ----
  expect(start.titleUp, "title menu shows on boot").toBe(true);
  expect(b.crashStart.zoneKey, "New Game starts the crash site").toBe("crash");
  expect(
    b.crashStart.state.items.owned.tshirt === 1 &&
      b.crashStart.state.items.owned.jeans === 1 &&
      b.crashStart.state.items.owned.flipFlops === 1 &&
      b.crashStart.state.items.equipped.hero.torso === "tshirt" &&
      b.crashStart.state.items.equipped.hero.legs === "jeans" &&
      b.crashStart.state.items.equipped.hero.shoes === "flipFlops" &&
      b.crashStart.state.items.equipped.hero.hat === null &&
      b.crashStart.state.items.equipped.hero.weapon === null,
    "starts owning and wearing the default outfit"
  ).toBeTruthy();
  expect(b.playerMoves.px, "player moves").toBeGreaterThan(b.crashStart.px + 10);

  // ---- Rosa, cold pack, frost feather ----
  expect(b.rosa.rosaOpened, "Rosa dialogue opens").toBeTruthy();
  expect(
    b.coldPack.state.items.coldPack === true && b.coldPack.state.flags.metRosa === true,
    "cold pack granted"
  ).toBeTruthy();
  expect(b.frostFeatherXp.state.hero.xp, "frost feather awards XP").toBeGreaterThanOrEqual(5);
  expect(
    b.frostFeatherXp.state.items.owned.frostFeather,
    "frost feather drops one into the shared pool"
  ).toBe(1);

  // ---- oasis ----
  expect(b.oasisEast.zoneKey, "east exit reaches the oasis").toBe("oasis");
  expect(b.oasisEast.state.zone, "checkpoint updated to oasis").toBe("oasis");

  // ---- Open Desert POC ----
  expect(b.overworldNorth.hasNorthExit, "oasis has a north exit to the overworld").toBeTruthy();
  expect(b.overworldNorth.zoneKey, "oasis's north exit reaches the overworld").toBe("overworld");
  expect(
    b.mineEntrance.hasOasisAndMine,
    "the overworld has exits back to the oasis and on to the mine entrance"
  ).toBeTruthy();
  expect(
    b.mineEntrance.zoneKey,
    "the overworld's north exit reaches the mine entrance"
  ).toBe("mineEntrance");
  expect(
    b.mineEntrance.cam.scrollX === -160 && b.mineEntrance.cam.scrollY === -55,
    "the mine entrance (smaller than the viewport) renders centered, not pinned to a corner"
  ).toBeTruthy();
  expect(
    b.mineEntrance.sealed.zoneKey === "mineEntrance" && b.mineEntrance.sealed.dialogueOpen === true,
    "the mine entrance is sealed before Dusty opens the mine"
  ).toBeTruthy();
  expect(
    b.mineOpenThreshold.zoneKey,
    "once mineOpen, the mine entrance's threshold leads into Cinnabar Mine"
  ).toBe("mine");
  expect(b.overworldSouth.zoneKey, "the overworld's south exit returns to the oasis").toBe("oasis");

  // ---- parents, tutorial defeat + respawn + win ----
  expect(b.parents.parentsOpened, "parents' dialogue opens").toBeTruthy();
  expect(b.tutorialStart.battle, "tutorial battle starts after meeting the parents").toBe(true);
  expect(
    b.respawn.zoneKey === "oasis" &&
      Math.abs(b.respawn.px - b.respawn.spawn.x) < 2 &&
      Math.abs(b.respawn.py - b.respawn.spawn.y) < 2,
    "defeat returns to the START of the scene"
  ).toBeTruthy();
  expect(
    b.respawn.fullHp >= 32 && b.respawn.state.hero.xp >= 5,
    "respawn restores full HP and keeps XP"
  ).toBeTruthy();
  expect(b.tutorialWon.state.flags.tutorialBattleWon, "tutorial battle won").toBe(true);
  expect(b.tutorialWon.state.hero.xp, "battle XP awarded").toBeGreaterThanOrEqual(13);

  // ---- chore quest: bucket fetch ----
  expect(
    b.shed.coopHint.state.items.bucket === "none" && b.shed.coopHint.state.flags.choresDone !== true,
    "coop hints instead of completing with no bucket"
  ).toBeTruthy();
  expect(b.shed.zoneKey, "south exit reaches the shed").toBe("shed");
  expect(
    b.shed.cam.scrollX === -112 && b.shed.cam.scrollY === -39,
    "the shed (smaller than the viewport) renders centered, not pinned to a corner"
  ).toBeTruthy();
  expect(
    b.bucketPickup.reachedBucketDist,
    "walking down from the shed spawn reaches the bucket"
  ).toBeLessThan(22);
  expect(b.bucketPickup.state.items.bucket, "picking up the bucket sets its state to empty").toBe(
    "empty"
  );
  expect(
    b.bucketPickup.stick.state.items.owned.stick === 1 &&
      b.bucketPickup.stick.state.items.equipped.hero.weapon === "stick",
    "the stick enters the pool and auto-equips to the hero's weapon slot"
  ).toBeTruthy();
  expect(b.inventoryEquip.invOpened, "inventory window opens on I").toBe(true);
  expect(
    b.inventoryEquip.state.items.equipped.hero.hat,
    "equipping the bucket on the Equipment tab fills the hero's hat slot"
  ).toBe("bucket");
  expect(b.inventoryEquip.invClosed, "inventory window closes on I").toBe(false);
  expect(b.spigotFill.backZone, "shed exit returns to the oasis").toBe("oasis");
  expect(
    b.spigotFill.state.items.bucket,
    "filling the equipped bucket at the spigot sets its state to filled"
  ).toBe("filled");
  expect(
    b.choreComplete.state.flags.choresDone === true &&
      b.choreComplete.state.hero.xp > b.choreComplete.xpBeforeChores &&
      b.choreComplete.state.items.bucket === "empty" &&
      b.choreComplete.state.items.equipped.hero.hat === "bucket",
    "delivering the full bucket completes the chore and awards bonus XP"
  ).toBeTruthy();

  // ---- the trail ----
  expect(b.trail.backZone, "back in the oasis after chores").toBe("oasis");
  expect(b.trail.zoneKey, "reaches the trail").toBe("trail");
  expect(b.randomEncounter.encBattle, "random encounter triggers while moving").toBe(true);
  expect(
    b.randomEncounter.zoneKey === "trail" &&
      Math.hypot(
        b.randomEncounter.px - b.randomEncounter.trailSpawn.x,
        b.randomEncounter.py - b.randomEncounter.trailSpawn.y
      ) > 40,
    "victory returns to where the encounter happened (not scene start)"
  ).toBeTruthy();
  expect(
    b.chips.state.flags.chip1 && b.chips.state.flags.chip2 && b.chips.state.flags.chip3,
    "ice chips collected"
  ).toBeTruthy();
  expect(b.jackrabbit.state.flags.rabbitResolved, "jackrabbit encounter resolved").toBe(true);
  expect(b.jackrabbit.state.flags.mineOpen, "Dusty opens the mine").toBe(true);

  // ---- the mine ----
  expect(b.mineEnter.zoneKey, "enters the mine").toBe("mine");
  expect(b.leverForeman.state.flags.leverPulled, "lever pulled").toBe(true);
  expect(b.leverForeman.state.flags.foremanDefeated, "Foreman defeated").toBe(true);
  expect(
    b.leverForeman.state.flags.heardThomasMine,
    "Thomas's first transmission reached Joseph in the mine"
  ).toBe(true);
  expect(b.depths.zoneKey, "elevator reaches the depths").toBe("depths");

  // ---- Dust Queen + cliffhanger ----
  expect(b.levelPerks.state.hero.xp, "leveling happened along the way").toBeGreaterThanOrEqual(45);
  expect(
    b.levelPerks.state.hero.perks.length,
    "perk choices were made on level-up"
  ).toBeGreaterThanOrEqual(1);
  expect(b.queenBattle.queenBattleSeen, "Dust Queen battle starts").toBeTruthy();
  expect(b.queenResolved.state.flags.queenResolved, "Queen resolved").toBe(true);
  expect(b.actComplete.state.flags.actComplete, "act completes (cliffhanger played)").toBe(true);
  expect(
    b.noAutoTeleport.zoneKey,
    "no auto-teleport: still in the depths after the cliffhanger"
  ).toBe("depths");

  // ---- no uncaught page errors across the whole run ----
  expect((page as any).__pageErrors, "no page errors").toEqual([]);
});
