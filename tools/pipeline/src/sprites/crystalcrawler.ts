/**
 * Crystalcrawler — 24×24, a gila-like crawler grown over with ice crystals,
 * seen from above with the head up-screen.
 *
 * Same low quadruped rig as the gila (breathing flanks, diagonal leg pairs,
 * sweeping tail) but the hide is slate with indigo banding, and jade /
 * skyBlue crystal clusters have erupted through the back. A white glint
 * alternates between the two clusters every frame, so the crystals sparkle
 * while it crawls. Frames: 0–1 idle (breath + glint swap), 2–5 heavy crawl.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const CRYSTALCRAWLER_FRAME = 24;

interface CrawlerPose {
  /** 1 = flanks swollen one pixel wider (breath). */
  breath: 0 | 1;
  /** Leg phase: neutral, or the two diagonal pairs of a walk. */
  legs: "stand" | "A" | "B";
  /** Tail sweep: -1 left, 0 straight, 1 right. */
  tail: -1 | 0 | 1;
  /** Which crystal cluster carries the white glint this frame. */
  glint: 0 | 1;
}

const CRAWLER_POSES: readonly CrawlerPose[] = [
  { breath: 0, legs: "stand", tail: 0, glint: 0 }, // 0 idle A
  { breath: 1, legs: "stand", tail: 1, glint: 1 }, // 1 idle B: breath, glint swaps
  { breath: 0, legs: "A", tail: -1, glint: 0 }, // 2 heavy crawl
  { breath: 1, legs: "B", tail: 0, glint: 1 }, // 3
  { breath: 0, legs: "A", tail: 1, glint: 0 }, // 4
  { breath: 1, legs: "B", tail: 0, glint: 1 } // 5
];

/** Stubby splayed leg, slate with an ink claw. phase: -1 back, 0 out, 1 fwd. */
function leg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y - phase, "slate");
  g.px(x + dir * 2, y - phase, "ink");
  g.px(x + dir * 2, y - phase + 1, "ink"); // claw
}

function drawCrawler(p: CrawlerPose): PixelGrid {
  const g = new PixelGrid(CRYSTALCRAWLER_FRAME, CRYSTALCRAWLER_FRAME);
  const b = p.breath;

  // --- blunt head, frosted ---
  g.rect(9, 3, 6, 4, "indigo");
  g.px(9, 3, "slate"); // dull sheen
  g.px(10, 3, "slate");
  g.px(10, 4, "mint"); // cold eyes
  g.px(13, 4, "mint");

  // --- body: wide, low; flanks swell with the breath ---
  g.rect(8 - b, 7, 8 + 2 * b, 9, "slate"); // trunk
  g.rect(9 - b, 16, 6 + 2 * b, 1, "slate"); // hips
  // indigo banding across the back (the old bead pattern, frozen over)
  for (let y = 8; y <= 15; y++) {
    for (let x = 8 - b; x < 16 + b; x++) {
      const band = Math.floor((y - 8) / 2) % 2 === 0;
      if (band && (x + y) % 2 === 0) g.px(x, y, "indigo");
    }
  }
  // skyBlue light along the left flank
  g.px(8 - b, 8, "skyBlue");
  g.px(8 - b, 10, "skyBlue");
  g.px(8 - b, 12, "skyBlue");
  // indigo shade on the right flank
  g.px(15 + b, 9, "indigo");
  g.px(15 + b, 11, "indigo");
  g.px(15 + b, 13, "indigo");

  // --- crystal growth erupting through the back ---
  // jade cluster over the shoulders
  g.rect(10, 9, 4, 3, "jade");
  g.px(11, 8, "jade"); // spire tips
  g.px(12, 8, "jade");
  g.px(10, 9, "mint"); // lit facet
  g.px(11, 8, "mint");
  // skyBlue cluster over the hips
  g.rect(9, 13, 3, 2, "skyBlue");
  g.px(10, 12, "skyBlue");
  g.px(9, 13, "mint");
  // stray shards along the flank
  g.px(14, 12, "jade");
  g.px(13, 14, "skyBlue");
  // the alternating sparkle
  if (p.glint === 0) g.px(12, 9, "white");
  else g.px(10, 13, "white");

  // --- tail: thick, tapering, crystal-ringed, sweeps as it walks ---
  const t = p.tail;
  g.rect(10 + t, 17, 4, 2, "slate");
  g.px(10 + t, 17, "indigo"); // band ring
  g.px(12 + t, 18, "indigo");
  g.rect(11 + t * 2, 19, 3, 2, "slate");
  g.px(12 + t * 2, 19, "skyBlue"); // frost ring
  g.px(11 + t * 3, 21, "slate"); // blunt tip
  g.px(12 + t * 3, 21, "slate");

  rimTopLeft(g, { x: 8, y: 2, w: 7, h: 4 }); // cold sheen on the frosted head
  selOut(g);

  // --- four splayed legs, diagonal pairs (drawn after the outline) ---
  const front = 9;
  const back = 14;
  let lf = 0;
  let rf = 0;
  if (p.legs !== "stand") {
    lf = p.legs === "A" ? 1 : -1;
    rf = -lf;
  }
  leg(g, 7 - b, front, -1, lf); // front-left
  leg(g, 16 + b, front, 1, rf); // front-right
  leg(g, 7 - b, back, -1, rf); // back-left (opposite diagonal)
  leg(g, 16 + b, back, 1, lf); // back-right

  return g;
}

/** All 6 frames: 0–1 idle, 2–5 heavy crawl with alternating crystal glint. */
export function crystalcrawlerFrames(): PixelGrid[] {
  return CRAWLER_POSES.map(drawCrawler);
}
