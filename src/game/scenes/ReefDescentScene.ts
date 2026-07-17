/**
 * Act 6, Zone 1 — The Drowned Stair. The Act 5 → Act 6 entry zone (the hand-off
 * spawns the party here at REEF_D_SPAWN, so `reefDescent` keeps its id). A short
 * orient: back underwater, deeper than Act 2's galleries, the crawlers' glow
 * beginning at the south gate — then the gate leads on into their garden. Both
 * follower rigs are pumped (Slither and, by now, Fluffball, who joined in Act 5).
 * No random encounters.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildReefDescentMap,
  REEF_D_ENTRY_TRIGGER,
  REEF_D_EXIT_SOUTH,
  REEF_D_SPAWN
} from "../maps/reefDescentMap";
import { REEF_G_SPAWN } from "../maps/reefGardenMap";
import { reefDescentEntryScript } from "../../core/scripts/reefDescentEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupLightShaft } from "../gfx/zoneLighting";

export class ReefDescentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private lightMask: LightMask | null = null;

  constructor() {
    super("reefDescent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "reefDescent",
      zoneName: "The Drowned Stair",
      map: buildReefDescentMap(),
      defaultSpawn: REEF_D_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...REEF_D_EXIT_SOUTH }, "reefGarden", REEF_G_SPAWN);

    // Arrival orientation, plays once.
    if (!getState(this).flags.sawReefDescent) {
      this.addTrigger({ ...REEF_D_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawReefDescent) return;
        this.openScript(reefDescentEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawReefDescent: true } });
          this.hud.update(getState(this));
        });
      });
    }

    // The crawlers' bioluminescent glow beginning at the south gate, spilling
    // UP from their garden below.
    const gate = REEF_D_EXIT_SOUTH;
    this.lightMask = setupLightShaft(this, {
      x: ((gate.x1 + gate.x2 + 1) / 2) * TILE,
      y: TILE * 10,
      width: 80,
      height: TILE * 6,
      direction: "up",
      intensity: 0.7,
      stops: [
        { offset: 0, color: hexToInt(PALETTE.mint), alpha: 0.55 },
        { offset: 0.5, color: hexToInt(PALETTE.jade), alpha: 0.24 },
        { offset: 1, color: hexToInt(PALETTE.teal), alpha: 0 }
      ]
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
