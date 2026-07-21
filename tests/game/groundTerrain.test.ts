import { describe, it, expect } from "vitest";
import { REEF_GARDEN_GROUND_TO_TERRAIN as TBL, REEF_GARDEN_DEFAULT_TERRAIN as DEF, REEF_HOLLOW_SEABED, REEF_HOLLOW_WATER, REEF_HOLLOW_DEFAULT, groundNameToTerrainKey, terrainGrid, SUNTEMPLE_GROUND_TO_TERRAIN as STT, SUNTEMPLE_DEFAULT_TERRAIN as STDEF } from "../../src/game/maps/groundTerrain";

describe("groundNameToTerrainKey", () => {
  it("maps direct + variant + nearest names via baseName", () => {
    expect(groundNameToTerrainKey("reefFloor", TBL)).toBe("reefFloor");
    expect(groundNameToTerrainKey("reefFloor2", TBL)).toBe("reefFloor");     // hash variant, same terrain
    expect(groundNameToTerrainKey("glowMoss", TBL)).toBe("glowMoss");
    expect(groundNameToTerrainKey("mintKelp", TBL)).toBe("glowMoss");        // nearest key
    expect(groundNameToTerrainKey("reefFloorShade", TBL)).toBe("reefFloor"); // baseName strips the dressed shade
    expect(groundNameToTerrainKey("glowMossShade", TBL)).toBe("glowMoss");
    expect(groundNameToTerrainKey("someWall", TBL)).toBeNull();              // unmapped
    expect(groundNameToTerrainKey(null, TBL)).toBeNull();
  });
});

describe("terrainGrid", () => {
  it("converts a dressed ground grid, falling back to DEF for unmapped cells", () => {
    const g = terrainGrid([["reefFloor", "mintKelp"], ["glowMossShade", "unknownX"]], TBL, DEF);
    expect(g).toEqual([["reefFloor", "glowMoss"], ["glowMoss", "reefFloor"]]);
    expect(DEF).toBe("reefFloor");
  });
});

describe("reef hollow tables", () => {
  it("seabed maps water (both phases) to reefSilt; banks to reefFloor", () => {
    expect(groundNameToTerrainKey("reefWater", REEF_HOLLOW_SEABED)).toBe("reefSilt");
    expect(groundNameToTerrainKey("reefWater2", REEF_HOLLOW_SEABED)).toBe("reefSilt"); // ...2 handled explicitly
    expect(groundNameToTerrainKey("reefStone", REEF_HOLLOW_SEABED)).toBe("reefFloor");
    expect(groundNameToTerrainKey("mintKelp", REEF_HOLLOW_SEABED)).toBe("glowMoss");
    expect(REEF_HOLLOW_DEFAULT).toBe("reefSilt");
  });
  it("water-kept table keeps both water phases as reefWater (the footprint mask)", () => {
    expect(groundNameToTerrainKey("reefWater", REEF_HOLLOW_WATER)).toBe("reefWater");
    expect(groundNameToTerrainKey("reefWater2", REEF_HOLLOW_WATER)).toBe("reefWater");
    expect(groundNameToTerrainKey("reefSilt", REEF_HOLLOW_WATER)).toBe("reefSilt");
  });
});

describe("sun-temple table", () => {
  it("maps floor + glyph to templeSlab and water phases to reefSilt", () => {
    expect(groundNameToTerrainKey("templeFloor", STT)).toBe("templeSlab");
    expect(groundNameToTerrainKey("templeGlyph", STT)).toBe("templeSlab");
    expect(groundNameToTerrainKey("templeFloorShade", STT)).toBe("templeSlab"); // baseName strips dressing
    expect(groundNameToTerrainKey("seaWater", STT)).toBe("reefSilt");
    expect(groundNameToTerrainKey("seaWater2", STT)).toBe("reefSilt");
    expect(STDEF).toBe("reefSilt");
  });
});
