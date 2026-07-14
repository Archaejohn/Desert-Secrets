/**
 * Act 2, Zone 2 — The Ice Maze. Rooms and single-width corridors, lantern
 * posts at the true junctions, and three false leads that pay off: the
 * shard cache (full heal), Edda, and a frost-scarab ambush guarding a
 * second shard. Slither peeks from a rime-sealed crack on the shortcut
 * route and opens it from the other side. Two exits lead to the
 * galleries on different edges; the north stub climbs back to the
 * crevasse. Random encounters: frost scarabs and ice bats.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildMazeMap,
  MAZE_AMBUSH_RECT,
  MAZE_AMBUSH_SHARD,
  MAZE_DOOR,
  MAZE_DOOR_TRIGGER,
  MAZE_EDDA,
  MAZE_EXIT_EAST,
  MAZE_EXIT_NORTH,
  MAZE_EXIT_SOUTH,
  MAZE_SHARD,
  MAZE_SPAWN
} from "../maps/mazeMap";
import { CREVASSE_MAZE_RETURN_SPAWN } from "../maps/crevasseMap";
import { GALLERIES_SPAWN_NORTH, GALLERIES_SPAWN_WEST } from "../maps/galleriesMap";
import { minerEddaScript } from "../../core/scripts/minerEdda";
import { slitherMeetScript } from "../../core/scripts/slitherMeet";
import { getState, setState } from "../state";
import { awardXp, heroStats } from "../../core/gameState";
import { PALETTE } from "../../shared/palette";

export class MazeScene extends ZoneScene {
  private slitherPeek: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super("maze");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "maze",
      zoneName: "The Ice Maze",
      map: buildMazeMap(),
      defaultSpawn: MAZE_SPAWN,
      // ENCOUNTERS has a "maze" table; ZoneConfig's literal union predates Act 2.
      encounterZone: "maze",
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slitherPeek = null;
    this.addExit({ ...MAZE_EXIT_NORTH }, "crevasse", CREVASSE_MAZE_RETURN_SPAWN);
    this.addExit({ ...MAZE_EXIT_EAST }, "galleries", GALLERIES_SPAWN_WEST);
    this.addExit({ ...MAZE_EXIT_SOUTH }, "galleries", GALLERIES_SPAWN_NORTH);

    this.placeShardCache();
    this.placeEdda();
    this.placeAmbush();
    this.placeRimeCrack();
  }

  /** False lead 1: the shard cache — full heal + a little XP, once. */
  private placeShardCache(): void {
    if (getState(this).flags.shard1) return;
    const prop = this.addProp("shard", MAZE_SHARD.x, MAZE_SHARD.y);
    this.addTrigger({ x1: MAZE_SHARD.x, y1: MAZE_SHARD.y, x2: MAZE_SHARD.x, y2: MAZE_SHARD.y }, () => {
      prop.destroy();
      this.takeShard("shard1");
    });
  }

  /** False lead 2: Edda, walled into her pocket until rescued. */
  private placeEdda(): void {
    if (getState(this).flags.minerEdda) return; // she's at the crevasse camp
    const edda = this.addNpc({
      sheet: "miner",
      tileX: MAZE_EDDA.x,
      tileY: MAZE_EDDA.y,
      script: () => (getState(this).flags.minerEdda ? null : minerEddaScript),
      onClose: () => {
        const s = getState(this);
        if (s.flags.minerEdda) return;
        const { state } = awardXp(s, 30);
        setState(this, { ...state, flags: { ...state.flags, minerEdda: true } });
        this.floatText(edda.x, edda.y - 12, "+30 XP");
        this.hud.update(getState(this));
        // She makes for the camp (reappears in the crevasse).
        edda.play("miner-walk-up", true);
        this.tweens.add({
          targets: edda,
          alpha: 0,
          y: edda.y - 10,
          duration: 700,
          onComplete: () => edda.disableBody(true, true)
        });
      }
    });
  }

  /** False lead 3: the ambush pocket — forced battle, then the second shard. */
  private placeAmbush(): void {
    const flags = getState(this).flags;
    if (!flags.shard2) {
      this.addTrigger({ ...MAZE_AMBUSH_RECT }, () => {
        this.floatText(this.player.x, this.player.y - 14, "AMBUSH!");
        this.startBattle(["frostscarab", "frostscarab"], { victoryFlag: "shard2" });
      });
      return;
    }
    if (flags.shard2Taken) return;
    const prop = this.addProp("shard", MAZE_AMBUSH_SHARD.x, MAZE_AMBUSH_SHARD.y);
    this.addTrigger(
      { x1: MAZE_AMBUSH_SHARD.x, y1: MAZE_AMBUSH_SHARD.y, x2: MAZE_AMBUSH_SHARD.x, y2: MAZE_AMBUSH_SHARD.y },
      () => {
        prop.destroy();
        this.takeShard("shard2Taken");
      }
    );
  }

  /** The rime-sealed crack: Slither peeks out, then opens it from inside. */
  private placeRimeCrack(): void {
    if (getState(this).flags.mazeShortcutOpen) {
      this.openCrack();
    } else {
      this.slitherPeek = this.add
        .sprite(MAZE_DOOR.x * TILE + TILE / 2, MAZE_DOOR.y * TILE + TILE / 2 + 3, "slither", 0)
        .setDepth(MAZE_DOOR.y * TILE + TILE / 2 + 3);
      this.slitherPeek.play("slither-idle");
    }
    this.addTrigger(
      { ...MAZE_DOOR_TRIGGER },
      () => {
        if (getState(this).flags.metSlither) return;
        this.openScript(slitherMeetScript, (endNodeId) => {
          if (endNodeId !== "scout-end") return;
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, metSlither: true, mazeShortcutOpen: true } });
          this.cameras.main.shake(220, 0.003);
          this.openCrack();
          this.slitherPeek?.destroy();
          this.slitherPeek = null;
          this.hud.update(getState(this));
        });
      },
      false
    );
  }

  private openCrack(): void {
    this.decorLayer.putTileAt(this.tileGid("doorOpen"), MAZE_DOOR.x, MAZE_DOOR.y);
  }

  /** Shard pickup: +10 XP and a full heal (award XP first — level-ups heal too). */
  private takeShard(flag: string): void {
    const { state } = awardXp(getState(this), 10);
    const healed = { ...state, hp: heroStats(state).maxHp, flags: { ...state.flags, [flag]: true } };
    setState(this, healed);
    this.floatText(this.player.x, this.player.y - 14, "+10 XP");
    this.floatText(this.player.x, this.player.y - 4, "HP restored!");
    this.hud.update(getState(this));
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
