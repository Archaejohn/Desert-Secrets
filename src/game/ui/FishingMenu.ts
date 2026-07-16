/**
 * FishingMenu — a thin Phaser presentation over the pure `src/core/fishing.ts`
 * timing minigame. A marker slides across a gauge; the player taps SPACE /
 * taps the screen (or the HOOK button on touch) when the marker is inside the
 * glowing band. Land `requiredHits` before the line snaps and the silverfin
 * is caught. All rules live in the tested core — this only renders the state
 * and forwards taps, self-managing its own input/update listeners like
 * PerkMenu / InventoryMenu.
 */
import Phaser from "phaser";
import {
  DEFAULT_FISHING,
  hookFishing,
  inWindow,
  newFishing,
  tickFishing,
  type FishingConfig,
  type FishingState
} from "../../core/fishing";
import { PALETTE, hexToInt } from "../../shared/palette";
import { inFullscreenButtonZone } from "./touch";
import { addToUiLayer } from "../gfx/sceneUi";

const GAUGE_W = 220;
const GAUGE_H = 16;

export class FishingMenu {
  readonly cfg: FishingConfig;
  state: FishingState;
  private scene: Phaser.Scene;
  private onDone: (landed: boolean) => void;
  private container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Graphics;
  private pips: Phaser.GameObjects.Graphics;
  private status: Phaser.GameObjects.Text;
  private gaugeX: number;
  private gaugeY: number;
  private finished = false;

  private onFrame = (_t: number, deltaMs: number): void => {
    if (this.finished) return;
    this.state = tickFishing(this.state, this.cfg, deltaMs / 1000);
    this.redraw();
  };
  private onKey = (): void => this.hook();
  private onPointer = (p: Phaser.Input.Pointer): void => {
    if (inFullscreenButtonZone(this.scene, p)) return;
    this.hook();
  };

  constructor(scene: Phaser.Scene, onDone: (landed: boolean) => void, cfg: FishingConfig = DEFAULT_FISHING) {
    this.scene = scene;
    this.cfg = cfg;
    this.onDone = onDone;
    this.state = newFishing(cfg);

    const w = scene.scale.width;
    const h = scene.scale.height;
    this.gaugeX = (w - GAUGE_W) / 2;
    this.gaugeY = h / 2 + 6;

    const panelW = GAUGE_W + 40;
    const panelH = 92;
    const panelX = (w - panelW) / 2;
    const panelY = h / 2 - panelH / 2 - 4;
    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.92);
    bg.fillRect(panelX, panelY, panelW, panelH);
    bg.lineStyle(1, hexToInt(PALETTE.mint), 1);
    bg.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    const title = scene.add
      .text(w / 2, panelY + 8, "SILVERFIN — hook it in the glow!", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.mint
      })
      .setOrigin(0.5, 0);

    this.gfx = scene.add.graphics();
    this.pips = scene.add.graphics();
    this.status = scene.add
      .text(w / 2, panelY + panelH - 14, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.bone
      })
      .setOrigin(0.5, 0);

    // HOOK button (a visible touch affordance; a tap anywhere also hooks).
    const btn = scene.add
      .text(w / 2, panelY + panelH + 12, "  HOOK  ", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.ink,
        backgroundColor: PALETTE.atbGold,
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 0);

    this.container = scene.add
      .container(0, 0, [bg, title, this.gfx, this.pips, this.status, btn])
      .setScrollFactor(0)
      .setDepth(6800);
    addToUiLayer(scene, this.container);

    this.redraw();

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onFrame);
    const kb = scene.input.keyboard!;
    kb.on("keydown-SPACE", this.onKey);
    kb.on("keydown-ENTER", this.onKey);
    scene.input.on("pointerdown", this.onPointer);
  }

  private hook(): void {
    if (this.finished) return;
    this.state = hookFishing(this.state, this.cfg);
    this.redraw();
    if (this.state.done) this.finish();
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    // Track.
    g.fillStyle(hexToInt(PALETTE.tealDeep), 1);
    g.fillRect(this.gaugeX, this.gaugeY, GAUGE_W, GAUGE_H);
    // Target window (the glow).
    const bandX = this.gaugeX + (this.cfg.target - this.cfg.windowHalf) * GAUGE_W;
    const bandW = this.cfg.windowHalf * 2 * GAUGE_W;
    g.fillStyle(hexToInt(PALETTE.jade), 1);
    g.fillRect(bandX, this.gaugeY, bandW, GAUGE_H);
    g.fillStyle(hexToInt(PALETTE.mint), 1);
    g.fillRect(bandX, this.gaugeY, bandW, 2);
    // Marker.
    const mx = this.gaugeX + this.state.position * GAUGE_W;
    const hot = inWindow(this.state, this.cfg);
    g.fillStyle(hexToInt(hot ? PALETTE.white : PALETTE.atbGold), 1);
    g.fillRect(mx - 1, this.gaugeY - 4, 3, GAUGE_H + 8);
    // Frame.
    g.lineStyle(1, hexToInt(PALETTE.bone), 1);
    g.strokeRect(this.gaugeX + 0.5, this.gaugeY + 0.5, GAUGE_W - 1, GAUGE_H - 1);

    // Hit pips.
    this.pips.clear();
    for (let i = 0; i < this.cfg.requiredHits; i++) {
      const px = this.gaugeX + i * 14;
      const py = this.gaugeY + GAUGE_H + 8;
      this.pips.fillStyle(hexToInt(i < this.state.hits ? PALETTE.mint : PALETTE.plum), 1);
      this.pips.fillRect(px, py, 10, 6);
    }
    this.status.setText(
      `hits ${this.state.hits}/${this.cfg.requiredHits}   misses ${this.state.misses}/${this.cfg.maxMisses}`
    );
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.onFrame);
    const kb = this.scene.input.keyboard;
    kb?.off("keydown-SPACE", this.onKey);
    kb?.off("keydown-ENTER", this.onKey);
    this.scene.input.off("pointerdown", this.onPointer);
    this.container.destroy();
    this.onDone(this.state.landed);
  }
}
