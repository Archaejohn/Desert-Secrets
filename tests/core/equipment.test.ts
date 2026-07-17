import { describe, expect, it } from "vitest";
import {
  EQUIPMENT,
  EQUIP_SLOTS,
  STAT_FLOOR,
  applyEquipmentBuffs,
  defaultEquipSlots,
  emptyEquipSlots,
  equipmentById,
  hasNoBuffs,
  itemAllowsTags,
  normalizeEquipSlots,
  type EquipSlots,
} from "../../src/core/equipment";
import type { Stats } from "../../src/core/atb";

const base: Stats = { maxHp: 32, hp: 32, attack: 9, defense: 3, speed: 12 };

/** An all-empty slot record (nothing worn), for isolating single-item buffs. */
const bare: EquipSlots = { hat: null, weapon: null, torso: null, legs: null, shoes: null };
const slots = (partial: Partial<EquipSlots>): EquipSlots => ({ ...bare, ...partial });

describe("equipment catalog", () => {
  it("ships the bucket as a +2 DEF / -1 SPD hat", () => {
    const bucket = equipmentById("bucket");
    expect(bucket).not.toBeNull();
    expect(bucket!.slot).toBe("hat");
    expect(bucket!.buffs).toEqual({ defense: 2, speed: -1 });
  });

  it("gives the three new gear items their slots and buffs", () => {
    expect(equipmentById("stick")).toMatchObject({ slot: "weapon", buffs: { attack: 1 } });
    expect(equipmentById("minersHat")).toMatchObject({ slot: "hat", buffs: { defense: 1 } });
    expect(equipmentById("pickaxe")).toMatchObject({ slot: "weapon", buffs: { attack: 2 } });
  });

  it("gives the starter clothes their slots and zero buffs", () => {
    expect(equipmentById("tshirt")).toMatchObject({ slot: "torso" });
    expect(equipmentById("jeans")).toMatchObject({ slot: "legs" });
    expect(equipmentById("flipFlops")).toMatchObject({ slot: "shoes" });
    for (const id of ["tshirt", "jeans", "flipFlops"] as const) {
      expect(hasNoBuffs(equipmentById(id)!)).toBe(true);
    }
    expect(hasNoBuffs(equipmentById("bucket")!)).toBe(false);
  });

  it("has a unique id for every entry, each filling a known slot", () => {
    const ids = EQUIPMENT.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of EQUIPMENT) expect(EQUIP_SLOTS).toContain(e.slot);
  });

  it("equipmentById returns null for null/undefined ids", () => {
    expect(equipmentById(null)).toBeNull();
    expect(equipmentById(undefined)).toBeNull();
  });

  it("ships the frost feather as a penguin-only weapon", () => {
    const feather = equipmentById("frostFeather");
    expect(feather).not.toBeNull();
    expect(feather!.slot).toBe("weapon");
    expect(feather!.allowedTags).toEqual(["penguin"]);
    expect(hasNoBuffs(feather!)).toBe(false);
  });
});

describe("itemAllowsTags", () => {
  it("lets anyone wear an unrestricted item", () => {
    const stick = equipmentById("stick")!;
    expect(itemAllowsTags(stick, ["human"])).toBe(true);
    expect(itemAllowsTags(stick, ["reptile"])).toBe(true);
  });

  it("gates a restricted item on a tag intersection", () => {
    const feather = equipmentById("frostFeather")!;
    expect(itemAllowsTags(feather, ["human"])).toBe(false);
    expect(itemAllowsTags(feather, ["penguin"])).toBe(true);
  });
});

describe("emptyEquipSlots", () => {
  it("is an all-null five-slot record (an undressed member)", () => {
    expect(emptyEquipSlots()).toEqual({
      hat: null,
      weapon: null,
      torso: null,
      legs: null,
      shoes: null,
    });
  });
});

describe("applyEquipmentBuffs", () => {
  it("returns unchanged stats (a copy) when nothing is worn", () => {
    const out = applyEquipmentBuffs(base, bare);
    expect(out).toEqual(base);
    expect(out).not.toBe(base); // fresh object, pure
  });

  it("layers the bucket's deltas onto the base combat stats", () => {
    const out = applyEquipmentBuffs(base, slots({ hat: "bucket" }));
    expect(out.defense).toBe(base.defense + 2);
    expect(out.speed).toBe(base.speed - 1);
    expect(out.attack).toBe(base.attack);
    expect(out.maxHp).toBe(base.maxHp);
    expect(out.hp).toBe(base.hp);
  });

  it("SUMS buffs across both a hat and a weapon slot", () => {
    const out = applyEquipmentBuffs(base, slots({ hat: "minersHat", weapon: "pickaxe" }));
    expect(out.defense).toBe(base.defense + 1); // miner's hat
    expect(out.attack).toBe(base.attack + 2); // pickaxe
  });

  it("plain starter clothes contribute nothing", () => {
    const out = applyEquipmentBuffs(base, defaultEquipSlots());
    expect(out).toEqual(base);
  });

  it("clamps a debuff so a stat never drops below STAT_FLOOR", () => {
    const slow: Stats = { ...base, speed: STAT_FLOOR };
    const out = applyEquipmentBuffs(slow, slots({ hat: "bucket" })); // -1 SPD below floor
    expect(out.speed).toBe(STAT_FLOOR);
  });

  it("does not mutate the input", () => {
    const snapshot = JSON.stringify(base);
    applyEquipmentBuffs(base, slots({ hat: "bucket" }));
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});

describe("defaultEquipSlots", () => {
  it("dresses Joseph in his starter outfit, hat & weapon empty", () => {
    expect(defaultEquipSlots()).toEqual({
      hat: null,
      weapon: null,
      torso: "tshirt",
      legs: "jeans",
      shoes: "flipFlops",
    });
  });
});

describe("normalizeEquipSlots", () => {
  it("maps the LEGACY single-slot string shape into the hat slot", () => {
    expect(normalizeEquipSlots("bucket")).toEqual({
      hat: "bucket",
      weapon: null,
      torso: "tshirt",
      legs: "jeans",
      shoes: "flipFlops",
    });
  });

  it("treats a legacy null (empty single slot) as the default outfit", () => {
    expect(normalizeEquipSlots(null)).toEqual(defaultEquipSlots());
    expect(normalizeEquipSlots(undefined)).toEqual(defaultEquipSlots());
  });

  it("passes a valid full record through unchanged", () => {
    const full: EquipSlots = {
      hat: "minersHat",
      weapon: "pickaxe",
      torso: "tshirt",
      legs: "jeans",
      shoes: "flipFlops",
    };
    expect(normalizeEquipSlots(full)).toEqual(full);
  });

  it("rejects an id in the wrong slot and defaults missing slots", () => {
    // A weapon id parked in the hat slot is invalid -> null; torso/legs/shoes
    // absent -> starter outfit fills them in.
    expect(normalizeEquipSlots({ hat: "pickaxe", weapon: "stick" })).toEqual({
      hat: null,
      weapon: "stick",
      torso: "tshirt",
      legs: "jeans",
      shoes: "flipFlops",
    });
  });

  it("keeps an explicit null slot empty (respects an unequip)", () => {
    const out = normalizeEquipSlots({ hat: null, torso: null });
    expect(out.hat).toBeNull();
    expect(out.torso).toBeNull();
  });
});
