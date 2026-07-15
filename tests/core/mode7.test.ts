import { describe, expect, it } from "vitest";
import {
  MODE7_CAMERA_BACK,
  MODE7_CAMERA_HEIGHT,
  MODE7_FOCAL_LENGTH,
  MODE7_HORIZON_FRACTION,
  MODE7_MAX_DEPTH,
  type Mode7Camera,
  groundToUv,
  makeCamera,
  projectGround,
  worldToScreen
} from "../../src/core/mode7";

const SCREEN_W = 480;
const SCREEN_H = 270;

function cam(overrides: Partial<Mode7Camera> = {}): Mode7Camera {
  return {
    x: 128,
    y: 160,
    height: MODE7_CAMERA_HEIGHT,
    focal: MODE7_FOCAL_LENGTH,
    horizon: Math.round(SCREEN_H * MODE7_HORIZON_FRACTION),
    screenWidth: SCREEN_W,
    screenHeight: SCREEN_H,
    maxDepth: MODE7_MAX_DEPTH,
    ...overrides
  };
}

describe("makeCamera", () => {
  it("looks from the player x, offset back (south) in y", () => {
    const c = makeCamera(100, 200, SCREEN_W, SCREEN_H);
    expect(c.x).toBe(100);
    expect(c.y).toBe(200 + MODE7_CAMERA_BACK);
  });

  it("rounds the horizon to a whole scanline", () => {
    const c = makeCamera(0, 0, SCREEN_W, SCREEN_H);
    expect(c.horizon).toBe(Math.round(SCREEN_H * MODE7_HORIZON_FRACTION));
    expect(Number.isInteger(c.horizon)).toBe(true);
  });

  it("carries the default constants through, and honours overrides", () => {
    const d = makeCamera(0, 0, SCREEN_W, SCREEN_H);
    expect(d.focal).toBe(MODE7_FOCAL_LENGTH);
    expect(d.height).toBe(MODE7_CAMERA_HEIGHT);
    expect(d.maxDepth).toBe(MODE7_MAX_DEPTH);

    const o = makeCamera(0, 0, SCREEN_W, SCREEN_H, {
      focal: 200,
      height: 40,
      maxDepth: 800,
      back: 0,
      horizonFraction: 0.5
    });
    expect(o.focal).toBe(200);
    expect(o.height).toBe(40);
    expect(o.maxDepth).toBe(800);
    expect(o.y).toBe(0);
    expect(o.horizon).toBe(135);
  });
});

describe("projectGround — horizon and sky", () => {
  it("returns null for pixels above the horizon", () => {
    const c = cam();
    expect(projectGround(c, 240, c.horizon - 1)).toBeNull();
    expect(projectGround(c, 240, 0)).toBeNull();
  });

  it("returns null for the pixel exactly on the horizon", () => {
    const c = cam();
    expect(projectGround(c, 240, c.horizon)).toBeNull();
  });

  it("clamps the depth of pixels just below the horizon to maxDepth", () => {
    const c = cam();
    const near = projectGround(c, 240, c.horizon + 1)!;
    expect(near).not.toBeNull();
    // height*focal / 1 = 3840, far above the 640 clamp.
    expect(near.depth).toBe(c.maxDepth);
    expect(near.wy).toBe(c.y - c.maxDepth);
  });
});

describe("projectGround — near the camera", () => {
  it("maps the bottom of the screen close to the camera", () => {
    const c = cam();
    const bottom = projectGround(c, 240, c.screenHeight - 1)!;
    const p = c.screenHeight - 1 - c.horizon;
    expect(bottom.depth).toBeCloseTo((c.height * c.focal) / p, 6);
    // Well under the clamp, and only a couple of tiles ahead.
    expect(bottom.depth).toBeLessThan(50);
    expect(bottom.depth).toBeGreaterThan(0);
  });

  it("keeps the center column dead ahead (no horizontal offset)", () => {
    const c = cam();
    for (const sy of [c.horizon + 1, c.horizon + 40, c.screenHeight - 1]) {
      const s = projectGround(c, c.screenWidth / 2, sy)!;
      expect(s.wx).toBeCloseTo(c.x, 6);
    }
  });

  it("spreads columns left/right of center symmetrically", () => {
    const c = cam();
    const sy = c.horizon + 80;
    const left = projectGround(c, c.screenWidth / 2 - 100, sy)!;
    const right = projectGround(c, c.screenWidth / 2 + 100, sy)!;
    expect(left.wx).toBeLessThan(c.x);
    expect(right.wx).toBeGreaterThan(c.x);
    expect(c.x - left.wx).toBeCloseTo(right.wx - c.x, 6);
  });
});

describe("projectGround — perspective monotonicity", () => {
  it("gets closer (smaller depth) as the pixel moves down the screen", () => {
    const c = cam();
    let prev = Infinity;
    for (let sy = c.horizon + 1; sy < c.screenHeight; sy += 5) {
      const s = projectGround(c, 240, sy)!;
      expect(s.depth).toBeLessThanOrEqual(prev);
      prev = s.depth;
    }
  });

  it("looks north: nearer ground is at a larger world y than far ground", () => {
    const c = cam();
    const near = projectGround(c, 240, c.screenHeight - 1)!;
    const far = projectGround(c, 240, c.horizon + 30)!;
    expect(near.wy).toBeGreaterThan(far.wy);
    expect(far.wy).toBeLessThan(c.y);
  });
});

describe("projectGround — camera translation is predictable", () => {
  it("shifting camera x translates every mapped point by the same dx", () => {
    const base = cam();
    const moved = cam({ x: base.x + 37 });
    for (const [sx, sy] of [
      [120, 200],
      [240, 180],
      [400, 260]
    ] as const) {
      const a = projectGround(base, sx, sy)!;
      const b = projectGround(moved, sx, sy)!;
      expect(b.wx - a.wx).toBeCloseTo(37, 6);
      expect(b.wy).toBeCloseTo(a.wy, 6);
    }
  });

  it("shifting camera y translates world y by the same dy", () => {
    const base = cam();
    const moved = cam({ y: base.y - 22 });
    const a = projectGround(base, 300, 220)!;
    const b = projectGround(moved, 300, 220)!;
    expect(b.wy - a.wy).toBeCloseTo(-22, 6);
    expect(b.wx).toBeCloseTo(a.wx, 6);
  });
});

describe("projectGround — determinism", () => {
  it("is a pure function of its inputs", () => {
    const c = cam();
    for (const [sx, sy] of [
      [0, 269],
      [240, 150],
      [479, 200]
    ] as const) {
      expect(projectGround(c, sx, sy)).toEqual(projectGround(c, sx, sy));
    }
  });
});

describe("worldToScreen — the forward projection (Phase O billboards)", () => {
  it("is the exact inverse of projectGround for unclamped ground pixels", () => {
    const c = cam();
    // Sample screen pixels deep enough that projectGround doesn't clamp.
    for (const [sx, sy] of [
      [0, c.screenHeight - 1],
      [123, 200],
      [240, 180],
      [479, 240],
      [301, c.horizon + 2]
    ] as const) {
      const g = projectGround(c, sx, sy)!;
      if (g.depth >= c.maxDepth) continue; // clamped pixel: not invertible
      const s = worldToScreen(c, g.wx, g.wy)!;
      expect(s).not.toBeNull();
      expect(s.x).toBeCloseTo(sx, 6);
      expect(s.y).toBeCloseTo(sy, 6);
      expect(s.scale).toBeCloseTo(c.focal / g.depth, 6);
    }
  });

  it("round-trips world → screen → world", () => {
    const c = cam();
    for (const [wx, wy] of [
      [c.x, c.y - 40],
      [c.x - 90, c.y - 200],
      [c.x + 250, c.y - 600],
      [c.x + 3, c.y - c.maxDepth] // exactly at the far clamp: still valid
    ] as const) {
      const s = worldToScreen(c, wx, wy)!;
      expect(s).not.toBeNull();
      const g = projectGround(c, s.x, s.y)!;
      expect(g.wx).toBeCloseTo(wx, 5);
      expect(g.wy).toBeCloseTo(wy, 5);
    }
  });

  it("returns null for points at or behind the camera", () => {
    const c = cam();
    expect(worldToScreen(c, c.x, c.y)).toBeNull(); // depth 0
    expect(worldToScreen(c, c.x, c.y + 1)).toBeNull(); // behind (south of camera)
    expect(worldToScreen(c, c.x - 50, c.y + 500)).toBeNull();
  });

  it("returns null beyond maxDepth, non-null exactly at it", () => {
    const c = cam();
    expect(worldToScreen(c, c.x, c.y - c.maxDepth - 1)).toBeNull();
    const atClamp = worldToScreen(c, c.x, c.y - c.maxDepth)!;
    expect(atClamp).not.toBeNull();
    // The far clamp lands just below the horizon, never on or above it.
    expect(atClamp.y).toBeGreaterThan(c.horizon);
    expect(atClamp.y).toBeCloseTo(c.horizon + (c.height * c.focal) / c.maxDepth, 6);
  });

  it("always lands strictly below the horizon (sky is unreachable)", () => {
    const c = cam();
    for (let d = 1; d <= c.maxDepth; d += 41) {
      const s = worldToScreen(c, c.x + d / 3, c.y - d)!;
      expect(s.y).toBeGreaterThan(c.horizon);
    }
  });

  it("reports off-screen lateral points instead of nulling them (caller culls)", () => {
    const c = cam();
    const s = worldToScreen(c, c.x - 5000, c.y - 100)!;
    expect(s).not.toBeNull();
    expect(s.x).toBeLessThan(0);
  });

  it("scale shrinks monotonically with depth (∝ focal/depth)", () => {
    const c = cam();
    let prev = Infinity;
    for (let d = 10; d <= c.maxDepth; d += 30) {
      const s = worldToScreen(c, c.x, c.y - d)!;
      expect(s.scale).toBeLessThan(prev);
      expect(s.scale).toBeCloseTo(c.focal / d, 6);
      prev = s.scale;
    }
  });

  it("is deterministic", () => {
    const c = cam();
    expect(worldToScreen(c, 77, 33)).toEqual(worldToScreen(c, 77, 33));
  });
});

describe("groundToUv", () => {
  it("normalises in-bounds points and clamps out-of-bounds ones", () => {
    expect(groundToUv(128, 160, 256, 320)).toEqual({ u: 0.5, v: 0.5 });
    expect(groundToUv(0, 0, 256, 320)).toEqual({ u: 0, v: 0 });
    expect(groundToUv(256, 320, 256, 320)).toEqual({ u: 1, v: 1 });
    // Past the edges -> clamped, not wrapped.
    expect(groundToUv(-500, -500, 256, 320)).toEqual({ u: 0, v: 0 });
    expect(groundToUv(9000, 9000, 256, 320)).toEqual({ u: 1, v: 1 });
  });
});
