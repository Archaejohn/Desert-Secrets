/**
 * Act 7, Zone 3 — The Old Kitchens. Raw volcanic rock gives way to carved
 * steps, temple columns and old signage overhead — the temple's kitchens,
 * repurposed. Two gates: north back to the vents, south into the restaurant.
 * Both follower rigs pumped. No random encounters.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
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
import { LightMask } from "../gfx/LightMask";
import { setupLightShaft } from "../gfx/zoneLighting";
import { PALETTE, hexToInt } from "../../shared/palette";

export class PizzaApproachScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private lightMask: LightMask | null = null;

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

    this.setupDoorwayLight();
  }

  /**
   * Warm light streaming UP out of the restaurant below: a doorway shaft hung
   * on the south gate (the way into La Pizzeria), spilling into the kitchens
   * toward the player — the golden glow the room's text promises. Additive
   * only (the kitchens stay fully navigable); pulsed each frame from onUpdate.
   */
  private setupDoorwayLight(): void {
    const gate = PIZZA_A_EXIT_SOUTH;
    const cx = ((gate.x1 + gate.x2 + 1) / 2) * TILE; // centre of the two-tile gate
    this.lightMask = setupLightShaft(this, {
      x: cx,
      y: TILE * 10, // rising up into the kitchens from the south threshold
      width: 116,
      height: TILE * 10,
      direction: "up",
      intensity: 1,
      pulse: { min: 0.82, max: 1, periodMs: 2400 },
      // A hot pale-warm mouth at the doorway blooming to amber as it spreads
      // up into the kitchens — unmistakably light spilling from the restaurant.
      stops: [
        { offset: 0, color: hexToInt(PALETTE.bone), alpha: 0.7 },
        { offset: 0.28, color: hexToInt(PALETTE.amber), alpha: 0.52 },
        { offset: 0.6, color: hexToInt(PALETTE.amber), alpha: 0.26 },
        { offset: 1, color: hexToInt(PALETTE.amber), alpha: 0 }
      ]
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
