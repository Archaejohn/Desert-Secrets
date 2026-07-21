/**
 * World-position ground fills. Each terrain re-expresses its approved
 * `cliffs/terrains.ts` `floorFill` recipe at absolute world coords (killing
 * the 16px repeat), plus a low-freq macro tonal drift and a per-material
 * grain ("de-tile + enrich"). Output is a PaletteName from the terrain's ramp.
 */
import { PixelGrid } from "../grid";
import { h2 } from "../cliffs/noise";
import { worldFbm, worldMacro } from "./worldNoise";
import { TERRAIN_RAMPS, type TerrainKey } from "../cliffs/palette";
import type { PaletteName } from "../../../../src/shared/palette";

/** Per-material grain: [xScale,yScale] applied to world coords before worldFbm.
 *  A scale < 1 on an axis STRETCHES features along it. */
export const GRAIN: Record<TerrainKey, [number, number]> = {
  groveGrass: [1, 0.6], rimeMoss: [1, 0.7], glowMoss: [1, 0.7],   // vertical bias
  reefWater: [0.6, 1], groveWater: [0.6, 1], lava: [0.6, 1],      // horizontal drift
  sand: [1, 1], frostSand: [1, 1], asphalt: [1, 1], reefFloor: [1, 1], reefSilt: [1, 1],
  snow: [1, 1], ice: [1, 1], frozenLake: [1, 1], emberRock: [1, 1], ash: [1, 1],
  lavaCrust: [1, 1], groveMoss: [1, 1], groveSoil: [1, 1],
};

/** Stable, per-key distinct seed (replaces floorFill's collision-prone key.length*13). */
export const keySeed = (k: string): number =>
  [...k].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 7);

const clampIdx = (i: number, n: number): number => (i < 0 ? 0 : i >= n ? n - 1 : i);

export function fill(key: TerrainKey, wx: number, wy: number): PaletteName {
  const ramp = TERRAIN_RAMPS[key];
  const seed = keySeed(key);
  const [gx, gy] = GRAIN[key];
  const drift = (worldMacro(wx, wy, seed + 7) - 0.5) * 0.15;     // broad tonal drift
  const v = worldFbm(wx * gx, wy * gy, seed) + drift;            // grain via gx/gy
  const ix = Math.floor(wx), iy = Math.floor(wy);               // integer world cell for flecks
  let idx: number;

  switch (key) {
    case "sand":
    case "frostSand":
      idx = 1;
      if (h2(ix, iy, seed + 31) > 0.95) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.96) idx = 2;
      if (v > 0.62) idx = clampIdx(idx - 1, ramp.length);        // macro light patch
      else if (v < 0.38) idx = clampIdx(idx + 1, ramp.length);   // macro dark patch
      break;
    case "asphalt":
      idx = v < 0.58 ? 2 : v < 0.82 ? 1 : 3;
      if (h2(ix, iy, seed + 77) > 0.93) idx = 0;
      break;
    case "reefFloor": // idx=1; h2>0.97 -> 2; else h2>0.985 -> 0
      idx = 1;
      if (h2(ix, iy, seed + 53) > 0.97) idx = 2;
      else if (h2(ix, iy, seed + 31) > 0.985) idx = 0;
      break;
    case "reefSilt": // idx=1; h2>0.94 -> 3; else h2>0.98 -> 0
      idx = 1;
      if (h2(ix, iy, seed + 53) > 0.94) idx = 3;
      else if (h2(ix, iy, seed + 31) > 0.98) idx = 0;
      break;
    case "reefWater": // v<0.5?1:2; h2>0.92 -> 0
      idx = v < 0.5 ? 1 : 2;
      if (h2(ix, iy, seed + 31) > 0.92) idx = 0;
      break;
    case "glowMoss": // v<0.5?2:1; h2>0.88 -> 0
      idx = v < 0.5 ? 2 : 1;
      if (h2(ix, iy, seed + 31) > 0.88) idx = 0;
      break;
    case "ice": // white body idx0; h2>0.88 -> 1 (skyBlue accent); rare tile-local
      // Voronoi hairline seam DROPPED (see docs/CONTRACTS.md note / task-3
      // report — that construction is inherently tile-periodic).
      idx = 0;
      if (h2(ix, iy, seed + 31) > 0.88) idx = 1;
      break;
    case "snow": // idx=1; h2>0.90 -> 0; else h2>0.97 -> 2
      idx = 1;
      if (h2(ix, iy, seed + 31) > 0.90) idx = 0;
      else if (h2(ix, iy, seed + 53) > 0.97) idx = 2;
      break;
    case "frozenLake": // v<0.5?1:0; h2>0.93 -> 2; else h2>0.985 -> 3
      idx = v < 0.5 ? 1 : 0;
      if (h2(ix, iy, seed + 53) > 0.93) idx = 2;
      else if (h2(ix, iy, seed + 61) > 0.985) idx = 3;
      break;
    case "rimeMoss": // v<0.5?2:1; h2>0.85 -> 0
      idx = v < 0.5 ? 2 : 1;
      if (h2(ix, iy, seed + 31) > 0.85) idx = 0;
      break;
    default:
      idx = 1; // lava/grove branches added in Task 4
  }
  return ramp[clampIdx(idx, ramp.length)];
}

export function fillField(key: TerrainKey, ox: number, oy: number, w: number, h: number): PixelGrid {
  const g = new PixelGrid(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) g.px(x, y, fill(key, ox + x, oy + y));
  return g;
}
