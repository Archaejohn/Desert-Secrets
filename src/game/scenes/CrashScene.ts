/**
 * Zone 1 — Highway 95, the crash site (Act 1, Beat 1). Rosa by the
 * jackknifed truck sets the stakes and hands over the cold pack; the
 * frost feather by the broken crate is the first clue (+5 XP). The east
 * exit onto the flats is gated until the player has talked to Rosa.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildCrashMap,
  CRASH_EXIT_EAST,
  CRASH_FEATHER,
  CRASH_ROSA,
  CRASH_SPAWN
} from "../maps/crashMap";
import { OASIS_WEST_SPAWN } from "../maps/oasisMap";
import { rosaCrashScript } from "../../core/scripts/rosaCrash";
import { getState, setState } from "../state";
import { awardXp } from "../../core/gameState";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE } from "../../shared/palette";

/** Connective tissue: shown when trying to leave before meeting Rosa. */
const rosaWavingScript: DialogueScript = {
  start: "wave",
  nodes: [{ id: "wave", lines: [{ speaker: "", text: "Rosa is waving you over." }] }]
};

export class CrashScene extends ZoneScene {
  constructor() {
    super("crash");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "crash",
      zoneName: "Highway 95",
      map: buildCrashMap(),
      defaultSpawn: CRASH_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.addNpc({
      sheet: "rosa",
      tileX: CRASH_ROSA.x,
      tileY: CRASH_ROSA.y,
      script: () => rosaCrashScript,
      onClose: () => {
        const s = getState(this);
        setState(this, {
          ...s,
          items: { ...s.items, coldPack: true },
          flags: { ...s.flags, metRosa: true, gotColdPack: true }
        });
      }
    });

    // The frost feather by the crate: one-time +5 XP pickup.
    if (!getState(this).flags.crashFeather) {
      const feather = this.addProp("iceChip", CRASH_FEATHER.x, CRASH_FEATHER.y);
      this.addTrigger(
        { x1: CRASH_FEATHER.x, y1: CRASH_FEATHER.y, x2: CRASH_FEATHER.x, y2: CRASH_FEATHER.y },
        () => {
          feather.destroy();
          const { state } = awardXp(getState(this), 5);
          setState(this, { ...state, flags: { ...state.flags, crashFeather: true } });
          this.floatText(CRASH_FEATHER.x * TILE + TILE / 2, CRASH_FEATHER.y * TILE, "+5 XP");
        }
      );
    }

    // East exit onto the flats — but not before Rosa has her say.
    this.addTrigger(
      { ...CRASH_EXIT_EAST },
      () => {
        if (getState(this).flags.metRosa) {
          this.goToZone("oasis", OASIS_WEST_SPAWN);
        } else {
          // Nudge the player back off the exit band, then hint.
          this.player.setPosition(this.player.x - TILE, this.player.y);
          this.openScript(rosaWavingScript);
        }
      },
      false
    );
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
