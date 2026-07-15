/**
 * Act 6, Zone 2 — The Crawlers' Garden. The crystal-crawlers' farmed glowing
 * kelp: cultivated mint-kelp rows (walkable) set against tangled wild kelp and
 * coral, grounding the crawlers as territorial farmers, not monsters. A real
 * traversal zone — a reef predator (the reefstalker) hunts the rows. Two gates:
 * north back to the descent, south on to the coral warren. Both follower rigs
 * pumped.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildReefGardenMap,
  REEF_G_ENTRY_TRIGGER,
  REEF_G_EXIT_NORTH,
  REEF_G_EXIT_SOUTH,
  REEF_G_SPAWN
} from "../maps/reefGardenMap";
import { REEF_D_RETURN_SPAWN } from "../maps/reefDescentMap";
import { REEF_W_SPAWN } from "../maps/reefWarrenMap";
import { reefGardenEntryScript } from "../../core/scripts/reefGardenEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class ReefGardenScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("reefGarden");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "reefGarden",
      zoneName: "The Crawlers' Garden",
      map: buildReefGardenMap(),
      defaultSpawn: REEF_G_SPAWN,
      encounterZone: "reef",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...REEF_G_EXIT_NORTH }, "reefDescent", REEF_D_RETURN_SPAWN);
    this.addExit({ ...REEF_G_EXIT_SOUTH }, "reefWarren", REEF_W_SPAWN);

    if (!getState(this).flags.sawReefGarden) {
      this.addTrigger({ ...REEF_G_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawReefGarden) return;
        this.openScript(reefGardenEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawReefGarden: true } });
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
