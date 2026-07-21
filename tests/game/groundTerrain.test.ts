import { describe, it, expect } from "vitest";
import { REEF_GARDEN_GROUND_TO_TERRAIN as TBL, REEF_GARDEN_DEFAULT_TERRAIN as DEF, groundNameToTerrainKey, terrainGrid } from "../../src/game/maps/groundTerrain";

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
