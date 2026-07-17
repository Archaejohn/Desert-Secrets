/**
 * Pure math for the light-mask / lighting-overlay subsystem (presentation
 * lives in `src/game/gfx/LightMask.ts`). Nothing here imports Phaser: it's
 * the gradient sampling, the falloff-shape distance fields, the time-driven
 * pulse curve, and the world→screen projection — all deterministic, all
 * unit-tested — that the canvas/Phaser layer feeds pixels and transforms to.
 *
 * Keeping this here (rather than inline in the drawing code) is what lets the
 * repo test the load-bearing bits that are easy to get subtly wrong: the
 * multi-stop interpolation, the circle-vs-square falloff, and — the one the
 * two-camera architecture makes fiddly — projecting a world point to a screen
 * pixel at an arbitrary camera zoom (the overworld runs at a fractional zoom;
 * every other zone at 1).
 */

/** A single gradient stop as authored: an offset along the gradient (0..1), a
 *  colour (0xRRGGBB int or "#rrggbb" string), and an alpha (0..1). */
export interface LightStop {
  offset: number;
  color: number | string;
  alpha: number;
}

/** A gradient stop after normalisation: colour split to 0–255 channels,
 *  offset/alpha clamped to [0,1]. */
export interface NormStop {
  offset: number;
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Falloff footprint shape for a radial light: round (euclidean distance) or
 *  boxy (chebyshev distance — a square glow with straight sides). */
export type FalloffShape = "circle" | "square";

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Split a colour (0xRRGGBB int, or "#rgb"/"#rrggbb" string) into [r,g,b]. */
export function colorToRgb(color: number | string): [number, number, number] {
  if (typeof color === "number") {
    return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
  }
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim());
  if (!m) throw new Error(`Invalid light colour: ${color}`);
  let hex = m[1];
  if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  const v = parseInt(hex, 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/**
 * Clamp, split and sort authored stops into a form `sampleStops` can walk.
 * Offsets and alphas are clamped to [0,1]; the list is sorted ascending by
 * offset (stably, so equal-offset stops keep their authored order for a hard
 * colour break). Throws on an empty list — a light with no stops has nothing
 * to draw and is always a mistake worth catching early.
 */
export function normalizeStops(stops: readonly LightStop[]): NormStop[] {
  if (stops.length === 0) throw new Error("A light needs at least one gradient stop");
  const out = stops.map((s) => {
    const [r, g, b] = colorToRgb(s.color);
    return { offset: clamp01(s.offset), r, g, b, a: clamp01(s.alpha) };
  });
  // Index-tagged sort keeps it stable across engines (Array.sort stability is
  // only guaranteed in modern engines, but the tag makes it explicit).
  return out
    .map((s, i) => ({ s, i }))
    .sort((p, q) => p.s.offset - q.s.offset || p.i - q.i)
    .map((p) => p.s);
}

/**
 * Sample the (already normalised) stop list at position `t` in [0,1],
 * linearly interpolating colour and alpha between the two surrounding stops.
 * Before the first stop it holds the first stop's value; after the last, the
 * last's (standard gradient clamp behaviour).
 */
export function sampleStops(stops: readonly NormStop[], t: number): Rgba {
  const x = clamp01(t);
  const first = stops[0];
  if (x <= first.offset) return { r: first.r, g: first.g, b: first.b, a: first.a };
  const last = stops[stops.length - 1];
  if (x >= last.offset) return { r: last.r, g: last.g, b: last.b, a: last.a };
  for (let i = 1; i < stops.length; i++) {
    const s1 = stops[i];
    if (x <= s1.offset) {
      const s0 = stops[i - 1];
      const span = s1.offset - s0.offset;
      const f = span <= 0 ? 0 : (x - s0.offset) / span;
      return {
        r: Math.round(s0.r + (s1.r - s0.r) * f),
        g: Math.round(s0.g + (s1.g - s0.g) * f),
        b: Math.round(s0.b + (s1.b - s0.b) * f),
        a: s0.a + (s1.a - s0.a) * f
      };
    }
  }
  return { r: last.r, g: last.g, b: last.b, a: last.a };
}

/**
 * Bake the stop list into a `size`-entry RGBA lookup table (default 256), so
 * the per-pixel bake loop can index by `round(t * (size-1))` instead of
 * re-walking the stops for every texel. Returned as flat RGBA bytes
 * (`[r,g,b,a, r,g,b,a, …]`, alpha 0–255). Pure, so a determinism / first-and-
 * last-entry test can pin it.
 */
export function buildStopLut(stops: readonly NormStop[], size = 256): Uint8ClampedArray {
  const lut = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    const c = sampleStops(stops, size === 1 ? 0 : i / (size - 1));
    const o = i * 4;
    lut[o] = c.r;
    lut[o + 1] = c.g;
    lut[o + 2] = c.b;
    lut[o + 3] = Math.round(clamp01(c.a) * 255);
  }
  return lut;
}

/**
 * Normalised radial falloff position (0 at the centre, 1 at the footprint
 * edge) for a pixel offset (`dx`,`dy`) from the centre of a `halfW`×`halfH`
 * footprint. "circle" uses the elliptical euclidean distance; "square" uses
 * the chebyshev (max-axis) distance, which gives a boxy glow with straight
 * sides and square corners. Values past the edge clamp to 1.
 */
export function radialFalloffT(shape: FalloffShape, dx: number, dy: number, halfW: number, halfH: number): number {
  const nx = halfW <= 0 ? 0 : dx / halfW;
  const ny = halfH <= 0 ? 0 : dy / halfH;
  const d = shape === "square" ? Math.max(Math.abs(nx), Math.abs(ny)) : Math.hypot(nx, ny);
  return clamp01(d);
}

/**
 * Normalised linear-gradient position (0..1) for a pixel offset from the
 * footprint centre, for a directional wash at `angleRad` (0 = left→right,
 * π/2 = top→bottom). The gradient runs the full extent of the footprint along
 * that direction, so offset 0 is the up-gradient edge and 1 the down-gradient
 * edge regardless of angle.
 */
export function linearFalloffT(dx: number, dy: number, angleRad: number, w: number, h: number): number {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  // Length of the footprint's projection onto the gradient direction — the
  // extent the gradient spans, so a diagonal wash still runs edge to edge.
  const extent = Math.abs(cos) * w + Math.abs(sin) * h;
  if (extent <= 0) return 0;
  const proj = dx * cos + dy * sin;
  return clamp01(proj / extent + 0.5);
}

/** A time-driven pulse: value eases between `min` and `max` on a cosine wave
 *  of period `periodMs`, offset by `phaseMs`. At phase 0 it sits at `min`,
 *  half a period later at `max` — a smooth, seamless breathe (no jump at the
 *  loop point). Driven by the scene clock, never `Math.random`, so it's
 *  deterministic for a given time. */
export interface PulseSpec {
  min: number;
  max: number;
  periodMs: number;
  phaseMs?: number;
}

export function pulseValue(spec: PulseSpec, timeMs: number): number {
  const period = spec.periodMs > 0 ? spec.periodMs : 1;
  const phase = (((timeMs + (spec.phaseMs ?? 0)) % period) + period) % period; // 0..period, never negative
  const wave = 0.5 - 0.5 * Math.cos((phase / period) * Math.PI * 2); // 0 → 1 → 0
  return spec.min + (spec.max - spec.min) * wave;
}

/** The minimal camera view a world→screen projection needs. Mirrors the
 *  fields a Phaser.Cameras.Scene2D.Camera exposes (scrollX/Y, zoom, width,
 *  height, originX/Y), so `projectWorldToScreen` can be handed the real
 *  camera directly while staying Phaser-free and testable here. */
export interface CameraView {
  scrollX: number;
  scrollY: number;
  zoom: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

/**
 * Project a world point to a screen pixel under a camera at arbitrary zoom.
 *
 * Phaser applies camera zoom about the camera's origin pivot (default the
 * screen centre), NOT about the top-left — so the naive `(wx - scrollX) *
 * zoom` is wrong at any zoom ≠ 1. The camera's world midpoint (scroll + half
 * the viewport) always maps to the pivot on screen; every other point scales
 * away from it by `zoom`. At zoom 1 this reduces to `wx - scrollX`, matching
 * the flat zones; at the overworld's fractional zoom it stays correct.
 */
export function projectWorldToScreen(cam: CameraView, wx: number, wy: number): { x: number; y: number } {
  const pivotX = cam.width * cam.originX;
  const pivotY = cam.height * cam.originY;
  return {
    x: (wx - cam.scrollX - pivotX) * cam.zoom + pivotX,
    y: (wy - cam.scrollY - pivotY) * cam.zoom + pivotY
  };
}
