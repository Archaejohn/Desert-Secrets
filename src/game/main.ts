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
import { KelpForestScene } from "./scenes/KelpForestScene";
import { SunTempleScene } from "./scenes/SunTempleScene";
import { FluffballBedScene } from "./scenes/FluffballBedScene";
import { DeepBedScene } from "./scenes/DeepBedScene";
import { SeaAscentScene } from "./scenes/SeaAscentScene";
import { MinersCampScene } from "./scenes/MinersCampScene";
import { CampProperScene } from "./scenes/CampProperScene";
import { LaundryNookScene } from "./scenes/LaundryNookScene";
import { CampGalleryScene } from "./scenes/CampGalleryScene";
import { CampLedgeScene } from "./scenes/CampLedgeScene";
import { GroveDescentScene } from "./scenes/GroveDescentScene";
import { GroveApproachScene } from "./scenes/GroveApproachScene";
import { GroveGrottoScene } from "./scenes/GroveGrottoScene";
import { GroveChamberScene } from "./scenes/GroveChamberScene";
import { SahraGroveScene } from "./scenes/SahraGroveScene";
import { ReefDescentScene } from "./scenes/ReefDescentScene";
import { ReefGardenScene } from "./scenes/ReefGardenScene";
import { ReefWarrenScene } from "./scenes/ReefWarrenScene";
import { ReefHollowScene } from "./scenes/ReefHollowScene";
import { ReefCourtScene } from "./scenes/ReefCourtScene";
import { PizzaDescentScene } from "./scenes/PizzaDescentScene";
import { PizzaVentScene } from "./scenes/PizzaVentScene";
import { PizzaApproachScene } from "./scenes/PizzaApproachScene";
import { PizzeriaScene } from "./scenes/PizzeriaScene";
import { PizzaAscentScene } from "./scenes/PizzaAscentScene";
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
    KelpForestScene,
    SunTempleScene,
    FluffballBedScene,
    DeepBedScene,
    SeaAscentScene,
    MinersCampScene,
    CampProperScene,
    LaundryNookScene,
    CampGalleryScene,
    CampLedgeScene,
    GroveDescentScene,
    GroveApproachScene,
    GroveGrottoScene,
    GroveChamberScene,
    SahraGroveScene,
    ReefDescentScene,
    ReefGardenScene,
    ReefWarrenScene,
    ReefHollowScene,
    ReefCourtScene,
    PizzaDescentScene,
    PizzaVentScene,
    PizzaApproachScene,
    PizzeriaScene,
    PizzaAscentScene,
    BattleScene
  ]
});

// Exposed for headless smoke tests and debugging.
(window as unknown as { __game: Phaser.Game }).__game = game;
