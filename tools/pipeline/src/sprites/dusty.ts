/**
 * Dusty — the giant pack rat of Last Chance Fuel, 24×24, seen in profile
 * facing RIGHT (the Trail scene's NPC placement never flips him).
 *
 * A desert hoarder with twitchy energy: a chunky clay body over a sand
 * belly, two oversized round ears (his silhouette signature), a pointed
 * ever-sniffing snout, and a long BALD tail curling behind him — pack rats
 * carry no fluff there. Frames 0–1 idle: he clutches a shiny trinket to his
 * chest while the ears swivel, the nose lifts and the whiskers flick — a
 * hoarder counting his treasure. Frames 2–5 scurry: a low stretched dash
 * with alternating leg pairs, bouncing body and whipping tail.
 *
 * Colourway (§6 desert palette): clay coat, sand belly/muzzle, umber
 * low/right shading and sel-out contour, amber trinket, ink eye. Whiskers
 * and the bald tail are stamped AFTER the sel-out pass so they stay one
 * pixel thin (the pipeline's hair-thin-detail idiom).
 */
import { PixelGrid } from "../grid";
import { rimTopLeft, selOut } from "./polish";

export const DUSTY_FRAME = 24;

interface DustyPose {
  /** 1 = head dips toward the trinket / ground (sniff-bob). */
  bob: 0 | 1;
  /** Ear swivel: 0 both up, 1 near ear flicked back. */
  ear: 0 | 1;
  /** Whiskers flicked forward. */
  whisk: boolean;
  /** Leg phase: sitting hunch, or the two scurry pairs. */
  legs: "sit" | "A" | "B";
  /** 1 = body bounced up a pixel (scurry). */
  hop: 0 | 1;
  /** Tail: 0 low curl, 1 whipped high. */
  tail: 0 | 1;
}

const DUSTY_POSES: readonly DustyPose[] = [
  { bob: 0, ear: 0, whisk: false, legs: "sit", hop: 0, tail: 0 }, // 0 idle A
  { bob: 1, ear: 1, whisk: true, legs: "sit", hop: 0, tail: 1 }, // 1 idle B: twitch
  { bob: 0, ear: 0, whisk: false, legs: "A", hop: 0, tail: 0 }, // 2 scurry
  { bob: 1, ear: 1, whisk: true, legs: "B", hop: 1, tail: 1 }, // 3
  { bob: 0, ear: 0, whisk: false, legs: "A", hop: 1, tail: 0 }, // 4
  { bob: 1, ear: 1, whisk: false, legs: "B", hop: 0, tail: 1 } // 5
];

/** One big round ear at (x, y): clay shell, sand inner, umber fold. */
function ear(g: PixelGrid, x: number, y: number, flicked: boolean): void {
  const dx = flicked ? -1 : 0;
  g.rect(x + dx, y, 3, 3, "clay");
  g.px(x + dx, y, "sand"); // lit upper-left rim
  g.px(x + 1 + dx, y + 1, "sand"); // inner ear
  g.px(x + 2 + dx, y + 2, "umber"); // fold shadow
}

function drawDusty(p: DustyPose): PixelGrid {
  const g = new PixelGrid(DUSTY_FRAME, DUSTY_FRAME);
  const dy = -p.hop;
  const sitting = p.legs === "sit";
  const hb = p.bob; // head bob

  if (sitting) {
    // --- hunched sit: round haunch, chest up, trinket clutched ---
    g.rect(5, 12 + dy, 10, 7, "clay"); // haunch mass
    g.px(4, 14 + dy, "clay");
    g.px(4, 15 + dy, "clay");
    g.px(4, 16 + dy, "clay");
    g.rect(11, 9 + dy, 5, 5, "clay"); // chest rising to the head
    g.rect(12, 13 + dy, 4, 4, "sand"); // sand belly
    g.px(13, 17 + dy, "sand");
    // umber shade low/right on the coat
    g.rect(7, 18 + dy, 7, 1, "umber");
    g.px(14, 12 + dy, "umber");
    g.px(15, 13 + dy, "umber");
    // head, dipping toward the treasure on the bob
    g.rect(12, 5 + dy + hb, 6, 4, "clay");
    g.px(18, 7 + dy + hb, "sand"); // pointed muzzle
    g.px(19, 8 + dy + hb, "sand"); // nose reaching down
    g.px(15, 6 + dy + hb, "ink"); // beady eye
    g.px(13, 8 + dy + hb, "sand"); // cheek
    // the two big ears
    ear(g, 11, 2 + dy + hb, p.ear === 1);
    ear(g, 15, 2 + dy + hb, false);
    // the shiny trinket clutched at the chest — gold, so it POPS off the clay
    g.px(16, 11 + dy, "atbGold");
    g.px(17, 11 + dy, "atbGold");
    g.px(16, 12 + dy, "atbGold");
    g.px(17, 12 + dy, "amber"); // shaded facet
    if (hb === 1) g.px(16, 11 + dy, "white"); // glint as he turns it over
  } else {
    // --- low scurry: stretched body, nose forward ---
    g.rect(4, 12 + dy, 12, 5, "clay"); // long body
    g.px(3, 13 + dy, "clay"); // round rump
    g.px(3, 14 + dy, "clay");
    g.rect(6, 16 + dy, 9, 1, "sand"); // sand belly line
    g.rect(5, 12 + dy, 4, 1, "sand"); // lit shoulder-line
    g.rect(5, 17 + dy, 10, 1, "umber"); // umber under-shadow
    g.px(15, 13 + dy, "umber");
    // head thrust forward, bobbing with the stride
    g.rect(15, 9 + dy + hb, 5, 4, "clay");
    g.px(20, 11 + dy + hb, "sand"); // muzzle
    g.px(21, 12 + dy + hb, "sand"); // nose tip
    g.px(17, 10 + dy + hb, "ink"); // eye
    // ears swept back with speed
    ear(g, 14, 6 + dy + hb, p.ear === 1);
    ear(g, 18, 6 + dy + hb, false);
  }

  rimTopLeft(g, { x: 10, y: 1 + dy + hb, w: 9, h: 4 }); // light across the ears
  selOut(g);

  // --- legs (after the contour so the paws stay dainty) ---
  if (sitting) {
    g.rect(6, 19 + dy, 4, 1, "clay"); // folded hind foot
    g.px(12, 14 + dy, "clay"); // forepaws holding the trinket
    g.px(15, 13 + dy, "clay");
  } else {
    const a = p.legs === "A" ? 1 : -1;
    // front pair
    g.px(14 + a, 18 + dy, "clay");
    g.px(15 + a, 19 + dy, "clay");
    g.px(13 - a, 18 + dy, "umber");
    // hind pair (opposite phase, bigger feet)
    g.rect(5 - a, 18 + dy, 3, 1, "clay");
    g.px(7 + a, 19 + dy, "clay");
  }

  // --- the bald tail: a thin naked line, curling or whipping ---
  const tailPts: ReadonlyArray<[number, number]> = sitting
    ? p.tail === 0
      ? [
          [4, 18 + dy],
          [3, 19 + dy],
          [2, 20 + dy],
          [1, 20 + dy],
          [0, 19 + dy] // curled tip
        ]
      : [
          [4, 17 + dy],
          [3, 16 + dy],
          [2, 15 + dy],
          [1, 14 + dy],
          [1, 13 + dy] // whipped high
        ]
    : p.tail === 0
      ? [
          [2, 15 + dy],
          [1, 16 + dy],
          [0, 17 + dy],
          [0, 18 + dy] // dragging low
        ]
      : [
          [2, 13 + dy],
          [1, 12 + dy],
          [0, 11 + dy],
          [0, 10 + dy] // whipped high
        ];
  tailPts.forEach(([x, y], i) => g.px(x, y, i === tailPts.length - 1 ? "umber" : "sandShade"));

  // --- whiskers, hair-thin, flicking on the twitch frames ---
  const wx = sitting ? 18 : 20;
  const wy = (sitting ? 8 : 12) + dy + hb;
  if (p.whisk) {
    g.px(wx + 2, wy - 1, "sandLight");
    g.px(wx + 2, wy + 1, "sandLight");
  } else {
    g.px(wx + 1, wy, "sandLight");
    g.px(wx + 2, wy, "sandLight");
  }

  return g;
}

/** All 6 frames: 0–1 twitchy hoarder idle, 2–5 scurry. */
export function dustyFrames(): PixelGrid[] {
  return DUSTY_POSES.map(drawDusty);
}
