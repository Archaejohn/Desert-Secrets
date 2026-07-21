/**
 * Desert Secrets — master palette.
 *
 * Single source of truth for every colour in the game. The art pipeline may
 * only emit pixels whose colours appear here (enforced by unit tests), and
 * in-engine UI must pick from these values too. That is what keeps the art
 * consistent across sprites, tiles and interface.
 *
 * CORE = canonical AAP-64 (Adigun A. Polack; see
 * tools/pipeline/src/palette/aap64.ts). The 25 legacy names keep their
 * identity and position but now hold their AAP-64 target hex, computed by
 * `remapPalette` (tools/pipeline/src/palette/remap.ts) — an injective
 * nearest-match remap, owner-approved (embrace-remap, 2026-07-20). Append
 * only: legacy names first (positions frozen), then the 39 remaining AAP-64
 * colors, family-named by HSL hue bucket (see
 * tools/pipeline/src/palette/emitCore.mts for the generator).
 */
export const CORE = {
  // --- 25 legacy names, re-hexed to AAP-64 targets (order UNCHANGED) ---

  // Darks / outlines
  ink: "#221c1a",
  plum: "#403353",
  mauve: "#5a4e44",

  // Warm ramp (skin, cloth, terrain)
  rust: "#8e5252",
  clay: "#bb7547",
  amber: "#dba463",
  sand: "#f4d29c",
  sandLight: "#fad6b8",
  bone: "#fef3c0",

  // Cool accents (oasis, magic, night sky)
  tealDeep: "#24523b",
  teal: "#328464",
  jade: "#5daf8d",
  mint: "#92dcba",

  // Blues (water, sky, hero cloth)
  indigo: "#143464",
  slate: "#477d85",
  skyBlue: "#849be4",

  // UI gauges
  hpRed: "#df3e23",
  atbGold: "#ffd541",

  // Pure white sparingly (glints, text)
  white: "#ffffff",

  // 2.5D art-upgrade additions (docs/ART_DIRECTION.md §3)
  umber: "#71413b",
  sandShade: "#c7b08b",

  // Cool desert-stone ramp (docs/superpowers/specs/2026-07-18-desert-cliff-tileset)
  stoneLit: "#b3b9d1",
  stone: "#6d758d",
  stoneDark: "#4a5462",
  stoneDeep: "#333941",

  // --- 39 appended AAP-64 colors (family-named by HSL hue bucket) ---
  red0: "#73172d",
  red1: "#5b3138",
  red2: "#b4202a",
  red3: "#ba756a",
  red4: "#e86a73",
  red5: "#f5a097",

  orange0: "#796755",
  orange1: "#a08662",
  orange2: "#fa6a0a",
  orange3: "#f9a31b",
  orange4: "#e9b5a3",
  orange5: "#e4d2aa",

  yellow0: "#fffc40",

  green0: "#23674e",
  green1: "#1a7a3e",
  green2: "#14a02e",
  green3: "#59c135",
  green4: "#9cdb43",
  green5: "#d6f264",
  green6: "#a6fcdb",
  green7: "#cdf7e2",

  teal0: "#122020",
  teal1: "#20d6c7",

  blue0: "#060608",
  blue1: "#242234",
  blue2: "#285cc4",
  blue3: "#249fde",
  blue4: "#588dbe",
  blue5: "#8b93af",
  blue6: "#b9bffb",
  blue7: "#dae0ea",
  blue8: "#e3e6ff",

  pink0: "#3b1725",
  pink1: "#422433",
  pink2: "#793a80",
  pink3: "#bc4a9b",

  grey0: "#141013",
  grey1: "#322b28",
  grey2: "#423934"
} as const;

/** Per-biome signature accents beyond CORE. Empty until biomes need them. */
export const BIOME_ACCENTS = {} as const;

/** Back-compat alias — existing 43 game-code call sites read `PALETTE.<name>`. */
export const PALETTE = CORE;

export type PaletteName = keyof typeof CORE;

/** Palette as an ordered list of hex strings. */
export const PALETTE_HEX: readonly string[] = Object.values(CORE);

/** Parse "#rrggbb" into [r, g, b] (0–255). */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`Invalid hex colour: ${hex}`);
  const v = parseInt(m[1], 16);
  return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
}

/** Numeric 0xRRGGBB form, handy for Phaser tints/fills. */
export function hexToInt(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (r << 16) | (g << 8) | b;
}
