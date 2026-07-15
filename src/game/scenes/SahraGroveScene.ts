/**
 * Act 5, Zone 5 — Sahra's Grove. The keeper's tended corner, just east of the
 * great tree. Sahra trades the grove's oldest oranges only for news of the
 * desert above — and her dialogue REACTS to what actually happened in Acts 1–2
 * (the cold pack kept or traded; the Dust Queen fought or parleyed): the game's
 * first real callback payoff (see sahraGrove.ts). Taking the oranges
 * (`gotOranges` + `items.oranges`) rolls the Act 5 ending on its Act 6 title
 * card. One gate, west, back to the chamber. Both follower rigs pumped
 * (Slither and — by now — Fluffball).
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildSahraGroveMap,
  SAHRA_ENTRY_TRIGGER,
  SAHRA_EXIT_WEST,
  SAHRA_NPC,
  SAHRA_SPAWN
} from "../maps/sahraGroveMap";
import { CHAMBER_RETURN_SPAWN } from "../maps/groveChamberMap";
import { sahraGroveEntryScript } from "../../core/scripts/sahraGroveEntry";
import { sahraGroveScript } from "../../core/scripts/sahraGrove";
import { act5EndingScript } from "../../core/scripts/act5Ending";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState, resetGame } from "../state";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";

/** Sahra, once the oranges have changed hands. */
const groveChatterScript: DialogueScript = {
  start: "chat",
  nodes: [{ id: "chat", lines: [{ speaker: "Sahra", text: "Mind the seedlings on your way out." }] }]
};

/** Sahra before Fluffball has joined (defensive — the join is upstream). */
const meetFirstScript: DialogueScript = {
  start: "wait",
  nodes: [
    {
      id: "wait",
      lines: [
        { speaker: "Sahra", text: "Your gray friend knows which row I mean." },
        { speaker: "Sahra", text: "Find him, and the little penguin, first." }
      ]
    }
  ]
};

export class SahraGroveScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("sahraGrove");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "sahraGrove",
      zoneName: "Sahra's Grove",
      map: buildSahraGroveMap(),
      defaultSpawn: SAHRA_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);

    // Epilogue: a reload that lands on the finished act mustn't soft-lock —
    // re-show the end card rather than dropping the player into a dead grove.
    if (getState(this).flags.act5Complete) {
      this.inputLocked = true;
      this.showEndCard();
      return;
    }

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.addExit({ ...SAHRA_EXIT_WEST }, "groveChamber", CHAMBER_RETURN_SPAWN);

    if (!getState(this).flags.sawSahraGrove) {
      this.addTrigger({ ...SAHRA_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawSahraGrove) return;
        this.openScript(sahraGroveEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawSahraGrove: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeSahra();
  }

  private placeSahra(): void {
    this.addNpc({
      sheet: "npc", // the desert elder — Sahra, keeper of the grove
      tileX: SAHRA_NPC.x,
      tileY: SAHRA_NPC.y,
      script: () => this.sahraScript(),
      onClose: () => this.onSahraClose()
    });
  }

  private sahraScript(): DialogueScript {
    const s = getState(this);
    if (s.flags.gotOranges) return groveChatterScript;
    if (!s.flags.fluffballJoined) return meetFirstScript;
    return sahraGroveScript(s.flags); // reacts to the cold pack / the Queen
  }

  private onSahraClose(): void {
    const s = getState(this);
    // The reward fires only on the reactive-trade close (Fluffball has joined
    // and the oranges are not yet in hand); the other two scripts no-op here.
    if (!s.flags.fluffballJoined || s.flags.gotOranges) return;
    setState(this, {
      ...s,
      items: { ...s.items, oranges: true },
      flags: { ...s.flags, gotOranges: true }
    });
    this.floatText(this.player.x, this.player.y - 16, "Got the grove oranges! (Oldest row.)");
    this.hud.update(getState(this));
    // Stay locked straight through to the ending so this closing press can't
    // also re-open Sahra on the next frame.
    this.inputLocked = true;
    this.time.delayedCall(900, () => this.runEnding());
  }

  private runEnding(): void {
    // Unlock so the ending box advances (movement stays blocked while the box
    // is open); relock before the end card — same pattern as Acts 1–4.
    this.inputLocked = false;
    this.openScript(act5EndingScript, () => {
      this.inputLocked = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act5Complete: true } });
      this.showEndCard();
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add.rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94).setScrollFactor(0).setDepth(7000);
    this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 5", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    this.add
      .text(w / 2, h / 2, "ACT 6: THE REEF — coming soon", {
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

    // Act 6's zone is a teammate's next task — return to the title for now,
    // exactly as Acts 3 and 4 did for their own successors.
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
