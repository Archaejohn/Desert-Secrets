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
 * `DESERT_PRESETS` (phase 1: one preset) yields 206 named tiles — 3 fills +
 * 15 cliff + 47 plateau-edge + 3 * 47 pairings = 206. 206 has no divisor that
 * matches the other generated tilesets' column count (8, matching
 * `tiles*.png`): 206 = 2 * 103, and 103 is prime, so `composeSheet`'s
 * `frames.length % columns === 0` requirement can't be met by 206 frames at
 * 8 columns. Rather than pick an unrelated column count, we pad the frame
 * array with 2 blank (fully-transparent, all-`null`) 16x16 frames, appended
 * AFTER the 206 real frames, bringing the total to 208 = 8 * 26 (26 rows).
 * `cliffTileNames()` returns ONLY the 206 real names (indices 0..205); the 2
 * padding frames at indices 206..207 are never named and never referenced by
 * the manifest.
 */
import { PixelGrid } from "../grid";
import { generateTerrain } from "./generate";
import { DESERT_PRESETS } from "./presets";

const PADDING_FRAME_COUNT = 2;

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

/** The 206 real (non-padding) tile names, in the same order as the first
 *  206 entries of `cliffSheetFrames()`. */
export function cliffTileNames(): string[] {
  return realEntries().map((e) => e.name);
}

/** The 206 real tiles followed by 2 blank/transparent padding frames (see
 *  module doc), for a total of 208 = 8 columns * 26 rows. */
export function cliffSheetFrames(): PixelGrid[] {
  const frames = realEntries().map((e) => e.grid);
  for (let i = 0; i < PADDING_FRAME_COUNT; i++) frames.push(new PixelGrid(16, 16));
  return frames;
}
