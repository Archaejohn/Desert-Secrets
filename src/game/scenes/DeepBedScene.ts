/**
 * Act 3, Zone 5 — The Deep Kelp Bed. The climax zone, past where the light
 * gives out. Here the pacing fix lives: the player finds the fishing spot and
 * CASTS FIRST (seaFirstCast — "the line goes taut..."); the Lurker steals the
 * lure (lurkerIntro), which is what triggers the mini-boss fight; once it's
 * beaten off the line is intact, the player casts again (fishingCast choice),
 * and the timing minigame lands the real silverfin. Then act3Ending plays and
 * the party climbs out (hand-off to the ascent zone). Random encounters
 * reuse the shared sunlessSea table.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import { buildDeepBedMap, DEEP_EXIT_WEST, DEEP_FISHING, DEEP_SPAWN } from "../maps/deepBedMap";
import { KELP_DEEP_RETURN_SPAWN } from "../maps/kelpForestMap";
import { ASCENT_SPAWN } from "../maps/seaAscentMap";
import { deepBedEntryScript } from "../../core/scripts/deepBedEntry";
import { seaFirstCastScript } from "../../core/scripts/seaFirstCast";
import { lurkerIntroScript } from "../../core/scripts/lurkerIntro";
import { fishingCastScript } from "../../core/scripts/fishingCast";
import { act3EndingScript } from "../../core/scripts/act3Ending";
import { FishingMenu } from "../ui/FishingMenu";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

const alreadyCaughtScript: DialogueScript = {
  start: "have",
  nodes: [{ id: "have", lines: [{ speaker: "", text: "You already have the silverfin." }] }]
};

/** Nothing to fish for yet — the silverfin clue lives with Fluffball. */
const needFluffballScript: DialogueScript = {
  start: "need",
  nodes: [
    {
      id: "need",
      lines: [
        { speaker: "Slither", text: "Nothing bitesss on a hunch, Joseph." },
        { speaker: "Joseph", text: "We need to know what we're even after." }
      ]
    }
  ]
};

export class DeepBedScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fishingMenu: FishingMenu | null = null;
  private lightMask: LightMask | null = null;

  constructor() {
    super("deepBed");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "deepBed",
      zoneName: "The Deep Kelp Bed",
      map: buildDeepBedMap(),
      defaultSpawn: DEEP_SPAWN,
      encounterZone: "sunlessSea",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fishingMenu = null;
    this.animateTilePair("seaWater", "seaWater2");

    // Reload safety: if the silverfin is already caught but the party hasn't
    // climbed out yet, send them straight up the ascent (mirrors the Act 2
    // sanctum epilogue) so a reload here can't soft-lock Act 4.
    const s0 = getState(this);
    if (s0.flags.silverfinCaught && !s0.flags.act4Started) {
      this.goToZone("seaAscent", ASCENT_SPAWN);
      return;
    }

    if (s0.flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    this.addExit({ ...DEEP_EXIT_WEST }, "kelpForest", KELP_DEEP_RETURN_SPAWN);

    // Entry orientation, plays once.
    if (!getState(this).flags.sawDeepBed) {
      this.addTrigger({ x1: 3, y1: 8, x2: 8, y2: 11 }, () => {
        if (getState(this).flags.sawDeepBed) return;
        this.openScript(deepBedEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawDeepBed: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeFishingSpot();
    this.setupDeepDarkness();
  }

  /**
   * Past where the light gives out: a heavy ambient dark with ONLY the party's
   * own dim lamp reaching into it — the daylight from the surface has finally
   * run out this deep, exactly as the zone's text says. No glows; the lamp is
   * kept small and partial so the deep bed reads as the black at the bottom of
   * the sea, while still leaving the fishing spot and exit findable.
   */
  private setupDeepDarkness(): void {
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.62 },
      follow: this.player,
      followRadius: 92,
      followIntensity: 0.72
    });
  }

  /** The silverfin fishing spot: cast → Lurker steal → fight → recast → catch. */
  private placeFishingSpot(): void {
    this.addProp("seaSparkle", DEEP_FISHING.x, DEEP_FISHING.y, { depthSort: false });
    this.addInteractPoint(DEEP_FISHING.x, DEEP_FISHING.y, () => {
      const s = getState(this);
      if (!s.flags.metFluffball) {
        // Silverfin is Fluffball's clue - fishing here blind isn't the point.
        this.openScript(needFluffballScript);
        return;
      }
      if (!s.flags.lurkerDefeated) {
        // Cast FIRST; the line goes taut, then the Lurker takes it and dives —
        // the theft is what starts the fight.
        this.openScript(seaFirstCastScript, () => {
          this.openScript(lurkerIntroScript, () => {
            this.startBattle(["lurker"], { boss: true, victoryFlag: "lurkerDefeated" });
          });
        });
        return;
      }
      if (s.flags.silverfinCaught) {
        this.openScript(alreadyCaughtScript);
        return;
      }
      // Line's intact now — cast again and land the real catch.
      this.openScript(fishingCastScript, (endNodeId) => {
        if (endNodeId === "cast-end") this.openFishing();
      });
    });
  }

  private openFishing(): void {
    if (this.fishingMenu) return;
    this.inputLocked = true;
    this.fishingMenu = new FishingMenu(this, (landed) => {
      this.fishingMenu = null;
      if (landed) {
        // Stay input-locked straight through the ending so the winning tap
        // can't also fire the fishing InteractPoint on the very next frame.
        this.catchSilverfin();
      } else {
        this.inputLocked = false;
        this.floatText(this.player.x, this.player.y - 16, "The line snapped! Try again.");
      }
    });
  }

  private catchSilverfin(): void {
    const s = getState(this);
    setState(this, {
      ...s,
      items: { ...s.items, silverfin: true },
      flags: { ...s.flags, silverfinCaught: true }
    });
    this.floatText(this.player.x, this.player.y - 16, "Silverfin caught!");
    this.hud.update(getState(this));
    this.time.delayedCall(900, () => this.runEnding());
  }

  /** The catch beat, then climb out of the sea (hand-off to the ascent zone). */
  private runEnding(): void {
    // Unlock so the ending box can be advanced (movement stays blocked while
    // the dialogue is open); relock before the hand-off. Same pattern as the
    // Act 1/2 endings — a locked scene never forwards confirm to the box.
    this.inputLocked = false;
    this.openScript(act3EndingScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act3Complete: true } });
      this.goToZone("seaAscent", ASCENT_SPAWN);
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }
}
