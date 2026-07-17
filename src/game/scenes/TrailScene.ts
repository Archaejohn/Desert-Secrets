/**
 * Zone 3 — The Piggy Trail (Act 1, Beat 3). Random encounters over three
 * sub-areas: the dry lakebed, the Joshua grove (where the jackrabbit
 * holds an ice chip — fight it or trade the cold pack), and Last Chance
 * Fuel, where Dusty points the way to Cinnabar Mine. Three ice-chip
 * collectibles; the northeast mine exit stays grated until Dusty talks.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildTrailMap,
  TRAIL_CHIPS,
  TRAIL_DUSTY,
  TRAIL_MINE_EXIT,
  TRAIL_RABBIT,
  TRAIL_SPAWN,
  TRAIL_WEST_EXIT
} from "../maps/trailMap";
import { OASIS_EAST_SPAWN } from "../maps/oasisMap";
import { MINE_SPAWN } from "../maps/mineMap";
import { rabbitChoiceScript } from "../../core/scripts/rabbitChoice";
import { dustyTradeScript } from "../../core/scripts/dustyTrade";
import { radioLines } from "../../core/scripts/radio";
import { getState, setState } from "../state";
import { awardXp, spendShiny } from "../../core/gameState";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE } from "../../shared/palette";

/** Connective tissue: the mine entrance before Dusty opens it up. */
const grateScript: DialogueScript = {
  start: "grate",
  nodes: [{ id: "grate", lines: [{ speaker: "", text: "An iron grate seals the mine." }] }]
};

const CHIP_FLAGS = ["chip1", "chip2", "chip3"] as const;

export class TrailScene extends ZoneScene {
  constructor() {
    super("trail");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "trail",
      zoneName: "The Piggy Trail",
      map: buildTrailMap(),
      defaultSpawn: TRAIL_SPAWN,
      encounterZone: "trail",
      battleBg: "desert"
    };
  }

  protected populate(): void {
    // Rosa's radio check-in, first entry only.
    const entryState = getState(this);
    if (!entryState.flags.radioTrail) {
      setState(this, { ...entryState, flags: { ...entryState.flags, radioTrail: true } });
      this.openScript(radioLines.trail);
    }

    this.addExit({ ...TRAIL_WEST_EXIT }, "oasis", OASIS_EAST_SPAWN);

    // Northeast exit to the mine — grated until Dusty opens it.
    this.addTrigger(
      { ...TRAIL_MINE_EXIT },
      () => {
        if (getState(this).flags.mineOpen) {
          this.goToZone("mine", MINE_SPAWN);
        } else {
          this.player.setPosition(this.player.x, this.player.y + TILE);
          this.openScript(grateScript);
        }
      },
      false
    );

    this.placeChips();
    this.placeRabbit();
    this.placeDusty();
  }

  private placeChips(): void {
    const flags = getState(this).flags;
    TRAIL_CHIPS.forEach((tile, i) => {
      const flag = CHIP_FLAGS[i];
      if (flags[flag]) return;
      const prop = this.addProp("iceChip", tile.x, tile.y);
      this.addTrigger({ x1: tile.x, y1: tile.y, x2: tile.x, y2: tile.y }, () => {
        prop.destroy();
        const { state } = awardXp(getState(this), 5);
        setState(this, { ...state, flags: { ...state.flags, [flag]: true } });
        this.floatText(tile.x * TILE + TILE / 2, tile.y * TILE, "+5 XP");
      });
    });
  }

  private placeRabbit(): void {
    if (getState(this).flags.rabbitResolved) return;
    const rabbit = this.addNpc({
      sheet: "jackrabbit",
      tileX: TRAIL_RABBIT.x,
      tileY: TRAIL_RABBIT.y,
      wander: true,
      script: () => {
        const s = getState(this);
        if (s.flags.rabbitResolved) return null;
        if (s.items.coldPack) return rabbitChoiceScript;
        // No cold pack, no trade: strip that choice from a copy.
        const stripped = structuredClone(rabbitChoiceScript);
        const decide = stripped.nodes.find((n) => n.id === "decide")!;
        decide.choices = decide.choices!.filter((c) => c.next !== "trade-end");
        return stripped;
      },
      onClose: (endNodeId) => {
        if (endNodeId === "fight-end") {
          this.startBattle(["jackrabbit"], { victoryFlag: "rabbitResolved" });
        } else if (endNodeId === "trade-end") {
          const { state } = awardXp(getState(this), 12);
          setState(this, {
            ...state,
            items: { ...state.items, coldPack: false },
            flags: { ...state.flags, rabbitResolved: true, rabbitTradedColdPack: true }
          });
          this.floatText(rabbit.x, rabbit.y - 8, "+12 XP");
          rabbit.disableBody(true, true); // it bolts with its prize
        }
      }
    });
  }

  private placeDusty(): void {
    this.addNpc({
      sheet: "dusty", // the giant pack rat of Last Chance Fuel
      tileX: TRAIL_DUSTY.x,
      tileY: TRAIL_DUSTY.y,
      // "Pay a shiny" shows only while it still buys something new: you hold a
      // shiny AND the mine isn't open yet. With no shiny — or once you've
      // already been (mineOpen) — the hub shows only "Not right now" (Dusty
      // still points the way on close, as he always has), so a returning
      // player with fresh drop-shinies can't re-pay for facts he already has.
      // Same copy-and-strip pattern as the jackrabbit's cold-pack trade.
      script: () => {
        const st = getState(this);
        if (st.items.shinies > 0 && !st.flags.mineOpen) return dustyTradeScript;
        const stripped = structuredClone(dustyTradeScript);
        const hub = stripped.nodes.find((n) => n.id === "hub")!;
        hub.choices = hub.choices!.filter((c) => c.next !== "truth");
        return stripped;
      },
      onClose: (endNodeId) => {
        let s = getState(this);
        if (endNodeId === "truth-end" && s.items.shinies > 0) {
          s = spendShiny(s);
          this.floatText(TRAIL_DUSTY.x * TILE + TILE / 2, TRAIL_DUSTY.y * TILE, "-1 shiny");
        }
        setState(this, { ...s, flags: { ...s.flags, metDusty: true, mineOpen: true } });
      }
    });
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
