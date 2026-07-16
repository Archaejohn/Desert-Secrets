/**
 * The Lurker — 32×32 Act 3 mini-boss, the huge fish that keeps stealing the
 * lure off the floe. Seen side-on and facing LEFT (the battle scene flips
 * enemies to face the party).
 *
 * A slab-bodied slate/indigo leviathan: a vast hooked jaw crammed with bone
 * fangs, a single amber eye that flares white on the idle inhale, heavy
 * rust/clay fins, and — dangling from the corner of its mouth — the bitten
 * fishing line with the stolen amber lure still on the hook. Frames 0–1
 * idle (slow breath + eye flare + lure sway), 2–5 a heavy tail-driven surge.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const LURKER_FRAME = 32;

interface LurkerPose {
  /** 1 = body swollen a pixel taller (slow breath). */
  breath: 0 | 1;
  /** Tail sweep: -1 up, 0 straight, 1 down. */
  tail: -1 | 0 | 1;
  /** Jaw: 0 set, 1 gaped wider. */
  jaw: 0 | 1;
  /** The amber eye flares white-hot. */
  flare: boolean;
  /** Stolen lure sway offset. */
  lure: -1 | 0 | 1;
}

const LURKER_POSES: readonly LurkerPose[] = [
  { breath: 0, tail: 0, jaw: 0, flare: false, lure: 0 }, // 0 idle A
  { breath: 1, tail: 0, jaw: 1, flare: true, lure: 1 }, // 1 idle B: inhale, eye flares
  { breath: 0, tail: -1, jaw: 1, flare: false, lure: -1 }, // 2 surge
  { breath: 1, tail: 1, jaw: 0, flare: false, lure: 0 },
  { breath: 0, tail: -1, jaw: 1, flare: false, lure: 1 },
  { breath: 1, tail: 1, jaw: 0, flare: false, lure: -1 }
];

function drawLurker(p: LurkerPose): PixelGrid {
  const g = new PixelGrid(LURKER_FRAME, LURKER_FRAME);
  const b = p.breath;

  // --- slab body (facing left: jaw at the left) ---
  g.rect(9, 9 - b, 17, 15 + 2 * b, "slate");
  g.rect(10, 8 - b, 15, 1, "slate"); // rounded back
  g.rect(10, 24 + b, 15, 1, "slate"); // rounded belly
  // indigo depth along the lower half
  g.rect(9, 18, 17, 6 + b, "indigo");
  // skyBlue lit dorsal line
  g.rect(11, 9 - b, 12, 1, "skyBlue");
  g.px(12, 10 - b, "skyBlue");
  // scale banding
  for (let y = 11; y <= 22; y += 3) {
    for (let x = 12; x <= 24; x += 3) g.px(x, y, "indigo");
  }
  // pale belly seam
  g.rect(12, 23 + b, 10, 1, "slate");

  // --- huge hooked jaw at the left ---
  const j = p.jaw;
  g.rect(3, 12, 7, 8 + j, "slate"); // jaw mass
  g.rect(2, 14, 2, 4 + j, "slate"); // snout tip
  g.px(2, 13, "ink"); // maw depth
  g.px(3, 15, "ink");
  g.px(4, 17, "ink");
  g.px(5, 19 + j, "ink");
  // bone fangs, upper and lower row
  for (const fx of [4, 6, 8]) g.px(fx, 12, "bone");
  for (const fx of [4, 6, 8]) g.px(fx, 19 + j, "bone");
  g.px(3, 14, "bone");
  g.px(3, 17 + j, "bone");
  // gill slash
  g.px(11, 13, "ink");
  g.px(11, 15, "ink");
  g.px(11, 17, "ink");

  // --- the amber eye, flaring on the inhale ---
  g.px(9, 11, "amber");
  g.px(10, 11, "amber");
  g.px(9, 12, "ink");
  if (p.flare) {
    g.px(10, 10, "white");
    g.px(11, 11, "skyBlue");
    g.px(9, 10, "skyBlue");
  }

  // --- heavy rust/clay fins ---
  // dorsal fin ridge
  g.px(15, 6 - b, "rust");
  g.px(17, 6 - b, "rust");
  g.px(19, 7 - b, "rust");
  g.rect(15, 7 - b, 6, 1, "clay");
  // pectoral fin
  g.rect(12, 21 + b, 4, 2, "rust");
  g.px(12, 23 + b, "clay");
  g.px(15, 22 + b, "clay");

  // --- tail at the right, sweeps with the surge ---
  const t = p.tail;
  g.rect(26, 12 + t, 3, 9, "slate");
  g.px(29, 10 + t, "rust");
  g.px(30, 8 + t, "rust");
  g.px(29, 22 + t, "rust");
  g.px(30, 24 + t, "rust");
  g.rect(27, 14 + t, 2, 5, "indigo");
  g.px(28, 16 + t, "skyBlue");

  rimTopLeft(g, { x: 9, y: 7 - b, w: 10, h: 4 }); // pale light down the back
  selOut(g, { bone: "indigo" });

  // --- the stolen lure: bitten line trailing from the jaw corner ---
  const s = p.lure;
  g.px(2, 20 + j, "bone"); // line
  g.px(1, 22 + j + s, "bone");
  g.px(1, 24 + j + s, "amber"); // the stolen esca
  g.px(0, 24 + j + s, "amber");
  g.px(1, 23 + j + s, "white");
  g.px(0, 25 + j + s, "rust"); // hook

  return g;
}

/** All 6 frames: 0–1 idle (breath + eye flare), 2–5 heavy surge. */
export function lurkerFrames(): PixelGrid[] {
  return LURKER_POSES.map(drawLurker);
}
