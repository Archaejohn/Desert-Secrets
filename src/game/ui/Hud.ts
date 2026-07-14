/**
 * Persistent overworld HUD: HP bar, level badge, XP progress, zone name.
 * Pure presentation — reads Act1State, renders, nothing else.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import { heroStats } from "../../core/gameState";
import type { Act1State } from "../../core/gameState";
import { levelForXp, xpToNext, LEVEL_THRESHOLDS } from "../../core/progression";

export class Hud {
  private bars: Phaser.GameObjects.Graphics;
  private levelText: Phaser.GameObjects.Text;
  private zoneText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, zoneName: string) {
    const c = scene.add.container(0, 0).setScrollFactor(0).setDepth(6000);
    this.bars = scene.add.graphics();
    this.levelText = scene.add.text(6, 4, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.bone
    });
    this.zoneText = scene.add
      .text(scene.scale.width - 6, 4, zoneName.toUpperCase(), {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.sand
      })
      .setOrigin(1, 0);
    c.add([this.bars, this.levelText, this.zoneText]);
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
    // HP bar
    g.fillStyle(hexToInt(PALETTE.ink), 0.85);
    g.fillRect(5, 14, 62, 6);
    g.fillStyle(hexToInt(PALETTE.hpRed), 1);
    g.fillRect(6, 15, Math.max(0, Math.round((state.hp / stats.maxHp) * 60)), 4);
    // XP progress within current level
    const lo = LEVEL_THRESHOLDS[level - 1];
    const hi = LEVEL_THRESHOLDS[level] ?? lo;
    const frac = hi > lo ? (state.hero.xp - lo) / (hi - lo) : 1;
    g.fillStyle(hexToInt(PALETTE.ink), 0.85);
    g.fillRect(5, 21, 62, 4);
    g.fillStyle(hexToInt(PALETTE.atbGold), 1);
    g.fillRect(6, 22, Math.max(0, Math.round(Math.min(1, frac) * 60)), 2);
  }
}
