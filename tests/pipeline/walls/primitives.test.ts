import { describe, it, expect } from "vitest";
import { box, ell, aabb, trace } from "../../../tools/pipeline/src/walls/primitives";
import { DIR } from "../../../tools/pipeline/src/walls/raymath";

describe("primitives", () => {
  it("aabb of a box is its lo/hi", () => {
    expect(aabb(box([0, 0, 0], [2, 3, 4], { R: [], lo: 0, hi: 1 }))).toEqual([[0, 0, 0], [2, 3, 4]]);
  });

  it("a ray straight down -Z hits a box in front of it and returns a normal", () => {
    // NOTE: the task brief's literal O=[0,0,-10] does not hit this box under the
    // FIXED camera (az 0 / el 33): DIR is [0, sin33, cos33], not pure +Z, so a ray
    // walking straight back along Z from [0,0,-10] drifts off in Y long before its
    // Z component re-enters the box's [-1,1] span (verified by hand against the
    // ported trace() below: it returns null for that literal O). trace()'s O is
    // always meant to be a point in the RX/UY screen plane (see the prototype's
    // renderWall, docs/prototypes/cliff-wall-raycast.html:1064-1066) — i.e. it has
    // zero component along DIR — so the geometrically faithful adaptation of "the
    // origin, in front of the box, looking down the camera ray" is a point *behind*
    // the box along -DIR, not along -Z. O = -10*DIR still has zero RX/UY component
    // (screen-center pixel) and lies exactly on the camera's viewing ray.
    const b = box([-1, -1, -1], [1, 1, 1], { R: [], lo: 0, hi: 1 });
    const O: [number, number, number] = [-10 * DIR[0], -10 * DIR[1], -10 * DIR[2]];
    const h = trace(b, O);
    expect(h).not.toBeNull();
    expect(Math.hypot(h!.n[0], h!.n[1], h!.n[2])).toBeCloseTo(1, 5); // unit normal
  });

  it("a ray that misses returns null", () => {
    expect(trace(ell([100, 100, 0], 0.2, { R: [], lo: 0, hi: 1 }), [0, 0, -10])).toBeNull();
  });
});
