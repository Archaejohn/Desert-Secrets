/**
 * Zone 4 — Cinnabar Mine (Act 1, Beat 4). Winding brood-infested
 * corridors, a rusted lever that lifts the timber gate on the elevator
 * corridor, and the Foreman Scarab boss guarding the descent. The
 * elevator drops to the Depths once the Foreman falls.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildMineMap,
  MINE_ELEVATOR,
  MINE_FOREMAN,
  MINE_GATE_TILES,
  MINE_LEVER,
  MINE_LEVER_PLATE,
  MINE_SOUTH_EXIT,
  MINE_SPAWN
} from "../maps/mineMap";
import { TRAIL_MINE_SPAWN } from "../maps/trailMap";
import { DEPTHS_SPAWN } from "../maps/depthsMap";
import { radioLines } from "../../core/scripts/radio";
import { getState, setState } from "../state";
import type { DialogueScript } from "../../core/dialogue";

const leverScript: DialogueScript = {
  start: "ask",
  nodes: [
    {
      id: "ask",
      lines: [{ speaker: "", text: "Pull the rusted lever?" }],
      choices: [
        { text: "Pull it", next: "yes-end" },
        { text: "Leave it", next: "no-end" }
      ]
    },
    { id: "yes-end", lines: [{ speaker: "", text: "(Gears grind. The timbers lift away.)" }] },
    { id: "no-end", lines: [{ speaker: "Joseph", text: "Better not. Yet." }] }
  ]
};

const foremanScript: DialogueScript = {
  start: "challenge",
  nodes: [
    {
      id: "challenge",
      lines: [
        { speaker: "Foreman Scarab", text: "NONE RIDE DOWN. QUEEN BROODS BELOW." },
        { speaker: "Joseph", text: "My friend's down there. Move." }
      ]
    }
  ]
};

export class MineScene extends ZoneScene {
  constructor() {
    super("mine");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "mine",
      zoneName: "Cinnabar Mine",
      map: buildMineMap(),
      defaultSpawn: MINE_SPAWN,
      encounterZone: "mine",
      battleBg: "mine"
    };
  }

  protected populate(): void {
    // Rosa's radio check-in, first entry only.
    const entryState = getState(this);
    if (!entryState.flags.radioMine) {
      setState(this, { ...entryState, flags: { ...entryState.flags, radioMine: true } });
      this.openScript(radioLines.mine);
    }

    this.addExit({ ...MINE_SOUTH_EXIT }, "trail", TRAIL_MINE_SPAWN);

    // Lever + gate: render the already-open state, or arm the choice.
    if (getState(this).flags.leverPulled) {
      this.openGate();
    }
    this.addTrigger(
      { x1: MINE_LEVER_PLATE.x, y1: MINE_LEVER_PLATE.y, x2: MINE_LEVER_PLATE.x, y2: MINE_LEVER_PLATE.y },
      () => {
        if (getState(this).flags.leverPulled) return;
        // Step back off the plate so closing the box doesn't re-trigger.
        this.player.setPosition(this.player.x, this.player.y + TILE);
        this.openScript(leverScript, (endNodeId) => {
          if (endNodeId !== "yes-end") return;
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, leverPulled: true } });
          this.openGate();
          this.cameras.main.shake(250, 0.004);
        });
      },
      false
    );

    // The Foreman Scarab bars the elevator until defeated.
    if (!getState(this).flags.foremanDefeated) {
      const foreman = this.add
        .sprite(MINE_FOREMAN.x * TILE + TILE / 2, MINE_FOREMAN.y * TILE + TILE / 2, "foreman", 0)
        .setDepth(MINE_FOREMAN.y * TILE + TILE / 2);
      foreman.play("foreman-idle");
      this.addTrigger({ x1: MINE_FOREMAN.x, y1: 5, x2: MINE_FOREMAN.x + 1, y2: 9 }, () => {
        this.openScript(foremanScript, () => {
          this.startBattle(["foreman"], { boss: true, victoryFlag: "foremanDefeated" });
        });
      });
    }

    // The elevator floor: down to the Depths, once the way is clear.
    this.addTrigger(
      { ...MINE_ELEVATOR },
      () => {
        if (getState(this).flags.foremanDefeated) {
          this.goToZone("depths", DEPTHS_SPAWN);
        }
      },
      false
    );
  }

  /** Flip the lever tile and lift the three timber gate tiles. */
  private openGate(): void {
    this.decorLayer.putTileAt(this.tileGid("leverOn"), MINE_LEVER.x, MINE_LEVER.y);
    this.decorLayer.setCollision(this.tileGid("leverOn"), true, false);
    for (const g of MINE_GATE_TILES) {
      this.decorLayer.removeTileAt(g.x, g.y); // ground beneath is mineFloor
    }
  }
}
