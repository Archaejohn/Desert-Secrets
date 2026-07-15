/**
 * Inventory window — opened with the "I" key (or a tap on the bag
 * button). Each row shows the item's actual icon (drawn from its sprite
 * sheet) plus its name; the highlighted row's description shows below in
 * a detail panel with a bigger icon and flavor text. Selecting the
 * bucket row equips or unequips it — only an equipped item can be used
 * out in the world (at the spigot, at the coop).
 *
 * Closing is deliberately redundant — ESC, "I" again, or a tap on the
 * always-visible ✕ in the corner — because a touch-only player has no
 * ESC key at all: without an on-screen close control there was no way
 * out of this menu on a phone. Manual hit-testing (not Phaser's
 * per-object interactivity) is used throughout, matching PerkMenu, so
 * the ✕ and the rows share one simple pointerdown handler.
 *
 * Styled to match PerkMenu: ink background, gold border and highlight,
 * self-contained input handlers torn down on close so the underlying
 * scene's controls resume cleanly.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import type { Act1State } from "../../core/gameState";

const PANEL_W = 260;
const ICON = 16;
const ROW_H = 24;
const ROWS_TOP = 28;
const DETAIL_H = 46;
const FOOTER_H = 16;
const CLOSE_SIZE = 18;

interface ItemRow {
  label: string;
  description: string;
  icon: { sheet: string; frame: number } | null;
  equippable: boolean;
  equipped: boolean;
}

function rowsFor(items: Act1State["items"]): ItemRow[] {
  const rows: ItemRow[] = [];
  if (items.bucket !== "none") {
    const filled = items.bucket === "filled";
    rows.push({
      label: filled ? "Bucket (full)" : "Bucket (empty)",
      description: filled
        ? "Filled at the spigot. Equip it, then bring it to the coop to water the chickens."
        : "An empty pail from the shed. Equip it, then fill it at the spigot by the spring.",
      icon: { sheet: "bucket", frame: filled ? 1 : 0 },
      equippable: true,
      equipped: items.equipped === "bucket"
    });
  }
  if (items.coldPack) {
    rows.push({
      label: "Cold Pack",
      description: "Rosa's ice pack. Still cold. Might be worth trading.",
      icon: null,
      equippable: false,
      equipped: false
    });
  }
  return rows;
}

export class InventoryMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private rowIcons: Array<Phaser.GameObjects.Sprite | null> = [];
  private rowHighlight: Phaser.GameObjects.Graphics;
  private detailIcon: Phaser.GameObjects.Sprite | null = null;
  private detailText: Phaser.GameObjects.Text;
  private emptyText: Phaser.GameObjects.Text;
  private sel = 0;
  private rows: ItemRow[];
  private panelH: number;
  private onToggleBucket: () => Act1State["items"];
  private onClose: () => void;
  private keyHandlers: Array<[string, () => void]> = [];
  private pointerHandler: (p: Phaser.Input.Pointer) => void;

  constructor(
    scene: Phaser.Scene,
    items: Act1State["items"],
    onToggleBucket: () => Act1State["items"],
    onClose: () => void
  ) {
    this.scene = scene;
    this.onToggleBucket = onToggleBucket;
    this.onClose = onClose;
    this.rows = rowsFor(items);

    const detailArea = this.rows.length > 0 ? DETAIL_H : 0;
    this.panelH = ROWS_TOP + Math.max(1, this.rows.length) * ROW_H + detailArea + FOOTER_H + 6;
    const x = Math.round((scene.scale.width - PANEL_W) / 2);
    const y = Math.round((scene.scale.height - this.panelH) / 2);

    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.97);
    bg.fillRect(0, 0, PANEL_W, this.panelH);
    bg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    bg.strokeRect(0.5, 0.5, PANEL_W - 1, this.panelH - 1);

    const title = scene.add
      .text(PANEL_W / 2, 10, "INVENTORY", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5, 0);

    const closeBtn = scene.add
      .text(PANEL_W - 8, 6, "✕", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.sand
      })
      .setOrigin(1, 0);

    this.emptyText = scene.add
      .text(PANEL_W / 2, ROWS_TOP + 4, "You're not carrying anything.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand
      })
      .setOrigin(0.5, 0)
      .setVisible(this.rows.length === 0);

    this.rowHighlight = scene.add.graphics();

    const detailTop = ROWS_TOP + this.rows.length * ROW_H + 6;
    this.detailText = scene.add.text(14 + ICON * 2 + 10, detailTop, "", {
      fontFamily: "monospace",
      fontSize: "8px",
      color: PALETTE.sandLight,
      wordWrap: { width: PANEL_W - (14 + ICON * 2 + 10) - 14 },
      lineSpacing: 2
    });

    const footer = scene.add
      .text(PANEL_W / 2, this.panelH - 14, "SPACE/tap equip · ESC, I or ✕ close", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.mauve
      })
      .setOrigin(0.5, 0);

    this.container = scene.add.container(x, y, [
      bg,
      this.rowHighlight,
      title,
      closeBtn,
      this.emptyText,
      this.detailText,
      footer
    ]);
    this.container.setScrollFactor(0).setDepth(5000);

    for (let i = 0; i < this.rows.length; i++) {
      const rowY = ROWS_TOP + i * ROW_H + ROW_H / 2;
      const row = this.rows[i];
      let icon: Phaser.GameObjects.Sprite | null = null;
      if (row.icon) {
        icon = scene.add.sprite(14 + ICON / 2, rowY, row.icon.sheet, row.icon.frame);
        this.container.add(icon);
      }
      this.rowIcons.push(icon);
      const label = scene.add
        .text(14 + ICON + 8, rowY, "", {
          fontFamily: "monospace",
          fontSize: "10px",
          color: PALETTE.bone
        })
        .setOrigin(0, 0.5);
      this.container.add(label);
      this.rowTexts.push(label);
    }

    if (this.rows.length > 0) {
      const dIcon = this.rows[0].icon;
      this.detailIcon = dIcon
        ? scene.add.sprite(14 + ICON, detailTop + ICON, dIcon.sheet, dIcon.frame).setScale(2)
        : null;
      if (this.detailIcon) this.container.add(this.detailIcon);
    }

    this.render();

    const kb = scene.input.keyboard!;
    this.keyHandlers = [
      ["keydown-UP", () => this.move(-1)],
      ["keydown-DOWN", () => this.move(1)],
      ["keydown-SPACE", () => this.activate()],
      ["keydown-ENTER", () => this.activate()],
      ["keydown-I", () => this.close()],
      ["keydown-ESC", () => this.close()]
    ];
    for (const [ev, fn] of this.keyHandlers) kb.on(ev, fn);
    this.pointerHandler = (p: Phaser.Input.Pointer) => this.tapAt(p);
    scene.input.on("pointerdown", this.pointerHandler);
  }

  private render(): void {
    const highlight = this.rowHighlight;
    highlight.clear();
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows[i];
      const selected = i === this.sel;
      const equippedTag = row.equipped ? "  ✓ equipped" : "";
      this.rowTexts[i].setText(`${row.label}${equippedTag}`).setColor(selected ? PALETTE.atbGold : PALETTE.bone);
      if (selected) {
        highlight.fillStyle(hexToInt(PALETTE.plum), 0.6);
        highlight.fillRect(6, ROWS_TOP + i * ROW_H, PANEL_W - 12, ROW_H);
      }
    }
    // Graphics redraw beneath everything each render(); keep icons/labels
    // on top of the freshly-drawn highlight rect.
    for (const icon of this.rowIcons) if (icon) this.container.bringToTop(icon);
    for (const t of this.rowTexts) this.container.bringToTop(t);

    if (this.rows.length === 0) return;
    const sel = this.rows[this.sel];
    this.detailText.setText(sel.description);
    if (this.detailIcon) {
      if (sel.icon) this.detailIcon.setTexture(sel.icon.sheet, sel.icon.frame).setVisible(true);
      else this.detailIcon.setVisible(false);
    }
  }

  private move(delta: number): void {
    if (this.rows.length === 0) return;
    this.sel = (this.sel + delta + this.rows.length) % this.rows.length;
    this.render();
  }

  private tapAt(p: Phaser.Input.Pointer): void {
    const localX = p.x - this.container.x;
    const localY = p.y - this.container.y;
    // The close button always works, wherever else the panel has grown.
    if (localX >= PANEL_W - CLOSE_SIZE && localX <= PANEL_W && localY >= 0 && localY <= CLOSE_SIZE) {
      this.close();
      return;
    }
    if (localX < 0 || localX > PANEL_W || this.rows.length === 0) return;
    const row = Math.floor((localY - ROWS_TOP) / ROW_H);
    if (row < 0 || row >= this.rows.length) return;
    this.sel = row;
    this.activate();
  }

  private activate(): void {
    const row = this.rows[this.sel];
    if (!row?.equippable) return;
    const items = this.onToggleBucket();
    this.rows = rowsFor(items);
    this.render();
  }

  private close(): void {
    const kb = this.scene.input.keyboard!;
    for (const [ev, fn] of this.keyHandlers) kb.off(ev, fn);
    this.scene.input.off("pointerdown", this.pointerHandler);
    this.container.destroy();
    this.onClose();
  }
}
