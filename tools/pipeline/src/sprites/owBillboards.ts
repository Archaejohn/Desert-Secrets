/**
 * owBillboards — the Mode-7 overworld billboard sheet (docs/ART_DIRECTION
 * §4b, docs/CONTRACTS.md "Phase O"). Six bottom-anchored 48×40 standing
 * sprites drawn on transparent ground: three desert mountain-mass variants,
 * a joshua tree, the mine-mouth timber portal, and the overturned truck.
 *
 * Full FF6 3/4 treatment (ART_DIRECTION §1/§4b): light from the NNW (G1),
 * irregular peaks with an umber/plum zigzag crest, lit NW faces in
 * sand/clay, shaded SE faces in rust/plum (~50% of the mass), sel-out
 * contours in each material's darkest ramp value with ink only along the
 * bottom contact edge (G8), and no per-pixel speckle — texture is sparse
 * 2×2 crag clusters (G5/G6).
 */
import type { PaletteName } from "../../../../src/shared/palette";
import { PixelGrid } from "../grid";
import { mulberry32 } from "../rng";

export const OW_BILLBOARD_W = 48;
export const OW_BILLBOARD_H = 40;

/** Contract frame order (row-major indices 0..5). */
export const OW_BILLBOARD_NAMES = [
  "mountainMassA",
  "mountainMassB",
  "mountainMassC",
  "joshuaTree",
  "mineMouth",
  "truckWreck"
] as const;

export type OwBillboardName = (typeof OW_BILLBOARD_NAMES)[number];

function frame(): PixelGrid {
  return new PixelGrid(OW_BILLBOARD_W, OW_BILLBOARD_H);
}

/** Ink along the bottom contact edge only (G8). */
function inkContact(g: PixelGrid): void {
  for (let x = 0; x < g.width; x++) {
    if (g.get(x, g.height - 1) !== null) g.px(x, g.height - 1, "ink");
  }
}

interface Peak {
  ax: number;
  ay: number;
}

/**
 * One mountain mass: overlapping 45° peaks over a shared skirt. Crest
 * zigzag, lit-left/shaded-right flanks banded parallel to the crest, feet
 * darkening into umber. `cut` trims the skirt so the base is irregular.
 */
function mountainMass(peaks: Peak[], seed: number): PixelGrid {
  const g = frame();
  const H = OW_BILLBOARD_H;
  const rng = mulberry32(seed);
  // Irregular base cut: the mass does not slam into the frame corners.
  const baseCut: number[] = [];
  let cut = 2 + Math.floor(rng() * 2);
  for (let x = 0; x < OW_BILLBOARD_W; x++) {
    if (x % 5 === 0) cut = Math.max(0, Math.min(3, cut + (rng() < 0.5 ? -1 : 1)));
    baseCut.push(cut);
  }
  for (let x = 0; x < OW_BILLBOARD_W; x++) {
    let crestY = 999;
    let owner = peaks[0];
    for (const p of peaks) {
      const y = p.ay + Math.abs(x - p.ax);
      if (y < crestY) {
        crestY = y;
        owner = p;
      }
    }
    const baseY = H - 1 - (crestY > H - 10 ? baseCut[x] : 0);
    if (crestY > H - 4) continue; // keep a ragged, not-full-width base
    for (let y = crestY; y <= baseY; y++) {
      const dc = y - crestY;
      let c: PaletteName;
      if (dc === 0) {
        c = ((x + y) & 2) === 0 ? "umber" : "plum"; // zigzag ridge crest
      } else if (x <= owner.ax) {
        // lit NW flank: sand near the crest, clay body, umber toward the foot
        c = dc <= 5 ? "sand" : y >= H - 4 ? "umber" : "clay";
      } else {
        // shaded SE flank (~50%): rust upper, plum lower
        c = dc <= 7 ? "rust" : "plum";
      }
      g.px(x, y, c);
    }
  }
  // apex highlights + the arête fold zigzagging down from each apex
  for (const p of peaks) {
    g.px(p.ax, p.ay, "sandLight");
    g.px(p.ax - 1, p.ay + 1, "sandLight");
    for (let y = p.ay + 2; y < p.ay + 12 && y < H - 3; y++) {
      const fx = p.ax + ((y & 2) === 0 ? 0 : 1);
      if (g.get(fx, y) !== null) g.px(fx, y, "umber");
    }
  }
  // sparse 2×2 crag clusters (G5)
  let placed = 0;
  for (let i = 0; i < 24 && placed < 4; i++) {
    const x = 2 + Math.floor(rng() * (OW_BILLBOARD_W - 5));
    const y = 8 + Math.floor(rng() * (H - 14));
    const c = g.get(x, y);
    if (c === "clay" && g.get(x + 1, y + 1) === "clay") {
      g.rect(x, y, 2, 2, "rust");
      placed++;
    } else if (c === "rust" && g.get(x + 1, y + 1) === "rust") {
      g.rect(x, y, 2, 2, "plum");
      placed++;
    }
  }
  g.outline("plum"); // sel-out: rock's darkest ramp value (G8)
  inkContact(g);
  return g;
}

function mountainMassA(): PixelGrid {
  // one dominant peak with a right shoulder
  return mountainMass(
    [
      { ax: 18, ay: 3 },
      { ax: 36, ay: 14 }
    ],
    501
  );
}

function mountainMassB(): PixelGrid {
  // twin peaks, saddle between
  return mountainMass(
    [
      { ax: 12, ay: 8 },
      { ax: 33, ay: 5 }
    ],
    502
  );
}

function mountainMassC(): PixelGrid {
  // a long low ridge of three bumps
  return mountainMass(
    [
      { ax: 8, ay: 14 },
      { ax: 24, ay: 10 },
      { ax: 40, ay: 13 }
    ],
    503
  );
}

/** Spiky joshua rosette: teal core, jade spikes, mint tips on the lit arc. */
function rosette(l: PixelGrid, cx: number, cy: number): void {
  l.rect(cx - 3, cy - 1, 7, 3, "teal");
  l.rect(cx - 1, cy - 2, 3, 5, "teal");
  const spikes: Array<[number, number]> = [
    [-4, -2],
    [-2, -4],
    [1, -4],
    [3, -3],
    [4, 0],
    [4, 2],
    [-5, 0],
    [-4, 2],
    [1, 4],
    [-2, 4]
  ];
  for (const [dx, dy] of spikes) {
    l.px(cx + dx, cy + dy, "jade");
    l.px(cx + dx + (dx < 0 ? 1 : -1), cy + dy + (dy < 0 ? 1 : -1), "jade");
  }
  // NNW-lit tips (G1)
  l.px(cx - 2, cy - 4, "mint");
  l.px(cx - 4, cy - 2, "mint");
  l.px(cx - 1, cy - 2, "jade"); // lit core edge
}

function joshuaTree(): PixelGrid {
  const g = frame();
  const trunk = frame();
  // trunk with a low fork; bottom-anchored with a root flare
  trunk.rect(22, 14, 5, 26, "clay");
  trunk.rect(21, 36, 7, 4, "clay");
  trunk.rect(20, 38, 9, 2, "clay");
  // left arm
  trunk.rect(18, 16, 4, 3, "clay");
  trunk.rect(15, 12, 4, 5, "clay");
  // right arm
  trunk.rect(27, 18, 5, 3, "clay");
  trunk.rect(31, 13, 4, 6, "clay");
  // shaggy dead-leaf thatch (2px marks, SE side per G1)
  for (let y = 16; y < 38; y += 3) {
    trunk.rect(26, y, 2, 1, "rust");
    trunk.rect(21, y + 1, 2, 1, "rust");
  }
  trunk.rect(16, 15, 2, 1, "rust");
  trunk.rect(32, 17, 2, 1, "rust");
  // lit NW edge
  for (let y = 14; y < 39; y += 2) trunk.px(22, y, "amber");
  trunk.outline("umber"); // sel-out: wood's dark ramp value
  g.blit(trunk, 0, 0);

  const crown = frame();
  rosette(crown, 24, 8); // top rosette
  rosette(crown, 13, 10); // left arm rosette
  rosette(crown, 35, 11); // right arm rosette
  crown.outline("tealDeep"); // sel-out: foliage's dark ramp value
  g.blit(crown, 0, 0);
  inkContact(g);
  return g;
}

function mineMouth(): PixelGrid {
  const g = frame();
  const mound = frame();
  // rock mound the portal is cut into (rounded, lit on the NW arc)
  for (let y = 10; y < 40; y++) {
    const half = Math.min(22, 6 + (y - 10) * 1.2);
    mound.rect(Math.round(24 - half), y, Math.round(half * 2), 1, "mauve");
  }
  // lit upper-left arc, shaded lower-right (G1)
  for (let y = 10; y < 22; y++) {
    const half = Math.min(22, 6 + (y - 10) * 1.2);
    mound.rect(Math.round(24 - half), y, 3, 1, "clay");
  }
  for (let y = 24; y < 40; y++) mound.rect(Math.round(24 + Math.min(22, 6 + (y - 10) * 1.2)) - 4, y, 4, 1, "plum");
  mound.outline("plum");
  g.blit(mound, 0, 0);
  // the dark mouth
  g.rect(16, 22, 16, 18, "ink");
  g.rect(17, 20, 14, 2, "ink");
  // timber frame: posts + header beam (lamplit top edge)
  const timber = frame();
  timber.rect(13, 20, 3, 20, "clay");
  timber.rect(32, 20, 3, 20, "clay");
  timber.rect(12, 17, 24, 3, "clay");
  timber.rect(12, 17, 24, 1, "amber");
  // grain + iron nails
  timber.rect(14, 24, 1, 12, "rust");
  timber.rect(33, 24, 1, 12, "rust");
  timber.px(14, 21, "ink");
  timber.px(33, 21, "ink");
  timber.outline("umber");
  g.blit(timber, 0, 0);
  inkContact(g);
  return g;
}

function truckWreck(): PixelGrid {
  const g = frame();
  const l = frame();
  // cargo box lying on its side, roof toward the viewer-left, resting on
  // the ground line (bottom-anchored)
  l.rect(4, 22, 26, 18, "bone");
  l.rect(4, 22, 26, 2, "sandLight"); // sun on the upturned flank
  l.rect(4, 38, 26, 2, "sand"); // ground shade
  for (const x of [9, 15, 21]) l.rect(x, 24, 2, 14, "sand"); // corrugation
  // torn rear doors at the left end
  l.rect(4, 26, 3, 12, "plum");
  l.px(3, 28, "plum");
  l.px(3, 29, "plum");
  l.rect(6, 30, 2, 4, "ink"); // dark interior
  // cab, jackknifed against the box, nose down-right
  l.rect(30, 26, 13, 14, "rust");
  l.rect(30, 26, 13, 2, "clay"); // lit top
  l.rect(39, 30, 4, 4, "skyBlue"); // windshield askew
  l.px(41, 31, "ink"); // crack
  l.px(40, 32, "ink");
  l.rect(30, 38, 13, 2, "plum"); // skirt
  // wheels in the air on the box's up side
  l.rect(10, 18, 5, 4, "ink");
  l.px(12, 19, "slate");
  l.rect(20, 18, 5, 4, "ink");
  l.px(22, 19, "slate");
  // one thrown wheel beside the cab
  l.rect(44, 34, 4, 6, "ink");
  l.px(45, 36, "slate");
  l.outline("plum"); // sel-out body contour
  g.blit(l, 0, 0);
  // spilled crates hint
  g.rect(0, 37, 3, 3, "clay");
  g.px(0, 37, "amber");
  inkContact(g);
  return g;
}

/** All 6 frames in contract order (see OW_BILLBOARD_NAMES). */
export function owBillboardFrames(): PixelGrid[] {
  return [
    mountainMassA(),
    mountainMassB(),
    mountainMassC(),
    joshuaTree(),
    mineMouth(),
    truckWreck()
  ];
}
