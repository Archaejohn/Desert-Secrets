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
  OASIS_COOP,
  OASIS_COOP_PEN,
  OASIS_EAST_EXIT,
  OASIS_EAST_SPAWN,
  OASIS_HEIGHT,
  OASIS_PAMELA,
  OASIS_PARENTS,
  OASIS_SCARAB,
  OASIS_SOUTH_EXIT,
  OASIS_SOUTH_SPAWN,
  OASIS_SPAWN,
  OASIS_SPRING_FILL,
  OASIS_WEST_EXIT,
  OASIS_WEST_SPAWN,
  OASIS_WIDTH
} from "../../src/game/maps/oasisMap";
import {
  buildShedMap,
  SHED_BUCKET,
  SHED_HEIGHT,
  SHED_NORTH_EXIT,
  SHED_SPAWN,
  SHED_WIDTH
} from "../../src/game/maps/shedMap";
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

/**
 * The border must be solid EXCEPT at declared exit gates, which must be
 * visibly open (walkable) so the player can see the way out.
 */
function assertEnclosed(map: ZoneMap, gates: Array<{ x: number; y: number }> = []): void {
  const { width, height } = mapSize(map);
  const gateSet = new Set(gates.map((g) => `${g.x},${g.y}`));
  const expectBorder = (x: number, y: number) => {
    if (gateSet.has(`${x},${y}`)) expect(isSolidAt(map, x, y)).toBe(false);
    else expect(isSolidAt(map, x, y)).toBe(true);
  };
  for (let x = 0; x < width; x++) {
    expectBorder(x, 0);
    expectBorder(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    expectBorder(0, y);
    expectBorder(width - 1, y);
  }
}

/** Border-edge gate cells implied by an exit band one tile inside the edge. */
function edgeGate(
  rect: { x1: number; y1: number; x2: number; y2: number },
  edge: "west" | "east" | "north" | "south",
  map: ZoneMap
): Array<{ x: number; y: number }> {
  const { width, height } = mapSize(map);
  const cells: Array<{ x: number; y: number }> = [];
  if (edge === "north" || edge === "south") {
    const y = edge === "north" ? 0 : height - 1;
    for (let x = rect.x1; x <= rect.x2; x++) cells.push({ x, y });
  } else {
    const x = edge === "west" ? 0 : width - 1;
    for (let y = rect.y1; y <= rect.y2; y++) cells.push({ x, y });
  }
  return cells;
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
    assertEnclosed(map, edgeGate(CRASH_EXIT_EAST, "east", map));
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

describe("oasis map (the homestead)", () => {
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
    assertEnclosed(map, [
      ...edgeGate(OASIS_WEST_EXIT, "west", map),
      ...edgeGate(OASIS_EAST_EXIT, "east", map),
      ...edgeGate(OASIS_SOUTH_EXIT, "south", map)
    ]);
  });

  it("keeps spawn points, exits and NPC tiles walkable", () => {
    for (const p of [
      OASIS_SPAWN,
      OASIS_PARENTS,
      OASIS_PAMELA,
      OASIS_SCARAB,
      OASIS_COOP,
      OASIS_SPRING_FILL,
      OASIS_WEST_SPAWN,
      OASIS_EAST_SPAWN,
      OASIS_SOUTH_SPAWN,
      rectTile(OASIS_WEST_EXIT),
      rectTile(OASIS_EAST_EXIT),
      rectTile(OASIS_SOUTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to the parents, the coop, the spring and all exits", () => {
    expect(reachable(map, OASIS_SPAWN, OASIS_PARENTS)).toBe(true);
    expect(reachable(map, OASIS_SPAWN, OASIS_COOP)).toBe(true);
    expect(reachable(map, OASIS_SPAWN, OASIS_SPRING_FILL)).toBe(true);
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_WEST_EXIT))).toBe(true);
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_EAST_EXIT))).toBe(true);
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_SOUTH_EXIT))).toBe(true);
  });

  it("fences the coop except for its south-facing entrance", () => {
    // The three declared fence sides must be solid...
    for (let x = OASIS_COOP_PEN.x1; x <= OASIS_COOP_PEN.x2; x++) {
      expect(isSolidAt(map, x, OASIS_COOP_PEN.y1)).toBe(true); // north wall
    }
    expect(isSolidAt(map, OASIS_COOP_PEN.x1, OASIS_COOP_PEN.y2)).toBe(true); // west corner
    expect(isSolidAt(map, OASIS_COOP_PEN.x2, OASIS_COOP_PEN.y2)).toBe(true); // east corner
    // ...except the entrance gap itself, which must be open.
    expect(isSolidAt(map, OASIS_COOP.x, OASIS_COOP.y)).toBe(false);
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

// ----------------------------------------------------------------- shed

describe("shed map (the shed)", () => {
  const map = buildShedMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, SHED_WIDTH, SHED_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildShedMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles", () => {
    assertEnclosed(map, edgeGate(SHED_NORTH_EXIT, "north", map));
  });

  it("keeps the spawn, the bucket and the exit walkable", () => {
    for (const p of [SHED_SPAWN, SHED_BUCKET, rectTile(SHED_NORTH_EXIT)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to the bucket and back out", () => {
    expect(reachable(map, SHED_SPAWN, SHED_BUCKET)).toBe(true);
    expect(reachable(map, SHED_SPAWN, rectTile(SHED_NORTH_EXIT))).toBe(true);
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
    assertEnclosed(map, [...edgeGate(TRAIL_WEST_EXIT, "west", map), ...edgeGate(TRAIL_MINE_EXIT, "north", map)]);
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
