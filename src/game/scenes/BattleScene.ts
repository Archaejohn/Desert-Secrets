/**
 * Active Time Battle presentation for Act 1. All rules run in the tested
 * core (atb / progression / bestiary / gameState); this scene only renders
 * gauges, menus and hit feedback, forwards player decisions, and applies
 * the victory/defeat state transitions through the core's pure functions.
 */
import Phaser from "phaser";
import {
  AtbBattle,
  chooseEnemyAction,
  type ActionId,
  type BattleEvent,
  type Side
} from "../../core/atb";
import { makeRng } from "../../core/rng";
import { BESTIARY, makeEnemyParty, xpForParty } from "../../core/bestiary";
import { commandsForLevel, levelForXp, type CommandId } from "../../core/progression";
import {
  applyBattleResult,
  awardXp,
  choosePerk,
  heroStats,
  respawn,
  type Act1State,
  type ZoneId
} from "../../core/gameState";
import { getState, setState } from "../state";
import { addFullscreenButton, inFullscreenButtonZone } from "../ui/touch";
import { PALETTE, hexToInt } from "../../shared/palette";
import { MANIFEST, tileIndex } from "../manifest";
import { PerkMenu } from "../ui/PerkMenu";

export interface BattleSceneData {
  group: string[];
  bg: "desert" | "mine" | "ice";
  boss: boolean;
  victoryFlag?: string;
  returnTo: { scene: ZoneId; x: number; y: number };
}

interface Fighter {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  homeX: number;
  homeY: number;
  barW: number;
  barY: number;
  hpBar: Phaser.GameObjects.Graphics;
  gaugeBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

type MenuMode = "hidden" | "actions" | "targets";

const HERO_ID = "hero";
/** Enemy slots by party size: y rows on the left side of the field. */
const ENEMY_ROWS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 105, y: 150 }],
  2: [
    { x: 110, y: 130 },
    { x: 90, y: 190 }
  ],
  3: [
    { x: 115, y: 120 },
    { x: 95, y: 165 },
    { x: 115, y: 210 }
  ]
};

export class BattleScene extends Phaser.Scene {
  private battle!: AtbBattle;
  private rng = makeRng(1);
  private fighters = new Map<string, Fighter>();
  private commands: CommandId[] = ["attack", "guard"];
  private menuMode: MenuMode = "hidden";
  private menuItems: { label: string; value: string }[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuSel = 0;
  private menuPanel!: Phaser.GameObjects.Container;
  private menuBg!: Phaser.GameObjects.Graphics;
  private ending = false;
  private sceneData!: BattleSceneData;

  constructor() {
    super("battle");
  }

  init(data: BattleSceneData): void {
    this.sceneData = data;
    this.fighters = new Map();
    this.menuMode = "hidden";
    this.menuTexts = [];
    this.ending = false;
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff));
  }

  create(): void {
    this.drawBackdrop();

    const state = getState(this);
    const stats = heroStats(state); // hp already clamped to current hp
    const level = levelForXp(state.hero.xp);
    this.commands = commandsForLevel(level);

    const enemySeeds = makeEnemyParty(this.sceneData.group);
    this.battle = new AtbBattle(
      [
        {
          id: HERO_ID,
          name: "Joseph",
          side: "party",
          stats,
          cactusGuard: level >= 3
        },
        ...enemySeeds
      ],
      { rng: this.rng }
    );

    this.addFighter(HERO_ID, "hero", 370, 160, "hero-idle-left", 2.5, false, false);
    const rows = ENEMY_ROWS[Math.min(3, Math.max(1, enemySeeds.length))];
    enemySeeds.forEach((seed, i) => {
      const def = BESTIARY[this.sceneData.group[i]];
      const anim = this.anims.exists(`${def.sheet}-move`)
        ? `${def.sheet}-move`
        : `${def.sheet}-idle`;
      const slot = rows[Math.min(i, rows.length - 1)];
      this.addFighter(seed.id, def.sheet, slot.x, slot.y, anim, def.scale, true, this.sceneData.boss);
    });

    this.buildMenuPanel();
    this.cameras.main.fadeIn(350);
    if (this.sceneData.boss) {
      this.cameras.main.setZoom(1.22);
      this.tweens.add({
        targets: this.cameras.main,
        zoom: 1,
        duration: 700,
        ease: "Quad.easeOut"
      });
      this.cameras.main.shake(450, 0.004);
    }

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.moveMenu(-1));
    kb.on("keydown-DOWN", () => this.moveMenu(1));
    kb.on("keydown-SPACE", () => this.confirmMenu());
    kb.on("keydown-ENTER", () => this.confirmMenu());
  }

  // --- Backdrops ---

  private tile2(name: string): number {
    const idx = MANIFEST.tiles2.names[name];
    if (idx === undefined) throw new Error(`Unknown tiles2 name: ${name}`);
    return idx;
  }

  private drawBackdrop(): void {
    switch (this.sceneData.bg) {
      case "mine":
        this.drawMineBackdrop();
        break;
      case "ice":
        this.drawIceBackdrop();
        break;
      default:
        this.drawDesertBackdrop();
    }
  }

  private drawDesertBackdrop(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.add.graphics();
    // Dusk sky bands.
    const bands: [string, number, number][] = [
      [PALETTE.plum, 0, 50],
      [PALETTE.mauve, 50, 40],
      [PALETTE.rust, 90, 28],
      [PALETTE.clay, 118, 20]
    ];
    for (const [c, y, bh] of bands) {
      g.fillStyle(hexToInt(c), 1);
      g.fillRect(0, y, w, bh);
    }
    // Sand floor.
    g.fillStyle(hexToInt(PALETTE.sand), 1);
    g.fillRect(0, 138, w, h - 138);
    g.fillStyle(hexToInt(PALETTE.amber), 1);
    g.fillRect(0, 138, w, 3);
    // Distant dune silhouettes.
    g.fillStyle(hexToInt(PALETTE.mauve), 1);
    g.fillTriangle(20, 138, 150, 90, 290, 138);
    g.fillTriangle(220, 138, 370, 100, 480, 138);
    // Scenery props from the tileset keep battles visually unified with zones.
    for (const [name, x, y, scale] of [
      ["cactus", 40, 122, 2],
      ["rock", 430, 126, 2],
      ["bones", 250, 200, 2],
      ["rock", 180, 240, 2]
    ] as const) {
      this.add.image(x, y, "tiles", tileIndex(name)).setScale(scale).setOrigin(0.5, 1);
    }
  }

  private drawMineBackdrop(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.add.graphics();
    // Cave dark: ink/plum bands.
    const bands: [string, number, number][] = [
      [PALETTE.ink, 0, 64],
      [PALETTE.plum, 64, 34],
      [PALETTE.mauve, 98, 20],
      [PALETTE.plum, 118, 20]
    ];
    for (const [c, y, bh] of bands) {
      g.fillStyle(hexToInt(c), 1);
      g.fillRect(0, y, w, bh);
    }
    // Darker plum floor with a mauve seam.
    g.fillStyle(hexToInt(PALETTE.plum), 1);
    g.fillRect(0, 138, w, h - 138);
    g.fillStyle(hexToInt(PALETTE.mauve), 1);
    g.fillRect(0, 138, w, 2);
    // Support timbers along the back wall.
    for (const x of [40, 150, 265, 430]) {
      this.add
        .image(x, 138, "tiles2", this.tile2("mineTimber"))
        .setScale(2)
        .setOrigin(0.5, 1);
    }
    // A rail line running across the floor.
    for (let x = 16; x < w; x += 32) {
      this.add.image(x, 236, "tiles2", this.tile2("rail")).setScale(2);
    }
    this.add.image(444, 226, "tiles2", this.tile2("cart")).setScale(2).setOrigin(0.5, 1);
  }

  private drawIceBackdrop(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const g = this.add.graphics();
    // Frozen depths: indigo/teal bands.
    const bands: [string, number, number][] = [
      [PALETTE.indigo, 0, 62],
      [PALETTE.tealDeep, 62, 38],
      [PALETTE.teal, 100, 18],
      [PALETTE.tealDeep, 118, 20]
    ];
    for (const [c, y, bh] of bands) {
      g.fillStyle(hexToInt(c), 1);
      g.fillRect(0, y, w, bh);
    }
    // Frost-rimed sand floor with a skyBlue edge.
    g.fillStyle(hexToInt(PALETTE.sandLight), 1);
    g.fillRect(0, 138, w, h - 138);
    g.fillStyle(hexToInt(PALETTE.skyBlue), 1);
    g.fillRect(0, 138, w, 3);
    // Ice wall row along the top of the field.
    for (let x = 16; x < w; x += 32) {
      this.add
        .image(x, 138, "tiles2", this.tile2("iceWall"))
        .setScale(2)
        .setOrigin(0.5, 1);
    }
    // Rime patches and skyBlue glints on the floor.
    for (const [x, y] of [
      [70, 190],
      [310, 226],
      [200, 252],
      [430, 200]
    ] as const) {
      this.add.image(x, y, "tiles2", this.tile2("frostSand")).setScale(2);
    }
    g.fillStyle(hexToInt(PALETTE.skyBlue), 1);
    for (const [x, y] of [
      [140, 214],
      [260, 186],
      [380, 246],
      [50, 250]
    ] as const) {
      g.fillRect(x, y, 2, 2);
    }
  }

  // --- Fighters ---

  private addFighter(
    id: string,
    sheet: string,
    x: number,
    y: number,
    anim: string,
    scale: number,
    flipX: boolean,
    bossTag: boolean
  ): void {
    const sprite = this.add.sprite(x, y, sheet, 0).setScale(scale);
    sprite.play(anim);
    sprite.setFlipX(flipX);
    const barY = y - Math.round(sprite.displayHeight / 2) - 14;
    const barW = Math.max(40, Math.round(sprite.displayWidth * 0.55));
    const label = this.add
      .text(x, barY - 3, this.battle.getCombatant(id).name, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.bone
      })
      .setOrigin(0.5, 1);
    if (bossTag) {
      this.add
        .text(x, barY - 13, "BOSS", {
          fontFamily: "monospace",
          fontSize: "8px",
          color: PALETTE.hpRed,
          stroke: PALETTE.ink,
          strokeThickness: 2
        })
        .setOrigin(0.5, 1);
    }
    const hpBar = this.add.graphics();
    const gaugeBar = this.add.graphics();
    this.fighters.set(id, { id, sprite, homeX: x, homeY: y, barW, barY, hpBar, gaugeBar, label });
    this.redrawBars(id);
  }

  private redrawBars(id: string): void {
    const f = this.fighters.get(id)!;
    const c = this.battle.getCombatant(id);
    const w = f.barW;
    const x = f.homeX - w / 2;
    const y = f.barY;
    f.hpBar.clear();
    f.hpBar.fillStyle(hexToInt(PALETTE.ink), 0.9);
    f.hpBar.fillRect(x - 1, y - 1, w + 2, 5);
    f.hpBar.fillStyle(hexToInt(PALETTE.hpRed), 1);
    f.hpBar.fillRect(x, y, Math.max(0, Math.round((c.stats.hp / c.stats.maxHp) * w)), 3);
    f.gaugeBar.clear();
    f.gaugeBar.fillStyle(hexToInt(PALETTE.ink), 0.9);
    f.gaugeBar.fillRect(x - 1, y + 5, w + 2, 4);
    f.gaugeBar.fillStyle(hexToInt(PALETTE.atbGold), 1);
    f.gaugeBar.fillRect(x, y + 6, Math.round(c.gauge * w), 2);
  }

  // --- Menu ---

  private buildMenuPanel(): void {
    this.menuBg = this.add.graphics();
    this.menuPanel = this.add.container(0, 0, [this.menuBg]);
    this.menuPanel.setDepth(1000).setVisible(false);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (inFullscreenButtonZone(this, p)) return; // handled by the button
      this.tapMenu(p);
    });
    addFullscreenButton(this, 4);
  }

  private actionMenuItems(): { label: string; value: string }[] {
    const hero = this.battle.getCombatant(HERO_ID);
    const items = [
      { label: "Attack", value: "attack" },
      { label: "Guard", value: "guard" }
    ];
    if (this.commands.includes("focus") && !hero.focused) {
      items.push({ label: "Focus", value: "focus" });
    }
    if (this.commands.includes("second-wind") && !hero.secondWindUsed) {
      items.push({ label: "2nd Wind", value: "second-wind" });
    }
    if (this.commands.includes("sandstep") && !hero.sandstepUsed) {
      items.push({ label: "Sandstep", value: "sandstep" });
    }
    return items;
  }

  private showMenu(mode: Exclude<MenuMode, "hidden">): void {
    this.menuMode = mode;
    this.menuSel = 0;
    this.menuItems =
      mode === "actions"
        ? this.actionMenuItems()
        : this.battle.livingOn("enemy").map((c) => ({ label: c.name, value: c.id }));
    this.layoutMenuPanel();
    this.renderMenu();
    this.menuPanel.setVisible(true);
  }

  private hideMenu(): void {
    this.menuMode = "hidden";
    this.menuPanel.setVisible(false);
  }

  private layoutMenuPanel(): void {
    const height = this.menuItems.length * 14 + 12;
    this.menuBg.clear();
    this.menuBg.fillStyle(hexToInt(PALETTE.ink), 0.94);
    this.menuBg.fillRect(0, 0, 130, height);
    this.menuBg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    this.menuBg.strokeRect(0.5, 0.5, 129, height - 1);
    this.menuPanel.setPosition(this.scale.width - 138, this.scale.height - height - 8);
  }

  private renderMenu(): void {
    this.menuTexts.forEach((t) => t.destroy());
    this.menuTexts = this.menuItems.map((item, i) => {
      const t = this.add.text(
        8,
        7 + i * 14,
        `${i === this.menuSel ? "▸ " : "  "}${item.label}`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: i === this.menuSel ? PALETTE.atbGold : PALETTE.bone
        }
      );
      this.menuPanel.add(t);
      return t;
    });
  }

  private moveMenu(delta: number): void {
    if (this.menuMode === "hidden") return;
    this.menuSel =
      (this.menuSel + delta + this.menuItems.length) % this.menuItems.length;
    this.renderMenu();
  }

  private tapMenu(p: Phaser.Input.Pointer): void {
    if (this.menuMode === "hidden") return;
    const localY = p.y - this.menuPanel.y - 7;
    const row = Math.floor(localY / 14);
    if (p.x >= this.menuPanel.x && row >= 0 && row < this.menuItems.length) {
      this.menuSel = row;
      this.confirmMenu();
    }
  }

  private confirmMenu(): void {
    if (this.menuMode === "hidden" || this.ending) return;
    const item = this.menuItems[this.menuSel];
    if (this.menuMode === "actions") {
      if (item.value === "attack") {
        this.showMenu("targets");
      } else {
        this.hideMenu();
        this.handleEvents(this.battle.act(HERO_ID, item.value as ActionId));
      }
    } else {
      this.hideMenu();
      this.handleEvents(this.battle.act(HERO_ID, "attack", item.value));
    }
  }

  // --- Battle flow ---

  update(_time: number, deltaMs: number): void {
    if (this.ending) return;
    this.handleEvents(this.battle.tick(deltaMs / 1000));
    for (const id of this.fighters.keys()) this.redrawBars(id);
  }

  private handleEvents(events: BattleEvent[]): void {
    for (const ev of events) {
      switch (ev.type) {
        case "ready":
          if (ev.id === HERO_ID) {
            if (this.menuMode === "hidden" && !this.ending) this.showMenu("actions");
          } else {
            this.time.delayedCall(400 + Math.floor(this.rng() * 100), () =>
              this.enemyAct(ev.id)
            );
          }
          break;
        case "action":
          this.animateAction(ev);
          break;
        case "heal": {
          const f = this.fighters.get(ev.id)!;
          this.floatText(f.homeX, f.homeY - 8, `+${ev.amount}`, PALETTE.jade);
          break;
        }
        case "thorns": {
          const f = this.fighters.get(ev.targetId)!;
          f.sprite.setTintFill(hexToInt(PALETTE.jade));
          this.time.delayedCall(90, () => f.sprite.clearTint());
          this.floatText(f.homeX, f.homeY - 26, `${ev.damage}`, PALETTE.jade);
          break;
        }
        case "defeated":
          this.animateDefeat(ev.id);
          break;
        case "victory":
          this.endBattle(ev.winner);
          break;
      }
    }
  }

  private enemyAct(id: string): void {
    if (this.ending || this.battle.over) return;
    const c = this.battle.getCombatant(id);
    if (c.stats.hp <= 0 || !this.battle.isReady(id)) return;
    const decision = chooseEnemyAction(this.battle, id, this.rng);
    this.handleEvents(this.battle.act(id, decision.action, decision.targetId));
  }

  private animateAction(ev: Extract<BattleEvent, { type: "action" }>): void {
    const actor = this.fighters.get(ev.actorId)!;
    switch (ev.action) {
      case "guard":
        this.floatText(actor.homeX, actor.homeY - 20, "GUARD", PALETTE.skyBlue);
        return;
      case "focus":
        this.floatText(actor.homeX, actor.homeY - 20, "FOCUS", PALETTE.atbGold);
        return;
      case "second-wind":
        this.floatText(actor.homeX, actor.homeY - 20, "2ND WIND", PALETTE.mint);
        return;
      case "sandstep":
        this.floatText(actor.homeX, actor.homeY - 20, "SANDSTEP", PALETTE.sandLight);
        return;
    }
    const target = this.fighters.get(ev.targetId)!;
    const dirX = target.homeX > actor.homeX ? 1 : -1;
    this.tweens.add({
      targets: actor.sprite,
      x: actor.homeX + dirX * 26,
      duration: 110,
      yoyo: true,
      ease: "Quad.easeOut",
      onYoyo: () => {
        target.sprite.setTintFill(hexToInt(PALETTE.white));
        this.time.delayedCall(90, () => target.sprite.clearTint());
        this.floatText(target.homeX, target.homeY - 26, `${ev.damage}`, PALETTE.hpRed);
      }
    });
  }

  private animateDefeat(id: string): void {
    const f = this.fighters.get(id)!;
    this.tweens.add({
      targets: [f.sprite, f.label],
      alpha: 0,
      duration: 500,
      delay: 250
    });
    f.hpBar.setVisible(false);
    f.gaugeBar.setVisible(false);
    // If the hero's pending target list is now stale, refresh it.
    if (this.menuMode === "targets" && !this.ending) this.showMenu("targets");
  }

  private floatText(x: number, y: number, text: string, color: string): void {
    const t = this.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: "11px", color })
      .setOrigin(0.5)
      .setDepth(2000);
    this.tweens.add({
      targets: t,
      y: y - 18,
      alpha: 0,
      duration: 800,
      onComplete: () => t.destroy()
    });
  }

  // --- Endings ---

  private banner(text: string, color: string, y = 70, size = "22px"): void {
    this.add
      .text(this.scale.width / 2, y, text, {
        fontFamily: "monospace",
        fontSize: size,
        color,
        stroke: PALETTE.ink,
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(3000);
  }

  private endBattle(winner: Side): void {
    if (this.ending) return;
    this.ending = true;
    this.hideMenu();
    if (winner === "party") this.handleVictory();
    else this.handleDefeat();
  }

  private handleVictory(): void {
    // Capture before any state math: core's awardXp may full-heal on level-up.
    const heroHpAfterBattle = this.battle.getCombatant(HERO_ID).stats.hp;
    const xp = xpForParty(this.sceneData.group);
    this.banner("VICTORY!", PALETTE.atbGold);
    this.time.delayedCall(500, () =>
      this.floatText(this.scale.width / 2, 100, `+${xp} XP`, PALETTE.atbGold)
    );
    this.time.delayedCall(1500, () => {
      const { state, levelsGained } = awardXp(getState(this), xp);
      let cur = state;
      if (this.sceneData.victoryFlag) {
        cur = { ...cur, flags: { ...cur.flags, [this.sceneData.victoryFlag]: true } };
      }
      if (levelsGained > 0) {
        // Level-up already fully healed in core — keep that heal.
        this.banner("LEVEL UP!", PALETTE.mint, 100, "14px");
        this.time.delayedCall(900, () => this.runPerkChoices(cur));
      } else {
        cur = applyBattleResult(cur, heroHpAfterBattle);
        setState(this, cur);
        this.time.delayedCall(300, () => this.leaveVictorious());
      }
    });
  }

  /** One PerkMenu per pending level-up, then depart. */
  private runPerkChoices(cur: Act1State): void {
    if (cur.pendingPerks <= 0) {
      setState(this, cur);
      this.leaveVictorious();
      return;
    }
    new PerkMenu(this, (perk) => this.runPerkChoices(choosePerk(cur, perk)));
  }

  private leaveVictorious(): void {
    const { returnTo } = this.sceneData;
    this.cameras.main.fadeOut(400);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(returnTo.scene, { spawnPx: { x: returnTo.x, y: returnTo.y } });
    });
  }

  private handleDefeat(): void {
    this.banner("DEFEATED...", PALETTE.hpRed);
    this.add
      .text(this.scale.width / 2, 92, "You wake at the edge of the area.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone,
        stroke: PALETTE.ink,
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(3000);
    this.time.delayedCall(1900, () => {
      const state = respawn(getState(this)); // full hp, keeps xp/perks/flags/items
      setState(this, state);
      this.cameras.main.fadeOut(400);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        // Explicit empty data: Phaser reuses the PREVIOUS start data when
        // none is passed, which would respawn at the last entrance instead
        // of the zone's checkpoint spawn.
        this.scene.start(state.zone, {});
      });
    });
  }
}
