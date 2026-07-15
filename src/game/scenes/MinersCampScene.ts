/**
 * Act 4 — The Miners' Camp ("Dirty Laundry"). Joseph and Slither climb back
 * up through the tunnels to where Mo, Edda and Gus now live. Beats: the comic
 * crate chase (Piggy caught raiding, burrows through a crate stack and pops
 * out the far side), Fluffball glimpsed on a ledge (clue #2: the RIPEST
 * socks), and a favor-quest — clear a nest of midden mites out of the laundry
 * nook and the miners hand over the reeking socks. Carrying the socks is the
 * "reeks" mechanic: a comic NPC reaction, and frost scarabs give the party a
 * wide berth (encounterTable() reweighting). Ends on the Act 5 card.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildMinersCampMap,
  CAMP_CRATE_STACK,
  CAMP_CRATE_TRIGGER,
  CAMP_EDDA,
  CAMP_FLUFFBALL,
  CAMP_FLUFFBALL_TRIGGER,
  CAMP_GUS,
  CAMP_MO,
  CAMP_NEST,
  CAMP_SOCKS,
  CAMP_SPAWN
} from "../maps/minersCampMap";
import { crateChaseScript } from "../../core/scripts/crateChase";
import { fluffballLedgeScript } from "../../core/scripts/fluffballLedge";
import { minersFavorScript } from "../../core/scripts/minersFavor";
import { minersRewardScript } from "../../core/scripts/minersReward";
import { minersReekScript } from "../../core/scripts/minersReek";
import { act4EndingScript } from "../../core/scripts/act4Ending";
import { getState, setState, resetGame } from "../state";
import { ENCOUNTERS, reekAdjusted, type EncounterTable } from "../../core/encounters";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";

/** How many recent player positions the follower trails behind. */
const FOLLOW_FRAMES = 14;

/** Camp chatter once the socks are handed over (and not currently reeking). */
const campChatter: DialogueScript = {
  start: "camp",
  nodes: [{ id: "camp", lines: [{ speaker: "Mo", text: "String lights still work. Home enough." }] }]
};

/** Nudge toward the sock line once the nook is cleared. */
const takeSocksScript: DialogueScript = {
  start: "take",
  nodes: [
    {
      id: "take",
      lines: [
        { speaker: "Edda", text: "Nook's clear! The ripe socks are yours." },
        { speaker: "Edda", text: "Off the line, in the nook. Take them." }
      ]
    }
  ]
};

/** The nest, mid-swarm. */
const nestIntroScript: DialogueScript = {
  start: "nest",
  nodes: [
    {
      id: "nest",
      lines: [
        { speaker: "", text: "The laundry nook seethes with midden mites." },
        { speaker: "Slither", text: "Ssso many. Sssweep them all at once." }
      ]
    }
  ]
};

const nookClearScript: DialogueScript = {
  start: "clear",
  nodes: [{ id: "clear", lines: [{ speaker: "", text: "The nook is clear. Just laundry now." }] }]
};

const gotSocksScript: DialogueScript = {
  start: "have",
  nodes: [{ id: "have", lines: [{ speaker: "", text: "You already have the stinky socks." }] }]
};

const needClearScript: DialogueScript = {
  start: "need",
  nodes: [{ id: "need", lines: [{ speaker: "", text: "Clear the mites from the nook first." }] }]
};

export class MinersCampScene extends ZoneScene {
  private follower: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];
  private nestMites: Phaser.GameObjects.Sprite[] = [];

  constructor() {
    super("minersCamp");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "minersCamp",
      zoneName: "The Miners' Camp",
      map: buildMinersCampMap(),
      defaultSpawn: CAMP_SPAWN,
      encounterZone: "minersCamp",
      battleBg: "mine"
    };
  }

  /** While the party reeks of stinky socks, some enemies avoid it. */
  protected encounterTable(): EncounterTable {
    const base = ENCOUNTERS.minersCamp;
    return getState(this).items.stinkySocks ? reekAdjusted(base) : base;
  }

  protected populate(): void {
    this.follower = null;
    this.trail = [];
    this.nestMites = [];

    // Epilogue: a reload that lands on the finished act mustn't soft-lock —
    // re-show the end card rather than dropping the player into a dead camp.
    if (getState(this).flags.act4Complete) {
      this.inputLocked = true;
      this.showEndCard();
      return;
    }

    if (getState(this).flags.slitherJoined) this.spawnFollower();

    this.placeMiners();
    this.placeCrateChase();
    this.placeFluffball();
    this.placeNest();
    this.placeSocks();
  }

  // --- The three miners (favor-quest + the "reeks" reaction) ---

  private placeMiners(): void {
    const spots: Array<{ x: number; y: number }> = [CAMP_MO, CAMP_EDDA, CAMP_GUS];
    for (const spot of spots) {
      this.addNpc({
        sheet: "miner",
        tileX: spot.x,
        tileY: spot.y,
        script: () => this.minerScript()
      });
    }
  }

  /** Which line a miner gives, by run state (held socks change it). */
  private minerScript(): DialogueScript {
    const s = getState(this);
    if (s.items.stinkySocks) return minersReekScript; // comic reek reaction
    if (s.flags.gotSocks) return campChatter;
    if (s.flags.middenCleared) return takeSocksScript;
    return minersFavorScript;
  }

  // --- The comic crate chase ---

  private placeCrateChase(): void {
    if (getState(this).flags.sawCrateChase) return;
    this.addTrigger({ ...CAMP_CRATE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawCrateChase) return;
      // Piggy waddles to the crate stack, burrows in, pops out the far side.
      const piggy = this.add
        .sprite(CAMP_CRATE_TRIGGER.x2 * TILE, CAMP_CRATE_TRIGGER.y1 * TILE, "piggy", 0)
        .setDepth(9999);
      piggy.play("piggy-walk");
      this.tweens.chain({
        targets: piggy,
        tweens: [
          { x: CAMP_CRATE_STACK.x * TILE, y: CAMP_CRATE_STACK.y * TILE + TILE, duration: 900 },
          { alpha: 0, duration: 150 }, // burrows in
          {
            x: (CAMP_CRATE_STACK.x + 3) * TILE,
            y: (CAMP_CRATE_STACK.y + 2) * TILE,
            alpha: 0,
            duration: 10
          },
          { alpha: 1, duration: 150 }, // pops out the far side
          { x: (CAMP_CRATE_STACK.x + 4) * TILE, y: (CAMP_CRATE_STACK.y + 3) * TILE, duration: 700 },
          { alpha: 0, duration: 250 }
        ],
        onComplete: () => piggy.destroy()
      });
      this.openScript(crateChaseScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, sawCrateChase: true } });
        this.hud.update(getState(this));
      });
    });
  }

  // --- Fluffball, glimpsed on a ledge ---

  private placeFluffball(): void {
    if (getState(this).flags.fluffballLedge) return;
    const fluff = this.add
      .sprite(CAMP_FLUFFBALL.x * TILE + TILE / 2, CAMP_FLUFFBALL.y * TILE + TILE / 2, "fluffball", 0)
      .setDepth(CAMP_FLUFFBALL.y * TILE + TILE / 2);
    fluff.play("fluffball-idle");
    this.addTrigger({ ...CAMP_FLUFFBALL_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.fluffballLedge) return;
      this.openScript(fluffballLedgeScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, fluffballLedge: true } });
        this.hud.update(getState(this));
        // He bolts up and off the ledge, a gray blur.
        fluff.play("fluffball-walk");
        this.tweens.add({
          targets: fluff,
          x: fluff.x - 2 * TILE,
          y: fluff.y - TILE,
          duration: 650,
          onUpdate: () => fluff.setDepth(fluff.y),
          onComplete: () =>
            this.tweens.add({ targets: fluff, alpha: 0, duration: 250, onComplete: () => fluff.destroy() })
        });
      });
    });
  }

  // --- The midden-mite nest (favor-quest battle gate) ---

  private placeNest(): void {
    if (!getState(this).flags.middenCleared) {
      // A cosmetic swarm crawling around the nest until it's cleared.
      for (const [dx, dy] of [
        [0, 0],
        [1, 1],
        [-1, 1],
        [1, -1]
      ]) {
        const m = this.add
          .sprite((CAMP_NEST.x + dx) * TILE + TILE / 2, (CAMP_NEST.y + dy) * TILE + TILE / 2, "middenmite", 0)
          .setScale(1.3);
        m.setDepth(m.y);
        m.play("middenmite-move");
        this.nestMites.push(m);
      }
    }
    this.addInteractPoint(CAMP_NEST.x, CAMP_NEST.y, () => {
      const s = getState(this);
      if (!s.flags.middenCleared) {
        this.openScript(nestIntroScript, () => {
          this.startBattle(["middenmite", "middenmite", "middenmite", "middenmite"], {
            victoryFlag: "middenCleared"
          });
        });
        return;
      }
      this.openScript(nookClearScript);
    });
  }

  // --- The sock line (the reward, then the ending) ---

  private placeSocks(): void {
    this.addInteractPoint(CAMP_SOCKS.x, CAMP_SOCKS.y, () => {
      const s = getState(this);
      if (!s.flags.middenCleared) {
        this.openScript(needClearScript);
        return;
      }
      if (s.flags.gotSocks) {
        this.openScript(gotSocksScript);
        return;
      }
      this.openScript(minersRewardScript, () => {
        const cur = getState(this);
        setState(this, {
          ...cur,
          items: { ...cur.items, stinkySocks: true },
          flags: { ...cur.flags, gotSocks: true }
        });
        this.floatText(this.player.x, this.player.y - 16, "Got the stinky socks! (They reek.)");
        this.hud.update(getState(this));
        // Stay locked straight through to the ending so this closing tap
        // can't also re-fire the sock InteractPoint on the next frame.
        this.inputLocked = true;
        this.time.delayedCall(900, () => this.runEnding());
      });
    });
  }

  // --- Act 4 ending ---

  private runEnding(): void {
    // Unlock so the ending box can be advanced (movement stays blocked while
    // the dialogue is open); relock before the end card. Same pattern as the
    // Act 1/2/3 endings — a locked scene never forwards confirm to the box.
    this.inputLocked = false;
    this.openScript(act4EndingScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act4Complete: true } });
      this.showEndCard();
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94).setScrollFactor(0).setDepth(7000);
    this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 4", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2, "ACT 5: THE SUNLIT CAVE-IN — coming soon", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.jade
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2 + 26, "SPACE — back to title", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);

    let done = false;
    const backToTitle = (): void => {
      if (done) return;
      done = true;
      resetGame(this);
      this.scene.start("boot");
    };
    this.input.keyboard?.once("keydown-SPACE", backToTitle);
    this.input.once("pointerdown", backToTitle);
  }

  // --- Slither follower (trails the player, like the sea/galleries) ---

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
