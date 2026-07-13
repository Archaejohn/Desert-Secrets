/**
 * Loads the generated sprite sheets, registers all manifest animations,
 * then hands off to the world.
 */
import Phaser from "phaser";
import { MANIFEST, registerAnimations } from "../manifest";
import { PALETTE } from "../../shared/palette";
import heroUrl from "../../assets/generated/hero.png";
import npcUrl from "../../assets/generated/npc.png";
import scarabUrl from "../../assets/generated/scarab.png";
import tilesUrl from "../../assets/generated/tiles.png";

const SHEET_URLS: Record<string, string> = {
  hero: heroUrl,
  npc: npcUrl,
  scarab: scarabUrl
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    for (const [key, sheet] of Object.entries(MANIFEST.sheets)) {
      this.load.spritesheet(key, SHEET_URLS[key], {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      });
    }
    this.load.spritesheet("tiles", tilesUrl, {
      frameWidth: MANIFEST.tiles.tileSize,
      frameHeight: MANIFEST.tiles.tileSize
    });
    // Tilemaps want the same image as a plain key too.
    this.load.image("tiles-img", tilesUrl);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2, "DESERT SECRETS", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5);
  }

  create(): void {
    registerAnimations(this);
    this.scene.start("World");
  }
}
