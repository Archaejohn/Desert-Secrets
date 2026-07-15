/**
 * Desert Secrets — master palette.
 *
 * Single source of truth for every colour in the game. The art pipeline may
 * only emit pixels whose colours appear here (enforced by unit tests), and
 * in-engine UI must pick from these values too. That is what keeps the art
 * consistent across sprites, tiles and interface.
 *
 * The palette is an original "desert dusk" ramp: warm sand/clay tones for
 * terrain and characters, cool plum shadows, and teal/jade accents for the
 * oasis and magic. Two saturated bar colours are reserved for UI gauges.
 */
export const PALETTE = {
  // Darks / outlines
  ink: "#241827",
  plum: "#43304a",
  mauve: "#75485e",

  // Warm ramp (skin, cloth, terrain)
  rust: "#a34b41",
  clay: "#c7734f",
  amber: "#e0a05f",
  sand: "#eec48f",
  sandLight: "#f7e2b6",
  bone: "#fdf3da",

  // Cool accents (oasis, magic, night sky)
  tealDeep: "#1f4e5a",
  teal: "#2f7f74",
  jade: "#55b087",
  mint: "#a8e0b0",

  // Blues (water, sky, hero cloth)
  indigo: "#3b3a63",
  slate: "#4f6d8f",
  skyBlue: "#7fa8c9",

  // UI gauges
  hpRed: "#d1454f",
  atbGold: "#f0c439",

  // Pure white sparingly (glints, text)
  white: "#ffffff",

  // 2.5D art-upgrade additions (docs/ART_DIRECTION.md §3) — appended only,
  // existing entries must never be reordered (the manifest embeds this
  // object verbatim and sprite code indexes by name).
  umber: "#6e4036", // dark warm brown: wall feet, wood shade, dune shadow lines, canopy crevices on warm plants
  sandShade: "#c69b7c" // cooler sand one step down: large cast-shadow areas on sand/camp floors where amber reads too orange
} as const;

export type PaletteName = keyof typeof PALETTE;

/** Palette as an ordered list of hex strings. */
export const PALETTE_HEX: readonly string[] = Object.values(PALETTE);

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
