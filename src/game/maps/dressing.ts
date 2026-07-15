/**
 * The dressing pass (docs/ART_DIRECTION.md §2 — the floor/wall/edge grammar).
 *
 * `dressMap(map)` is a pure, deterministic post-pass applied inside every
 * zone map builder (wrapping its return). Rule-driven off the name registry
 * below:
 *
 * - wall cell whose south neighbour is walkable → `<wall>Face` (the vertical
 *   south-facing surface); wall cell directly above a face in the same run →
 *   `<wall>Cap` (the lit top). Wall cells whose NORTH neighbour is walkable
 *   (a room's bottom wall seen from behind) also read as caps — the FF6/SoM
 *   thin-north-edge asymmetry.
 * - walkable floor cell whose north neighbour is a face → `<floor>Shade`
 *   (foot shadow), same for registered walkable decor.
 * - registered terrain pairs get transition tiles by 4-neighbour adjacency
 *   (edge + outer-corner variants; inner corners for hot pairs only): chasm
 *   lips, the floe↔sea coast ring, moss↔grass fingers, riverbank lips,
 *   silt↔reef-floor and ash↔ember seams.
 *
 * Properties (unit-tested in tests/game/dressing.test.ts):
 * - Idempotent: `dressMap(dressMap(m))` equals `dressMap(m)` — rules see
 *   variants as their base names, and never rewrite a cell that already
 *   holds a variant (which also preserves hand-placed dressed names).
 * - Tolerant: unregistered names pass through untouched, so Act 1 maps
 *   (tiles/tiles2 families, owned by a parallel phase) dress to themselves.
 * - Solidity is inherited mechanically via `isSolidName` in `types.ts`.
 */
import { cellHash } from "./cellHash";
import { isSolidName, type ZoneMap } from "./types";

// ---------------------------------------------------------------------------
// Registry (tile names only — pure data, no pipeline imports).
// ---------------------------------------------------------------------------

export interface WallDressing {
  face: string;
  /** Optional second grain; alternated by cellHash so long runs don't repeat. */
  face2?: string;
  cap: string;
  cap2?: string;
}

/** Wall families (decor layer) that gain Face/Cap roles. tiles2 families
 *  (mineWall, stationWall) are deliberately absent — that sheet belongs to a
 *  parallel phase this wave. */
export const WALL_DRESSING: Readonly<Record<string, WallDressing>> = {
  iceWallDeep: {
    face: "iceWallDeepFace",
    face2: "iceWallDeepFace2",
    cap: "iceWallDeepCap",
    cap2: "iceWallDeepCap2"
  },
  campWall: {
    face: "campWallFace",
    face2: "campWallFace2",
    cap: "campWallCap",
    cap2: "campWallCap2"
  },
  caveWall: {
    face: "caveWallFace",
    face2: "caveWallFace2",
    cap: "caveWallCap",
    cap2: "caveWallCap2"
  },
  reefWall: {
    face: "reefWallFace",
    face2: "reefWallFace2",
    cap: "reefWallCap",
    cap2: "reefWallCap2"
  },
  basaltWall: {
    face: "basaltWallFace",
    face2: "basaltWallFace2",
    cap: "basaltWallCap",
    cap2: "basaltWallCap2"
  }
};

/** Ground floors that gain a `...Shade` foot-shadow variant south of faces. */
export const FLOOR_SHADE: Readonly<Record<string, string>> = {
  // tiles3 (ice)
  iceFloor: "iceFloorShade",
  iceFloor2: "iceFloor2Shade",
  mossGlow: "mossGlowShade",
  lakeIce: "lakeIceShade",
  // tiles4 (sea) — no registered walls border these zones today, but the
  // variants exist for hand nudges and future walls.
  templeFloor: "templeFloorShade",
  templeGlyph: "templeGlyphShade",
  floe: "floeShade",
  floe2: "floeShade",
  kelpBed: "kelpBedShade",
  // tiles5 (camp)
  campFloor: "campFloorShade",
  campFloor2: "campFloor2Shade",
  campRug: "campRugShade",
  // tiles6 (grove)
  groveGrass: "groveGrassShade",
  groveGrass2: "groveGrassShade",
  groveMoss: "groveMossShade",
  oldOrange: "oldOrangeShade",
  riverStone: "riverStoneShade",
  // tiles7 (reef)
  reefFloor: "reefFloorShade",
  reefFloor2: "reefFloorShade",
  reefSilt: "reefSiltShade",
  glowMoss: "glowMossShade",
  mintKelp: "mintKelpShade",
  // tiles8 (pizzeria / lava)
  tileFloor: "tileFloorShade",
  tileFloor2: "tileFloor2Shade",
  emberFloor: "emberFloorShade",
  emberFloor2: "emberFloor2Shade",
  ashFloor: "ashFloorShade",
  lavaCrust: "lavaCrustShade",
  carvedStep: "carvedStepShade",
  ovenGlow: "ovenGlowShade"
};

/** Walkable decor that gains a shade variant when it sits in a foot shadow. */
export const DECOR_SHADE: Readonly<Record<string, string>> = {
  frostPrint: "frostPrintShade"
};

export interface TransitionTiles {
  n: string;
  e: string;
  s: string;
  w: string;
  ne: string;
  nw: string;
  se: string;
  sw: string;
  /** Inner corners (other material only diagonal) — hot pairs only. */
  inNE?: string;
  inNW?: string;
  inSE?: string;
  inSW?: string;
}

export interface TransitionSpec {
  /** Ground names that take the variants — the border OWNER (G9). */
  base: readonly string[];
  /** Neighbouring material (checked on both ground and decor, normalized). */
  other: readonly string[];
  /** Edge tiles may be the full 8-set or edges-only (4). */
  tiles: Partial<TransitionTiles> & Pick<TransitionTiles, "n" | "e" | "s" | "w">;
}

export const TRANSITIONS: readonly TransitionSpec[] = [
  {
    // Chasm lip: ice floor bordering the pit gets a dark edge on the void side.
    base: ["iceFloor", "iceFloor2"],
    other: ["chasm"],
    tiles: {
      n: "iceFloorChasmN",
      e: "iceFloorChasmE",
      s: "iceFloorChasmS",
      w: "iceFloorChasmW",
      ne: "iceFloorChasmNE",
      nw: "iceFloorChasmNW",
      se: "iceFloorChasmSE",
      sw: "iceFloorChasmSW"
    }
  },
  {
    // Floe coast ring: land owns the border (dark lip → surf fringe →
    // shallow band → open water). Inner corners for stair-step coastlines.
    base: ["floe", "floe2"],
    other: ["seaWater", "seaWater2"],
    tiles: {
      n: "floeSeaN",
      e: "floeSeaE",
      s: "floeSeaS",
      w: "floeSeaW",
      ne: "floeSeaNE",
      nw: "floeSeaNW",
      se: "floeSeaSE",
      sw: "floeSeaSW",
      inNE: "floeSeaInNE",
      inNW: "floeSeaInNW",
      inSE: "floeSeaInSE",
      inSW: "floeSeaInSW"
    }
  },
  {
    // Moss owns its border against grass (SoM organic fingers).
    base: ["groveMoss"],
    other: ["groveGrass", "groveGrass2"],
    tiles: {
      n: "mossGrassN",
      e: "mossGrassE",
      s: "mossGrassS",
      w: "mossGrassW",
      ne: "mossGrassNE",
      nw: "mossGrassNW",
      se: "mossGrassSE",
      sw: "mossGrassSW"
    }
  },
  {
    // Riverbank lip: grass owns its border against the grove river.
    base: ["groveGrass", "groveGrass2"],
    other: ["groveWater", "groveWater2"],
    tiles: {
      n: "grassWaterN",
      e: "grassWaterE",
      s: "grassWaterS",
      w: "grassWaterW",
      ne: "grassWaterNE",
      nw: "grassWaterNW",
      se: "grassWaterSE",
      sw: "grassWaterSW"
    }
  },
  {
    // The sunbeam owns its soft edge against the grass (spilled-light
    // fingers) — no hard rectangle around the shaft (§5).
    base: ["sunbeam"],
    other: ["groveGrass", "groveGrass2"],
    tiles: {
      n: "sunGrassN",
      e: "sunGrassE",
      s: "sunGrassS",
      w: "sunGrassW",
      ne: "sunGrassNE",
      nw: "sunGrassNW",
      se: "sunGrassSE",
      sw: "sunGrassSW"
    }
  },
  {
    // Silt owns its border against the reef floor (organic fingers).
    base: ["reefSilt"],
    other: ["reefFloor", "reefFloor2"],
    tiles: {
      n: "siltFloorN",
      e: "siltFloorE",
      s: "siltFloorS",
      w: "siltFloorW",
      ne: "siltFloorNE",
      nw: "siltFloorNW",
      se: "siltFloorSE",
      sw: "siltFloorSW"
    }
  },
  {
    // Ash drifts own their border against ember stone (edges only).
    base: ["ashFloor"],
    other: ["emberFloor", "emberFloor2"],
    tiles: { n: "ashEmberN", e: "ashEmberE", s: "ashEmberS", w: "ashEmberW" }
  }
];

// ---------------------------------------------------------------------------
// Derived lookup tables.
// ---------------------------------------------------------------------------

/** Every dressed variant name → the base name it stands in for. */
export const VARIANT_BASE: Readonly<Record<string, string>> = (() => {
  const map: Record<string, string> = {};
  for (const [base, roles] of Object.entries(WALL_DRESSING)) {
    map[roles.face] = base;
    map[roles.cap] = base;
    if (roles.face2) map[roles.face2] = base;
    if (roles.cap2) map[roles.cap2] = base;
  }
  for (const [base, shade] of Object.entries(FLOOR_SHADE)) {
    // Shared shades (e.g. groveGrass2 → groveGrassShade) normalize to the
    // first base that registered them.
    if (!(shade in map)) map[shade] = base;
  }
  for (const [base, shade] of Object.entries(DECOR_SHADE)) {
    if (!(shade in map)) map[shade] = base;
  }
  for (const spec of TRANSITIONS) {
    for (const tile of Object.values(spec.tiles)) {
      if (tile && !(tile in map)) map[tile] = spec.base[0];
    }
  }
  return map;
})();

const FACE_NAMES = new Set(
  Object.values(WALL_DRESSING).flatMap((r) => (r.face2 ? [r.face, r.face2] : [r.face]))
);

/** Normalize a (possibly dressed) tile name back to its base name. */
export function baseName(name: string | null): string | null {
  if (name === null) return null;
  return VARIANT_BASE[name] ?? name;
}

// ---------------------------------------------------------------------------
// The pass itself.
// ---------------------------------------------------------------------------

export function dressMap(map: ZoneMap): ZoneMap {
  const height = map.ground.length;
  const width = map.ground[0].length;

  // Normalized base grids — rules always see through existing variants, which
  // is what makes the pass idempotent.
  const bg: (string | null)[][] = map.ground.map((row) => row.map((c) => baseName(c)));
  const bd: (string | null)[][] = map.decor.map((row) => row.map((c) => baseName(c)));

  const inBounds = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  /** Out of bounds counts as solid (the world edge behaves like wall). */
  const walkable = (x: number, y: number): boolean =>
    inBounds(x, y) && !isSolidName(bd[y][x]) && !isSolidName(bg[y][x]);

  const ground = map.ground.map((row) => [...row]);
  const decor = map.decor.map((row) => [...row]);
  const overhead = map.overhead?.map((row) => [...row]);

  // --- Pass 1: wall faces and caps (decor layer). -------------------------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const wall = bd[y][x] === null ? undefined : WALL_DRESSING[bd[y][x] as string];
      if (!wall) continue;
      if (map.decor[y][x] !== bd[y][x]) continue; // hand-placed variant — keep
      const alt = cellHash(x, y) % 2 === 1;
      if (walkable(x, y + 1)) {
        // South neighbour is open floor → this is the vertical face.
        decor[y][x] = alt && wall.face2 ? wall.face2 : wall.face;
      } else if (
        // Above a face in the same run → the lit cap...
        (bd[y + 1]?.[x] === bd[y][x] && walkable(x, y + 2)) ||
        // ...or a thin north edge (room's bottom wall seen from behind).
        walkable(x, y - 1)
      ) {
        decor[y][x] = alt && wall.cap2 ? wall.cap2 : wall.cap;
      }
    }
  }

  /** True if the DRESSED decor at (x, y) is a wall face. */
  const faceAt = (x: number, y: number): boolean =>
    inBounds(x, y) && decor[y][x] !== null && FACE_NAMES.has(decor[y][x] as string);

  // --- Pass 2: foot shadows and terrain transitions (ground layer). -------
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (!walkable(x, y)) continue;
      const gBase = bg[y][x];
      if (gBase === null) continue;

      // Foot shadow south of a face wins over transitions (value hierarchy).
      if (faceAt(x, y - 1)) {
        const shade = FLOOR_SHADE[gBase];
        if (shade && map.ground[y][x] === gBase) ground[y][x] = shade;
        const dBase = bd[y][x];
        if (dBase !== null && map.decor[y][x] === dBase) {
          const dShade = DECOR_SHADE[dBase];
          if (dShade) decor[y][x] = dShade;
        }
        continue;
      }

      if (map.ground[y][x] !== gBase) continue; // hand-placed variant — keep
      const spec = TRANSITIONS.find((t) => t.base.includes(gBase));
      if (!spec) continue;

      const otherAt = (nx: number, ny: number): boolean => {
        if (!inBounds(nx, ny)) return false;
        const og = bg[ny][nx];
        const od = bd[ny][nx];
        return (
          (og !== null && spec.other.includes(og)) || (od !== null && spec.other.includes(od))
        );
      };
      const n = otherAt(x, y - 1);
      const e = otherAt(x + 1, y);
      const s = otherAt(x, y + 1);
      const w = otherAt(x - 1, y);
      const count = Number(n) + Number(e) + Number(s) + Number(w);
      const t = spec.tiles;
      let pick: string | undefined;
      if (count === 1) {
        pick = n ? t.n : e ? t.e : s ? t.s : t.w;
      } else if (count === 2) {
        if (n && e) pick = t.ne;
        else if (n && w) pick = t.nw;
        else if (s && e) pick = t.se;
        else if (s && w) pick = t.sw;
        // opposite sides (n+s / e+w): no authored tile — leave the base.
      } else if (count === 0 && (t.inNE || t.inNW || t.inSE || t.inSW)) {
        const dNE = otherAt(x + 1, y - 1);
        const dNW = otherAt(x - 1, y - 1);
        const dSE = otherAt(x + 1, y + 1);
        const dSW = otherAt(x - 1, y + 1);
        const dCount = Number(dNE) + Number(dNW) + Number(dSE) + Number(dSW);
        if (dCount === 1) pick = dNE ? t.inNE : dNW ? t.inNW : dSE ? t.inSE : t.inSW;
      }
      if (pick) ground[y][x] = pick;
    }
  }

  return overhead ? { ground, decor, overhead } : { ground, decor };
}
