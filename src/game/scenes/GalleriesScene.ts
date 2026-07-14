/**
 * Act 2, Zone 3 — The Galleries. Frozen-over mine workings with two ways
 * back to the maze, Gus down a dead-end side gallery (third miner — all
 * three rescued grants a bonus perk), and the rime door at the far east.
 * Slither unbolts the door from inside its workings, JOINS the party,
 * and from then on trails the player as a world follower. Random
 * encounters: ice bats and crystal crawlers.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildGalleriesMap,
  GALLERIES_DOOR_TILES,
  GALLERIES_DOOR_TRIGGER,
  GALLERIES_EXIT_EAST,
  GALLERIES_EXIT_NORTH,
  GALLERIES_EXIT_WEST,
  GALLERIES_GUS,
  GALLERIES_SPAWN_WEST
} from "../maps/galleriesMap";
import { MAZE_EAST_RETURN_SPAWN, MAZE_SOUTH_RETURN_SPAWN } from "../maps/mazeMap";
import { SANCTUM_SPAWN } from "../maps/sanctumMap";
import { minerGusScript } from "../../core/scripts/minerGus";
import { slitherDoorScript } from "../../core/scripts/slitherDoor";
import { getState, setState } from "../state";
import { awardXp } from "../../core/gameState";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE } from "../../shared/palette";

/** How many recent player positions the follower trails behind. */
const FOLLOW_FRAMES = 14;

const sealedScript: DialogueScript = {
  start: "sealed",
  nodes: [
    {
      id: "sealed",
      lines: [{ speaker: "", text: "Sealed tight. Too small a gap for you." }]
    }
  ]
};

export class GalleriesScene extends ZoneScene {
  private follower: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];

  constructor() {
    super("galleries");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "galleries",
      zoneName: "The Galleries",
      map: buildGalleriesMap(),
      defaultSpawn: GALLERIES_SPAWN_WEST,
      // ENCOUNTERS has a "galleries" table; ZoneConfig's union predates Act 2.
      encounterZone: "galleries",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.follower = null;
    this.trail = [];

    this.addExit({ ...GALLERIES_EXIT_WEST }, "maze", MAZE_EAST_RETURN_SPAWN);
    this.addExit({ ...GALLERIES_EXIT_NORTH }, "maze", MAZE_SOUTH_RETURN_SPAWN);
    this.addExit({ ...GALLERIES_EXIT_EAST }, "sanctum", SANCTUM_SPAWN);

    this.placeGus();
    this.placeRimeDoor();
    this.checkMinersBonus();

    if (getState(this).flags.slitherJoined) this.spawnFollower();
  }

  /** Gus, at the end of the side gallery until rescued. */
  private placeGus(): void {
    if (getState(this).flags.minerGus) return; // he's at the crevasse camp
    const gus = this.addNpc({
      sheet: "miner",
      tileX: GALLERIES_GUS.x,
      tileY: GALLERIES_GUS.y,
      script: () => (getState(this).flags.minerGus ? null : minerGusScript),
      onClose: () => {
        const s = getState(this);
        if (s.flags.minerGus) return;
        const { state } = awardXp(s, 30);
        setState(this, { ...state, flags: { ...state.flags, minerGus: true } });
        this.floatText(gus.x, gus.y - 12, "+30 XP");
        this.checkMinersBonus();
        this.hud.update(getState(this));
        gus.play("miner-walk-up", true);
        this.tweens.add({
          targets: gus,
          alpha: 0,
          y: gus.y - 10,
          duration: 700,
          onComplete: () => gus.disableBody(true, true)
        });
      }
    });
  }

  /** All three miners home and dry → one bonus perk, once. */
  private checkMinersBonus(): void {
    const s = getState(this);
    const f = s.flags;
    if (!f.minerMo || !f.minerEdda || !f.minerGus || f.minersBonusGiven) return;
    setState(this, {
      ...s,
      pendingPerks: s.pendingPerks + 1,
      flags: { ...f, minersBonusGiven: true }
    });
    this.floatText(this.player.x, this.player.y - 16, "MINERS RESCUED — bonus perk!");
    this.hud.update(getState(this));
  }

  /** The rime door: sealed until Slither opens it (and joins). */
  private placeRimeDoor(): void {
    if (getState(this).flags.rimeDoorOpen) this.openDoor();
    this.addTrigger(
      { ...GALLERIES_DOOR_TRIGGER },
      () => {
        const s = getState(this);
        if (s.flags.rimeDoorOpen) return;
        if (!s.flags.metSlither) {
          // Nudge back off the trigger column so closing doesn't re-fire.
          this.player.setPosition(this.player.x - TILE, this.player.y);
          this.openScript(sealedScript);
          return;
        }
        this.openScript(slitherDoorScript, (endNodeId) => {
          if (endNodeId !== "join-end") return;
          const cur = getState(this);
          setState(this, {
            ...cur,
            flags: { ...cur.flags, rimeDoorOpen: true, slitherJoined: true }
          });
          this.cameras.main.shake(260, 0.004);
          this.openDoor();
          this.spawnFollower();
          this.floatText(this.player.x, this.player.y - 16, "Slither joined the party!");
          this.hud.update(getState(this));
        });
      },
      false
    );
  }

  private openDoor(): void {
    for (const d of GALLERIES_DOOR_TILES) {
      this.decorLayer.putTileAt(this.tileGid("doorOpen"), d.x, d.y);
    }
  }

  /** Slither trails the player's recent positions (~14 frames back). */
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
    if (Math.abs(dx) > 0.5) this.follower.setFlipX(dx < 0); // sheet faces right
    this.follower.play(moving ? "slither-move" : "slither-idle", true);
    this.follower.setPosition(target.x, target.y);
    this.follower.setDepth(target.y);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
