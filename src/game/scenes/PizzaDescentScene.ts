/**
 * Act 7, Zone 1 — The Warm Deep. The Act 6 → Act 7 entry zone: the party pushes
 * below the reef, following the miners' old rumor of smelled tomato pie. One
 * gate, south, on toward the lava vents. Both follower rigs pumped. No random
 * encounters (Act 7 is combat-free).
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
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

export class PizzaDescentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

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
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
