/**
 * The core parametric entry point: `generateTerrain(params)` composes
 * `terrains.floorFill` + `materials.wallFace` + `cliffFace.cliffTiles` +
 * `blob47.blobTiles` into the full named tile set for one preset. Ported
 * from `buildAll` (docs/prototypes/cliff-suite-v6.html:719-743).
 *
 * ## Over/base direction (the crux of this port)
 *
 * The prototype's `buildBlobTile(ctx,ox,oy,mask,base,over,o)` takes `base`
 * BEFORE `over` — easy to misread from the call sites alone. `buildAll`
 * calls it as `buildBlobTile(..., m, A.gnd, A.top, o)`, i.e.
 * `base = A.gnd` (ground), `over = A.top` (plateau). So the mask=255
 * (fully interior) tile of both the regular blob set and the plateau-edge
 * set renders as the **plateau top** fill, not the ground — confirmed by
 * this file's "mask-255 plateau tile equals the plateau-top fill" test.
 * Our ported `blobTiles(over, base, opts)` keeps that `(over, base)` order
 * (matching `BlobTileOptions.overKey`/`baseKey`), so here:
 *   - plateau-edge set: `blobTiles(fills[plateauTop], fills[ground], ...)`.
 *   - each `pairings[i]`: `blobTiles(fills[over], fills[base], ...)` — the
 *     preset's own `{over, base}` naming already matches this convention
 *     directly (over = interior/foreground terrain, base = exterior).
 *
 * ## Fill dedup
 *
 * `plateauTop`, `ground`, and every `pairings[].over`/`.base` are collected
 * into one `Set<TerrainKey>`; one `floorFill(key, p.seed)` is built per
 * unique key and reused everywhere that key appears (so a desert preset
 * using `"sand"` for both `plateauTop` and `ground` builds exactly one
 * `sand` fill, not two independent ones — required for the mask-255
 * exact-equality test, and matches the brief's "dedupe across pairings"
 * instruction). Each fill is also emitted as its own named tile,
 * `{key}Fill`, so downstream consumers (frames.ts, later tasks) get the
 * plain floor texture too.
 *
 * ## Plateau corner linking
 *
 * `linkPlateauCorners` ties the plateau-edge set's corner `round` to the
 * cliff's own `topRounding` (the rim's corner-lift radius) rather than the
 * generic `cornerRounding` knob, so an organically-shaped plateau's
 * top-down edge always agrees with the same shape's cliff rim — ported
 * from the prototype's `po = {...o, round: linkCorners ? tround : fround}`.
 */
import { PixelGrid } from "../grid";
import { TERRAIN_RAMPS, type TerrainKey } from "./palette";
import { floorFill } from "./terrains";
import { blobTiles } from "./blob47";
import { wallFace, type MaterialKey } from "./materials";
import { cliffTiles } from "./cliffFace";
import { rampTiles, type RampMaterial } from "./ramps";
import { diagonalFlightTiles } from "./diagonalRamps";

export type TerrainParams = {
  // material — the wall/cliff face texture (the pluggable seam)
  material: MaterialKey; // "rock" (phase 1); later: castleBlock, ice, mossy, lava…
  // structure (from the prototype's wall controls)
  courses: number;
  blockSize: number;
  blocksPerCourse: number;
  stagger: number;
  tone: number;
  mortar: number;
  orderVsRandom: number;
  // cliff assembly
  capBand: number;
  capRoll: number;
  capMaterial: "plateau" | "wall" | "blend";
  footer: number;
  cliffHeight: number;
  baseRounding: number;
  topRounding: number; // rounded vs HARD corners = these to 0
  outerCornerShade: number;
  innerCornerDepth: number;
  castShadow: number;
  scree: boolean;
  litLip: boolean;
  // floor blob edges
  edgeInset: number;
  edgeIrregularity: number;
  cornerRounding: number;
  edgeOutline: boolean;
  dropShadow: boolean;
  linkPlateauCorners: boolean;
  // terrains this preset pairs (over → base), incl. a terrain over itself
  pairings: { over: TerrainKey; base: TerrainKey }[];
  plateauTop: TerrainKey;
  ground: TerrainKey;
  seed: number;
  // ramp materials to emit for this preset (phase 1b) — each yields 16
  // named ramp tiles (see ramps.ts).
  ramps: RampMaterial[];
  // diagonal flight tiles (phase 1c)
  diagonalRamps?: boolean;
};

const VARIANT_NAMES = ["outerW", "mid", "outerE", "innerW", "innerE"] as const;
const BAND_NAMES = ["rim", "face", "footer"] as const;

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

/** Build one `floorFill` per unique terrain key referenced by `p`, keyed by name. */
function buildFills(p: TerrainParams): Map<TerrainKey, PixelGrid> {
  const keys = new Set<TerrainKey>([p.plateauTop, p.ground]);
  for (const pr of p.pairings) {
    keys.add(pr.over);
    keys.add(pr.base);
  }
  const fills = new Map<TerrainKey, PixelGrid>();
  for (const key of keys) fills.set(key, floorFill(key, p.seed));
  return fills;
}

/** Generates the full named terrain set (cliff + plateau-edge + pairing blob sets + fills) for one preset. */
export function generateTerrain(p: TerrainParams): { name: string; grid: PixelGrid }[] {
  const out: { name: string; grid: PixelGrid }[] = [];
  const fills = buildFills(p);

  // Fills — one named tile per unique terrain key.
  for (const [key, grid] of fills) out.push({ name: `${key}Fill`, grid });

  // Wall face + directional cliff set (15 tiles).
  const face = wallFace(p.material, {
    courses: p.courses,
    blockSize: p.blockSize,
    blocksPerCourse: p.blocksPerCourse,
    stagger: p.stagger,
    tone: p.tone,
    mortar: p.mortar,
    orderVsRandom: p.orderVsRandom,
  }, p.seed);

  const cliffGrids = cliffTiles({
    face,
    top: fills.get(p.plateauTop)!,
    gnd: fills.get(p.ground)!,
    topKey: p.plateauTop,
    gndKey: p.ground,
    cap: p.capBand,
    foot: p.footer,
    cliffHeight: p.cliffHeight,
    baseRounding: p.baseRounding,
    topRounding: p.topRounding,
    outerShade: p.outerCornerShade,
    innerDepth: p.innerCornerDepth,
    castShadow: p.castShadow,
    scree: p.scree,
    litLip: p.litLip,
    capMaterial: p.capMaterial,
    capRoll: p.capRoll,
  });

  const materialPrefix = `cliff${capitalize(p.material)}`;
  cliffGrids.forEach((grid, i) => {
    const variant = VARIANT_NAMES[Math.floor(i / 3)];
    const band = BAND_NAMES[i % 3];
    out.push({ name: `${materialPrefix}_${variant}_${band}`, grid });
  });

  // Plateau-edge blob set (47 tiles): over = plateau top, base = ground;
  // corner round tracks the cliff rim rounding when linkPlateauCorners.
  const plateauRound = p.linkPlateauCorners ? p.topRounding : p.cornerRounding;
  const plateauTiles = blobTiles(fills.get(p.plateauTop)!, fills.get(p.ground)!, {
    inset: p.edgeInset,
    irreg: p.edgeIrregularity,
    round: plateauRound,
    outline: p.edgeOutline,
    shadow: p.dropShadow,
    seed: p.seed,
    overKey: p.plateauTop,
    baseKey: p.ground,
  });
  for (const t of plateauTiles) out.push({ name: `${p.plateauTop}Plateau_${t.mask}`, grid: t.grid });

  // One blob set per (over, base) pairing (47 tiles each).
  for (const pr of p.pairings) {
    const tiles = blobTiles(fills.get(pr.over)!, fills.get(pr.base)!, {
      inset: p.edgeInset,
      irreg: p.edgeIrregularity,
      round: p.cornerRounding,
      outline: p.edgeOutline,
      shadow: p.dropShadow,
      seed: p.seed,
      overKey: pr.over,
      baseKey: pr.base,
    });
    const name = `${pr.over}${capitalize(pr.base)}`;
    for (const t of tiles) out.push({ name: `${name}_${t.mask}`, grid: t.grid });
  }

  // Ramp tiles (16 each) — one set per requested ramp material, appended
  // after every other group so existing indices never shift.
  for (const m of p.ramps) {
    const tiles = rampTiles({
      material: m,
      terrain: p.plateauTop,
      wall: p.material,
      height: p.cliffHeight,
      slope: 0.5,
      steps: 3,
      seed: p.seed,
    });
    const prefix = m === "sandSlope" ? "rampSand" : "rampSteps";
    for (const t of tiles) out.push({ name: `${prefix}_${t.col}_${t.row}`, grid: t.grid });
  }

  // Diagonal flight tiles — Phase 1c, appended after straight ramps. The 45°
  // block is emitted FIRST and unchanged so its frame indices stay put
  // (additive-only); the shallow/steep angles are appended after it.
  if (p.diagonalRamps) {
    const dirs = ["se", "sw"] as const;
    const groundRamp = TERRAIN_RAMPS[p.plateauTop];
    for (const m of p.ramps) {
      const matName = m === "sandSlope" ? "Sand" : "Steps";
      for (const dir of dirs) {
        const tiles = diagonalFlightTiles(m, dir, { seed: p.seed }, "45", groundRamp, p.material);
        for (const t of tiles) {
          out.push({
            name: `dramp${matName}45_${dir}_${t.piece}`,
            grid: t.grid,
          });
        }
      }
    }
    // Shallow (26.57°) + steep (63.43°), appended after the 45° group.
    const extraAngles = [
      { angle: "26.57", tag: "2657" },
      { angle: "63.43", tag: "6343" },
    ] as const;
    for (const { angle, tag } of extraAngles) {
      for (const m of p.ramps) {
        const matName = m === "sandSlope" ? "Sand" : "Steps";
        for (const dir of dirs) {
          const tiles = diagonalFlightTiles(m, dir, { seed: p.seed }, angle, groundRamp, p.material);
          for (const t of tiles) {
            out.push({
              name: `dramp${matName}${tag}_${dir}_${t.piece}`,
              grid: t.grid,
            });
          }
        }
      }
    }
  }

  return out;
}
