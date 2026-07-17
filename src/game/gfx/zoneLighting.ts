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
  /** Warm, flickering lantern/torch glows. */
  amber?: GlowPoint[];
  /** Cold, slow-pulsing ice glows (crystals, frozen lake). */
  blue?: GlowPoint[];
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
      pulse: { min: 0.35, max: 1, periodMs: 1900 + i * 170, phaseMs: i * 240 },
      stops: BLUE_STOPS
    });
  });

  return mask;
}
