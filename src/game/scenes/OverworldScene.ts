/**
 * The Open Desert — a small proof-of-concept world map (FF3/FF6 style):
 * a tiny, compressed terrain layer with exactly two stops rather than a
 * fully detailed zone. South leads back to the oasis, past the wash and
 * the overturned truck; north climbs to the Cinnabar Mine entrance.
 * Random encounters run the length of the pass, same as the Trail.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildOverworldMap,
  OVERWORLD_NORTH_EXIT,
  OVERWORLD_SOUTH_EXIT,
  OVERWORLD_SOUTH_SPAWN
} from "../maps/overworldMap";
import { OASIS_NORTH_SPAWN } from "../maps/oasisMap";
import { MINE_ENTRANCE_SPAWN } from "../maps/mineEntranceMap";

export class OverworldScene extends ZoneScene {
  constructor() {
    super("overworld");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "overworld",
      zoneName: "The Open Desert",
      map: buildOverworldMap(),
      defaultSpawn: OVERWORLD_SOUTH_SPAWN,
      encounterZone: "overworld",
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.addExit({ ...OVERWORLD_SOUTH_EXIT }, "oasis", OASIS_NORTH_SPAWN);
    this.addExit({ ...OVERWORLD_NORTH_EXIT }, "mineEntrance", MINE_ENTRANCE_SPAWN);
  }
}
