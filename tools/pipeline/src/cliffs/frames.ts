/**
 * cliff.png sheet assembly — runs `generateTerrain(p)` over every
 * `DESERT_PRESETS` entry, concatenates the results in a fixed order, and
 * dedupes shared fills (a fill name — e.g. `sandFill` — appears once, even
 * if multiple presets or pairings reference the same terrain key).
 *
 * `cliffSheetFrames()` and `cliffTileNames()` MUST stay parallel arrays for
 * the 206 *real* frames: `cliffTileNames()[i]` names `cliffSheetFrames()[i]`
 * for every `i < cliffTileNames().length`. Both walk `DESERT_PRESETS` in the
 * same order and skip a name the second time it's seen (first occurrence
 * wins — fills are byte-identical across presets/pairings that reference the
 * same terrain key + seed anyway, so which occurrence "wins" is immaterial).
 *
 * ## Padding for composeSheet
 *
 * `DESERT_PRESETS` (phase 1b: one preset) yields 238 named tiles — 3 fills +
 * 15 cliff + 47 plateau-edge + 3 * 47 pairings + 2 * 16 ramps = 238. The real
 * count has no guarantee of being a multiple of the other generated
 * tilesets' column count (8, matching `tiles*.png`), so rather than pick an
 * unrelated column count we pad the frame array with blank (fully
 * transparent, all-`null`) 16x16 frames, appended AFTER the real frames,
 * bringing the total up to the next multiple of 8. The pad count is
 * *derived* from the real count (`COLUMNS - realCount % COLUMNS`, mod
 * `COLUMNS` so an already-aligned count needs no padding) rather than
 * hardcoded, so this stays correct as new tile groups (ramps, later
 * additions) change the real count. At 238 real tiles that's 2 padding
 * frames, for a total of 240 = 8 * 30 (30 rows).
 * `cliffTileNames()` returns ONLY the real names (indices `0..realCount-1`);
 * the padding frames after them are never named and never referenced by the
 * manifest.
 */
import { PixelGrid } from "../grid";
import { generateTerrain } from "./generate";
import { DESERT_PRESETS } from "./presets";

const COLUMNS = 8;

function realEntries(): { name: string; grid: PixelGrid }[] {
  const seen = new Set<string>();
  const out: { name: string; grid: PixelGrid }[] = [];
  for (const preset of DESERT_PRESETS) {
    for (const entry of generateTerrain(preset)) {
      if (seen.has(entry.name)) continue; // dedupe shared fills
      seen.add(entry.name);
      out.push(entry);
    }
  }
  return out;
}

/** The real (non-padding) tile names, in the same order as the leading
 *  entries of `cliffSheetFrames()`. */
export function cliffTileNames(): string[] {
  return realEntries().map((e) => e.name);
}

/** The real tiles followed by blank/transparent padding frames (see module
 *  doc), bringing the total up to the next multiple of `COLUMNS`. */
export function cliffSheetFrames(): PixelGrid[] {
  const frames = realEntries().map((e) => e.grid);
  const padCount = (COLUMNS - (frames.length % COLUMNS)) % COLUMNS;
  for (let i = 0; i < padCount; i++) frames.push(new PixelGrid(16, 16));
  return frames;
}
