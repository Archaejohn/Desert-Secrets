import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { WorldScene } from "./scenes/WorldScene";
import { BattleScene } from "./scenes/BattleScene";
import { PALETTE } from "../shared/palette";

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  width: 480,
  height: 270,
  backgroundColor: PALETTE.ink,
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: "arcade",
    arcade: { debug: false }
  },
  scene: [BootScene, WorldScene, BattleScene]
});

// Exposed for headless smoke tests and debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;
