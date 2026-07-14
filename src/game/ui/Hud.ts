/**
 * Persistent overworld HUD: HP bar, level badge, XP progress, zone name.
 * Pure presentation — reads Act1State, renders, nothing else.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import { heroStats } from "../../core/gameState";
import type { Act1State } from "../../core/gameState";
import { levelForXp, xpToNext, LEVEL_THRESHOLDS } from "../../core/progression";
import { objectiveFor } from "../../core/objective";

export class Hud {
  private bars: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;
  private zoneText: Phaser.GameObjects.Text;
  private objectiveText: Phaser.GameObjects.Text;
  private invBg: Phaser.GameObjects.Graphics;
  private bucketIcon: Phaser.GameObjects.Sprite;
  private invText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, zoneName: string) {
    const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(6000);
    this.bars = scene.add.graphics();
    this.levelText = scene.add.text(5, 3, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.bone,
      backgroundColor: "#24182799",
      padding: { x: 2, y: 1 }
    });
    this.zoneText = scene.add
      .text(scene.scale.width - 6, 4, zoneName.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.sand
      })
      .setOrigin(1, 0);
    this.objectiveText = scene.add.text(5, 33, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.mint,
      backgroundColor: "#24182799",
      padding: { x: 2, y: 1 }
    });

    // Minimal inventory row: only shown when there's something to carry.
    this.invBg = scene.add.graphics().setVisible(false);
    this.bucketIcon = scene.add.sprite(11, 51, "bucket", 0).setVisible(false);
    this.invText = scene.add.text(20, 46, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.sandLight
    });

    c.add([
      this.bars,
      this.levelText,
      this.zoneText,
      this.objectiveText,
      this.invBg,
      this.bucketIcon,
      this.invText
    ]);
  }

  update(state: Act1State): void {
    const stats = heroStats(state);
    const level = levelForXp(state.hero.xp);
    const toNext = xpToNext(state.hero.xp);
    this.levelText.setText(
      `Lv${level}  ${state.hp}/${stats.maxHp}` + (toNext !== null ? `  next:${toNext}xp` : "")
    );
    const g = this.bars;
    g.clear();
    // HP bar (below the level text, which is ~15px tall with padding).
    g.fillStyle(hexToInt(PALETTE.ink), 0.85);
    g.fillRect(5, 19, 62, 6);
    g.fillStyle(hexToInt(PALETTE.hpRed), 1);
    g.fillRect(6, 20, Math.min(60, Math.max(0, Math.round((state.hp / stats.maxHp) * 60))), 4);
    // XP progress within current level
    const lo = LEVEL_THRESHOLDS[level - 1];
    const hi = LEVEL_THRESHOLDS[level] ?? lo;
    const frac = hi > lo ? (state.hero.xp - lo) / (hi - lo) : 1;
    g.fillStyle(hexToInt(PALETTE.ink), 0.85);
    g.fillRect(5, 26, 62, 4);
    g.fillStyle(hexToInt(PALETTE.atbGold), 1);
    g.fillRect(6, 27, Math.max(0, Math.round(Math.min(1, frac) * 60)), 2);
    this.objectiveText.setText(`▸ ${objectiveFor(state)}`);
    this.updateInventory(state);
  }

  private updateInventory(state: Act1State): void {
    const showBucket = state.items.bucket !== "none";
    const showColdPack = state.items.coldPack;
    if (!showBucket && !showColdPack) {
      this.invBg.setVisible(false);
      this.bucketIcon.setVisible(false);
      this.invText.setText("");
      return;
    }
    const label = [
      showBucket ? (state.items.bucket === "filled" ? "Bucket (full)" : "Bucket (empty)") : null,
      showColdPack ? "Cold pack" : null
    ]
      .filter(Boolean)
      .join("  ");
    this.invText.setText(label).setPosition(showBucket ? 20 : 5, 46);
    this.bucketIcon.setVisible(showBucket);
    if (showBucket) this.bucketIcon.setFrame(state.items.bucket === "filled" ? 1 : 0);
    this.invBg.clear();
    this.invBg.fillStyle(hexToInt(PALETTE.ink), 0.6);
    this.invBg.fillRect(4, 44, this.invText.width + (showBucket ? 20 : 6), 14);
    this.invBg.setVisible(true);
  }
}
