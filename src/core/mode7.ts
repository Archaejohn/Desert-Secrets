/**
 * SNES "Mode 7" inverse-perspective projection — pure math, no engine.
 *
 * Mode 7 paints ONE flat 2D texture as a ground plane seen obliquely from a
 * fixed pitch: sky above a horizon line, ground receding below it. There is
 * no real 3D geometry — "mountains" are just shaded 2D art on the flat plane.
 * Per screen pixel below the horizon we invert the perspective to find the
 * ground point it looks at: the further BELOW the horizon a pixel is, the
 * CLOSER to the camera it lands (large texture step per pixel); right at the
 * horizon the step goes to infinity (the classic stretched-to-the-horizon
 * look). The camera is north-up and never rotates (FF6 world-map style), so
 * "forward / into the screen" is always the −y world direction.
 *
 * The GLSL shader in the presentation layer re-implements the same formula;
 * these constants are the single source of truth it is fed as uniforms, and
 * this module is the tested reference for the math.
 */

/** Horizon line as a fraction of screen height (0 = top). 0.42 keeps a
 *  generous ground area while leaving room for a dusk sky + ridge band. */
export const MODE7_HORIZON_FRACTION = 0.42;

/** Screen-space focal length in px. Larger = narrower FOV / flatter pitch;
 *  160 (2/3 of the 240px half-width) gives a natural ~74° horizontal FOV. */
export const MODE7_FOCAL_LENGTH = 160;

/** Camera eye height above the ground plane, in world px (1.5 tiles). Low
 *  enough that near tiles loom large, high enough to see a fair way ahead. */
export const MODE7_CAMERA_HEIGHT = 24;

/** Forward distance is clamped here (world px) so pixels at the horizon map
 *  to a finite, far ground point instead of +infinity. Beyond the map this
 *  clamps to the edge tiles (see groundToUv), reading as far mountains. */
export const MODE7_MAX_DEPTH = 640;

/** The camera sits this many world px BEHIND (south of) the player, so the
 *  player's own tile appears a little up from the bottom edge rather than
 *  off-screen under the camera. Keeps the fixed player sprite visually
 *  standing ON the terrain it occupies. */
export const MODE7_CAMERA_BACK = 32;

export interface Mode7Camera {
  /** World position the camera looks from (x = player x). */
  x: number;
  /** World position the camera looks from (y = player y + back offset). */
  y: number;
  /** Eye height above the ground plane, world px. */
  height: number;
  /** Screen-space focal length, px. */
  focal: number;
  /** Horizon line, top-origin screen px. */
  horizon: number;
  screenWidth: number;
  screenHeight: number;
  /** Forward-distance clamp, world px. */
  maxDepth: number;
}

export interface GroundSample {
  /** World-space ground point the pixel looks at. */
  wx: number;
  wy: number;
  /** Forward distance from the camera to that point, world px. */
  depth: number;
}

export interface Mode7Overrides {
  horizonFraction?: number;
  focal?: number;
  height?: number;
  maxDepth?: number;
  back?: number;
}

/**
 * Build a camera that looks north from just behind the player. `horizon` is
 * rounded to a whole pixel so the shader's sky/ground split lands on a crisp
 * scanline.
 */
export function makeCamera(
  playerX: number,
  playerY: number,
  screenWidth: number,
  screenHeight: number,
  overrides: Mode7Overrides = {}
): Mode7Camera {
  const horizonFraction = overrides.horizonFraction ?? MODE7_HORIZON_FRACTION;
  const back = overrides.back ?? MODE7_CAMERA_BACK;
  return {
    x: playerX,
    y: playerY + back,
    height: overrides.height ?? MODE7_CAMERA_HEIGHT,
    focal: overrides.focal ?? MODE7_FOCAL_LENGTH,
    horizon: Math.round(screenHeight * horizonFraction),
    screenWidth,
    screenHeight,
    maxDepth: overrides.maxDepth ?? MODE7_MAX_DEPTH
  };
}

/**
 * Invert the perspective for one screen pixel. Returns the world ground point
 * it looks at, or null for pixels ON or ABOVE the horizon (that's sky — there
 * is no ground there). Deterministic; no randomness.
 */
export function projectGround(
  cam: Mode7Camera,
  screenX: number,
  screenY: number
): GroundSample | null {
  const p = screenY - cam.horizon;
  if (p <= 0) return null;

  let depth = (cam.height * cam.focal) / p;
  if (depth > cam.maxDepth) depth = cam.maxDepth;

  const right = ((screenX - cam.screenWidth / 2) * depth) / cam.focal;
  return {
    wx: cam.x + right,
    wy: cam.y - depth,
    depth
  };
}

export interface ScreenPoint {
  /** Screen x, px (may be off-screen left/right — lateral culling is the
   *  caller's job; only depth makes this null). */
  x: number;
  /** Screen y, top-origin px. Always strictly below the horizon. */
  y: number;
  /** Perspective scale at this depth: screen px per world px (focal/depth).
   *  Multiply a billboard's world size by this to get its display size. */
  scale: number;
}

/**
 * Forward projection — the exact inverse of `projectGround`: where on
 * screen does the world ground point (wx, wy) land? Returns null when the
 * point is at/behind the camera (depth ≤ 0 — which is also the only way it
 * could reach or rise above the horizon) or beyond the maxDepth clamp
 * (past the far haze; the ground there samples the clamp plane, so a
 * billboard would float on nothing). Deterministic, no randomness.
 */
export function worldToScreen(cam: Mode7Camera, wx: number, wy: number): ScreenPoint | null {
  const depth = cam.y - wy; // forward = −y = north
  if (depth <= 0) return null;
  if (depth > cam.maxDepth) return null;
  const scale = cam.focal / depth;
  return {
    x: cam.screenWidth / 2 + (wx - cam.x) * scale,
    y: cam.horizon + cam.height * scale,
    scale
  };
}

/**
 * Map a world ground point onto the painted top-down texture's UV space,
 * clamped to [0,1] (edge-clamp addressing — the desert is a walled pass, so
 * sampling past an edge holds the border mountains rather than wrapping the
 * whole map). v is NOT flipped here; the presentation layer handles the GL
 * texture orientation.
 */
export function groundToUv(
  wx: number,
  wy: number,
  mapWidth: number,
  mapHeight: number
): { u: number; v: number } {
  return {
    u: clamp01(wx / mapWidth),
    v: clamp01(wy / mapHeight)
  };
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}
