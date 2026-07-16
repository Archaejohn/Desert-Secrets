/**
 * Gila — 24×24 gila monster, seen from above, head up-screen.
 *
 * Rust hide with ink beaded banding (the checker "bead" texture real gilas
 * wear), blunt ink head with bone eyes, thick tail that sways as it crawls.
 * Frames: 0–1 idle (tongue flick + a slow breath swelling the flanks),
 * 2–5 low crawl (legs alternate diagonally, tail sweeps side to side).
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const GILA_FRAME = 24;

interface GilaPose {
  /** Tongue out (idle flick). */
  tongue: boolean;
  /** 1 = flanks swollen one pixel wider (breath). */
  breath: 0 | 1;
  /** Leg phase: neutral, or the two diagonal pairs of a walk. */
  legs: "stand" | "A" | "B";
  /** Tail sweep: -1 left, 0 straight, 1 right. */
  tail: -1 | 0 | 1;
}

const GILA_POSES: readonly GilaPose[] = [
  { tongue: false, breath: 0, legs: "stand", tail: 0 }, // 0 idle A
  { tongue: true, breath: 1, legs: "stand", tail: 1 }, // 1 idle B: flick + breath
  { tongue: false, breath: 0, legs: "A", tail: -1 }, // 2 crawl
  { tongue: false, breath: 1, legs: "B", tail: 0 }, // 3
  { tongue: true, breath: 0, legs: "A", tail: 1 }, // 4
  { tongue: false, breath: 1, legs: "B", tail: 0 } // 5
];

/** Stubby splayed leg. phase: -1 back, 0 out, 1 forward. */
function leg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y - phase, "rust");
  g.px(x + dir * 2, y - phase, "ink");
  g.px(x + dir * 2, y - phase + 1, "ink"); // claw
}

function drawGila(p: GilaPose): PixelGrid {
  const g = new PixelGrid(GILA_FRAME, GILA_FRAME);
  const b = p.breath;

  // --- blunt head ---
  g.rect(9, 3, 6, 4, "ink");
  g.px(9, 3, "plum"); // dull sheen
  g.px(10, 3, "plum");
  g.px(10, 4, "bone"); // eyes
  g.px(13, 4, "bone");
  if (p.tongue) {
    g.px(11, 1, "rust"); // forked flick
    g.px(12, 2, "rust");
    g.px(11, 2, "rust");
  }

  // --- body: wide, low; flanks swell with the breath ---
  g.rect(8 - b, 7, 8 + 2 * b, 9, "rust"); // trunk
  g.rect(9 - b, 16, 6 + 2 * b, 1, "rust"); // hips
  // beaded banding: ink checker bands across the back
  for (let y = 8; y <= 15; y++) {
    for (let x = 8 - b; x < 16 + b; x++) {
      const band = Math.floor((y - 8) / 2) % 2 === 0;
      if (band && (x + y) % 2 === 0) g.px(x, y, "ink");
    }
  }
  // clay light along the left flank
  g.px(8 - b, 8, "clay");
  g.px(8 - b, 10, "clay");
  g.px(8 - b, 12, "clay");
  // umber shade down the right flank (shadowOf[rust] — G2 on-ramp shade)
  g.px(15 + b, 9, "umber");
  g.px(15 + b, 11, "umber");
  g.px(15 + b, 13, "umber");
  g.px(15 + b, 15, "umber");

  // --- tail: thick, tapering, sweeps as it walks ---
  const t = p.tail;
  g.rect(10 + t, 17, 4, 2, "rust");
  g.px(10 + t, 17, "ink"); // bead ring
  g.px(12 + t, 18, "ink");
  g.rect(11 + t * 2, 19, 3, 2, "rust");
  g.px(12 + t * 2, 19, "ink");
  g.px(11 + t * 3, 21, "rust"); // blunt tip
  g.px(12 + t * 3, 21, "rust");

  rimTopLeft(g, { x: 8, y: 2, w: 7, h: 4 }); // dull sheen on the blunt head
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

/** All 6 frames: 0–1 idle, 2–5 low crawl. */
export function gilaFrames(): PixelGrid[] {
  return GILA_POSES.map(drawGila);
}
