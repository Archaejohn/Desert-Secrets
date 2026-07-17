/**
 * The Equipment tab's bespoke, near-fullscreen PER-CHARACTER view — a distinct
 * layout from the shared list/detail framework the other tabs use, so
 * InventoryMenu hands the whole content area to this panel when the Equipment
 * tab is active (mount) and takes it back on tab-switch/close (unmount).
 *
 * Three columns (icons over words throughout):
 *   LEFT   — a stack of square sprite-buttons, one per party member you have
 *            (no names); the highlighted one is the character being dressed.
 *   MIDDLE — the shared item POOL: every owned equippable as an icon + a free
 *            count (FF6 availability = owned − equipped-across-everyone), grayed
 *            when the selected character can't wear it (tag lock / none free).
 *   RIGHT  — the selected character's five slots (hat·weapon·torso·legs·shoes):
 *            the worn item's icon, or a grayed slot placeholder icon when empty,
 *            plus a compact buffed-stat readout up top.
 *
 * Input (routed in from InventoryMenu): ↑↓ move the pool cursor · ←→ change
 * character · SPACE toggles the highlighted item on the current character (equip
 * if free & eligible, unequip if that character already wears it). Touch taps a
 * character button, a pool row (toggles), or a filled slot (unequips).
 *
 * State: the panel holds the authoritative run state while mounted (it mutates
 * through the equip/unequip callbacks, which persist), and hands the latest back
 * via `currentState()` so InventoryMenu can resync when the panel unmounts.
 */
import Phaser from "phaser";
import { PALETTE, hexToInt } from "../../shared/palette";
import {
  availableCount,
  equippedSlotsFor,
  ownedCount,
  type Act1State,
} from "../../core/gameState";
import {
  EQUIPMENT,
  EQUIP_SLOTS,
  equipmentById,
  hasNoBuffs,
  itemAllowsTags,
  BUFF_STATS,
  type EquipId,
  type EquipSlot,
} from "../../core/equipment";
import { availablePartyIds, rosterById, type RosterId } from "../../core/roster";
import { iconForItem, iconForSlot } from "./equipmentIcons";

export interface EquipPanelCallbacks {
  /** Equip `id` on `charId`; returns the updated items for a live re-render. */
  onEquip: (charId: RosterId, id: EquipId) => Act1State["items"];
  /** Take whatever `charId` wears in `slot` off; returns the updated items. */
  onUnequip: (charId: RosterId, slot: EquipSlot) => Act1State["items"];
}

// Column geometry (container-local; assumes the enlarged ~456×250 window).
const CHAR_X = 32; // centre of the character button column
const CHAR_BTN = 40;
const CHAR_Y0 = 54;
const CHAR_STEP = 46;

const POOL_X = 64; // left edge of the pool column
const POOL_ICON_X = 76;
const POOL_NAME_X = 96;
const POOL_STATUS_X = 292; // right edge for right-aligned status
const POOL_Y0 = 54;
const POOL_ROW_H = 22;

const SLOT_X = 302; // left edge of the slot column
const SLOT_ICON_X = 316;
const SLOT_NAME_X = 340;
const SLOT_Y0 = 82; // first slot row centre (clears the name + stat header)
const SLOT_ROW_H = 30;

const STATUS_Y = 222; // the one-line detail readout, bottom of the pool

/** Short buff string, e.g. "ATK +2  SPD -1" (empty items → "plain"). */
function buffLabel(id: EquipId): string {
  const item = equipmentById(id);
  if (!item || hasNoBuffs(item)) return "plain";
  const names: Record<(typeof BUFF_STATS)[number], string> = {
    attack: "ATK",
    defense: "DEF",
    speed: "SPD",
  };
  return BUFF_STATS.filter((k) => item.buffs[k] !== undefined)
    .map((k) => {
      const v = item.buffs[k] as number;
      return `${names[k]} ${v > 0 ? "+" : ""}${v}`;
    })
    .join("  ");
}

export class EquipmentPanel {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private state: Act1State;
  private cb: EquipPanelCallbacks;

  private chars: RosterId[] = [];
  private pool: EquipId[] = [];
  private charIdx = 0;
  private cursor = 0;

  /** Objects recreated on every refresh (cleared first). */
  private dynamic: Phaser.GameObjects.GameObject[] = [];
  /** Persistent chrome (dividers) drawn once on mount. */
  private chrome: Phaser.GameObjects.Graphics | null = null;

  constructor(
    scene: Phaser.Scene,
    container: Phaser.GameObjects.Container,
    state: Act1State,
    cb: EquipPanelCallbacks
  ) {
    this.scene = scene;
    this.container = container;
    this.state = state;
    this.cb = cb;
  }

  currentState(): Act1State {
    return this.state;
  }

  mount(): void {
    this.chars = availablePartyIds(this.state);
    if (this.charIdx >= this.chars.length) this.charIdx = 0;
    this.chrome = this.scene.add.graphics();
    this.container.add(this.chrome);
    this.chrome.lineStyle(1, hexToInt(PALETTE.plum), 1);
    this.chrome.beginPath();
    this.chrome.moveTo(POOL_X - 6, 46);
    this.chrome.lineTo(POOL_X - 6, 232);
    this.chrome.moveTo(SLOT_X - 6, 46);
    this.chrome.lineTo(SLOT_X - 6, 232);
    this.chrome.strokePath();
    this.refresh();
  }

  unmount(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.chrome?.destroy();
    this.chrome = null;
  }

  // --- input (routed from InventoryMenu) ---

  moveItem(delta: number): void {
    if (this.pool.length === 0) return;
    this.cursor = (this.cursor + delta + this.pool.length) % this.pool.length;
    this.refresh();
  }

  changeChar(delta: number): void {
    if (this.chars.length === 0) return;
    this.charIdx = (this.charIdx + delta + this.chars.length) % this.chars.length;
    this.refresh();
  }

  /** SPACE / ✓ — toggle the highlighted pool item on the current character. */
  toggle(): void {
    const id = this.pool[this.cursor];
    const charId = this.chars[this.charIdx];
    if (!id || !charId) return;
    const item = equipmentById(id);
    if (!item) return;
    const worn = equippedSlotsFor(this.state, charId)[item.slot] === id;
    const items = worn
      ? this.cb.onUnequip(charId, item.slot)
      : this.cb.onEquip(charId, id);
    this.state = { ...this.state, items };
    this.refresh();
  }

  tapAt(localX: number, localY: number): void {
    // Character button column.
    if (localX >= CHAR_X - CHAR_BTN / 2 && localX <= CHAR_X + CHAR_BTN / 2) {
      for (let i = 0; i < this.chars.length; i++) {
        const y = CHAR_Y0 + i * CHAR_STEP;
        if (localY >= y - CHAR_BTN / 2 && localY <= y + CHAR_BTN / 2) {
          this.charIdx = i;
          this.refresh();
          return;
        }
      }
    }
    // Pool rows.
    if (localX >= POOL_X - 4 && localX <= POOL_STATUS_X + 4) {
      const r = Math.floor((localY - (POOL_Y0 - POOL_ROW_H / 2)) / POOL_ROW_H);
      if (r >= 0 && r < this.pool.length) {
        this.cursor = r;
        this.toggle();
        return;
      }
    }
    // Filled slots on the right — tap to unequip.
    if (localX >= SLOT_X - 4) {
      const charId = this.chars[this.charIdx];
      if (!charId) return;
      const slots = equippedSlotsFor(this.state, charId);
      for (let i = 0; i < EQUIP_SLOTS.length; i++) {
        const y = SLOT_Y0 + i * SLOT_ROW_H;
        if (localY >= y - SLOT_ROW_H / 2 && localY <= y + SLOT_ROW_H / 2) {
          const slot = EQUIP_SLOTS[i];
          if (slots[slot]) {
            this.state = { ...this.state, items: this.cb.onUnequip(charId, slot) };
            this.refresh();
          }
          return;
        }
      }
    }
  }

  // --- rendering ---

  private buildPool(): void {
    const s = this.state;
    const out: EquipId[] = [];
    for (const slot of EQUIP_SLOTS) {
      for (const item of EQUIPMENT) {
        if (item.slot === slot && ownedCount(s, item.id) > 0) out.push(item.id);
      }
    }
    this.pool = out;
    if (this.cursor >= out.length) this.cursor = Math.max(0, out.length - 1);
  }

  private addText(
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    origin: [number, number] = [0, 0.5]
  ): Phaser.GameObjects.Text {
    const t = this.scene.add
      .text(x, y, text, { fontFamily: "monospace", fontSize: `${size}px`, color })
      .setOrigin(origin[0], origin[1]);
    this.container.add(t);
    this.dynamic.push(t);
    return t;
  }

  private addIcon(x: number, y: number, sheet: string, frame: number, px: number, dim: boolean): void {
    const sp = this.scene.add.sprite(x, y, sheet, frame).setOrigin(0.5, 0.5);
    const h = sp.height || px;
    sp.setScale(px / h);
    if (dim) sp.setAlpha(0.4);
    this.container.add(sp);
    this.dynamic.push(sp);
  }

  private addHighlight(x: number, y: number, w: number, h: number): void {
    const g = this.scene.add.graphics();
    g.fillStyle(hexToInt(PALETTE.plum), 0.6);
    g.fillRect(x, y, w, h);
    this.container.add(g);
    this.dynamic.push(g);
  }

  private refresh(): void {
    for (const o of this.dynamic) o.destroy();
    this.dynamic = [];
    this.buildPool();

    const charId = this.chars[this.charIdx];

    // LEFT — character sprite-buttons.
    for (let i = 0; i < this.chars.length; i++) {
      const id = this.chars[i];
      const y = CHAR_Y0 + i * CHAR_STEP;
      const box = this.scene.add.graphics();
      box.fillStyle(hexToInt(PALETTE.ink), 1);
      box.fillRect(CHAR_X - CHAR_BTN / 2, y - CHAR_BTN / 2, CHAR_BTN, CHAR_BTN);
      box.lineStyle(1, hexToInt(i === this.charIdx ? PALETTE.atbGold : PALETTE.plum), 1);
      box.strokeRect(CHAR_X - CHAR_BTN / 2 + 0.5, y - CHAR_BTN / 2 + 0.5, CHAR_BTN - 1, CHAR_BTN - 1);
      this.container.add(box);
      this.dynamic.push(box);
      const entry = rosterById(id);
      const sp = this.scene.add.sprite(CHAR_X, y + 2, entry.sprite, entry.baseFrame).setOrigin(0.5, 0.5);
      const scale = Math.min(2, (CHAR_BTN - 8) / (sp.height || CHAR_BTN));
      sp.setScale(scale);
      if (i !== this.charIdx) sp.setAlpha(0.7);
      this.container.add(sp);
      this.dynamic.push(sp);
    }

    if (!charId) return;
    const charTags = rosterById(charId).tags;
    const slots = equippedSlotsFor(this.state, charId);

    // MIDDLE — the item pool.
    for (let r = 0; r < this.pool.length; r++) {
      const id = this.pool[r];
      const item = equipmentById(id)!;
      const y = POOL_Y0 + r * POOL_ROW_H;
      const worn = slots[item.slot] === id;
      const eligible = itemAllowsTags(item, charTags);
      const avail = availableCount(this.state, id);
      const usable = worn || (eligible && avail > 0);
      if (r === this.cursor) this.addHighlight(POOL_X - 4, y - POOL_ROW_H / 2, POOL_STATUS_X - POOL_X + 8, POOL_ROW_H);
      const icon = iconForItem(this.state, id);
      this.addIcon(POOL_ICON_X, y, icon.sheet, icon.frame, 14, !usable);
      const nameColor = r === this.cursor ? PALETTE.atbGold : usable ? PALETTE.bone : PALETTE.mauve;
      this.addText(POOL_NAME_X, y, item.name, 9, nameColor);
      const status = worn ? "✓ worn" : !eligible ? "locked" : avail > 0 ? `×${avail}` : "in use";
      const statusColor = worn ? PALETTE.jade : avail > 0 && eligible ? PALETTE.sand : PALETTE.mauve;
      this.addText(POOL_STATUS_X, y, status, 8, statusColor, [1, 0.5]);
    }
    if (this.pool.length === 0) {
      this.addText(POOL_NAME_X, POOL_Y0, "No gear yet.", 9, PALETTE.sand);
    }

    // The one-line detail readout for the highlighted item.
    const hi = this.pool[this.cursor];
    if (hi) {
      const item = equipmentById(hi)!;
      const eligible = itemAllowsTags(item, charTags);
      const detail = !eligible ? `${item.name} · penguin only` : `${item.name} · ${buffLabel(hi)}`;
      this.addText(POOL_X, STATUS_Y, detail, 8, PALETTE.sandLight);
    }

    // RIGHT — the selected character's five slots + a stat readout.
    const stats = rosterById(charId).statsFor(this.state);
    this.addText(SLOT_X, 50, rosterById(charId).name, 10, PALETTE.atbGold);
    this.addText(
      SLOT_X,
      64,
      `ATK ${stats.attack}  DEF ${stats.defense}  SPD ${stats.speed}`,
      8,
      PALETTE.sandLight
    );
    for (let i = 0; i < EQUIP_SLOTS.length; i++) {
      const slot = EQUIP_SLOTS[i];
      const y = SLOT_Y0 + i * SLOT_ROW_H;
      const wornId = slots[slot];
      const box = this.scene.add.graphics();
      box.lineStyle(1, hexToInt(PALETTE.plum), 1);
      box.strokeRect(SLOT_X + 0.5, y - SLOT_ROW_H / 2 + 2.5, 140, SLOT_ROW_H - 6);
      this.container.add(box);
      this.dynamic.push(box);
      if (wornId) {
        const icon = iconForItem(this.state, wornId);
        this.addIcon(SLOT_ICON_X, y, icon.sheet, icon.frame, 16, false);
        this.addText(SLOT_NAME_X, y, equipmentById(wornId)!.name, 9, PALETTE.bone);
      } else {
        const icon = iconForSlot(slot);
        this.addIcon(SLOT_ICON_X, y, icon.sheet, icon.frame, 16, true);
        this.addText(SLOT_NAME_X, y, "—", 9, PALETTE.mauve);
      }
    }
  }
}
