import { describe, expect, it } from "vitest";
import {
  buildWorldMap,
  isSolidAt,
  MAP_HEIGHT,
  MAP_WIDTH,
  SOLID_NAMES,
  SPAWNS
} from "../../src/game/worldMap";
import manifest from "../../src/assets/generated/manifest.json";

describe("world map", () => {
  const map = buildWorldMap();

  it("has the declared dimensions with a fully populated ground layer", () => {
    expect(map.ground).toHaveLength(MAP_HEIGHT);
    expect(map.decor).toHaveLength(MAP_HEIGHT);
    for (const row of map.ground) {
      expect(row).toHaveLength(MAP_WIDTH);
      for (const cell of row) expect(typeof cell).toBe("string");
    }
  });

  it("only uses tile names that exist in the generated manifest", () => {
    const known = new Set(Object.keys(manifest.tiles.names));
    for (const row of map.ground) for (const cell of row) expect(known).toContain(cell);
    for (const row of map.decor)
      for (const cell of row) if (cell !== null) expect(known).toContain(cell);
  });

  it("is deterministic", () => {
    expect(buildWorldMap()).toEqual(map);
  });

  it("keeps all spawn points on walkable tiles", () => {
    for (const spawn of Object.values(SPAWNS)) {
      expect(isSolidAt(map, spawn.x, spawn.y)).toBe(false);
    }
  });

  it("is fully enclosed by solid border tiles", () => {
    for (let x = 0; x < MAP_WIDTH; x++) {
      expect(isSolidAt(map, x, 0)).toBe(true);
      expect(isSolidAt(map, x, MAP_HEIGHT - 1)).toBe(true);
    }
    for (let y = 0; y < MAP_HEIGHT; y++) {
      expect(isSolidAt(map, 0, y)).toBe(true);
      expect(isSolidAt(map, MAP_WIDTH - 1, y)).toBe(true);
    }
  });

  it("contains the oasis (water) and ruins (brick) landmarks", () => {
    const groundFlat = map.ground.flat();
    const decorFlat = map.decor.flat();
    expect(groundFlat).toContain("water");
    expect(decorFlat).toContain("brick");
    expect(decorFlat).toContain("cactus");
    expect(decorFlat).toContain("palmTop");
  });

  it("treats out-of-bounds as solid", () => {
    expect(isSolidAt(map, -1, 5)).toBe(true);
    expect(isSolidAt(map, 5, MAP_HEIGHT)).toBe(true);
  });

  it("declares water as solid so the player cannot walk into the pond", () => {
    expect(SOLID_NAMES).toContain("water");
  });
});
