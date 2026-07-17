/**
 * Tabbed inventory / status window — opened with the "I" key (or a tap on
 * the bag button). A row of tabs runs across the top; the selected tab's
 * entries scroll in a list down the LEFT; the highlighted entry's details
 * (icon, title, flavor/stats) show in a panel on the RIGHT.
 *
 * Tabs are DATA-DRIVEN (`TabDef[]`): each names a chip title, an
 * empty-state line, and a `build(state)` that returns the tab's entries.
 * Adding a tab is adding one `TabDef` — the render/input framework is
 * tab-agnostic. Three ship today (Inventory, Party, Skills); a 4th
 * "Equipment" tab (the bucket's equip toggle will move there) slots in the
 * same way, which is why `activate` lives on an ENTRY, not on the tab: the
 * bucket row already carries its equip action, so moving it is moving the
 * entry between two `build()`s, nothing more.
 *
 * Input mirrors PerkMenu/BattleScene: the menu owns its own keyboard and
 * pointer handlers while open and tears them down on close.
 *   Keyboard: ↑↓/W,S move in the list · ←→/Q,E switch tabs ·
 *             SPACE/ENTER use the entry · ESC or I close.
 *   Touch:    tap a tab chip · ▲/✓/▼ column moves+uses · ✕ closes.
 * Closing is deliberately redundant (ESC, I, or the always-visible ✕) so a
 * touch-only player is never trapped.
 *
 * Manual hit-testing throughout (not Phaser per-object interactivity),
 * matching PerkMenu, and everything is added to the scene's UI camera layer
 * via addToUiLayer.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import { heroStats, type Act1State } from "../../core/gameState";
import { PERKS, levelForXp } from "../../core/progression";
import { isTouchDevice, TouchListButtons } from "./touch";
import { addToUiLayer } from "../gfx/sceneUi";

const PANEL_W = 320;
const PANEL_H = 186;
const TABS_Y = 22;
const TAB_H = 13;
const CONTENT_TOP = 44;
const ROW_H = 15;
const MAX_ROWS = 8;
const LIST_X = 10;
const LIST_W = 118;
const DIV_X = LIST_X + LIST_W + 4; // 132
const DETAIL_X = DIV_X + 6; // 138
const DETAIL_W = PANEL_W - DETAIL_X - 10; // 172
const FOOTER_Y = PANEL_H - 12;
const CLOSE_SIZE = 18;
const BTN_SIZE = 20;
const BTN_GAP = 22;
const ICON_COL = LIST_X + 8; // list-row icon centre

interface Entry {
  label: string;
  /** Appended to the label in the list (e.g. "  ✓ equipped"). */
  tag?: string;
  icon?: { sheet: string; frame: number };
  detailTitle: string;
  /** Wrapped body text; "\n" hard-breaks (used for stat lines). */
  detailBody: string;
  /** Optional action on SPACE/✓ (e.g. equip the bucket). */
  activate?: () => void;
}

interface TabDef {
  id: string;
  title: string;
  emptyText: string;
  build: (state: Act1State) => Entry[];
}

export interface InventoryCallbacks {
  /** Toggle the bucket equip; returns the updated items for a live re-render. */
  onToggleBucket: () => Act1State["items"];
  onClose: () => void;
}

/** Fit a sprite (any frame size) to a target pixel height, aspect preserved. */
function fitHeight(sprite: Phaser.GameObjects.Sprite, px: number): void {
  const h = sprite.height || px;
  sprite.setScale(px / h);
}

const TABS: TabDef[] = [
  {
    id: "inventory",
    title: "Inventory",
    emptyText: "You're not carrying anything.",
    build: (s) => {
      const items = s.items;
      const out: Entry[] = [];
      // Bucket FIRST so it's the default selection (the smoke test equips it
      // by opening the bag and pressing SPACE with no prior navigation).
      if (items.bucket !== "none") {
        const filled = items.bucket === "filled";
        out.push({
          label: filled ? "Bucket (full)" : "Bucket (empty)",
          tag: items.equipped === "bucket" ? "  ✓" : "",
          icon: { sheet: "bucket", frame: filled ? 1 : 0 },
          detailTitle: filled ? "Bucket (full)" : "Bucket (empty)",
          detailBody: filled
            ? "Filled at the spigot. Equip it, then bring it to the coop to water the chickens."
            : "An empty pail from the shed. Equip it, then fill it at the spigot by the spring."
          // activate is wired in build-time below (needs the callbacks).
        });
      }
      if (items.coldPack) {
        out.push({
          label: "Cold Pack",
          detailTitle: "Cold Pack",
          detailBody: "Rosa's ice pack. Still cold. Might be worth trading."
        });
      }
      if (items.silverfin) {
        out.push({
          label: "Silverfin",
          detailTitle: "Silverfin",
          detailBody: "A silver fish from the Sunless Sea. One of Piggy's favorites."
        });
      }
      if (items.stinkySocks) {
        out.push({
          label: "Stinky Socks",
          detailTitle: "Stinky Socks",
          detailBody: "The miners' ripest socks. Reeks. Piggy can't resist the smell."
        });
      }
      if (items.oranges) {
        out.push({
          label: "Oranges",
          detailTitle: "Oranges",
          detailBody: "Sweet fruit from the oldest row of Sahra's underground grove."
        });
      }
      if (items.seaweed) {
        out.push({
          label: "Mint Kelp",
          detailTitle: "Mint Kelp",
          detailBody: "The crawlers' cultivated seaweed — the pizza's secret ingredient."
        });
      }
      if (items.shinies > 0) {
        out.push({
          label: `Shinies x${items.shinies}`,
          detailTitle: `Shinies (${items.shinies})`,
          detailBody: "Bright trinkets crows and pack rats hoard. A trader pays for shine."
        });
      }
      return out;
    }
  },
  {
    id: "party",
    title: "Party",
    emptyText: "No party members.",
    build: (s) => {
      const out: Entry[] = [];
      const level = levelForXp(s.hero.xp);
      const st = heroStats(s);
      out.push({
        label: "Joseph",
        icon: { sheet: "hero", frame: 0 },
        detailTitle: `Joseph  ·  Lv ${level}`,
        detailBody:
          `The boy from the crash.\n` +
          `HP ${st.hp}/${st.maxHp}\n` +
          `ATK ${st.attack}   DEF ${st.defense}\n` +
          `SPD ${st.speed}`
      });
      if (s.flags.piggyCaught) {
        out.push({
          label: "Piggy",
          icon: { sheet: "piggy", frame: 0 },
          detailTitle: "Piggy",
          detailBody: "The baby penguin Joseph crossed a whole desert to find. Safe now."
        });
      }
      if (s.flags.fluffballJoined) {
        out.push({
          label: "Fluffball",
          icon: { sheet: "fluffball", frame: 0 },
          detailTitle: "Fluffball",
          detailBody: "A second penguin, met down in the cold. Piggy's companion."
        });
      }
      if (s.flags.slitherJoined) {
        out.push({
          label: "Slither",
          icon: { sheet: "slither", frame: 0 },
          detailTitle: "Slither",
          detailBody: "A desert snake who fights at Joseph's side. Bite, Coil, Venom."
        });
      }
      return out;
    }
  },
  {
    id: "skills",
    title: "Skills",
    emptyText: "No skills learned yet.",
    build: (s) =>
      s.hero.perks.map((id) => {
        const def = PERKS.find((p) => p.id === id);
        const label = def?.label ?? id;
        return {
          label,
          detailTitle: label,
          detailBody: def ? `${def.description}. Chosen on level-up; stacks.` : id
        };
      })
  }
];

export class InventoryMenu {
  private scene: Phaser.Scene;
  private touch: boolean;
  private state: Act1State;
  private cb: InventoryCallbacks;

  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Graphics;
  private rowHighlight: Phaser.GameObjects.Graphics;
  private tabChips: Array<{ text: Phaser.GameObjects.Text; x1: number; x2: number }> = [];
  private tabUnderline: Phaser.GameObjects.Graphics;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private rowIcons: Array<Phaser.GameObjects.Sprite | null> = [];
  private detailIcon: Phaser.GameObjects.Sprite | null = null;
  private detailTitle: Phaser.GameObjects.Text;
  private detailBody: Phaser.GameObjects.Text;
  private emptyText: Phaser.GameObjects.Text;
  private touchButtons: TouchListButtons | null = null;

  private tab = 0;
  private sel = 0;
  private scroll = 0;
  private entries: Entry[] = [];

  private keyHandlers: Array<[string, () => void]> = [];
  private pointerHandler: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene, state: Act1State, callbacks: InventoryCallbacks) {
    this.scene = scene;
    this.state = state;
    this.cb = callbacks;
    this.touch = isTouchDevice(scene);

    const x = Math.round((scene.scale.width - PANEL_W) / 2);
    const y = Math.round((scene.scale.height - PANEL_H) / 2);

    this.bg = scene.add.graphics();
    this.rowHighlight = scene.add.graphics();
    this.tabUnderline = scene.add.graphics();

    const closeBtn = scene.add
      .text(PANEL_W - 8, 5, "✕", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.sand
      })
      .setOrigin(1, 0);

    const title = scene.add
      .text(10, 6, "STATUS", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.atbGold
      })
      .setOrigin(0, 0);

    this.emptyText = scene.add
      .text(LIST_X, CONTENT_TOP + 4, "", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand,
        wordWrap: { width: LIST_W }
      })
      .setOrigin(0, 0);

    this.detailTitle = scene.add.text(DETAIL_X, CONTENT_TOP + 6, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      color: PALETTE.atbGold,
      wordWrap: { width: DETAIL_W }
    });
    this.detailBody = scene.add.text(DETAIL_X, CONTENT_TOP + 40, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.sandLight,
      wordWrap: { width: DETAIL_W },
      lineSpacing: 3
    });

    const footer = scene.add
      .text(
        PANEL_W / 2,
        FOOTER_Y,
        this.touch
          ? "tap a tab · ▲▼ move · ✓ use · ✕ close"
          : "↑↓ move · ←→ tabs · SPACE use · ESC/I close",
        {
          fontFamily: "monospace",
          fontSize: "8px",
          color: PALETTE.mauve
        }
      )
      .setOrigin(0.5, 0);

    this.container = scene.add.container(x, y, [
      this.bg,
      this.rowHighlight,
      this.tabUnderline,
      title,
      closeBtn,
      this.emptyText,
      this.detailTitle,
      this.detailBody,
      footer
    ]);
    this.container.setScrollFactor(0).setDepth(5000);
    addToUiLayer(scene, this.container);

    this.drawFrame();
    this.buildTabChips();

    if (this.touch) {
      const contentH = FOOTER_Y - CONTENT_TOP;
      const btnColH = BTN_GAP * 2 + BTN_SIZE;
      const btnTop = CONTENT_TOP + Math.max(0, Math.round((contentH - btnColH) / 2));
      this.touchButtons = new TouchListButtons(
        scene,
        LIST_X + LIST_W - BTN_SIZE,
        btnTop,
        BTN_SIZE,
        BTN_GAP
      );
      this.container.add(this.touchButtons.container);
    }

    this.loadTab(0);

    const kb = scene.input.keyboard!;
    this.keyHandlers = [
      ["keydown-UP", () => this.move(-1)],
      ["keydown-DOWN", () => this.move(1)],
      ["keydown-W", () => this.move(-1)],
      ["keydown-S", () => this.move(1)],
      ["keydown-LEFT", () => this.switchTab(-1)],
      ["keydown-RIGHT", () => this.switchTab(1)],
      ["keydown-Q", () => this.switchTab(-1)],
      ["keydown-E", () => this.switchTab(1)],
      ["keydown-SPACE", () => this.activate()],
      ["keydown-ENTER", () => this.activate()],
      ["keydown-I", () => this.close()],
      ["keydown-ESC", () => this.close()]
    ];
    for (const [ev, fn] of this.keyHandlers) kb.on(ev, fn);
    this.pointerHandler = (p: Phaser.Input.Pointer) => this.tapAt(p);
    scene.input.on("pointerdown", this.pointerHandler);
  }

  private drawFrame(): void {
    const g = this.bg;
    g.clear();
    g.fillStyle(hexToInt(PALETTE.ink), 0.97);
    g.fillRect(0, 0, PANEL_W, PANEL_H);
    g.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    g.strokeRect(0.5, 0.5, PANEL_W - 1, PANEL_H - 1);
    // Divider between list and details, and a rule under the tab row.
    g.lineStyle(1, hexToInt(PALETTE.plum), 1);
    g.beginPath();
    g.moveTo(DIV_X, CONTENT_TOP - 4);
    g.lineTo(DIV_X, FOOTER_Y - 4);
    g.moveTo(6, CONTENT_TOP - 6);
    g.lineTo(PANEL_W - 6, CONTENT_TOP - 6);
    g.strokePath();
  }

  private buildTabChips(): void {
    let cx = LIST_X;
    for (let i = 0; i < TABS.length; i++) {
      const t = this.scene.add
        .text(cx, TABS_Y, TABS[i].title, {
          fontFamily: "monospace",
          fontSize: "9px",
          color: PALETTE.sand
        })
        .setOrigin(0, 0);
      this.container.add(t);
      this.tabChips.push({ text: t, x1: cx - 3, x2: cx + t.width + 3 });
      cx += t.width + 16;
    }
  }

  /** Switch to a fresh tab: rebuild entries and reset the cursor. */
  private loadTab(index: number): void {
    this.tab = ((index % TABS.length) + TABS.length) % TABS.length;
    this.sel = 0;
    this.scroll = 0;
    this.entries = this.buildEntries();
    this.rebuildRows();
    this.renderTabs();
    this.renderList();
  }

  private buildEntries(): Entry[] {
    const entries = TABS[this.tab].build(this.state);
    // Wire the bucket's equip action here (the tab data can't hold a closure
    // over the live callbacks). Any entry whose title is a bucket gets it.
    if (TABS[this.tab].id === "inventory") {
      for (const e of entries) {
        if (e.detailTitle.startsWith("Bucket")) e.activate = () => this.toggleBucket();
      }
    }
    return entries;
  }

  private toggleBucket(): void {
    const items = this.cb.onToggleBucket();
    this.state = { ...this.state, items };
    this.entries = this.buildEntries();
    this.rebuildRows();
    this.renderList();
  }

  private switchTab(delta: number): void {
    this.loadTab(this.tab + delta);
  }

  /** Destroy and recreate the visible list-row Text/Sprite objects. */
  private rebuildRows(): void {
    for (const t of this.rowTexts) t.destroy();
    for (const ic of this.rowIcons) ic?.destroy();
    this.rowTexts = [];
    this.rowIcons = [];
    this.detailIcon?.destroy();
    this.detailIcon = null;

    const textX = ICON_COL + 10;
    const textW = (this.touch ? LIST_W - BTN_SIZE - 8 : LIST_W) - (textX - LIST_X);
    const visible = Math.min(MAX_ROWS, this.entries.length);
    for (let r = 0; r < visible; r++) {
      const rowY = CONTENT_TOP + r * ROW_H;
      const t = this.scene.add
        .text(textX, rowY + ROW_H / 2, "", {
          fontFamily: "monospace",
          fontSize: "9px",
          color: PALETTE.bone,
          wordWrap: { width: textW }
        })
        .setOrigin(0, 0.5);
      this.container.add(t);
      this.rowTexts.push(t);
      this.rowIcons.push(null); // filled per-render (depends on scroll)
    }
  }

  private move(delta: number): void {
    if (this.entries.length === 0) return;
    this.sel = (this.sel + delta + this.entries.length) % this.entries.length;
    // Keep the selection inside the visible window.
    if (this.sel < this.scroll) this.scroll = this.sel;
    if (this.sel >= this.scroll + MAX_ROWS) this.scroll = this.sel - MAX_ROWS + 1;
    this.renderList();
  }

  private renderTabs(): void {
    for (let i = 0; i < this.tabChips.length; i++) {
      this.tabChips[i].text.setColor(i === this.tab ? PALETTE.atbGold : PALETTE.sand);
    }
    const chip = this.tabChips[this.tab];
    this.tabUnderline.clear();
    this.tabUnderline.fillStyle(hexToInt(PALETTE.atbGold), 1);
    this.tabUnderline.fillRect(chip.x1 + 3, TABS_Y + TAB_H, chip.x2 - chip.x1 - 6, 1);
  }

  private renderList(): void {
    const hl = this.rowHighlight;
    hl.clear();
    this.emptyText
      .setText(TABS[this.tab].emptyText)
      .setVisible(this.entries.length === 0);

    for (const ic of this.rowIcons) ic?.destroy();
    const rowW = (this.touch ? LIST_W - BTN_SIZE - 8 : LIST_W);

    for (let r = 0; r < this.rowTexts.length; r++) {
      const idx = this.scroll + r;
      const t = this.rowTexts[r];
      if (idx >= this.entries.length) {
        t.setText("").setVisible(false);
        this.rowIcons[r] = null;
        continue;
      }
      t.setVisible(true);
      const entry = this.entries[idx];
      const selected = idx === this.sel;
      t.setText(`${entry.label}${entry.tag ?? ""}`).setColor(
        selected ? PALETTE.atbGold : PALETTE.bone
      );
      if (selected) {
        hl.fillStyle(hexToInt(PALETTE.plum), 0.6);
        hl.fillRect(LIST_X - 3, CONTENT_TOP + r * ROW_H, rowW, ROW_H);
      }
      let icon: Phaser.GameObjects.Sprite | null = null;
      if (entry.icon) {
        icon = this.scene.add.sprite(
          ICON_COL,
          CONTENT_TOP + r * ROW_H + ROW_H / 2,
          entry.icon.sheet,
          entry.icon.frame
        );
        fitHeight(icon, 12);
        this.container.add(icon);
      }
      this.rowIcons[r] = icon;
    }
    // Keep highlight beneath row text/icons.
    for (const t of this.rowTexts) this.container.bringToTop(t);
    for (const ic of this.rowIcons) if (ic) this.container.bringToTop(ic);

    this.renderDetail();
  }

  private renderDetail(): void {
    this.detailIcon?.destroy();
    this.detailIcon = null;
    if (this.entries.length === 0) {
      this.detailTitle.setText("");
      this.detailBody.setText("");
      return;
    }
    const entry = this.entries[this.sel];
    if (entry.icon) {
      const ic = this.scene.add.sprite(
        DETAIL_X + 2,
        CONTENT_TOP + 4,
        entry.icon.sheet,
        entry.icon.frame
      );
      ic.setOrigin(0, 0);
      fitHeight(ic, 26);
      this.container.add(ic);
      this.detailIcon = ic;
      this.detailTitle.setText(entry.detailTitle).setX(DETAIL_X + 34).setY(CONTENT_TOP + 10);
    } else {
      this.detailTitle.setText(entry.detailTitle).setX(DETAIL_X).setY(CONTENT_TOP + 6);
    }
    this.detailBody.setText(entry.detailBody);
  }

  private activate(): void {
    const entry = this.entries[this.sel];
    entry?.activate?.();
  }

  private tapAt(p: Phaser.Input.Pointer): void {
    const localX = p.x - this.container.x;
    const localY = p.y - this.container.y;
    // Close button, wherever the panel has grown.
    if (localX >= PANEL_W - CLOSE_SIZE && localX <= PANEL_W && localY >= 0 && localY <= CLOSE_SIZE) {
      this.close();
      return;
    }
    // Tab chips.
    if (localY >= TABS_Y - 2 && localY <= TABS_Y + TAB_H + 2) {
      for (let i = 0; i < this.tabChips.length; i++) {
        if (localX >= this.tabChips[i].x1 && localX <= this.tabChips[i].x2) {
          this.loadTab(i);
          return;
        }
      }
    }
    // Touch ▲/✓/▼ column.
    if (this.touchButtons) {
      const hit = this.touchButtons.hitTest(localX, localY);
      if (hit === "up") return this.move(-1);
      if (hit === "down") return this.move(1);
      if (hit === "confirm") return this.activate();
    }
    // Direct tap on a list row.
    if (localX >= LIST_X - 3 && localX <= LIST_X + LIST_W) {
      const r = Math.floor((localY - CONTENT_TOP) / ROW_H);
      const idx = this.scroll + r;
      if (r >= 0 && r < this.rowTexts.length && idx < this.entries.length) {
        this.sel = idx;
        this.renderList();
        this.activate();
      }
    }
  }

  private close(): void {
    const kb = this.scene.input.keyboard!;
    for (const [ev, fn] of this.keyHandlers) kb.off(ev, fn);
    this.scene.input.off("pointerdown", this.pointerHandler);
    this.container.destroy();
    this.cb.onClose();
  }
}
