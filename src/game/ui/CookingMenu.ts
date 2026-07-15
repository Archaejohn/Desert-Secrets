/**
 * CookingMenu — a thin Phaser presentation over the pure `src/core/cooking.ts`
 * timing minigame (Act 7's bake at La Pizzeria Sotterranea). The twin of
 * `FishingMenu`: a heat indicator sweeps a gauge; the player taps SPACE / taps
 * the screen (or the PLACE button on touch) when it's inside the glowing "just
 * right" band, setting each of the four toppings Piggy loves — silverfin,
 * socks, oranges, seaweed. Land all four before too many scorches and the bake
 * is PERFECT. All rules live in the tested core — this only renders the state
 * and forwards taps, self-managing its own input/update listeners like
 * FishingMenu / PerkMenu / InventoryMenu.
 */
import Phaser from "phaser";
import {
  DEFAULT_COOKING,
  addTopping,
  inWindow,
  newCooking,
  tickCooking,
  type CookingConfig,
  type CookingState
} from "../../core/cooking";
import { PALETTE, hexToInt } from "../../shared/palette";
import { inFullscreenButtonZone } from "./touch";

const GAUGE_W = 220;
const GAUGE_H = 16;

/** The four toppings, in the order they go on (labels the pips). */
const TOPPINGS = ["fish", "socks", "orange", "kelp"] as const;

export class CookingMenu {
  readonly cfg: CookingConfig;
  state: CookingState;
  private scene: Phaser.Scene;
  private onDone: (perfect: boolean) => void;
  private container: Phaser.GameObjects.Container;
  private gfx: Phaser.GameObjects.Graphics;
  private pips: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];
  private status: Phaser.GameObjects.Text;
  private gaugeX: number;
  private gaugeY: number;
  private finished = false;

  private onFrame = (_t: number, deltaMs: number): void => {
    if (this.finished) return;
    this.state = tickCooking(this.state, this.cfg, deltaMs / 1000);
    this.redraw();
  };
  private onKey = (): void => this.place();
  private onPointer = (p: Phaser.Input.Pointer): void => {
    if (inFullscreenButtonZone(this.scene, p)) return;
    this.place();
  };

  constructor(scene: Phaser.Scene, onDone: (perfect: boolean) => void, cfg: CookingConfig = DEFAULT_COOKING) {
    this.scene = scene;
    this.cfg = cfg;
    this.onDone = onDone;
    this.state = newCooking(cfg);

    const w = scene.scale.width;
    const h = scene.scale.height;
    this.gaugeX = (w - GAUGE_W) / 2;
    this.gaugeY = h / 2 + 6;

    const panelW = GAUGE_W + 40;
    const panelH = 96;
    const panelX = (w - panelW) / 2;
    const panelY = h / 2 - panelH / 2 - 4;
    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.92);
    bg.fillRect(panelX, panelY, panelW, panelH);
    bg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    bg.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    const title = scene.add
      .text(w / 2, panelY + 8, "THE BAKE — set each topping in the glow!", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5, 0);

    this.gfx = scene.add.graphics();
    this.pips = scene.add.graphics();
    // The four topping names, lit as each is placed.
    for (let i = 0; i < TOPPINGS.length; i++) {
      this.labels.push(
        scene.add
          .text(this.gaugeX + i * 44 + 2, this.gaugeY + GAUGE_H + 16, TOPPINGS[i], {
            fontFamily: "monospace",
            fontSize: "8px",
            color: PALETTE.plum
          })
          .setOrigin(0, 0)
      );
    }
    this.status = scene.add
      .text(w / 2, panelY + panelH - 14, "", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.bone
      })
      .setOrigin(0.5, 0);

    // PLACE button (a visible touch affordance; a tap anywhere also places).
    const btn = scene.add
      .text(w / 2, panelY + panelH + 12, "  PLACE  ", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.ink,
        backgroundColor: PALETTE.atbGold,
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5, 0);

    this.container = scene.add
      .container(0, 0, [bg, title, this.gfx, this.pips, ...this.labels, this.status, btn])
      .setScrollFactor(0)
      .setDepth(6800);

    this.redraw();

    scene.events.on(Phaser.Scenes.Events.UPDATE, this.onFrame);
    const kb = scene.input.keyboard!;
    kb.on("keydown-SPACE", this.onKey);
    kb.on("keydown-ENTER", this.onKey);
    scene.input.on("pointerdown", this.onPointer);
  }

  private place(): void {
    if (this.finished) return;
    this.state = addTopping(this.state, this.cfg);
    this.redraw();
    if (this.state.done) this.finish();
  }

  private redraw(): void {
    const g = this.gfx;
    g.clear();
    // Track (the pizza in the oven).
    g.fillStyle(hexToInt(PALETTE.rust), 1);
    g.fillRect(this.gaugeX, this.gaugeY, GAUGE_W, GAUGE_H);
    // Target window (the "just right" browning band).
    const bandX = this.gaugeX + (this.cfg.target - this.cfg.windowHalf) * GAUGE_W;
    const bandW = this.cfg.windowHalf * 2 * GAUGE_W;
    g.fillStyle(hexToInt(PALETTE.amber), 1);
    g.fillRect(bandX, this.gaugeY, bandW, GAUGE_H);
    g.fillStyle(hexToInt(PALETTE.atbGold), 1);
    g.fillRect(bandX, this.gaugeY, bandW, 2);
    // Heat indicator.
    const mx = this.gaugeX + this.state.position * GAUGE_W;
    const hot = inWindow(this.state, this.cfg);
    g.fillStyle(hexToInt(hot ? PALETTE.white : PALETTE.hpRed), 1);
    g.fillRect(mx - 1, this.gaugeY - 4, 3, GAUGE_H + 8);
    // Frame.
    g.lineStyle(1, hexToInt(PALETTE.bone), 1);
    g.strokeRect(this.gaugeX + 0.5, this.gaugeY + 0.5, GAUGE_W - 1, GAUGE_H - 1);

    // Topping pips.
    this.pips.clear();
    for (let i = 0; i < this.cfg.requiredAdds; i++) {
      const px = this.gaugeX + i * 14;
      const py = this.gaugeY + GAUGE_H + 8;
      this.pips.fillStyle(hexToInt(i < this.state.added ? PALETTE.atbGold : PALETTE.plum), 1);
      this.pips.fillRect(px, py, 10, 6);
    }
    for (let i = 0; i < this.labels.length; i++) {
      this.labels[i].setColor(i < this.state.added ? PALETTE.atbGold : PALETTE.plum);
    }
    this.status.setText(
      `toppings ${this.state.added}/${this.cfg.requiredAdds}   scorches ${this.state.fumbles}/${this.cfg.maxFumbles}`
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
    this.onDone(this.state.perfect);
  }
}
