/**
 * Active Time Battle presentation. All rules run in the tested core
 * (src/core/atb.ts); this scene only renders gauges, menus and hit
 * feedback, and forwards player decisions.
 */
import Phaser from "phaser";
import {
  AtbBattle,
  chooseEnemyAction,
  type BattleEvent,
  type Side
} from "../../core/atb";
import { makeRng } from "../../core/rng";
import { PALETTE, hexToInt } from "../../shared/palette";
import { tileIndex } from "../manifest";

interface BattleSceneData {
  returnSpawn?: { x: number; y: number };
}

interface Fighter {
  id: string;
  sprite: Phaser.GameObjects.Sprite;
  homeX: number;
  homeY: number;
  hpBar: Phaser.GameObjects.Graphics;
  gaugeBar: Phaser.GameObjects.Graphics;
  label: Phaser.GameObjects.Text;
}

type MenuMode = "hidden" | "actions" | "targets";

export class BattleScene extends Phaser.Scene {
  private battle!: AtbBattle;
  private rng = makeRng(1);
  private fighters = new Map<string, Fighter>();
  private menuMode: MenuMode = "hidden";
  private menuItems: { label: string; value: string }[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuSel = 0;
  private menuPanel!: Phaser.GameObjects.Container;
  private ending = false;
  private returnSpawn?: { x: number; y: number };

  constructor() {
    super("Battle");
  }

  init(data: BattleSceneData): void {
    this.returnSpawn = data?.returnSpawn;
    this.fighters = new Map();
    this.menuMode = "hidden";
    this.menuTexts = [];
    this.ending = false;
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff));
  }

  create(): void {
    this.drawBackdrop();

    this.battle = new AtbBattle(
      [
        {
          id: "hero",
          name: "Joseph",
          side: "party",
          stats: { maxHp: 32, hp: 32, attack: 9, defense: 3, speed: 12 }
        },
        {
          id: "scarabA",
          name: "Scarab A",
          side: "enemy",
          stats: { maxHp: 15, hp: 15, attack: 6, defense: 2, speed: 9 }
        },
        {
          id: "scarabB",
          name: "Scarab B",
          side: "enemy",
          stats: { maxHp: 15, hp: 15, attack: 6, defense: 2, speed: 11 }
        }
      ],
      { rng: this.rng }
    );

    this.addFighter("hero", "hero", 360, 160, "hero-idle-left", 2.5);
    this.addFighter("scarabA", "scarab", 110, 130, "scarab-move", 2.5);
    this.addFighter("scarabB", "scarab", 90, 185, "scarab-move", 2.5);
    this.fighters.get("scarabA")!.sprite.setFlipX(true);
    this.fighters.get("scarabB")!.sprite.setFlipX(true);

    this.buildMenuPanel();
    this.cameras.main.fadeIn(350);

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.moveMenu(-1));
    kb.on("keydown-DOWN", () => this.moveMenu(1));
    kb.on("keydown-SPACE", () => this.confirmMenu());
    kb.on("keydown-ENTER", () => this.confirmMenu());
  }

  private drawBackdrop(): void {
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
    // Scenery props from the tileset keep the two scenes visually unified.
    for (const [name, x, y, scale] of [
      ["cactus", 40, 122, 2],
      ["rock", 430, 126, 2],
      ["bones", 250, 200, 2],
      ["rock", 180, 240, 2]
    ] as const) {
      this.add.image(x, y, "tiles", tileIndex(name)).setScale(scale).setOrigin(0.5, 1);
    }
  }

  private addFighter(
    id: string,
    sheet: string,
    x: number,
    y: number,
    anim: string,
    scale: number
  ): void {
    const sprite = this.add.sprite(x, y, sheet, 0).setScale(scale);
    sprite.play(anim);
    const label = this.add
      .text(x, y - 44, this.battle.getCombatant(id).name, {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.bone
      })
      .setOrigin(0.5);
    const hpBar = this.add.graphics();
    const gaugeBar = this.add.graphics();
    this.fighters.set(id, { id, sprite, homeX: x, homeY: y, hpBar, gaugeBar, label });
    this.redrawBars(id);
  }

  private redrawBars(id: string): void {
    const f = this.fighters.get(id)!;
    const c = this.battle.getCombatant(id);
    const w = 40;
    const x = f.homeX - w / 2;
    const y = f.homeY - 40;
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
    const w = this.scale.width;
    const bg = this.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.94);
    bg.fillRect(0, 0, 130, 62);
    bg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    bg.strokeRect(0.5, 0.5, 129, 61);
    this.menuPanel = this.add.container(w - 138, this.scale.height - 70, [bg]);
    this.menuPanel.setDepth(1000).setVisible(false);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.tapMenu(p));
  }

  private showMenu(mode: Exclude<MenuMode, "hidden">): void {
    this.menuMode = mode;
    this.menuSel = 0;
    this.menuItems =
      mode === "actions"
        ? [
            { label: "Attack", value: "attack" },
            { label: "Guard", value: "guard" }
          ]
        : this.battle.livingOn("enemy").map((c) => ({ label: c.name, value: c.id }));
    this.renderMenu();
    this.menuPanel.setVisible(true);
  }

  private hideMenu(): void {
    this.menuMode = "hidden";
    this.menuPanel.setVisible(false);
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
      if (item.value === "guard") {
        this.hideMenu();
        this.handleEvents(this.battle.act("hero", "guard"));
      } else {
        this.showMenu("targets");
      }
    } else {
      this.hideMenu();
      this.handleEvents(this.battle.act("hero", "attack", item.value));
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
          if (ev.id === "hero") {
            if (this.menuMode === "hidden") this.showMenu("actions");
          } else {
            this.time.delayedCall(450, () => this.enemyAct(ev.id));
          }
          break;
        case "action":
          this.animateAction(ev);
          break;
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
    if (ev.action === "guard") {
      this.floatText(actor.homeX, actor.homeY - 20, "GUARD", PALETTE.skyBlue);
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
    if (this.menuMode === "targets") this.showMenu("targets");
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

  private endBattle(winner: Side): void {
    this.ending = true;
    this.hideMenu();
    const won = winner === "party";
    this.add
      .text(this.scale.width / 2, 70, won ? "VICTORY!" : "DEFEATED...", {
        fontFamily: "monospace",
        fontSize: "22px",
        color: won ? PALETTE.atbGold : PALETTE.hpRed,
        stroke: PALETTE.ink,
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(3000);
    this.time.delayedCall(1800, () => {
      this.cameras.main.fadeOut(400);
      this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
        this.scene.start("World", {
          scarabDefeated: won,
          playerSpawn: won ? this.returnSpawn : undefined
        });
      });
    });
  }
}
