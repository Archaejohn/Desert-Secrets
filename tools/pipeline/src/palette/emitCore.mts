/**
 * Throwaway emitter for Task 4 (AAP-64 palette migration): prints the exact
 * `CORE` object literal (25 re-hexed legacy names + 39 named remainder AAP-64
 * colors) to paste into src/shared/palette.ts. Not imported by anything;
 * delete after use if not needed again.
 *
 * Run: npx tsx tools/pipeline/src/palette/emitCore.mts
 */
import { AAP64 } from "./aap64";
import { remapPalette } from "./remap";

// The 25 legacy names, in their CURRENT (pre-migration) order and hex values,
// as they stand in src/shared/palette.ts before this task rewrites it.
const LEGACY_PALETTE: Record<string, string> = {
  ink: "#241827",
  plum: "#43304a",
  mauve: "#75485e",
  rust: "#a34b41",
  clay: "#c7734f",
  amber: "#e0a05f",
  sand: "#eec48f",
  sandLight: "#f7e2b6",
  bone: "#fdf3da",
  tealDeep: "#1f4e5a",
  teal: "#2f7f74",
  jade: "#55b087",
  mint: "#a8e0b0",
  indigo: "#3b3a63",
  slate: "#4f6d8f",
  skyBlue: "#7fa8c9",
  hpRed: "#d1454f",
  atbGold: "#f0c439",
  white: "#ffffff",
  umber: "#6e4036",
  sandShade: "#c69b7c",
  stoneLit: "#a8b4c0",
  stone: "#6b7889",
  stoneDark: "#414d5e",
  stoneDeep: "#2a3240",
};
const LEGACY_ORDER = Object.keys(LEGACY_PALETTE);

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Standard HSL conversion; h in [0,360), s,l in [0,1]. */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const [r8, g8, b8] = hexToRgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  const d = max - min;
  if (d !== 0) {
    s = d / (1 - Math.abs(2 * l - 1));
    switch (max) {
      case r: h = 60 * (((g - b) / d) % 6); break;
      case g: h = 60 * ((b - r) / d + 2); break;
      case b: h = 60 * ((r - g) / d + 4); break;
    }
    if (h < 0) h += 360;
  }
  return { h, s, l };
}

type Family = "grey" | "red" | "orange" | "yellow" | "green" | "teal" | "blue" | "purple" | "pink";

function familyOf(hex: string): Family {
  const { h, s } = hexToHsl(hex);
  if (s < 0.12) return "grey";
  if (h >= 345 || h < 15) return "red";
  if (h < 45) return "orange";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 200) return "teal";
  if (h < 255) return "blue";
  if (h < 290) return "purple";
  return "pink"; // [290, 345)
}

function main(): void {
  const mapping = remapPalette(LEGACY_PALETTE);
  const usedHexes = new Set(Object.values(mapping));

  const remaining = AAP64.filter((hex) => !usedHexes.has(hex));
  if (remaining.length !== 39) {
    throw new Error(`Expected 39 remaining AAP-64 colors, got ${remaining.length}`);
  }

  // Group remaining by family, then sort each family by lightness ascending.
  const byFamily = new Map<Family, string[]>();
  for (const hex of remaining) {
    const fam = familyOf(hex);
    if (!byFamily.has(fam)) byFamily.set(fam, []);
    byFamily.get(fam)!.push(hex);
  }
  for (const arr of byFamily.values()) {
    arr.sort((a, b) => hexToHsl(a).l - hexToHsl(b).l);
  }

  const namedRemaining: { name: string; hex: string }[] = [];
  // Stable family iteration order (matches the brief's listed order).
  const familyOrder: Family[] = ["red", "orange", "yellow", "green", "teal", "blue", "purple", "pink", "grey"];
  for (const fam of familyOrder) {
    const arr = byFamily.get(fam);
    if (!arr) continue;
    arr.forEach((hex, i) => namedRemaining.push({ name: `${fam}${i}`, hex }));
  }

  // Sanity: no collisions with legacy names, no duplicate generated names.
  const legacySet = new Set(LEGACY_ORDER);
  const seen = new Set<string>();
  for (const { name } of namedRemaining) {
    if (legacySet.has(name)) throw new Error(`Generated name collides with legacy name: ${name}`);
    if (seen.has(name)) throw new Error(`Duplicate generated name: ${name}`);
    seen.add(name);
  }
  if (namedRemaining.length !== 39) {
    throw new Error(`Expected 39 named remainder entries, got ${namedRemaining.length}`);
  }

  // --- Emit ---
  const lines: string[] = [];
  lines.push("export const CORE = {");
  lines.push("  // --- 25 legacy names, re-hexed to AAP-64 targets (order UNCHANGED) ---");
  for (const name of LEGACY_ORDER) {
    lines.push(`  ${name}: "${mapping[name]}", // was ${LEGACY_PALETTE[name]}`);
  }
  lines.push("  // --- 39 appended AAP-64 colors (family-named) ---");
  for (const { name, hex } of namedRemaining) {
    lines.push(`  ${name}: "${hex}",`);
  }
  lines.push("} as const;");

  console.log(lines.join("\n"));
  console.error(`\n// legacy: ${LEGACY_ORDER.length}, remainder: ${namedRemaining.length}, total: ${LEGACY_ORDER.length + namedRemaining.length}`);
}

main();
