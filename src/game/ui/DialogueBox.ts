/**
 * Screen-space dialogue box driven by a core DialogueRunner.
 * The scene forwards input (confirm / up / down); all conversation state
 * lives in the tested core runner — this class only renders it.
 */
import Phaser from "phaser";
import { DialogueRunner, type DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";

const BOX_H = 64;
const PAD = 8;

export class DialogueBox {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private speakerText: Phaser.GameObjects.Text;
  private lineText: Phaser.GameObjects.Text;
  private choiceTexts: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private runner: DialogueRunner | null = null;
  private selected = 0;
  private onClose: ((endNodeId: string | null) => void) | null = null;
  private lastNodeId: string | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
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

    this.container = scene.add.container(0, h - BOX_H - 4, [
      bg,
      this.speakerText,
      this.lineText,
      this.hintText
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

  /** For touch: pick a specific choice row if one was tapped, else confirm. */
  tapAt(screenY: number): void {
    if (!this.runner) return;
    const choices = this.runner.choices;
    if (choices) {
      const localY = screenY - (this.container.y + 18);
      const row = Math.floor(localY / 12);
      if (row >= 0 && row < choices.length) this.selected = row;
    }
    this.confirm();
  }

  private close(): void {
    this.runner = null;
    this.container.setVisible(false);
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
      this.hintText.setText("↑↓ + SPACE");
    } else {
      this.lineText.setText(line.text);
      this.hintText.setText("SPACE ▸");
    }
  }

  private renderChoices(choices: { text: string }[]): void {
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = choices.map((c, i) => {
      const t = this.scene.add.text(
        PAD + 10,
        18 + 12 * (i + 1),
        `${i === this.selected ? "▸ " : "  "}${c.text}`,
        {
          fontFamily: "monospace",
          fontSize: "9px",
          color: i === this.selected ? PALETTE.atbGold : PALETTE.sand
        }
      );
      this.container.add(t);
      return t;
    });
  }
}
