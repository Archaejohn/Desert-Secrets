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
import { REEF_D_SPAWN } from "../maps/reefDescentMap";
import { sahraGroveEntryScript } from "../../core/scripts/sahraGroveEntry";
import { sahraGroveScript } from "../../core/scripts/sahraGrove";
import { act5EndingScript } from "../../core/scripts/act5Ending";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupSunbeamShaft } from "../gfx/zoneLighting";

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
  private lightMask: LightMask | null = null;

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

    // Epilogue: once Act 5 is done the grove hands off into Act 6 (a real zone
    // exit, not an end card — the Act 2→3 / 3→4 / 4→5 pattern). A reload that
    // somehow lands back here after the hand-off re-arms it rather than
    // soft-locking on a dead grove.
    if (getState(this).flags.act5Complete) {
      this.inputLocked = true;
      this.enterAct6();
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

    // Sahra's corner sits under the same cave-in sun as the great tree next
    // door: a bright additive shaft over her sunlit patch (no darkening).
    this.lightMask = setupSunbeamShaft(this, this.tileCentersNamed("sunbeam"));
  }

  private placeSahra(): void {
    this.addNpc({
      sheet: "sahra", // the grove keeper's own rig (bone robe, teal head-wrap)
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
    // is open); relock before the hand-off — same pattern as Acts 1–4.
    this.inputLocked = false;
    this.openScript(act5EndingScript, () => {
      this.inputLocked = true;
      this.enterAct6();
    });
  }

  /**
   * Descend into Act 6 (The Reef), keeping progress — the real hand-off that
   * replaces the old "ACT 6 — coming soon" title card, mirroring the Act 2→3,
   * 3→4 and 4→5 hand-offs. Sets `act5Complete` (record) and `act6Started`,
   * then drops the party into the reef's entry zone.
   */
  private enterAct6(): void {
    const s = getState(this);
    setState(this, { ...s, flags: { ...s.flags, act5Complete: true, act6Started: true } });
    this.goToZone("reefDescent", REEF_D_SPAWN);
  }

  protected onUpdate(): void {
    this.lightMask?.update();
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
