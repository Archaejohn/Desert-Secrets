/**
 * The Part Two opening cutscene — the payoff for the whole one-way Thomas radio
 * thread (see core/scripts/thomas.ts). Joseph lies on one side of the screen
 * with Piggy, Fluffball and Slither gathered around him; Thomas stands on the
 * other side; the two finally connect over the radio, TWO-way at last.
 *
 * A self-contained, non-zone cutscene scene (mirrors the end-card scenes'
 * structure — a dark backdrop, placed sprites, a DialogueBox playing a core
 * script, then a "to be continued" beat back to the title). It's reached from
 * PizzaAscentScene's END OF PART ONE card (the finale hand-off). The rest of
 * Part Two isn't built, so after the four lines it resets to the title.
 *
 * The four exact lines live in `partTwoOpeningScript` (core, unit-tested).
 * Thomas has his own character sheet now (`thomas` — a broad-shouldered
 * muscle-man body-type; see tools/pipeline/src/sprites/thomas.ts).
 */
import Phaser from "phaser";
import { DialogueBox } from "../ui/DialogueBox";
import { partTwoOpeningScript } from "../../core/scripts/partTwoOpening";
import { resetGame } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";

export class PartTwoOpeningScene extends Phaser.Scene {
  /** Public so headless smoke checks can read conversation state. */
  dialogue!: DialogueBox;
  private done = false;
  private crackle: Phaser.GameObjects.Text | null = null;

  constructor() {
    super("partTwoOpening");
  }

  create(): void {
    this.done = false;
    const w = this.scale.width;
    const h = this.scale.height;

    this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 1);
    this.add
      .text(w / 2, 20, "PART TWO", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5);

    // Joseph's side (left): the hero lying down, his three companions gathered
    // around. A gentle scatter reads as "resting together" without new art.
    const groundY = h / 2 + 8;
    const joseph = this.add.sprite(96, groundY, "hero", 0).setScale(1.4);
    joseph.setAngle(90); // lying down, feet toward Thomas
    if (this.anims.exists("hero-idle-right")) joseph.play("hero-idle-right");

    const piggy = this.add.sprite(66, groundY + 16, "piggy", 0);
    if (this.anims.exists("piggy-idle")) piggy.play("piggy-idle");
    const fluffball = this.add.sprite(112, groundY + 18, "fluffball", 0);
    if (this.anims.exists("fluffball-idle")) fluffball.play("fluffball-idle");
    const slither = this.add.sprite(86, groundY + 24, "slither", 0);
    if (this.anims.exists("slither-idle")) slither.play("slither-idle");

    // Thomas's side (right): standing, facing back toward Joseph.
    const thomas = this.add.sprite(w - 96, groundY - 4, "thomas", 0).setScale(1.4);
    if (this.anims.exists("thomas-idle-left")) thomas.play("thomas-idle-left");

    // The radio link between them: a dotted arc plus a blinking crackle glyph.
    const link = this.add.graphics().setDepth(10);
    link.lineStyle(1, hexToInt(PALETTE.skyBlue), 0.8);
    for (let x = 130; x < w - 130; x += 10) {
      link.beginPath();
      link.moveTo(x, groundY - 30);
      link.lineTo(x + 4, groundY - 30);
      link.strokePath();
    }
    this.crackle = this.add
      .text(w / 2, groundY - 40, "((•))", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.mint
      })
      .setOrigin(0.5);
    this.tweens.add({
      targets: this.crackle,
      alpha: 0.2,
      duration: 420,
      yoyo: true,
      repeat: -1
    });

    // Play the four-line radio exchange, then the hand-off beat.
    this.dialogue = new DialogueBox(this);
    this.dialogue.open(partTwoOpeningScript, () => this.showToBeContinued());

    const kb = this.input.keyboard;
    kb?.on("keydown-SPACE", () => this.advance());
    kb?.on("keydown-ENTER", () => this.advance());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.dialogue.isOpen) this.dialogue.tapAt(p.x, p.y);
      else this.advance();
    });
  }

  /**
   * SPACE/ENTER/tap: while the radio exchange is open it advances the box;
   * on the "to be continued" beat it clears the save and returns to the title.
   */
  private advance(): void {
    if (this.dialogue.isOpen) {
      this.dialogue.confirm();
      return;
    }
    if (this.done) return;
    this.done = true;
    resetGame(this);
    this.scene.start("boot");
  }

  private showToBeContinued(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.crackle?.destroy();
    this.crackle = null;
    this.add
      .text(w / 2, h - 40, "To be continued...", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.mint
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h - 22, "SPACE — to the title", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5);
  }
}
