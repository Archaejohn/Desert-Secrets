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
  SEA_EXIT_SOUTH,
  SEA_HEIGHT,
  SEA_KELP_RETURN_SPAWN,
  SEA_SOUTH_GATES,
  SEA_SPAWN,
  SEA_WIDTH
} from "../../src/game/maps/sunlessSeaMap";
import {
  buildKelpForestMap,
  KELP_BORDER_GATES,
  KELP_DEEP_RETURN_SPAWN,
  KELP_EXIT_EAST,
  KELP_EXIT_NORTH,
  KELP_EXIT_SOUTH,
  KELP_EXIT_WEST,
  KELP_FALSE_ENTRANCE,
  KELP_FALSE_LEAD,
  KELP_FLUFF_ENTRANCE,
  KELP_FLUFF_RETURN_SPAWN,
  KELP_HEIGHT,
  KELP_PINCH_A,
  KELP_PINCH_B,
  KELP_SPAWN,
  KELP_TEMPLE_ENTRANCE,
  KELP_TEMPLE_RETURN_SPAWN,
  KELP_WIDTH
} from "../../src/game/maps/kelpForestMap";
import {
  buildSunTempleMap,
  SUNTEMPLE_EAST_GATES,
  SUNTEMPLE_EXIT_EAST,
  SUNTEMPLE_GLYPH,
  SUNTEMPLE_HEIGHT,
  SUNTEMPLE_SANCTUM,
  SUNTEMPLE_SPAWN,
  SUNTEMPLE_WIDTH
} from "../../src/game/maps/sunTempleMap";
import {
  buildFluffballBedMap,
  FLUFFBED_EXIT_NORTH,
  FLUFFBED_FLUFFBALL,
  FLUFFBED_HEIGHT,
  FLUFFBED_NORTH_GATES,
  FLUFFBED_SPAWN,
  FLUFFBED_TRIGGER,
  FLUFFBED_WIDTH
} from "../../src/game/maps/fluffballBedMap";
import {
  buildDeepBedMap,
  DEEP_EXIT_WEST,
  DEEP_FAR,
  DEEP_FISHING,
  DEEP_HEIGHT,
  DEEP_SPAWN,
  DEEP_WEST_GATES,
  DEEP_WIDTH
} from "../../src/game/maps/deepBedMap";
import {
  buildSeaAscentMap,
  ASCENT_EXIT_TOP,
  ASCENT_HEIGHT,
  ASCENT_LEDGE,
  ASCENT_SPAWN,
  ASCENT_TOP_GATES,
  ASCENT_TRIGGER,
  ASCENT_WIDTH
} from "../../src/game/maps/seaAscentMap";
import {
  buildMinersCampMap,
  CAMP_BOOT,
  CAMP_EXIT_SOUTH,
  CAMP_HEIGHT,
  CAMP_SOUTH_GATES,
  CAMP_SPAWN,
  CAMP_WIDTH
} from "../../src/game/maps/minersCampMap";
import {
  buildCampProperMap,
  CAMPP_BORDER_GATES,
  CAMPP_CRATE_TRIGGER,
  CAMPP_EDDA,
  CAMPP_EXIT_EAST,
  CAMPP_EXIT_NORTH,
  CAMPP_EXIT_WEST,
  CAMPP_GUS,
  CAMPP_HEIGHT,
  CAMPP_MO,
  CAMPP_SOCKS,
  CAMPP_SPAWN,
  CAMPP_WIDTH
} from "../../src/game/maps/campProperMap";
import {
  buildLaundryNookMap,
  NOOK_EAST_GATES,
  NOOK_EXIT_EAST,
  NOOK_HEIGHT,
  NOOK_NEST,
  NOOK_SPAWN,
  NOOK_WIDTH
} from "../../src/game/maps/laundryNookMap";
import {
  buildCampGalleryMap,
  GALLERY_BORDER_GATES,
  GALLERY_EXIT_NORTH,
  GALLERY_EXIT_SOUTH,
  GALLERY_HEIGHT,
  GALLERY_SPAWN,
  GALLERY_TRACKS,
  GALLERY_WIDTH
} from "../../src/game/maps/campGalleryMap";
import {
  buildCampLedgeMap,
  LEDGE_EXIT_SOUTH,
  LEDGE_FLUFFBALL,
  LEDGE_HEIGHT,
  LEDGE_SOUTH_GATES,
  LEDGE_SPAWN,
  LEDGE_TRIGGER,
  LEDGE_WIDTH
} from "../../src/game/maps/campLedgeMap";

import {
  buildGroveDescentMap,
  DESCENT_EXIT_SOUTH,
  DESCENT_HEIGHT,
  DESCENT_RETURN_SPAWN,
  DESCENT_SOUTH_GATES,
  DESCENT_SPAWN,
  DESCENT_WIDTH
} from "../../src/game/maps/groveDescentMap";
import {
  APPROACH_BORDER_GATES,
  APPROACH_CHASE_TRIGGER,
  APPROACH_EXIT_NORTH,
  APPROACH_EXIT_SOUTH,
  APPROACH_HEIGHT,
  APPROACH_NEEDLE,
  APPROACH_OLD_ROW,
  APPROACH_RETURN_SPAWN,
  APPROACH_SPAWN,
  APPROACH_WIDTH,
  buildGroveApproachMap
} from "../../src/game/maps/groveApproachMap";
import {
  buildGroveGrottoMap,
  GROTTO_BORDER_GATES,
  GROTTO_EXIT_NORTH,
  GROTTO_EXIT_SOUTH,
  GROTTO_HEIGHT,
  GROTTO_POOL,
  GROTTO_RETURN_SPAWN,
  GROTTO_SPAWN,
  GROTTO_WIDTH
} from "../../src/game/maps/groveGrottoMap";
import {
  buildGroveChamberMap,
  CHAMBER_BORDER_GATES,
  CHAMBER_EXIT_EAST,
  CHAMBER_EXIT_NORTH,
  CHAMBER_HEIGHT,
  CHAMBER_JOIN_TRIGGER,
  CHAMBER_RETURN_SPAWN,
  CHAMBER_SPAWN,
  CHAMBER_TREE,
  CHAMBER_WIDTH
} from "../../src/game/maps/groveChamberMap";
import {
  buildSahraGroveMap,
  SAHRA_EXIT_WEST,
  SAHRA_HEIGHT,
  SAHRA_NPC,
  SAHRA_OLD_ROW,
  SAHRA_SPAWN,
  SAHRA_WEST_GATES,
  SAHRA_WIDTH
} from "../../src/game/maps/sahraGroveMap";
import {
  buildReefDescentMap,
  REEF_D_EXIT_SOUTH,
  REEF_D_HEIGHT,
  REEF_D_RETURN_SPAWN,
  REEF_D_SOUTH_GATES,
  REEF_D_SPAWN,
  REEF_D_WIDTH
} from "../../src/game/maps/reefDescentMap";
import {
  buildReefGardenMap,
  REEF_G_BORDER_GATES,
  REEF_G_EXIT_NORTH,
  REEF_G_EXIT_SOUTH,
  REEF_G_HEIGHT,
  REEF_G_MINT_ROW,
  REEF_G_RETURN_SPAWN,
  REEF_G_SPAWN,
  REEF_G_WIDTH
} from "../../src/game/maps/reefGardenMap";
import {
  buildReefWarrenMap,
  REEF_W_ALCOVE_ENTRANCE,
  REEF_W_BORDER_GATES,
  REEF_W_CHASE_TRIGGER,
  REEF_W_CORNER,
  REEF_W_EXIT_NORTH,
  REEF_W_EXIT_SOUTH,
  REEF_W_HEIGHT,
  REEF_W_RETURN_SPAWN,
  REEF_W_SPAWN,
  REEF_W_WIDTH
} from "../../src/game/maps/reefWarrenMap";
import {
  buildReefHollowMap,
  REEF_H_BORDER_GATES,
  REEF_H_EXIT_NORTH,
  REEF_H_EXIT_SOUTH,
  REEF_H_HEIGHT,
  REEF_H_POOL,
  REEF_H_RETURN_SPAWN,
  REEF_H_SPAWN,
  REEF_H_WIDTH
} from "../../src/game/maps/reefHollowMap";
import {
  buildReefCourtMap,
  REEF_C_EXIT_NORTH,
  REEF_C_HEIGHT,
  REEF_C_NORTH_GATES,
  REEF_C_NPC,
  REEF_C_OLD_ROW,
  REEF_C_SPAWN,
  REEF_C_WIDTH
} from "../../src/game/maps/reefCourtMap";

const KNOWN_NAMES = new Set([
  ...Object.keys(manifest.tiles.names),
  ...Object.keys(manifest.tiles2.names),
  ...Object.keys(manifest.tiles3.names),
  ...Object.keys(manifest.tiles4.names),
  ...Object.keys(manifest.tiles5.names),
  ...Object.keys(manifest.tiles6.names),
  ...Object.keys(manifest.tiles7.names)
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

// ------------------------------------------ sunless sea entry (Act 3, zone 1)

describe("sunless sea map (entry overlook)", () => {
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

  it("is fully enclosed by solid water except the south gate on to the kelp forest", () => {
    assertEnclosed(map, SEA_SOUTH_GATES);
  });

  it("keeps spawn, the return spawn, the chase and the exit walkable", () => {
    for (const p of [
      SEA_SPAWN,
      SEA_KELP_RETURN_SPAWN,
      rectTile(SEA_CHASE_TRIGGER),
      rectTile(SEA_EXIT_SOUTH)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player descend from spawn past the chase to the south gate", () => {
    expect(reachable(map, SEA_SPAWN, rectTile(SEA_CHASE_TRIGGER))).toBe(true);
    expect(reachable(map, SEA_SPAWN, rectTile(SEA_EXIT_SOUTH))).toBe(true);
  });

  it("threads a narrow floe path — most of the overlook is solid dark water", () => {
    let walkable = 0;
    for (let y = 0; y < SEA_HEIGHT; y++) {
      for (let x = 0; x < SEA_WIDTH; x++) if (!isSolidAt(map, x, y)) walkable++;
    }
    expect(walkable).toBeLessThan((SEA_WIDTH * SEA_HEIGHT) / 2);
  });
});

// --------------------------------------------- kelp forest (Act 3, zone 2)

describe("kelp forest map (the traversal fork)", () => {
  const map = buildKelpForestMap();
  const eastExit = rectTile(KELP_EXIT_EAST);

  it("has the declared dimensions", () => {
    assertDimensions(map, KELP_WIDTH, KELP_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildKelpForestMap()).toEqual(map);
  });

  it("is fully enclosed except its four declared gates", () => {
    assertEnclosed(map, KELP_BORDER_GATES);
  });

  it("keeps spawn, spawn-backs, pinches, entrances and every exit walkable", () => {
    for (const p of [
      KELP_SPAWN,
      KELP_TEMPLE_RETURN_SPAWN,
      KELP_FLUFF_RETURN_SPAWN,
      KELP_DEEP_RETURN_SPAWN,
      KELP_PINCH_A,
      KELP_PINCH_B,
      KELP_TEMPLE_ENTRANCE,
      KELP_FLUFF_ENTRANCE,
      KELP_FALSE_ENTRANCE,
      KELP_FALSE_LEAD,
      rectTile(KELP_EXIT_NORTH),
      rectTile(KELP_EXIT_WEST),
      rectTile(KELP_EXIT_SOUTH),
      eastExit
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("reaches all four gates from the spawn", () => {
    expect(reachable(map, KELP_SPAWN, rectTile(KELP_EXIT_NORTH))).toBe(true);
    expect(reachable(map, KELP_SPAWN, rectTile(KELP_EXIT_WEST))).toBe(true);
    expect(reachable(map, KELP_SPAWN, rectTile(KELP_EXIT_SOUTH))).toBe(true);
    expect(reachable(map, KELP_SPAWN, eastExit)).toBe(true);
  });

  it("offers a true fork east: both routes reach the deep bed, either pinch survives", () => {
    expect(reachable(map, KELP_SPAWN, eastExit, [KELP_PINCH_A])).toBe(true);
    expect(reachable(map, KELP_SPAWN, eastExit, [KELP_PINCH_B])).toBe(true);
  });

  it("loses the deep-bed exit only when BOTH route pinches are shut (routes disjoint)", () => {
    expect(reachable(map, KELP_SPAWN, eastExit, [KELP_PINCH_A, KELP_PINCH_B])).toBe(false);
  });

  it("keeps the temple spur a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, KELP_SPAWN, rectTile(KELP_EXIT_WEST), KELP_TEMPLE_ENTRANCE);
  });

  it("keeps the Fluffball spur a true cul-de-sac behind its entrance tile", () => {
    assertCulDeSac(map, KELP_SPAWN, rectTile(KELP_EXIT_SOUTH), KELP_FLUFF_ENTRANCE);
  });

  it("keeps the false-lead alcove a true dead end behind its entrance tile", () => {
    assertCulDeSac(map, KELP_SPAWN, KELP_FALSE_LEAD, KELP_FALSE_ENTRANCE);
  });
});

// ------------------------------------------ sun-temple ruin (Act 3, zone 3)

describe("sun-temple map (a dead-end pocket)", () => {
  const map = buildSunTempleMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, SUNTEMPLE_WIDTH, SUNTEMPLE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildSunTempleMap()).toEqual(map);
  });

  it("is fully enclosed except the east gate back to the kelp forest", () => {
    assertEnclosed(map, SUNTEMPLE_EAST_GATES);
  });

  it("keeps spawn, the glyph, the inner sanctum and the exit walkable", () => {
    for (const p of [SUNTEMPLE_SPAWN, SUNTEMPLE_GLYPH, SUNTEMPLE_SANCTUM, rectTile(SUNTEMPLE_EXIT_EAST)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player explore in to the glyph and the sanctum and back out", () => {
    expect(reachable(map, SUNTEMPLE_SPAWN, SUNTEMPLE_GLYPH)).toBe(true);
    expect(reachable(map, SUNTEMPLE_SPAWN, SUNTEMPLE_SANCTUM)).toBe(true);
    expect(reachable(map, SUNTEMPLE_SPAWN, rectTile(SUNTEMPLE_EXIT_EAST))).toBe(true);
  });

  it("carves the sun-glyph as a ground tile amid drowned pillars", () => {
    expect(map.ground[SUNTEMPLE_GLYPH.y][SUNTEMPLE_GLYPH.x]).toBe("templeGlyph");
    expect(map.ground.flat()).toContain("templeFloor");
    expect(map.decor.flat()).toContain("templePillar");
  });
});

// ------------------------------------- Fluffball's kelp bed (Act 3, zone 4)

describe("fluffball bed map (a dead-end pocket)", () => {
  const map = buildFluffballBedMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, FLUFFBED_WIDTH, FLUFFBED_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildFluffballBedMap()).toEqual(map);
  });

  it("is fully enclosed except the north gate back to the kelp forest", () => {
    assertEnclosed(map, FLUFFBED_NORTH_GATES);
  });

  it("keeps spawn, Fluffball's spot, the glimpse trigger and the exit walkable", () => {
    for (const p of [
      FLUFFBED_SPAWN,
      FLUFFBED_FLUFFBALL,
      rectTile(FLUFFBED_TRIGGER),
      rectTile(FLUFFBED_EXIT_NORTH)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach Fluffball and the exit from the spawn", () => {
    expect(reachable(map, FLUFFBED_SPAWN, FLUFFBED_FLUFFBALL)).toBe(true);
    expect(reachable(map, FLUFFBED_SPAWN, rectTile(FLUFFBED_EXIT_NORTH))).toBe(true);
  });
});

// -------------------------------------------- deep kelp bed (Act 3, zone 5)

describe("deep bed map (the fishing climax)", () => {
  const map = buildDeepBedMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, DEEP_WIDTH, DEEP_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildDeepBedMap()).toEqual(map);
  });

  it("is fully enclosed except the west gate back to the kelp forest", () => {
    assertEnclosed(map, DEEP_WEST_GATES);
  });

  it("keeps spawn, the fishing spot, the far corner and the exit walkable", () => {
    for (const p of [DEEP_SPAWN, DEEP_FISHING, DEEP_FAR, rectTile(DEEP_EXIT_WEST)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach the fishing spot, the far corner and the exit", () => {
    expect(reachable(map, DEEP_SPAWN, DEEP_FISHING)).toBe(true);
    expect(reachable(map, DEEP_SPAWN, DEEP_FAR)).toBe(true);
    expect(reachable(map, DEEP_SPAWN, rectTile(DEEP_EXIT_WEST))).toBe(true);
  });

  it("reads as deep water: kelp, reef glow and rising bubbles", () => {
    const g = map.ground.flat();
    expect(g).toContain("kelpBed");
    expect(g).toContain("reefGlow");
    expect(g).toContain("seaWater");
    expect(map.overhead?.flat()).toContain("bubbles");
  });
});

// ----------------------------------------------- the ascent (Act 3, zone 6)

describe("sea ascent map (the climb out to Act 4)", () => {
  const map = buildSeaAscentMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, ASCENT_WIDTH, ASCENT_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildSeaAscentMap()).toEqual(map);
  });

  it("is fully enclosed except the top gate up to the miners' camp", () => {
    assertEnclosed(map, ASCENT_TOP_GATES);
  });

  it("keeps the foot spawn, the ledge, the climb trigger and the top gate walkable", () => {
    for (const p of [ASCENT_SPAWN, ASCENT_LEDGE, rectTile(ASCENT_TRIGGER), rectTile(ASCENT_EXIT_TOP)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the party climb from the foot up past the ledge to the top gate", () => {
    expect(reachable(map, ASCENT_SPAWN, ASCENT_LEDGE)).toBe(true);
    expect(reachable(map, ASCENT_SPAWN, rectTile(ASCENT_EXIT_TOP))).toBe(true);
  });
});

// ---------------------------------- camp outskirts (Act 4, zone 1: entry)

describe("camp outskirts map (the Act 4 entry from the ascent)", () => {
  const map = buildMinersCampMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, CAMP_WIDTH, CAMP_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildMinersCampMap()).toEqual(map);
  });

  it("is fully enclosed except the south gate into the camp proper", () => {
    assertEnclosed(map, CAMP_SOUTH_GATES);
  });

  it("keeps the ascent spawn, the stolen boot and the south gate walkable", () => {
    for (const p of [CAMP_SPAWN, CAMP_BOOT, rectTile(CAMP_EXIT_SOUTH)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the party cross the outskirts from the spawn to the south gate", () => {
    expect(reachable(map, CAMP_SPAWN, CAMP_BOOT)).toBe(true);
    expect(reachable(map, CAMP_SPAWN, rectTile(CAMP_EXIT_SOUTH))).toBe(true);
  });

  it("lands the night-raid storytelling: frost tracks and string lights", () => {
    expect(map.decor.flat()).toContain("frostPrint");
    expect(map.overhead?.flat()).toContain("stringLights");
  });
});

// -------------------------------- camp proper (Act 4, zone 2: the hub)

describe("camp proper map (The Miners' Camp hub)", () => {
  const map = buildCampProperMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, CAMPP_WIDTH, CAMPP_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets (incl. tiles5)", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildCampProperMap()).toEqual(map);
  });

  it("is fully enclosed except its three declared gates", () => {
    assertEnclosed(map, CAMPP_BORDER_GATES);
  });

  it("keeps the spawn, the miners, the sock line and every gate walkable", () => {
    for (const p of [
      CAMPP_SPAWN,
      CAMPP_MO,
      CAMPP_EDDA,
      CAMPP_GUS,
      CAMPP_SOCKS,
      rectTile(CAMPP_CRATE_TRIGGER),
      rectTile(CAMPP_EXIT_NORTH),
      rectTile(CAMPP_EXIT_WEST),
      rectTile(CAMPP_EXIT_EAST)
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("reaches every beat and all three gates from the spawn", () => {
    expect(reachable(map, CAMPP_SPAWN, CAMPP_MO)).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, CAMPP_EDDA)).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, CAMPP_GUS)).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, CAMPP_SOCKS)).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, rectTile(CAMPP_CRATE_TRIGGER))).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, rectTile(CAMPP_EXIT_NORTH))).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, rectTile(CAMPP_EXIT_WEST))).toBe(true);
    expect(reachable(map, CAMPP_SPAWN, rectTile(CAMPP_EXIT_EAST))).toBe(true);
  });

  it("builds the hall: warm floor, rug, crates, string lights and laundry overhead", () => {
    const g = map.ground.flat();
    expect(g).toContain("campFloor");
    expect(g).toContain("campRug");
    const d = map.decor.flat();
    expect(d).toContain("campWall");
    expect(d).toContain("crateStack");
    expect(d).toContain("stove");
    expect(d).toContain("sockBasket");
    const o = map.overhead?.flat() ?? [];
    expect(o).toContain("stringLights");
    expect(o).toContain("laundryLine");
    // The sock basket marks the sock line and stays walkable.
    expect(map.decor[CAMPP_SOCKS.y][CAMPP_SOCKS.x]).toBe("sockBasket");
    expect(isSolidAt(map, CAMPP_SOCKS.x, CAMPP_SOCKS.y)).toBe(false);
  });

  it("keeps the overhead camp decor non-solid (never blocks movement)", () => {
    for (let y = 0; y < CAMPP_HEIGHT; y++) {
      for (let x = 0; x < CAMPP_WIDTH; x++) {
        const o = map.overhead?.[y]?.[x];
        if (o) expect(isSolidAt(map, x, y)).toBe(false);
      }
    }
  });
});

// ------------------------------ laundry nook (Act 4, zone 3: cul-de-sac)

describe("laundry nook map (the midden-mite nest pocket)", () => {
  const map = buildLaundryNookMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, NOOK_WIDTH, NOOK_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildLaundryNookMap()).toEqual(map);
  });

  it("is fully enclosed except the east gate back to the camp proper", () => {
    assertEnclosed(map, NOOK_EAST_GATES);
  });

  it("keeps the spawn, the nest and the exit walkable", () => {
    for (const p of [NOOK_SPAWN, NOOK_NEST, rectTile(NOOK_EXIT_EAST)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach the nest and the exit from the spawn", () => {
    expect(reachable(map, NOOK_SPAWN, NOOK_NEST)).toBe(true);
    expect(reachable(map, NOOK_SPAWN, rectTile(NOOK_EXIT_EAST))).toBe(true);
  });

  it("dresses the damp nook: washtub, and the laundry line overhead", () => {
    expect(map.decor.flat()).toContain("washtub");
    expect(map.overhead?.flat()).toContain("laundryLine");
    for (let y = 0; y < NOOK_HEIGHT; y++) {
      for (let x = 0; x < NOOK_WIDTH; x++) {
        const o = map.overhead?.[y]?.[x];
        if (o) expect(isSolidAt(map, x, y)).toBe(false);
      }
    }
  });
});

// ------------------------------ back gallery (Act 4, zone 4: the climb)

describe("back gallery map (the switchback climb)", () => {
  const map = buildCampGalleryMap();
  const northExit = rectTile(GALLERY_EXIT_NORTH);
  const southExit = rectTile(GALLERY_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, GALLERY_WIDTH, GALLERY_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildCampGalleryMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, GALLERY_BORDER_GATES);
  });

  it("keeps the spawn, the track beat and both gates walkable", () => {
    for (const p of [GALLERY_SPAWN, GALLERY_TRACKS, northExit, southExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the party climb from the south gate up past the tracks to the ledge gate", () => {
    expect(reachable(map, GALLERY_SPAWN, southExit)).toBe(true);
    expect(reachable(map, GALLERY_SPAWN, GALLERY_TRACKS)).toBe(true);
    expect(reachable(map, GALLERY_SPAWN, northExit)).toBe(true);
  });

  it("forces the switchback: cross-walls with staggered gaps", () => {
    expect(map.decor.flat()).toContain("campWall");
    expect(map.decor.flat()).toContain("frostPrint");
  });
});

// ------------------------------ overlook ledge (Act 4, zone 5: cul-de-sac)

describe("overlook ledge map (Fluffball's vantage)", () => {
  const map = buildCampLedgeMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, LEDGE_WIDTH, LEDGE_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildCampLedgeMap()).toEqual(map);
  });

  it("is fully enclosed except the south gate back to the gallery", () => {
    assertEnclosed(map, LEDGE_SOUTH_GATES);
  });

  it("keeps the spawn, Fluffball's perch, the glimpse trigger and the exit walkable", () => {
    for (const p of [LEDGE_SPAWN, LEDGE_FLUFFBALL, rectTile(LEDGE_TRIGGER), rectTile(LEDGE_EXIT_SOUTH)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach Fluffball's perch and the exit from the spawn", () => {
    expect(reachable(map, LEDGE_SPAWN, LEDGE_FLUFFBALL)).toBe(true);
    expect(reachable(map, LEDGE_SPAWN, rectTile(LEDGE_EXIT_SOUTH))).toBe(true);
  });
});

// ============================ Act 5 — The Sunlit Cave-In (Sahra's grove) =====

// -------------------------------- grove descent (Act 5, zone 1: the entry)

describe("grove descent map (the Act 5 entry from the camp)", () => {
  const map = buildGroveDescentMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, DESCENT_WIDTH, DESCENT_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets (incl. tiles6)", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildGroveDescentMap()).toEqual(map);
  });

  it("is fully enclosed except the south gate on into the approach", () => {
    assertEnclosed(map, DESCENT_SOUTH_GATES);
  });

  it("keeps both spawns and the south gate walkable", () => {
    for (const p of [DESCENT_SPAWN, DESCENT_RETURN_SPAWN, rectTile(DESCENT_EXIT_SOUTH)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the party cross from the entry spawn to the south gate", () => {
    expect(reachable(map, DESCENT_SPAWN, rectTile(DESCENT_EXIT_SOUTH))).toBe(true);
    expect(reachable(map, DESCENT_RETURN_SPAWN, rectTile(DESCENT_EXIT_SOUTH))).toBe(true);
  });

  it("greens and warms as it descends: moss and the sunbeam glow appear", () => {
    const g = map.ground.flat();
    expect(g).toContain("groveMoss");
    expect(g).toContain("sunbeam");
  });
});

// ------------------------------ grove approach (Act 5, zone 2: the chase)

describe("grove approach map (the needle-cactus + scared chase)", () => {
  const map = buildGroveApproachMap();
  const northExit = rectTile(APPROACH_EXIT_NORTH);
  const southExit = rectTile(APPROACH_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, APPROACH_WIDTH, APPROACH_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildGroveApproachMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, APPROACH_BORDER_GATES);
  });

  it("keeps the spawns, the chase beat, the windfall and both gates walkable", () => {
    for (const p of [
      APPROACH_SPAWN,
      APPROACH_RETURN_SPAWN,
      rectTile(APPROACH_CHASE_TRIGGER),
      APPROACH_OLD_ROW,
      northExit,
      southExit
    ]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("reaches the chase beat and both gates from the spawn", () => {
    expect(reachable(map, APPROACH_SPAWN, rectTile(APPROACH_CHASE_TRIGGER))).toBe(true);
    expect(reachable(map, APPROACH_SPAWN, APPROACH_OLD_ROW)).toBe(true);
    expect(reachable(map, APPROACH_SPAWN, northExit)).toBe(true);
    expect(reachable(map, APPROACH_SPAWN, southExit)).toBe(true);
  });

  it("plants a dense needle-cactus thicket, too solid to follow Piggy into", () => {
    expect(map.decor.flat()).toContain("needleCactus");
    expect(isSolidAt(map, APPROACH_NEEDLE.x, APPROACH_NEEDLE.y)).toBe(true);
    expect(map.ground.flat()).toContain("oldOrange");
  });
});

// -------------------------------- grove grotto (Act 5, zone 3: the river)

describe("grove grotto map (the underground river breather)", () => {
  const map = buildGroveGrottoMap();
  const northExit = rectTile(GROTTO_EXIT_NORTH);
  const southExit = rectTile(GROTTO_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, GROTTO_WIDTH, GROTTO_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildGroveGrottoMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, GROTTO_BORDER_GATES);
  });

  it("keeps the spawns, the pool and both gates walkable", () => {
    for (const p of [GROTTO_SPAWN, GROTTO_RETURN_SPAWN, GROTTO_POOL, northExit, southExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("keeps both banks connected across the river via the stepping stones", () => {
    // The river is solid water, but the stepping-stone crossing keeps the
    // south gate reachable from the north spawn (and vice versa).
    expect(reachable(map, GROTTO_SPAWN, southExit)).toBe(true);
    expect(reachable(map, GROTTO_RETURN_SPAWN, northExit)).toBe(true);
    expect(map.decor.flat()).toContain("groveWater");
    expect(map.ground.flat()).toContain("riverStone");
  });
});

// ---------------------- grove chamber (Act 5, zone 4: the tree at the centre)

describe("grove chamber map (the sunlit cave-in, one tree dead centre)", () => {
  const map = buildGroveChamberMap();
  const northExit = rectTile(CHAMBER_EXIT_NORTH);
  const eastExit = rectTile(CHAMBER_EXIT_EAST);

  it("has the declared dimensions", () => {
    assertDimensions(map, CHAMBER_WIDTH, CHAMBER_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildGroveChamberMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, CHAMBER_BORDER_GATES);
  });

  it("stands one orange tree at (near) the dead centre of the chamber", () => {
    // The trunk is solid and sits at the geometric centre of the room; the
    // leafy canopy is an OVERHEAD (non-solid) tile the party walks beneath.
    expect(map.decor[CHAMBER_TREE.y][CHAMBER_TREE.x]).toBe("orangeTreeTrunk");
    expect(isSolidAt(map, CHAMBER_TREE.x, CHAMBER_TREE.y)).toBe(true);
    expect(Math.abs(CHAMBER_TREE.x - CHAMBER_WIDTH / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(CHAMBER_TREE.y - CHAMBER_HEIGHT / 2)).toBeLessThanOrEqual(1);
    const overhead = (map.overhead ?? []).flat();
    expect(overhead).toContain("orangeTreeCanopy");
    // Exactly one tree: the trunk is two tiles tall and nothing else uses it.
    const trunks = map.decor.flat().filter((c) => c === "orangeTreeTrunk").length;
    expect(trunks).toBe(2);
  });

  it("frames the tree in the sunbeam shaft, walkable right up to the trunk", () => {
    expect(map.ground.flat()).toContain("sunbeam");
    // The tree is approachable from all four sides (its base cell excepted).
    expect(reachable(map, CHAMBER_SPAWN, { x: CHAMBER_TREE.x, y: CHAMBER_TREE.y - 1 })).toBe(true);
    expect(reachable(map, CHAMBER_SPAWN, rectTile(CHAMBER_JOIN_TRIGGER))).toBe(true);
  });

  it("keeps the spawns and both gates walkable and reachable", () => {
    for (const p of [CHAMBER_SPAWN, CHAMBER_RETURN_SPAWN, northExit, eastExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
    expect(reachable(map, CHAMBER_SPAWN, northExit)).toBe(true);
    expect(reachable(map, CHAMBER_SPAWN, eastExit)).toBe(true);
  });

  it("keeps the overhead canopy non-solid (the party walks under the tree)", () => {
    for (let y = 0; y < CHAMBER_HEIGHT; y++) {
      for (let x = 0; x < CHAMBER_WIDTH; x++) {
        const o = map.overhead?.[y]?.[x];
        if (o) expect(isSolidAt(map, x, y)).toBe(false);
      }
    }
  });
});

// -------------------------------- Sahra's grove (Act 5, zone 5: the trade)

describe("sahra's grove map (the keeper's corner + oldest row)", () => {
  const map = buildSahraGroveMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, SAHRA_WIDTH, SAHRA_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildSahraGroveMap()).toEqual(map);
  });

  it("is fully enclosed except the west gate back to the chamber", () => {
    assertEnclosed(map, SAHRA_WEST_GATES);
  });

  it("keeps the spawn, Sahra, the oldest row and the exit walkable", () => {
    for (const p of [SAHRA_SPAWN, SAHRA_NPC, SAHRA_OLD_ROW, rectTile(SAHRA_EXIT_WEST)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach Sahra and the oldest row from the spawn", () => {
    expect(reachable(map, SAHRA_SPAWN, SAHRA_NPC)).toBe(true);
    expect(reachable(map, SAHRA_SPAWN, SAHRA_OLD_ROW)).toBe(true);
    expect(reachable(map, SAHRA_SPAWN, rectTile(SAHRA_EXIT_WEST))).toBe(true);
    expect(map.ground.flat()).toContain("oldOrange");
  });
});

// ============================ Act 6 — The Reef ============================

describe("reef descent map (the Act 6 entry from Sahra's grove)", () => {
  const map = buildReefDescentMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, REEF_D_WIDTH, REEF_D_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets (incl. tiles7)", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildReefDescentMap()).toEqual(map);
  });

  it("is fully enclosed except the south gate on into the garden", () => {
    assertEnclosed(map, REEF_D_SOUTH_GATES);
  });

  it("keeps both spawns and the south gate walkable and reachable", () => {
    for (const p of [REEF_D_SPAWN, REEF_D_RETURN_SPAWN, rectTile(REEF_D_EXIT_SOUTH)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
    expect(reachable(map, REEF_D_SPAWN, rectTile(REEF_D_EXIT_SOUTH))).toBe(true);
    expect(reachable(map, REEF_D_RETURN_SPAWN, rectTile(REEF_D_EXIT_SOUTH))).toBe(true);
  });

  it("darkens into reef and glows at the gate: reef floor + glow-moss appear", () => {
    const g = map.ground.flat();
    expect(g).toContain("reefFloor");
    expect(g).toContain("glowMoss");
  });
});

describe("reef garden map (the crawlers' farmed kelp)", () => {
  const map = buildReefGardenMap();
  const northExit = rectTile(REEF_G_EXIT_NORTH);
  const southExit = rectTile(REEF_G_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, REEF_G_WIDTH, REEF_G_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildReefGardenMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, REEF_G_BORDER_GATES);
  });

  it("keeps the spawns, the mint row and both gates walkable and reachable", () => {
    for (const p of [REEF_G_SPAWN, REEF_G_RETURN_SPAWN, REEF_G_MINT_ROW, northExit, southExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
    expect(reachable(map, REEF_G_SPAWN, REEF_G_MINT_ROW)).toBe(true);
    expect(reachable(map, REEF_G_SPAWN, northExit)).toBe(true);
    expect(reachable(map, REEF_G_SPAWN, southExit)).toBe(true);
  });

  it("grows CULTIVATED mint kelp (walkable) against SOLID wild kelp + trellises", () => {
    // The tended crop is a walkable ground tile; the wild growth and the farm
    // frames are solid walk-arounds — the cultivated/wild distinction is real.
    expect(map.ground.flat()).toContain("mintKelp");
    expect(isSolidAt(map, REEF_G_MINT_ROW.x, REEF_G_MINT_ROW.y)).toBe(false);
    expect(map.decor.flat()).toContain("wildKelp");
    expect(map.decor.flat()).toContain("kelpTrellis");
  });

  it("hangs an overhead wild-kelp canopy the party swims under (non-solid)", () => {
    const overhead = (map.overhead ?? []).flat();
    expect(overhead).toContain("kelpCanopy");
    for (let y = 0; y < REEF_G_HEIGHT; y++) {
      for (let x = 0; x < REEF_G_WIDTH; x++) {
        const o = map.overhead?.[y]?.[x];
        if (o) expect(isSolidAt(map, x, y)).toBe(false);
      }
    }
  });
});

describe("reef warren map (the coral maze + the tense chase)", () => {
  const map = buildReefWarrenMap();
  const northExit = rectTile(REEF_W_EXIT_NORTH);
  const southExit = rectTile(REEF_W_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, REEF_W_WIDTH, REEF_W_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildReefWarrenMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, REEF_W_BORDER_GATES);
  });

  it("keeps the spawns, the chase beat and both gates walkable and reachable", () => {
    for (const p of [REEF_W_SPAWN, REEF_W_RETURN_SPAWN, rectTile(REEF_W_CHASE_TRIGGER), northExit, southExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
    expect(reachable(map, REEF_W_SPAWN, rectTile(REEF_W_CHASE_TRIGGER))).toBe(true);
    expect(reachable(map, REEF_W_SPAWN, northExit)).toBe(true);
    expect(reachable(map, REEF_W_SPAWN, southExit)).toBe(true);
  });

  it("corners Piggy in a coral dead-end: a BFS-proven cul-de-sac", () => {
    // The east alcove where Piggy is cornered is reachable, and sealed off by
    // its single entrance tile — a true cul-de-sac (like Act 3's temple/bed).
    assertCulDeSac(map, REEF_W_SPAWN, REEF_W_CORNER, REEF_W_ALCOVE_ENTRANCE);
  });
});

describe("reef hollow map (the bioluminescent breather + reef channel)", () => {
  const map = buildReefHollowMap();
  const northExit = rectTile(REEF_H_EXIT_NORTH);
  const southExit = rectTile(REEF_H_EXIT_SOUTH);

  it("has the declared dimensions", () => {
    assertDimensions(map, REEF_H_WIDTH, REEF_H_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildReefHollowMap()).toEqual(map);
  });

  it("is fully enclosed except its two declared gates", () => {
    assertEnclosed(map, REEF_H_BORDER_GATES);
  });

  it("keeps the spawns, the pool and both gates walkable", () => {
    for (const p of [REEF_H_SPAWN, REEF_H_RETURN_SPAWN, REEF_H_POOL, northExit, southExit]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("keeps both banks connected across the channel via the stepping stones", () => {
    expect(reachable(map, REEF_H_SPAWN, southExit)).toBe(true);
    expect(reachable(map, REEF_H_RETURN_SPAWN, northExit)).toBe(true);
    expect(map.decor.flat()).toContain("reefWater");
    expect(map.ground.flat()).toContain("reefStone");
  });
});

describe("reef court map (the diplomacy zone + the oldest mint row)", () => {
  const map = buildReefCourtMap();

  it("has the declared dimensions", () => {
    assertDimensions(map, REEF_C_WIDTH, REEF_C_HEIGHT);
  });

  it("only uses tile names from the manifest tilesets", () => {
    assertKnownNames(map);
  });

  it("is deterministic", () => {
    expect(buildReefCourtMap()).toEqual(map);
  });

  it("is fully enclosed except the north gate back to the hollow", () => {
    assertEnclosed(map, REEF_C_NORTH_GATES);
  });

  it("keeps the spawn, the warden, the oldest row and the exit walkable", () => {
    for (const p of [REEF_C_SPAWN, REEF_C_NPC, REEF_C_OLD_ROW, rectTile(REEF_C_EXIT_NORTH)]) {
      expect(isSolidAt(map, p.x, p.y)).toBe(false);
    }
  });

  it("lets the player reach the crawler warden and the oldest mint row", () => {
    expect(reachable(map, REEF_C_SPAWN, REEF_C_NPC)).toBe(true);
    expect(reachable(map, REEF_C_SPAWN, REEF_C_OLD_ROW)).toBe(true);
    expect(reachable(map, REEF_C_SPAWN, rectTile(REEF_C_EXIT_NORTH))).toBe(true);
    expect(map.ground.flat()).toContain("mintKelp");
  });
});
