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

Writes 13 files into `src/assets/generated/`: the v1 set (`hero.png`,
`npc.png`, `scarab.png`, `tiles.png`), the Act 1 set (`rosa.png`,
`piggy.png`, `jackrabbit.png`, `buzzard.png`, `gila.png`, `foreman.png`,
`queen.png`, `tiles2.png`) and `manifest.json`. Layouts, frame semantics
and the manifest schema are specified in `docs/CONTRACTS.md` §1 and §4 —
the pipeline follows them exactly.

### Asset list

| Sheet | Frame | Grid | Notes |
|---|---|---|---|
| `hero.png` / `npc.png` / `rosa.png` | 16×24 | 6×4 | 4-direction humanoids sharing `poses.ts` (idle 0–1, walk 2–5 per row). Rosa: ink bob, bone shirt, amber hi-vis vest |
| `scarab.png` | 24×24 | 6×1 | battle enemy; idle 0–1 / skitter 2–5 |
| `foreman.png` | 24×24 | 6×1 | armored scarab elite — reuses the scarab pose table + leg rig with slate/indigo plates and an amber eye slit |
| `piggy.png` | 16×16 | 6×1 | baby emperor penguin; idle shiver (lateral tremble + head tuck), waddle with alternating lean/steps, one alternating mint frost-glint pixel |
| `jackrabbit.png` | 16×16 | 6×1 | idle sit + ear twitch, 4-frame hop cycle |
| `buzzard.png` | 24×24 | 6×1 | perched shrug idle, wing-flap cycle |
| `gila.png` | 24×24 | 6×1 | beaded rust/ink hide, tongue-flick idle, low crawl with tail sweep |
| `queen.png` | 32×32 | 6×1 | Dust Queen boss: wide mauve/rust carapace, jade gem crown, bone mandibles; slow 2-frame breathing idle, 4-frame leg churn |
| `tiles.png` | 16×16 | 8×2 | 16 named desert tiles |
| `tiles2.png` | 16×16 | 8×3 | 24 named Act 1 tiles (highway/truck, joshua tree, gas station, mine, rail/cart/lever, ice wall + frost) — see `tileset2.ts` |

## Layout

| Module | Role |
|---|---|
| `tools/pipeline/src/grid.ts` | `PixelGrid` drawing surface: `px`, `rect`, `outline`, `mirrorX`, `blit`, `diff` |
| `tools/pipeline/src/sheet.ts` | `composeSheet(frames, columns)` — row-major layout, Phaser frame numbering |
| `tools/pipeline/src/png.ts` | `PixelGrid` → PNG buffer via pngjs + the master palette |
| `tools/pipeline/src/rng.ts` | seeded mulberry32 |
| `tools/pipeline/src/sprites/*.ts` | pure frame builders (hero, npc, rosa, scarab, foreman, piggy, jackrabbit, buzzard, gila, queen) + shared pose table (`poses.ts`) |
| `tools/pipeline/src/tileset.ts` | the 16 named v1 tiles |
| `tools/pipeline/src/tileset2.ts` | the 24 named Act 1 tiles |
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
