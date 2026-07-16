/**
 * Zone 5 — The Depths (Act 1, Beat 5 + cliffhanger). The cold gallery:
 * an underground spring ringed with scarab eggs, Piggy huddled at its
 * rim, and the Dust Queen in the way. Parley (if the cold pack is still
 * held) or fight; after victory the ice wall cracks, Piggy waddles
 * toward it, and the Act 1 end card rolls.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildDepthsMap,
  DEPTHS_APPROACH,
  DEPTHS_CRACK,
  DEPTHS_PIGGY,
  DEPTHS_PIGGY_END,
  DEPTHS_QUEEN,
  DEPTHS_SOUTH_EXIT,
  DEPTHS_SPAWN
} from "../maps/depthsMap";
import { MINE_ELEVATOR_SPAWN } from "../maps/mineMap";
import { CREVASSE_SPAWN } from "../maps/crevasseMap";
import { queenFightScript } from "../../core/scripts/queenFight";
import { queenParleyScript } from "../../core/scripts/queenParley";
import {
  cliffhangerAftershockScript,
  cliffhangerIceRevealScript,
  cliffhangerPiggyScript,
  cliffhangerSealedScript
} from "../../core/scripts/cliffhanger";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";

/** Piggy's final spot: centered beneath the two cracked ice tiles. */
const PIGGY_END_PX = {
  x: DEPTHS_PIGGY_END.x * TILE + TILE, // midpoint of the 2-tile crack
  y: DEPTHS_PIGGY_END.y * TILE + TILE / 2
};

export class DepthsScene extends ZoneScene {
  constructor() {
    super("depths");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "depths",
      zoneName: "The Depths",
      map: buildDepthsMap(),
      defaultSpawn: DEPTHS_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.animateTilePair("water", "water2");
    this.addExit({ ...DEPTHS_SOUTH_EXIT }, "mine", MINE_ELEVATOR_SPAWN);

    const s = getState(this);
    const piggy = this.add
      .sprite(DEPTHS_PIGGY.x * TILE + TILE / 2, DEPTHS_PIGGY.y * TILE + TILE / 2, "piggy", 0)
      .setDepth(DEPTHS_PIGGY.y * TILE + TILE / 2);
    piggy.play("piggy-idle");

    if (!s.flags.queenResolved) {
      const queen = this.add
        .sprite(DEPTHS_QUEEN.x * TILE + TILE / 2, DEPTHS_QUEEN.y * TILE + TILE / 2, "queen", 0)
        .setScale(1)
        .setDepth(DEPTHS_QUEEN.y * TILE + TILE / 2);
      queen.play("queen-idle");

      this.addTrigger({ ...DEPTHS_APPROACH }, () => {
        const cur = getState(this);
        const script = cur.items.coldPack ? queenParleyScript : queenFightScript;
        this.openScript(script, (endNodeId) => {
          if (endNodeId === "parley-end") {
            const st = getState(this);
            setState(this, { ...st, flags: { ...st.flags, parleyed: true } });
            this.startBattle(["queenWeakened"], { boss: true, victoryFlag: "queenResolved" });
          } else {
            this.startBattle(["queen"], { boss: true, victoryFlag: "queenResolved" });
          }
        });
      });
    } else if (!s.flags.actComplete) {
      // Returning victorious: the Act 1 cliffhanger.
      this.runCliffhanger(piggy);
    } else {
      // Epilogue state: the wall is cracked, Piggy waits beneath it.
      this.crackWall();
      piggy.setPosition(PIGGY_END_PX.x, PIGGY_END_PX.y).setDepth(PIGGY_END_PX.y);
      // A reload at the end card must not soft-lock Act 2: walking up to
      // the crack descends into the crevasse.
      this.addTrigger({ x1: 16, y1: 2, x2: 19, y2: 2 }, () => {
        const st = getState(this);
        setState(this, { ...st, flags: { ...st.flags, act2Started: true } });
        this.goToZone("crevasse", CREVASSE_SPAWN);
      });
    }
  }

  private crackWall(): void {
    for (const c of DEPTHS_CRACK) {
      this.decorLayer.putTileAt(this.tileGid("iceWallCrack"), c.x, c.y);
    }
  }

  /**
   * Four beats, each with its visual counterpart triggered at the moment
   * the dialogue describes it (not minutes of game-time earlier): the
   * rumble, THEN the wall actually cracks as "it splits and glows blue"
   * opens, THEN Piggy actually walks as "he waddles toward the ice" opens,
   * THEN the elevator seals the way back. Broken into small steps (rather
   * than one deeply-nested closure) so each beat's visual cue is easy to
   * find next to the dialogue it belongs to.
   */
  private runCliffhanger(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = true;
    this.cameras.main.shake(700, 0.008);
    this.time.delayedCall(800, () => this.cliffhangerAftershock(piggy));
  }

  private cliffhangerAftershock(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerAftershockScript, () => {
      this.inputLocked = true;
      // The wall actually cracks now; a short beat to actually see it
      // before the next dialogue box describes exactly that.
      this.crackWall();
      this.cameras.main.shake(300, 0.004);
      this.time.delayedCall(500, () => this.cliffhangerIceReveal(piggy));
    });
  }

  private cliffhangerIceReveal(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerIceRevealScript, () => {
      this.inputLocked = true;
      this.cliffhangerPiggyWalk(piggy);
    });
  }

  private cliffhangerPiggyWalk(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerPiggyScript, () => {
      this.inputLocked = true;
      // Piggy's walk starts now, as the line describing it plays out on
      // screen instead of having already finished off-screen.
      piggy.play("piggy-walk");
      this.tweens.add({
        targets: piggy,
        x: PIGGY_END_PX.x,
        y: PIGGY_END_PX.y,
        duration: 2500,
        onUpdate: () => piggy.setDepth(piggy.y),
        onComplete: () => {
          piggy.play("piggy-idle");
          this.cliffhangerSealed();
        }
      });
    });
  }

  private cliffhangerSealed(): void {
    this.inputLocked = false;
    this.openScript(cliffhangerSealedScript, () => {
      this.inputLocked = true;
      const st = getState(this);
      setState(this, { ...st, flags: { ...st.flags, actComplete: true } });
      this.showEndCard();
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const backdrop = this.add
      .rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94)
      .setScrollFactor(0)
      .setDepth(7000);
    const title = this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 1", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const next = this.add
      .text(w / 2, h / 2, "ACT 2: THE ICE BELOW", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.skyBlue
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const prompt = this.add
      .text(w / 2, h / 2 + 26, "SPACE to descend", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    // See PizzaAscentScene's showEndCard() for why this must join uiLayer
    // (the two-camera world/UI split would otherwise let the HUD draw on
    // top of this card instead of under it).
    this.uiLayer.add([backdrop, title, next, prompt]);

    // The Act 2 hand-off: descend into the crevasse, keeping all progress.
    let descended = false;
    const descend = (): void => {
      if (descended) return;
      descended = true;
      const st = getState(this);
      setState(this, { ...st, flags: { ...st.flags, act2Started: true } });
      this.scene.start("crevasse");
    };
    this.input.keyboard?.once("keydown-SPACE", descend);
    this.input.once("pointerdown", descend);
  }
}
