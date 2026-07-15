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
import { PALETTE } from "../../shared/palette";

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

  protected populate(): void {
    this.animateTilePair("lavaVent", "lavaVent2");
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    this.cookingMenu = null;

    // Reload guard: if the reveal already played, the party's business here is
    // done — head straight up rather than dropping them into a finished scene.
    if (getState(this).flags.heardReveal) {
      this.inputLocked = true;
      this.time.delayedCall(300, () => this.enterAscent());
      return;
    }

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...PIZZA_P_EXIT_NORTH }, "pizzaApproach", PIZZA_A_RETURN_SPAWN);
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
          this.runReveal();
        });
      }
    });
  }

  /** THE REVEAL: Testudo tells the glacier/old-ocean secret (only this one). */
  private runReveal(): void {
    this.inputLocked = false;
    this.openScript(testudoRevealScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, heardReveal: true } });
      this.hud.update(getState(this));
      this.time.delayedCall(900, () => this.enterAscent());
    });
  }

  /** The hand-off to the finale: the walk back up (a real zone, not a card). */
  private enterAscent(): void {
    this.goToZone("pizzaAscent", PIZZA_ASCENT_SPAWN);
  }

  protected onUpdate(): void {
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
