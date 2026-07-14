/**
 * Act 1 zone maps: dimensions, manifest tile-name validity, determinism,
 * enclosure, landmark walkability, and BFS reachability from each zone's
 * default spawn to every gameplay landmark.
 */
import { describe, expect, it } from "vitest";
import manifest from "../../src/assets/generated/manifest.json";
import { type ZoneMap, isSolidAt, mapSize } from "../../src/game/maps/types";
import {
  buildCrashMap,
  CRASH_EAST_SPAWN,
  CRASH_EXIT_EAST,
  CRASH_FEATHER,
  CRASH_HEIGHT,
  CRASH_ROSA,
  CRASH_SPAWN,
  CRASH_WIDTH
} from "../../src/game/maps/crashMap";
import {
  buildOasisMap,
  OASIS_EAST_EXIT,
  OASIS_EAST_SPAWN,
  OASIS_HEIGHT,
  OASIS_SAHRA,
  OASIS_SCARAB,
  OASIS_SPAWN,
  OASIS_WEST_EXIT,
  OASIS_WEST_SPAWN,
  OASIS_WIDTH
} from "../../src/game/maps/oasisMap";
import {
  buildTrailMap,
  TRAIL_CHIPS,
  TRAIL_DUSTY,
  TRAIL_HEIGHT,
  TRAIL_MINE_EXIT,
  TRAIL_MINE_SPAWN,
  TRAIL_RABBIT,
  TRAIL_SPAWN,
  TRAIL_WEST_EXIT,
  TRAIL_WIDTH
} from "../../src/game/maps/trailMap";
import {
  buildMineMap,
  MINE_ELEVATOR,
  MINE_ELEVATOR_SPAWN,
  MINE_FOREMAN,
  MINE_GATE_TILES,
  MINE_HEIGHT,
  MINE_LEVER,
  MINE_LEVER_PLATE,
  MINE_SOUTH_EXIT,
  MINE_SPAWN,
  MINE_WIDTH
} from "../../src/game/maps/mineMap";
import {
  buildDepthsMap,
  DEPTHS_APPROACH,
  DEPTHS_CRACK,
  DEPTHS_HEIGHT,
  DEPTHS_PIGGY,
  DEPTHS_PIGGY_END,
  DEPTHS_QUEEN,
  DEPTHS_SOUTH_EXIT,
  DEPTHS_SPAWN,
  DEPTHS_WIDTH
} from "../../src/game/maps/depthsMap";

const KNOWN_NAMES = new Set([
  ...Object.keys(manifest.tiles.names),
  ...Object.keys(manifest.tiles2.names)
]);

interface Pt {
  x: number;
  y: number;
}

/** BFS over walkable (non-solid) tiles, 4-directional. */
function reachable(map: ZoneMap, from: Pt, to: Pt): boolean {
  const { width, height } = mapSize(map);
  if (isSolidAt(map, from.x, from.y) || isSolidAt(map, to.x, to.y)) return false;
  const seen = new Set<number>([from.y * width + from.x]);
  const queue: Pt[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return true;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = ny * width + nx;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (seen.has(key) || isSolidAt(map, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return false;
}

function rectTile(rect: { x1: number; y1: number; x2: number; y2: number }): Pt {
  return { x: rect.x1, y: rect.y1 };
}

function assertKnownNames(map: ZoneMap): void {
  for (const row of map.ground) {
    for (const cell of row) expect(KNOWN_NAMES).toContain(cell);
  }
  for (const row of map.decor) {
    for (const cell of row) if (cell !== null) expect(KNOWN_NAMES).toContain(cell);
  }
  for (const row of map.overhead ?? []) {
    for (const cell of row) if (cell !== null) expect(KNOWN_NAMES).toContain(cell);
  }
}

function assertEnclosed(map: ZoneMap): void {
  const { width, height } = mapSize(map);
  for (let x = 0; x < width; x++) {
    expect(isSolidAt(map, x, 0)).toBe(true);
    expect(isSolidAt(map, x, height - 1)).toBe(true);
  }
  for (let y = 0; y < height; y++) {
    expect(isSolidAt(map, 0, y)).toBe(true);
    expect(isSolidAt(map, width - 1, y)).toBe(true);
  }
}

function assertDimensions(map: ZoneMap, width: number, height: number): void {
  expect(mapSize(map)).toEqual({ width, height });
  expect(map.ground).toHaveLength(height);
  expect(map.decor).toHaveLength(height);
  for (const row of map.ground) expect(row).toHaveLength(width);
  for (const row of map.decor) expect(row).toHaveLength(width);
  for (const row of map.overhead ?? []) expect(row).toHaveLength(width);
}

// ---------------------------------------------------------------- crash

describe("crash map (Highway 95)", () => {
  const map = buildCrashMap();
  const landmarks: Record<string, Pt> = {
    rosa: CRASH_ROSA,
    feather: CRASH_FEATHER,
    eastExit: rectTile(CRASH_EXIT_EAST),
    eastSpawn: CRASH_EAST_SPAWN
  };

  it("has the declared dimensions", () => {
    assertDimensions(map, CRASH_WIDTH, CRASH_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildCrashMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map);
  });

  it("keeps the spawn and every landmark walkable", () => {
    expect(isSolidAt(map, CRASH_SPAWN.x, CRASH_SPAWN.y)).toBe(false);
    for (const p of Object.values(landmarks)) expect(isSolidAt(map, p.x, p.y)).toBe(false);
  });

  it("lets the player walk from spawn to Rosa and to the east exit", () => {
    expect(reachable(map, CRASH_SPAWN, CRASH_ROSA)).toBe(true);
    expect(reachable(map, CRASH_SPAWN, CRASH_FEATHER)).toBe(true);
    expect(reachable(map, CRASH_SPAWN, rectTile(CRASH_EXIT_EAST))).toBe(true);
  });

  it("composes the jackknifed truck on the asphalt highway", () => {
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("truckCab");
    expect(decorFlat.filter((c) => c === "truckBox")).toHaveLength(2);
    expect(decorFlat).toContain("crateBroken");
    expect(map.ground.flat()).toContain("asphaltLine");
  });
});

// ---------------------------------------------------------------- oasis

describe("oasis map (Sahra's Oasis)", () => {
  const map = buildOasisMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, OASIS_WIDTH, OASIS_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildOasisMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map);
  });

  it("keeps spawn points, exits and NPC tiles walkable", () => {
    for (const p of [
      OASIS_SPAWN,
      OASIS_SAHRA,
      OASIS_SCARAB,
      OASIS_WEST_SPAWN,
      OASIS_EAST_SPAWN,
      rectTile(OASIS_WEST_EXIT),
      rectTile(OASIS_EAST_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to Sahra and both exits", () => {
    expect(reachable(map, OASIS_SPAWN, OASIS_SAHRA)).toBe(true);
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_WEST_EXIT))).toBe(true);
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_EAST_EXIT))).toBe(true);
  });

  it("keeps the pond and ruins, with palm crowns in the overhead grid", () => {
    expect(map.ground.flat()).toContain("water");
    expect(map.decor.flat()).toContain("brick");
    expect(map.decor.flat()).toContain("palmTrunk");
    expect(map.decor.flat()).not.toContain("palmTop");
    expect(map.overhead?.flat()).toContain("palmTop");
  });

  it("lays a frost-sand hint near the east exit", () => {
    let found = false;
    for (let y = 8; y <= 11; y++) {
      for (let x = 27; x <= 30; x++) {
        if (map.ground[y][x] === "frostSand") found = true;
      }
    }
    expect(found).toBe(true);
  });
});

// ---------------------------------------------------------------- trail

describe("trail map (The Piggy Trail)", () => {
  const map = buildTrailMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, TRAIL_WIDTH, TRAIL_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildTrailMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map);
  });

  it("keeps spawn, chips, NPCs and exits walkable", () => {
    for (const p of [
      TRAIL_SPAWN,
      TRAIL_MINE_SPAWN,
      TRAIL_RABBIT,
      TRAIL_DUSTY,
      ...TRAIL_CHIPS,
      rectTile(TRAIL_WEST_EXIT),
      rectTile(TRAIL_MINE_EXIT),
      { x: TRAIL_MINE_EXIT.x2, y: TRAIL_MINE_EXIT.y2 }
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach all three chips, both NPCs and the mine exit", () => {
    for (const chip of TRAIL_CHIPS) expect(reachable(map, TRAIL_SPAWN, chip)).toBe(true);
    expect(reachable(map, TRAIL_SPAWN, TRAIL_RABBIT)).toBe(true);
    expect(reachable(map, TRAIL_SPAWN, TRAIL_DUSTY)).toBe(true);
    expect(reachable(map, TRAIL_SPAWN, rectTile(TRAIL_MINE_EXIT))).toBe(true);
    expect(reachable(map, TRAIL_SPAWN, rectTile(TRAIL_WEST_EXIT))).toBe(true);
  });

  it("builds the three sub-areas: frosty lakebed, grove and station", () => {
    // Lakebed frost.
    let lakebedFrost = false;
    for (let y = 1; y < TRAIL_HEIGHT - 1; y++) {
      for (let x = 1; x <= 15; x++) if (map.ground[y][x] === "frostSand") lakebedFrost = true;
    }
    expect(lakebedFrost).toBe(true);
    // Joshua trees with crowns overhead.
    expect(map.decor.flat()).toContain("joshuaTrunk");
    expect(map.overhead?.flat()).toContain("joshuaTop");
    // Station facade + pump on asphalt.
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("stationWall");
    expect(decorFlat).toContain("stationWindow");
    expect(decorFlat).toContain("stationSign");
    expect(decorFlat).toContain("gasPump");
    expect(map.ground.flat()).toContain("asphalt");
  });
});

// ---------------------------------------------------------------- mine

describe("mine map (Cinnabar Mine)", () => {
  const map = buildMineMap();

  /** The same map with the three timber gate tiles lifted. */
  function withOpenGate(m: ZoneMap): ZoneMap {
    const decor = m.decor.map((row) => [...row]);
    for (const g of MINE_GATE_TILES) decor[g.y][g.x] = null;
    return { ...m, decor };
  }

  it("has the declared dimensions", () => {
    assertDimensions(map, MINE_WIDTH, MINE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildMineMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map);
  });

  it("keeps spawn, lever plate, foreman and elevator tiles walkable", () => {
    for (const p of [
      MINE_SPAWN,
      MINE_LEVER_PLATE,
      MINE_FOREMAN,
      MINE_ELEVATOR_SPAWN,
      rectTile(MINE_ELEVATOR),
      rectTile(MINE_SOUTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("places the lever fixture and a three-timber gate", () => {
    expect(map.decor[MINE_LEVER.y][MINE_LEVER.x]).toBe("lever");
    for (const g of MINE_GATE_TILES) {
      expect(map.decor[g.y][g.x]).toBe("mineTimber");
      expect(isSolidAt(map, g.x, g.y)).toBe(true);
    }
    expect(map.decor.flat()).toContain("cart");
    expect(map.decor.flat()).toContain("rail");
  });

  it("seals the elevator behind the gate until the lever is pulled", () => {
    expect(reachable(map, MINE_SPAWN, MINE_LEVER_PLATE)).toBe(true);
    expect(reachable(map, MINE_SPAWN, rectTile(MINE_ELEVATOR))).toBe(false);
  });

  it("opens a walkable route to the foreman and elevator once the gate lifts", () => {
    const open = withOpenGate(map);
    expect(reachable(open, MINE_SPAWN, MINE_LEVER_PLATE)).toBe(true);
    expect(reachable(open, MINE_SPAWN, MINE_FOREMAN)).toBe(true);
    expect(reachable(open, MINE_SPAWN, rectTile(MINE_ELEVATOR))).toBe(true);
    expect(reachable(open, MINE_SPAWN, rectTile(MINE_SOUTH_EXIT))).toBe(true);
  });

  it("frosts more heavily toward the bottom of the mine", () => {
    const frostCount = (y0: number, y1: number): number => {
      let n = 0;
      for (let y = y0; y <= y1; y++) {
        for (let x = 0; x < MINE_WIDTH; x++) if (map.ground[y][x] === "frostSand") n++;
      }
      return n;
    };
    expect(frostCount(12, 21)).toBeGreaterThan(frostCount(0, 9));
  });
});

// ---------------------------------------------------------------- depths

describe("depths map (The Depths)", () => {
  const map = buildDepthsMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, DEPTHS_WIDTH, DEPTHS_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildDepthsMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map);
  });

  it("keeps spawn, queen, piggy and the south entrance walkable", () => {
    for (const p of [
      DEPTHS_SPAWN,
      DEPTHS_QUEEN,
      DEPTHS_PIGGY,
      DEPTHS_PIGGY_END,
      rectTile(DEPTHS_SOUTH_EXIT),
      rectTile(DEPTHS_APPROACH)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to the queen, Piggy and the exit", () => {
    expect(reachable(map, DEPTHS_SPAWN, DEPTHS_QUEEN)).toBe(true);
    expect(reachable(map, DEPTHS_SPAWN, DEPTHS_PIGGY)).toBe(true);
    expect(reachable(map, DEPTHS_SPAWN, DEPTHS_PIGGY_END)).toBe(true);
    expect(reachable(map, DEPTHS_SPAWN, rectTile(DEPTHS_SOUTH_EXIT))).toBe(true);
  });

  it("builds the cold gallery: ice wall, spring, and an egg ring", () => {
    // Solid ice along the whole north edge, plus the crack tiles as ice.
    for (let x = 0; x < DEPTHS_WIDTH; x++) expect(map.ground[0][x]).toBe("iceWall");
    for (const c of DEPTHS_CRACK) expect(map.decor[c.y][c.x]).toBe("iceWall");
    // Animated spring water.
    const groundFlat = map.ground.flat();
    expect(groundFlat).toContain("water");
    expect(groundFlat).toContain("water2");
    expect(groundFlat).toContain("frostSand");
    // Egg clusters ring the spring.
    expect(map.decor.flat().filter((c) => c === "eggCluster").length).toBeGreaterThanOrEqual(12);
  });

  it("keeps the queen standing between the entrance and Piggy", () => {
    expect(DEPTHS_QUEEN.y).toBeGreaterThan(DEPTHS_PIGGY.y);
    expect(DEPTHS_QUEEN.y).toBeLessThan(DEPTHS_SPAWN.y);
  });
});
