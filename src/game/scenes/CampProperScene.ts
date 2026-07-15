/**
 * Act 4, Zone 2 — The Miners' Camp proper. The hub: Mo, Edda and Gus around
 * the stove, the sock line along the west wall, the supply crates Piggy raids
 * in the NE. Beats: the comic crate chase (Piggy caught raiding, burrows
 * through a crate stack and pops out the far side); the favor-quest hook (the
 * miners trade the socks once the laundry nook's midden-mite nest is cleared);
 * and — once cleared — taking the ripest socks off the line, which rolls the
 * Act 4 ending on its title card. Carrying the socks is the "reeks" mechanic:
 * a comic miner reaction, and frost scarabs give the party a wide berth
 * (encounterTable() reweighting). Gates: north to the outskirts, west to the
 * laundry nook, east to the back gallery. Slither trails (shared rig).
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildCampProperMap,
  CAMPP_CRATE_STACK,
  CAMPP_CRATE_TRIGGER,
  CAMPP_EDDA,
  CAMPP_ENTRY_TRIGGER,
  CAMPP_EXIT_EAST,
  CAMPP_EXIT_NORTH,
  CAMPP_EXIT_WEST,
  CAMPP_GUS,
  CAMPP_HEARTH,
  CAMPP_MO,
  CAMPP_SOCKS,
  CAMPP_SPAWN
} from "../maps/campProperMap";
import { CAMP_RETURN_SPAWN } from "../maps/minersCampMap";
import { NOOK_SPAWN } from "../maps/laundryNookMap";
import { GALLERY_SPAWN } from "../maps/campGalleryMap";
import { DESCENT_SPAWN } from "../maps/groveDescentMap";
import { campProperEntryScript } from "../../core/scripts/campProperEntry";
import { crateChaseScript } from "../../core/scripts/crateChase";
import { minersFavorScript } from "../../core/scripts/minersFavor";
import { minersRewardScript } from "../../core/scripts/minersReward";
import { minersReekScript } from "../../core/scripts/minersReek";
import { act4EndingScript } from "../../core/scripts/act4Ending";
import { campRestScript } from "../../core/scripts/restPoints";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";
import { ENCOUNTERS, reekAdjusted, type EncounterTable } from "../../core/encounters";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE } from "../../shared/palette";

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
        { speaker: "Edda", text: "Off the line, by the west wall. Take them." }
      ]
    }
  ]
};

const gotSocksScript: DialogueScript = {
  start: "have",
  nodes: [{ id: "have", lines: [{ speaker: "", text: "You already have the stinky socks." }] }]
};

const needClearScript: DialogueScript = {
  start: "need",
  nodes: [{ id: "need", lines: [{ speaker: "", text: "Clear the mites from the nook first." }] }]
};

export class CampProperScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("campProper");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "campProper",
      zoneName: "The Miners' Camp",
      map: buildCampProperMap(),
      defaultSpawn: CAMPP_SPAWN,
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
    this.slither = new SlitherFollower(this);

    // Epilogue: once Act 4 is done the camp hands off into Act 5 (a real zone
    // exit, not an end card — the Act 3 → 4 pattern). A reload that somehow
    // lands back here after the hand-off re-arms it rather than soft-locking.
    if (getState(this).flags.act4Complete) {
      this.inputLocked = true;
      this.enterAct5();
      return;
    }

    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...CAMPP_EXIT_NORTH }, "minersCamp", CAMP_RETURN_SPAWN);
    this.addExit({ ...CAMPP_EXIT_WEST }, "laundryNook", NOOK_SPAWN);
    this.addExit({ ...CAMPP_EXIT_EAST }, "campGallery", GALLERY_SPAWN);

    // Rest point (the camp stove): a free, reusable full heal by the hearth.
    this.addInteractPoint(CAMPP_HEARTH.x, CAMPP_HEARTH.y, () => this.restHere(campRestScript));

    // Arrival orientation, plays once.
    if (!getState(this).flags.sawCamp) {
      this.addTrigger({ ...CAMPP_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawCamp) return;
        this.openScript(campProperEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawCamp: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeMiners();
    this.placeCrateChase();
    this.placeSocks();
  }

  // --- The three miners (favor-quest + the "reeks" reaction) ---

  private placeMiners(): void {
    for (const spot of [CAMPP_MO, CAMPP_EDDA, CAMPP_GUS]) {
      this.addNpc({ sheet: "miner", tileX: spot.x, tileY: spot.y, script: () => this.minerScript() });
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
    this.addTrigger({ ...CAMPP_CRATE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.sawCrateChase) return;
      // Piggy waddles to the crate stack, burrows in, pops out the far side.
      const piggy = this.add
        .sprite(CAMPP_CRATE_TRIGGER.x2 * TILE, CAMPP_CRATE_TRIGGER.y1 * TILE, "piggy", 0)
        .setDepth(9999);
      piggy.play("piggy-walk");
      this.tweens.chain({
        targets: piggy,
        tweens: [
          { x: CAMPP_CRATE_STACK.x * TILE, y: CAMPP_CRATE_STACK.y * TILE + TILE, duration: 900 },
          { alpha: 0, duration: 150 }, // burrows in
          { x: (CAMPP_CRATE_STACK.x + 2) * TILE, y: (CAMPP_CRATE_STACK.y + 3) * TILE, alpha: 0, duration: 10 },
          { alpha: 1, duration: 150 }, // pops out the far side
          { x: (CAMPP_CRATE_STACK.x + 1) * TILE, y: (CAMPP_CRATE_STACK.y + 5) * TILE, duration: 700 },
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

  // --- The sock line (the reward, then the ending) ---

  private placeSocks(): void {
    this.addInteractPoint(CAMPP_SOCKS.x, CAMPP_SOCKS.y, () => {
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

  // --- Act 4 ending → Act 5 hand-off ---

  private runEnding(): void {
    // Unlock so the ending box can be advanced (movement stays blocked while
    // the dialogue is open); relock before the hand-off. Same pattern as the
    // Act 1/2/3 endings — a locked scene never forwards confirm to the box.
    this.inputLocked = false;
    this.openScript(act4EndingScript, () => {
      this.inputLocked = true;
      this.enterAct5();
    });
  }

  /**
   * Descend into Act 5 (The Sunlit Cave-In), keeping progress — the real
   * hand-off that replaces the old "coming soon" title card, mirroring the
   * Act 2 → 3 and Act 3 → 4 hand-offs. Sets `act4Complete` (record) and
   * `act5Started`, then drops the party into the grove's entry zone.
   */
  private enterAct5(): void {
    const s = getState(this);
    setState(this, { ...s, flags: { ...s.flags, act4Complete: true, act5Started: true } });
    this.goToZone("groveDescent", DESCENT_SPAWN);
  }

  protected onUpdate(): void {
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
