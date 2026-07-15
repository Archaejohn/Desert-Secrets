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

/**
 * Passive "A" button hint bottom-right (the whole right half is
 * tappable). Returns the container so callers can hide it while a
 * dialogue box or menu occupies the same screen region — it otherwise
 * visually collides with the bottom of the dialogue box.
 */
export function addActionButtonHint(scene: Phaser.Scene): Phaser.GameObjects.Container {
  const x = scene.scale.width - 26;
  const y = scene.scale.height - 90;
  const g = scene.add.graphics();
  g.fillStyle(hexToInt(PALETTE.ink), 0.35);
  g.fillCircle(x, y, 15);
  g.lineStyle(1.5, hexToInt(PALETTE.atbGold), 0.7);
  g.strokeCircle(x, y, 15);
  const t = scene.add
    .text(x, y, "A", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: PALETTE.atbGold
    })
    .setOrigin(0.5)
    .setAlpha(0.85);
  return scene.add.container(0, 0, [g, t]).setScrollFactor(0).setDepth(6500);
}

/**
 * Reusable ▲ / ✓ / ▼ touch control column for any onscreen list where the
 * player must move a selection and confirm it (dialogue choices, perk
 * picks, battle commands/targets, inventory rows) — a fixed-position,
 * generously-sized fallback to precisely tapping a specific row.
 * Positioned and hit-tested in the CALLER's local coordinate space (e.g.
 * relative to a menu's own container), not the scene's.
 */
export class TouchListButtons {
  readonly container: Phaser.GameObjects.Container;
  readonly x: number;
  readonly top: number;
  readonly size: number;
  readonly gap: number;

  constructor(scene: Phaser.Scene, x: number, top: number, size = 22, gap = 24) {
    this.x = x;
    this.top = top;
    this.size = size;
    this.gap = gap;
    this.container = scene.add.container(0, 0);
    const glyphs: Array<[number, "up" | "confirm" | "down"]> = [
      [0, "up"],
      [1, "confirm"],
      [2, "down"]
    ];
    for (const [row, kind] of glyphs) {
      const y = top + row * gap;
      const g = scene.add.graphics();
      g.fillStyle(hexToInt(PALETTE.plum), 0.85);
      g.fillRect(x, y, size, size);
      g.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
      g.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      if (kind === "confirm") {
        // A checkmark drawn with Graphics, not a font glyph: "✓" renders
        // as a bare, broken diagonal stroke in some monospace fallbacks
        // (missing its short left leg) — Graphics guarantees the same
        // shape on every platform.
        g.lineStyle(2, hexToInt(PALETTE.atbGold), 1);
        g.beginPath();
        g.moveTo(x + size * 0.26, y + size * 0.54);
        g.lineTo(x + size * 0.44, y + size * 0.72);
        g.lineTo(x + size * 0.76, y + size * 0.3);
        g.strokePath();
        this.container.add(g);
        continue;
      }
      const t = scene.add
        .text(x + size / 2, y + size / 2, kind === "up" ? "▲" : "▼", {
          fontFamily: "monospace",
          fontSize: "11px",
          color: PALETTE.atbGold
        })
        .setOrigin(0.5);
      this.container.add([g, t]);
    }
  }

  setVisible(v: boolean): this {
    this.container.setVisible(v);
    return this;
  }

  /** Which button (if any) contains a point in the same local space as x/top. */
  hitTest(localX: number, localY: number): "up" | "confirm" | "down" | null {
    if (localX < this.x || localX > this.x + this.size) return null;
    if (localY >= this.top && localY <= this.top + this.size) return "up";
    if (localY >= this.top + this.gap && localY <= this.top + this.gap + this.size) return "confirm";
    if (localY >= this.top + this.gap * 2 && localY <= this.top + this.gap * 2 + this.size) return "down";
    return null;
  }
}
