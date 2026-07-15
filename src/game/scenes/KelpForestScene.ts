/**
 * Act 3, Zone 2 — The Kelp Forest. The main floe-hopping through-route: a
 * hub with a true fork east to the deep bed, a west spur down to the flooded
 * sun-temple, a south spur down to Fluffball's kelp bed, and the north gate
 * back up to the entry overlook. Slither trails the party. Random encounters
 * (anglerfish / reef eels) reuse the shared sunlessSea table.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildKelpForestMap,
  KELP_ENTRY_ROOM,
  KELP_EXIT_EAST,
  KELP_EXIT_NORTH,
  KELP_EXIT_SOUTH,
  KELP_EXIT_WEST,
  KELP_REST,
  KELP_SPAWN
} from "../maps/kelpForestMap";
import { SEA_KELP_RETURN_SPAWN } from "../maps/sunlessSeaMap";
import { SUNTEMPLE_SPAWN } from "../maps/sunTempleMap";
import { FLUFFBED_SPAWN } from "../maps/fluffballBedMap";
import { DEEP_SPAWN } from "../maps/deepBedMap";
import { kelpForestEntryScript } from "../../core/scripts/kelpForestEntry";
import { kelpRestScript } from "../../core/scripts/restPoints";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

export class KelpForestScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("kelpForest");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "kelpForest",
      zoneName: "The Kelp Forest",
      map: buildKelpForestMap(),
      defaultSpawn: KELP_SPAWN,
      encounterZone: "sunlessSea",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.animateTilePair("seaWater", "seaWater2");
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...KELP_EXIT_NORTH }, "sunlessSea", SEA_KELP_RETURN_SPAWN);
    this.addExit({ ...KELP_EXIT_WEST }, "sunTemple", SUNTEMPLE_SPAWN);
    this.addExit({ ...KELP_EXIT_SOUTH }, "fluffballBed", FLUFFBED_SPAWN);
    this.addExit({ ...KELP_EXIT_EAST }, "deepBed", DEEP_SPAWN);

    // Rest point (the hub's warm mineral current): a free, reusable full heal.
    this.addInteractPoint(KELP_REST.x, KELP_REST.y, () => this.restHere(kelpRestScript));

    // Entry orientation: play once when the party first arrives.
    if (!getState(this).flags.sawKelpForest) {
      this.addTrigger({ ...KELP_ENTRY_ROOM }, () => {
        if (getState(this).flags.sawKelpForest) return;
        this.openScript(kelpForestEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawKelpForest: true } });
          this.hud.update(getState(this));
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
