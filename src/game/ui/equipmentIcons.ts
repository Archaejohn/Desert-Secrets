/**
 * Frame indices into the `gearIcons` sheet, and the item→icon lookup the
 * Equipment tab draws with. This is the ENGINE-SIDE half of the frame contract
 * whose art half lives in tools/pipeline/src/sprites/gearIcons.ts — the two
 * MUST stay in lockstep (the sheet is sha256-pinned, so a reorder there breaks
 * a determinism test; a reorder here silently mismatches, so don't). Frames:
 *   0 hat · 1 weapon · 2 torso · 3 legs · 4 shoes   (muted slot placeholders)
 *   5 minersHat · 6 stick · 7 pickaxe · 8 tshirt · 9 jeans · 10 flipFlops ·
 *   11 frostFeather                                  (colour item icons)
 * The bucket is the one item NOT on this sheet — it keeps its own two-frame
 * `bucket` sheet so its icon reflects the fill-state — so `iconForItem` special
 * -cases it.
 */
import type { Act1State } from "../../core/gameState";
import type { EquipId, EquipSlot } from "../../core/equipment";

/** The grayed slot/class placeholder frame for each slot (empty-slot art). */
export const SLOT_ICON_FRAME: Record<EquipSlot, number> = {
  hat: 0,
  weapon: 1,
  torso: 2,
  legs: 3,
  shoes: 4,
};

/** Colour item-icon frame on `gearIcons`, per item (bucket excluded — see below). */
const ITEM_ICON_FRAME: Record<Exclude<EquipId, "bucket">, number> = {
  minersHat: 5,
  stick: 6,
  pickaxe: 7,
  tshirt: 8,
  jeans: 9,
  flipFlops: 10,
  frostFeather: 11,
};

export interface IconRef {
  sheet: string;
  frame: number;
}

/** The sprite (sheet + frame) that depicts an owned item. The bucket reads its
 *  fill-state off run state (empty frame 0 / full frame 1); everything else is a
 *  flat frame on `gearIcons`. */
export function iconForItem(state: Act1State, id: EquipId): IconRef {
  if (id === "bucket") {
    return { sheet: "bucket", frame: state.items.bucket === "filled" ? 1 : 0 };
  }
  return { sheet: "gearIcons", frame: ITEM_ICON_FRAME[id] };
}

/** The grayed placeholder icon for an empty slot. */
export function iconForSlot(slot: EquipSlot): IconRef {
  return { sheet: "gearIcons", frame: SLOT_ICON_FRAME[slot] };
}
