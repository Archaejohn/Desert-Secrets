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
  OASIS_NORTH_EXIT,
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
import { OVERWORLD_SOUTH_SPAWN } from "../maps/overworldMap";
import { johnAct1Script, pamelaAct1Script } from "../../core/scripts/homeAct1";
import { awardXp, equippedSlotsFor, grantShiny } from "../../core/gameState";
import { getState, setState } from "../state";
import { PALETTE } from "../../shared/palette";
import type { DialogueScript } from "../../core/dialogue";

const SCARAB_SPEED = 24;
const SCARAB_LEASH_PX = 56;
const CHORE_XP = 10;

function hint(text: string): DialogueScript {
  return { start: "hint", nodes: [{ id: "hint", lines: [{ speaker: "", text }] }] };
}
const NEED_BUCKET_HINT = hint("Trough's dry. Bucket's in the shed.");
const NOT_EQUIPPED_HINT = hint("Wear the bucket first — Equipment tab (I).");
const EMPTY_BUCKET_HINT = hint("Bucket's empty. Try the spigot.");
const CHORES_DONE_HINT = hint("The chickens are fed. Thanks, Joseph.");
const SPIGOT_NEED_BUCKET_HINT = hint("Wear the bucket first — Equipment tab (I).");
const SPIGOT_ALREADY_FULL_HINT = hint("Already full.");

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
    this.addExit({ ...OASIS_NORTH_EXIT }, "overworld", OVERWORLD_SOUTH_SPAWN);

    const onCloseParent = (): void => {
      const s = getState(this);
      const firstTime = !s.flags.tutorialBattleWon;
      setState(this, { ...s, flags: { ...s.flags, metParents: true } });
      if (firstTime) {
        this.startBattle(["scarab"], { victoryFlag: "tutorialBattleWon" });
      }
    };

    // Pamela's close does the shared parent beat AND, the first time only,
    // hands Joseph his first shiny (her chores/coop lane — see homeAct1.ts).
    // The grant is guarded by the pamelaShiny flag so it happens exactly once,
    // and runs before onCloseParent so it isn't clobbered by the tutorial
    // battle's own state writes.
    const onClosePamela = (): void => {
      const s = getState(this);
      if (!s.flags.pamelaShiny) {
        const granted = grantShiny(s);
        setState(this, { ...granted, flags: { ...granted.flags, pamelaShiny: true } });
        this.floatText(OASIS_PAMELA.x * TILE + TILE / 2, OASIS_PAMELA.y * TILE, "Got a shiny!");
      }
      onCloseParent();
    };

    // John and Pamela are two separate NPCs with two separate voices (John:
    // scarabs/sightings + the radio & Thomas; Pamela: chickens/chores + the
    // first shiny). Both closes run the shared parent beat, so closing EITHER
    // the first time starts the tutorial battle. John is npcs[0] (the smoke
    // tests talk to him first).
    this.addNpc({
      sheet: "john",
      tileX: OASIS_PARENTS.x,
      tileY: OASIS_PARENTS.y,
      wander: true,
      script: () => johnAct1Script,
      onClose: onCloseParent
    });
    this.addNpc({
      sheet: "pamela",
      tileX: OASIS_PAMELA.x,
      tileY: OASIS_PAMELA.y,
      wander: true,
      script: () => pamelaAct1Script,
      onClose: onClosePamela
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
    // Press-E interaction: fires only on an explicit key/tap press, never
    // by just standing on the tile, so it can't refire on the frame right
    // after a successful delivery resets the bucket state.
    this.addInteractPoint(OASIS_COOP.x, OASIS_COOP.y, () => {
      const s = getState(this);
      if (s.flags.choresDone) {
        this.openScript(CHORES_DONE_HINT);
        return;
      }
      if (equippedSlotsFor(s, "hero").hat !== "bucket") {
        this.openScript(s.items.bucket === "none" ? NEED_BUCKET_HINT : NOT_EQUIPPED_HINT);
        return;
      }
      if (s.items.bucket !== "filled") {
        this.openScript(EMPTY_BUCKET_HINT);
        return;
      }
      const { state } = awardXp(s, CHORE_XP);
      // The bucket is a tool AND wearable headgear (see core/equipment.ts).
      // Delivering pours the water into the trough — the pail goes empty —
      // but Joseph KEEPS it and it stays equipped, so the +2 DEF / -1 SPD
      // headgear buff persists after the chore. Don't clear bucket/equipped.
      setState(this, {
        ...state,
        items: { ...state.items, bucket: "empty" },
        flags: { ...state.flags, choresDone: true }
      });
      this.floatText(OASIS_COOP.x * TILE + TILE / 2, OASIS_COOP.y * TILE, `+${CHORE_XP} XP`);
    });
  }

  /** A visible spigot marks the fill spot; press E to fill an equipped, empty bucket. */
  private placeSpring(): void {
    const spigot = this.add.sprite(
      OASIS_SPRING_FILL.x * TILE + TILE / 2,
      OASIS_SPRING_FILL.y * TILE + TILE / 2,
      "spigot",
      0
    );
    spigot.setDepth(spigot.y);

    this.addInteractPoint(OASIS_SPRING_FILL.x, OASIS_SPRING_FILL.y, () => {
      const s = getState(this);
      if (equippedSlotsFor(s, "hero").hat !== "bucket") {
        this.openScript(SPIGOT_NEED_BUCKET_HINT);
        return;
      }
      if (s.items.bucket === "filled") {
        this.openScript(SPIGOT_ALREADY_FULL_HINT);
        return;
      }
      setState(this, { ...s, items: { ...s.items, bucket: "filled" } });
      this.floatText(OASIS_SPRING_FILL.x * TILE + TILE / 2, OASIS_SPRING_FILL.y * TILE, "Bucket filled!");
    });
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
