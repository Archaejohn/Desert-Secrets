/**
 * Zone 2 — The Homestead (Act 1, Beat 2). Joseph's family lives by the
 * spring: John and Pamela wander near the pond, and — the first time you
 * close their dialogue — the tutorial scarab battle begins. A flavor
 * scarab patrols the flats until beaten once (custom "oasisScarab"
 * flag). Frost sand near the east exit points toward the Piggy Trail.
 * A small fenced coop holds an optional, never-required side quest:
 * walk in to feed and water the chickens for a one-time XP bonus.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildOasisMap,
  OASIS_COOP,
  OASIS_COOP_PEN,
  OASIS_EAST_EXIT,
  OASIS_PAMELA,
  OASIS_PARENTS,
  OASIS_SCARAB,
  OASIS_SPAWN,
  OASIS_WEST_EXIT
} from "../maps/oasisMap";
import { CRASH_EAST_SPAWN } from "../maps/crashMap";
import { TRAIL_SPAWN } from "../maps/trailMap";
import { homeAct1Script } from "../../core/scripts/homeAct1";
import { awardXp } from "../../core/gameState";
import { getState, setState } from "../state";
import { PALETTE } from "../../shared/palette";

const SCARAB_SPEED = 24;
const SCARAB_LEASH_PX = 56;
const CHORE_XP = 10;

export class OasisScene extends ZoneScene {
  private scarab: Phaser.Physics.Arcade.Sprite | null = null;

  constructor() {
    super("oasis");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "oasis",
      zoneName: "The Homestead",
      map: buildOasisMap(),
      defaultSpawn: OASIS_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.scarab = null;
    this.animateTilePair("water", "water2");

    this.addExit({ ...OASIS_WEST_EXIT }, "crash", CRASH_EAST_SPAWN);
    this.addExit({ ...OASIS_EAST_EXIT }, "trail", TRAIL_SPAWN);

    const onCloseParent = (): void => {
      const s = getState(this);
      const firstTime = !s.flags.tutorialBattleWon;
      setState(this, { ...s, flags: { ...s.flags, metParents: true } });
      if (firstTime) {
        this.startBattle(["scarab"], { victoryFlag: "tutorialBattleWon" });
      }
    };

    this.addNpc({
      sheet: "john",
      tileX: OASIS_PARENTS.x,
      tileY: OASIS_PARENTS.y,
      wander: true,
      script: () => homeAct1Script,
      onClose: onCloseParent
    });
    this.addNpc({
      sheet: "pamela",
      tileX: OASIS_PAMELA.x,
      tileY: OASIS_PAMELA.y,
      wander: true,
      script: () => homeAct1Script,
      onClose: onCloseParent
    });

    this.placeCoop();

    // Ambient patrolling scarab — gone for good once beaten.
    if (!getState(this).flags.oasisScarab) {
      const scarab = this.physics.add.sprite(
        OASIS_SCARAB.x * TILE + TILE / 2,
        OASIS_SCARAB.y * TILE + TILE / 2,
        "scarab",
        0
      );
      scarab.play("scarab-move");
      scarab.setVelocityX(SCARAB_SPEED);
      this.physics.add.collider(scarab, this.groundLayer, () => this.turnScarab());
      this.physics.add.collider(scarab, this.decorLayer, () => this.turnScarab());
      this.physics.add.overlap(this.player, scarab, () => {
        if (this.dialogue.isOpen || this.inputLocked) return;
        this.startBattle(["scarab"], { victoryFlag: "oasisScarab" });
      });
      this.scarab = scarab;
    }
  }

  private placeCoop(): void {
    // A couple of hens for visual life — purely decorative.
    for (const [dx, dy] of [
      [1, 1],
      [2, 1]
    ] as const) {
      const hen = this.add.sprite(
        (OASIS_COOP_PEN.x1 + dx) * TILE + TILE / 2,
        (OASIS_COOP_PEN.y1 + dy) * TILE + TILE / 2,
        "chicken",
        0
      );
      hen.play("chicken-idle");
      hen.setDepth(hen.y);
    }

    if (getState(this).flags.choresDone) return;
    this.addTrigger(
      { x1: OASIS_COOP.x, y1: OASIS_COOP.y, x2: OASIS_COOP.x, y2: OASIS_COOP.y },
      () => {
        const { state } = awardXp(getState(this), CHORE_XP);
        setState(this, { ...state, flags: { ...state.flags, choresDone: true } });
        this.floatText(OASIS_COOP.x * TILE + TILE / 2, OASIS_COOP.y * TILE, `+${CHORE_XP} XP`);
      }
    );
  }

  protected onUpdate(): void {
    const s = this.scarab;
    if (!s?.body) return;
    s.setDepth(s.y);
    const homeX = OASIS_SCARAB.x * TILE;
    if (s.x < homeX - SCARAB_LEASH_PX && s.body.velocity.x < 0) this.turnScarab();
    if (s.x > homeX + SCARAB_LEASH_PX && s.body.velocity.x > 0) this.turnScarab();
  }

  private turnScarab(): void {
    const s = this.scarab;
    if (!s?.body) return;
    const vx = s.body.velocity.x <= 0 ? SCARAB_SPEED : -SCARAB_SPEED;
    s.setVelocityX(vx);
    s.setFlipX(vx < 0);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
