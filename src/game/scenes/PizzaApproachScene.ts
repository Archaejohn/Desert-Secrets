/**
 * Act 7, Zone 3 — The Old Kitchens. Raw volcanic rock gives way to carved
 * steps, temple columns and old signage overhead — the temple's kitchens,
 * repurposed. Two gates: north back to the vents, south into the restaurant.
 * Both follower rigs pumped. No random encounters.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildPizzaApproachMap,
  PIZZA_A_ENTRY_TRIGGER,
  PIZZA_A_EXIT_NORTH,
  PIZZA_A_EXIT_SOUTH,
  PIZZA_A_SPAWN
} from "../maps/pizzaApproachMap";
import { PIZZA_V_RETURN_SPAWN } from "../maps/pizzaVentMap";
import { PIZZA_P_SPAWN } from "../maps/pizzeriaMap";
import { pizzaApproachEntryScript } from "../../core/scripts/pizzaApproachEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";

export class PizzaApproachScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("pizzaApproach");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "pizzaApproach",
      zoneName: "The Old Kitchens",
      map: buildPizzaApproachMap(),
      defaultSpawn: PIZZA_A_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...PIZZA_A_EXIT_NORTH }, "pizzaVent", PIZZA_V_RETURN_SPAWN);
    this.addExit({ ...PIZZA_A_EXIT_SOUTH }, "pizzeria", PIZZA_P_SPAWN);

    if (!getState(this).flags.sawPizzaApproach) {
      this.addTrigger({ ...PIZZA_A_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawPizzaApproach) return;
        this.openScript(pizzaApproachEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawPizzaApproach: true } });
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
