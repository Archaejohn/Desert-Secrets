/**
 * Act 2, Zone 1 — The Crevasse. The descent from the Depths: an entry
 * room with three ways out (a loop, Mo's dead-end pocket, and the true
 * path to the maze) and a camp corner where every rescued miner ends up.
 * No random encounters; the radio is dead down here.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildCrevasseMap,
  CREVASSE_CAMP,
  CREVASSE_MO,
  CREVASSE_SOUTH_EXIT,
  CREVASSE_SPAWN
} from "../maps/crevasseMap";
import { MAZE_SPAWN } from "../maps/mazeMap";
import { minerMoScript } from "../../core/scripts/minerMo";
import {
  MINERS_HAT_PRICE,
  PICKAXE_PRICE,
  gusShopScript,
  moShopScript,
  shopScriptFor
} from "../../core/scripts/minerShop";
import { getState, setState } from "../state";
import {
  awardXp,
  canBuyEquip,
  grantEquipment,
  spendShinies
} from "../../core/gameState";
import type { EquipId } from "../../core/equipment";
import type { DialogueScript } from "../../core/dialogue";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

/**
 * Camp chatter once a miner has been rescued. Mo and Gus double as shops (see
 * scripts/minerShop.ts) — those live scripts are built per-open in the scene so
 * the "Buy" choice can be gated on shinies/ownership. Edda just chats.
 */
const eddaCampScript: DialogueScript = {
  start: "camp",
  nodes: [
    {
      id: "camp",
      lines: [{ speaker: "Edda", text: "Two true roads through that ice. Told you." }]
    }
  ]
};

export class CrevasseScene extends ZoneScene {
  private lightMask: LightMask | null = null;

  constructor() {
    super("crevasse");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "crevasse",
      zoneName: "The Crevasse",
      map: buildCrevasseMap(),
      defaultSpawn: CREVASSE_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.addExit({ ...CREVASSE_SOUTH_EXIT }, "maze", MAZE_SPAWN);
    this.placeMo();

    // Rescued elsewhere, gathered here: Edda (maze) and Gus (galleries).
    const flags = getState(this).flags;
    if (flags.minerEdda) this.addCampMiner(CREVASSE_CAMP.edda, () => eddaCampScript);
    if (flags.minerGus) {
      // Gus sells the pickaxe. "Buy" is offered only when affordable & unowned.
      const gus = this.addCampMiner(
        CREVASSE_CAMP.gus,
        () => {
          const s = getState(this);
          return shopScriptFor(gusShopScript, canBuyEquip(s, PICKAXE_PRICE, "pickaxe"));
        },
        (endNodeId) => this.tryBuy(endNodeId, gus, PICKAXE_PRICE, "pickaxe")
      );
    }

    this.setupIceLighting();
  }

  /**
   * The ice-cave lighting: a cool ambient dark the party's lamp reveals,
   * warm flickering amber on the lantern posts (as Mo says, "trust the amber
   * lanterns"), and a cold blue pulse off the ice crystals so the ice reads
   * as putting off its own light.
   */
  private setupIceLighting(): void {
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.58 },
      follow: this.player,
      followRadius: 100,
      followIntensity: 0.8,
      amber: this.tileCentersNamed("lanternPost"),
      amberIntensity: 0.6,
      blue: [
        ...this.tileCentersNamed("crystalBig"),
        ...this.tileCentersNamed("crystalSmall").map((p) => ({ ...p, radius: 30 }))
      ],
      blueIntensity: 0.6
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
  }

  /** Mo: in the dead-end pocket until rescued, at the camp afterwards. */
  private placeMo(): void {
    const rescued = getState(this).flags.minerMo;
    const spot = rescued ? CREVASSE_CAMP.mo : CREVASSE_MO;
    const mo = this.addNpc({
      sheet: "miner",
      tileX: spot.x,
      tileY: spot.y,
      // Before rescue: the plea. After: Mo's shop (sells the miner's hat).
      script: () => {
        const s = getState(this);
        if (!s.flags.minerMo) return minerMoScript;
        return shopScriptFor(moShopScript, canBuyEquip(s, MINERS_HAT_PRICE, "minersHat"));
      },
      onClose: (endNodeId) => {
        const s = getState(this);
        if (s.flags.minerMo) {
          this.tryBuy(endNodeId, mo, MINERS_HAT_PRICE, "minersHat");
          return;
        }
        const { state } = awardXp(s, 30);
        setState(this, { ...state, flags: { ...state.flags, minerMo: true } });
        this.floatText(mo.x, mo.y - 12, "+30 XP");
        this.hud.update(getState(this));
        this.walkToCamp(mo);
      }
    });
  }

  /**
   * Complete a camp purchase: on the `buy-end` node, if the buy is still valid
   * (affordable and unowned), spend the shinies and grant the item. Idempotent
   * and defensive — a stale script can't double-charge or grant for free.
   */
  private tryBuy(
    endNodeId: string | null,
    sprite: Phaser.Physics.Arcade.Sprite,
    price: number,
    id: EquipId
  ): void {
    if (endNodeId !== "buy-end") return;
    const s = getState(this);
    if (!canBuyEquip(s, price, id)) return;
    // Buying adds one copy to the shared pool; the player equips it from the
    // Equipment tab (shops don't auto-equip).
    setState(this, grantEquipment(spendShinies(s, price), id));
    this.floatText(sprite.x, sprite.y - 12, `-${price} shinies`);
    this.hud.update(getState(this));
  }

  /** Mo picks his way out of the pocket and settles at the camp corner. */
  private walkToCamp(mo: Phaser.Physics.Arcade.Sprite): void {
    const body = mo.body as Phaser.Physics.Arcade.Body;
    body.enable = false; // ghost through the player while he walks
    mo.play("miner-walk-right", true);
    this.tweens.chain({
      targets: mo,
      tweens: [
        { x: 5 * TILE + TILE / 2, y: 4 * TILE + TILE / 2, duration: 1100 },
        {
          x: CREVASSE_CAMP.mo.x * TILE + TILE / 2,
          y: CREVASSE_CAMP.mo.y * TILE + TILE / 2,
          duration: 900,
          onStart: () => mo.play("miner-walk-up", true)
        }
      ],
      onComplete: () => {
        mo.play("miner-idle-down", true);
        body.enable = true;
      }
    });
  }

  private addCampMiner(
    spot: { x: number; y: number },
    script: () => DialogueScript,
    onClose?: (endNodeId: string | null) => void
  ): Phaser.Physics.Arcade.Sprite {
    return this.addNpc({
      sheet: "miner",
      tileX: spot.x,
      tileY: spot.y,
      script,
      onClose
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
