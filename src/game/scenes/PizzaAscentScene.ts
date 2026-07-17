/**
 * Act 7, Zone 5 — The Long Way Up. The finale, and the close of Part One.
 * Piggy caught, fed, and following the party (the PiggyFollower rig, a third
 * copy of the Slither/Fluffball follower pattern), everyone climbs back toward
 * the surface. Partway up, Rosa's radio (the game's very first NPC) crackles
 * back to life — a real signal, almost home. Then, mid-step, the floor gives
 * way: a deliberate END OF PART ONE cliffhanger (NOT an "Act N: coming soon"
 * placeholder), then back to the title (Part Two isn't built yet). Enclosed,
 * no gate — the only way out is the collapse. Reload-safe: a reload after the
 * finale re-shows the end card.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildPizzaAscentMap,
  PIZZA_ASCENT_ENTRY_TRIGGER,
  PIZZA_ASCENT_FINALE_TRIGGER,
  PIZZA_ASCENT_SPAWN
} from "../maps/pizzaAscentMap";
import { pizzaAscentEntryScript } from "../../core/scripts/pizzaAscentEntry";
import { partOneFinaleScript } from "../../core/scripts/partOneFinale";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { PiggyFollower } from "../PiggyFollower";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";

export class PizzaAscentScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private piggy = new PiggyFollower(this);

  constructor() {
    super("pizzaAscent");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "pizzaAscent",
      zoneName: "The Long Way Up",
      map: buildPizzaAscentMap(),
      defaultSpawn: PIZZA_ASCENT_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    this.piggy = new PiggyFollower(this);

    // Reload guard: a reload landing on the finished finale must not soft-lock —
    // re-show the end card rather than dropping the player into a dead shaft.
    if (getState(this).flags.act7Complete) {
      this.inputLocked = true;
      this.showEndCard();
      return;
    }

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);
    if (getState(this).flags.piggyCaught) this.piggy.spawn(this.player.x, this.player.y);

    if (!getState(this).flags.sawPizzaAscent) {
      this.addTrigger({ ...PIZZA_ASCENT_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawPizzaAscent) return;
        this.openScript(pizzaAscentEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawPizzaAscent: true } });
          this.hud.update(getState(this));
          // Thomas radio thread beat (see thomas.ts): the last, clearest
          // fragment of the climb — he's near, right before the reunion in the
          // Part Two opening the finale hands off to.
          this.playNextThomas();
        });
      });
    }

    // The finale trigger, near the top of the climb.
    this.addTrigger({ ...PIZZA_ASCENT_FINALE_TRIGGER }, () => this.runFinale());
  }

  /** Rosa's radio crackles back, then the floor gives way. */
  private runFinale(): void {
    if (this.inputLocked) return;
    // Unlock so the finale dialogue advances (movement is blocked while the box
    // is open); relock before the end card — same pattern as every act ending.
    this.inputLocked = false;
    this.cameras.main.shake(400, 0.004);
    this.openScript(partOneFinaleScript, () => {
      this.inputLocked = true;
      this.cameras.main.shake(900, 0.012);
      this.cameras.main.fadeOut(700, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", () => {
        const s = getState(this);
        setState(this, { ...s, flags: { ...s.flags, act7Complete: true, partOneComplete: true } });
        this.showEndCard();
      });
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.fadeIn(600, 0, 0, 0);
    const backdrop = this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 1).setScrollFactor(0).setDepth(7000);
    const title = this.add
      .text(w / 2, h / 2 - 40, "END OF PART ONE", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    // A genuine, evocative cliffhanger card — NOT a "next act coming soon" stub.
    const blurb = this.add
      .text(
        w / 2,
        h / 2 - 4,
        "Piggy is safe. The secret is out.\nAnd the floor is gone.",
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: PALETTE.mint,
          align: "center",
          lineSpacing: 4
        }
      )
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const tease = this.add
      .text(w / 2, h / 2 + 34, "What waits below has no name yet.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.skyBlue
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const prompt = this.add
      .text(w / 2, h / 2 + 58, "SPACE — Part Two", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    // Screen-space chrome above the HUD/dialogue's own depth (6000/5500):
    // must render via uiCamera too, or the two-camera split (ZoneScene's
    // world/UI camera architecture) would let uiCamera's HUD draw on top of
    // this "the end" card instead of the other way around.
    this.uiLayer.add([backdrop, title, blurb, tease, prompt]);

    // The natural hand-off into Part Two: the END OF PART ONE card advances
    // into the Part Two opening cutscene (Joseph and Thomas finally connecting
    // over the radio — the payoff for the whole one-way Thomas thread). That
    // cutscene plays its lines and then resets to the title, since the rest of
    // Part Two isn't built yet. Wiring choice: this replaces the old straight-
    // to-title jump; it's the only edge into PartTwoOpeningScene, kept minimal
    // and reachable in normal play. `partTwoStarted` records the crossing (the
    // save is still cleared for real at the cutscene's end).
    let done = false;
    const toPartTwo = (): void => {
      if (done) return;
      done = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, partTwoStarted: true } });
      this.scene.start("partTwoOpening");
    };
    this.input.keyboard?.once("keydown-SPACE", toPartTwo);
    this.input.once("pointerdown", toPartTwo);
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
    this.piggy.update(this.player.x, this.player.y);
  }
}
