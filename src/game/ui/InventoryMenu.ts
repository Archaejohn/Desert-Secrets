/**
 * Inventory window — opened with the "I" key (or a tap on the bag
 * button). Lists what Joseph is carrying; selecting the bucket equips
 * or unequips it. Only an equipped item can be used out in the world
 * (at the spigot, at the coop). Styled to match PerkMenu: ink
 * background, gold border and highlight, self-contained input handlers
 * torn down on close so the underlying scene's controls resume cleanly.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import type { Act1State } from "../../core/gameState";

const PANEL_W = 220;
const ROW_H = 20;
const ROWS_TOP = 30;

interface Row {
  label: string;
  equippable: boolean;
}

function rowsFor(items: Act1State["items"]): Row[] {
  const rows: Row[] = [];
  if (items.bucket !== "none") {
    const state = items.bucket === "filled" ? "full" : "empty";
    const equipped = items.equipped === "bucket" ? " [EQUIPPED]" : "";
    rows.push({ label: `Bucket (${state})${equipped}`, equippable: true });
  }
  if (items.coldPack) rows.push({ label: "Cold Pack", equippable: false });
  return rows;
}

export class InventoryMenu {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private emptyText: Phaser.GameObjects.Text;
  private sel = 0;
  private rows: Row[];
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

    const panelH = ROWS_TOP + Math.max(1, this.rows.length) * ROW_H + 24;
    const x = Math.round((scene.scale.width - PANEL_W) / 2);
    const y = Math.round((scene.scale.height - panelH) / 2);

    const bg = scene.add.graphics();
    bg.fillStyle(hexToInt(PALETTE.ink), 0.96);
    bg.fillRect(0, 0, PANEL_W, panelH);
    bg.lineStyle(1, hexToInt(PALETTE.atbGold), 1);
    bg.strokeRect(0.5, 0.5, PANEL_W - 1, panelH - 1);

    const title = scene.add
      .text(PANEL_W / 2, 10, "INVENTORY", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5, 0);

    this.emptyText = scene.add
      .text(PANEL_W / 2, ROWS_TOP + 4, "You're not carrying anything.", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand
      })
      .setOrigin(0.5, 0)
      .setVisible(this.rows.length === 0);

    const footer = scene.add
      .text(PANEL_W / 2, panelH - 14, "SPACE equip · I close", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.mauve
      })
      .setOrigin(0.5, 0);

    this.container = scene.add.container(x, y, [bg, title, this.emptyText, footer]);
    this.container.setScrollFactor(0).setDepth(5000);

    for (let i = 0; i < this.rows.length; i++) {
      const row = scene.add.text(14, ROWS_TOP + i * ROW_H, "", {
        fontFamily: "monospace",
        fontSize: "10px",
        color: PALETTE.bone
      });
      this.container.add(row);
      this.rowTexts.push(row);
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
    for (let i = 0; i < this.rows.length; i++) {
      this.rowTexts[i]
        .setText(`${i === this.sel ? "▸ " : "  "}${this.rows[i].label}`)
        .setColor(i === this.sel ? PALETTE.atbGold : PALETTE.bone);
    }
  }

  private move(delta: number): void {
    if (this.rows.length === 0) return;
    this.sel = (this.sel + delta + this.rows.length) % this.rows.length;
    this.render();
  }

  private tapAt(p: Phaser.Input.Pointer): void {
    const localX = p.x - this.container.x;
    const localY = p.y - this.container.y - ROWS_TOP;
    if (localX < 0 || localX > PANEL_W || this.rows.length === 0) return;
    const row = Math.floor(localY / ROW_H);
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
