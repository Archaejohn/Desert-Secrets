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

Writes 24 files into `src/assets/generated/`: the v1 set (`hero.png`,
`npc.png`, `scarab.png`, `tiles.png`), the Act 1 set (`rosa.png`,
`piggy.png`, `jackrabbit.png`, `buzzard.png`, `gila.png`, `foreman.png`,
`queen.png`, `tiles2.png`), the Act 2 set (`slither.png`, `miner.png`,
`fluffball.png`, `icebat.png`, `crystalcrawler.png`, `frostscarab.png`,
`warden.png`, `tiles3.png`), the Act 1 retcon set (`john.png`,
`pamela.png`, `chicken.png`) and `manifest.json`. Layouts, frame semantics
and the manifest schema are specified in `docs/CONTRACTS.md` §1, §4 and §7
and the "Act 1 retcon: John & Pamela replace Sahra" section — the pipeline
follows them exactly.

### Asset list

| Sheet | Frame | Grid | Notes |
|---|---|---|---|
| `hero.png` / `npc.png` / `rosa.png` / `miner.png` / `john.png` / `pamela.png` | 16×24 | 6×4 | 4-direction humanoids sharing `poses.ts` (idle 0–1, walk 2–5 per row). Rosa: ink bob, bone shirt, amber hi-vis vest. Miner: rust hard hat with an amber lantern pixel, bone beard, slate bib overalls. John: broad-shouldered rancher dad, wide sand hat brim, rust/clay shirt, slate trousers, ink boots. Pamela: jade/teal apron over a bone blouse, sand hair in a rust-ribboned bun |
| `scarab.png` | 24×24 | 6×1 | battle enemy; idle 0–1 / skitter 2–5 |
| `foreman.png` | 24×24 | 6×1 | armored scarab elite — reuses the scarab pose table + leg rig with slate/indigo plates and an amber eye slit |
| `frostscarab.png` | 24×24 | 6×1 | the scarab rig re-dressed in frost: skyBlue shell, bone rime edges, mint gem, mint eyes |
| `piggy.png` | 16×16 | 6×1 | baby emperor penguin; idle shiver (lateral tremble + head tuck), waddle with alternating lean/steps, one alternating mint frost-glint pixel |
| `chicken.png` | 16×16 | 6×1 | small round hen, bone/sand feathers, amber beak+feet, a single small rust comb accent; idle = head-bob peck, move = strut with alternating leg contact |
| `bucket.png` | 16×16 | 2×1 | static clay/rust pail prop, not a creature — no idle/move cycle; `bucket-empty` [0] shows an ink hollow interior, `bucket-full` [1] shows a skyBlue/mint water surface with one white glint, both one-frame animations with repeat 0 |
| `fluffball.png` | 16×16 | 6×1 | second chick: Piggy's waddle machinery with an even rounder no-neck silhouette in gray (mauve/plum) down; idle = fluff-shake |
| `slither.png` | 16×16 | 6×1 | jade whipsnake facing RIGHT (world code flips): coiled tongue-flick idle, 4-frame travelling-wave S-curve undulation |
| `jackrabbit.png` | 16×16 | 6×1 | idle sit + ear twitch, 4-frame hop cycle |
| `buzzard.png` | 24×24 | 6×1 | perched shrug idle, wing-flap cycle |
| `icebat.png` | 24×24 | 6×1 | indigo/skyBlue cave bat: hangs upside-down with folded wings on idle (twitch + mint eye glint), airborne flap on move |
| `gila.png` | 24×24 | 6×1 | beaded rust/ink hide, tongue-flick idle, low crawl with tail sweep |
| `crystalcrawler.png` | 24×24 | 6×1 | gila-style rig in slate/indigo, grown over with jade/skyBlue crystal clusters; a white glint alternates between clusters every frame |
| `queen.png` | 32×32 | 6×1 | Dust Queen boss: wide mauve/rust carapace, jade gem crown, bone mandibles; slow 2-frame breathing idle, 4-frame leg churn |
| `warden.png` | 32×32 | 6×1 | Rime Warden boss: queen-scale beetle-construct — slate/indigo plates under a bone ice sheath, bone frost prongs, and a single amber core pixel that flares white on idle frame 1 |
| `tiles.png` | 16×16 | 8×2 | 16 named desert tiles |
| `tiles2.png` | 16×16 | 8×3 | 24 named Act 1 tiles (highway/truck, joshua tree, gas station, mine, rail/cart/lever, ice wall + frost) — see `tileset2.ts` |
| `tiles3.png` | 16×16 | 8×2 | 16 named Act 2 ice-maze tiles (dark iceFloor vs bright iceWallDeep, crystals, overhead icicle with transparent background, near-black chasm, snowdrift, amber lanternPost, lakeIce/lakeCrack, bridgePlank, doorRime/doorOpen, shard, mossGlow) — see `tileset3.ts` |
| `owBillboards.png` | 48×40 | 6×1 | Phase O Mode-7 overworld billboards (docs/CONTRACTS.md "Phase O"): three mountain-mass variants, joshuaTree, mineMouth, truckWreck — bottom-anchored standing sprites, sel-out contours, ink only at the ground contact. tiles2.png also grew a Phase O appendix (indices 32–55: scree/screeShade/sandShade, the coast surf ring, the sand↔scree finger set) and is now 8×7 |

## Layout

| Module | Role |
|---|---|
| `tools/pipeline/src/grid.ts` | `PixelGrid` drawing surface: `px`, `rect`, `outline`, `mirrorX`, `blit`, `diff` |
| `tools/pipeline/src/sheet.ts` | `composeSheet(frames, columns)` — row-major layout, Phaser frame numbering |
| `tools/pipeline/src/png.ts` | `PixelGrid` → PNG buffer via pngjs + the master palette |
| `tools/pipeline/src/rng.ts` | seeded mulberry32 |
| `tools/pipeline/src/sprites/*.ts` | pure frame builders (hero, npc, rosa, miner, john, pamela, scarab, foreman, frostscarab, piggy, fluffball, chicken, slither, jackrabbit, buzzard, icebat, gila, crystalcrawler, queen, warden) + shared pose table (`poses.ts`) |
| `tools/pipeline/src/fx.ts` | shared drawing techniques (ART_DIRECTION §1/§3): the `shadowOf` LUT, `shadeGrid`/`shadeTopRows`, motif scatter, cluster dither, ridge/lobe/strata/edge-finger generators |
| `tools/pipeline/src/tilecraft.ts` | tile-role composers on fx.ts (ART_DIRECTION §2/§4a): `makeCap`, `makeFace`, `makeShadeVariant`, `makeEdgeSet` transition sets (lip/fingers/surf) |
| `tools/pipeline/src/tileset.ts` | the 16 named v1 tiles |
| `tools/pipeline/src/tileset2.ts` | the 24 named Act 1 tiles |
| `tools/pipeline/src/tileset3.ts` | the 16 named Act 2 tiles |
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
- **Determinism** — two runs produce identical PNG bytes and manifest JSON,
  and the twelve pre-Act-2 sheets are pinned to their committed sha256
  hashes so no refactor can move a shipped pixel.
- **Motion** — idle frames differ (breathing), adjacent walk/skitter frames
  differ by ≥ 8 pixels for 24/32px sprites and ≥ 6 for 16px sprites (real
  limb motion), water's two frames differ.
- **Manifest schema** — all animation keys, in-range frame indices, the
  complete tile-name maps, and a palette copied verbatim.
- **Non-emptiness** — every character frame has > 60 opaque pixels (> 55
  for the 16px snake, > 300 for 32px bosses); every tile is fully opaque so
  maps never show holes — except `icicle`, the overhead tile, which must
  keep a transparent background (also asserted).
- **Act 2 legibility** — iceFloor is ≥ 60% different (and darker) than
  iceWallDeep, doorRime ≠ doorOpen, lakeIce ≠ lakeCrack, chasm is ≥ 80%
  ink, the lantern glows amber.

Anything that would break the look — a stray colour, a blank frame, a
frozen walk cycle, nondeterministic output — fails CI before it lands.
