# Art Pipeline

All game art is **generated, not drawn**. `tools/pipeline/` is a small
TypeScript program that procedurally builds every sprite sheet and tile as
pixel data, encodes it to PNG, and emits a machine-readable
`manifest.json` — all into `src/assets/generated/` (which is committed, so
the game always builds without running the pipeline first).

## Philosophy

- **Procedural.** Sprites are pure functions (`heroFrames()`,
  `tileFrames()`, …) that return `PixelGrid` frames. Poses, strides and
  speckle are parameters, so a walk cycle is real limb motion, not four
  hand-copied bitmaps.
- **Palette-locked.** A `PixelGrid` cell is a *palette name* from
  `src/shared/palette.ts` or `null` (transparent) — a colour outside the
  palette is unrepresentable. Only the PNG encoder (`png.ts`) turns names
  into RGB. This also makes anti-aliasing impossible by construction.
- **Deterministic.** No `Math.random`, no `Date`. Variation (sand grain)
  comes from a local mulberry32 seeded RNG (`rng.ts`) with fixed seeds, so
  output is byte-for-byte reproducible and diffs stay meaningful in git.

## How to run

```sh
npm run art          # = npx tsx tools/pipeline/src/index.ts
```

Writes `hero.png`, `npc.png`, `scarab.png`, `tiles.png` and
`manifest.json` into `src/assets/generated/`. Layouts, frame semantics and
the manifest schema are specified in `docs/CONTRACTS.md` §1 — the pipeline
follows it exactly.

## Layout

| Module | Role |
|---|---|
| `tools/pipeline/src/grid.ts` | `PixelGrid` drawing surface: `px`, `rect`, `outline`, `mirrorX`, `blit`, `diff` |
| `tools/pipeline/src/sheet.ts` | `composeSheet(frames, columns)` — row-major layout, Phaser frame numbering |
| `tools/pipeline/src/png.ts` | `PixelGrid` → PNG buffer via pngjs + the master palette |
| `tools/pipeline/src/rng.ts` | seeded mulberry32 |
| `tools/pipeline/src/sprites/*.ts` | pure frame builders (hero, npc, scarab) + shared pose table (`poses.ts`) |
| `tools/pipeline/src/tileset.ts` | the 16 named tiles |
| `tools/pipeline/src/manifest.ts` | manifest builder |
| `tools/pipeline/src/assets.ts` | pure assembly of sheets + manifest |
| `tools/pipeline/src/index.ts` | the only module that touches disk |

Useful idioms: characters draw fills first and then call
`grid.outline("ink")` for the 1px contour; hair-thin details (staff, beetle
legs, antennae) are drawn *after* the outline pass so they stay one pixel;
props on tiles are drawn on a transparent layer, outlined, then blitted
onto the sand base.

## Adding a new sprite

1. Create `tools/pipeline/src/sprites/<name>.ts` exporting a pure
   `…Frames(): PixelGrid[]` function. Use only palette names; reuse
   `poses.ts` if it is a 4-direction walker.
2. Compose it in `assets.ts` (`composeSheet(frames, columns)`) and add the
   sheet + its animations to `manifest.ts`.
3. Write it to disk in `index.ts`.
4. Extend the tests in `tests/pipeline/` (layout, motion, non-emptiness —
   palette and determinism checks pick the new sheet up via `buildAssets`).
5. If the sheet is a new *contract* (the game must consume it), document it
   in `docs/CONTRACTS.md` §1 first.

## How consistency is enforced

`npx vitest run tests/pipeline` imports the pure builders (never the disk
output) and asserts the pipeline's guarantees:

- **Palette compliance** — every encoded pixel is alpha-0 or an exact
  `palette.ts` colour at alpha 255.
- **Layout** — sheet dimensions and frame grids match `CONTRACTS.md` §1.
- **Determinism** — two runs produce identical PNG bytes and manifest JSON.
- **Motion** — idle frames differ (breathing), adjacent walk/skitter frames
  differ by ≥ 8 pixels (real limb motion), water's two frames differ.
- **Manifest schema** — all animation keys, in-range frame indices, the
  complete tile-name map, and a palette copied verbatim.
- **Non-emptiness** — every character frame has > 60 opaque pixels; every
  tile is fully opaque so maps never show holes.

Anything that would break the look — a stray colour, a blank frame, a
frozen walk cycle, nondeterministic output — fails CI before it lands.
