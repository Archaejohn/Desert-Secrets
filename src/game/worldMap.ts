/**
 * The sample overworld: a hand-authored desert valley with an oasis,
 * half-buried ruins, and open dunes. Pure data (tile *names*, resolved to
 * indices via the manifest at scene-build time) so it can be unit tested
 * without Phaser or the generated assets.
 */

export const MAP_WIDTH = 32;
export const MAP_HEIGHT = 20;

export interface WorldMapData {
  /** Ground layer, every cell filled. */
  ground: string[][];
  /** Decor layer, null = empty. */
  decor: (string | null)[][];
}

/** Decor/ground names the player cannot walk through. */
export const SOLID_NAMES: readonly string[] = [
  "water",
  "rock",
  "cactus",
  "brick",
  "brickCracked",
  "ruinPillar",
  "palmTrunk",
  "pot"
];

/** Spawn points in tile coordinates. */
export const SPAWNS = {
  player: { x: 8, y: 16 },
  npc: { x: 23, y: 9 },
  scarab: { x: 14, y: 13 }
} as const;

/** Tiny deterministic per-cell hash for sand variety (not gameplay-relevant). */
function cellHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

export function buildWorldMap(): WorldMapData {
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];

  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < MAP_WIDTH; x++) {
      const h = cellHash(x, y);
      let name = "sand";
      if (h % 17 === 0) name = "sand2";
      else if (h % 13 === 0) name = "sand3";
      else if (h % 61 === 0) name = "sandSparkle";
      ground[y].push(name);
      decor[y].push(null);
    }
  }

  // Dune crest lines across the open desert.
  for (const [row, x0, x1] of [
    [5, 2, 9],
    [12, 24, 30],
    [17, 14, 22]
  ] as const) {
    for (let x = x0; x <= x1; x++) ground[row][x] = "duneEdge";
  }

  // Oasis pond (top right) with palms around it.
  for (let y = 4; y <= 7; y++) {
    for (let x = 25; x <= 29; x++) {
      const edge = y === 4 || y === 7 || x === 25 || x === 29;
      // Rounded corners: keep the corners as sand.
      const corner =
        (y === 4 || y === 7) && (x === 25 || x === 29);
      if (!corner) ground[y][x] = edge && cellHash(x, y) % 3 === 0 ? "water2" : "water";
    }
  }
  const palms: Array<[number, number]> = [
    [24, 4],
    [30, 5],
    [26, 9]
  ];
  for (const [px, py] of palms) {
    decor[py][px] = "palmTrunk";
    decor[py - 1][px] = "palmTop";
  }

  // Half-buried ruins (left side): broken walls, a pillar, relics.
  for (let x = 3; x <= 8; x++) decor[9][x] = cellHash(x, 9) % 4 === 0 ? "brickCracked" : "brick";
  for (let y = 10; y <= 12; y++) decor[y][3] = "brick";
  decor[10][8] = "brickCracked";
  decor[12][6] = "ruinPillar";
  decor[11][5] = "pot";
  decor[13][8] = "bones";

  // Scattered rocks and cacti.
  const rocks: Array<[number, number]> = [
    [13, 4],
    [18, 7],
    [12, 17],
    [27, 15],
    [20, 12]
  ];
  for (const [x, y] of rocks) decor[y][x] = "rock";
  const cacti: Array<[number, number]> = [
    [5, 3],
    [16, 3],
    [10, 11],
    [25, 17],
    [30, 10],
    [2, 14]
  ];
  for (const [x, y] of cacti) decor[y][x] = "cactus";

  // Map border: rocks so the player can't leave the valley.
  for (let x = 0; x < MAP_WIDTH; x++) {
    decor[0][x] = "rock";
    decor[MAP_HEIGHT - 1][x] = "rock";
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    decor[y][0] = "rock";
    decor[y][MAP_WIDTH - 1] = "rock";
  }

  return { ground, decor };
}

/** True if the tile at (x, y) blocks movement. */
export function isSolidAt(map: WorldMapData, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= MAP_WIDTH || y >= MAP_HEIGHT) return true;
  const d = map.decor[y][x];
  if (d && SOLID_NAMES.includes(d)) return true;
  return SOLID_NAMES.includes(map.ground[y][x]);
}
