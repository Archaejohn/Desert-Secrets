/**
 * Reef Stalker — 24×24 Act 6 reef predator, seen side-on and facing LEFT (the
 * battle scene flips enemies to face the party).
 *
 * The hunter of the crawlers' garden — a bulky, armoured deep-reef fish, NOT
 * the peaceful crystal-crawlers themselves: a heavy slate/tealDeep body, an
 * oversized bone-toothed gulper maw, a spiny rust/amber dorsal ridge, a hot
 * hpRed eye and flaring gill, and a scatter of cold skyBlue/mint biolights
 * down its flank (it lures prey in the dark kelp rows). Deliberately distinct
 * from Act 3's slim jade Reef Eel and the crab-shaped Crystal Crawler.
 *
 * Frames 0–1 idle: the jaw works and the gill flares while a biolight glints.
 * Frames 2–5 lunge: a full tail sweep (back / mid / fore / mid) with the maw
 * snapping, the swim toward the party.
 *
 * Colourway: slate/tealDeep body, indigo shade, rust/amber dorsal spines,
 * bone teeth, hpRed eye + gill, skyBlue/mint biolights, ink outline.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const REEFSTALKER_FRAME = 24;

type Sweep = "back" | "mid" | "fore";

interface StalkerPose {
  /** Tail sweep position. */
  sweep: Sweep;
  /** Jaw open amount, in px. */
  jaw: 0 | 1 | 2;
  /** Gill flare (idle tell) + a biolight glint. */
  flare: boolean;
}

const POSES: readonly StalkerPose[] = [
  { sweep: "mid", jaw: 0, flare: false }, // 0 idle A
  { sweep: "mid", jaw: 1, flare: true }, // 1 idle B: jaw + gill flare
  { sweep: "back", jaw: 2, flare: false }, // 2 lunge wind-up
  { sweep: "mid", jaw: 1, flare: false }, // 3 lunge mid
  { sweep: "fore", jaw: 2, flare: true }, // 4 lunge strike
  { sweep: "mid", jaw: 0, flare: false }, // 5 recover
];

function drawStalker(p: StalkerPose): PixelGrid {
  const g = new PixelGrid(REEFSTALKER_FRAME, REEFSTALKER_FRAME);

  // --- body: a heavy oval bulk, centre-frame, tapering toward the tail ---
  g.rect(7, 8, 11, 8, "slate");
  g.rect(8, 7, 8, 10, "slate");
  g.rect(9, 6, 6, 12, "tealDeep"); // deep dorsal mass
  g.rect(8, 14, 9, 3, "indigo"); // shaded underside
  // lit upper flank
  g.rect(9, 7, 6, 1, "skyBlue");
  g.px(8, 8, "skyBlue");

  // --- cold biolights strung down the flank (its lure in the dark rows) ---
  const lit = (x: number, y: number) => g.px(x, y, p.flare ? "mint" : "skyBlue");
  lit(11, 11);
  lit(14, 12);
  g.px(9, 12, "mint");
  g.px(16, 10, "skyBlue");
  if (p.flare) g.px(12, 9, "white"); // a glint

  // --- spiny dorsal ridge: rust/amber spines along the back ---
  for (const [sx, sy] of [
    [8, 6],
    [10, 5],
    [12, 5],
    [14, 6],
    [16, 7],
  ] as const) {
    g.px(sx, sy, "rust");
    g.px(sx, sy - 1, "amber");
  }

  // --- head + gulper maw at the LEFT (facing the party) ---
  g.rect(4, 8, 4, 7, "slate");
  g.rect(3, 9, 2, 5, "tealDeep");
  g.px(5, 9, "hpRed"); // eye
  g.px(6, 9, "ink");
  // a flaring red gill slit behind the head
  g.px(8, 11, p.flare ? "hpRed" : "indigo");
  g.px(8, 12, p.flare ? "hpRed" : "indigo");

  // the maw: a wedge that gapes open by `jaw` px, dark throat, bone fangs
  const j = p.jaw;
  g.rect(1, 11, 4, 1, "ink"); // upper jaw line
  g.rect(1, 13 + j, 4, 1, "ink"); // lower jaw drops with j
  g.rect(2, 12, 3, 1 + j, "plum"); // throat
  // bone fangs top and bottom
  g.px(2, 12, "bone");
  g.px(4, 12, "bone");
  g.px(2, 12 + j, "bone");
  g.px(4, 12 + j, "bone");

  // --- pectoral fin fanning under the body ---
  const finY = 15;
  for (const fx of [9, 10, 11] as const) g.px(fx, finY + (fx % 2), "teal");

  // --- tail fin at the RIGHT, sweeping with the lunge ---
  let tailTop: number;
  if (p.sweep === "back") tailTop = 6;
  else if (p.sweep === "fore") tailTop = 11;
  else tailTop = 8;
  g.rect(18, tailTop, 2, 6, "teal");
  g.px(20, tailTop - 1, "tealDeep");
  g.px(20, tailTop, "teal");
  g.px(20, tailTop + 6, "tealDeep");
  g.px(21, tailTop + (p.sweep === "back" ? -1 : p.sweep === "fore" ? 7 : 3), "teal");
  // lit tail edge
  g.px(18, tailTop, "jade");

  rimTopLeft(g, { x: 3, y: 7, w: 6, h: 4 }); // biolight wash on the brow
  selOut(g, { bone: "indigo" });
  return g;
}

/** All 6 frames: 0–1 idle (jaw + gill flare), 2–5 lunging swim. */
export function reefstalkerFrames(): PixelGrid[] {
  return POSES.map(drawStalker);
}
