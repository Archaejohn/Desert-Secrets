/**
 * Zone 2 — The Homestead (Act 1, Beat 2). Joseph's family lives by the
 * spring: John and Pamela wander near the pond, and — the first time you
 * close their dialogue — the tutorial scarab battle begins. A flavor
 * scarab patrols the flats until beaten once (custom "oasisScarab"
 * flag). Frost sand near the east exit points toward the Piggy Trail.
 *
 * A small fenced coop holds an optional, never-required side quest:
 * feed and water the chickens for a one-time XP bonus. It's a three-step
 * fetch: grab an empty bucket from the shed (south exit), fill it at the
 * spring, deliver it to the coop.
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
  OASIS_SOUTH_EXIT,
  OASIS_SPAWN,
  OASIS_SPRING_FILL,
  OASIS_WEST_EXIT
} from "../maps/oasisMap";
import { CRASH_EAST_SPAWN } from "../maps/crashMap";
import { TRAIL_SPAWN } from "../maps/trailMap";
import { SHED_SPAWN } from "../maps/shedMap";
import { homeAct1Script } from "../../core/scripts/homeAct1";
import { awardXp } from "../../core/gameState";
import { getState, setState } from "../state";
import { PALETTE } from "../../shared/palette";
import type { DialogueScript } from "../../core/dialogue";

const SCARAB_SPEED = 24;
const SCARAB_LEASH_PX = 56;
const CHORE_XP = 10;

function hint(text: string): DialogueScript {
  return { start: "hint", nodes: [{ id: "hint", lines: [{ speaker: "", text }] }] };
}
const NO_BUCKET_HINT = hint("Trough's dry. Got a bucket?");
const EMPTY_BUCKET_HINT = hint("Bucket's empty. Try the spring.");

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
    this.addExit({ ...OASIS_SOUTH_EXIT }, "shed", SHED_SPAWN);

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
    this.placeSpring();

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
        const bucket = getState(this).items.bucket;
        // Repeatable trigger: nudge the player off the tile every time it
        // fires, success or not, so standing still can't re-fire it next
        // frame (it would otherwise see the just-updated state and react
        // to the WRONG branch — e.g. re-reading "bucket: none" right after
        // spending a filled one and popping a stale "no bucket" hint).
        this.player.setPosition(this.player.x, this.player.y + TILE);
        if (bucket === "filled") {
          const { state } = awardXp(getState(this), CHORE_XP);
          setState(this, {
            ...state,
            items: { ...state.items, bucket: "none" },
            flags: { ...state.flags, choresDone: true }
          });
          this.floatText(OASIS_COOP.x * TILE + TILE / 2, OASIS_COOP.y * TILE, `+${CHORE_XP} XP`);
        } else {
          this.openScript(bucket === "empty" ? EMPTY_BUCKET_HINT : NO_BUCKET_HINT);
        }
      },
      false
    );
  }

  /** Fills an empty bucket at the spring's edge. Repeatable; no-op otherwise. */
  private placeSpring(): void {
    this.addTrigger(
      { x1: OASIS_SPRING_FILL.x, y1: OASIS_SPRING_FILL.y, x2: OASIS_SPRING_FILL.x, y2: OASIS_SPRING_FILL.y },
      () => {
        const s = getState(this);
        if (s.items.bucket !== "empty") return;
        setState(this, { ...s, items: { ...s.items, bucket: "filled" } });
        this.floatText(OASIS_SPRING_FILL.x * TILE + TILE / 2, OASIS_SPRING_FILL.y * TILE, "Bucket filled!");
      },
      false
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
