import { describe, expect, it } from "vitest";
import {
  buildStopLut,
  clamp01,
  colorToRgb,
  linearFalloffT,
  normalizeStops,
  projectWorldToScreen,
  pulseValue,
  radialFalloffT,
  sampleStops,
  type CameraView,
  type LightStop
} from "../../src/core/lighting";

describe("clamp01", () => {
  it("clamps to the unit interval", () => {
    expect(clamp01(-3)).toBe(0);
    expect(clamp01(0.4)).toBe(0.4);
    expect(clamp01(9)).toBe(1);
  });
});

describe("colorToRgb", () => {
  it("splits a 0xRRGGBB integer", () => {
    expect(colorToRgb(0x3b3a63)).toEqual([0x3b, 0x3a, 0x63]);
    expect(colorToRgb(0xffffff)).toEqual([255, 255, 255]);
    expect(colorToRgb(0x000000)).toEqual([0, 0, 0]);
  });
  it("parses #rrggbb and #rgb strings (with or without the hash)", () => {
    expect(colorToRgb("#ff8040")).toEqual([255, 128, 64]);
    expect(colorToRgb("7fa8c9")).toEqual([0x7f, 0xa8, 0xc9]);
    expect(colorToRgb("#0af")).toEqual([0x00, 0xaa, 0xff]);
  });
  it("throws on garbage", () => {
    expect(() => colorToRgb("not-a-colour")).toThrow();
    expect(() => colorToRgb("#12")).toThrow();
  });
});

describe("normalizeStops", () => {
  it("throws when there are no stops", () => {
    expect(() => normalizeStops([])).toThrow();
  });
  it("clamps offsets/alphas and sorts ascending by offset", () => {
    const stops: LightStop[] = [
      { offset: 1.4, color: 0xffffff, alpha: 2 },
      { offset: -0.2, color: "#3b3a63", alpha: -1 },
      { offset: 0.5, color: 0x55b087, alpha: 0.5 }
    ];
    const n = normalizeStops(stops);
    expect(n.map((s) => s.offset)).toEqual([0, 0.5, 1]);
    expect(n[0]).toMatchObject({ r: 0x3b, g: 0x3a, b: 0x63, a: 0 });
    expect(n[2]).toMatchObject({ r: 255, g: 255, b: 255, a: 1 });
  });
  it("is a stable sort for equal offsets (hard colour break)", () => {
    const n = normalizeStops([
      { offset: 0.5, color: 0x111111, alpha: 1 },
      { offset: 0.5, color: 0x222222, alpha: 1 }
    ]);
    expect(n[0].r).toBe(0x11);
    expect(n[1].r).toBe(0x22);
  });
});

describe("sampleStops", () => {
  const stops = normalizeStops([
    { offset: 0, color: 0x000000, alpha: 1 },
    { offset: 1, color: 0xffffff, alpha: 0 }
  ]);
  it("returns the endpoint values outside the range (clamped)", () => {
    expect(sampleStops(stops, -5)).toEqual({ r: 0, g: 0, b: 0, a: 1 });
    expect(sampleStops(stops, 5)).toEqual({ r: 255, g: 255, b: 255, a: 0 });
  });
  it("interpolates colour and alpha at the midpoint", () => {
    const mid = sampleStops(stops, 0.5);
    expect(mid.r).toBe(128);
    expect(mid.g).toBe(128);
    expect(mid.b).toBe(128);
    expect(mid.a).toBeCloseTo(0.5, 6);
  });
  it("handles a three-stop blue→white→clear gradient", () => {
    const g = normalizeStops([
      { offset: 0, color: 0x3b3a63, alpha: 1 },
      { offset: 0.5, color: 0xffffff, alpha: 0.8 },
      { offset: 1, color: 0xffffff, alpha: 0 }
    ]);
    expect(sampleStops(g, 0).r).toBe(0x3b);
    expect(sampleStops(g, 0.5)).toMatchObject({ r: 255, g: 255, b: 255 });
    expect(sampleStops(g, 1).a).toBe(0);
    // Quarter-way into the first span: partway from indigo toward white.
    const q = sampleStops(g, 0.25);
    expect(q.r).toBeGreaterThan(0x3b);
    expect(q.r).toBeLessThan(255);
  });
});

describe("buildStopLut", () => {
  const stops = normalizeStops([
    { offset: 0, color: 0x000000, alpha: 1 },
    { offset: 1, color: 0xffffff, alpha: 0 }
  ]);
  it("has size*4 bytes and pins the endpoints", () => {
    const lut = buildStopLut(stops, 256);
    expect(lut.length).toBe(256 * 4);
    expect([lut[0], lut[1], lut[2], lut[3]]).toEqual([0, 0, 0, 255]);
    const last = 255 * 4;
    expect([lut[last], lut[last + 1], lut[last + 2], lut[last + 3]]).toEqual([255, 255, 255, 0]);
  });
  it("is deterministic", () => {
    expect(buildStopLut(stops)).toEqual(buildStopLut(stops));
  });
  it("copes with size 1", () => {
    const lut = buildStopLut(stops, 1);
    expect(lut.length).toBe(4);
    expect([lut[0], lut[3]]).toEqual([0, 255]);
  });
});

describe("radialFalloffT", () => {
  it("is 0 at the centre and 1 at the axis edges (circle)", () => {
    expect(radialFalloffT("circle", 0, 0, 100, 100)).toBe(0);
    expect(radialFalloffT("circle", 100, 0, 100, 100)).toBeCloseTo(1, 6);
    expect(radialFalloffT("circle", 0, 100, 100, 100)).toBeCloseTo(1, 6);
  });
  it("circle: the corner is further than the edge (round falloff), clamped to 1", () => {
    // (100,100) in a 100-radius circle is √2 out — clamps to 1.
    expect(radialFalloffT("circle", 100, 100, 100, 100)).toBe(1);
    // Halfway along a diagonal is > halfway radius.
    expect(radialFalloffT("circle", 50, 50, 100, 100)).toBeCloseTo(Math.hypot(0.5, 0.5), 6);
  });
  it("square: the corner is still on the edge (boxy falloff)", () => {
    expect(radialFalloffT("square", 100, 100, 100, 100)).toBeCloseTo(1, 6);
    expect(radialFalloffT("square", 50, 20, 100, 100)).toBeCloseTo(0.5, 6);
  });
  it("respects an elliptical (non-square) footprint", () => {
    expect(radialFalloffT("circle", 200, 0, 200, 100)).toBeCloseTo(1, 6);
    expect(radialFalloffT("circle", 0, 100, 200, 100)).toBeCloseTo(1, 6);
  });
});

describe("linearFalloffT", () => {
  it("runs 0→1 left→right at angle 0", () => {
    expect(linearFalloffT(-50, 0, 0, 100, 100)).toBeCloseTo(0, 6);
    expect(linearFalloffT(0, 0, 0, 100, 100)).toBeCloseTo(0.5, 6);
    expect(linearFalloffT(50, 0, 0, 100, 100)).toBeCloseTo(1, 6);
  });
  it("runs top→bottom at angle π/2 (and ignores the cross axis)", () => {
    const a = Math.PI / 2;
    expect(linearFalloffT(0, -50, a, 100, 100)).toBeCloseTo(0, 6);
    expect(linearFalloffT(999, 0, a, 100, 100)).toBeCloseTo(0.5, 6);
    expect(linearFalloffT(0, 50, a, 100, 100)).toBeCloseTo(1, 6);
  });
  it("clamps past the edges", () => {
    expect(linearFalloffT(-9999, 0, 0, 100, 100)).toBe(0);
    expect(linearFalloffT(9999, 0, 0, 100, 100)).toBe(1);
  });
});

describe("pulseValue", () => {
  const spec = { min: 0.2, max: 0.8, periodMs: 1000 };
  it("sits at min at phase 0 and max at the half period", () => {
    expect(pulseValue(spec, 0)).toBeCloseTo(0.2, 6);
    expect(pulseValue(spec, 500)).toBeCloseTo(0.8, 6);
    expect(pulseValue(spec, 1000)).toBeCloseTo(0.2, 6);
  });
  it("stays within [min,max] across the cycle", () => {
    for (let t = 0; t <= 2000; t += 37) {
      const v = pulseValue(spec, t);
      expect(v).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(v).toBeLessThanOrEqual(0.8 + 1e-9);
    }
  });
  it("is seamless across the loop point and handles negative phase", () => {
    expect(pulseValue(spec, 999.999)).toBeCloseTo(pulseValue(spec, -0.001), 4);
    expect(pulseValue({ ...spec, phaseMs: -250 }, 250)).toBeCloseTo(0.2, 6);
  });
  it("is deterministic", () => {
    expect(pulseValue(spec, 321)).toBe(pulseValue(spec, 321));
  });
});

describe("projectWorldToScreen", () => {
  const base: CameraView = {
    scrollX: 100,
    scrollY: 50,
    zoom: 1,
    width: 480,
    height: 270,
    originX: 0.5,
    originY: 0.5
  };
  it("at zoom 1 is simply world minus scroll", () => {
    expect(projectWorldToScreen(base, 100, 50)).toEqual({ x: 0, y: 0 });
    expect(projectWorldToScreen(base, 340, 185)).toEqual({ x: 240, y: 135 });
  });
  it("keeps the camera's world midpoint pinned to screen centre at any zoom", () => {
    // midpoint = scroll + half viewport = (100+240, 50+135) = (340,185).
    const mid = { x: 340, y: 185 };
    for (const zoom of [0.5, 0.7, 1, 2]) {
      const s = projectWorldToScreen({ ...base, zoom }, mid.x, mid.y);
      expect(s.x).toBeCloseTo(240, 6);
      expect(s.y).toBeCloseTo(135, 6);
    }
  });
  it("scales offsets from the midpoint by the zoom (fractional overworld zoom)", () => {
    // A point one viewport-half right of the midpoint, at zoom 0.7.
    const s = projectWorldToScreen({ ...base, zoom: 0.7 }, 340 + 240, 185);
    expect(s.x).toBeCloseTo(240 + 240 * 0.7, 6);
    expect(s.y).toBeCloseTo(135, 6);
  });
  it("is deterministic", () => {
    expect(projectWorldToScreen(base, 12, 34)).toEqual(projectWorldToScreen(base, 12, 34));
  });
});
