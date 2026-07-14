/**
 * Loads all generated sprite sheets and both tilesets, registers every
 * manifest animation, then starts Act 1 at the crash site.
 */
import Phaser from "phaser";
import { MANIFEST, registerAnimations } from "../manifest";
import { PALETTE } from "../../shared/palette";
import heroUrl from "../../assets/generated/hero.png";
import npcUrl from "../../assets/generated/npc.png";
import scarabUrl from "../../assets/generated/scarab.png";
import tilesUrl from "../../assets/generated/tiles.png";
import tiles2Url from "../../assets/generated/tiles2.png";
import rosaUrl from "../../assets/generated/rosa.png";
import piggyUrl from "../../assets/generated/piggy.png";
import jackrabbitUrl from "../../assets/generated/jackrabbit.png";
import buzzardUrl from "../../assets/generated/buzzard.png";
import gilaUrl from "../../assets/generated/gila.png";
import foremanUrl from "../../assets/generated/foreman.png";
import queenUrl from "../../assets/generated/queen.png";

const SHEET_URLS: Record<string, string> = {
  hero: heroUrl,
  npc: npcUrl,
  scarab: scarabUrl,
  rosa: rosaUrl,
  piggy: piggyUrl,
  jackrabbit: jackrabbitUrl,
  buzzard: buzzardUrl,
  gila: gilaUrl,
  foreman: foremanUrl,
  queen: queenUrl
};

export class BootScene extends Phaser.Scene {
  constructor() {
    super("boot");
  }

  preload(): void {
    for (const [key, sheet] of Object.entries(MANIFEST.sheets)) {
      const url = SHEET_URLS[key];
      if (!url) throw new Error(`No bundled URL for sheet "${key}"`);
      this.load.spritesheet(key, url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      });
    }
    this.load.spritesheet("tiles", tilesUrl, {
      frameWidth: MANIFEST.tiles.tileSize,
      frameHeight: MANIFEST.tiles.tileSize
    });
    this.load.spritesheet("tiles2", tiles2Url, {
      frameWidth: MANIFEST.tiles2.tileSize,
      frameHeight: MANIFEST.tiles2.tileSize
    });
    this.load.image("tiles-img", tilesUrl);
    this.load.image("tiles2-img", tiles2Url);

    const { width, height } = this.scale;
    this.add
      .text(width / 2, height / 2 - 10, "DESERT SECRETS", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 + 10, "Act 1 · The Coldest Cargo", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand
      })
      .setOrigin(0.5);
  }

  create(): void {
    registerAnimations(this);
    this.scene.start("crash");
  }
}
