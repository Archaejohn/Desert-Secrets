/**
 * Shared cave/ice-zone lighting: the recipe the Cinnabar Mine established
 * (a partial ambient darkness the player's lamp reveals as they move, plus
 * warm flickering glows on the lantern posts) generalised so the Act 2 ice
 * zones can reuse it — same amber lantern flicker, plus a cold BLUE pulse on
 * the ice features (crystals, frozen lake) so the ice reads as putting off
 * its own light.
 *
 * Points are PIXEL coords (tile centres). Scenes usually gather them with
 * `ZoneScene.tileCentersNamed(name)` so a light hangs on every matching tile
 * without a hand-maintained position array. Drive the returned mask each
 * frame from the scene's `onUpdate()` (`mask.update()`).
 */
import Phaser from "phaser";
import { LightMask } from "./LightMask";
import { PALETTE, hexToInt } from "../../shared/palette";

export interface GlowPoint {
  x: number;
  y: number;
  /** Glow radius in px; falls back to the amber/blue default. */
  radius?: number;
}

export interface ZoneLightingOptions {
  /** Ambient darkness the lights cut through; omit for no darkening. */
  base?: { color: number; alpha: number };
  /** A reveal lamp that follows this target (usually the player). */
  follow?: Phaser.GameObjects.Components.Transform;
  followRadius?: number;
  /** How fully the lamp clears the dark (0–1); <1 keeps the lit pool dim. */
  followIntensity?: number;
  /** Warm, flickering lantern/torch glows. */
  amber?: GlowPoint[];
  /** Brightness multiplier for the amber glows (default 1). */
  amberIntensity?: number;
  /** Cold, slow-pulsing ice glows (crystals, frozen lake). */
  blue?: GlowPoint[];
  /** Brightness multiplier for the blue glows (default 1). */
  blueIntensity?: number;
  /** Soft, breathing bioluminescent glows (glow-moss, mint kelp). */
  green?: GlowPoint[];
  /** Brightness multiplier for the green glows (default 1). */
  greenIntensity?: number;
  /** Display depth of the overlay (default above actors, below the HUD). */
  depth?: number;
}

const AMBER_STOPS = [
  { offset: 0, color: hexToInt(PALETTE.amber), alpha: 0.9 },
  { offset: 0.5, color: hexToInt(PALETTE.clay), alpha: 0.4 },
  { offset: 1, color: hexToInt(PALETTE.rust), alpha: 0 }
];
const BLUE_STOPS = [
  { offset: 0, color: hexToInt(PALETTE.skyBlue), alpha: 0.8 },
  { offset: 0.5, color: hexToInt(PALETTE.slate), alpha: 0.4 },
  { offset: 1, color: hexToInt(PALETTE.slate), alpha: 0 }
];
const GREEN_STOPS = [
  { offset: 0, color: hexToInt(PALETTE.mint), alpha: 0.85 },
  { offset: 0.5, color: hexToInt(PALETTE.jade), alpha: 0.4 },
  { offset: 1, color: hexToInt(PALETTE.teal), alpha: 0 }
];

/**
 * Build a LightMask for a torch/ice zone. The follow lamp keeps it
 * navigable; the amber glows flicker subtly and out of phase (like the
 * mine's torches); the blue glows breathe more deeply, out of phase with
 * each other, so the ice looks alive rather than a flat wash.
 */
export function setupZoneLighting(scene: Phaser.Scene, opts: ZoneLightingOptions): LightMask {
  const mask = new LightMask(scene, { depth: opts.depth ?? 4000, base: opts.base });

  if (opts.follow) {
    mask.addLight({
      follow: opts.follow,
      radius: opts.followRadius ?? 116,
      blend: "reveal",
      intensity: opts.followIntensity ?? 1,
      stops: [
        { offset: 0, color: 0xffffff, alpha: 1 },
        { offset: 0.62, color: 0xffffff, alpha: 0.85 },
        { offset: 1, color: 0xffffff, alpha: 0 }
      ]
    });
  }

  (opts.amber ?? []).forEach((p, i) => {
    mask.addLight({
      x: p.x,
      y: p.y,
      radius: p.radius ?? 60,
      blend: "add",
      intensity: opts.amberIntensity ?? 1,
      pulse: { min: 0.72, max: 1, periodMs: 1500 + i * 130, phaseMs: i * 300 },
      stops: AMBER_STOPS
    });
  });

  (opts.blue ?? []).forEach((p, i) => {
    mask.addLight({
      x: p.x,
      y: p.y,
      radius: p.radius ?? 50,
      blend: "add",
      intensity: opts.blueIntensity ?? 1,
      pulse: { min: 0.35, max: 1, periodMs: 1900 + i * 170, phaseMs: i * 240 },
      stops: BLUE_STOPS
    });
  });

  (opts.green ?? []).forEach((p, i) => {
    mask.addLight({
      x: p.x,
      y: p.y,
      radius: p.radius ?? 34,
      blend: "add",
      intensity: opts.greenIntensity ?? 1,
      pulse: { min: 0.4, max: 1, periodMs: 2100 + i * 150, phaseMs: i * 220 },
      stops: GREEN_STOPS
    });
  });

  return mask;
}

export interface LightShaftOptions {
  /** Shaft centre (pixel coords). */
  x: number;
  y: number;
  /** Footprint size (px). Width is the beam's spread, height its throw. */
  width: number;
  height: number;
  /**
   * Which way the light travels and widens. `"down"` = a sun/door shaft
   * pouring DOWN (bright at the top source, spreading to a pool below);
   * `"up"` = a glow spilling UP from below (bright at the bottom source,
   * spreading toward the top).
   */
  direction: "down" | "up";
  /** Gradient stops; offset 0 is the bright source end. */
  stops: Array<{ offset: number; color: number; alpha: number }>;
  intensity?: number;
  pulse?: { min: number; max: number; periodMs: number; phaseMs?: number };
  /** Optional ambient darkness the shaft cuts through; omit for pure additive. */
  base?: { color: number; alpha: number };
  depth?: number;
}

/**
 * A single hard-edged shaft of light clipped to a trapezoid that widens away
 * from its source — the "light streaming from a door / down from a cave-in"
 * recipe generalised out of DepthsScene.addPortalShaft(). `direction` flips
 * both the linear-gradient angle and which end of the trapezoid is narrow, so
 * one helper serves both a sun-shaft pouring down and a glow spilling up.
 * Additive by default (no scene darkening) unless `base` is given.
 */
export function setupLightShaft(scene: Phaser.Scene, opts: LightShaftOptions): LightMask {
  const mask = new LightMask(scene, { depth: opts.depth ?? 4000, base: opts.base });
  const down = opts.direction === "down";
  // The narrow end sits at the source; the beam widens as it travels.
  const points = down
    ? [
        { x: 0.42, y: 0 },
        { x: 0.58, y: 0 },
        { x: 0.88, y: 1 },
        { x: 0.12, y: 1 }
      ]
    : [
        { x: 0.12, y: 0 },
        { x: 0.88, y: 0 },
        { x: 0.58, y: 1 },
        { x: 0.42, y: 1 }
      ];
  mask.addLight({
    x: opts.x,
    y: opts.y,
    width: opts.width,
    height: opts.height,
    gradient: "linear",
    angle: down ? Math.PI / 2 : -Math.PI / 2, // toward the wide end
    blend: "add",
    intensity: opts.intensity ?? 0.8,
    pulse: opts.pulse ?? { min: 0.7, max: 1, periodMs: 2400 },
    mask: { type: "poly", points },
    stops: opts.stops
  });
  return mask;
}

/**
 * A bright, warm shaft of desert sun pouring DOWN over a pool of `sunbeam`
 * tiles — the Act 5 cave-in reveal, sunlight falling onto the lone orange tree.
 * Pass the tile centres (`tileCentersNamed("sunbeam")`); the shaft is sized and
 * centred over their bounding box. Purely additive (no darkening — it's a
 * bright reveal, not a dark cave). Returns null if there are no sunbeam tiles.
 */
export function setupSunbeamShaft(
  scene: Phaser.Scene,
  points: Array<{ x: number; y: number }>
): LightMask | null {
  if (points.length === 0) return null;
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const TILE = 16;
  return setupLightShaft(scene, {
    x: (minX + maxX) / 2,
    y: (minY + maxY) / 2,
    width: maxX - minX + TILE,
    height: maxY - minY + TILE,
    direction: "down",
    intensity: 0.9,
    pulse: { min: 0.82, max: 1, periodMs: 3200 }, // a slow, gentle shimmer
    stops: [
      { offset: 0, color: hexToInt(PALETTE.white), alpha: 0.42 },
      { offset: 0.55, color: hexToInt(PALETTE.sand), alpha: 0.2 },
      { offset: 1, color: hexToInt(PALETTE.sand), alpha: 0 }
    ]
  });
}
