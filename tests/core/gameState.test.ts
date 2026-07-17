import { describe, expect, it } from "vitest";
import {
  ACT1_FLAGS,
  ACT2_FLAGS,
  ACT3_FLAGS,
  ACT4_FLAGS,
  ACT5_FLAGS,
  ACT6_FLAGS,
  ACT7_FLAGS,
  PART2_FLAGS,
  applyBattleResult,
  availableCount,
  awardXp,
  canBuyEquip,
  canEquip,
  choosePerk,
  equipItem,
  equippedCount,
  equippedSlotsFor,
  grantEquipment,
  grantShiny,
  heroStats,
  newGame,
  normalizeItemEquipment,
  ownedCount,
  respawn,
  spendShinies,
  spendShiny,
  unequipSlot,
  type Act1State,
} from "../../src/core/gameState";
import { rosterById } from "../../src/core/roster";
import { levelForXp, statsForBuild } from "../../src/core/progression";

function snapshot(s: Act1State): string {
  return JSON.stringify(s);
}

describe("newGame", () => {
  it("starts at the crash with level-1 stats and empty pockets", () => {
    const s = newGame();
    expect(s.zone).toBe("crash");
    expect(s.hero).toEqual({ xp: 0, perks: [] });
    expect(s.hp).toBe(32); // level 1 maxHp
    expect(s.pendingPerks).toBe(0);
    expect(s.items).toEqual({
      coldPack: false,
      shinies: 0,
      bucket: "none",
      // Starter gear = Joseph only: owns one each of the outfit pieces, worn on
      // the hero; other members absent.
      owned: { tshirt: 1, jeans: 1, flipFlops: 1 },
      equipped: { hero: { hat: null, weapon: null, torso: "tshirt", legs: "jeans", shoes: "flipFlops" } },
      silverfin: false,
      stinkySocks: false,
      oranges: false,
      seaweed: false,
    });
  });

  it("initialises every scene flag to false", () => {
    const s = newGame();
    expect(ACT1_FLAGS.length).toBe(18);
    for (const flag of [
      ...ACT1_FLAGS,
      ...ACT2_FLAGS,
      ...ACT3_FLAGS,
      ...ACT4_FLAGS,
      ...ACT5_FLAGS,
      ...ACT6_FLAGS,
      ...ACT7_FLAGS,
      ...PART2_FLAGS,
    ]) {
      expect(s.flags[flag]).toBe(false);
    }
    expect(Object.keys(s.flags).sort()).toEqual(
      [
        ...ACT1_FLAGS,
        ...ACT2_FLAGS,
        ...ACT3_FLAGS,
        ...ACT4_FLAGS,
        ...ACT5_FLAGS,
        ...ACT6_FLAGS,
        ...ACT7_FLAGS,
        ...PART2_FLAGS,
      ].sort(),
    );
  });
});

describe("heroStats", () => {
  it("returns full build stats with hp clamped to state hp", () => {
    const s = { ...newGame(), hp: 10 };
    expect(heroStats(s)).toEqual({
      maxHp: 32,
      hp: 10,
      attack: 9,
      defense: 3,
      speed: 12,
    });
  });

  it("clamps hp down to maxHp when the state carries more", () => {
    const s = { ...newGame(), hp: 999 };
    expect(heroStats(s).hp).toBe(32);
  });

  it("reflects perks in the stats", () => {
    const s = newGame();
    s.hero.perks.push("ferocity");
    expect(heroStats(s).attack).toBe(10);
  });

  it("layers the HERO's equipped gear buffs on top of the build (bucket = +2 DEF / -1 SPD)", () => {
    const bare = newGame();
    const worn = equipItem({ ...bare, items: { ...bare.items, bucket: "empty" } }, "hero", "bucket");
    // Base level-1: defense 3, speed 12. Bucket layers +2 DEF, -1 SPD.
    expect(heroStats(bare).defense).toBe(3);
    expect(heroStats(bare).speed).toBe(12);
    expect(heroStats(worn).defense).toBe(5);
    expect(heroStats(worn).speed).toBe(11);
    // Equipment touches only combat stats, never the hp pool.
    expect(heroStats(worn).maxHp).toBe(heroStats(bare).maxHp);
  });

  it("survives a clone/reload round-trip: equip persists and still buffs", () => {
    const base = newGame();
    const s = equipItem({ ...base, items: { ...base.items, bucket: "empty" } }, "hero", "bucket");
    // JSON round-trip mimics the save->load the registry persists through.
    const reloaded: Act1State = JSON.parse(JSON.stringify(s));
    expect(reloaded.items.equipped.hero?.hat).toBe("bucket");
    expect(heroStats(reloaded).defense).toBe(heroStats(s).defense);
    expect(heroStats(reloaded).defense).toBe(5);
  });
});

describe("awardXp", () => {
  it("adds XP without healing when no level is gained", () => {
    const start = { ...newGame(), hp: 12 };
    const { state, levelsGained } = awardXp(start, 10);
    expect(levelsGained).toBe(0);
    expect(state.hero.xp).toBe(10);
    expect(state.hp).toBe(12);
    expect(state.pendingPerks).toBe(0);
  });

  it("fully heals and queues a perk on level-up", () => {
    const start = { ...newGame(), hp: 5 };
    const { state, levelsGained } = awardXp(start, 20);
    expect(levelsGained).toBe(1);
    expect(levelForXp(state.hero.xp)).toBe(2);
    expect(state.hp).toBe(38); // level 2 maxHp: full heal
    expect(state.pendingPerks).toBe(1);
  });

  it("queues one perk per level on a multi-level gain", () => {
    const start = { ...newGame(), hp: 1 };
    const { state, levelsGained } = awardXp(start, 50); // level 1 -> 3
    expect(levelsGained).toBe(2);
    expect(state.pendingPerks).toBe(2);
    expect(state.hp).toBe(44); // level 3 maxHp
  });

  it("full heal includes perk maxHp bonuses", () => {
    let s = newGame();
    s = awardXp(s, 20).state;
    s = choosePerk(s, "vigor");
    const { state } = awardXp(s, 25); // -> level 3
    expect(state.hp).toBe(44 + 4);
  });

  it("is pure: never mutates the input state", () => {
    const s = newGame();
    const before = snapshot(s);
    awardXp(s, 50);
    expect(snapshot(s)).toBe(before);
  });
});

describe("choosePerk", () => {
  function leveled(): Act1State {
    return awardXp(newGame(), 20).state; // level 2, 1 pending perk
  }

  it("applies the perk and decrements pendingPerks", () => {
    const s = choosePerk(leveled(), "ferocity");
    expect(s.hero.perks).toEqual(["ferocity"]);
    expect(s.pendingPerks).toBe(0);
    expect(heroStats(s).attack).toBe(11 + 1);
  });

  it("raises current hp along with a vigor maxHp gain", () => {
    const s = choosePerk(leveled(), "vigor");
    expect(heroStats(s).maxHp).toBe(42);
    expect(s.hp).toBe(42); // stayed at full
  });

  it("leaves hp alone for non-hp perks", () => {
    const wounded = { ...leveled(), hp: 20 };
    expect(choosePerk(wounded, "swiftness").hp).toBe(20);
  });

  it("supports stacking across multiple level-ups", () => {
    let s = awardXp(newGame(), 50).state; // 2 pending
    s = choosePerk(s, "vigor");
    s = choosePerk(s, "vigor");
    expect(heroStats(s).maxHp).toBe(44 + 8);
    expect(s.pendingPerks).toBe(0);
  });

  it("throws when no perk choice is pending", () => {
    expect(() => choosePerk(newGame(), "vigor")).toThrow(/no pending/i);
  });

  it("is pure: never mutates the input state", () => {
    const s = leveled();
    const before = snapshot(s);
    choosePerk(s, "bulwark");
    expect(snapshot(s)).toBe(before);
  });
});

describe("shiny economy", () => {
  it("grantShiny adds one to the count (Pamela's gift, battle drops)", () => {
    expect(grantShiny(newGame()).items.shinies).toBe(1);
    expect(grantShiny(grantShiny(newGame())).items.shinies).toBe(2);
  });

  it("spendShiny removes one (Dusty's fee)", () => {
    const two = grantShiny(grantShiny(newGame()));
    expect(spendShiny(two).items.shinies).toBe(1);
  });

  it("spendShiny never goes negative", () => {
    expect(spendShiny(newGame()).items.shinies).toBe(0);
  });

  it("grant then spend round-trips to the same count", () => {
    const s = newGame();
    expect(spendShiny(grantShiny(s)).items.shinies).toBe(s.items.shinies);
  });

  it("both are pure: never mutate the input state", () => {
    const s = newGame();
    const before = snapshot(s);
    grantShiny(s);
    spendShiny(grantShiny(s));
    expect(snapshot(s)).toBe(before);
  });

  it("touches nothing but the shiny count", () => {
    const s = awardXp(newGame(), 20).state;
    s.flags.metRosa = true;
    s.items.coldPack = true;
    const after = grantShiny(s);
    expect(after).toEqual({ ...s, items: { ...s.items, shinies: s.items.shinies + 1 } });
  });
});

describe("miner-shop buy helpers", () => {
  const withShinies = (n: number): Act1State => {
    const s = newGame();
    s.items.shinies = n;
    return s;
  };

  it("spendShinies removes N at once, clamped at zero", () => {
    expect(spendShinies(withShinies(3), 2).items.shinies).toBe(1);
    expect(spendShinies(withShinies(1), 2).items.shinies).toBe(0);
    expect(spendShinies(withShinies(2), 0).items.shinies).toBe(2);
  });

  it("grantEquipment adds one copy to the shared pool and nothing else", () => {
    const s = withShinies(5);
    const after = grantEquipment(s, "minersHat");
    expect(after.items.owned.minersHat).toBe(1);
    expect(ownedCount(after, "minersHat")).toBe(1);
    expect(after).toEqual({ ...s, items: { ...s.items, owned: { ...s.items.owned, minersHat: 1 } } });
  });

  it("canBuyEquip gates on affordability AND not already owning it", () => {
    expect(canBuyEquip(withShinies(2), 2, "minersHat")).toBe(true); // exact price
    expect(canBuyEquip(withShinies(1), 2, "minersHat")).toBe(false); // too poor
    expect(canBuyEquip(grantEquipment(withShinies(9), "minersHat"), 2, "minersHat")).toBe(false); // owned
  });

  it("a full purchase: spend the price and gain the item", () => {
    let s = withShinies(3);
    const price = 2;
    expect(canBuyEquip(s, price, "minersHat")).toBe(true);
    s = grantEquipment(spendShinies(s, price), "minersHat");
    expect(ownedCount(s, "minersHat")).toBe(1);
    expect(s.items.shinies).toBe(1);
    // Second purchase is now gated off (already owned).
    expect(canBuyEquip(s, price, "minersHat")).toBe(false);
  });

  it("both are pure: never mutate the input state", () => {
    const s = withShinies(4);
    const before = snapshot(s);
    spendShinies(s, 2);
    grantEquipment(s, "pickaxe");
    expect(snapshot(s)).toBe(before);
  });
});

describe("clone / equipped isolation", () => {
  it("mutating a cloned state's equipped slots never leaks back", () => {
    const s = newGame();
    // awardXp clones internally; mutate the result and check the original.
    const cloned = awardXp(s, 0).state;
    cloned.items.equipped.hero!.hat = "bucket";
    expect(s.items.equipped.hero!.hat).toBeNull();
  });

  it("mutating a cloned state's owned pool never leaks back", () => {
    const s = newGame();
    const cloned = awardXp(s, 0).state;
    cloned.items.owned.pickaxe = 3;
    expect(s.items.owned.pickaxe).toBeUndefined();
  });
});

describe("applyBattleResult", () => {
  it("records the hero's post-battle hp", () => {
    expect(applyBattleResult(newGame(), 7).hp).toBe(7);
  });

  it("clamps to 0..maxHp", () => {
    expect(applyBattleResult(newGame(), -5).hp).toBe(0);
    expect(applyBattleResult(newGame(), 500).hp).toBe(32);
  });

  it("touches nothing but hp", () => {
    const s = awardXp(newGame(), 20).state;
    s.items.shinies = 3;
    s.flags.metRosa = true;
    const after = applyBattleResult(s, 1);
    expect(after).toEqual({ ...s, hp: 1 });
    expect(snapshot(s)).not.toBe(snapshot(after));
  });
});

describe("respawn", () => {
  it("restores full hp and keeps zone, xp, perks, items and flags", () => {
    let s = awardXp(newGame(), 20).state;
    s = choosePerk(s, "vigor");
    s = { ...s, zone: "mine", hp: 0 };
    s.items.coldPack = true;
    s.items.shinies = 2;
    s.items.bucket = "filled";
    s = equipItem(s, "hero", "bucket");
    s.flags.foremanDefeated = true;
    const after = respawn(s);
    expect(after.hp).toBe(statsForBuild(s.hero).maxHp);
    expect(after.zone).toBe("mine");
    expect(after.hero).toEqual(s.hero);
    expect(after.items).toEqual({
      coldPack: true,
      shinies: 2,
      bucket: "filled",
      owned: { tshirt: 1, jeans: 1, flipFlops: 1 },
      equipped: { hero: { hat: "bucket", weapon: null, torso: "tshirt", legs: "jeans", shoes: "flipFlops" } },
      silverfin: false,
      stinkySocks: false,
      oranges: false,
      seaweed: false,
    });
    expect(after.flags.foremanDefeated).toBe(true);
    expect(after.pendingPerks).toBe(s.pendingPerks);
  });

  it("is pure: never mutates the input state", () => {
    const s = { ...newGame(), hp: 0 };
    const before = snapshot(s);
    respawn(s);
    expect(snapshot(s)).toBe(before);
  });
});

describe("equipment pool (FF6 availability)", () => {
  it("ownedCount reads the pool; bucket derives from its fill-state", () => {
    const s = newGame();
    expect(ownedCount(s, "tshirt")).toBe(1);
    expect(ownedCount(s, "pickaxe")).toBe(0);
    expect(ownedCount(s, "bucket")).toBe(0);
    const withBucket = { ...s, items: { ...s.items, bucket: "empty" as const } };
    expect(ownedCount(withBucket, "bucket")).toBe(1);
  });

  it("equippedCount counts copies across every member's slots", () => {
    const s = newGame(); // hero wears tshirt/jeans/flipFlops
    expect(equippedCount(s, "tshirt")).toBe(1);
    expect(equippedCount(s, "pickaxe")).toBe(0);
  });

  it("availableCount = owned − equipped, floored at zero", () => {
    let s = grantEquipment(newGame(), "pickaxe"); // owned 1, equipped 0
    expect(availableCount(s, "pickaxe")).toBe(1);
    s = equipItem(s, "hero", "pickaxe"); // now equipped by hero
    expect(availableCount(s, "pickaxe")).toBe(0);
    // The starter tshirt is owned 1 / worn 1 -> none free.
    expect(availableCount(s, "tshirt")).toBe(0);
  });

  it("equipItem consumes availability and auto-unequips the slot's prior item", () => {
    let s = grantEquipment(grantEquipment(newGame(), "stick"), "pickaxe");
    s = equipItem(s, "hero", "stick");
    expect(equippedSlotsFor(s, "hero").weapon).toBe("stick");
    // Swapping in the pickaxe (same weapon slot) returns the stick to the pool.
    s = equipItem(s, "hero", "pickaxe");
    expect(equippedSlotsFor(s, "hero").weapon).toBe("pickaxe");
    expect(availableCount(s, "stick")).toBe(1); // stick freed
    expect(availableCount(s, "pickaxe")).toBe(0);
  });

  it("can't equip at 0 available (no second copy)", () => {
    let s = grantEquipment(newGame(), "pickaxe"); // one only
    s = equipItem(s, "hero", "pickaxe");
    // Fluffball can't also wear the single pickaxe.
    const tryFluff = equipItem(s, "fluffball", "pickaxe");
    expect(equippedSlotsFor(tryFluff, "fluffball").weapon).toBeNull();
    expect(tryFluff).toBe(s); // no-op returns the same state
  });

  it("unequipSlot returns a copy to the pool", () => {
    let s = grantEquipment(newGame(), "pickaxe");
    s = equipItem(s, "hero", "pickaxe");
    expect(availableCount(s, "pickaxe")).toBe(0);
    s = unequipSlot(s, "hero", "weapon");
    expect(equippedSlotsFor(s, "hero").weapon).toBeNull();
    expect(availableCount(s, "pickaxe")).toBe(1);
  });

  it("all pool helpers are pure", () => {
    const s = grantEquipment(newGame(), "pickaxe");
    const before = snapshot(s);
    equipItem(s, "hero", "pickaxe");
    unequipSlot(s, "hero", "torso");
    grantEquipment(s, "stick");
    expect(snapshot(s)).toBe(before);
  });
});

describe("equip restrictions by tag", () => {
  it("the frost feather is penguin-only", () => {
    const s = grantEquipment(newGame(), "frostFeather");
    // Joseph (human) is rejected.
    expect(canEquip(s, "hero", "frostFeather")).toBe(false);
    expect(equipItem(s, "hero", "frostFeather")).toBe(s); // no-op
    // A penguin is accepted.
    expect(rosterById("fluffball").tags).toContain("penguin");
    expect(canEquip(s, "fluffball", "frostFeather")).toBe(true);
    const worn = equipItem(s, "fluffball", "frostFeather");
    expect(equippedSlotsFor(worn, "fluffball").weapon).toBe("frostFeather");
  });

  it("unrestricted gear equips on anyone", () => {
    const s = grantEquipment(newGame(), "pickaxe");
    expect(canEquip(s, "hero", "pickaxe")).toBe(true);
    expect(canEquip(s, "slither", "pickaxe")).toBe(true);
  });
});

describe("per-character equipment buffs", () => {
  it("gear buffs whoever wears it (frost feather = +1 ATK / +1 SPD on a penguin)", () => {
    const s = grantEquipment(newGame(), "frostFeather");
    const bare = rosterById("fluffball").statsFor(s);
    const worn = equipItem(s, "fluffball", "frostFeather");
    const buffed = rosterById("fluffball").statsFor(worn);
    expect(buffed.attack).toBe(bare.attack + 1);
    expect(buffed.speed).toBe(bare.speed + 1);
    // The hero, who isn't wearing it, is unaffected.
    expect(heroStats(worn).attack).toBe(heroStats(s).attack);
  });
});

describe("normalizeItemEquipment (save migration)", () => {
  it("coerces the OLD boolean-ownership + single-loadout shape", () => {
    const legacy = {
      stick: true,
      minersHat: true,
      tshirt: true,
      jeans: true,
      flipFlops: true,
      equipped: { hat: "minersHat", weapon: "stick", torso: "tshirt", legs: "jeans", shoes: "flipFlops" },
    };
    const { owned, equipped } = normalizeItemEquipment(legacy);
    expect(owned).toEqual({ stick: 1, minersHat: 1, tshirt: 1, jeans: 1, flipFlops: 1 });
    // The old single loadout becomes Joseph's.
    expect(equipped.hero).toEqual({
      hat: "minersHat",
      weapon: "stick",
      torso: "tshirt",
      legs: "jeans",
      shoes: "flipFlops",
    });
    expect(equipped.slither).toBeUndefined();
  });

  it("passes the NEW per-character pool shape through", () => {
    const current = {
      owned: { pickaxe: 2, frostFeather: 1 },
      equipped: {
        hero: { hat: null, weapon: "pickaxe", torso: "tshirt", legs: "jeans", shoes: "flipFlops" },
        fluffball: { hat: null, weapon: "frostFeather", torso: null, legs: null, shoes: null },
      },
    };
    const { owned, equipped } = normalizeItemEquipment(current);
    expect(owned).toEqual({ pickaxe: 2, frostFeather: 1 });
    expect(equipped.hero?.weapon).toBe("pickaxe");
    expect(equipped.fluffball?.weapon).toBe("frostFeather");
    // A non-hero's absent slots stay empty (not dressed in Joseph's outfit).
    expect(equipped.fluffball?.torso).toBeNull();
  });

  it("newGame round-trips through the migration unchanged", () => {
    const s = newGame();
    const { owned, equipped } = normalizeItemEquipment(s.items);
    expect(owned).toEqual(s.items.owned);
    expect(equipped).toEqual(s.items.equipped);
  });
});

describe("battle round-trip", () => {
  it("defeat -> respawn -> victory keeps the run consistent", () => {
    let s = newGame();
    s = applyBattleResult(s, 0); // defeated
    s = respawn(s);
    expect(s.hp).toBe(32);
    const won = awardXp(applyBattleResult(s, 9), 8); // tutorial scarab
    expect(won.state.hp).toBe(9);
    expect(won.state.hero.xp).toBe(8);
    expect(won.levelsGained).toBe(0);
  });
});
