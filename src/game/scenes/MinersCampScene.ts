/**
 * Act 4, Zone 1 — The Camp Outskirts ("Dirty Laundry"). Where the Sunless
 * Sea's service ladder tops out (Act 3 → Act 4 hand-off spawns the party here
 * at CAMP_SPAWN, so `minersCamp` keeps its id). First sight of Mo, Edda and
 * Gus's camp from outside: the environmental storytelling of Piggy's night
 * raids — frost tracks in the dust, a stolen boot, string lights glowing
 * deeper in. A short orient, then the south gate leads on into the camp
 * proper. Slither trails the party (shared follower rig).
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildMinersCampMap,
  CAMP_ENTRY_TRIGGER,
  CAMP_EXIT_SOUTH,
  CAMP_SPAWN
} from "../maps/minersCampMap";
import { CAMPP_SPAWN } from "../maps/campProperMap";
import { campOutskirtsEntryScript } from "../../core/scripts/campOutskirtsEntry";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

export class MinersCampScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("minersCamp");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "minersCamp",
      zoneName: "The Camp Outskirts",
      map: buildMinersCampMap(),
      defaultSpawn: CAMP_SPAWN,
      battleBg: "mine"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...CAMP_EXIT_SOUTH }, "campProper", CAMPP_SPAWN);

    // Arrival orientation + the night-raid storytelling, plays once.
    if (!getState(this).flags.sawOutskirts) {
      this.addTrigger({ ...CAMP_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawOutskirts) return;
        this.openScript(campOutskirtsEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawOutskirts: true } });
          this.hud.update(getState(this));
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
