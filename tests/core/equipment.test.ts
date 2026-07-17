import { describe, expect, it } from "vitest";
import {
  EQUIPMENT,
  STAT_FLOOR,
  applyEquipmentBuffs,
  equipmentById,
} from "../../src/core/equipment";
import type { Stats } from "../../src/core/atb";

const base: Stats = { maxHp: 32, hp: 32, attack: 9, defense: 3, speed: 12 };

describe("equipment catalog", () => {
  it("ships the bucket as +2 DEF / -1 SPD headgear", () => {
    const bucket = equipmentById("bucket");
    expect(bucket).not.toBeNull();
    expect(bucket!.buffs).toEqual({ defense: 2, speed: -1 });
  });

  it("has a unique id for every entry", () => {
    const ids = EQUIPMENT.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("equipmentById returns null for null/undefined ids", () => {
    expect(equipmentById(null)).toBeNull();
    expect(equipmentById(undefined)).toBeNull();
  });
});

describe("applyEquipmentBuffs", () => {
  it("returns unchanged stats (a copy) when nothing is equipped", () => {
    const out = applyEquipmentBuffs(base, null);
    expect(out).toEqual(base);
    expect(out).not.toBe(base); // fresh object, pure
  });

  it("layers the bucket's deltas onto the base combat stats", () => {
    const out = applyEquipmentBuffs(base, "bucket");
    expect(out.defense).toBe(base.defense + 2);
    expect(out.speed).toBe(base.speed - 1);
    // Untouched:
    expect(out.attack).toBe(base.attack);
    expect(out.maxHp).toBe(base.maxHp);
    expect(out.hp).toBe(base.hp);
  });

  it("clamps a debuff so a stat never drops below STAT_FLOOR", () => {
    const slow: Stats = { ...base, speed: STAT_FLOOR };
    const out = applyEquipmentBuffs(slow, "bucket"); // -1 SPD would go below floor
    expect(out.speed).toBe(STAT_FLOOR);
  });

  it("does not mutate the input", () => {
    const snapshot = JSON.stringify(base);
    applyEquipmentBuffs(base, "bucket");
    expect(JSON.stringify(base)).toBe(snapshot);
  });
});
