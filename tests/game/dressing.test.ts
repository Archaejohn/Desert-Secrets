/**
 * The dressing pass (src/game/maps/dressing.ts, docs/ART_DIRECTION.md §2):
 * face/cap/shade placement, terrain transitions, idempotence, hand-nudge
 * preservation, pass-through of unregistered names, and mechanical solidity
 * inheritance of the dressed variants.
 */
import { describe, expect, it } from "vitest";
import { dressMap, baseName, VARIANT_BASE } from "../../src/game/maps/dressing";
import { isSolidName, type ZoneMap } from "../../src/game/maps/types";
import { buildGroveChamberMap } from "../../src/game/maps/groveChamberMap";
import { buildMazeMap } from "../../src/game/maps/mazeMap";
import { buildPizzeriaMap } from "../../src/game/maps/pizzeriaMap";
import { buildSunlessSeaMap } from "../../src/game/maps/sunlessSeaMap";

/** Small synthetic grove room: a caveWall slab across the top (rows 0–1),
 *  open grass below, one wall cell at the bottom (a north-facing edge). */
function syntheticMap(): ZoneMap {
  const W = 7;
  const H = 6;
  const ground: string[][] = [];
  const decor: (string | null)[][] = [];
  for (let y = 0; y < H; y++) {
    ground.push([]);
    decor.push([]);
    for (let x = 0; x < W; x++) {
      ground[y].push("groveGrass");
      decor[y].push(y <= 1 ? "caveWall" : null);
    }
  }
  decor[5][3] = "caveWall"; // bottom wall cell, walkable to its north
  return { ground, decor };
}

describe("dressing: faces, caps and foot shadows", () => {
  const m = dressMap(syntheticMap());

  it("turns the wall row above open floor into faces", () => {
    for (let x = 0; x < 7; x++) {
      expect(m.decor[1][x], `face at (${x},1)`).toMatch(/^caveWallFace2?$/);
    }
  });

  it("turns the wall row above the faces into caps", () => {
    for (let x = 0; x < 7; x++) {
      expect(m.decor[0][x], `cap at (${x},0)`).toMatch(/^caveWallCap2?$/);
    }
  });

  it("turns a wall cell with walkable north into a thin cap edge", () => {
    expect(m.decor[5][3]).toMatch(/^caveWallCap2?$/);
  });

  it("shades the floor strip south of the faces", () => {
    for (let x = 0; x < 7; x++) {
      expect(m.ground[2][x], `shade at (${x},2)`).toBe("groveGrassShade");
    }
    // the row below the shadow strip stays plain
    expect(m.ground[3][2]).toBe("groveGrass");
  });
});

describe("dressing: terrain transitions", () => {
  it("lips ice floor around a chasm (edges + outer corners)", () => {
    const ground = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => "iceFloor"));
    const decor: (string | null)[][] = Array.from({ length: 5 }, () =>
      Array.from({ length: 5 }, () => null)
    );
    decor[2][2] = "chasm";
    const m = dressMap({ ground, decor });
    expect(m.ground[1][2]).toBe("iceFloorChasmS"); // chasm to its south
    expect(m.ground[3][2]).toBe("iceFloorChasmN");
    expect(m.ground[2][1]).toBe("iceFloorChasmE");
    expect(m.ground[2][3]).toBe("iceFloorChasmW");
    // diagonals only → no orthogonal adjacency, no lip (no inner set here)
    expect(m.ground[1][1]).toBe("iceFloor");
  });

  it("rings a floe against open water, inner corners on stair-steps", () => {
    // 1 row of floe over water, with a floe block in the NW so (3,1) sees
    // water only diagonally at its SE.
    const ground = [
      ["floe", "floe", "floe", "floe", "floe"],
      ["floe", "floe", "floe", "floe", "seaWater"],
      ["floe", "floe", "seaWater", "seaWater", "seaWater"],
      ["floe", "seaWater", "seaWater", "seaWater", "seaWater"],
      ["seaWater", "seaWater", "seaWater", "seaWater", "seaWater"]
    ];
    const decor: (string | null)[][] = ground.map((r) => r.map(() => null));
    const m = dressMap({ ground, decor });
    expect(m.ground[1][2]).toBe("floeSeaS"); // water south only
    expect(m.ground[1][3]).toBe("floeSeaSE"); // water south + east
    expect(m.ground[2][1]).toBe("floeSeaSE"); // water south + east
    expect(m.ground[1][1]).toBe("floeSeaInSE"); // water only diagonal SE
  });

  it("gives moss a fingered border against grass", () => {
    const ground = [
      ["groveGrass", "groveGrass", "groveGrass"],
      ["groveGrass", "groveMoss", "groveMoss"],
      ["groveGrass", "groveMoss", "groveMoss"]
    ];
    const decor: (string | null)[][] = ground.map((r) => r.map(() => null));
    const m = dressMap({ ground, decor });
    expect(m.ground[1][1]).toBe("mossGrassNW"); // grass north + west
    expect(m.ground[1][2]).toBe("mossGrassN");
    expect(m.ground[2][1]).toBe("mossGrassW");
    expect(m.ground[2][2]).toBe("groveMoss"); // interior stays plain
    // grass is not the owner of this pair — it stays plain grass
    expect(m.ground[0][1]).toBe("groveGrass");
  });
});

describe("dressing: idempotence and tolerance", () => {
  it("is idempotent on the synthetic map", () => {
    const once = dressMap(syntheticMap());
    expect(dressMap(once)).toEqual(once);
  });

  it("is idempotent on real zone maps (builders already dress)", () => {
    for (const build of [
      buildGroveChamberMap,
      buildMazeMap,
      buildPizzeriaMap,
      buildSunlessSeaMap
    ]) {
      const built = build(); // already dressed by the builder
      expect(dressMap(built)).toEqual(built);
    }
  });

  it("passes unregistered names through untouched", () => {
    const map: ZoneMap = {
      ground: [
        ["sand", "sand2"],
        ["asphalt", "mineFloor"]
      ],
      decor: [
        ["rock", null],
        [null, "mineWall"]
      ]
    };
    expect(dressMap(map)).toEqual(map);
  });

  it("preserves hand-placed dressed names", () => {
    const map = syntheticMap();
    map.decor[1][3] = "caveWallCap"; // hand nudge: a cap where rules say face
    map.ground[3][3] = "groveGrassShade"; // hand-placed shade in open floor
    const m = dressMap(map);
    expect(m.decor[1][3]).toBe("caveWallCap");
    expect(m.ground[3][3]).toBe("groveGrassShade");
  });
});

describe("dressing: solidity inheritance (mechanical)", () => {
  it("every Face/Cap of a solid base is solid", () => {
    for (const variant of Object.keys(VARIANT_BASE)) {
      const base = VARIANT_BASE[variant];
      if (/(Face2?|Cap2?)$/.test(variant)) {
        expect(isSolidName(base), `${base} should be solid`).toBe(true);
        expect(isSolidName(variant), `${variant} should inherit solid`).toBe(true);
      } else {
        // shades and transition tiles belong to walkable floors
        expect(isSolidName(base), `${base} should be walkable`).toBe(false);
        expect(isSolidName(variant), `${variant} should stay walkable`).toBe(false);
      }
    }
  });

  it("normalizes variants back to their base names", () => {
    expect(baseName("iceWallDeepFace2")).toBe("iceWallDeep");
    expect(baseName("campFloorShade")).toBe("campFloor");
    expect(baseName("floeSeaInNW")).toBe("floe");
    expect(baseName("sand")).toBe("sand");
    expect(baseName(null)).toBeNull();
  });
});
