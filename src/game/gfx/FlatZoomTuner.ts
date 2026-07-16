/**
 * Flat-view zoom tuner — a dev-only on-screen panel with +/- buttons for
 * OverworldScene's flat-tilemap camera zoom (`OVERWORLD_FLAT_ZOOM`), the
 * "big world" replacement for Mode-7 as the overworld's default rendering
 * (docs/CONTRACTS.md "v21"). Twin of Mode7Tuner: same on-screen style, same
 * gating (the `mode7tune` debug flag — here its `"flat"` value, see
 * OverworldScene's `readDebugMode()`), lets the project owner drag the zoom
 * live on their own device and read off the exact value to hand back as the
 * new default. NOT a player-facing feature.
 *
 * Its own panel objects are explicitly added to the scene's `uiLayer`
 * rather than left to ZoneScene's default "everything not explicitly UI is
 * world" per-frame sweep, because it's tuning the very camera zoom it's
 * drawn under: rendered through the world camera, the panel would shrink
 * along with the view it's supposed to stay legible over while adjusting.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import { addToUiLayer } from "./sceneUi";

const DEPTH = 9000;
const PANEL_W = 150;
const ROW_H = 15;
const STEP = 0.05;
const MIN_ZOOM = 0.2;
const MAX_ZOOM = 1;

export class FlatZoomTuner {
  private readonly scene: Phaser.Scene;
  private readonly defaultZoom: number;
  private readonly onZoomChange: (zoom: number) => void;
  private value: number;
  private valueText!: Phaser.GameObjects.Text;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(scene: Phaser.Scene, defaultZoom: number, onZoomChange: (zoom: number) => void) {
    this.scene = scene;
    this.defaultZoom = defaultZoom;
    this.onZoomChange = onZoomChange;
    this.value = defaultZoom;
    this.build();
  }

  private fmt(): string {
    return this.value.toFixed(2);
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.objects.push(obj);
    addToUiLayer(this.scene, obj);
    return obj;
  }

  private button(x: number, y: number, w: number, h: number, label: string, onTap: () => void): void {
    const bg = this.add(
      this.scene.add
        .rectangle(x, y, w, h, hexToInt(PALETTE.mauve), 0.95)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH)
        .setInteractive({ useHandCursor: true })
    );
    bg.on("pointerdown", onTap);
    this.add(
      this.scene.add
        .text(x + w / 2, y + h / 2, label, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.bone })
        .setOrigin(0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH + 1)
    );
  }

  private build(): void {
    const panelX = this.scene.scale.width - PANEL_W - 4;
    const panelY = 14;
    const panelH = 4 + 2 * ROW_H;

    this.add(
      this.scene.add
        .rectangle(panelX, panelY, PANEL_W, panelH, 0x000000, 0.55)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(DEPTH - 1)
    );

    const rowY = panelY + 4;
    this.add(
      this.scene.add
        .text(panelX + 4, rowY + 6, "Zoom", { fontFamily: "monospace", fontSize: "8px", color: PALETTE.bone })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH)
    );
    this.valueText = this.add(
      this.scene.add
        .text(panelX + 60, rowY + 6, this.fmt(), { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH)
    );
    this.button(panelX + 100, rowY, 14, 13, "-", () => this.adjust(-1));
    this.button(panelX + 118, rowY, 14, 13, "+", () => this.adjust(1));

    const resetY = rowY + ROW_H;
    this.button(panelX + 4, resetY, 60, 13, "RESET", () => this.reset());
  }

  private adjust(dir: 1 | -1): void {
    const raw = this.value + dir * STEP;
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, raw));
    this.value = Math.round(clamped * 100) / 100;
    this.valueText.setText(this.fmt());
    this.onZoomChange(this.value);
  }

  private reset(): void {
    this.value = this.defaultZoom;
    this.valueText.setText(this.fmt());
    this.onZoomChange(this.value);
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
  }
}
