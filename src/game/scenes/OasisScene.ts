/**
 * Zone 2 — Sahra's Oasis (Act 1, Beat 2). The ported demo valley: Sahra
 * wanders by the pond and — the first time you close her dialogue — the
 * tutorial scarab battle begins. A flavor scarab patrols the flats until
 * beaten once (custom "oasisScarab" flag). Frost sand near the east exit
 * points toward the Piggy Trail.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildOasisMap,
  OASIS_EAST_EXIT,
  OASIS_SAHRA,
  OASIS_SCARAB,
  OASIS_SPAWN,
  OASIS_WEST_EXIT
} from "../maps/oasisMap";
import { CRASH_EAST_SPAWN } from "../maps/crashMap";
import { TRAIL_SPAWN } from "../maps/trailMap";
import { sahraAct1Script } from "../../core/scripts/sahraAct1";
import { getState, setState } from "../state";

const SCARAB_SPEED = 24;
const SCARAB_LEASH_PX = 56;

export class OasisScene extends ZoneScene {
  private scarab: Phaser.Physics.Arcade.Sprite | null = null;

  constructor() {
    super("oasis");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "oasis",
      zoneName: "Sahra's Oasis",
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

    this.addNpc({
      sheet: "npc",
      animPrefix: "npc",
      tileX: OASIS_SAHRA.x,
      tileY: OASIS_SAHRA.y,
      wander: true,
      script: () => sahraAct1Script,
      onClose: () => {
        const s = getState(this);
        const firstTime = !s.flags.tutorialBattleWon;
        setState(this, { ...s, flags: { ...s.flags, metSahra: true } });
        if (firstTime) {
          this.startBattle(["scarab"], { victoryFlag: "tutorialBattleWon" });
        }
      }
    });

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
}
