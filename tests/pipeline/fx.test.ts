/**
 * Phase F foundation (docs/ART_DIRECTION.md §8): the fx.ts drawing-technique
 * library and the tilecraft.ts tile-role composers. Asserts the §1 G-rules
 * that are checkable mechanically: determinism, palette compliance, the §3
 * shadow LUT's totality/darkness, G4 value hierarchy (cap vs face), G5
 * motif scatter bounds and G7 dither coverage.
 */
import { describe, expect, it } from "vitest";
import { PALETTE, hexToRgb, type PaletteName } from "../../src/shared/palette";
import { PixelGrid } from "../../tools/pipeline/src/grid";
import {
  canopyLobes,
  capLip,
  clusterDither,
  edgeFingers,
  ellipse,
  faceGradient,
  ridgeLine,
  scatterMotifs,
  shadeGrid,
  shadeTopRows,
  shadowOf,
  SHADOW_TERMINATORS,
  SIDES,
  strata,
  voidLip,
  type Side
} from "../../tools/pipeline/src/fx";
import {
  makeCap,
  makeEdgeSet,
  makeFace,
  makeShadeVariant
} from "../../tools/pipeline/src/tilecraft";

const NAMES = Object.keys(PALETTE) as PaletteName[];

/** Rec.709 luminance of a palette entry. */
function luminance(name: PaletteName): number {
  const [r, g, b] = hexToRgb(PALETTE[name]);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mean luminance over a grid's opaque cells. */
function avgLuminance(grid: PixelGrid): number {
  let sum = 0;
  let n = 0;
  grid.forEach((_x, _y, c) => {
    if (c !== null) {
      sum += luminance(c);
      n++;
    }
  });
  return n === 0 ? 0 : sum / n;
}

function expectPaletteOnly(grid: PixelGrid): void {
  grid.forEach((x, y, c) => {
    if (c !== null && !NAMES.includes(c)) {
      throw new Error(`non-palette cell "${c}" at ${x},${y}`);
    }
  });
}

/** A plain textured sand floor tile to run techniques against. */
function sandTile(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.rect(0, 0, 16, 16, "sand");
  g.rect(3, 3, 2, 2, "sandLight");
  g.rect(10, 8, 2, 2, "amber");
  g.rect(6, 12, 2, 2, "jade");
  return g;
}

/** A plain deep-water tile (distinct from the surf recipe's own colours). */
function waterTile(): PixelGrid {
  const g = new PixelGrid(16, 16);
  g.rect(0, 0, 16, 16, "indigo");
  g.rect(2, 5, 4, 1, "slate");
  g.rect(9, 11, 4, 1, "slate");
  return g;
}

// ---------------------------------------------------------------------------

describe("palette additions (§3)", () => {
  it("umber/sandShade and the cool stone ramp are appended with the spec'd values", () => {
    // AAP-64 migration (2026-07-20): these 25 legacy names were re-hexed to
    // their nearest AAP-64 core colours; PALETTE is the source of truth.
    expect(PALETTE.umber).toBe("#71413b");
    expect(PALETTE.sandShade).toBe("#c7b08b");
    expect(PALETTE.stoneLit).toBe("#b3b9d1");
    expect(PALETTE.stone).toBe("#6d758d");
    expect(PALETTE.stoneDark).toBe("#4a5462");
    expect(PALETTE.stoneDeep).toBe("#333941");
    // The desert-cliff cool stone ramp sits right after sandShade and right
    // before the 39 AAP-64 colors appended by the CORE=AAP-64 migration
    // (2026-07-20); existing entries were not reordered. (No longer the
    // literal last 4 names in PALETTE now that the 39 appended colors follow
    // them — check contiguity/position instead.)
    const stoneStart = NAMES.indexOf("stoneLit");
    expect(NAMES.slice(stoneStart, stoneStart + 4)).toEqual([
      "stoneLit",
      "stone",
      "stoneDark",
      "stoneDeep"
    ]);
    expect(NAMES[stoneStart - 1]).toBe("sandShade");
    expect(NAMES[stoneStart + 4]).toBe("red0");
  });
});

describe("shadowOf LUT (G2, §3)", () => {
  it("is total: every palette name maps to a palette name", () => {
    for (const name of NAMES) {
      expect(shadowOf[name], `shadowOf.${name} missing`).toBeDefined();
      expect(NAMES).toContain(shadowOf[name]);
    }
  });

  it("has no identity mappings except the declared terminators", () => {
    for (const name of NAMES) {
      if (SHADOW_TERMINATORS.includes(name)) {
        expect(shadowOf[name]).toBe(name);
      } else {
        expect(shadowOf[name], `shadowOf.${name} must not be identity`).not.toBe(name);
      }
    }
  });

  it("every non-terminator maps strictly darker (luminance)", () => {
    for (const name of NAMES) {
      if (SHADOW_TERMINATORS.includes(name)) continue;
      expect(
        luminance(shadowOf[name]),
        `shadowOf.${name}=${shadowOf[name]} is not darker`
      ).toBeLessThan(luminance(name));
    }
  });

  it("repeated shading converges onto a terminator (no cycles)", () => {
    for (const name of NAMES) {
      let c = name;
      for (let i = 0; i < NAMES.length; i++) c = shadowOf[c];
      expect(SHADOW_TERMINATORS).toContain(c);
    }
  });
});

describe("shadeGrid / makeShadeVariant (G2, §2 Shade role)", () => {
  it("recolours every opaque cell through the LUT and strictly darkens", () => {
    const base = sandTile();
    const shaded = shadeGrid(base);
    expect(shaded.countOpaque()).toBe(base.countOpaque());
    base.forEach((x, y, c) => {
      expect(shaded.get(x, y)).toBe(c === null ? null : shadowOf[c]);
    });
    expect(avgLuminance(shaded)).toBeLessThan(avgLuminance(base));
    expectPaletteOnly(shaded);
  });

  it("preserves transparency and leaves the input untouched", () => {
    const g = new PixelGrid(8, 8);
    g.px(2, 2, "sand");
    const before = g.clone();
    const shaded = shadeGrid(g);
    expect(g.diff(before)).toBe(0);
    expect(shaded.get(0, 0)).toBeNull();
    expect(shaded.get(2, 2)).toBe(shadowOf.sand);
  });

  it("makeShadeVariant is the shadeGrid recipe", () => {
    const base = sandTile();
    expect(makeShadeVariant(base).diff(shadeGrid(base))).toBe(0);
  });
});

describe("shadeTopRows (§2 foot shadow, G7 broken boundary)", () => {
  it("shades the top rows fully and breaks the boundary in 2px clusters", () => {
    const g = sandTile();
    const plain = sandTile();
    shadeTopRows(g, 8, { seed: 7 });
    // rows 0..7 fully shaded
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 16; x++) {
        const c = plain.get(x, y);
        expect(g.get(x, y)).toBe(c === null ? null : shadowOf[c!]);
      }
    }
    // boundary row 8 is a mix: some clusters shaded, some not
    let shaded = 0;
    let unshaded = 0;
    for (let x = 0; x < 16; x++) {
      if (g.get(x, 8) === plain.get(x, 8)) unshaded++;
      else shaded++;
    }
    expect(shaded).toBeGreaterThan(0);
    expect(unshaded).toBeGreaterThan(0);
    expect(shaded % 2).toBe(0); // 2px clusters only
    // rows 9+ untouched
    for (let y = 9; y < 16; y++) {
      for (let x = 0; x < 16; x++) expect(g.get(x, y)).toBe(plain.get(x, y));
    }
  });

  it("is deterministic per seed", () => {
    const a = sandTile();
    const b = sandTile();
    shadeTopRows(a, 8, { seed: 7 });
    shadeTopRows(b, 8, { seed: 7 });
    expect(a.diff(b)).toBe(0);
  });
});

describe("scatterMotifs (G5)", () => {
  const motif = (): PixelGrid => {
    const m = new PixelGrid(2, 2);
    m.rect(0, 0, 2, 2, "rust");
    return m;
  };

  it("places exactly `count` motifs within margins and spacing", () => {
    const g = sandTile();
    const placed = scatterMotifs(g, 3, [motif()], 4, { margin: 2, minSpacing: 4 });
    expect(placed).toHaveLength(4);
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(2);
      expect(p.y).toBeGreaterThanOrEqual(2);
      expect(p.x).toBeLessThanOrEqual(16 - 2 - 2); // margin + motif width
      expect(p.y).toBeLessThanOrEqual(16 - 2 - 2);
    }
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        const d =
          Math.abs(placed[i].x - placed[j].x) + Math.abs(placed[i].y - placed[j].y);
        expect(d).toBeGreaterThanOrEqual(4);
      }
    }
    expectPaletteOnly(g);
  });

  it("supports draw-callback motifs and stays deterministic", () => {
    const cb = (grid: PixelGrid, x: number, y: number): void => {
      grid.px(x, y, "clay");
      grid.px(x + 1, y, "clay");
    };
    const a = sandTile();
    const b = sandTile();
    scatterMotifs(a, 9, [cb], 3);
    scatterMotifs(b, 9, [cb], 3);
    expect(a.diff(b)).toBe(0);
    expect(a.diff(sandTile())).toBeGreaterThan(0);
  });

  it("gives up gracefully when spacing cannot be met", () => {
    const g = new PixelGrid(6, 6);
    g.rect(0, 0, 6, 6, "sand");
    const placed = scatterMotifs(g, 1, [motif()], 5, { margin: 2, minSpacing: 50 });
    expect(placed.length).toBeLessThanOrEqual(1);
  });
});

describe("clusterDither (G7)", () => {
  it("swaps at most 15% of the region, in clusters, only touching A/B", () => {
    const g = new PixelGrid(16, 16);
    g.rect(0, 0, 16, 8, "sand");
    g.rect(0, 8, 16, 8, "sandShade");
    const before = g.clone();
    const region = { x: 0, y: 6, w: 16, h: 4 };
    clusterDither(g, region, "sand", "sandShade", 11);
    const changed = g.diff(before);
    expect(changed).toBeGreaterThan(0);
    expect(changed).toBeLessThanOrEqual(Math.floor(16 * 4 * 0.15));
    // nothing outside the region moved, and only A/B values appear
    g.forEach((x, y, c) => {
      if (y < region.y || y >= region.y + region.h) {
        expect(c).toBe(before.get(x, y));
      } else {
        expect(["sand", "sandShade"]).toContain(c);
      }
    });
  });

  it("is deterministic per seed and varies across seeds", () => {
    const make = (seed: number): PixelGrid => {
      const g = new PixelGrid(16, 16);
      g.rect(0, 0, 16, 8, "sand");
      g.rect(0, 8, 16, 8, "sandShade");
      clusterDither(g, { x: 0, y: 6, w: 16, h: 4 }, "sand", "sandShade", seed);
      return g;
    };
    expect(make(11).diff(make(11))).toBe(0);
    expect(make(11).diff(make(12))).toBeGreaterThan(0);
  });
});

describe("ridgeLine (§4a dune ridges)", () => {
  const opts = { baseY: 8, amplitude: 2, wavelength: 24 } as const;

  function crestY(g: PixelGrid, x: number): number {
    for (let y = 0; y < g.height; y++) if (g.get(x, y) === "sandLight") return y;
    throw new Error(`no crest in column ${x}`);
  }

  it("continues seamlessly across tile boundaries via the phase offset", () => {
    const wide = new PixelGrid(32, 16);
    ridgeLine(wide, 5, { ...opts, phase: 0 });
    const tileA = new PixelGrid(16, 16);
    const tileB = new PixelGrid(16, 16);
    ridgeLine(tileA, 5, { ...opts, phase: 0 });
    ridgeLine(tileB, 5, { ...opts, phase: 16 });
    for (let x = 0; x < 16; x++) {
      expect(crestY(tileA, x)).toBe(crestY(wide, x));
      expect(crestY(tileB, x)).toBe(crestY(wide, x + 16));
    }
  });

  it("pairs a shade line directly beneath the crest and actually waves", () => {
    const g = new PixelGrid(16, 16);
    ridgeLine(g, 5, opts);
    const ys = new Set<number>();
    for (let x = 0; x < 16; x++) {
      const y = crestY(g, x);
      ys.add(y);
      expect(g.get(x, y + 1)).toBe("amber");
    }
    expect(ys.size).toBeGreaterThan(1); // an S-curve, not a ruler line
    expectPaletteOnly(g);
  });
});

describe("canopyLobes (§5 organic vegetation)", () => {
  it("draws base, NNW highlights and crevices, deterministically", () => {
    const make = (): PixelGrid => {
      const g = new PixelGrid(16, 16);
      canopyLobes(g, 21, { lobes: 4 });
      return g;
    };
    const g = make();
    expect(g.diff(make())).toBe(0);
    const counts = new Map<string, number>();
    g.forEach((_x, _y, c) => {
      if (c !== null) counts.set(c, (counts.get(c) ?? 0) + 1);
    });
    expect(counts.get("jade") ?? 0).toBeGreaterThan(20); // a real mass
    expect(counts.get("mint") ?? 0).toBeGreaterThan(0); // highlights present
    expect(counts.get("tealDeep") ?? 0).toBeGreaterThan(0); // crevices present
    expectPaletteOnly(g);
  });

  it("highlights sit on the upper-left of the mass centroid (G1)", () => {
    const g = new PixelGrid(16, 16);
    canopyLobes(g, 21, { lobes: 4 });
    let bx = 0;
    let by = 0;
    let bn = 0;
    let hx = 0;
    let hy = 0;
    let hn = 0;
    g.forEach((x, y, c) => {
      if (c === "jade" || c === "mint" || c === "tealDeep") {
        bx += x;
        by += y;
        bn++;
      }
      if (c === "mint") {
        hx += x;
        hy += y;
        hn++;
      }
    });
    expect(hn).toBeGreaterThan(0);
    expect(hx / hn).toBeLessThan(bx / bn); // left of centre
    expect(hy / hn).toBeLessThan(by / bn); // above centre
  });
});

describe("strata + faceGradient + capLip (G10, §2)", () => {
  it("faceGradient runs light→dark down the tile with a foot line", () => {
    const g = new PixelGrid(16, 16);
    faceGradient(g, "clay", "rust", "umber");
    expect(g.get(4, 0)).toBe("clay");
    expect(g.get(4, 7)).toBe("rust");
    expect(g.get(4, 13)).toBe("umber");
    for (let x = 0; x < 16; x++) expect(g.get(x, 15)).toBe("ink");
    expect(luminance("clay")).toBeGreaterThan(luminance("rust"));
    expect(luminance("rust")).toBeGreaterThan(luminance("umber"));
  });

  it("strata lays broken courses 4–6px apart and spares the foot row", () => {
    const g = new PixelGrid(16, 16);
    g.rect(0, 0, 16, 16, "clay");
    strata(g, { seed: 4 });
    const courseRows: number[] = [];
    for (let y = 0; y < 16; y++) {
      let marks = 0;
      for (let x = 0; x < 16; x++) if (g.get(x, y) !== "clay") marks++;
      if (marks > 0) courseRows.push(y);
      if (marks > 0) expect(marks).toBeLessThan(16); // broken, not solid
    }
    expect(courseRows.length).toBeGreaterThanOrEqual(2);
    expect(courseRows).not.toContain(15); // foot row untouched
    for (let i = 1; i < courseRows.length; i++) {
      const gap = courseRows[i] - courseRows[i - 1];
      expect(gap).toBeGreaterThanOrEqual(4);
      expect(gap).toBeLessThanOrEqual(6);
    }
    // default course colour is the shadow LUT of what it crosses
    expectPaletteOnly(g);
  });

  it("capLip draws the 2–3px lit band along the south edge", () => {
    const g = new PixelGrid(16, 16);
    g.rect(0, 0, 16, 16, "sand");
    capLip(g, { color: "sandLight", thickness: 3 });
    for (let x = 0; x < 16; x++) {
      expect(g.get(x, 12)).toBe("sand");
      expect(g.get(x, 13)).toBe("sandLight");
      expect(g.get(x, 15)).toBe("sandLight");
    }
  });
});

describe("edgeFingers + voidLip (G9, §2, §4a)", () => {
  it("fingers penetrate only 2–4px from their own side, 2px wide (G6)", () => {
    for (const side of SIDES) {
      const g = sandTile();
      edgeFingers(g, side, "clay", 13);
      g.forEach((x, y, c) => {
        if (c !== "clay") return;
        const depth =
          side === "n" ? y : side === "s" ? 15 - y : side === "w" ? x : 15 - x;
        expect(depth, `${side} finger too deep at ${x},${y}`).toBeLessThan(4);
      });
      expect(g.diff(sandTile())).toBeGreaterThan(0);
      expectPaletteOnly(g);
    }
  });

  it("the four sides differ from each other under one seed", () => {
    const tiles = SIDES.map((side) => {
      const g = sandTile();
      edgeFingers(g, side, "clay", 13);
      return g;
    });
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        expect(tiles[i].diff(tiles[j]), `${SIDES[i]} vs ${SIDES[j]}`).toBeGreaterThan(0);
      }
    }
  });

  it("voidLip covers the named side 1–2px deep", () => {
    const g = sandTile();
    voidLip(g, "e", "ink", 2);
    for (let y = 0; y < 16; y++) {
      expect(g.get(15, y)).toBe("ink");
      expect(g.get(14, y)).toBe("ink");
      expect(g.get(13, y)).not.toBe("ink");
    }
  });
});

describe("ellipse", () => {
  it("fills a symmetric blob (for blob shadows and lobes)", () => {
    const g = new PixelGrid(16, 16);
    ellipse(g, 8, 8, 4, 2, "plum");
    expect(g.get(8, 8)).toBe("plum");
    expect(g.get(4, 8)).toBe("plum");
    expect(g.get(12, 8)).toBe("plum");
    expect(g.get(8, 6)).toBe("plum");
    expect(g.get(8, 10)).toBe("plum");
    expect(g.get(4, 6)).toBeNull(); // corners stay clear
    // symmetric about its own centre in both axes
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -5; dx <= 5; dx++) {
        expect(g.get(8 + dx, 8 + dy)).toBe(g.get(8 - dx, 8 - dy));
      }
    }
    expect(() => ellipse(g, 0, 0, 0, 1, "plum")).toThrow();
  });
});

describe("makeCap / makeFace (§2 wall roles, G4 value hierarchy)", () => {
  const cap = (): PixelGrid =>
    makeCap({ base: "sand", lip: "sandLight", seed: 2, motifs: [pebble()], motifCount: 3 });
  const face = (): PixelGrid => makeFace({ top: "clay", mid: "rust", bottom: "umber", seed: 2 });

  function pebble(): PixelGrid {
    const m = new PixelGrid(2, 2);
    m.rect(0, 0, 2, 2, "sandShade");
    return m;
  }

  it("cap is lighter than face on average luminance (G4)", () => {
    expect(avgLuminance(cap())).toBeGreaterThan(avgLuminance(face()));
  });

  it("cap carries the south lip; face carries the ink foot line", () => {
    const c = cap();
    for (let x = 0; x < 16; x++) {
      expect(c.get(x, 14)).toBe("sandLight");
      expect(c.get(x, 15)).toBe("sandLight");
    }
    const f = face();
    for (let x = 0; x < 16; x++) expect(f.get(x, 15)).toBe("ink");
    expect(f.get(0, 0)).toBe("clay");
  });

  it("both are deterministic and palette-only", () => {
    expect(cap().diff(cap())).toBe(0);
    expect(face().diff(face())).toBe(0);
    expectPaletteOnly(cap());
    expectPaletteOnly(face());
  });
});

describe("makeEdgeSet (§2/§4a transition sets)", () => {
  const fingersSet = () =>
    makeEdgeSet(sandTile(), waterTile(), { style: "fingers", fingerColor: "sand", seed: 6 });

  it("fingers: produces 4 edges + 4 outer corners, all distinct per side", () => {
    const set = fingersSet();
    const sides = Object.keys(set.edges) as Side[];
    expect(sides.sort()).toEqual(["e", "n", "s", "w"]);
    expect(Object.keys(set.outerCorners).sort()).toEqual(["ne", "nw", "se", "sw"]);
    for (let i = 0; i < sides.length; i++) {
      for (let j = i + 1; j < sides.length; j++) {
        expect(
          set.edges[sides[i]].diff(set.edges[sides[j]]),
          `${sides[i]} vs ${sides[j]}`
        ).toBeGreaterThan(0);
      }
    }
    for (const g of [...Object.values(set.edges), ...Object.values(set.outerCorners)]) {
      expectPaletteOnly(g);
    }
  });

  it("fingers: the seam row matches the neighbouring pure tile", () => {
    const set = fingersSet();
    const other = waterTile();
    // south edge tile: its bottom row must continue the pure water tile
    for (let x = 0; x < 16; x++) {
      expect(set.edges.s.get(x, 15)).toBe(other.get(x, 15));
    }
    // and the far side is still untouched base
    const base = sandTile();
    for (let x = 0; x < 16; x++) {
      expect(set.edges.s.get(x, 0)).toBe(base.get(x, 0));
    }
  });

  it("fingers: is deterministic and does not mutate its inputs", () => {
    const base = sandTile();
    const other = waterTile();
    const a = makeEdgeSet(base, other, { style: "fingers", fingerColor: "sand", seed: 6 });
    const b = makeEdgeSet(base, other, { style: "fingers", fingerColor: "sand", seed: 6 });
    for (const side of SIDES) expect(a.edges[side].diff(b.edges[side])).toBe(0);
    for (const c of ["ne", "nw", "se", "sw"] as const) {
      expect(a.outerCorners[c].diff(b.outerCorners[c])).toBe(0);
    }
    expect(base.diff(sandTile())).toBe(0);
    expect(other.diff(waterTile())).toBe(0);
  });

  it("surf: coast recipe layers lip → fringe → shallow → water (§4a)", () => {
    const set = makeEdgeSet(sandTile(), waterTile(), { style: "surf", seed: 6 });
    const s = set.edges.s;
    const other = waterTile();
    const base = sandTile();
    for (let x = 0; x < 16; x++) {
      expect(s.get(x, 15)).toBe(other.get(x, 15)); // open water at the seam
      expect(s.get(x, 12)).toBe("skyBlue"); // shallow band
      expect(s.get(x, 6)).toBe("umber"); // dark land lip
      expect(s.get(x, 0)).toBe(base.get(x, 0)); // land beyond the ring
    }
    // broken bone surf fringe exists but is not a solid stripe
    let bone = 0;
    for (let x = 0; x < 16; x++) for (const y of [8, 9]) if (s.get(x, y) === "bone") bone++;
    expect(bone).toBeGreaterThan(0);
    expect(bone).toBeLessThan(32);
    expectPaletteOnly(s);
  });

  it("lip: puts the dark edge on the void side only", () => {
    const set = makeEdgeSet(sandTile(), waterTile(), { style: "lip", seed: 6 });
    const n = set.edges.n;
    for (let x = 0; x < 16; x++) {
      expect(n.get(x, 0)).toBe("ink");
      expect(n.get(x, 1)).toBe("ink");
      expect(n.get(x, 2)).not.toBe("ink");
    }
  });

  it("innerCorners option adds four more distinct tiles", () => {
    const set = makeEdgeSet(sandTile(), waterTile(), {
      style: "surf",
      seed: 6,
      innerCorners: true
    });
    expect(set.innerCorners).toBeDefined();
    const inner = set.innerCorners!;
    expect(Object.keys(inner).sort()).toEqual(["ne", "nw", "se", "sw"]);
    const base = sandTile();
    for (const c of ["ne", "nw", "se", "sw"] as const) {
      expect(inner[c].diff(base)).toBeGreaterThan(0);
      expect(inner[c].diff(set.outerCorners[c])).toBeGreaterThan(0);
      expectPaletteOnly(inner[c]);
    }
  });

  it("rejects mismatched tile sizes and missing fingerColor", () => {
    expect(() => makeEdgeSet(sandTile(), new PixelGrid(8, 8), { style: "lip" })).toThrow();
    expect(() => makeEdgeSet(sandTile(), waterTile(), { style: "fingers" })).toThrow();
  });
});
