/**
 * Shared frame semantics for character sheets (see docs/CONTRACTS.md §1).
 *
 * Each direction row has 6 frames:
 *   0–1 idle  — breathing bob (1px torso/head shift)
 *   2–5 walk  — contact / passing / contact / passing, with alternating
 *               leg stride and counter-swinging arms.
 */
export interface Pose {
  /** 1 = torso+head shifted down one pixel (breath / passing-frame bob). */
  bob: 0 | 1;
  /** Leg phase: 1 = left/near leg forward, -1 = right/far leg forward, 0 = together. */
  stride: -1 | 0 | 1;
  /** Arm swing, counter to the legs. */
  swing: -1 | 0 | 1;
}

export const FRAME_POSES: readonly Pose[] = [
  { bob: 0, stride: 0, swing: 0 }, // 0 idle A
  { bob: 1, stride: 0, swing: 0 }, // 1 idle B (breath)
  { bob: 0, stride: 1, swing: 1 }, // 2 walk contact A
  { bob: 1, stride: 0, swing: 0 }, // 3 walk passing
  { bob: 0, stride: -1, swing: -1 }, // 4 walk contact B
  { bob: 1, stride: 0, swing: 0 } // 5 walk passing
];

export const CHAR_FRAME_W = 16;
export const CHAR_FRAME_H = 24;
