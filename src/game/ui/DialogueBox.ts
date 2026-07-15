/**
 * Screen-space dialogue box driven by a core DialogueRunner.
 * The scene forwards input (confirm / up / down); all conversation state
 * lives in the tested core runner — this class only renders it.
 */
import Phaser from "phaser";
import { DialogueRunner, type DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";
import { isTouchDevice, TouchListButtons } from "./touch";

const BOX_H = 100;
const PAD = 8;
/** Each choice row's tappable band — deliberately generous (was 12px). */
const CHOICE_ROW_H = 18;
const CHOICE_TOP = 30;
const BTN_SIZE = 22;

export class DialogueBox {
  private scene: Phaser.Scene;
  private touch: boolean;
  private container: Phaser.GameObjects.Container;
  private speakerText: Phaser.GameObjects.Text;
  private lineText: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private choiceHighlight: Phaser.GameObjects.Graphics;
  private hintText: Phaser.GameObjects.Text;
  private touchButtons: TouchListButtons;
  private runner: DialogueRunner | null = null;
  private selected = 0;
  private onClose: ((endNodeId: string | null) => void) | null = null;
  private lastNodeId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.touch = isTouchDevice(scene);
    const w = scene.scale.width;
    const h = scene.scale.height;

    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.94);
    bg.fillRect(4, 0, w - 8, BOX_H);
    bg.lineStyle(1, hexToInt(PALETTE.sand), 1);
    bg.strokeRect(4.5, 0.5, w - 9, BOX_H - 1);

    this.speakerText = scene.add.text(PAD + 2, 5, "", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: PALETTE.atbGold
    });
    this.lineText = scene.add.text(PAD + 2, 18, "", {
      fontFamily: "monospace",
      fontSize: "9px",
      color: PALETTE.bone,
      wordWrap: { width: w - PAD * 2 - 8 },
      lineSpacing: 3
    });
    this.hintText = scene.add
      .text(w - PAD - 4, BOX_H - 11, "SPACE ▸", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.mauve
      })
      .setOrigin(1, 0);

    this.choiceHighlight = scene.add.graphics();
    // ▲ / ✓ / ▼ column on the box's right edge — a reliable touch
    // fallback to precisely tapping a choice row, hidden until a choice
    // list is showing (and never shown on desktop; arrows + SPACE cover
    // that). Hit-tested manually in tapAt(), same as PerkMenu/InventoryMenu.
    this.touchButtons = new TouchListButtons(scene, w - PAD - BTN_SIZE, CHOICE_TOP - 2, BTN_SIZE).setVisible(false);

    this.container = scene.add.container(0, h - BOX_H - 4, [
      bg,
      this.choiceHighlight,
      this.speakerText,
      this.lineText,
      this.hintText,
      this.touchButtons.container
    ]);
    this.container.setScrollFactor(0).setDepth(1000).setVisible(false);
  }

  get isOpen(): boolean {
    return this.runner !== null;
  }

  open(script: DialogueScript, onClose?: (endNodeId: string | null) => void): void {
    this.runner = new DialogueRunner(script);
    this.onClose = onClose ?? null;
    this.runner.start();
    this.lastNodeId = this.runner.currentNodeId;
    this.container.setVisible(true);
    this.render();
  }

  /** Advance / pick the highlighted choice. */
  confirm(): void {
    if (!this.runner) return;
    const choices = this.runner.choices;
    const line = choices ? this.runner.advance(this.selected) : this.runner.advance();
    if (this.runner.currentNodeId !== null) this.lastNodeId = this.runner.currentNodeId;
    if (line === null) {
      this.close();
      return;
    }
    this.render();
  }

  moveSelection(delta: number): void {
    if (!this.runner) return;
    const choices = this.runner.choices;
    if (!choices) return;
    this.selected = (this.selected + delta + choices.length) % choices.length;
    this.renderChoices(choices);
  }

  /**
   * Touch input. Plain lines: any tap advances. Choice lists: a tap on
   * the ▲/✓/▼ column always works (large, fixed-position targets); a tap
   * directly on a choice row also picks it. Taps elsewhere are ignored,
   * so a stray touch (e.g. a joystick-intent press) can't pick an option.
   */
  tapAt(screenX: number, screenY: number): void {
    if (!this.runner) return;
    const choices = this.runner.choices;
    if (!choices) {
      this.confirm();
      return;
    }
    const localX = screenX - this.container.x;
    const localY = screenY - this.container.y;
    if (this.touch) {
      const hit = this.touchButtons.hitTest(localX, localY);
      if (hit === "up") {
        this.moveSelection(-1);
        return;
      }
      if (hit === "down") {
        this.moveSelection(1);
        return;
      }
      if (hit === "confirm") {
        this.confirm();
        return;
      }
    }
    const row = Math.floor((localY - CHOICE_TOP) / CHOICE_ROW_H);
    if (row >= 0 && row < choices.length) {
      this.selected = row;
      this.confirm();
    }
  }

  private close(): void {
    this.runner = null;
    this.container.setVisible(false);
    this.touchButtons.setVisible(false);
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];
    const cb = this.onClose;
    const endedAt = this.lastNodeId;
    this.onClose = null;
    cb?.(endedAt);
  }

  private render(): void {
    if (!this.runner) return;
    const line = this.runner.currentLine;
    if (!line) return;
    this.speakerText.setText(line.speaker.toUpperCase());
    const choices = this.runner.choices;
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];
    if (choices) {
      this.selected = 0;
      this.lineText.setText(line.text);
      this.renderChoices(choices);
      this.touchButtons.setVisible(this.touch);
      this.hintText.setVisible(!this.touch);
      this.hintText.setText("↑↓ + SPACE");
    } else {
      this.lineText.setText(line.text);
      this.choiceHighlight.clear();
      this.touchButtons.setVisible(false);
      this.hintText.setVisible(true);
      this.hintText.setText(this.touch ? "tap ▸" : "SPACE ▸");
    }
  }

  private renderChoices(choices: { text: string }[]): void {
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];
    this.choiceHighlight.clear();
    // Leave room for the touch button column so the highlight bar and the
    // choice text never sit underneath it.
    const rowW = this.scene.scale.width - PAD * 2 - (this.touch ? BTN_SIZE + PAD : 0);
    choices.forEach((c, i) => {
      const rowY = CHOICE_TOP + i * CHOICE_ROW_H;
      if (i === this.selected) {
        this.choiceHighlight.fillStyle(hexToInt(PALETTE.plum), 0.6);
        this.choiceHighlight.fillRect(PAD, rowY, rowW, CHOICE_ROW_H - 2);
      }
      const t = this.scene.add.text(PAD + 10, rowY + 2, `${i === this.selected ? "▸ " : "  "}${c.text}`, {
        fontFamily: "monospace",
        fontSize: "9px",
        color: i === this.selected ? PALETTE.atbGold : PALETTE.sand
      });
      this.container.add(t);
      this.choiceTexts.push(t);
    });
  }
}
