/**
 * Act 2 zone maps: dimensions, manifest tile-name validity (incl. tiles3),
 * determinism, enclosure-with-gates, and BFS reachability from each zone's
 * spawn to every gameplay landmark. Maze-specific guarantees: both
 * galleries exits reachable, the loop corridor really loops back to the
 * entry room, the two routes are disjoint (block either pinch and the
 * exits survive; block both and they don't), and every declared false
 * lead is a true cul-de-sac behind a single entrance tile.
 */
import { describe, expect, it } from "vitest";
import manifest from "../../src/assets/generated/manifest.json";
import { type ZoneMap, isSolidAt, mapSize } from "../../src/game/maps/types";
import {
  buildCrevasseMap,
  CREVASSE_CAMP,
  CREVASSE_CHASMS,
  CREVASSE_ENTRY_ROOM,
  CREVASSE_HEIGHT,
  CREVASSE_LOOP_MOUTH_A,
  CREVASSE_LOOP_MOUTH_B,
  CREVASSE_MAZE_RETURN_SPAWN,
  CREVASSE_MO,
  CREVASSE_MO_ENTRANCE,
  CREVASSE_SOUTH_EXIT,
  CREVASSE_SOUTH_GATES,
  CREVASSE_SPAWN,
  CREVASSE_WIDTH
} from "../../src/game/maps/crevasseMap";
import {
  buildMazeMap,
  MAZE_AMBUSH_ENTRANCE,
  MAZE_AMBUSH_RECT,
  MAZE_AMBUSH_SHARD,
  MAZE_BORDER_GATES,
  MAZE_DOOR,
  MAZE_DOOR_TRIGGER,
  MAZE_EAST_RETURN_SPAWN,
  MAZE_EDDA,
  MAZE_EDDA_ENTRANCE,
  MAZE_ENTRY_ROOM,
  MAZE_EXIT_EAST,
  MAZE_EXIT_NORTH,
  MAZE_EXIT_SOUTH,
  MAZE_HEIGHT,
  MAZE_LANTERNS,
  MAZE_LOOP_MOUTH_A,
  MAZE_LOOP_MOUTH_B,
  MAZE_PINCH_A,
  MAZE_PINCH_B,
  MAZE_ROOMS,
  MAZE_SHARD,
  MAZE_SHARD_ENTRANCE,
  MAZE_SOUTH_RETURN_SPAWN,
  MAZE_SPAWN,
  MAZE_WIDTH
} from "../../src/game/maps/mazeMap";
import {
  buildGalleriesMap,
  GALLERIES_BORDER_GATES,
  GALLERIES_DOOR_SPAWN,
  GALLERIES_DOOR_TILES,
  GALLERIES_DOOR_TRIGGER,
  GALLERIES_EXIT_EAST,
  GALLERIES_EXIT_NORTH,
  GALLERIES_EXIT_WEST,
  GALLERIES_GUS,
  GALLERIES_HEIGHT,
  GALLERIES_SPAWN_NORTH,
  GALLERIES_SPAWN_WEST,
  GALLERIES_WIDTH
} from "../../src/game/maps/galleriesMap";
import {
  buildSanctumMap,
  SANCTUM_APPROACH,
  SANCTUM_CRACK,
  SANCTUM_EXIT_WEST,
  SANCTUM_HEIGHT,
  SANCTUM_LAKE,
  SANCTUM_PENGUIN_START,
  SANCTUM_SPAWN,
  SANCTUM_TUNNEL,
  SANCTUM_WARDEN,
  SANCTUM_WEST_GATES,
  SANCTUM_WIDTH
} from "../../src/game/maps/sanctumMap";
import {
  buildSunlessSeaMap,
  SEA_CHASE_TRIGGER,
  SEA_FISHING,
  SEA_FLUFFBALL,
  SEA_FLUFFBALL_ENTRANCE,
  SEA_HEIGHT,
  SEA_SPAWN,
  SEA_TEMPLE,
  SEA_WIDTH
} from "../../src/game/maps/sunlessSeaMap";
import {
  buildMinersCampMap,
  CAMP_CRATE_TRIGGER,
  CAMP_EDDA,
  CAMP_FLUFFBALL,
  CAMP_GUS,
  CAMP_HEIGHT,
  CAMP_MO,
  CAMP_NEST,
  CAMP_NOOK_ENTRANCE,
  CAMP_SOCKS,
  CAMP_SPAWN,
  CAMP_WIDTH
} from "../../src/game/maps/minersCampMap";

const KNOWN_NAMES = new Set([
  ...Object.keys(manifest.tiles.names),
  ...Object.keys(manifest.tiles2.names),
  ...Object.keys(manifest.tiles3.names),
  ...Object.keys(manifest.tiles4.names),
  ...Object.keys(manifest.tiles5.names)
]);

interface Pt {
  x: number;
  y: number;
}

/** BFS over walkable (non-solid) tiles, 4-directional; extra solid cells optional. */
function reachable(map: ZoneMap, from: Pt, to: Pt, blocked: Pt[] = []): boolean {
  return bfsDistance(map, from, to, blocked) !== null;
}

/** BFS path length in tiles (null = unreachable). */
function bfsDistance(map: ZoneMap, from: Pt, to: Pt, blocked: Pt[] = []): number | null {
  const { width, height } = mapSize(map);
  const wall = new Set(blocked.map((b) => b.y * width + b.x));
  const solid = (x: number, y: number): boolean => wall.has(y * width + x) || isSolidAt(map, x, y);
  if (solid(from.x, from.y) || solid(to.x, to.y)) return null;
  const seen = new Set<number>([from.y * width + from.x]);
  const queue: Array<Pt & { d: number }> = [{ ...from, d: 0 }];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.x === to.x && cur.y === to.y) return cur.d;
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
      if (seen.has(key) || solid(nx, ny)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny, d: cur.d + 1 });
    }
  }
  return null;
}

function rectTile(rect: { x1: number; y1: number; x2: number; y2: number }): Pt {
  return { x: rect.x1, y: rect.y1 };
}

/** All cells of an inclusive rect. */
function rectCells(rect: { x1: number; y1: number; x2: number; y2: number }): Pt[] {
  const cells: Pt[] = [];
  for (let y = rect.y1; y <= rect.y2; y++) {
    for (let x = rect.x1; x <= rect.x2; x++) cells.push({ x, y });
  }
  return cells;
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
function assertEnclosed(map: ZoneMap, gates: readonly Pt[] = []): void {
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

function assertDimensions(map: ZoneMap, width: number, height: number): void {
  expect(mapSize(map)).toEqual({ width, height });
  expect(map.ground).toHaveLength(height);
  expect(map.decor).toHaveLength(height);
  for (const row of map.ground) expect(row).toHaveLength(width);
  for (const row of map.decor) expect(row).toHaveLength(width);
  for (const row of map.overhead ?? []) expect(row).toHaveLength(width);
}

/** True if p is inside the (inclusive) rect. */
function inRect(p: Pt, rect: { x1: number; y1: number; x2: number; y2: number }): boolean {
  return p.x >= rect.x1 && p.x <= rect.x2 && p.y >= rect.y1 && p.y <= rect.y2;
}

/** A dead end must be reachable, and sealed off by its single entrance tile. */
function assertCulDeSac(map: ZoneMap, spawn: Pt, inside: Pt, entrance: Pt): void {
  expect(reachable(map, spawn, inside)).toBe(true);
  expect(reachable(map, spawn, entrance)).toBe(true);
  expect(reachable(map, spawn, inside, [entrance])).toBe(false);
}

// ------------------------------------------------------------- crevasse

describe("crevasse map (The Crevasse)", () => {
  const map = buildCrevasseMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, CREVASSE_WIDTH, CREVASSE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildCrevasseMap()).toEqual(map);
  });

  it("is fully enclosed except the south gate down to the maze", () => {
    assertEnclosed(map, CREVASSE_SOUTH_GATES);
  });

  it("keeps spawn, camp spots, Mo, loop mouths and the exit walkable", () => {
    for (const p of [
      CREVASSE_SPAWN,
      CREVASSE_MAZE_RETURN_SPAWN,
      CREVASSE_CAMP.mo,
      CREVASSE_CAMP.edda,
      CREVASSE_CAMP.gus,
      CREVASSE_MO,
      CREVASSE_MO_ENTRANCE,
      CREVASSE_LOOP_MOUTH_A,
      CREVASSE_LOOP_MOUTH_B,
      rectTile(CREVASSE_SOUTH_EXIT)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player walk from spawn to Mo, the camp and the maze exit", () => {
    expect(reachable(map, CREVASSE_SPAWN, CREVASSE_MO)).toBe(true);
    expect(reachable(map, CREVASSE_SPAWN, CREVASSE_CAMP.mo)).toBe(true);
    expect(reachable(map, CREVASSE_SPAWN, rectTile(CREVASSE_SOUTH_EXIT))).toBe(true);
    expect(reachable(map, CREVASSE_SPAWN, CREVASSE_MAZE_RETURN_SPAWN)).toBe(true);
  });

  it("has a loop corridor whose two mouths both open into the entry room", () => {
    for (const mouth of [CREVASSE_LOOP_MOUTH_A, CREVASSE_LOOP_MOUTH_B]) {
      expect(isSolidAt(map, mouth.x, mouth.y)).toBe(false);
      const neighbors = [
        { x: mouth.x + 1, y: mouth.y },
        { x: mouth.x - 1, y: mouth.y },
        { x: mouth.x, y: mouth.y + 1 },
        { x: mouth.x, y: mouth.y - 1 }
      ];
      const opensIntoRoom = neighbors.some(
        (n) => inRect(n, CREVASSE_ENTRY_ROOM) && !isSolidAt(map, n.x, n.y)
      );
      expect(opensIntoRoom).toBe(true);
    }
    // The corridor itself connects mouth to mouth WITHOUT crossing the room.
    const roomCells = rectCells(CREVASSE_ENTRY_ROOM);
    expect(reachable(map, CREVASSE_LOOP_MOUTH_A, CREVASSE_LOOP_MOUTH_B, roomCells)).toBe(true);
  });

  it("keeps Mo's pocket a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, CREVASSE_SPAWN, CREVASSE_MO, CREVASSE_MO_ENTRANCE);
  });

  it("studs the lower hall with chasm hazards the player can walk around", () => {
    for (const c of CREVASSE_CHASMS) {
      expect(map.decor[c.y][c.x]).toBe("chasm");
      expect(isSolidAt(map, c.x, c.y)).toBe(true);
    }
    expect(reachable(map, CREVASSE_SPAWN, rectTile(CREVASSE_SOUTH_EXIT))).toBe(true);
  });
});

// ----------------------------------------------------------------- maze

describe("maze map (The Ice Maze)", () => {
  const map = buildMazeMap();
  const eastExit = rectTile(MAZE_EXIT_EAST);
  const southExit = rectTile(MAZE_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, MAZE_WIDTH, MAZE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildMazeMap()).toEqual(map);
  });

  it("is fully enclosed except its three declared gates", () => {
    assertEnclosed(map, MAZE_BORDER_GATES);
  });

  it("keeps spawn, spawn-backs and every landmark walkable", () => {
    for (const p of [
      MAZE_SPAWN,
      MAZE_EAST_RETURN_SPAWN,
      MAZE_SOUTH_RETURN_SPAWN,
      MAZE_PINCH_A,
      MAZE_PINCH_B,
      MAZE_LOOP_MOUTH_A,
      MAZE_LOOP_MOUTH_B,
      MAZE_SHARD,
      MAZE_SHARD_ENTRANCE,
      MAZE_EDDA,
      MAZE_EDDA_ENTRANCE,
      MAZE_AMBUSH_SHARD,
      MAZE_AMBUSH_ENTRANCE,
      rectTile(MAZE_EXIT_NORTH),
      eastExit,
      southExit
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("has at least six rooms, all reachable from the spawn", () => {
    expect(MAZE_ROOMS.length).toBeGreaterThanOrEqual(6);
    for (const room of MAZE_ROOMS) {
      const center = {
        x: Math.floor((room.x1 + room.x2) / 2),
        y: Math.floor((room.y1 + room.y2) / 2)
      };
      expect(reachable(map, MAZE_SPAWN, center)).toBe(true);
    }
  });

  it("reaches both galleries exits and the crevasse stub from the spawn", () => {
    expect(reachable(map, MAZE_SPAWN, eastExit)).toBe(true);
    expect(reachable(map, MAZE_SPAWN, southExit)).toBe(true);
    expect(reachable(map, MAZE_SPAWN, rectTile(MAZE_EXIT_NORTH))).toBe(true);
  });

  it("has a loop corridor whose two mouths both open into the entry room", () => {
    for (const mouth of [MAZE_LOOP_MOUTH_A, MAZE_LOOP_MOUTH_B]) {
      expect(isSolidAt(map, mouth.x, mouth.y)).toBe(false);
      const neighbors = [
        { x: mouth.x + 1, y: mouth.y },
        { x: mouth.x - 1, y: mouth.y },
        { x: mouth.x, y: mouth.y + 1 },
        { x: mouth.x, y: mouth.y - 1 }
      ];
      const opensIntoRoom = neighbors.some(
        (n) => inRect(n, MAZE_ENTRY_ROOM) && !isSolidAt(map, n.x, n.y)
      );
      expect(opensIntoRoom).toBe(true);
    }
    // The loop connects its mouths WITHOUT passing through the entry room.
    const roomCells = rectCells(MAZE_ENTRY_ROOM);
    expect(reachable(map, MAZE_LOOP_MOUTH_A, MAZE_LOOP_MOUTH_B, roomCells)).toBe(true);
  });

  it("still reaches both exits with route A pinched shut", () => {
    expect(reachable(map, MAZE_SPAWN, eastExit, [MAZE_PINCH_A])).toBe(true);
    expect(reachable(map, MAZE_SPAWN, southExit, [MAZE_PINCH_A])).toBe(true);
  });

  it("still reaches both exits with route B pinched shut", () => {
    expect(reachable(map, MAZE_SPAWN, eastExit, [MAZE_PINCH_B])).toBe(true);
    expect(reachable(map, MAZE_SPAWN, southExit, [MAZE_PINCH_B])).toBe(true);
  });

  it("loses both exits when BOTH route pinches are shut (routes are disjoint)", () => {
    const both = [MAZE_PINCH_A, MAZE_PINCH_B];
    expect(reachable(map, MAZE_SPAWN, eastExit, both)).toBe(false);
    expect(reachable(map, MAZE_SPAWN, southExit, both)).toBe(false);
  });

  it("keeps the shard cache a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, MAZE_SPAWN, MAZE_SHARD, MAZE_SHARD_ENTRANCE);
  });

  it("keeps Edda's pocket a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, MAZE_SPAWN, MAZE_EDDA, MAZE_EDDA_ENTRANCE);
  });

  it("keeps the ambush pocket a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, MAZE_SPAWN, MAZE_AMBUSH_SHARD, MAZE_AMBUSH_ENTRANCE);
    for (const c of rectCells(MAZE_AMBUSH_RECT)) {
      expect(isSolidAt(map, c.x, c.y)).toBe(false);
    }
  });

  it("seals the shortcut crack with a rime door that meaningfully shortens the way", () => {
    expect(map.decor[MAZE_DOOR.y][MAZE_DOOR.x]).toBe("doorRime");
    expect(isSolidAt(map, MAZE_DOOR.x, MAZE_DOOR.y)).toBe(true);
    // Both approach tiles are walkable and reachable (either side of the crack).
    const north = { x: MAZE_DOOR_TRIGGER.x1, y: MAZE_DOOR_TRIGGER.y1 };
    const south = { x: MAZE_DOOR_TRIGGER.x2, y: MAZE_DOOR_TRIGGER.y2 };
    expect(reachable(map, MAZE_SPAWN, north)).toBe(true);
    expect(reachable(map, MAZE_SPAWN, south)).toBe(true);
    // Opening the door creates a much shorter road between the two sides.
    const opened: ZoneMap = { ...map, decor: map.decor.map((row) => [...row]) };
    opened.decor[MAZE_DOOR.y][MAZE_DOOR.x] = null;
    const closedDist = bfsDistance(map, north, south)!;
    const openDist = bfsDistance(opened, north, south)!;
    expect(openDist).toBe(2);
    expect(closedDist).toBeGreaterThan(openDist + 10);
  });

  it("lights the junctions with lantern posts", () => {
    expect(MAZE_LANTERNS.length).toBeGreaterThanOrEqual(5);
    for (const l of MAZE_LANTERNS) {
      expect(map.decor[l.y][l.x]).toBe("lanternPost");
      expect(isSolidAt(map, l.x, l.y)).toBe(true);
    }
  });
});

// ------------------------------------------------------------ galleries

describe("galleries map (The Galleries)", () => {
  const map = buildGalleriesMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, GALLERIES_WIDTH, GALLERIES_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildGalleriesMap()).toEqual(map);
  });

  it("is fully enclosed except its three declared gates", () => {
    assertEnclosed(map, GALLERIES_BORDER_GATES);
  });

  it("keeps both maze spawns, Gus, the door approach and all exits walkable", () => {
    for (const p of [
      GALLERIES_SPAWN_WEST,
      GALLERIES_SPAWN_NORTH,
      GALLERIES_DOOR_SPAWN,
      GALLERIES_GUS,
      rectTile(GALLERIES_DOOR_TRIGGER),
      { x: GALLERIES_DOOR_TRIGGER.x2, y: GALLERIES_DOOR_TRIGGER.y2 },
      rectTile(GALLERIES_EXIT_WEST),
      rectTile(GALLERIES_EXIT_NORTH),
      rectTile(GALLERIES_EXIT_EAST)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("connects both maze entrances to each other, Gus and the rime door", () => {
    expect(reachable(map, GALLERIES_SPAWN_WEST, GALLERIES_SPAWN_NORTH)).toBe(true);
    expect(reachable(map, GALLERIES_SPAWN_WEST, GALLERIES_GUS)).toBe(true);
    expect(reachable(map, GALLERIES_SPAWN_WEST, rectTile(GALLERIES_DOOR_TRIGGER))).toBe(true);
    expect(reachable(map, GALLERIES_SPAWN_WEST, rectTile(GALLERIES_EXIT_WEST))).toBe(true);
    expect(reachable(map, GALLERIES_SPAWN_NORTH, rectTile(GALLERIES_EXIT_NORTH))).toBe(true);
  });

  it("seals the sanctum exit behind the rime door until its tiles open", () => {
    for (const d of GALLERIES_DOOR_TILES) {
      expect(map.decor[d.y][d.x]).toBe("doorRime");
      expect(isSolidAt(map, d.x, d.y)).toBe(true);
    }
    expect(reachable(map, GALLERIES_SPAWN_WEST, rectTile(GALLERIES_EXIT_EAST))).toBe(false);
    const opened: ZoneMap = { ...map, decor: map.decor.map((row) => [...row]) };
    for (const d of GALLERIES_DOOR_TILES) opened.decor[d.y][d.x] = null;
    expect(reachable(opened, GALLERIES_SPAWN_WEST, rectTile(GALLERIES_EXIT_EAST))).toBe(true);
    expect(reachable(opened, GALLERIES_SPAWN_WEST, GALLERIES_DOOR_SPAWN)).toBe(true);
  });

  it("reads as frozen-over mine workings (mine and ice tiles mixed)", () => {
    const decorFlat = map.decor.flat();
    expect(decorFlat).toContain("mineWall");
    expect(decorFlat).toContain("mineTimber");
    expect(decorFlat).toContain("rail");
    expect(decorFlat).toContain("cart");
    expect(decorFlat).toContain("iceWallDeep");
    const groundFlat = map.ground.flat();
    expect(groundFlat).toContain("mineFloor");
    expect(groundFlat).toContain("iceFloor");
  });
});

// -------------------------------------------------------------- sanctum

describe("sanctum map (The Sanctum)", () => {
  const map = buildSanctumMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, SANCTUM_WIDTH, SANCTUM_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildSanctumMap()).toEqual(map);
  });

  it("is fully enclosed except the west gate back to the galleries", () => {
    assertEnclosed(map, SANCTUM_WEST_GATES);
  });

  it("keeps spawn, the warden, the approach, the tunnel and the exit walkable", () => {
    for (const p of [
      SANCTUM_SPAWN,
      SANCTUM_WARDEN,
      SANCTUM_TUNNEL,
      SANCTUM_PENGUIN_START.piggy,
      SANCTUM_PENGUIN_START.fluffball,
      rectTile(SANCTUM_EXIT_WEST)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
    for (const c of rectCells(SANCTUM_APPROACH)) {
      expect(isSolidAt(map, c.x, c.y)).toBe(false);
    }
  });

  it("lets the player cross from spawn to the warden, the tunnel and back out", () => {
    expect(reachable(map, SANCTUM_SPAWN, SANCTUM_WARDEN)).toBe(true);
    expect(reachable(map, SANCTUM_SPAWN, SANCTUM_TUNNEL)).toBe(true);
    expect(reachable(map, SANCTUM_SPAWN, rectTile(SANCTUM_EXIT_WEST))).toBe(true);
  });

  it("spreads a lakeIce field with the crack line entirely on the lake", () => {
    const lakeArea =
      (SANCTUM_LAKE.x2 - SANCTUM_LAKE.x1 + 1) * (SANCTUM_LAKE.y2 - SANCTUM_LAKE.y1 + 1);
    expect(map.ground.flat().filter((c) => c === "lakeIce")).toHaveLength(lakeArea);
    expect(lakeArea).toBeGreaterThanOrEqual(100);
    expect(SANCTUM_CRACK.length).toBeGreaterThanOrEqual(12);
    for (const c of SANCTUM_CRACK) {
      expect(map.ground[c.y][c.x]).toBe("lakeIce");
      expect(isSolidAt(map, c.x, c.y)).toBe(false);
    }
    expect(map.ground[SANCTUM_WARDEN.y][SANCTUM_WARDEN.x]).toBe("lakeIce");
  });
});

// ----------------------------------------------------- sunless sea (Act 3)

describe("sunless sea map (The Sunless Sea)", () => {
  const map = buildSunlessSeaMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, SEA_WIDTH, SEA_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets (incl. tiles4)", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildSunlessSeaMap()).toEqual(map);
  });

  it("is fully enclosed by solid water on every border (no exits — end card)", () => {
    assertEnclosed(map);
  });

  it("keeps spawn and every landmark walkable", () => {
    for (const p of [
      SEA_SPAWN,
      SEA_FLUFFBALL,
      SEA_FLUFFBALL_ENTRANCE,
      SEA_TEMPLE,
      SEA_FISHING,
      rectTile(SEA_CHASE_TRIGGER)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player hop the floes from spawn to every beat", () => {
    expect(reachable(map, SEA_SPAWN, SEA_FLUFFBALL)).toBe(true);
    expect(reachable(map, SEA_SPAWN, SEA_TEMPLE)).toBe(true);
    expect(reachable(map, SEA_SPAWN, SEA_FISHING)).toBe(true);
    expect(reachable(map, SEA_SPAWN, rectTile(SEA_CHASE_TRIGGER))).toBe(true);
  });

  it("makes Fluffball's kelp bed a true cul-de-sac behind one entrance tile", () => {
    assertCulDeSac(map, SEA_SPAWN, SEA_FLUFFBALL, SEA_FLUFFBALL_ENTRANCE);
  });

  it("threads a narrow floe path — most of the sea is solid dark water", () => {
    let walkable = 0;
    for (let y = 0; y < SEA_HEIGHT; y++) {
      for (let x = 0; x < SEA_WIDTH; x++) if (!isSolidAt(map, x, y)) walkable++;
    }
    // Floe paths through solid water read as hop-corridors, not open ocean.
    expect(walkable).toBeLessThan((SEA_WIDTH * SEA_HEIGHT) / 2);
  });

  it("gives a second (loop) route from the hub to the deep bed via the reef", () => {
    // Blocking the east corridor's mouth alone must NOT cut off the fishing
    // spot — the reef offers an alternate way round.
    expect(reachable(map, SEA_SPAWN, SEA_FISHING, [{ x: 28, y: 13 }])).toBe(true);
  });

  it("builds the themed floors: floe path, kelp beds, temple, reef, bubbles", () => {
    const g = map.ground.flat();
    expect(g).toContain("floe");
    expect(g).toContain("kelpBed");
    expect(g).toContain("templeFloor");
    expect(g).toContain("templeGlyph");
    expect(g).toContain("reefGlow");
    expect(g).toContain("seaWater");
    // Solid sea decor and rising bubbles overhead.
    const d = map.decor.flat();
    expect(d).toContain("kelpStalk");
    expect(d).toContain("templePillar");
    expect(map.overhead?.flat()).toContain("bubbles");
    expect(map.decor[SEA_TEMPLE.y][SEA_TEMPLE.x]).toBe(null); // glyph is a ground tile
    expect(map.ground[SEA_TEMPLE.y][SEA_TEMPLE.x]).toBe("templeGlyph");
  });
});

// -------------------------------------------------- miners' camp (Act 4)

describe("miners' camp map (The Miners' Camp)", () => {
  const map = buildMinersCampMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, CAMP_WIDTH, CAMP_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets (incl. tiles5)", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildMinersCampMap()).toEqual(map);
  });

  it("is fully enclosed by camp wall on every border (no exits — end card)", () => {
    assertEnclosed(map);
  });

  it("keeps the spawn and every landmark walkable", () => {
    for (const p of [
      CAMP_SPAWN,
      CAMP_MO,
      CAMP_EDDA,
      CAMP_GUS,
      CAMP_NEST,
      CAMP_SOCKS,
      CAMP_NOOK_ENTRANCE,
      CAMP_FLUFFBALL,
      rectTile(CAMP_CRATE_TRIGGER)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach every beat from the spawn", () => {
    expect(reachable(map, CAMP_SPAWN, CAMP_MO)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, CAMP_EDDA)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, CAMP_GUS)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, CAMP_FLUFFBALL)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, rectTile(CAMP_CRATE_TRIGGER))).toBe(true);
    expect(reachable(map, CAMP_SPAWN, CAMP_NEST)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, CAMP_SOCKS)).toBe(true);
  });

  it("seals the laundry nook (nest + socks) as a cul-de-sac behind one entrance", () => {
    assertCulDeSac(map, CAMP_SPAWN, CAMP_NEST, CAMP_NOOK_ENTRANCE);
    // The sock line is inside the same sealed nook.
    expect(reachable(map, CAMP_SPAWN, CAMP_SOCKS, [CAMP_NOOK_ENTRANCE])).toBe(false);
  });

  it("builds the camp: warm floor, a walled nook, string lights and laundry overhead", () => {
    const g = map.ground.flat();
    expect(g).toContain("campFloor");
    expect(g).toContain("campRug");
    const d = map.decor.flat();
    expect(d).toContain("campWall");
    expect(d).toContain("crateStack");
    expect(d).toContain("stove");
    expect(d).toContain("washtub");
    expect(d).toContain("sockBasket");
    const o = map.overhead?.flat() ?? [];
    expect(o).toContain("stringLights");
    expect(o).toContain("laundryLine");
    // The sock basket marks the sock line and stays walkable.
    expect(map.decor[CAMP_SOCKS.y][CAMP_SOCKS.x]).toBe("sockBasket");
    expect(isSolidAt(map, CAMP_SOCKS.x, CAMP_SOCKS.y)).toBe(false);
  });

  it("keeps the overhead camp decor non-solid (never blocks movement)", () => {
    for (let y = 0; y < CAMP_HEIGHT; y++) {
      for (let x = 0; x < CAMP_WIDTH; x++) {
        const o = map.overhead?.[y]?.[x];
        if (o) expect(isSolidAt(map, x, y)).toBe(false);
      }
    }
  });
});
