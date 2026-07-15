/**
 * Act 5, Zone 3 — The River Grotto. A quiet connecting cavern where the
 * underground river (the oasis spring's source) wells up and runs on toward
 * the light. A breather beat between the tense approach and the big reveal:
 * grounds the geography, then the south gate leads into the sunlit chamber.
 * Two gates (north back to the approach, south on to the chamber); no random
 * encounters. Both follower rigs pumped.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildGroveGrottoMap,
  GROTTO_ENTRY_TRIGGER,
  GROTTO_EXIT_NORTH,
  GROTTO_EXIT_SOUTH,
  GROTTO_POOL,
  GROTTO_SPAWN
} from "../maps/groveGrottoMap";
import { APPROACH_RETURN_SPAWN } from "../maps/groveApproachMap";
import { CHAMBER_SPAWN } from "../maps/groveChamberMap";
import { groveGrottoEntryScript } from "../../core/scripts/groveGrottoEntry";
import { grottoRestScript } from "../../core/scripts/restPoints";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class GroveGrottoScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("groveGrotto");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "groveGrotto",
      zoneName: "The River Grotto",
      map: buildGroveGrottoMap(),
      defaultSpawn: GROTTO_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.animateTilePair("groveWater", "groveWater2");

    this.addExit({ ...GROTTO_EXIT_NORTH }, "groveApproach", APPROACH_RETURN_SPAWN);
    this.addExit({ ...GROTTO_EXIT_SOUTH }, "groveChamber", CHAMBER_SPAWN);

    // Rest point (the river's source pool): a free, reusable full heal.
    this.addInteractPoint(GROTTO_POOL.x, GROTTO_POOL.y, () => this.restHere(grottoRestScript));

    if (!getState(this).flags.sawGroveGrotto) {
      this.addTrigger({ ...GROTTO_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawGroveGrotto) return;
        this.openScript(groveGrottoEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawGroveGrotto: true } });
          this.hud.update(getState(this));
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
