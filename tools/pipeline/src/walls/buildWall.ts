/**
 * Assembles one wall's solids, ported VERBATIM from `buildWall()` in
 * docs/prototypes/cliff-wall-raycast.html:765-1045 — bare-rock only.
 *
 * SCOPE (per Task 4's brief): this is a faithful port of a SUBSET of the
 * prototype's `buildWall`. Three whole prototype sections are deliberately
 * OMITTED for W1 (bare-rock, no ramp):
 *   - The ramp block (~816-990: `rdir`, `wedgeRock`, stairs/slope tread,
 *     kerbs) — W1 walls have no ramp.
 *   - The cap-SURFACE block (~1004-1031: grass/snow/sand lumps sitting on
 *     the crest) — W1's cap is bare rock only, no ground dressing.
 *   - The `S.whole`/`S.build` branch (~789-792) — neither `strata` nor
 *     `granite` (the only two `STYLES` entries this port has, per Task 3)
 *     sets `whole`, so that branch is unreachable dead code here; the
 *     course loop always runs.
 * Everything else — the recess plane, per-solid lean, the course loop,
 * the crest-profile cap columns, and the foot talus — is ported with
 * every constant and `h2(...)` seed argument unchanged.
 *
 * ADAPTATIONS:
 *   - Every `+$('id').value` DOM read becomes the matching `WallParams`
 *     field. The prototype divided slider reads by 100 to get a 0..1
 *     fraction (`+$('bw').value/100`); `WallParams` fields are already
 *     0..1 fractions, so the `/100` is simply dropped (not re-applied).
 *   - `o.face`'s lambert window used the prototype's inline fallback
 *     `S.win||[0.11,0.53]` (read only when a style set no `win`). Neither
 *     `strata` nor `granite` sets `win` (Task 3's `WallStyle` type has no
 *     such field at all), so that branch always fell through to the
 *     fallback anyway. Task 2 built `WALL_WIN` (`./wallMaterials`) as the
 *     owner-tuned replacement for that exact fallback (see its "muted
 *     default window" comment and the wallMaterials test asserting it
 *     sits below the prototype's 0.11-0.53) — this port uses `WALL_WIN`
 *     in its place rather than reintroducing the old literal.
 */

import { h2 } from "../cliffs/noise";
import { box, ell, type Solid } from "./primitives";
import { MAT, WALL_WIN } from "./wallMaterials";
import { STYLES, crestOff } from "./wallStyles";
import { PPU } from "./raymath";

export interface WallParams {
  style: keyof typeof STYLES;
  W: number;
  H: number;
  ch: number;
  bw: number;
  relief: number;
  frac: number;
  irr: number;
  batter: number;
  talus: number;
  crest: string;
  crestAmt: number;
  top: string;
  /** Reserved for a future seed-aware noise pass. The shared `h2` this port
   *  uses (`../cliffs/noise`) is SEED-less by design (Task 3's adaptation
   *  note on `wallStyles.ts`), so nothing in this function reads it yet. */
  seed: number;
}

export interface BuiltWall {
  P: Solid[];
  W: number;
  H: number;
  capTop: number;
}

export function buildWall(params: WallParams): BuiltWall {
  const { W, H } = params;
  const S = STYLES[params.style];

  const o = {
    bw: params.bw,
    relief: params.relief * 0.55,
    frac: params.frac,
    irr: params.irr,
    face: MAT(S.face, ...WALL_WIN),
    top: params.top === "auto" ? S.top || "flat" : params.top,
  };
  const RECESS = MAT(S.recess, 0.08, 0.52),
    TALUS = MAT(S.talus, 0.2, 0.8),
    CAPM = MAT(S.cap, 0.5, 0.98);
  const batter = params.batter * 0.5;
  const P: Solid[] = [];

  // recess plane: everything the cracks look through onto
  P.push(box([0, -0.1, -0.26], [W, H - 0.03, -0.02], RECESS, 0.4));

  // Lean is applied per solid from its own height, so it works for coursed and
  // whole-face styles alike.
  const applyLean = (from: number) => {
    for (let i = from; i < P.length; i++) {
      const q = P[i];
      const cy = q.t === "box" ? (q.lo[1] + q.hi[1]) / 2 : q.c[1];
      const lean = batter * Math.max(0, Math.min(1, cy / Math.max(0.001, H)));
      if (q.t === "box") {
        q.lo[2] -= lean;
        q.hi[2] -= lean;
      } else q.c[2] -= lean;
    }
  };

  const chh = params.ch;
  let y = 0,
    ci = 0;
  while (y < H) {
    const th = chh * (0.6 + h2(ci, 0, 71) * 0.9);
    const y1 = Math.min(H, y + th);
    const before = P.length;
    S.course(P, y, y1, W, o);
    applyLean(before);
    y = y1;
    ci++;
  }

  const capTop = H + 0.1;
  // Front plane of the upper plateau. Hoisted above the ramp because the ramp's landing
  // and the wall above it both align to this same edge.
  const zCapF = 0.3 - batter * 0.4;
  const crestKind = params.crest === "auto" ? S.crest || "flat" : params.crest;
  const cAmt = params.crestAmt * H * 0.24;
  const crestY = (x: number) => capTop + crestOff(crestKind, x, W, cAmt);

  // cap: the ground surface sitting on top of the wall
  // The cap is a run of columns following the crest, with the style's own rock filling
  // in beneath wherever the crest rises above the wall proper.
  const nCap = Math.max(8, Math.round(W / Math.max(0.09, 2.0 / PPU)));
  for (let i = 0; i < nCap; i++) {
    const xa = -0.1 + (W + 0.2) * (i / nCap),
      xb = -0.1 + (W + 0.2) * ((i + 1) / nCap);
    const top = crestY(Math.max(0, Math.min(W, (xa + xb) / 2)));
    if (top > capTop + 0.03) P.push(box([xa, H - 0.06, -0.45], [xb, top - 0.1, zCapF], o.face, 0.8)); // rock under the rise
    P.push(box([xa, Math.min(H - 0.05, top - 0.14), -0.5], [xb, top, zCapF], CAPM, 0.3));
  }

  // talus at the foot
  const tal = params.talus;
  if (tal > 0) {
    const n = Math.round(W * 20 * tal);
    for (let k = 0; k < n; k++) {
      const cx = h2(k, 0, 91) * W;
      const pile = Math.pow(h2(k, 1, 92), 1.7);
      const cz = 0.05 + pile * 0.55,
        cy = -0.02 + (1 - pile) * 0.55 * tal;
      const r = 0.045 + h2(k, 2, 93) * 0.085;
      P.push(ell([cx, cy, cz], [r, r * 0.75, r * 0.8], TALUS, 0.95));
    }
  }

  return { P, W, H, capTop };
}
