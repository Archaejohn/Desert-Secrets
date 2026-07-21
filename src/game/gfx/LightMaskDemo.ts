/**
 * Dev-only visual demo for the LightMask subsystem, gated behind the
 * `?lighttest` URL flag (see OverworldScene.readLightTest) — NOT shipped to
 * players, and inert when the flag is off. It lays every LightMask capability
 * onto the live overworld at once so each can be screenshotted:
 *
 *   1. torch/lantern — a dark scene with a reveal glow that FOLLOWS the player
 *   2. additive glow emanating from a character (a placed sprite)
 *   3. a location PULSING blue (the "ice wall" beat)
 *   4. a multi-stop gradient light: blue centre → white glow → clear
 *   5. a SQUARE (boxy) falloff glow
 *   6. a LINEAR directional wash (screen-anchored)
 *   7. a hard-edged "light through a doorway" shaft (linear gradient + a
 *      crisp polygon mask)
 *   8. a full-screen white FLASH (on demand via `triggerFlash`, or the F key)
 *
 * Mirrors the Mode7Tuner precedent: throwaway dev tooling that draws with the
 * live engine rather than going through the palette-locked art pipeline. The
 * lights are placed relative to the player's spawn so they frame on screen at
 * the overworld's default follow-camera position.
 */
import Phaser from "phaser";
import { LightMask } from "./LightMask";
import { PALETTE, hexToInt } from "../../shared/palette";

const LIGHT_DEPTH = 5000;
const LABEL_DEPTH = LIGHT_DEPTH + 60;
/** Ink-with-alpha helper for the demo's label/legend backgrounds. */
const inkA = (a: string) => PALETTE.ink + a;

export class LightMaskDemo {
  private readonly scene: Phaser.Scene;
  private readonly mask: LightMask;
  private readonly character: Phaser.GameObjects.Sprite;
  private readonly labels: Phaser.GameObjects.Text[] = [];
  private readonly keyFlash: Phaser.Input.Keyboard.Key | null;

  constructor(scene: Phaser.Scene, player: Phaser.GameObjects.Components.Transform) {
    this.scene = scene;
    this.mask = new LightMask(scene, { depth: LIGHT_DEPTH, base: { color: hexToInt(PALETTE.ink), alpha: 0.84 } });

    const px = player.x;
    const py = player.y;

    // 1. Torch/lantern: a reveal glow punched through the darkness, following
    //    the player. Only alpha matters for a reveal, so the colour is white.
    this.mask.addLight({
      x: px,
      y: py,
      radius: 120,
      blend: "reveal",
      follow: player,
      stops: [
        { offset: 0, color: 0xffffff, alpha: 1 },
        { offset: 0.55, color: 0xffffff, alpha: 0.92 },
        { offset: 1, color: 0xffffff, alpha: 0 }
      ]
    });

    // 2. Additive glow emanating from a character (a placed, idling sprite).
    this.character = scene.add.sprite(px - 78, py - 46, "hero", 0).setDepth(py - 46);
    if (scene.anims.exists("hero-idle-down")) this.character.play("hero-idle-down");
    this.mask.addLight({
      radius: 74,
      blend: "add",
      follow: this.character,
      pulse: { min: 0.6, max: 1, periodMs: 2200 },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.amber), alpha: 0.95 },
        { offset: 0.5, color: hexToInt(PALETTE.clay), alpha: 0.5 },
        { offset: 1, color: hexToInt(PALETTE.rust), alpha: 0 }
      ]
    });
    this.label(px - 78, py - 46 - 34, "glow: character");

    // 3. A location pulsing blue — the "ice wall" beat. A tall square-falloff
    //    footprint reads as a wall rather than a round lamp.
    this.mask.addLight({
      x: px + 82,
      y: py - 52,
      width: 52,
      height: 104,
      shape: "square",
      blend: "add",
      pulse: { min: 0.25, max: 1, periodMs: 1500 },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.skyBlue), alpha: 0.85 },
        { offset: 0.5, color: hexToInt(PALETTE.slate), alpha: 0.45 },
        { offset: 1, color: hexToInt(PALETTE.slate), alpha: 0 }
      ]
    });
    this.label(px + 82, py - 52 - 60, "pulse: ice wall");

    // 4. Multi-stop gradient: blue centre → white glow → clear.
    this.mask.addLight({
      x: px - 116,
      y: py + 28,
      radius: 58,
      blend: "add",
      stops: [
        { offset: 0, color: hexToInt(PALETTE.indigo), alpha: 1 },
        { offset: 0.4, color: 0xffffff, alpha: 0.9 },
        { offset: 0.7, color: 0xffffff, alpha: 0.35 },
        { offset: 1, color: 0xffffff, alpha: 0 }
      ]
    });
    this.label(px - 116, py + 28 - 40, "multi-stop: blue>white>clear");

    // 5. Square (boxy) falloff glow.
    this.mask.addLight({
      x: px + 118,
      y: py + 30,
      width: 104,
      height: 104,
      shape: "square",
      blend: "add",
      stops: [
        { offset: 0, color: hexToInt(PALETTE.jade), alpha: 0.85 },
        { offset: 0.7, color: hexToInt(PALETTE.teal), alpha: 0.4 },
        { offset: 1, color: hexToInt(PALETTE.teal), alpha: 0 }
      ]
    });
    this.label(px + 118, py + 30 - 40, "square falloff");

    // 6. Linear directional wash (screen-anchored) — a teal glow rising from
    //    the bottom of the screen, washing upward.
    this.mask.addLight({
      anchor: "screen",
      x: scene.scale.width / 2,
      y: scene.scale.height - 40,
      width: scene.scale.width,
      height: 150,
      gradient: "linear",
      angle: Math.PI / 2, // top → bottom of the footprint
      blend: "add",
      intensity: 0.8,
      stops: [
        { offset: 0, color: hexToInt(PALETTE.teal), alpha: 0 },
        { offset: 1, color: hexToInt(PALETTE.jade), alpha: 0.6 }
      ]
    });

    // 7. Hard-edged "light through a doorway" shaft: a linear gradient
    //    (bright at the doorway, fading with depth) clipped to a trapezoid
    //    polygon that widens downward — crisp sides, soft fade.
    this.mask.addLight({
      x: px,
      y: py - 132,
      width: 96,
      height: 150,
      gradient: "linear",
      angle: Math.PI / 2,
      blend: "add",
      mask: {
        type: "poly",
        points: [
          { x: 0.4, y: 0 },
          { x: 0.6, y: 0 },
          { x: 0.9, y: 1 },
          { x: 0.1, y: 1 }
        ]
      },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.sandLight), alpha: 0.9 },
        { offset: 0.6, color: hexToInt(PALETTE.sand), alpha: 0.35 },
        { offset: 1, color: hexToInt(PALETTE.sand), alpha: 0 }
      ]
    });
    this.label(px, py - 132 - 30, "doorway shaft (hard mask)");

    // Legend + flash hotkey (dev convenience).
    this.legend();
    this.keyFlash = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.F) ?? null;

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Fire the one-shot white flash (used by the screenshot harness + F key). */
  triggerFlash(): void {
    this.mask.flash(0xffffff, { riseMs: 110, holdMs: 60, fallMs: 260, peak: 0.9 });
  }

  update(): void {
    this.mask.update();
    this.character.setDepth(this.character.y);
    if (this.keyFlash && Phaser.Input.Keyboard.JustDown(this.keyFlash)) this.triggerFlash();
  }

  destroy(): void {
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.mask.destroy();
    this.character.destroy();
    for (const l of this.labels) l.destroy();
    this.labels.length = 0;
  }

  private label(worldX: number, worldY: number, text: string): void {
    const t = this.scene.add
      .text(worldX, worldY, text, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone,
        backgroundColor: inkA("cc"),
        padding: { x: 2, y: 1 }
      })
      .setOrigin(0.5, 0.5)
      .setDepth(LABEL_DEPTH);
    this.labels.push(t);
  }

  private legend(): void {
    const t = this.scene.add
      .text(6, 6, "?lighttest — LightMask demo\nF = white flash", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone,
        backgroundColor: inkA("cc"),
        padding: { x: 4, y: 3 }
      })
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(LABEL_DEPTH);
    this.labels.push(t);
  }
}
