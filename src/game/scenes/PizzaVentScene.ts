/**
 * Act 7, Zone 2 — The Lava Vents. A volcanic gallery lit by molten vents
 * (SOLID, animated) the party threads around. Two gates: north back to the
 * descent, south on to the old kitchens. Both follower rigs pumped. No random
 * encounters.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildPizzaVentMap,
  PIZZA_V_ENTRY_TRIGGER,
  PIZZA_V_EXIT_NORTH,
  PIZZA_V_EXIT_SOUTH,
  PIZZA_V_SPAWN
} from "../maps/pizzaVentMap";
import { PIZZA_D_RETURN_SPAWN } from "../maps/pizzaDescentMap";
import { PIZZA_A_SPAWN } from "../maps/pizzaApproachMap";
import { pizzaVentEntryScript } from "../../core/scripts/pizzaVentEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class PizzaVentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("pizzaVent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "pizzaVent",
      zoneName: "The Lava Vents",
      map: buildPizzaVentMap(),
      defaultSpawn: PIZZA_V_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.animateTilePair("lavaVent", "lavaVent2");
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...PIZZA_V_EXIT_NORTH }, "pizzaDescent", PIZZA_D_RETURN_SPAWN);
    this.addExit({ ...PIZZA_V_EXIT_SOUTH }, "pizzaApproach", PIZZA_A_SPAWN);

    if (!getState(this).flags.sawPizzaVent) {
      this.addTrigger({ ...PIZZA_V_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawPizzaVent) return;
        this.openScript(pizzaVentEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawPizzaVent: true } });
          this.hud.update(getState(this));
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
