/**
 * Sunwasp — 24×24 grove guardian. A "sunstung" desert wasp that swarms to
 * defend Sahra's hidden orange grove: hot amber/gold body banded in ink,
 * a jointed sting, plum belly shade, and a pair of skyBlue/slate wings.
 * Seen side-on facing LEFT (the battle scene flips enemies to face the
 * party), the tonal-breather register — a nuisance guarding the fruit, not
 * a monster.
 *
 * Frames 0–1 idle: a hovering quiver — the body bobs a pixel and the wings
 * flick while a white glint catches the sting. Frames 2–5 move: a full
 * wingbeat (up / mid / down / mid) with the abdomen pulsing.
 *
 * Colourway: amber/atbGold thorax + abdomen, ink stripes and outline, plum
 * underside shade, skyBlue/slate wings, an amber eye with a white glint.
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const SUNWASP_FRAME = 24;

type WingPose = "up" | "mid" | "down";

interface WaspPose {
  /** Vertical body bob, in px. */
  dy: number;
  /** Wing sweep. */
  wing: WingPose;
  /** White glint on the sting/eye (idle tell). */
  glint: boolean;
}

const POSES: readonly WaspPose[] = [
  { dy: 0, wing: "mid", glint: false }, // 0 idle A
  { dy: -1, wing: "up", glint: true }, // 1 idle B: quiver + glint
  { dy: 0, wing: "up", glint: false }, // 2 beat up
  { dy: -1, wing: "mid", glint: false }, // 3 beat mid
  { dy: 0, wing: "down", glint: false }, // 4 beat down
  { dy: 1, wing: "mid", glint: false }, // 5 beat mid (low bob)
];

function drawWasp(p: WaspPose): PixelGrid {
  const g = new PixelGrid(SUNWASP_FRAME, SUNWASP_FRAME);
  const dy = p.dy;

  // --- abdomen: fat teardrop, amber banded with ink, tapering to a sting ---
  // (facing left, so the abdomen trails to the right)
  g.rect(12, 9 + dy, 7, 6, "amber");
  g.rect(13, 8 + dy, 5, 8, "amber");
  g.rect(18, 10 + dy, 2, 4, "atbGold"); // sunlit rear curve
  // ink warning bands
  g.rect(14, 8 + dy, 1, 8, "ink");
  g.rect(16, 8 + dy, 1, 8, "ink");
  g.rect(18, 9 + dy, 1, 6, "ink");
  // plum underside shade
  g.rect(13, 14 + dy, 6, 1, "plum");
  // the sting
  g.px(20, 12 + dy, "ink");
  g.px(21, 12 + dy, p.glint ? "white" : "ink");

  // --- thorax: rounder amber lump joining head and abdomen ---
  g.rect(8, 9 + dy, 5, 5, "amber");
  g.px(8, 9 + dy, "atbGold"); // lit shoulder
  g.px(9, 9 + dy, "atbGold");
  g.px(11, 13 + dy, "plum"); // belly shade

  // --- head: small, to the LEFT, with an amber eye ---
  g.rect(5, 9 + dy, 3, 4, "amber");
  g.px(5, 10 + dy, "atbGold");
  g.px(6, 10 + dy, p.glint ? "white" : "ink"); // eye

  // antennae
  g.px(4, 8 + dy, "ink");
  g.px(3, 7 + dy, "ink");
  g.px(5, 8 + dy, "ink");

  // --- legs: thin ink danglers under the thorax ---
  for (const lx of [7, 9, 11]) {
    g.px(lx, 14 + dy, "ink");
    g.px(lx, 15 + dy, "ink");
  }

  // --- wings: skyBlue membrane over slate ribs, sweeping with the beat ---
  const drawWing = (baseX: number) => {
    let top: number;
    let span: number;
    if (p.wing === "up") {
      top = 2 + dy;
      span = 6;
    } else if (p.wing === "mid") {
      top = 5 + dy;
      span = 4;
    } else {
      top = 8 + dy;
      span = 5;
    }
    for (let i = 0; i < 8; i++) {
      const x = baseX + i;
      const y = top + Math.round((i / 8) * span);
      g.px(x, y, "slate"); // leading rib
      g.px(x, y + 1, "skyBlue"); // membrane
      if (i < 6) g.px(x, y + 2, "skyBlue");
    }
  };
  drawWing(7); // forewing
  drawWing(10); // hindwing, slightly back

  rimTopLeft(g, { x: 4, y: 8 + dy, w: 6, h: 3 }); // sun on the head + thorax
  selOut(g);
  return g;
}

/** All 6 frames: 0–1 hover-quiver idle, 2–5 wingbeat. */
export function sunwaspFrames(): PixelGrid[] {
  return POSES.map(drawWasp);
}
