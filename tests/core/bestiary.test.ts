import { describe, expect, it } from "vitest";
import {
  BESTIARY,
  makeEnemyParty,
  xpForParty,
} from "../../src/core/bestiary";

describe("BESTIARY", () => {
  it("matches the contract stat/xp table exactly", () => {
    const rows: Array<[string, number, number, number, number, number, number]> = [
      // id, scale, maxHp, attack, defense, speed, xp
      ["scarab", 2.5, 15, 6, 2, 9, 8],
      ["buzzard", 2.5, 18, 7, 1, 13, 10],
      ["gila", 2.5, 26, 8, 4, 7, 14],
      ["jackrabbit", 2.5, 14, 5, 1, 15, 12],
      ["foreman", 3, 55, 9, 5, 8, 30],
      ["queen", 3, 90, 11, 4, 9, 60],
      ["queenWeakened", 3, 45, 11, 4, 9, 60],
    ];
    expect(Object.keys(BESTIARY).sort()).toEqual(
      rows.map(([id]) => id).sort(),
    );
    for (const [id, scale, maxHp, attack, defense, speed, xp] of rows) {
      const d = BESTIARY[id];
      expect(d.id).toBe(id);
      expect(d.scale).toBe(scale);
      expect(d.stats).toEqual({ maxHp, hp: maxHp, attack, defense, speed });
      expect(d.xp).toBe(xp);
    }
  });

  it("uses the right sprite sheets", () => {
    expect(BESTIARY.scarab.sheet).toBe("scarab");
    expect(BESTIARY.buzzard.sheet).toBe("buzzard");
    expect(BESTIARY.gila.sheet).toBe("gila");
    expect(BESTIARY.jackrabbit.sheet).toBe("jackrabbit");
    expect(BESTIARY.foreman.sheet).toBe("foreman");
    expect(BESTIARY.queen.sheet).toBe("queen");
    expect(BESTIARY.queenWeakened.sheet).toBe("queen"); // same art, fewer hp
  });

  it("queenWeakened is the queen at 45 maxHp with the same xp", () => {
    const { queen, queenWeakened } = BESTIARY;
    expect(queenWeakened.name).toBe(queen.name);
    expect(queenWeakened.stats.maxHp).toBe(45);
    expect(queenWeakened.stats.attack).toBe(queen.stats.attack);
    expect(queenWeakened.stats.defense).toBe(queen.stats.defense);
    expect(queenWeakened.stats.speed).toBe(queen.stats.speed);
    expect(queenWeakened.xp).toBe(queen.xp);
  });
});

describe("makeEnemyParty", () => {
  it("keeps plain ids and names for single occurrences", () => {
    expect(makeEnemyParty(["gila"])).toEqual([
      {
        id: "gila",
        name: "Gila",
        side: "enemy",
        stats: { maxHp: 26, hp: 26, attack: 8, defense: 4, speed: 7 },
      },
    ]);
  });

  it("suffixes duplicated species: gila-1 / gila-2, Gila A / Gila B", () => {
    const party = makeEnemyParty(["gila", "gila"]);
    expect(party.map((c) => c.id)).toEqual(["gila-1", "gila-2"]);
    expect(party.map((c) => c.name)).toEqual(["Gila A", "Gila B"]);
  });

  it("only decorates the duplicated species in a mixed group", () => {
    const party = makeEnemyParty(["buzzard", "scarab", "scarab"]);
    expect(party.map((c) => c.id)).toEqual(["buzzard", "scarab-1", "scarab-2"]);
    expect(party.map((c) => c.name)).toEqual([
      "Buzzard",
      "Scarab A",
      "Scarab B",
    ]);
  });

  it("counts past two duplicates", () => {
    const party = makeEnemyParty(["scarab", "scarab", "scarab"]);
    expect(party.map((c) => c.id)).toEqual(["scarab-1", "scarab-2", "scarab-3"]);
    expect(party.map((c) => c.name)).toEqual([
      "Scarab A",
      "Scarab B",
      "Scarab C",
    ]);
  });

  it("produces AtbBattle-safe unique ids for every contract group", () => {
    const groups = [
      ["scarab"],
      ["buzzard"],
      ["scarab", "scarab"],
      ["gila"],
      ["buzzard", "scarab"],
      ["scarab", "gila"],
      ["foreman"],
      ["queen"],
      ["queenWeakened"],
    ];
    for (const group of groups) {
      const ids = makeEnemyParty(group).map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("hands out fresh stat copies (no shared mutation with BESTIARY)", () => {
    const [a] = makeEnemyParty(["scarab"]);
    a.stats.hp = 1;
    expect(BESTIARY.scarab.stats.hp).toBe(15);
    const [b] = makeEnemyParty(["scarab"]);
    expect(b.stats.hp).toBe(15);
    expect(b.stats).not.toBe(BESTIARY.scarab.stats);
  });

  it("throws on unknown enemy ids", () => {
    expect(() => makeEnemyParty(["dragon"])).toThrow(/dragon/);
  });
});

describe("xpForParty", () => {
  it("sums the xp of every member", () => {
    expect(xpForParty(["scarab"])).toBe(8);
    expect(xpForParty(["scarab", "scarab"])).toBe(16);
    expect(xpForParty(["buzzard", "scarab"])).toBe(18);
    expect(xpForParty(["scarab", "gila"])).toBe(22);
    expect(xpForParty(["queenWeakened"])).toBe(60);
  });

  it("is 0 for an empty group and throws on unknown ids", () => {
    expect(xpForParty([])).toBe(0);
    expect(() => xpForParty(["dragon"])).toThrow(/dragon/);
  });
});
