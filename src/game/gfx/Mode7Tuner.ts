/**
 * Mode-7 camera tuner — a dev-only on-screen panel with +/- buttons for
 * elevation (camera height), zoom (focal length), angle (horizon fraction),
 * and peak height (a camera-independent vertical squash on the mountain
 * billboards, since raising/lowering camera pitch turned out to be a
 * separate, currently-nonexistent degree of freedom — squashing the
 * standees themselves shorter is a real, working substitute for "make the
 * mountains loom less" that doesn't require touching the projection math
 * at all), with the live numeric value shown next to each. Built so the
 * project owner can adjust the overworld's Mode-7 framing by hand on their
 * own device and read off the exact numbers to hand back as the new
 * defaults — NOT a player-facing feature. Only ever constructed when
 * `OverworldScene` sees the `mode7tune` query param (see its `create()`).
 *
 * Deliberately outside the palette-locked generated-art pipeline: this is
 * throwaway dev tooling, not shipped game art, so it draws directly with
 * Phaser primitives rather than going through tools/pipeline.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import {
  MODE7_CAMERA_HEIGHT,
  MODE7_FOCAL_LENGTH,
  MODE7_HORIZON_FRACTION,
  type Mode7Overrides
} from "../../core/mode7";

type ParamKey = "height" | "focal" | "horizonFraction" | "peakHeight";

interface Param {
  key: ParamKey;
  label: string;
  step: number;
  min: number;
  max: number;
  decimals: number;
}

const PARAMS: readonly Param[] = [
  { key: "height", label: "Elevation", step: 4, min: 8, max: 240, decimals: 0 },
  { key: "focal", label: "Zoom", step: 10, min: 20, max: 400, decimals: 0 },
  { key: "horizonFraction", label: "Angle", step: 0.02, min: 0.05, max: 0.75, decimals: 2 },
  // Camera-independent: squashes the mountain billboards shorter/flatter
  // without touching the projection at all (Mode7Ground.setBillboardHeightScale).
  // 1 = today's shipped look (full standee height); lower = shorter/flatter.
  { key: "peakHeight", label: "Peak Ht", step: 0.05, min: 0.15, max: 1.5, decimals: 2 }
];

const DEPTH = 9000;
const ROW_H = 15;
const PANEL_W = 150;

const DEFAULT_PEAK_HEIGHT = 1;

export class Mode7Tuner {
  private readonly scene: Phaser.Scene;
  private readonly onCameraChange: (v: Mode7Overrides) => void;
  private readonly onPeakHeightChange: (scale: number) => void;
  private values: Record<ParamKey, number>;
  private readonly valueTexts = new Map<ParamKey, Phaser.GameObjects.Text>();
  private readonly objects: Phaser.GameObjects.GameObject[] = [];

  constructor(
    scene: Phaser.Scene,
    onCameraChange: (v: Mode7Overrides) => void,
    onPeakHeightChange: (scale: number) => void
  ) {
    this.scene = scene;
    this.onCameraChange = onCameraChange;
    this.onPeakHeightChange = onPeakHeightChange;
    this.values = {
      height: MODE7_CAMERA_HEIGHT,
      focal: MODE7_FOCAL_LENGTH,
      horizonFraction: MODE7_HORIZON_FRACTION,
      peakHeight: DEFAULT_PEAK_HEIGHT
    };
    this.build();
  }

  private fmt(p: Param): string {
    return this.values[p.key].toFixed(p.decimals);
  }

  private button(x: number, y: number, w: number, h: number, label: string, onTap: () => void): void {
    const bg = this.scene.add
      .rectangle(x, y, w, h, hexToInt(PALETTE.mauve), 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH)
      .setInteractive({ useHandCursor: true });
    bg.on("pointerdown", onTap);
    const txt = this.scene.add
      .text(x + w / 2, y + h / 2, label, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.bone })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(DEPTH + 1);
    this.objects.push(bg, txt);
  }

  private build(): void {
    const panelX = this.scene.scale.width - PANEL_W - 4;
    const panelY = 14;
    const panelH = 4 + (PARAMS.length + 1) * ROW_H;

    const bg = this.scene.add
      .rectangle(panelX, panelY, PANEL_W, panelH, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(DEPTH - 1);
    this.objects.push(bg);

    PARAMS.forEach((p, i) => {
      const rowY = panelY + 4 + i * ROW_H;
      const label = this.scene.add
        .text(panelX + 4, rowY + 6, p.label, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.bone })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      const valueText = this.scene.add
        .text(panelX + 60, rowY + 6, this.fmt(p), {
          fontFamily: "monospace",
          fontSize: "8px",
          color: PALETTE.atbGold
        })
        .setOrigin(0, 0.5)
        .setScrollFactor(0)
        .setDepth(DEPTH);
      this.valueTexts.set(p.key, valueText);
      this.objects.push(label, valueText);
      this.button(panelX + 100, rowY, 14, 13, "-", () => this.adjust(p, -1));
      this.button(panelX + 118, rowY, 14, 13, "+", () => this.adjust(p, 1));
    });

    const resetY = panelY + 4 + PARAMS.length * ROW_H;
    this.button(panelX + 4, resetY, 60, 13, "RESET", () => this.reset());
  }

  private adjust(p: Param, dir: 1 | -1): void {
    const raw = this.values[p.key] + dir * p.step;
    const clamped = Math.min(p.max, Math.max(p.min, raw));
    // Round off float drift (0.1 + 0.02 style errors) without losing the
    // param's own precision.
    const rounded = Math.round(clamped * 100) / 100;
    this.values = { ...this.values, [p.key]: rounded };
    this.valueTexts.get(p.key)?.setText(this.fmt(p));
    this.emit();
  }

  private reset(): void {
    this.values = {
      height: MODE7_CAMERA_HEIGHT,
      focal: MODE7_FOCAL_LENGTH,
      horizonFraction: MODE7_HORIZON_FRACTION,
      peakHeight: DEFAULT_PEAK_HEIGHT
    };
    for (const p of PARAMS) this.valueTexts.get(p.key)?.setText(this.fmt(p));
    this.emit();
  }

  private emit(): void {
    this.onCameraChange(this.current());
    this.onPeakHeightChange(this.values.peakHeight);
  }

  /** Current values as Mode7Overrides, for the initial Mode7Ground(...) call
   *  (the panel starts at the MODE7_* defaults, same as an empty override).
   *  peakHeight is deliberately excluded — it's not a camera param, see
   *  `currentPeakHeight()`. */
  current(): Mode7Overrides {
    return { height: this.values.height, focal: this.values.focal, horizonFraction: this.values.horizonFraction };
  }

  /** Current billboard height-squash factor, for the initial
   *  Mode7Ground.setBillboardHeightScale(...) call. */
  currentPeakHeight(): number {
    return this.values.peakHeight;
  }

  destroy(): void {
    for (const o of this.objects) o.destroy();
    this.objects.length = 0;
    this.valueTexts.clear();
  }
}
