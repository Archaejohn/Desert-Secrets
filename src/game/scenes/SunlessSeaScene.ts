/**
 * Act 3, Zone 1 — The Sunless Sea (the entry overlook). Where the crack the
 * penguins dove through drops Joseph and Slither: the first sight of the
 * bioluminescent cavern ocean, establishing tone and scale before any real
 * traversal. The comic Piggy-chase beat plays here (two shapes skating far
 * out on the water), then the south gate leads on into the kelp forest.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import { buildSunlessSeaMap, SEA_CHASE_TRIGGER, SEA_EXIT_SOUTH, SEA_SPAWN } from "../maps/sunlessSeaMap";
import { KELP_SPAWN } from "../maps/kelpForestMap";
import { piggyChaseScript } from "../../core/scripts/piggyChase";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

export class SunlessSeaScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("sunlessSea");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "sunlessSea",
      zoneName: "The Sunless Sea",
      map: buildSunlessSeaMap(),
      defaultSpawn: SEA_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.animateTilePair("seaWater", "seaWater2");
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...SEA_EXIT_SOUTH }, "kelpForest", KELP_SPAWN);
    this.placeChase();
  }

  /** The comic chase: Piggy playing tag out on the water, gone before you're near. */
  private placeChase(): void {
    if (getState(this).flags.sawChase) return;
    this.addTrigger({ ...SEA_CHASE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawChase) return;
      const piggy = this.add.sprite(9 * TILE, 8 * TILE, "piggy", 0).setDepth(8 * TILE);
      const fluff = this.add.sprite(8 * TILE, 9 * TILE, "fluffball", 0).setDepth(9 * TILE);
      piggy.play("piggy-walk");
      fluff.play("fluffball-walk");
      this.tweens.add({
        targets: [piggy, fluff],
        x: "-=48",
        y: "+=8",
        duration: 1800,
        onComplete: () => {
          this.tweens.add({
            targets: [piggy, fluff],
            alpha: 0,
            duration: 400,
            onComplete: () => {
              piggy.destroy();
              fluff.destroy();
              // Wait for the pair to fully vanish across the water before
              // the reaction lines open, so dialogue never races ahead of
              // what it's about.
              this.openScript(piggyChaseScript, () => {
                const cur = getState(this);
                setState(this, { ...cur, flags: { ...cur.flags, sawChase: true } });
                this.hud.update(getState(this));
              });
            }
          });
        }
      });
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
