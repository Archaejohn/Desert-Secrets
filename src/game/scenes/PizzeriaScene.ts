/**
 * Act 7, Zone 4 — La Pizzeria Sotterranea. The restaurant, and the heart of the
 * finale. Chef Testudo — an ancient tortoise — works the great oven; the tables
 * are set for guests three thousand years gone, lit by the flanking lava vents.
 * Three beats play here, in order:
 *
 *  1. THE BAKE — talking to Testudo (once all four ingredients are in hand)
 *     opens `testudoBake`, a choice hub (`bake-end` starts the cooking minigame,
 *     `CookingMenu` over the pure `src/core/cooking.ts`). A perfect bake sets
 *     `pizzaBaked`.
 *  2. THE CATCH — deliberately NOT a chase: the smell travels the tunnels and
 *     Piggy arrives at a waddling sprint on his own. Fluffball vouches; Piggy is
 *     gently caught, mid-bite (`piggyReunion` → `piggyCaught`). A warm reunion.
 *  3. THE REVEAL — Testudo tells the glacier/old-ocean secret (`testudoReveal`
 *     → `heardReveal`); the ONE mystery that resolves here (NOT the scarabs).
 *
 * Then the party heads back up: a narrated hand-off to `pizzaAscent` (the walk
 * out, and the Part One cliffhanger). One gate, north, back to the old kitchens;
 * reload-safe guards resume mid-sequence. Both follower rigs pumped.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import { getMusic, type TrackId } from "../audio/music";
import {
  buildPizzeriaMap,
  PIZZA_P_ENTRY_TRIGGER,
  PIZZA_P_EXIT_NORTH,
  PIZZA_P_PIGGY_ARRIVE,
  PIZZA_P_PIGGY_END,
  PIZZA_P_SPAWN,
  PIZZA_P_TABLE,
  PIZZA_P_TESTUDO
} from "../maps/pizzeriaMap";
import { PIZZA_A_RETURN_SPAWN } from "../maps/pizzaApproachMap";
import { PIZZA_ASCENT_SPAWN } from "../maps/pizzaAscentMap";
import { pizzeriaEntryScript } from "../../core/scripts/pizzeriaEntry";
import { testudoBakeScript } from "../../core/scripts/testudoBake";
import { piggyReunionScript } from "../../core/scripts/piggyReunion";
import { testudoRevealScript } from "../../core/scripts/testudoReveal";
import { pizzaRestScript } from "../../core/scripts/restPoints";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { CookingMenu } from "../ui/CookingMenu";
import { getState, setState } from "../state";
import type { Act1State } from "../../core/gameState";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

/** Testudo once the whole finale beat is done (a warm send-off). */
const testudoChatterScript: DialogueScript = {
  start: "chat",
  nodes: [{ id: "chat", lines: [{ speaker: "Testudo", text: "Eat, friends. The road up is long." }] }]
};
/** If somehow missing an ingredient (defensive — Act 7 always enters with all four). */
const testudoNeedsAllScript: DialogueScript = {
  start: "need",
  nodes: [{ id: "need", lines: [{ speaker: "Testudo", text: "Bring me all four he loves. Then we bake." }] }]
};
/** After the pizza's out, before Piggy arrives (a beat of anticipation). */
const testudoWaitScript: DialogueScript = {
  start: "wait",
  nodes: [{ id: "wait", lines: [{ speaker: "Testudo", text: "It's baked. Now the smell does the rest." }] }]
};

function hasAllFour(s: Act1State): boolean {
  return s.items.silverfin && s.items.stinkySocks && s.items.oranges && s.items.seaweed;
}

export class PizzeriaScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private cookingMenu: CookingMenu | null = null;
  private lightMask: LightMask | null = null;

  constructor() {
    super("pizzeria");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "pizzeria",
      zoneName: "La Pizzeria Sotterranea",
      map: buildPizzeriaMap(),
      defaultSpawn: PIZZA_P_SPAWN,
      battleBg: "ice"
    };
  }

  /** Testudo's theme fills the parlor — until Piggy is caught, then it's hers. */
  protected musicTrack(): TrackId {
    return getState(this).flags.piggyCaught ? "piggy" : "testudo";
  }

  protected populate(): void {
    this.animateTilePair("lavaVent", "lavaVent2");
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    this.cookingMenu = null;
    this.lightMask = null;

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...PIZZA_P_EXIT_NORTH }, "pizzaApproach", PIZZA_A_RETURN_SPAWN);
    this.setupVentLighting();

    // Reload landing after the reveal: the stairs up are already open. Re-reveal
    // them and require walking up (no auto-teleport); the north gate back to the
    // old kitchens stays available, the finale beats are skipped.
    if (getState(this).flags.heardReveal) {
      this.armStairsExit();
      return;
    }

    this.placeTestudo();

    // Rest point (a set table, a bowl of Testudo's soup): a free, reusable full
    // heal. Usable while exploring the restaurant before the finale beats begin.
    this.addInteractPoint(PIZZA_P_TABLE.x, PIZZA_P_TABLE.y, () => this.restHere(pizzaRestScript));

    if (!getState(this).flags.metTestudo) {
      this.addTrigger({ ...PIZZA_P_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.metTestudo) return;
        this.openScript(pizzeriaEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, metTestudo: true } });
          this.hud.update(getState(this));
        });
      });
    }

    // Reload guards mid-sequence: resume the catch or the reveal.
    if (getState(this).flags.pizzaBaked && !getState(this).flags.piggyCaught) {
      this.time.delayedCall(400, () => this.runCatch());
    } else if (getState(this).flags.piggyCaught && !getState(this).flags.heardReveal) {
      this.time.delayedCall(400, () => this.runReveal());
    }
  }

  /**
   * The restaurant runs on its lava vents: a gentle ambient dark that the warm
   * amber glow of the two flanking vents (and the oven-lit floor around the
   * hearth) cuts through, plus the player's own lamp so the room stays fully
   * navigable. Deliberately light — the vents "light the whole room" — so the
   * bake/catch/reveal cutscenes all read clearly.
   */
  private setupVentLighting(): void {
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.4 },
      follow: this.player,
      followRadius: 116,
      followIntensity: 0.85,
      amber: [
        ...this.tileCentersNamed("lavaVent").map((p) => ({ ...p, radius: 74 })),
        ...this.tileCentersNamed("ovenGlow").map((p) => ({ ...p, radius: 38 }))
      ],
      amberIntensity: 0.7
    });
  }

  private placeTestudo(): void {
    this.addNpc({
      sheet: "testudo",
      tileX: PIZZA_P_TESTUDO.x,
      tileY: PIZZA_P_TESTUDO.y,
      script: () => this.testudoScript(),
      onClose: (endNodeId) => this.onTestudoClose(endNodeId)
    });
  }

  private testudoScript(): DialogueScript {
    const s = getState(this);
    if (s.flags.piggyCaught) return testudoChatterScript;
    if (s.flags.pizzaBaked) return testudoWaitScript;
    if (!hasAllFour(s)) return testudoNeedsAllScript;
    return testudoBakeScript; // the bake choice hub
  }

  private onTestudoClose(endNodeId: string | null): void {
    if (endNodeId === "bake-end") this.runBake();
  }

  /** THE BAKE: the cooking/timing minigame. A perfect bake makes the pizza. */
  private runBake(): void {
    this.inputLocked = true;
    this.cookingMenu = new CookingMenu(this, (perfect) => {
      this.cookingMenu = null;
      if (perfect) {
        const s = getState(this);
        setState(this, { ...s, flags: { ...s.flags, pizzaBaked: true } });
        this.floatText(this.player.x, this.player.y - 16, "A perfect pizza!");
        this.hud.update(getState(this));
        this.time.delayedCall(900, () => this.runCatch());
      } else {
        // A scorched bake — Testudo helps you start over (talk to him again).
        this.inputLocked = false;
        this.openScript(
          {
            start: "burn",
            nodes: [{ id: "burn", lines: [{ speaker: "Testudo", text: "The crust caught. Again — together." }] }]
          },
          () => this.hud.update(getState(this))
        );
      }
    });
  }

  /** THE CATCH: no chase. Piggy comes to the smell, and is gently caught. */
  private runCatch(): void {
    this.inputLocked = true;
    const piggy = this.add
      .sprite(PIZZA_P_PIGGY_ARRIVE.x * TILE + TILE / 2, PIZZA_P_PIGGY_ARRIVE.y * TILE + TILE / 2, "piggy", 0)
      .setDepth(9999);
    piggy.play("piggy-walk");
    this.tweens.add({
      targets: piggy,
      x: PIZZA_P_PIGGY_END.x * TILE + TILE / 2,
      y: PIZZA_P_PIGGY_END.y * TILE + TILE / 2,
      duration: 1100,
      onUpdate: () => piggy.setDepth(piggy.y),
      onComplete: () => {
        piggy.play("piggy-idle");
        // Unlock so the reunion dialogue advances (movement stays blocked while
        // the box is open) — same rule the Act 1–6 cutscenes follow.
        this.inputLocked = false;
        this.openScript(piggyReunionScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, piggyCaught: true } });
          this.hud.update(getState(this));
          getMusic(this).play(this, "piggy"); // Piggy's theme swells the moment she's caught
          this.runReveal();
        });
      }
    });
  }

  /** THE REVEAL: Testudo tells the glacier/old-ocean secret (only this one). */
  private runReveal(): void {
    this.inputLocked = false;
    this.openScript(testudoRevealScript, () => {
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, heardReveal: true } });
      this.hud.update(getState(this));
      // No auto hand-off: Testudo shows the party the stairs up, and they have
      // to walk to them. Following the way up rolls into the finale (a real
      // zone), not the dialogue box being dismissed.
      this.armStairsExit();
    });
  }

  /**
   * Open the stairs up and arm the walk-out exit to the finale climb
   * (pizzaAscent). Shared by the live reveal and a reload landing.
   */
  private armStairsExit(): void {
    this.armWalkoutExit({
      reveal: () => this.openStairsUp(),
      hint: "Testudo shows the stairs up — climb out ↑",
      rect: { x1: 2, y1: 16, x2: 3, y2: 16 },
      target: "pizzaAscent",
      spawn: PIZZA_ASCENT_SPAWN
    });
  }

  /**
   * Testudo swings open the old service stair in the parlor's SW wall (carve
   * the wall tile to a walkable opening + a ladder up). No new flags — the
   * reveal (heardReveal) is already recorded; a reload just re-opens the stair.
   */
  private openStairsUp(): void {
    this.decorLayer.removeTileAt(2, 17);
    this.addProp("ladder", 2, 17);
    this.hud.update(getState(this));
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    if (this.cookingMenu) return; // the minigame owns input while open
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }
}
