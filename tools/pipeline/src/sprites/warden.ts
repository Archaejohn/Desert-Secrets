/**
 * Warden — the Rime Warden, a 32×32 ancient beetle-construct guarding the
 * sanctum, seen from above.
 *
 * Built with the queen's heavyweight techniques: a carapace spanning the
 * frame, eight thick legs churning in alternating diagonal sets, a slow
 * breath that swells the whole bulk. But where the queen is chitin, the
 * Warden is machine: slate plates banded with indigo, glazed under a bone
 * ice sheath, bone frost prongs instead of mandibles — and a single amber
 * core pixel burning at its centre, which flares white on idle frame 1.
 * Frames: 0–1 idle (breath + core flare), 2–5 slow heavy leg churn.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const WARDEN_FRAME = 32;

interface WardenPose {
  /** 1 = carapace swollen a pixel wider/taller (slow breath). */
  breath: 0 | 1;
  /** The amber core flares (white-hot centre + skyBlue rays). */
  flare: boolean;
  /** Leg phase: planted, or the two alternating diagonal sets. */
  legs: "stand" | "A" | "B";
  /** Frost prongs: 0 closed, 1 spread. */
  prong: 0 | 1;
}

const WARDEN_POSES: readonly WardenPose[] = [
  { breath: 0, flare: false, legs: "stand", prong: 0 }, // 0 idle A: dormant
  { breath: 1, flare: true, legs: "stand", prong: 0 }, // 1 idle B: inhale, core flares
  { breath: 0, flare: false, legs: "A", prong: 1 }, // 2 churn
  { breath: 0, flare: false, legs: "B", prong: 0 }, // 3
  { breath: 1, flare: false, legs: "A", prong: 1 }, // 4
  { breath: 0, flare: false, legs: "B", prong: 0 } // 5
];

/** One heavy leg: two pixels thick at the haunch, clawed. */
function heavyLeg(g: PixelGrid, x: number, y: number, dir: number, phase: number): void {
  g.px(x + dir, y, "ink");
  g.px(x + dir, y + 1, "ink"); // thick haunch
  g.px(x + dir * 2, y - phase, "ink");
  g.px(x + dir * 3, y - phase, "ink");
  g.px(x + dir * 4, y + 1 - phase * 2, "ink"); // claw
}

function drawWarden(p: WardenPose): PixelGrid {
  const g = new PixelGrid(WARDEN_FRAME, WARDEN_FRAME);
  const b = p.breath;

  // --- head block: slate under a bone ice cap ---
  g.rect(11, 5, 10, 4, "slate");
  g.rect(12, 4, 8, 1, "slate");
  g.rect(12, 3, 8, 1, "bone"); // ice cap
  g.px(13, 2, "bone"); // frozen spurs
  g.px(16, 2, "bone");
  g.px(19, 2, "bone");
  g.px(13, 6, "mint"); // cold lidless eyes
  g.px(18, 6, "mint");
  g.px(14, 5, "indigo"); // visor seam
  g.px(17, 5, "indigo");

  // --- bone frost prongs reaching forward ---
  const m = p.prong;
  g.px(12 - m, 4, "bone");
  g.px(11 - m, 3, "bone");
  g.px(11 - m * 2, 2, "bone");
  g.px(10 - m * 2, 1, "bone");
  g.px(19 + m, 4, "bone");
  g.px(20 + m, 3, "bone");
  g.px(20 + m * 2, 2, "bone");
  g.px(21 + m * 2, 1, "bone");

  // --- pronotum collar: indigo plate, skyBlue-lit rim, slate rivets ---
  g.rect(9 - b, 9, 14 + 2 * b, 3, "indigo");
  g.rect(9 - b, 9, 5, 1, "skyBlue"); // lit rim
  g.px(10 - b, 10, "slate"); // rivets
  g.px(15, 10, "slate");
  g.px(21 + b, 10, "slate");

  // --- carapace: vast slate plating, swells with the breath ---
  g.rect(7 - b, 12, 18 + 2 * b, 1, "slate");
  g.rect(6 - b, 13, 20 + 2 * b, 12 + b, "slate"); // main bulk
  g.rect(7 - b, 25 + b, 18 + 2 * b, 2, "slate");
  g.rect(9 - b, 27 + b, 14 + 2 * b, 1, "slate");
  g.rect(11, 28 + b, 10, 1, "slate");
  // indigo underplates showing at the skirts
  g.rect(6 - b, 22, 3, 3, "indigo");
  g.rect(23 + b, 22, 3, 3, "indigo");
  g.rect(9 - b, 26 + b, 4, 1, "indigo");
  g.rect(19, 26 + b, 4 + b, 1, "indigo");
  // indigo plate bands riveted across the shell
  g.rect(8 - b, 16, 6, 1, "indigo");
  g.rect(18, 16, 6 + b, 1, "indigo");
  g.rect(8 - b, 21, 6, 1, "indigo");
  g.rect(18, 21, 6 + b, 1, "indigo");
  g.px(10 - b, 16, "slate"); // rivet heads
  g.px(21, 16, "slate");
  g.px(10 - b, 21, "slate");
  g.px(21, 21, "slate");
  // bone ice sheath glazing the dome, thickest top-left
  g.rect(7 - b, 13, 6, 1, "bone");
  g.rect(6 - b, 14, 3, 5, "bone");
  g.px(9 - b, 14, "bone");
  g.px(9 - b, 15, "bone");
  g.rect(18, 13, 5, 1, "bone"); // rime creeping over the far shoulder
  g.px(24 + b, 17, "bone"); // frozen drips down the right flank
  g.px(24 + b, 18, "bone");
  g.px(23 + b, 24, "bone");
  g.rect(12, 27 + b, 4, 1, "bone"); // ice fringe at the tail skirt
  g.px(7 - b, 14, "white"); // glints in the glaze
  g.px(19, 13, "white");
  // indigo depth down the right flank
  for (let y = 14; y <= 24; y++) g.px(25 + b, y, "indigo");
  // central keel seam
  for (let y = 12; y <= 28 + b; y++) g.px(15, y, "ink");
  for (let y = 12; y <= 28 + b; y++) g.px(16, y, "ink");

  // --- the core socket, set into the keel ---
  g.rect(14, 17, 4, 3, "indigo");
  g.px(14, 17, "slate"); // socket rim catching light
  g.px(17, 19, "ink"); // socket depth
  g.px(15, 18, "amber"); // THE core: a single amber pixel
  if (p.flare) {
    g.px(16, 18, "white"); // white-hot flare beside the core
    g.px(15, 17, "white");
    g.px(14, 18, "skyBlue"); // rays washing the socket
    g.px(15, 19, "skyBlue");
    g.px(16, 17, "skyBlue");
  }

  rimTopLeft(g, { x: 9, y: 0, w: 13, h: 7 }); // light along the ice cap
  selOut(g, { bone: "indigo" }); // the ice sheath contours cool, not warm

  // --- eight heavy legs, alternating diagonal sets ---
  const attachY = [13, 17, 21, 25];
  attachY.forEach((y, i) => {
    let left = 0;
    let right = 0;
    if (p.legs !== "stand") {
      const a = p.legs === "A" ? 1 : -1;
      left = i % 2 === 0 ? a : -a;
      right = -left;
    }
    heavyLeg(g, 5 - b, y + (i === 3 ? b : 0), -1, left);
    heavyLeg(g, 26 + b, y + (i === 3 ? b : 0), 1, right);
  });

  return g;
}

/** All 6 frames: 0–1 idle (core flares on 1), 2–5 slow heavy churn. */
export function wardenFrames(): PixelGrid[] {
  return WARDEN_POSES.map(drawWarden);
}
