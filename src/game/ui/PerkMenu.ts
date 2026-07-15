/**
 * Modal level-up perk chooser. Lists the four PERKS from the tested core
 * (label + description); keyboard up/down + space/enter, a direct tap on
 * a row, or (touch) the ▲/✓/▼ column pick one. The menu owns its input
 * handlers while open and removes them before reporting the choice, so
 * chained menus (multi-level gains) never fight over events. Styled to
 * match the battle command panel: ink background, gold border and
 * highlight.
 */
import Phaser from "phaser";
import { PERKS, type PerkId } from "../../core/progression";
import { PALETTE, hexToInt } from "../../shared/palette";
import { isTouchDevice, TouchListButtons } from "./touch";

const PANEL_W = 260;
const ROW_H = 22;
const ROWS_TOP = 34;
const PANEL_H = ROWS_TOP + PERKS.length * ROW_H + 10;
const BTN_SIZE = 22;
const BTN_GAP = 24;

export class PerkMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private touchButtons: TouchListButtons | null = null;
  private sel = 0;
  private onChoose: (perk: PerkId) => void;
  private keyHandlers: Array<[string, () => void]> = [];
  private pointerHandler: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, onChoose: (perk: PerkId) => void) {
    this.scene = scene;
    this.onChoose = onChoose;
    const touch = isTouchDevice(scene);

    const x = Math.round((scene.scale.width - PANEL_W) / 2);
    const y = Math.round((scene.scale.height - PANEL_H) / 2);

    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.96);
    bg.fillRect(0, 0, PANEL_W, PANEL_H);
    bg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    bg.strokeRect(0.5, 0.5, PANEL_W - 1, PANEL_H - 1);

    const title = scene.add
      .text(PANEL_W / 2, 10, "LEVEL UP — CHOOSE A PERK", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5, 0);

    this.container = scene.add.container(x, y, [bg, title]);
    this.container.setScrollFactor(0).setDepth(5000);

    // Description column narrows on touch to leave room for the ▲/✓/▼
    // buttons on the right, so neither ever overlaps the other.
    const descW = touch ? PANEL_W - 120 - (BTN_SIZE + 16) : PANEL_W - 120 - 8;
    for (let i = 0; i < PERKS.length; i++) {
      const rowY = ROWS_TOP + i * ROW_H;
      const label = scene.add.text(14, rowY, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.bone
      });
      const desc = scene.add.text(120, rowY + 1, PERKS[i].description, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand,
        wordWrap: { width: descW }
      });
      this.container.add([label, desc]);
      this.labelTexts.push(label);
    }

    if (touch) {
      const listH = PERKS.length * ROW_H;
      const btnTop = ROWS_TOP + Math.round((listH - (BTN_SIZE * 2 + BTN_GAP)) / 2);
      this.touchButtons = new TouchListButtons(scene, PANEL_W - 8 - BTN_SIZE, btnTop, BTN_SIZE, BTN_GAP);
      this.container.add(this.touchButtons.container);
    }

    this.render();

    const kb = scene.input.keyboard!;
    this.keyHandlers = [
      ["keydown-UP", () => this.move(-1)],
      ["keydown-DOWN", () => this.move(1)],
      ["keydown-SPACE", () => this.confirm()],
      ["keydown-ENTER", () => this.confirm()]
    ];
    for (const [ev, fn] of this.keyHandlers) kb.on(ev, fn);
    this.pointerHandler = (p: Phaser.Input.Pointer) => this.tapAt(p);
    scene.input.on("pointerdown", this.pointerHandler);
  }

  private render(): void {
    for (let i = 0; i < PERKS.length; i++) {
      this.labelTexts[i]
        .setText(`${i === this.sel ? "▸ " : "  "}${PERKS[i].label}`)
        .setColor(i === this.sel ? PALETTE.atbGold : PALETTE.bone);
    }
  }

  private move(delta: number): void {
    this.sel = (this.sel + delta + PERKS.length) % PERKS.length;
    this.render();
  }

  private tapAt(p: Phaser.Input.Pointer): void {
    const localX = p.x - this.container.x;
    const localY = p.y - this.container.y;
    if (this.touchButtons) {
      const hit = this.touchButtons.hitTest(localX, localY);
      if (hit === "up") return this.move(-1);
      if (hit === "down") return this.move(1);
      if (hit === "confirm") return this.confirm();
    }
    const row = Math.floor((localY - ROWS_TOP + 4) / ROW_H);
    if (localX < 0 || localX > PANEL_W || row < 0 || row >= PERKS.length) return;
    this.sel = row;
    this.confirm();
  }

  private confirm(): void {
    // Tear down input first: onChoose may open the next PerkMenu.
    const kb = this.scene.input.keyboard!;
    for (const [ev, fn] of this.keyHandlers) kb.off(ev, fn);
    this.scene.input.off("pointerdown", this.pointerHandler);
    this.container.destroy();
    this.onChoose(PERKS[this.sel].id);
  }
}
