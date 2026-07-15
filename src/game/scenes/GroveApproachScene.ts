/**
 * Act 5, Zone 2 — The Grove Approach. First real green, a windfall of oranges,
 * and a bristling needle-cactus thicket. Beat: the scared near-catch
 * (`sawGroveChase`) — Piggy is glimpsed snacking, bolts, and waddle-sprints
 * into the thicket too dense to follow; for the first time the near-catch
 * isn't funny. A real traversal zone (sunwasps guard the fruit). Two gates:
 * north back to the descent, south on to the river grotto. Both follower rigs
 * pumped (Slither present; Fluffball still dormant until the chamber).
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildGroveApproachMap,
  APPROACH_CHASE_TRIGGER,
  APPROACH_ENTRY_TRIGGER,
  APPROACH_EXIT_NORTH,
  APPROACH_EXIT_SOUTH,
  APPROACH_NEEDLE,
  APPROACH_OLD_ROW,
  APPROACH_SPAWN
} from "../maps/groveApproachMap";
import { DESCENT_RETURN_SPAWN } from "../maps/groveDescentMap";
import { GROTTO_SPAWN } from "../maps/groveGrottoMap";
import { groveApproachEntryScript } from "../../core/scripts/groveApproachEntry";
import { groveChaseScript } from "../../core/scripts/groveChase";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class GroveApproachScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("groveApproach");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "groveApproach",
      zoneName: "The Grove Approach",
      map: buildGroveApproachMap(),
      defaultSpawn: APPROACH_SPAWN,
      encounterZone: "grove",
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...APPROACH_EXIT_NORTH }, "groveDescent", DESCENT_RETURN_SPAWN);
    this.addExit({ ...APPROACH_EXIT_SOUTH }, "groveGrotto", GROTTO_SPAWN);

    if (!getState(this).flags.sawGroveApproach) {
      this.addTrigger({ ...APPROACH_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawGroveApproach) return;
        this.openScript(groveApproachEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawGroveApproach: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeChase();
  }

  /** The scared near-catch: Piggy bolts from the windfall into the thicket. */
  private placeChase(): void {
    if (getState(this).flags.sawGroveChase) return;
    this.addTrigger({ ...APPROACH_CHASE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawGroveChase) return;
      // Piggy waddle-sprints off the fallen oranges into the needle-cactus.
      const piggy = this.add
        .sprite(APPROACH_OLD_ROW.x * TILE + TILE / 2, APPROACH_OLD_ROW.y * TILE + TILE / 2, "piggy", 0)
        .setDepth(9999);
      piggy.play("piggy-walk");
      this.tweens.chain({
        targets: piggy,
        tweens: [
          { x: (APPROACH_NEEDLE.x - 1) * TILE, y: (APPROACH_NEEDLE.y + 1) * TILE, duration: 700 },
          { alpha: 0, duration: 250 } // gone into the thicket
        ],
        onComplete: () => {
          piggy.destroy();
          // Wait for him to vanish into the thicket before the reaction
          // lines open, so the tonal shift lands on what's on screen, not
          // dialogue racing ahead of the animation.
          this.openScript(groveChaseScript, () => {
            const cur = getState(this);
            setState(this, { ...cur, flags: { ...cur.flags, sawGroveChase: true } });
            this.hud.update(getState(this));
          });
        }
      });
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
