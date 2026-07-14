/**
 * Tiny deterministic per-cell hash for cosmetic tile variety.
 * Never use Math.random in map builders — maps must be pure and
 * byte-identical on every build (tests assert this).
 */
export function cellHash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
