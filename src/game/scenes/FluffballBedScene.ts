/**
 * Act 3, Zone 4 — Fluffball's Kelp Bed. A dead-end pocket off the kelp
 * forest's south spur: a short orient on arrival, then the gray chick is
 * cornered once deeper in, blurts the silverfin clue, and bolts. He does NOT
 * join here (that's Act 5). The north gate leads back to the kelp forest.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildFluffballBedMap,
  FLUFFBED_EXIT_NORTH,
  FLUFFBED_FLUFFBALL,
  FLUFFBED_SPAWN,
  FLUFFBED_TRIGGER
} from "../maps/fluffballBedMap";
import { KELP_FLUFF_RETURN_SPAWN } from "../maps/kelpForestMap";
import { fluffballBedEntryScript } from "../../core/scripts/fluffballBedEntry";
import { fluffballMeetScript } from "../../core/scripts/fluffballMeet";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

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

  /** Fluffball, glimpsed: one line (the silverfin clue), then he bolts. */
  private placeFluffball(): void {
    if (getState(this).flags.metFluffball) return;
    const fluff = this.add
      .sprite(FLUFFBED_FLUFFBALL.x * TILE + TILE / 2, FLUFFBED_FLUFFBALL.y * TILE + TILE / 2, "fluffball", 0)
      .setDepth(FLUFFBED_FLUFFBALL.y * TILE + TILE / 2);
    fluff.play("fluffball-idle");
    this.addTrigger({ ...FLUFFBED_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.metFluffball) return;
      this.openScript(fluffballMeetScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, metFluffball: true } });
        this.hud.update(getState(this));
        // He bolts: a gray blur out of the bed and gone.
        fluff.play("fluffball-walk");
        this.tweens.add({
          targets: fluff,
          x: fluff.x - 3 * TILE,
          y: fluff.y - TILE,
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
