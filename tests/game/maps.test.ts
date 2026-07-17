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
  OASIS_NORTH_EXIT,
  OASIS_NORTH_SPAWN,
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
  buildAuthoredMap,
  buildOverworldMap,
  buildProceduralOverworld,
  deriveAuthoredLayout,
  OVERWORLD_HEIGHT,
  OVERWORLD_NORTH_EXIT,
  OVERWORLD_NORTH_SPAWN,
  OVERWORLD_SOUTH_EXIT,
  OVERWORLD_SOUTH_SPAWN,
  OVERWORLD_WIDTH
} from "../../src/game/maps/overworldMap";
import {
  buildMineEntranceMap,
  MINE_ENTRANCE_HEIGHT,
  MINE_ENTRANCE_NORTH_EXIT,
  MINE_ENTRANCE_SOUTH_EXIT,
  MINE_ENTRANCE_SPAWN,
  MINE_ENTRANCE_THRESHOLD,
  MINE_ENTRANCE_WIDTH
} from "../../src/game/maps/mineEntranceMap";
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
  ...Object.keys(manifest.tiles2.names),
  ...Object.keys(manifest.owMountains.names),
  // The Cinnabar Mine borrows the Act 2 lantern-post (tiles3) as a wall
  // torch — a deliberate cross-sheet reuse (tileGid resolves any sheet), so
  // it's allowed here rather than treated as a stray Act 2 tile.
  "lanternPost"
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

/** Multi-source BFS over walkable (non-solid) tiles, 4-directional —
 *  returns every reached cell as a set of "x,y" keys. Used to verify a
 *  HARD requirement (not just point-to-point spot checks): every walkable
 *  cell on the map is reachable from at least one spawn, i.e. nothing the
 *  generator produced is an isolated, unreachable pocket. */
function reachableSet(map: ZoneMap, from: readonly Pt[]): Set<string> {
  const { width, height } = mapSize(map);
  const seen = new Set<string>();
  const queue: Pt[] = [];
  for (const p of from) {
    if (isSolidAt(map, p.x, p.y)) continue;
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    queue.push(p);
  }
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1]
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || isSolidAt(map, nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
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
      ...edgeGate(OASIS_SOUTH_EXIT, "south", map),
      ...edgeGate(OASIS_NORTH_EXIT, "north", map)
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
      OASIS_NORTH_SPAWN,
      rectTile(OASIS_WEST_EXIT),
      rectTile(OASIS_EAST_EXIT),
      rectTile(OASIS_SOUTH_EXIT),
      rectTile(OASIS_NORTH_EXIT)
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
    expect(reachable(map, OASIS_SPAWN, rectTile(OASIS_NORTH_EXIT))).toBe(true);
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

// ------------------------------------------------------------ overworld

describe("overworld map (procedural generator, terrain-first v23/v24)", () => {
  // These invariants describe the GENERATOR — the fallback used when no
  // hand-authored layout is active — tested against its own build directly, so
  // they hold even when an authored map is the one that actually ships
  // (validated separately below). The local consts shadow the module exports
  // with the procedural build's own stops.
  const build = buildProceduralOverworld();
  const map = build.map;
  const OVERWORLD_NORTH_EXIT = build.northExit;
  const OVERWORLD_SOUTH_EXIT = build.southExit;
  const OVERWORLD_NORTH_SPAWN = build.northSpawn;
  const OVERWORLD_SOUTH_SPAWN = build.southSpawn;

  it("has the declared dimensions", () => {
    assertDimensions(map, OVERWORLD_WIDTH, OVERWORLD_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildProceduralOverworld().map).toEqual(map);
  });

  it("is fully enclosed by solid border tiles (the two stops are interior now)", () => {
    // v24: the mine/spring stops moved inside the map, so the mountain border
    // is completely closed — there are no edge gates to leave gaps for.
    assertEnclosed(map);
  });

  it("puts both stops well inside the map, not against any edge", () => {
    for (const r of [OVERWORLD_NORTH_EXIT, OVERWORLD_SOUTH_EXIT]) {
      expect(r.y1).toBeGreaterThan(4);
      expect(r.y2).toBeLessThan(OVERWORLD_HEIGHT - 5);
    }
    for (const p of [OVERWORLD_NORTH_SPAWN, OVERWORLD_SOUTH_SPAWN]) {
      expect(p.y).toBeGreaterThan(4);
      expect(p.y).toBeLessThan(OVERWORLD_HEIGHT - 5);
      expect(p.x).toBeGreaterThan(4);
      expect(p.x).toBeLessThan(OVERWORLD_WIDTH - 5);
    }
  });

  it("keeps each arrival spawn off its own exit band (no instant re-trigger)", () => {
    const onBand = (p: Pt, r: { x1: number; y1: number; x2: number; y2: number }) =>
      p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
    expect(onBand(OVERWORLD_NORTH_SPAWN, OVERWORLD_NORTH_EXIT)).toBe(false);
    expect(onBand(OVERWORLD_SOUTH_SPAWN, OVERWORLD_SOUTH_EXIT)).toBe(false);
  });

  it("keeps both spawns and both stops walkable", () => {
    for (const p of [
      OVERWORLD_SOUTH_SPAWN,
      OVERWORLD_NORTH_SPAWN,
      rectTile(OVERWORLD_SOUTH_EXIT),
      rectTile(OVERWORLD_NORTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk between the two stops", () => {
    expect(reachable(map, OVERWORLD_SOUTH_SPAWN, rectTile(OVERWORLD_NORTH_EXIT))).toBe(true);
    expect(reachable(map, OVERWORLD_NORTH_SPAWN, rectTile(OVERWORLD_SOUTH_EXIT))).toBe(true);
  });

  // v23 (docs/CONTRACTS.md "v23") rebuilt the map terrain-first: organic
  // mountain masses generated with zero knowledge of landmark positions,
  // THEN the mine/spring landmarks placed into whatever the terrain left
  // open, THEN a couple of barrier masses added last. Barriers in
  // particular are explicitly allowed to be placed after (and around) the
  // landmarks, so the only way to be sure nothing got walled off is a real
  // BFS over the WHOLE map, not spot checks between a few named points —
  // this is the hard "every walkable cell reachable from at least one
  // spawn" requirement docs/CONTRACTS.md "v23" calls out explicitly.
  it("reaches every walkable cell on the map from at least one of the two spawns", () => {
    let totalWalkable = 0;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (!isSolidAt(map, x, y)) totalWalkable++;
      }
    }
    const reached = reachableSet(map, [OVERWORLD_SOUTH_SPAWN, OVERWORLD_NORTH_SPAWN]);
    expect(reached.size).toBe(totalWalkable);
  });

  it("is mostly open desert with scattered mountain massing, not one wall bisecting the map", () => {
    let walkable = 0;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (!isSolidAt(map, x, y)) walkable++;
      }
    }
    // Measured empirically after the v23 terrain-first rework: walkable is
    // ~76% of the grid (several modest mountain masses plus a thin,
    // variable-thickness border, not one big spine). Assert comfortably
    // above half so small future tuning doesn't need a re-measurement.
    expect(walkable).toBeGreaterThan((OVERWORLD_WIDTH * OVERWORLD_HEIGHT) / 2);
  });

  it("places the truck and spring near the south stop, on open ground close to the gate", () => {
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("truckCab");
    expect(decorFlat).toContain("truckBox");
    // The spring pool is only 2x2, so every one of its cells touches at
    // least one non-water neighbor — mask 15 ("plain water, no shore")
    // never occurs, and the whole pool dresses as lakeShore{mask} tiles
    // rather than literal "water"/"water2" (see the lakeShore dressing
    // test below, which checks this mask math directly).
    expect(map.ground.flat().some((n) => n === "water" || n === "water2" || n.startsWith("lakeShore"))).toBe(true);
    const gateCx = (OVERWORLD_SOUTH_EXIT.x1 + OVERWORLD_SOUTH_EXIT.x2) / 2;
    const gateCy = (OVERWORLD_SOUTH_EXIT.y1 + OVERWORLD_SOUTH_EXIT.y2) / 2;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (map.decor[y][x] === "truckCab" || map.decor[y][x] === "truckBox") {
          expect(Math.abs(x - gateCx)).toBeLessThanOrEqual(8);
          expect(Math.abs(y - gateCy)).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  it("places mine-mouth flavor near the north stop, on open ground close to the gate", () => {
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("mineTimber");
    expect(decorFlat).toContain("cart");
    const gateCx = (OVERWORLD_NORTH_EXIT.x1 + OVERWORLD_NORTH_EXIT.x2) / 2;
    const gateCy = (OVERWORLD_NORTH_EXIT.y1 + OVERWORLD_NORTH_EXIT.y2) / 2;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (map.decor[y][x] === "mineTimber" || map.decor[y][x] === "cart") {
          expect(Math.abs(x - gateCx)).toBeLessThanOrEqual(8);
          expect(Math.abs(y - gateCy)).toBeLessThanOrEqual(6);
        }
      }
    }
  });

  // ---- Phase O autotile dressing (docs/ART_DIRECTION.md §4a) ----

  // owMountains.png (docs/CONTRACTS.md "owMountains") uses 80
  // owMountain{variant}_{mask} names — matched here by prefix rather than
  // an enumerated set.
  const isMountainName = (name: string): boolean => name.startsWith("owMountain");
  const SCREE_FAMILY = new Set([
    "scree",
    "scree2",
    "screeSandN",
    "screeSandE",
    "screeSandS",
    "screeSandW",
    "screeSandNE",
    "screeSandNW",
    "screeSandSE",
    "screeSandSW",
    "screeWaterN",
    "screeWaterE",
    "screeWaterS",
    "screeWaterW",
    "screeWaterNE",
    "screeWaterNW",
    "screeWaterSE",
    "screeWaterSW"
  ]);

  it("puts scree-family ground under every mountain cell (billboards stand on rock)", () => {
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        const d = map.decor[y][x];
        if (d !== null && isMountainName(d)) {
          expect(SCREE_FAMILY.has(map.ground[y][x])).toBe(true);
        }
      }
    }
  });

  it("no longer casts the screeShade foot-shadow band (removed — read as a rock ledge)", () => {
    // The mountain foot-shadow band was cut deliberately; mountains now meet
    // sand directly (via the sand↔scree fingers below). Guard against it
    // silently coming back. The screeShade TILE still exists in the sheet.
    const usesScreeShade = map.ground.flat().includes("screeShade");
    expect(usesScreeShade).toBe(false);
  });

  it("uses sand↔scree finger transitions where mountain masses meet open ground", () => {
    const flat = map.ground.flat();
    expect(flat.some((n) => n.startsWith("screeSand"))).toBe(true);
  });

  // The spring pool is dressed with the same generic mask-based sand↔water
  // autotile v22's much bigger lake used (mask = which N/E/S/W neighbours
  // are ALSO water) — this test recomputes the expected mask per water
  // cell from a fresh isWater reading and checks the ground name matches
  // exactly, so it fails loudly if the mask math and the actual tile
  // placement ever drift apart.
  const isWaterName = (name: string | undefined): boolean =>
    name === "water" || name === "water2" || (name?.startsWith("lakeShore") ?? false);

  it("dresses every water cell with the mask-correct lakeShore tile (mask 15 keeps plain water)", () => {
    let shoreCells = 0;
    const masksSeen = new Set<number>();
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (!isWaterName(map.ground[y][x])) continue;
        let mask = 0;
        if (isWaterName(map.ground[y - 1]?.[x])) mask |= 1;
        if (isWaterName(map.ground[y]?.[x + 1])) mask |= 2;
        if (isWaterName(map.ground[y + 1]?.[x])) mask |= 4;
        if (isWaterName(map.ground[y]?.[x - 1])) mask |= 8;
        if (mask === 15) {
          expect(["water", "water2"]).toContain(map.ground[y][x]);
        } else {
          expect(map.ground[y][x]).toBe(`lakeShore${mask}`);
          shoreCells++;
          masksSeen.add(mask);
        }
      }
    }
    // The spring pool actually exists and shows real mask variety around
    // its small shoreline (it's a 2x2 pool, not v22's big lake, so the
    // bar is lower — but every one of its 4 cells should still round
    // through a real corner mask, not a straight/blank edge).
    expect(shoreCells).toBeGreaterThanOrEqual(4);
    expect(masksSeen.size).toBeGreaterThanOrEqual(2);
  });

  it("plants joshua trees (billboard landmarks) beside the clearings", () => {
    expect(map.decor.flat().filter((c) => c === "joshuaTrunk").length).toBeGreaterThanOrEqual(2);
  });

  it("shows real owMountain texture variety (multiple variants and masks, not one repeated tile)", () => {
    const variants = new Set<number>();
    const masks = new Set<number>();
    for (const row of map.decor) {
      for (const d of row) {
        if (d === null || !isMountainName(d)) continue;
        const [v, m] = d.replace("owMountain", "").split("_").map(Number);
        variants.add(v);
        masks.add(m);
      }
    }
    expect(variants.size).toBeGreaterThanOrEqual(3);
    expect(masks.size).toBeGreaterThanOrEqual(5);
  });

  // ---- v23 terrain-first invariants (docs/CONTRACTS.md "v23") ----
  // The old v22 tests asserted properties of a single hand-positioned
  // spine/lake (e.g. "stays inside the spine's own generated bounds" —
  // there is no spine anymore, so that test doesn't apply). These verify
  // the actual shape of the NEW architecture instead: real scattered
  // massing (not one shapeless blob or a rectangle), reused wherever the
  // spec calls for "organic, not hand-drawn geometry".

  /** 8-connected flood fill over mountain decor cells, restricted to the
   *  map's interior (excluding the literal border ring/buffer) so this
   *  measures actual TERRAIN massing, not the border's own shape. */
  function interiorMountainComponents(): number[][] {
    const seen = new Set<string>();
    const sizes: number[] = [];
    for (let y = 1; y < OVERWORLD_HEIGHT - 1; y++) {
      for (let x = 1; x < OVERWORLD_WIDTH - 1; x++) {
        const d = map.decor[y][x];
        if (d === null || !isMountainName(d)) continue;
        const key = `${x},${y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const stack: Pt[] = [{ x, y }];
        let size = 0;
        while (stack.length > 0) {
          const cur = stack.pop()!;
          size++;
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [1, 1],
            [1, -1],
            [-1, 1],
            [-1, -1]
          ] as const) {
            const nx = cur.x + dx;
            const ny = cur.y + dy;
            if (nx < 1 || ny < 1 || nx >= OVERWORLD_WIDTH - 1 || ny >= OVERWORLD_HEIGHT - 1) continue;
            const nd = map.decor[ny]?.[nx];
            if (nd === null || nd === undefined || !isMountainName(nd)) continue;
            const nk = `${nx},${ny}`;
            if (seen.has(nk)) continue;
            seen.add(nk);
            stack.push({ x: nx, y: ny });
          }
        }
        sizes.push(size);
      }
    }
    return [sizes];
  }

  it("scatters multiple separate mountain masses across the map, not one wall or blob", () => {
    const [sizes] = interiorMountainComponents();
    // The terrain phase places up to 6 masses and the barrier phase up to
    // 2 more (8 max); some may fail to place if they can't find room, but
    // several real, separate masses should always survive. Measured
    // empirically at 7 for the current seeds/tiers — assert a safe lower
    // bound rather than the exact count so small future tuning doesn't
    // need a re-measurement here.
    expect(sizes.length).toBeGreaterThanOrEqual(3);
    // No single mass should dominate the map — that would just be v22's
    // rejected "one wall" shape again with extra noise on it.
    const total = sizes.reduce((a, b) => a + b, 0);
    const largest = Math.max(...sizes);
    expect(largest / total).toBeLessThan(0.6);
  });

  it("keeps the outer border an irregular, variable-thickness rim, not a uniform 1-cell rectangle", () => {
    // MASS_EDGE_MARGIN keeps every interior mass's own reach at least 3
    // cells clear of the literal edge, so rows/columns 0..2 next to any
    // edge are guaranteed to be either border or open ground — never a
    // terrain mass — making this a safe, generic way to measure the
    // border's own thickness without needing to know where the masses
    // actually ended up.
    const northGateCx = (OVERWORLD_NORTH_EXIT.x1 + OVERWORLD_NORTH_EXIT.x2) / 2;
    const depths = new Set<number>();
    for (let x = 3; x < OVERWORLD_WIDTH - 3; x++) {
      if (Math.abs(x - northGateCx) <= 10) continue; // skip the gate opening itself
      let d = 0;
      for (let y = 0; y < 3; y++) {
        const cell = map.decor[y][x];
        if (cell !== null && isMountainName(cell)) d++;
        else break;
      }
      depths.add(d);
    }
    // A uniform 1-cell rectangle would show exactly one depth (1) at every
    // sampled column; the noisy buffer should show real variety.
    expect(depths.size).toBeGreaterThan(1);
  });

  it("keeps the literal border ring solid on all four edges (fully closed — stops are interior)", () => {
    // Redundant with "is fully enclosed..." above by design — this is the
    // same guarantee restated as a direct decor check, so a future change
    // to the border/buffer logic that broke enclosure in a way `isSolidAt`
    // didn't happen to catch (e.g. a ground-only leak) still fails loudly.
    // v24: no edge gates anymore, so every border cell is solid.
    for (let x = 0; x < OVERWORLD_WIDTH; x++) {
      expect(map.decor[0][x]).not.toBeNull();
      expect(map.decor[OVERWORLD_HEIGHT - 1][x]).not.toBeNull();
    }
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      expect(map.decor[y][0]).not.toBeNull();
      expect(map.decor[y][OVERWORLD_WIDTH - 1]).not.toBeNull();
    }
  });

  // ---- authored (human-touch) path parity ----
  // The map editor (tools/mapeditor) exports a semantic AuthoredOverworld; the
  // game finishes it through the SAME autotile passes as the procedural build.
  // Deriving a layout from the procedural map and finishing it again must
  // reproduce that map byte-for-byte — this is what guarantees a hand-authored
  // layout tiles exactly the way the generator would, and that the editor's
  // seed (deriveAuthoredLayout) and the game's finish (buildAuthoredMap) are
  // faithful inverses.
  const exitCenter = (r: { x1: number; y1: number; x2: number; y2: number }): Pt => ({
    x: Math.round((r.x1 + r.x2) / 2),
    y: Math.round((r.y1 + r.y2) / 2)
  });
  const stopsFromExports = () => ({
    northGate: exitCenter(OVERWORLD_NORTH_EXIT),
    northSpawn: OVERWORLD_NORTH_SPAWN,
    southGate: exitCenter(OVERWORLD_SOUTH_EXIT),
    southSpawn: OVERWORLD_SOUTH_SPAWN
  });

  it("round-trips the procedural map through derive→finish unchanged", () => {
    const layout = deriveAuthoredLayout(map, stopsFromExports());
    expect(buildAuthoredMap(layout)).toEqual(map);
  });

  it("finishes an authored layout into a valid, fully-reachable map", () => {
    const authored = buildAuthoredMap(deriveAuthoredLayout(map, stopsFromExports()));
    assertDimensions(authored, OVERWORLD_WIDTH, OVERWORLD_HEIGHT);
    assertKnownNames(authored);
    let walkable = 0;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) if (!isSolidAt(authored, x, y)) walkable++;
    }
    const reached = reachableSet(authored, [OVERWORLD_SOUTH_SPAWN, OVERWORLD_NORTH_SPAWN]);
    expect(reached.size).toBe(walkable);
  });
});

// The map that actually SHIPS — whatever `buildOverworldMap()` returns, which
// is the hand-authored layout (`overworldMap.authored.ts`) when one is present,
// else the procedural build. A hand-authored world may deliberately wall off an
// "outside desert" you can never reach (mountain ranges cutting the central
// area off from the rest), so the shipped map's invariants are about
// PLAYABILITY — correct size/names, valid stops, and a connected play path —
// not the generator-only guarantees (fully-closed border, every cell reachable,
// landmarks hugging their gate) checked above.
describe("overworld map (shipped build — honors a hand-authored layout)", () => {
  const map = buildOverworldMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, OVERWORLD_WIDTH, OVERWORLD_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildOverworldMap()).toEqual(map);
  });

  it("keeps both spawns and both exit bands walkable", () => {
    for (const p of [
      OVERWORLD_SOUTH_SPAWN,
      OVERWORLD_NORTH_SPAWN,
      rectTile(OVERWORLD_SOUTH_EXIT),
      rectTile(OVERWORLD_NORTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("keeps each arrival spawn off its own exit band (no instant re-trigger)", () => {
    const onBand = (p: Pt, r: { x1: number; y1: number; x2: number; y2: number }) =>
      p.x >= r.x1 && p.x <= r.x2 && p.y >= r.y1 && p.y <= r.y2;
    expect(onBand(OVERWORLD_NORTH_SPAWN, OVERWORLD_NORTH_EXIT)).toBe(false);
    expect(onBand(OVERWORLD_SOUTH_SPAWN, OVERWORLD_SOUTH_EXIT)).toBe(false);
  });

  it("connects both stops and the far spawn to the entry (the play path works)", () => {
    // You enter from the oasis at the south spawn and must be able to reach
    // BOTH exits and the mine-side spawn. This is the playability guarantee —
    // NOT "every cell reachable", since a hand-authored outside desert is a
    // legitimate, deliberately-unreachable region.
    const reached = reachableSet(map, [OVERWORLD_SOUTH_SPAWN]);
    const bandReached = (r: { x1: number; y1: number; x2: number; y2: number }): boolean => {
      for (let x = r.x1; x <= r.x2; x++) for (let y = r.y1; y <= r.y2; y++) if (reached.has(`${x},${y}`)) return true;
      return false;
    };
    expect(bandReached(OVERWORLD_NORTH_EXIT)).toBe(true);
    expect(bandReached(OVERWORLD_SOUTH_EXIT)).toBe(true);
    expect(reached.has(`${OVERWORLD_NORTH_SPAWN.x},${OVERWORLD_NORTH_SPAWN.y}`)).toBe(true);
  });

  it("is mostly open desert (a real play area, not a maze)", () => {
    let walkable = 0;
    for (let y = 0; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) if (!isSolidAt(map, x, y)) walkable++;
    }
    expect(walkable).toBeGreaterThan((OVERWORLD_WIDTH * OVERWORLD_HEIGHT) / 3);
  });
});

// -------------------------------------------------------- mine entrance

describe("mine entrance map (the threshold screen)", () => {
  const map = buildMineEntranceMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, MINE_ENTRANCE_WIDTH, MINE_ENTRANCE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildMineEntranceMap()).toEqual(map);
  });

  it("is fully enclosed by solid border tiles except its two exits", () => {
    assertEnclosed(map, [
      ...edgeGate(MINE_ENTRANCE_SOUTH_EXIT, "south", map),
      ...edgeGate(MINE_ENTRANCE_NORTH_EXIT, "north", map)
    ]);
  });

  it("keeps the spawn, the threshold and both exits walkable", () => {
    for (const p of [
      MINE_ENTRANCE_SPAWN,
      MINE_ENTRANCE_THRESHOLD,
      rectTile(MINE_ENTRANCE_SOUTH_EXIT),
      rectTile(MINE_ENTRANCE_NORTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to the mine mouth and back out", () => {
    expect(reachable(map, MINE_ENTRANCE_SPAWN, MINE_ENTRANCE_THRESHOLD)).toBe(true);
    expect(reachable(map, MINE_ENTRANCE_SPAWN, rectTile(MINE_ENTRANCE_NORTH_EXIT))).toBe(true);
    expect(reachable(map, MINE_ENTRANCE_SPAWN, rectTile(MINE_ENTRANCE_SOUTH_EXIT))).toBe(true);
  });

  it("fades ground from sand to mine floor toward the mouth", () => {
    expect(map.ground.flat()).toContain("sand");
    expect(map.ground.flat()).toContain("mineFloor");
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

  it("builds the cold gallery: rock wall, spring, and an egg ring", () => {
    // Solid rock along the whole north edge, and the crack tiles start as
    // rock too — they collapse at the cliffhanger to reveal the ice behind
    // (DepthsScene.crackWall), so nothing should read as ice in the map.
    for (let x = 0; x < DEPTHS_WIDTH; x++) expect(map.ground[0][x]).toBe("mineWall");
    for (const c of DEPTHS_CRACK) expect(map.decor[c.y][c.x]).toBe("mineWall");
    expect(map.ground.flat()).not.toContain("iceWall");
    expect(map.decor.flat()).not.toContain("iceWall");
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
