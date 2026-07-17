/**
 * Act 5, Zone 1 — The Warm Descent. Where the camp's back gallery bottoms out
 * into the stone (the Act 4 → Act 5 hand-off spawns the party here at
 * DESCENT_SPAWN, so `groveDescent` keeps its id). The floor greens, the air
 * warms, and light glows up from below — a short orient, then the south gate
 * leads on into the grove approach. Slither trails (shared rig); Fluffball has
 * not joined yet, so his rig stays dormant here.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
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
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupLightShaft } from "../gfx/zoneLighting";

export class GroveDescentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private lightMask: LightMask | null = null;

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

    // The warm sunbeam glow spilling UP from the grove chamber below.
    const gate = DESCENT_EXIT_SOUTH;
    this.lightMask = setupLightShaft(this, {
      x: ((gate.x1 + gate.x2 + 1) / 2) * TILE,
      y: TILE * 10,
      width: 80,
      height: TILE * 6,
      direction: "up",
      intensity: 0.7,
      stops: [
        { offset: 0, color: hexToInt(PALETTE.amber), alpha: 0.55 },
        { offset: 0.5, color: hexToInt(PALETTE.sand), alpha: 0.24 },
        { offset: 1, color: hexToInt(PALETTE.sand), alpha: 0 }
      ]
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
