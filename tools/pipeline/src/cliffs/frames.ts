/**
 * Per-biome sheet assembly — runs `generateTerrain(p)` over every entry of a
 * biome's preset list (`DESERT_PRESETS`, `ICE_PRESETS`), concatenates the
 * results in a fixed order, and dedupes shared fills (a fill name — e.g.
 * `sandFill` — appears once, even if multiple presets or pairings reference
 * the same terrain key).
 *
 * `{biome}SheetFrames()` and `{biome}TileNames()` MUST stay parallel arrays
 * for the real (non-padding) frames: `{biome}TileNames()[i]` names
 * `{biome}SheetFrames()[i]` for every `i < {biome}TileNames().length`. Both
 * walk the same preset list in the same order and skip a name the second
 * time it's seen (first occurrence wins — fills are byte-identical across
 * presets/pairings that reference the same terrain key + seed anyway, so
 * which occurrence "wins" is immaterial).
 *
 * ## Padding for composeSheet
 *
 * The real tile count has no guarantee of being a multiple of the other
 * generated tilesets' column count (8, matching `tiles*.png`), so rather
 * than pick an unrelated column count we pad the frame array with blank
 * (fully transparent, all-`null`) 16x16 frames, appended AFTER the real
 * frames, bringing the total up to the next multiple of 8. The pad count is
 * *derived* from the real count (`COLUMNS - realCount % COLUMNS`, mod
 * `COLUMNS` so an already-aligned count needs no padding) rather than
 * hardcoded, so this stays correct as new tile groups (ramps, later
 * additions) change the real count. `{biome}TileNames()` returns ONLY the
 * real names (indices `0..realCount-1`); the padding frames after them are
 * never named and never referenced by the manifest.
 *
 * Desert (`cliffTileNames`/`cliffSheetFrames`) walks `DESERT_PRESETS`; ice
 * (`cliffIceTileNames`/`cliffIceSheetFrames`) walks `ICE_PRESETS`. Both call
 * the same `realEntriesFor`/`sheetFramesFor` core, parametrized by preset
 * list, so the desert output is unchanged by this generalization — same
 * walk order, same dedupe rule, same padding derivation.
 */
import { PixelGrid } from "../grid";
import { generateTerrain } from "./generate";
import type { TerrainParams } from "./generate";
import { DESERT_PRESETS, ICE_PRESETS, REEF_PRESETS, LAVA_PRESETS, GROVE_PRESETS } from "./presets";

const COLUMNS = 8;

function realEntriesFor(presets: TerrainParams[]): { name: string; grid: PixelGrid }[] {
  const seen = new Set<string>();
  const out: { name: string; grid: PixelGrid }[] = [];
  for (const preset of presets) {
    for (const entry of generateTerrain(preset)) {
      if (seen.has(entry.name)) continue; // dedupe shared fills
      seen.add(entry.name);
      out.push(entry);
    }
  }
  return out;
}

function sheetFramesFor(presets: TerrainParams[]): PixelGrid[] {
  const frames = realEntriesFor(presets).map((e) => e.grid);
  const padCount = (COLUMNS - (frames.length % COLUMNS)) % COLUMNS;
  for (let i = 0; i < padCount; i++) frames.push(new PixelGrid(16, 16));
  return frames;
}

/** The real (non-padding) desert tile names, in the same order as the
 *  leading entries of `cliffSheetFrames()`. */
export const cliffTileNames = (): string[] => realEntriesFor(DESERT_PRESETS).map((e) => e.name);

/** The real desert tiles followed by blank/transparent padding frames (see
 *  module doc), bringing the total up to the next multiple of `COLUMNS`. */
export const cliffSheetFrames = (): PixelGrid[] => sheetFramesFor(DESERT_PRESETS);

/** The real (non-padding) ice tile names, in the same order as the leading
 *  entries of `cliffIceSheetFrames()`. */
export const cliffIceTileNames = (): string[] => realEntriesFor(ICE_PRESETS).map((e) => e.name);

/** The real ice tiles followed by blank/transparent padding frames (see
 *  module doc), bringing the total up to the next multiple of `COLUMNS`. */
export const cliffIceSheetFrames = (): PixelGrid[] => sheetFramesFor(ICE_PRESETS);

/** The real (non-padding) reef tile names, in the same order as the leading
 *  entries of `cliffReefSheetFrames()`. */
export const cliffReefTileNames = (): string[] => realEntriesFor(REEF_PRESETS).map((e) => e.name);

/** The real reef tiles followed by blank/transparent padding frames (see
 *  module doc), bringing the total up to the next multiple of `COLUMNS`. */
export const cliffReefSheetFrames = (): PixelGrid[] => sheetFramesFor(REEF_PRESETS);

/** Real lava tile names (the manifest-visible entries of `cliffLavaSheetFrames()`). */
export const cliffLavaTileNames = (): string[] => realEntriesFor(LAVA_PRESETS).map((e) => e.name);

/** Real lava tiles + blank padding to the next multiple of `COLUMNS`. */
export const cliffLavaSheetFrames = (): PixelGrid[] => sheetFramesFor(LAVA_PRESETS);

/** Real grove tile names (the manifest-visible entries of `cliffGroveSheetFrames()`). */
export const cliffGroveTileNames = (): string[] => realEntriesFor(GROVE_PRESETS).map((e) => e.name);

/** Real grove tiles + blank padding to the next multiple of `COLUMNS`. */
export const cliffGroveSheetFrames = (): PixelGrid[] => sheetFramesFor(GROVE_PRESETS);
