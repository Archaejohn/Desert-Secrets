/**
 * Act 3 — The Sunless Sea. Joseph and Slither follow the crack under the
 * glacier into a bioluminescent cavern ocean, hopping floe to floe. Beats:
 * the comic chase (Piggy playing tag out on the water), Fluffball glimpsed
 * in a dead-end kelp bed (clue: silverfin), the flooded sun-temple ruin,
 * and the silverfin fishing spot — where the Lurker mini-boss steals the
 * lure and must be fought off before the timing minigame lands the catch.
 * Random encounters: anglerfish and reef eels. Ends on the Act 4 card.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildSunlessSeaMap,
  SEA_CHASE_TRIGGER,
  SEA_FISHING,
  SEA_FLUFFBALL,
  SEA_SPAWN,
  SEA_TEMPLE
} from "../maps/sunlessSeaMap";
import { piggyChaseScript } from "../../core/scripts/piggyChase";
import { fluffballMeetScript } from "../../core/scripts/fluffballMeet";
import { templeLoreScript } from "../../core/scripts/templeLore";
import { lurkerIntroScript } from "../../core/scripts/lurkerIntro";
import { fishingCastScript } from "../../core/scripts/fishingCast";
import { act3EndingScript } from "../../core/scripts/act3Ending";
import { CAMP_SPAWN } from "../maps/minersCampMap";
import { FishingMenu } from "../ui/FishingMenu";
import { getState, setState } from "../state";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";

/** How many recent player positions the follower trails behind. */
const FOLLOW_FRAMES = 14;

const alreadyCaughtScript: DialogueScript = {
  start: "have",
  nodes: [{ id: "have", lines: [{ speaker: "", text: "You already have the silverfin." }] }]
};

export class SunlessSeaScene extends ZoneScene {
  private follower: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];
  private fishingMenu: FishingMenu | null = null;

  constructor() {
    super("sunlessSea");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "sunlessSea",
      zoneName: "The Sunless Sea",
      map: buildSunlessSeaMap(),
      defaultSpawn: SEA_SPAWN,
      encounterZone: "sunlessSea",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.follower = null;
    this.trail = [];
    this.fishingMenu = null;

    this.animateTilePair("seaWater", "seaWater2");

    if (getState(this).flags.slitherJoined) this.spawnFollower();

    this.placeChase();
    this.placeFluffball();
    this.placeTemple();
    this.placeFishingSpot();

    // Epilogue: a reload that lands on the finished act (act3Complete but the
    // tunnels not yet climbed) must not soft-lock Act 4 — walking back to the
    // north overlook the party dropped through climbs up to the miners' camp.
    // Mirrors the Act 2 sanctum's own reload-safe descend trigger.
    const s = getState(this);
    if (s.flags.act3Complete && !s.flags.act4Started) {
      this.addTrigger(
        { x1: SEA_SPAWN.x - 2, y1: SEA_SPAWN.y - 1, x2: SEA_SPAWN.x + 2, y2: SEA_SPAWN.y + 1 },
        () => {
          const cur = getState(this);
          setState(this, { ...cur, flags: { ...cur.flags, act4Started: true } });
          this.goToZone("minersCamp", CAMP_SPAWN);
        }
      );
    }
  }

  // --- The comic chase ---

  private placeChase(): void {
    if (getState(this).flags.sawChase) return;
    this.addTrigger({ ...SEA_CHASE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawChase) return;
      // Two tiny shapes skate across the far water and vanish.
      const piggy = this.add.sprite(6 * TILE, 9 * TILE, "piggy", 0).setDepth(9 * TILE);
      const fluff = this.add.sprite(5 * TILE, 10 * TILE, "fluffball", 0).setDepth(10 * TILE);
      piggy.play("piggy-walk");
      fluff.play("fluffball-walk");
      this.tweens.add({ targets: [piggy, fluff], x: "-=48", y: "+=8", duration: 1800, onComplete: () => {
        this.tweens.add({ targets: [piggy, fluff], alpha: 0, duration: 400, onComplete: () => {
          piggy.destroy();
          fluff.destroy();
        } });
      } });
      this.openScript(piggyChaseScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, sawChase: true } });
        this.hud.update(getState(this));
      });
    });
  }

  // --- Fluffball, glimpsed ---

  private placeFluffball(): void {
    if (getState(this).flags.metFluffball) return;
    const fluff = this.add
      .sprite(SEA_FLUFFBALL.x * TILE + TILE / 2, SEA_FLUFFBALL.y * TILE + TILE / 2, "fluffball", 0)
      .setDepth(SEA_FLUFFBALL.y * TILE + TILE / 2);
    fluff.play("fluffball-idle");
    this.addTrigger({ x1: 4, y1: 2, x2: 6, y2: 6 }, () => {
      const s = getState(this);
      if (s.flags.metFluffball) return;
      this.openScript(fluffballMeetScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, metFluffball: true } });
        this.hud.update(getState(this));
        // He bolts: a gray blur out of the bed and gone.
        fluff.play("fluffball-walk");
        this.tweens.add({
          targets: fluff,
          x: fluff.x + 3 * TILE,
          y: fluff.y - TILE,
          duration: 700,
          onUpdate: () => fluff.setDepth(fluff.y),
          onComplete: () => this.tweens.add({ targets: fluff, alpha: 0, duration: 250, onComplete: () => fluff.destroy() })
        });
      });
    });
  }

  // --- The flooded sun-temple ruin ---

  private placeTemple(): void {
    this.addInteractPoint(SEA_TEMPLE.x, SEA_TEMPLE.y, () => {
      this.openScript(templeLoreScript, () => {
        const s = getState(this);
        if (!s.flags.sawTemple) {
          setState(this, { ...s, flags: { ...s.flags, sawTemple: true } });
          this.hud.update(getState(this));
        }
      });
    });
  }

  // --- The silverfin fishing spot (Lurker gate → timing minigame) ---

  private placeFishingSpot(): void {
    // A visible sparkle marks the spot.
    this.addProp("seaSparkle", SEA_FISHING.x, SEA_FISHING.y, { depthSort: false });
    this.addInteractPoint(SEA_FISHING.x, SEA_FISHING.y, () => {
      const s = getState(this);
      if (!s.flags.lurkerDefeated) {
        this.openScript(lurkerIntroScript, () => {
          this.startBattle(["lurker"], { boss: true, victoryFlag: "lurkerDefeated" });
        });
        return;
      }
      if (s.flags.silverfinCaught) {
        this.openScript(alreadyCaughtScript);
        return;
      }
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

  // --- Act 3 ending ---

  private runEnding(): void {
    // Unlock so the ending box can be advanced (movement stays blocked while
    // the dialogue is open); relock before the end card. Same pattern as the
    // Act 1/2 endings — a locked scene never forwards confirm to the box.
    this.inputLocked = false;
    this.openScript(act3EndingScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act3Complete: true } });
      this.showEndCard();
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94).setScrollFactor(0).setDepth(7000);
    this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 3", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2, "ACT 4: THE MINERS' CAMP — coming soon", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.mint
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2 + 26, "SPACE — up through the tunnels", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);

    // The Act 4 hand-off: climb back up to the miners' camp, keeping all
    // progress — exactly the Act 2 → Act 3 pattern (sanctum → sunlessSea).
    let ascended = false;
    const ascend = (): void => {
      if (ascended) return;
      ascended = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act4Started: true } });
      this.scene.start("minersCamp", {});
    };
    this.input.keyboard?.once("keydown-SPACE", ascend);
    this.input.once("pointerdown", ascend);
  }

  // --- Slither follower (trails the player, like the galleries/sanctum) ---

  private spawnFollower(): void {
    if (this.follower) return;
    this.follower = this.add.sprite(this.player.x, this.player.y + 4, "slither", 0);
    this.follower.play("slither-move");
    this.follower.setDepth(this.follower.y);
  }

  protected onUpdate(): void {
    if (!this.follower) return;
    this.trail.push({ x: this.player.x, y: this.player.y + 4 });
    if (this.trail.length > FOLLOW_FRAMES) this.trail.shift();
    const target = this.trail[0];
    const dx = target.x - this.follower.x;
    const moving = Math.abs(dx) + Math.abs(target.y - this.follower.y) > 0.5;
    if (Math.abs(dx) > 0.5) this.follower.setFlipX(dx < 0);
    this.follower.play(moving ? "slither-move" : "slither-idle", true);
    this.follower.setPosition(target.x, target.y);
    this.follower.setDepth(target.y);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }
}
