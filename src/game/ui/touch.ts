/**
 * Mobile affordances: a visible virtual joystick (appears where the thumb
 * lands on the left half), an action-button hint on the right, and a
 * fullscreen toggle. Pure presentation — ZoneScene still owns the input
 * logic; these just make it discoverable on a phone.
 *
 * Note: the fullscreen button only appears where the Fullscreen API is
 * available (Android Chrome, desktop). iPhone Safari doesn't support it
 * for games; there, "Add to Home Screen" gives a standalone fullscreen app.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";

export function isTouchDevice(scene: Phaser.Scene): boolean {
  return scene.sys.game.device.input.touch;
}

/** Top-right corner zone reserved for the fullscreen button. */
export function inFullscreenButtonZone(scene: Phaser.Scene, p: Phaser.Input.Pointer): boolean {
  return p.x > scene.scale.width - 30 && p.y < 36;
}

export function addFullscreenButton(scene: Phaser.Scene, y = 16): void {
  if (!scene.scale.fullscreen.available) return;
  const btn = scene.add
    .text(scene.scale.width - 4, y, "⛶", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: PALETTE.sand,
      backgroundColor: "#24182799",
      padding: { x: 4, y: 2 }
    })
    .setOrigin(1, 0)
    .setScrollFactor(0)
    .setDepth(7000)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerdown", () => {
    if (scene.scale.isFullscreen) {
      scene.scale.stopFullscreen();
      return;
    }
    scene.scale.startFullscreen();
    // On Android, rotate into landscape with the game (no-op elsewhere).
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    orientation?.lock?.("landscape")?.catch(() => {});
  });
}

/** Top-left corner zone reserved for the inventory button. */
export function inInventoryButtonZone(scene: Phaser.Scene, p: Phaser.Input.Pointer): boolean {
  return p.x < 30 && p.y < 36;
}

export function addInventoryButton(scene: Phaser.Scene, onTap: () => void, y = 16): void {
  const btn = scene.add
    .text(4, y, "🎒", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: PALETTE.sand,
      backgroundColor: "#24182799",
      padding: { x: 4, y: 2 }
    })
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(7000)
    .setInteractive({ useHandCursor: true });
  btn.on("pointerdown", onTap);
}

/** Joystick base + thumb that renders while the player drags. */
export class JoystickVisual {
  private base: Phaser.GameObjects.Graphics;
  private thumb: Phaser.GameObjects.Graphics;
  private originX = 0;
  private originY = 0;
  static readonly RADIUS = 20;

  constructor(scene: Phaser.Scene) {
    this.base = scene.add.graphics().setScrollFactor(0).setDepth(6500).setVisible(false);
    this.base.lineStyle(1.5, hexToInt(PALETTE.sand), 0.65);
    this.base.strokeCircle(0, 0, JoystickVisual.RADIUS);
    this.base.fillStyle(hexToInt(PALETTE.ink), 0.25);
    this.base.fillCircle(0, 0, JoystickVisual.RADIUS);
    this.thumb = scene.add.graphics().setScrollFactor(0).setDepth(6501).setVisible(false);
    this.thumb.fillStyle(hexToInt(PALETTE.sandLight), 0.8);
    this.thumb.fillCircle(0, 0, 8);
  }

  show(x: number, y: number): void {
    this.originX = x;
    this.originY = y;
    this.base.setPosition(x, y).setVisible(true);
    this.thumb.setPosition(x, y).setVisible(true);
  }

  move(dx: number, dy: number): void {
    if (!this.base.visible) return;
    const v = new Phaser.Math.Vector2(dx, dy);
    if (v.length() > JoystickVisual.RADIUS) v.setLength(JoystickVisual.RADIUS);
    this.thumb.setPosition(this.originX + v.x, this.originY + v.y);
  }

  hide(): void {
    this.base.setVisible(false);
    this.thumb.setVisible(false);
  }
}

/** Passive "A" button hint bottom-right (the whole right half is tappable). */
export function addActionButtonHint(scene: Phaser.Scene): void {
  const x = scene.scale.width - 26;
  const y = scene.scale.height - 90;
  const g = scene.add.graphics().setScrollFactor(0).setDepth(6500);
  g.fillStyle(hexToInt(PALETTE.ink), 0.35);
  g.fillCircle(x, y, 15);
  g.lineStyle(1.5, hexToInt(PALETTE.atbGold), 0.7);
  g.strokeCircle(x, y, 15);
  scene.add
    .text(x, y, "A", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: PALETTE.atbGold
    })
    .setOrigin(0.5)
    .setAlpha(0.85)
    .setScrollFactor(0)
    .setDepth(6501);
}
