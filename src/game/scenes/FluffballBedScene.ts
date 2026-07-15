/**
 * Act 3, Zone 4 — Fluffball's Kelp Bed. A dead-end pocket off the kelp
 * forest's south spur: a short orient on arrival, then the gray chick is
 * cornered once deeper in, blurts the silverfin clue, and bolts. He does NOT
 * join here (that's Act 5). The north gate leads back to the kelp forest.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildFluffballBedMap,
  FLUFFBED_CORNERED,
  FLUFFBED_CORNERED_TRIGGER,
  FLUFFBED_EXIT_NORTH,
  FLUFFBED_FLUFFBALL,
  FLUFFBED_SPAWN,
  FLUFFBED_STAGE2,
  FLUFFBED_STAGE2_TRIGGER,
  FLUFFBED_STAGE_A,
  FLUFFBED_STAGE_A_TRIGGER,
  FLUFFBED_STAGE_C,
  FLUFFBED_STAGE_C_TRIGGER,
  FLUFFBED_TRIGGER
} from "../maps/fluffballBedMap";
import { KELP_FLUFF_RETURN_SPAWN } from "../maps/kelpForestMap";
import { fluffballBedEntryScript } from "../../core/scripts/fluffballBedEntry";
import { fluffballMeetScript } from "../../core/scripts/fluffballMeet";
import {
  fluffballFleeStage1Script,
  fluffballFleeStage2Script,
  fluffballPlanAScript,
  fluffballPlanBScript
} from "../../core/scripts/fluffballFlee";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

type FleeTo = (target: { x: number; y: number }, onArrive: () => void) => void;

export class FluffballBedScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("fluffballBed");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "fluffballBed",
      zoneName: "The Kelp Bed",
      map: buildFluffballBedMap(),
      defaultSpawn: FLUFFBED_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.animateTilePair("seaWater", "seaWater2");
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...FLUFFBED_EXIT_NORTH }, "kelpForest", KELP_FLUFF_RETURN_SPAWN);

    // Entry orientation, plays once.
    if (!getState(this).flags.sawFluffbed) {
      this.addTrigger({ x1: 6, y1: 3, x2: 11, y2: 5 }, () => {
        if (getState(this).flags.sawFluffbed) return;
        this.openScript(fluffballBedEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawFluffbed: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeFluffball();
  }

  /**
   * A five-stage chase: sighted mid-bed, flees across four more waypoints
   * (two carry a Fluffball reaction line, two carry a Joseph/Slither
   * planning aside instead — the "here's why we're doing this" beats),
   * then corners himself in the small nook with nowhere left to run —
   * only then does he actually talk (fluffballMeet.ts). Getting close
   * enough at each stage re-triggers a flee tween to the next waypoint;
   * only the final stage opens the real catch dialogue.
   */
  private placeFluffball(): void {
    if (getState(this).flags.metFluffball) return;
    const fluff = this.add
      .sprite(FLUFFBED_FLUFFBALL.x * TILE + TILE / 2, FLUFFBED_FLUFFBALL.y * TILE + TILE / 2, "fluffball", 0)
      .setDepth(FLUFFBED_FLUFFBALL.y * TILE + TILE / 2);
    fluff.play("fluffball-idle");

    const fleeTo: FleeTo = (target, onArrive) => {
      fluff.play("fluffball-walk");
      this.tweens.add({
        targets: fluff,
        x: target.x * TILE + TILE / 2,
        y: target.y * TILE + TILE / 2,
        duration: 550,
        onUpdate: () => fluff.setDepth(fluff.y),
        onComplete: () => {
          fluff.play("fluffball-idle");
          onArrive();
        }
      });
    };

    this.addTrigger({ ...FLUFFBED_TRIGGER }, () => {
      if (getState(this).flags.metFluffball) return;
      this.openScript(fluffballFleeStage1Script, () => {
        fleeTo(FLUFFBED_STAGE_A, () => this.armStageA(fluff, fleeTo));
      });
    });
  }

  /** Stage 2 — a planning aside (the how), no Fluffball reaction. */
  private armStageA(fluff: Phaser.GameObjects.Sprite, fleeTo: FleeTo): void {
    this.addTrigger({ ...FLUFFBED_STAGE_A_TRIGGER }, () => {
      if (getState(this).flags.metFluffball) return;
      this.openScript(fluffballPlanAScript, () => {
        fleeTo(FLUFFBED_STAGE2, () => this.armStage2(fluff, fleeTo));
      });
    });
  }

  private armStage2(fluff: Phaser.GameObjects.Sprite, fleeTo: FleeTo): void {
    this.addTrigger({ ...FLUFFBED_STAGE2_TRIGGER }, () => {
      if (getState(this).flags.metFluffball) return;
      this.openScript(fluffballFleeStage2Script, () => {
        fleeTo(FLUFFBED_STAGE_C, () => this.armStageC(fluff, fleeTo));
      });
    });
  }

  /** Stage 4 — a planning aside (the why), no Fluffball reaction. */
  private armStageC(fluff: Phaser.GameObjects.Sprite, fleeTo: FleeTo): void {
    this.addTrigger({ ...FLUFFBED_STAGE_C_TRIGGER }, () => {
      if (getState(this).flags.metFluffball) return;
      this.openScript(fluffballPlanBScript, () => {
        fleeTo(FLUFFBED_CORNERED, () => this.armCornered(fluff));
      });
    });
  }

  private armCornered(fluff: Phaser.GameObjects.Sprite): void {
    this.addTrigger({ ...FLUFFBED_CORNERED_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.metFluffball) return;
      this.openScript(fluffballMeetScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, metFluffball: true } });
        this.hud.update(getState(this));
        // He bolts: a gray blur out of the nook and gone.
        fluff.play("fluffball-walk");
        this.tweens.add({
          targets: fluff,
          x: fluff.x - 2 * TILE,
          y: fluff.y - 3 * TILE,
          duration: 700,
          onUpdate: () => fluff.setDepth(fluff.y),
          onComplete: () =>
            this.tweens.add({ targets: fluff, alpha: 0, duration: 250, onComplete: () => fluff.destroy() })
        });
      });
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
