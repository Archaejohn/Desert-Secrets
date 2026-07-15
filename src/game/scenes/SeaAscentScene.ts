/**
 * Act 3, Zone 6 — The Ascent. The physical, narrated way OUT of the Sunless
 * Sea (the "how do I get off the ice?" the shipped act never answered): an
 * old miners' service ladder climbs from the deep bed up toward the surface
 * workings. The midway ledge plays the climb beat; the top gate sets
 * act4Started and hands off to the miners' camp (Act 4).
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildSeaAscentMap,
  ASCENT_EXIT_TOP,
  ASCENT_SPAWN,
  ASCENT_TRIGGER
} from "../maps/seaAscentMap";
import { CAMP_SPAWN } from "../maps/minersCampMap";
import { seaAscentScript } from "../../core/scripts/seaAscent";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

export class SeaAscentScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("seaAscent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "seaAscent",
      zoneName: "The Ascent",
      map: buildSeaAscentMap(),
      defaultSpawn: ASCENT_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.animateTilePair("seaWater", "seaWater2");
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    // The climb beat on the midway ledge, plays once.
    if (!getState(this).flags.sawAscent) {
      this.addTrigger({ ...ASCENT_TRIGGER }, () => {
        if (getState(this).flags.sawAscent) return;
        this.openScript(seaAscentScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawAscent: true } });
          this.hud.update(getState(this));
        });
      });
    }

    // The top gate: climb up into the miners' camp, keeping all progress and
    // setting act4Started — the Act 3 → Act 4 hand-off (a real zone exit, not
    // an end card). Uses a trigger so the flag is set before the transition.
    this.addTrigger(
      { ...ASCENT_EXIT_TOP },
      () => {
        const s = getState(this);
        setState(this, { ...s, flags: { ...s.flags, act4Started: true } });
        this.goToZone("minersCamp", CAMP_SPAWN);
      },
      false
    );
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
