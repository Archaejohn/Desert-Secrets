/**
 * Act 4, Zone 3 — The Laundry Nook. A dead-end pocket off the camp proper's
 * west gap: the favor-quest fight room. A nest of midden mites (an
 * InteractPoint) drops into a real BattleScene against a swarm of four; once
 * cleared (`middenCleared`), the miners will trade the socks back in camp. The
 * east gate leads back to the camp proper. Slither trails (shared rig).
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import type Phaser from "phaser";
import {
  buildLaundryNookMap,
  NOOK_ENTRY_TRIGGER,
  NOOK_EXIT_EAST,
  NOOK_NEST,
  NOOK_SPAWN
} from "../maps/laundryNookMap";
import { CAMPP_NOOK_RETURN_SPAWN } from "../maps/campProperMap";
import { laundryNookEntryScript } from "../../core/scripts/laundryNookEntry";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";
import type { DialogueScript } from "../../core/dialogue";

/** The nest, mid-swarm. */
const nestIntroScript: DialogueScript = {
  start: "nest",
  nodes: [
    {
      id: "nest",
      lines: [
        { speaker: "", text: "The laundry nook seethes with midden mites." },
        { speaker: "Slither", text: "Ssso many. Sssweep them all at once." }
      ]
    }
  ]
};

const nookClearScript: DialogueScript = {
  start: "clear",
  nodes: [{ id: "clear", lines: [{ speaker: "", text: "The nook is clear. Just laundry now." }] }]
};

export class LaundryNookScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private nestMites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super("laundryNook");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "laundryNook",
      zoneName: "The Laundry Nook",
      map: buildLaundryNookMap(),
      defaultSpawn: NOOK_SPAWN,
      battleBg: "mine"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.nestMites = [];
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...NOOK_EXIT_EAST }, "campProper", CAMPP_NOOK_RETURN_SPAWN);

    // Arrival orientation, plays once.
    if (!getState(this).flags.sawNook) {
      this.addTrigger({ ...NOOK_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawNook) return;
        this.openScript(laundryNookEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawNook: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeNest();
  }

  // --- The midden-mite nest (favor-quest battle gate) ---

  private placeNest(): void {
    if (!getState(this).flags.middenCleared) {
      // A cosmetic swarm crawling around the nest until it's cleared.
      for (const [dx, dy] of [
        [0, 0],
        [1, 1],
        [-1, 1],
        [1, -1]
      ]) {
        const m = this.add
          .sprite((NOOK_NEST.x + dx) * TILE + TILE / 2, (NOOK_NEST.y + dy) * TILE + TILE / 2, "middenmite", 0)
          .setScale(1.3);
        m.setDepth(m.y);
        m.play("middenmite-move");
        this.nestMites.push(m);
      }
    }
    this.addInteractPoint(NOOK_NEST.x, NOOK_NEST.y, () => {
      const s = getState(this);
      if (!s.flags.middenCleared) {
        this.openScript(nestIntroScript, () => {
          this.startBattle(["middenmite", "middenmite", "middenmite", "middenmite"], {
            victoryFlag: "middenCleared"
          });
        });
        return;
      }
      this.openScript(nookClearScript);
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
