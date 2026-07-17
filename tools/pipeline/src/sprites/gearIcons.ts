/**
 * gearIcons — the Equipment-tab icon set (docs/CONTRACTS.md "v38").
 *
 * A static 16×16 icon sheet, 12 frames, one row of 12. Not a creature: no
 * idle/walk, each frame is a single flat symbol read at menu size. Two kinds:
 *
 *   CLASS / SLOT icons (frames 0–4), drawn in a muted `mauve`/`plum` so they
 *   read as ghosted PLACEHOLDERS — the Equipment tab shows them, dimmed, in an
 *   empty slot ("what goes here"): 0 hat · 1 weapon · 2 torso · 3 legs · 4 shoes.
 *
 *   ITEM icons (frames 5–11), drawn in full colour — the specific piece shown
 *   in the pool list and in a FILLED slot: 5 miner's hat · 6 stick · 7 pickaxe ·
 *   8 t-shirt · 9 jeans · 10 flip-flops · 11 frost feather. (The bucket keeps its
 *   own 2-frame `bucket` sheet — its icon reads empty/full off the fill-state —
 *   so it is deliberately NOT duplicated here.)
 *
 * Frame ORDER is the contract the UI indexes by (see GEAR_ICON_FRAME in
 * src/game/ui/equipmentIcons.ts). Append new icons; never reorder.
 */
import { PixelGrid } from "../grid";
import { selOut } from "./polish";

export const GEARICONS_FRAME = 16;

function grid(): PixelGrid {
  return new PixelGrid(GEARICONS_FRAME, GEARICONS_FRAME);
}

// --- Class / slot placeholders (muted mauve, ghosted) -----------------------

/** 0 — hat: a wide-brimmed hat silhouette. */
function slotHat(): PixelGrid {
  const g = grid();
  g.rect(6, 3, 4, 1, "mauve"); // crown top
  g.rect(5, 4, 6, 3, "mauve"); // crown body
  g.rect(3, 7, 10, 1, "mauve"); // brim
  g.rect(2, 8, 12, 1, "mauve"); // brim wide edge
  selOut(g);
  return g;
}

/** 1 — weapon: an upright sword. */
function slotWeapon(): PixelGrid {
  const g = grid();
  g.rect(7, 2, 2, 8, "mauve"); // blade
  g.px(7, 2, "mauve");
  g.rect(4, 10, 8, 1, "mauve"); // crossguard
  g.rect(7, 11, 2, 2, "mauve"); // grip
  g.rect(6, 13, 4, 1, "mauve"); // pommel
  selOut(g);
  return g;
}

/** 2 — torso: a short-sleeved tee. */
function slotTorso(): PixelGrid {
  const g = grid();
  g.rect(4, 4, 8, 2, "mauve"); // shoulder line
  g.rect(3, 5, 2, 3, "mauve"); // left sleeve
  g.rect(11, 5, 2, 3, "mauve"); // right sleeve
  g.rect(5, 6, 6, 7, "mauve"); // body
  g.px(7, 4, null); // neck notch
  g.px(8, 4, null);
  selOut(g);
  return g;
}

/** 3 — legs: a pair of trousers. */
function slotLegs(): PixelGrid {
  const g = grid();
  g.rect(5, 3, 6, 4, "mauve"); // waist + hips
  g.rect(5, 7, 2, 6, "mauve"); // left leg
  g.rect(9, 7, 2, 6, "mauve"); // right leg
  selOut(g);
  return g;
}

/** 4 — shoes: a side-profile sneaker — tall heel, low toe, thick sole. */
function slotShoes(): PixelGrid {
  const g = grid();
  g.rect(4, 5, 4, 4, "mauve"); // heel / ankle upper (tall at the back)
  g.px(8, 7, "mauve"); // instep step-down
  g.rect(8, 8, 3, 1, "mauve"); // vamp toward the toe
  g.px(11, 8, "mauve"); // rounded toe cap
  g.rect(3, 9, 10, 2, "mauve"); // thick sole running heel-to-toe
  selOut(g);
  return g;
}

// --- Item icons (full colour) -----------------------------------------------

/** 5 — miner's hat: a hard hat with a lit front lamp. */
function itemMinersHat(): PixelGrid {
  const g = grid();
  g.rect(6, 4, 4, 1, "amber"); // dome top
  g.rect(5, 5, 6, 3, "clay"); // dome body
  g.rect(5, 5, 6, 1, "amber"); // dome highlight
  g.rect(3, 8, 10, 1, "clay"); // brim
  g.rect(2, 9, 12, 1, "rust"); // brim edge
  g.px(7, 7, "atbGold"); // lamp
  g.px(8, 7, "atbGold");
  g.px(7, 6, "white"); // lamp glint
  selOut(g);
  return g;
}

/** 6 — stick: a stout diagonal branch with one twig. */
function itemStick(): PixelGrid {
  const g = grid();
  for (let i = 0; i < 8; i++) {
    g.px(4 + i, 12 - i, "clay");
    g.px(4 + i, 11 - i, "amber"); // lit upper edge
  }
  g.px(8, 6, "clay"); // twig stub
  g.px(9, 5, "clay");
  selOut(g);
  return g;
}

/** 7 — pickaxe: a curved twin-point steel head on a vertical wooden haft. */
function itemPickaxe(): PixelGrid {
  const g = grid();
  g.rect(7, 5, 2, 9, "clay"); // vertical haft
  g.rect(7, 5, 1, 9, "amber"); // haft highlight
  // steel head: a shallow downward arc, tips dipping below the centre bar
  g.rect(6, 4, 4, 1, "slate"); // centre bar over the haft
  g.px(5, 5, "slate");
  g.px(10, 5, "slate");
  g.px(4, 6, "slate"); // left point
  g.px(11, 6, "slate"); // right point
  g.px(3, 6, "skyBlue"); // tip glints
  g.px(12, 6, "skyBlue");
  selOut(g);
  return g;
}

/** 8 — t-shirt: the colour version of the torso icon (sky-blue cotton). */
function itemTshirt(): PixelGrid {
  const g = grid();
  g.rect(4, 4, 8, 2, "skyBlue"); // shoulder line
  g.rect(3, 5, 2, 3, "skyBlue"); // left sleeve
  g.rect(11, 5, 2, 3, "skyBlue"); // right sleeve
  g.rect(5, 6, 6, 7, "skyBlue"); // body
  g.rect(5, 6, 6, 1, "bone"); // top highlight
  g.px(7, 4, null); // neck notch
  g.px(8, 4, null);
  selOut(g);
  return g;
}

/** 9 — jeans: denim trousers. */
function itemJeans(): PixelGrid {
  const g = grid();
  g.rect(5, 3, 6, 4, "slate"); // waist + hips
  g.rect(5, 7, 2, 6, "indigo"); // left leg
  g.rect(9, 7, 2, 6, "indigo"); // right leg
  g.rect(5, 3, 6, 1, "skyBlue"); // belt highlight
  selOut(g);
  return g;
}

/** 10 — flip-flops: a pair of sandals with strap Vs. */
function itemFlipFlops(): PixelGrid {
  const g = grid();
  // left sandal
  g.rect(3, 9, 4, 2, "clay");
  g.px(4, 7, "mauve"); // strap
  g.px(5, 8, "mauve");
  g.px(6, 7, "mauve");
  // right sandal
  g.rect(9, 9, 4, 2, "clay");
  g.px(10, 7, "mauve"); // strap
  g.px(11, 8, "mauve");
  g.px(12, 7, "mauve");
  selOut(g);
  return g;
}

/** 11 — frost feather: an ice-blue plume with a bright rachis. */
function itemFrostFeather(): PixelGrid {
  const g = grid();
  // central rachis, upper-right to lower-left
  for (let i = 0; i < 9; i++) g.px(10 - i, 3 + i, "bone");
  // barbs off the rachis
  g.px(9, 3, "skyBlue");
  g.px(11, 4, "mint");
  g.px(8, 5, "skyBlue");
  g.px(10, 6, "mint");
  g.px(7, 6, "skyBlue");
  g.px(6, 7, "skyBlue");
  g.px(8, 8, "mint");
  g.px(5, 8, "skyBlue");
  g.px(6, 9, "skyBlue");
  g.px(4, 10, "skyBlue");
  g.px(11, 3, "white"); // cold glint
  selOut(g, { bone: "indigo", skyBlue: "indigo", mint: "indigo" });
  return g;
}

/** All twelve icons, in frame order (see file header). */
export function gearIconsFrames(): PixelGrid[] {
  return [
    slotHat(),
    slotWeapon(),
    slotTorso(),
    slotLegs(),
    slotShoes(),
    itemMinersHat(),
    itemStick(),
    itemPickaxe(),
    itemTshirt(),
    itemJeans(),
    itemFlipFlops(),
    itemFrostFeather(),
  ];
}
