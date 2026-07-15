import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { CrashScene } from "./scenes/CrashScene";
import { OasisScene } from "./scenes/OasisScene";
import { ShedScene } from "./scenes/ShedScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { MineEntranceScene } from "./scenes/MineEntranceScene";
import { TrailScene } from "./scenes/TrailScene";
import { MineScene } from "./scenes/MineScene";
import { DepthsScene } from "./scenes/DepthsScene";
import { CrevasseScene } from "./scenes/CrevasseScene";
import { MazeScene } from "./scenes/MazeScene";
import { GalleriesScene } from "./scenes/GalleriesScene";
import { SanctumScene } from "./scenes/SanctumScene";
import { SunlessSeaScene } from "./scenes/SunlessSeaScene";
import { MinersCampScene } from "./scenes/MinersCampScene";
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
  scene: [
    BootScene,
    CrashScene,
    OasisScene,
    ShedScene,
    OverworldScene,
    MineEntranceScene,
    TrailScene,
    MineScene,
    DepthsScene,
    CrevasseScene,
    MazeScene,
    GalleriesScene,
    SanctumScene,
    SunlessSeaScene,
    MinersCampScene,
    BattleScene
  ]
});

// Exposed for headless smoke tests and debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;
