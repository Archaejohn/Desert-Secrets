/**
 * Act 6, Zone 3 — The Coral Warren. The tense near-catch, and the TURN: the
 * chase stops being cute here. The party corners Piggy in a coral dead-end
 * (`REEF_W_CHASE_TRIGGER` → `reefChase` → `sawReefChase`); for the first time
 * he's frightened, not playful. He shrieks, bolts, and slips through a gap too
 * thin for Joseph — and it is FLUFFBALL, not Joseph, who calls after him. The
 * cosmetic Piggy waddle-sprints from the corner and vanishes through the gap
 * while the beat plays. A real traversal/encounter zone. Two gates: north back
 * to the garden, south on to the glowing hollow.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildReefWarrenMap,
  REEF_W_CHASE_TRIGGER,
  REEF_W_CORNER,
  REEF_W_ENTRY_TRIGGER,
  REEF_W_EXIT_NORTH,
  REEF_W_EXIT_SOUTH,
  REEF_W_GAP,
  REEF_W_SPAWN
} from "../maps/reefWarrenMap";
import { REEF_G_RETURN_SPAWN } from "../maps/reefGardenMap";
import { REEF_H_SPAWN } from "../maps/reefHollowMap";
import { reefWarrenEntryScript } from "../../core/scripts/reefWarrenEntry";
import { reefChaseScript } from "../../core/scripts/reefChase";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class ReefWarrenScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("reefWarren");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "reefWarren",
      zoneName: "The Coral Warren",
      map: buildReefWarrenMap(),
      defaultSpawn: REEF_W_SPAWN,
      encounterZone: "reef",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...REEF_W_EXIT_NORTH }, "reefGarden", REEF_G_RETURN_SPAWN);
    this.addExit({ ...REEF_W_EXIT_SOUTH }, "reefHollow", REEF_H_SPAWN);

    if (!getState(this).flags.sawReefWarren) {
      this.addTrigger({ ...REEF_W_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawReefWarren) return;
        this.openScript(reefWarrenEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawReefWarren: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeChase();
  }

  /** The chase-and-turn: Piggy cornered for real, frightened, then gone. */
  private placeChase(): void {
    if (getState(this).flags.sawReefChase) return;
    this.addTrigger({ ...REEF_W_CHASE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawReefChase) return;
      // A cosmetic Piggy bolts from the coral corner and slips through the gap
      // too thin for Joseph, vanishing as the beat plays.
      const piggy = this.add
        .sprite(REEF_W_CORNER.x * TILE + TILE / 2, REEF_W_CORNER.y * TILE + TILE / 2, "piggy", 0)
        .setDepth(9999);
      piggy.play("piggy-walk");
      this.tweens.chain({
        targets: piggy,
        tweens: [
          { x: REEF_W_GAP.x * TILE + TILE / 2, y: REEF_W_GAP.y * TILE + TILE / 2, duration: 650 },
          { alpha: 0, duration: 250 } // through the gap, gone
        ],
        onComplete: () => {
          piggy.destroy();
          // Wait for him to slip through the gap before the reaction lines
          // open, so dialogue never races ahead of what it's about.
          this.openScript(reefChaseScript, () => {
            const cur = getState(this);
            setState(this, { ...cur, flags: { ...cur.flags, sawReefChase: true } });
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
