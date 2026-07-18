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
import type { CommandId } from "../../core/progression";
import {
  applyBattleResult,
  awardXp,
  choosePerk,
  grantShiny,
  partyFor,
  respawn,
  type Act1State,
  type ZoneId
} from "../../core/gameState";
import { DROP_LABELS, rollDrop } from "../../core/drops";
import { getState, setState } from "../state";
import { getMusic } from "../audio/music";
import { addFullscreenButton, inFullscreenButtonZone, isTouchDevice, TouchListButtons } from "../ui/touch";
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
/** Default in-menu label per command id (the hero's wording). */
const DEFAULT_COMMAND_LABELS: Record<CommandId, string> = {
  attack: "Attack",
  guard: "Guard",
  focus: "Focus",
  "second-wind": "2nd Wind",
  sandstep: "Sandstep",
  venom: "Venom"
};
/** Per-member themed overrides for shared commands (falls back to the default
 *  above). Keyed by roster id; only the entries that differ are listed. */
const COMMAND_LABELS: Record<string, Partial<Record<CommandId, string>>> = {
  slither: { attack: "Bite", guard: "Coil" },
  fluffball: { attack: "Peck", guard: "Fluff Up", focus: "Pounce" },
  piggy: { attack: "Nip", guard: "Hide", "second-wind": "Nap" }
};
/** Vertical space reserved for the actor-name title inside the menu panel. */
const MENU_TITLE_H = 13;
const MENU_ROW_H = 14;
/** Plain command/target panel width; widened on touch for the ▲/✓/▼ column. */
const MENU_W = 130;
const MENU_W_TOUCH = 160;
const MENU_BTN_SIZE = 20;
const MENU_BTN_GAP = 22;
/**
 * Per-member SPRITE presentation (sheet, idle anim, scale, facing). Positions
 * are NOT here — they come from PARTY_COLS below, chosen by party size so 1–4
 * members stagger cleanly down the right column. The party stands on the RIGHT
 * facing LEFT toward the enemies: the hero's sheet has a dedicated left-facing
 * idle; Slither/Fluffball/Piggy sheets face right, so they flipX to face in.
 * None of the creatures has a dedicated attack pose — the strike is a
 * positional lunge tween (see animateAction), so their idle frames are all the
 * animation the hit needs (this is how Slither has always fought).
 */
const PARTY_VISUALS: Record<
  string,
  { sheet: string; anim: string; fallback?: string; scale: number; flipX: boolean }
> = {
  hero: { sheet: "hero", anim: "hero-idle-left", scale: 2, flipX: false },
  slither: {
    sheet: "slither",
    anim: "slither-idle",
    fallback: "slither-move",
    scale: 2,
    flipX: true
  },
  fluffball: {
    sheet: "fluffball",
    anim: "fluffball-idle",
    fallback: "fluffball-walk",
    scale: 2,
    flipX: true
  },
  piggy: {
    // Piggy is a baby — drawn a touch smaller than the others.
    sheet: "piggy",
    anim: "piggy-idle",
    fallback: "piggy-walk",
    scale: 1.6,
    flipX: true
  }
};
/** Party sprite positions by party size: a two-column ZIG-ZAG in the upper-right
 *  of the field (hero always slot 0). It stays in the top ~2/3 and never runs
 *  into the command box, which anchors to the bottom-right corner and, at its
 *  tallest (the hero's full command list), reaches up to about y=169 — so every
 *  slot here keeps its feet above that. The alternating x columns (≈350 / ≈400)
 *  give the classic staggered party look without stacking a 3rd/4th member
 *  behind the menu. Sized for 1–4 members (Piggy fills the 4th slot in Part Two). */
const PARTY_COLS: Record<number, Array<{ x: number; y: number }>> = {
  1: [{ x: 372, y: 96 }],
  2: [
    { x: 350, y: 84 },
    { x: 398, y: 120 }
  ],
  3: [
    { x: 350, y: 70 },
    { x: 398, y: 104 },
    { x: 350, y: 138 }
  ],
  4: [
    { x: 350, y: 64 },
    { x: 398, y: 92 },
    { x: 350, y: 120 },
    { x: 398, y: 148 }
  ]
};
/** Largest party size PARTY_COLS lays out without overlap. */
const MAX_PARTY_COLS = Math.max(...Object.keys(PARTY_COLS).map(Number));
/** Enemy slots by party size: a staggered column down the left side of the
 *  field, hand-placed per size. Every group size a battle can actually spawn
 *  needs its own row set here — the largest scripted fight is the Act 4
 *  midden-mite nest (4), and random encounters top out at 3. A size with no
 *  entry falls back to the largest defined one (see MAX_ENEMY_ROWS), which
 *  would stack the surplus enemies on the last slot, so keep this covering
 *  the real max. */
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
  ],
  4: [
    { x: 115, y: 120 },
    { x: 93, y: 150 },
    { x: 115, y: 180 },
    { x: 93, y: 210 }
  ]
};
/** Largest group size ENEMY_ROWS lays out without overlap — derived, not
 *  hardcoded, so adding a bigger row set above is all it takes to support a
 *  bigger fight (a 4-enemy fight used to clamp to the 3-slot layout and drop
 *  its 4th enemy exactly on top of its 3rd). */
const MAX_ENEMY_ROWS = Math.max(...Object.keys(ENEMY_ROWS).map(Number));

export class BattleScene extends Phaser.Scene {
  private battle!: AtbBattle;
  private rng = makeRng(1);
  private fighters = new Map<string, Fighter>();
  /** Command list per party member id (from partyFor). */
  private partyCommands = new Map<string, CommandId[]>();
  private menuMode: MenuMode = "hidden";
  /** The party member the open menu belongs to (null while hidden). */
  private menuActorId: string | null = null;
  /** Party members that became ready while another member's menu was open. */
  private readyQueue: string[] = [];
  /** Targeted action chosen in the actions menu, resolved in the target submenu. */
  private pendingAction: "attack" | "venom" = "attack";
  private menuItems: { label: string; value: string }[] = [];
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private menuSel = 0;
  private menuPanel!: Phaser.GameObjects.Container;
  private menuBg!: Phaser.GameObjects.Graphics;
  private menuTitle!: Phaser.GameObjects.Text;
  private menuTouchButtons: TouchListButtons | null = null;
  private touch = false;
  private ending = false;
  private sceneData!: BattleSceneData;

  constructor() {
    super("battle");
  }

  init(data: BattleSceneData): void {
    this.sceneData = data;
    this.fighters = new Map();
    this.partyCommands = new Map();
    this.menuMode = "hidden";
    this.menuActorId = null;
    this.readyQueue = [];
    this.pendingAction = "attack";
    this.menuTexts = [];
    this.ending = false;
    this.rng = makeRng(Math.floor(Math.random() * 0xffffffff));
  }

  create(): void {
    this.drawBackdrop();
    getMusic(this).play(this, this.sceneData.boss ? "boss" : "battle");

    const state = getState(this);
    // Roster-driven party (1–4 members): Joseph always leads; Slither,
    // Fluffball and Piggy join as their flags unlock. All the stats/commands/hp
    // rules live in the tested core (roster.ts activeParty via partyFor).
    const party = partyFor(state);
    this.partyCommands = new Map(party.map((m) => [m.id, m.commands]));

    const enemySeeds = makeEnemyParty(this.sceneData.group);
    this.battle = new AtbBattle(
      [
        ...party.map((m) => ({
          id: m.id,
          name: m.name,
          side: "party" as Side,
          stats: m.stats,
          cactusGuard: m.cactusGuard
        })),
        ...enemySeeds
      ],
      { rng: this.rng }
    );

    const partyCols =
      PARTY_COLS[Math.min(MAX_PARTY_COLS, Math.max(1, party.length))];
    party.forEach((m, i) => {
      const vis = PARTY_VISUALS[m.id];
      const anim = this.anims.exists(vis.anim) ? vis.anim : vis.fallback ?? vis.anim;
      const pos = partyCols[Math.min(i, partyCols.length - 1)];
      this.addFighter(m.id, vis.sheet, pos.x, pos.y, anim, vis.scale, vis.flipX, false);
    });
    const rows = ENEMY_ROWS[Math.min(MAX_ENEMY_ROWS, Math.max(1, enemySeeds.length))];
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
    // Every prop's FEET (origin 0.5,1) sit on the sand — i.e. y >= the 138
    // floor line — so nothing floats in the sky band. The back pair sit just
    // over the horizon (distant), the front pair further down (near).
    for (const [name, x, y, scale] of [
      ["cactus", 40, 143, 2],
      ["rock", 430, 143, 2],
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
    this.touch = isTouchDevice(this);
    this.menuBg = this.add.graphics();
    this.menuTitle = this.add.text(8, 4, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.sand
    });
    this.menuPanel = this.add.container(0, 0, [this.menuBg, this.menuTitle]);
    this.menuPanel.setDepth(1000).setVisible(false);
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (inFullscreenButtonZone(this, p)) return; // handled by the button
      this.tapMenu(p);
    });
    addFullscreenButton(this, 4);
  }

  /**
   * Commands for one party member, in their partyFor order. The hero shows
   * Attack/Guard plus level-gated extras with their availability rules; the
   * creatures re-theme their shared commands (Slither Bite/Coil/Venom,
   * Fluffball Peck/Fluff Up/Pounce, Piggy Nip/Hide/Nap) via COMMAND_LABELS.
   */
  private actionMenuItems(actorId: string): { label: string; value: string }[] {
    const actor = this.battle.getCombatant(actorId);
    const commands = this.partyCommands.get(actorId) ?? ["attack", "guard"];
    const label = (cmd: CommandId): string =>
      COMMAND_LABELS[actorId]?.[cmd] ?? DEFAULT_COMMAND_LABELS[cmd];
    const items: { label: string; value: string }[] = [];
    for (const cmd of commands) {
      switch (cmd) {
        case "attack":
        case "guard":
        case "venom":
          items.push({ label: label(cmd), value: cmd });
          break;
        case "focus":
          if (!actor.focused) items.push({ label: label(cmd), value: cmd });
          break;
        case "second-wind":
          if (!actor.secondWindUsed) items.push({ label: label(cmd), value: cmd });
          break;
        case "sandstep":
          if (!actor.sandstepUsed) items.push({ label: label(cmd), value: cmd });
          break;
      }
    }
    return items;
  }

  /** Open the action menu for a ready party member. */
  private openMenuFor(actorId: string): void {
    this.menuActorId = actorId;
    this.pendingAction = "attack";
    this.showMenu("actions");
  }

  /**
   * A party member's "ready": take the menu if it's free, otherwise wait in
   * line behind the member currently choosing.
   */
  private onPartyReady(id: string): void {
    if (this.ending) return;
    if (this.menuMode === "hidden") {
      this.openMenuFor(id);
    } else if (id !== this.menuActorId && !this.readyQueue.includes(id)) {
      this.readyQueue.push(id);
    }
  }

  /**
   * After the menu frees up (actor acted, died, or battle interrupted),
   * hand it to the next queued member who is still alive and ready.
   */
  private pumpReadyQueue(): void {
    if (this.ending || this.battle.over || this.menuMode !== "hidden") return;
    while (this.readyQueue.length > 0) {
      const id = this.readyQueue.shift()!;
      if (this.battle.isReady(id)) {
        this.openMenuFor(id);
        return;
      }
    }
  }

  private showMenu(mode: Exclude<MenuMode, "hidden">): void {
    const actorId = this.menuActorId ?? HERO_ID;
    this.menuMode = mode;
    this.menuSel = 0;
    this.menuItems =
      mode === "actions"
        ? this.actionMenuItems(actorId)
        : this.battle.livingOn("enemy").map((c) => ({ label: c.name, value: c.id }));
    this.menuTitle.setText(this.battle.getCombatant(actorId).name);
    this.layoutMenuPanel();
    this.renderMenu();
    this.menuPanel.setVisible(true);
  }

  private hideMenu(): void {
    this.menuMode = "hidden";
    this.menuActorId = null;
    this.menuPanel.setVisible(false);
  }

  private layoutMenuPanel(): void {
    const width = this.touch ? MENU_W_TOUCH : MENU_W;
    const listH = this.menuItems.length * MENU_ROW_H;
    // The fixed-size ▲/✓/▼ column (its own height regardless of item
    // count) can be TALLER than a short list (e.g. just Attack/Guard) —
    // the panel must grow to fit whichever is taller, or the column
    // overflows past the panel's bottom edge and off-canvas entirely,
    // silently eating every tap aimed at it.
    const btnColH = MENU_BTN_GAP * 2 + MENU_BTN_SIZE;
    const contentH = this.touch ? Math.max(listH, btnColH) : listH;
    const height = MENU_TITLE_H + contentH + 10;
    this.menuBg.clear();
    this.menuBg.fillStyle(hexToInt(PALETTE.ink), 0.94);
    this.menuBg.fillRect(0, 0, width, height);
    this.menuBg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    this.menuBg.strokeRect(0.5, 0.5, width - 1, height - 1);
    this.menuPanel.setPosition(this.scale.width - width - 8, this.scale.height - height - 8);

    this.menuTouchButtons?.container.destroy();
    this.menuTouchButtons = null;
    if (this.touch && this.menuItems.length > 0) {
      const btnTop = MENU_TITLE_H + 5 + Math.max(0, Math.round((contentH - btnColH) / 2));
      this.menuTouchButtons = new TouchListButtons(
        this,
        width - 6 - MENU_BTN_SIZE,
        btnTop,
        MENU_BTN_SIZE,
        MENU_BTN_GAP
      );
      this.menuPanel.add(this.menuTouchButtons.container);
    }
  }

  private renderMenu(): void {
    this.menuTexts.forEach((t) => t.destroy());
    const labelW = this.touch ? MENU_W_TOUCH - 16 - (MENU_BTN_SIZE + 8) : MENU_W - 16;
    this.menuTexts = this.menuItems.map((item, i) => {
      const t = this.add.text(
        8,
        MENU_TITLE_H + 5 + i * MENU_ROW_H,
        `${i === this.menuSel ? "▸ " : "  "}${item.label}`,
        {
          fontFamily: "monospace",
          fontSize: "10px",
          color: i === this.menuSel ? PALETTE.atbGold : PALETTE.bone,
          wordWrap: { width: labelW }
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
    const localX = p.x - this.menuPanel.x;
    const localY = p.y - this.menuPanel.y;
    if (this.menuTouchButtons) {
      const hit = this.menuTouchButtons.hitTest(localX, localY);
      if (hit === "up") return this.moveMenu(-1);
      if (hit === "down") return this.moveMenu(1);
      if (hit === "confirm") return this.confirmMenu();
    }
    const row = Math.floor((localY - (MENU_TITLE_H + 5)) / MENU_ROW_H);
    if (localX >= 0 && row >= 0 && row < this.menuItems.length) {
      this.menuSel = row;
      this.confirmMenu();
    }
  }

  private confirmMenu(): void {
    if (this.menuMode === "hidden" || this.ending) return;
    const actorId = this.menuActorId;
    if (actorId === null) return;
    if (!this.battle.isReady(actorId)) {
      // The actor fell (or lost readiness) while the menu was open.
      this.hideMenu();
      this.pumpReadyQueue();
      return;
    }
    const item = this.menuItems[this.menuSel];
    if (this.menuMode === "actions") {
      if (item.value === "attack" || item.value === "venom") {
        // Targeted actions pick a living enemy in the submenu.
        this.pendingAction = item.value;
        this.showMenu("targets");
      } else {
        this.hideMenu();
        this.handleEvents(this.battle.act(actorId, item.value as ActionId));
        this.pumpReadyQueue();
      }
    } else {
      const action = this.pendingAction;
      this.hideMenu();
      this.handleEvents(this.battle.act(actorId, action, item.value));
      this.pumpReadyQueue();
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
          if (this.battle.getCombatant(ev.id).side === "party") {
            this.onPartyReady(ev.id);
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
        case "debuff": {
          const f = this.fighters.get(ev.targetId)!;
          f.sprite.setTintFill(hexToInt(PALETTE.skyBlue));
          this.time.delayedCall(90, () => f.sprite.clearTint());
          this.floatText(f.homeX, f.homeY - 38, "SLOW", PALETTE.skyBlue);
          break;
        }
        case "defeated":
          // A queued member who died before acting never gets the menu;
          // if it was the menu owner's death, free the menu for the line.
          this.readyQueue = this.readyQueue.filter((id) => id !== ev.id);
          if (ev.id === this.menuActorId && this.menuMode !== "hidden") {
            this.hideMenu();
            this.pumpReadyQueue();
          }
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
      case "venom":
        // Callout on the actor; the strike still lunges and floats damage
        // below, and the follow-up "debuff" event floats SLOW on the target.
        this.floatText(actor.homeX, actor.homeY - 20, "VENOM", PALETTE.jade);
        break;
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
    // Clamp to >=1: with a 3-4 member party the hero can be KO'd while a
    // surviving companion lands the winning blow — on a party victory the hero
    // is revived to at least 1 HP so the run never returns stuck at 0 (unable
    // to act next battle until a rest point).
    const heroHpAfterBattle = Math.max(1, this.battle.getCombatant(HERO_ID).stats.hp);
    const xp = xpForParty(this.sceneData.group);
    this.banner("VICTORY!", PALETTE.atbGold);
    this.time.delayedCall(500, () =>
      this.floatText(this.scale.width / 2, 100, `+${xp} XP`, PALETTE.atbGold)
    );
    // Roll the random drop up front (off the battle's own seeded RNG, never
    // Math.random) so it folds into the same state write as the XP award,
    // whichever victory branch is taken. Bosses never drop (scripted rewards).
    const drop = rollDrop(this.rng, this.sceneData.group, this.sceneData.boss);
    this.time.delayedCall(1500, () => {
      const { state, levelsGained } = awardXp(getState(this), xp);
      let cur = state;
      if (this.sceneData.victoryFlag) {
        cur = { ...cur, flags: { ...cur.flags, [this.sceneData.victoryFlag]: true } };
      }
      if (drop === "shiny") {
        cur = grantShiny(cur);
        this.floatText(this.scale.width / 2, 128, `Found ${DROP_LABELS[drop]}!`, PALETTE.atbGold);
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
