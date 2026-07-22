/**
 * Zone 4 — Cinnabar Mine (Act 1, Beat 4). Winding brood-infested
 * corridors, a rusted lever that lifts the timber gate on the elevator
 * corridor, and the Foreman Scarab boss guarding the descent. The
 * elevator drops to the Depths once the Foreman falls.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildMineMap,
  MINE_ELEVATOR,
  MINE_FOREMAN,
  MINE_GATE_TILES,
  MINE_LEDGE_BAND,
  MINE_LEVER,
  MINE_LEVER_PLATE,
  MINE_SOUTH_EXIT,
  MINE_SPAWN,
  MINE_TORCHES
} from "../maps/mineMap";
import { TRAIL_MINE_SPAWN } from "../maps/trailMap";
import { DEPTHS_SPAWN } from "../maps/depthsMap";
import { radioLines } from "../../core/scripts/radio";
import { thomasMineScript } from "../../core/scripts/thomas";
import { getState, setState } from "../state";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";
import { PALETTE, hexToInt } from "../../shared/palette";
import type { DialogueScript } from "../../core/dialogue";
import { MINE_GROUND_TO_TERRAIN, MINE_DEFAULT_TERRAIN } from "../maps/groundTerrain";

const leverScript: DialogueScript = {
  start: "ask",
  nodes: [
    {
      id: "ask",
      lines: [{ speaker: "", text: "Pull the rusted lever?" }],
      choices: [
        { text: "Pull it", next: "yes-end" },
        { text: "Leave it", next: "no-end" }
      ]
    },
    { id: "yes-end", lines: [{ speaker: "", text: "(Gears grind. The timbers lift away.)" }] },
    { id: "no-end", lines: [{ speaker: "Joseph", text: "Better not. Yet." }] }
  ]
};

const foremanScript: DialogueScript = {
  start: "challenge",
  nodes: [
    {
      id: "challenge",
      lines: [
        { speaker: "Foreman Scarab", text: "NONE RIDE DOWN. QUEEN BROODS BELOW." },
        { speaker: "Joseph", text: "My friend's down there. Move." }
      ]
    }
  ]
};

export class MineScene extends ZoneScene {
  private lightMask: LightMask | null = null;

  constructor() {
    super("mine");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "mine",
      zoneName: "Cinnabar Mine",
      map: buildMineMap(),
      defaultSpawn: MINE_SPAWN,
      encounterZone: "mine",
      battleBg: "mine",
      compositeGround: { table: MINE_GROUND_TO_TERRAIN, fallback: MINE_DEFAULT_TERRAIN },
      walls: [{ band: { ...MINE_LEDGE_BAND }, style: "minestone", crest: "jagged", ch: 0.85, talus: 0.22, bw: 0.6 }]
    };
  }

  protected populate(): void {
    // Rosa's radio check-in, first entry only.
    const entryState = getState(this);
    if (!entryState.flags.radioMine) {
      setState(this, { ...entryState, flags: { ...entryState.flags, radioMine: true } });
      this.openScript(radioLines.mine);
    }

    this.addExit({ ...MINE_SOUTH_EXIT }, "trail", TRAIL_MINE_SPAWN);

    // Lever + gate: render the already-open state, or arm the choice.
    if (getState(this).flags.leverPulled) {
      this.openGate();
    }
    this.addTrigger(
      { x1: MINE_LEVER_PLATE.x, y1: MINE_LEVER_PLATE.y, x2: MINE_LEVER_PLATE.x, y2: MINE_LEVER_PLATE.y },
      () => {
        if (getState(this).flags.leverPulled) return;
        // Step back off the plate so closing the box doesn't re-trigger.
        this.player.setPosition(this.player.x, this.player.y + TILE);
        this.openScript(leverScript, (endNodeId) => {
          if (endNodeId !== "yes-end") return;
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, leverPulled: true } });
          this.openGate();
          this.cameras.main.shake(250, 0.004);
        });
      },
      false
    );

    // First contact with Thomas (B.2): stepping into the elevator chamber — the
    // foreman's room — a broken transmission cuts in on the radio. One-time
    // (heardThomasMine), fired on the chamber's west-edge column (x=23), one
    // tile before the foreman's challenge band (x=24-25), so the two beats never
    // stack. Joseph realizes it's Thomas; his call back gets only static.
    if (!getState(this).flags.heardThomasMine) {
      this.addTrigger(
        { x1: 23, y1: 6, x2: 23, y2: 8 },
        () => {
          if (getState(this).flags.heardThomasMine) return;
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, heardThomasMine: true } });
          this.openScript(thomasMineScript);
        },
        true // one-shot: play the transmission exactly once
      );
    }

    // The Foreman Scarab bars the elevator until defeated.
    if (!getState(this).flags.foremanDefeated) {
      const foreman = this.add
        .sprite(MINE_FOREMAN.x * TILE + TILE / 2, MINE_FOREMAN.y * TILE + TILE / 2, "foreman", 0)
        .setDepth(MINE_FOREMAN.y * TILE + TILE / 2);
      foreman.play("foreman-idle");
      this.addTrigger({ x1: MINE_FOREMAN.x, y1: 5, x2: MINE_FOREMAN.x + 1, y2: 9 }, () => {
        this.openScript(foremanScript, () => {
          this.startBattle(["foreman"], { boss: true, victoryFlag: "foremanDefeated" });
        });
      });
    }

    // The elevator floor: down to the Depths, once the way is clear.
    this.addTrigger(
      { ...MINE_ELEVATOR },
      () => {
        if (getState(this).flags.foremanDefeated) {
          // Ride the cage down rather than a bare fade (act-boundary ceremony).
          this.exitVia("elevator", "depths", DEPTHS_SPAWN);
        }
      },
      false
    );

    this.setupTorchLighting();
  }

  /**
   * Torch-lit-cave ambiance (the first shipped use of LightMask): a moderate
   * ambient darkness the player's own lamp reveals as they move, plus a warm
   * flickering glow hung on each lantern-post torch (MINE_TORCHES), each
   * pulsing slightly out of phase so they don't breathe in unison. Kept
   * navigable on purpose — the lamp is generous and the darkness partial.
   */
  private setupTorchLighting(): void {
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.5 },
      follow: this.player, // the player's lamp reveals the dark as they move
      // A warm glow on each torch (sat just above the post's base), flickering
      // subtly out of phase.
      amber: MINE_TORCHES.map((t) => ({
        x: t.x * TILE + TILE / 2,
        y: t.y * TILE + TILE / 2 - 4
      }))
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
  }

  /** Flip the lever tile and lift the three timber gate tiles. */
  private openGate(): void {
    this.decorLayer.putTileAt(this.tileGid("leverOn"), MINE_LEVER.x, MINE_LEVER.y);
    this.decorLayer.setCollision(this.tileGid("leverOn"), true, false);
    for (const g of MINE_GATE_TILES) {
      this.decorLayer.removeTileAt(g.x, g.y); // ground beneath is mineFloor
    }
  }
}
