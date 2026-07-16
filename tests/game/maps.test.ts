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
  buildOverworldMap,
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
  ...Object.keys(manifest.owMountains.names)
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

describe("overworld map (the open desert, FF-style POC)", () => {
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

  it("is fully enclosed by solid border tiles except its two stops", () => {
    assertEnclosed(map, [
      ...edgeGate(OVERWORLD_SOUTH_EXIT, "south", map),
      ...edgeGate(OVERWORLD_NORTH_EXIT, "north", map)
    ]);
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

  it("lets the player walk the whole pass between the two stops", () => {
    expect(reachable(map, OVERWORLD_SOUTH_SPAWN, rectTile(OVERWORLD_NORTH_EXIT))).toBe(true);
    expect(reachable(map, OVERWORLD_NORTH_SPAWN, rectTile(OVERWORLD_SOUTH_EXIT))).toBe(true);
  });

  // v22 (docs/CONTRACTS.md "v22"): the road network's own hub cells — the
  // town's south plaza entrance and the lake's southwest shore approach
  // (see overworldMap.ts's markRoadCells) — reachable from both spawns,
  // proving the roads actually connect the new landmarks to the pass
  // rather than just decorating disconnected pockets of the valleys.
  it("lets the player walk from either stop out to the town and the lake via the roads", () => {
    const townHub = { x: 14, y: 12 };
    const lakeHub = { x: 49, y: 57 };
    expect(reachable(map, OVERWORLD_SOUTH_SPAWN, townHub)).toBe(true);
    expect(reachable(map, OVERWORLD_SOUTH_SPAWN, lakeHub)).toBe(true);
    expect(reachable(map, OVERWORLD_NORTH_SPAWN, townHub)).toBe(true);
    expect(reachable(map, OVERWORLD_NORTH_SPAWN, lakeHub)).toBe(true);
  });

  it("is mostly open: valleys flank a narrower mountain spine", () => {
    const { width, height } = { width: OVERWORLD_WIDTH, height: OVERWORLD_HEIGHT };
    let walkable = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!isSolidAt(map, x, y)) walkable++;
      }
    }
    // v22 (docs/CONTRACTS.md "v22") replaced "solid mountain everywhere
    // except a carved pass" with a narrower central spine flanked by open
    // desert valleys on both sides, so the old "walkable is a small
    // fraction" invariant is now backwards: most of the 64x64 grid should
    // read as open ground. The spine is 21x48 cells (SPINE_X1..SPINE_X2 x
    // SPINE_Y1..SPINE_Y2 in overworldMap.ts) minus the carved pass itself,
    // plus the 1-tile-thick outer border ring, plus a handful of solid
    // decor (the town's three small buildings, tree trunks, the truck) —
    // well under half the grid. Measured after the v22 redesign: walkable
    // is ~2825/4096 (~69%). Assert comfortably above half rather than
    // pinning the exact figure, so small future landmark tweaks don't need
    // a re-measurement here.
    expect(walkable).toBeGreaterThan((width * height) / 2);
  });

  it("places the truck and spring near the south stop", () => {
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("truckCab");
    expect(decorFlat).toContain("truckBox");
    expect(map.ground.flat()).toContain("water");
  });

  it("places mine-mouth flavor near the north stop", () => {
    expect(map.decor.flat()).toContain("mineTimber");
  });

  // ---- Phase O autotile dressing (docs/ART_DIRECTION.md §4a) ----

  // owMountains.png (docs/CONTRACTS.md "owMountains") replaced the eight
  // fixed mountain1..8 names with 80 owMountain{variant}_{mask} names —
  // matched here by prefix rather than an enumerated set.
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
    // v22 (docs/CONTRACTS.md "v22"): wherever the new lake touches the
    // mountain spine instead of open sand, the same finger-transition
    // recipe runs against water instead of sand.
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

  it("casts the screeShade foot-shadow band on open cells south of mountains", () => {
    let bands = 0;
    for (let y = 1; y < OVERWORLD_HEIGHT; y++) {
      for (let x = 0; x < OVERWORLD_WIDTH; x++) {
        if (map.ground[y][x] === "screeShade") {
          bands++;
          const above = map.decor[y - 1][x];
          expect(above !== null && isMountainName(above)).toBe(true);
        }
      }
    }
    expect(bands).toBeGreaterThan(3); // the band actually exists
  });

  // v22 (docs/CONTRACTS.md "v22") replaced the old 12-tile straight-edge
  // coast* ring — which read as "a concrete barrier, not a beach" once the
  // lake stopped being a hand-drawn rectangle/ellipse — with a full
  // 16-mask lakeShore autotile placed on the WATER cells themselves (mask
  // = which N/E/S/W neighbours are ALSO water, the same convention
  // owMountains uses for "which neighbours are also mountain"). This test
  // recomputes the expected mask per water cell from a fresh isWater
  // reading (not `assertKnownNames`-style name matching) and checks the
  // ground name matches exactly, so it fails loudly if the mask math and
  // the actual tile placement ever drift apart.
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
    // The ring actually exists (not a no-op) and shows real mask variety —
    // an organic coastline should round through several different corner
    // shapes, not just straight edges (this is also the "no butt-jointed
    // shore" guarantee: since every water cell touching non-water gets its
    // mask-correct lakeShore tile with no exceptions besides mountain
    // cells, a hard/abrupt edge would show up here as a wrong or missing
    // mask, not as a separate assertion on the land side — the transition
    // art lives on the water cell now, not the land cell, unlike the old
    // coast* set).
    expect(shoreCells).toBeGreaterThan(20);
    expect(masksSeen.size).toBeGreaterThan(4);
  });

  it("uses sand↔scree finger transitions where mountain masses meet the pass", () => {
    const flat = map.ground.flat();
    expect(flat.some((n) => n.startsWith("screeSand"))).toBe(true);
  });

  it("uses scree↔water finger transitions where the mountain spine meets the lake", () => {
    const flat = map.ground.flat();
    expect(flat.some((n) => n.startsWith("screeWater"))).toBe(true);
  });

  it("lays a connected dirt-road autotile linking the two stops to the town and the lake", () => {
    const flat = map.ground.flat();
    // At least one straight segment, one turn/T-junction and one dead-end
    // stub actually appear (masks are N=1,E=2,S=4,W=8 —
    // assignMountainTileNames/overworldMap.ts's road pass): a lone bit is a
    // dead end, two opposite bits is a straight run, anything else is a
    // bend or junction.
    const roadMasksPresent = new Set(
      flat.filter((n) => /^road\d+$/.test(n)).map((n) => Number(n.slice(4)))
    );
    expect(roadMasksPresent.size).toBeGreaterThan(1);
    expect(roadMasksPresent.has(0)).toBe(false); // no isolated road cells
  });

  it("plants joshua trees (billboard landmarks) beside the clearings", () => {
    expect(map.decor.flat().filter((c) => c === "joshuaTrunk").length).toBeGreaterThanOrEqual(2);
  });

  // ---- v22 organic-shape invariants (docs/CONTRACTS.md "v22" rework) ----
  // The spine and lake are now procedurally generated (seeded noise), not
  // hand-placed geometry — these checks verify the actual generated shape
  // rather than re-deriving one from the same formula the map builder
  // itself uses (which would just test that the formula agrees with
  // itself), so a future seed/parameter change that breaks these
  // properties fails loudly here instead of only showing up in a
  // screenshot review.

  function spineExtentAtRow(y: number): [number, number] | null {
    let l = -1;
    let r = -1;
    for (let x = 1; x < OVERWORLD_WIDTH - 1; x++) {
      const d = map.decor[y][x];
      if (d !== null && isMountainName(d)) {
        if (l < 0) l = x;
        r = x;
      }
    }
    return l < 0 ? null : [l, r];
  }

  it("carves a pass that stays inside the spine's own generated bounds, flanked by mountain on both sides", () => {
    let checkedRows = 0;
    for (let y = 15; y <= 48; y++) {
      const extent = spineExtentAtRow(y);
      if (!extent) continue;
      const [l, r] = extent;
      if (r - l < 6) continue; // skip the tapered/narrow ends — too thin to meaningfully flank a pass
      let gapFound = false;
      for (let x = l + 1; x < r; x++) {
        if (map.decor[y][x] === null) {
          gapFound = true;
          break;
        }
      }
      expect(gapFound).toBe(true);
      checkedRows++;
    }
    // The check actually exercised real rows, not silently skipping everything.
    expect(checkedRows).toBeGreaterThan(10);
  });

  it("keeps the town clear of the spine's generated west edge", () => {
    // Matches overworldMap.ts's three placeBuilding() footprints (x 5..19,
    // y 6..16) with a little margin; the spine's noisy west boundary must
    // never intrude into this box regardless of exactly where its per-row
    // noise lands.
    for (let y = 6; y <= 16; y++) {
      for (let x = 5; x <= 19; x++) {
        const d = map.decor[y][x];
        expect(d !== null && isMountainName(d)).toBe(false);
      }
    }
  });

  it("keeps the spine a genuinely organic (non-rectangular) silhouette", () => {
    // A hard rectangle has the SAME left/right extent on every full-width
    // row. Sample several rows well inside the spine's un-tapered middle
    // and confirm the boundary actually moves — this is what would catch
    // a regression back to the old hard-coded SPINE_X1/X2 rectangle.
    const lefts = new Set<number>();
    const rights = new Set<number>();
    for (const y of [15, 20, 25, 30, 35, 40, 45]) {
      const extent = spineExtentAtRow(y);
      if (!extent) continue;
      lefts.add(extent[0]);
      rights.add(extent[1]);
    }
    expect(lefts.size).toBeGreaterThan(1);
    expect(rights.size).toBeGreaterThan(1);
  });

  it("keeps the lake a genuinely organic (non-elliptical) silhouette", () => {
    // A perfect ellipse's boundary radius is a smooth, low-variance
    // function of angle; sample the lake's actual shore distance from its
    // nominal center at a handful of angles and confirm real variation
    // beyond what pure aspect-ratio scaling alone would produce.
    const isWaterCell = (x: number, y: number): boolean => {
      const g = map.ground[y]?.[x];
      return g === "water" || g === "water2" || (g?.startsWith("lakeShore") ?? false);
    };
    // crude shoreline radius sample: walk outward from a known-interior
    // lake cell along several directions until leaving water.
    const cx = 52;
    const cy = 47;
    expect(isWaterCell(cx, cy)).toBe(true); // sanity: still inside the lake
    const radii: number[] = [];
    for (const [dx, dy] of [
      [1, 0],
      [0.7, 0.7],
      [0, 1],
      [-0.7, 0.7],
      [-1, 0],
      [-0.7, -0.7],
      [0, -1],
      [0.7, -0.7]
    ] as const) {
      let r = 0;
      while (r < 20 && isWaterCell(Math.round(cx + dx * r), Math.round(cy + dy * r))) r++;
      radii.push(r);
    }
    const min = Math.min(...radii);
    const max = Math.max(...radii);
    // A hand-tuned ellipse would still show SOME spread from aspect ratio
    // alone, but nowhere near this: the noisy-radius blob's harmonics push
    // it well past a clean ellipse's smooth variation.
    expect(max - min).toBeGreaterThan(3);
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
