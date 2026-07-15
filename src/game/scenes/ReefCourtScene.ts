/**
 * Act 6, Zone 5 — The Crawler Court. The diplomacy zone, and the act's new
 * mechanic: getting the seaweed is a TRADE, not a fight. Slither negotiates and
 * Fluffball translates/vouches (the first payoff of his knack for reef life).
 * The crawler warden stands by the oldest mint-kelp row; talking to her opens
 * `reefParley`, a branch point modelled on Act 1's Dust Queen (queenParley /
 * queenFight):
 *
 *  - a GOOD approach (the right dialogue choices) ends at node `trade-end` — a
 *    peaceful trade: `gotSeaweed` + `items.seaweed`, then the Act 6 ending.
 *  - a BAD approach ends at node `affront` — the crawlers call a reef predator
 *    down: an AVOIDABLE `BattleScene` (reefstalker, `victoryFlag: reefFought`),
 *    not an instant one. After winning, the warden relents (`reefYield`) and
 *    gives the kelp anyway — so both paths reach the seaweed, the peaceful one
 *    without a fight.
 *
 * One gate, north, back to the hollow; the way on to Act 7 is the end card (a
 * teammate's next task), with a reload-safe epilogue guard. Both follower rigs
 * pumped.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildReefCourtMap,
  REEF_C_ENTRY_TRIGGER,
  REEF_C_EXIT_NORTH,
  REEF_C_NPC,
  REEF_C_PREDATOR,
  REEF_C_SPAWN
} from "../maps/reefCourtMap";
import { REEF_H_RETURN_SPAWN } from "../maps/reefHollowMap";
import { reefCourtEntryScript } from "../../core/scripts/reefCourtEntry";
import { reefParleyScript } from "../../core/scripts/reefParley";
import { reefYieldScript } from "../../core/scripts/reefYield";
import { act6EndingScript } from "../../core/scripts/act6Ending";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState, resetGame } from "../state";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";

/** The crawler warden, once the mint kelp has changed hands. */
const courtChatterScript: DialogueScript = {
  start: "chat",
  nodes: [{ id: "chat", lines: [{ speaker: "Crawler", text: "(a soft rattle — go well, cold one's friends)" }] }]
};

export class ReefCourtScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("reefCourt");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "reefCourt",
      zoneName: "The Crawler Court",
      map: buildReefCourtMap(),
      defaultSpawn: REEF_C_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);

    // Epilogue: a reload that lands on the finished act mustn't soft-lock —
    // re-show the end card rather than dropping the player into a dead court.
    if (getState(this).flags.act6Complete) {
      this.inputLocked = true;
      this.showEndCard();
      return;
    }

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...REEF_C_EXIT_NORTH }, "reefHollow", REEF_H_RETURN_SPAWN);

    if (!getState(this).flags.sawReefCourt) {
      this.addTrigger({ ...REEF_C_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawReefCourt) return;
        this.openScript(reefCourtEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawReefCourt: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeWarden();
  }

  private placeWarden(): void {
    this.addNpc({
      sheet: "crystalcrawler", // a crawler elder, keeper of the oldest row
      tileX: REEF_C_NPC.x,
      tileY: REEF_C_NPC.y,
      script: () => this.wardenScript(),
      onClose: (endNodeId) => this.onWardenClose(endNodeId)
    });
  }

  private wardenScript(): DialogueScript {
    const s = getState(this);
    if (s.flags.gotSeaweed) return courtChatterScript;
    // After an avoidable fight, the warden relents and trades in peace.
    if (s.flags.reefFought) return reefYieldScript;
    return reefParleyScript; // the trade-not-fight branch point
  }

  private onWardenClose(endNodeId: string | null): void {
    const s = getState(this);
    if (s.flags.gotSeaweed) return;
    // A bad approach: the crawlers call a predator down — an AVOIDABLE fight.
    if (endNodeId === "affront") {
      this.runAffrontFight();
      return;
    }
    // A good approach (`trade-end`) or the post-fight `yield`: the trade lands.
    setState(this, {
      ...s,
      items: { ...s.items, seaweed: true },
      flags: { ...s.flags, gotSeaweed: true }
    });
    this.floatText(this.player.x, this.player.y - 16, "Got the crawlers' mint kelp! (Seaweed.)");
    this.hud.update(getState(this));
    this.inputLocked = true;
    this.time.delayedCall(900, () => this.runEnding());
  }

  /** The bad-approach fallback: a reef stalker knifes in; win it and the
   *  crawlers relent (reefFought → reefYield on the next talk). */
  private runAffrontFight(): void {
    this.inputLocked = true;
    const predator = this.add
      .sprite(REEF_C_PREDATOR.x * TILE + TILE / 2, REEF_C_PREDATOR.y * TILE + TILE / 2, "reefstalker", 0)
      .setDepth(9999);
    predator.play("reefstalker-move");
    this.tweens.add({
      targets: predator,
      x: this.player.x + 18,
      y: this.player.y,
      duration: 700,
      onComplete: () => {
        predator.destroy();
        this.startBattle(["reefstalker", "reefstalker"], { victoryFlag: "reefFought" });
      }
    });
  }

  private runEnding(): void {
    // Unlock so the ending box advances (movement stays blocked while the box
    // is open); relock before the end card — same pattern as Acts 1–5.
    this.inputLocked = false;
    this.openScript(act6EndingScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act6Complete: true } });
      this.showEndCard();
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94).setScrollFactor(0).setDepth(7000);
    this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 6", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2, "ACT 7: LA PIZZERIA SOTTERRANEA — coming soon", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.mint
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

    // Act 7's zones are a teammate's next task — return to the title for now,
    // exactly as Acts 3–5 did for their own successors.
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

  protected onUpdate(): void {
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
