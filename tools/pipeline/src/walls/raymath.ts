/**
 * Camera frame, orthographic projection, light, and vector helpers, ported
 * VERBATIM from docs/prototypes/cliff-wall-raycast.html:140-190 (RAD,
 * setView/frame at 162-171, L/LM at 172, PPU at 173, projX/projY at
 * 174-175, nrm/crs/dt at 188-190).
 *
 * ADAPTATION: the prototype's `setView(az, el)` lets the dev-tool camera
 * spin freely; this port is a headless generator with exactly one shipped
 * view, so it is FIXED at az 0 / el 33 (the prop-generator angle called out
 * in the prototype's own comment above `let AZ=0, EL=33`). RX/UY/DIR are
 * computed once, at module load, instead of being recomputed by a setter.
 * There is no DOM, no az/el parameters, and no mutable view state.
 */

export type Vec3 = [number, number, number];

export const RAD = Math.PI / 180;

const AZ = 0;
const EL = 33;
export const ce = Math.cos(EL * RAD);
const se = Math.sin(EL * RAD);
const ca = Math.cos(AZ * RAD);
const sa = Math.sin(AZ * RAD);

/** Camera right/up/forward axes, fixed at az 0 / el 33 (the prop-generator view). */
export const RX: Vec3 = [ca, 0, -sa];
export const UY: Vec3 = [-sa * se, ce, -ca * se];
export const DIR: Vec3 = [sa * ce, se, ca * ce];

/** Directional light (world space) and its magnitude, used for Lambert shading. */
export const L: Vec3 = [-0.4, 0.84, 0.36];
export const LM = Math.hypot(...L);

/** Pixels per world unit. */
export const PPU = 16;

export const projX = (P: Vec3): number => (P[0] * RX[0] + P[1] * RX[1] + P[2] * RX[2]) * PPU;
export const projY = (P: Vec3): number => -(P[0] * UY[0] + P[1] * UY[1] + P[2] * UY[2]) * PPU;

/** Normalize; the zero vector maps to itself (prototype's `||1` guard against div-by-0). */
export const nrm = (v: Vec3): Vec3 => {
  const m = Math.hypot(...v) || 1;
  return [v[0] / m, v[1] / m, v[2] / m];
};

export const crs = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

export const dt = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
