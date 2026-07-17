/**
 * Act 5, Zone 1 — The Warm Descent. Where the camp's back gallery bottoms out
 * into the stone (the Act 4 → Act 5 hand-off spawns the party here at
 * DESCENT_SPAWN, so `groveDescent` keeps its id). The floor greens, the air
 * warms, and light glows up from below — a short orient, then the south gate
 * leads on into the grove approach. Slither trails (shared rig); Fluffball has
 * not joined yet, so his rig stays dormant here.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildGroveDescentMap,
  DESCENT_ENTRY_TRIGGER,
  DESCENT_EXIT_SOUTH,
  DESCENT_SPAWN
} from "../maps/groveDescentMap";
import { APPROACH_SPAWN } from "../maps/groveApproachMap";
import { groveDescentEntryScript } from "../../core/scripts/groveDescentEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class GroveDescentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("groveDescent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "groveDescent",
      zoneName: "The Warm Descent",
      map: buildGroveDescentMap(),
      defaultSpawn: DESCENT_SPAWN,
      battleBg: "mine"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...DESCENT_EXIT_SOUTH }, "groveApproach", APPROACH_SPAWN);

    // Arrival orientation, plays once.
    if (!getState(this).flags.sawGroveDescent) {
      this.addTrigger({ ...DESCENT_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawGroveDescent) return;
        this.openScript(groveDescentEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawGroveDescent: true } });
          this.hud.update(getState(this));
          // Thomas radio thread beat (see thomas.ts): a little more of his
          // message comes through as Joseph descends into the warm deep.
          this.playNextThomas();
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
