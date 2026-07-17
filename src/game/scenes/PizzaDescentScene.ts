/**
 * Act 7, Zone 1 — The Warm Deep. The Act 6 → Act 7 entry zone: the party pushes
 * below the reef, following the miners' old rumor of smelled tomato pie. One
 * gate, south, on toward the lava vents. Both follower rigs pumped. No random
 * encounters (Act 7 is combat-free).
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildPizzaDescentMap,
  PIZZA_D_ENTRY_TRIGGER,
  PIZZA_D_EXIT_SOUTH,
  PIZZA_D_SPAWN
} from "../maps/pizzaDescentMap";
import { PIZZA_V_SPAWN } from "../maps/pizzaVentMap";
import { pizzaDescentEntryScript } from "../../core/scripts/pizzaDescentEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupLightShaft } from "../gfx/zoneLighting";

export class PizzaDescentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private lightMask: LightMask | null = null;

  constructor() {
    super("pizzaDescent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "pizzaDescent",
      zoneName: "The Warm Deep",
      map: buildPizzaDescentMap(),
      defaultSpawn: PIZZA_D_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...PIZZA_D_EXIT_SOUTH }, "pizzaVent", PIZZA_V_SPAWN);

    if (!getState(this).flags.sawPizzaDescent) {
      this.addTrigger({ ...PIZZA_D_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawPizzaDescent) return;
        this.openScript(pizzaDescentEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawPizzaDescent: true } });
          this.hud.update(getState(this));
        });
      });
    }

    // A warm glow spilling UP from the lava vents below, toward the south gate.
    const gate = PIZZA_D_EXIT_SOUTH;
    this.lightMask = setupLightShaft(this, {
      x: ((gate.x1 + gate.x2 + 1) / 2) * TILE,
      y: TILE * 10,
      width: 80,
      height: TILE * 6,
      direction: "up",
      intensity: 0.7,
      stops: [
        { offset: 0, color: hexToInt(PALETTE.amber), alpha: 0.55 },
        { offset: 0.5, color: hexToInt(PALETTE.clay), alpha: 0.24 },
        { offset: 1, color: hexToInt(PALETTE.clay), alpha: 0 }
      ]
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
