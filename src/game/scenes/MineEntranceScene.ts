/**
 * Mine Entrance — the threshold screen between the open desert and
 * Cinnabar Mine proper. Sealed until Dusty opens the mine on the Trail
 * (flags.mineOpen), exactly like the Trail's own mine exit — this is a
 * second door onto the same mine, not a second way to unlock it.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildMineEntranceMap,
  MINE_ENTRANCE_NORTH_EXIT,
  MINE_ENTRANCE_SOUTH_EXIT,
  MINE_ENTRANCE_SPAWN
} from "../maps/mineEntranceMap";
import { OVERWORLD_NORTH_SPAWN } from "../maps/overworldMap";
import { MINE_SPAWN } from "../maps/mineMap";
import { getState } from "../state";
import type { DialogueScript } from "../../core/dialogue";

const sealedScript: DialogueScript = {
  start: "sealed",
  nodes: [{ id: "sealed", lines: [{ speaker: "", text: "The mine's shored up tight. Nothing's open yet." }] }]
};

export class MineEntranceScene extends ZoneScene {
  constructor() {
    super("mineEntrance");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "mineEntrance",
      zoneName: "Mine Entrance",
      map: buildMineEntranceMap(),
      defaultSpawn: MINE_ENTRANCE_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.addExit({ ...MINE_ENTRANCE_SOUTH_EXIT }, "overworld", OVERWORLD_NORTH_SPAWN);

    this.addTrigger(
      { ...MINE_ENTRANCE_NORTH_EXIT },
      () => {
        if (getState(this).flags.mineOpen) {
          this.goToZone("mine", MINE_SPAWN);
        } else {
          this.player.setPosition(this.player.x, this.player.y + TILE);
          this.openScript(sealedScript);
        }
      },
      false
    );
  }
}
