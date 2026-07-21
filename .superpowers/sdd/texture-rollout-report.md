# Ground texture vocabulary — rollout to all 19 grounds

**Status:** DONE

Rolled the owner-approved 6-ground texture prototype across all 19 ground
fills. The old uniform world-fbm-mottle + single-pixel-fleck recipe is gone;
each ground now carries its own texture STRUCTURE from the promoted primitive
kit, at the same calm/shaded low-contrast register the owner signed off on.

## What changed
- **Promoted** the primitive kit into production: `tools/pipeline/src/ground/texture.ts`
  (`worley`/`WorleyResult`/`cellTone`, `ridged`, `striate`, `warp` — same
  signatures/behaviour the prototype validated).
- **Rewrote** `tools/pipeline/src/ground/fills.ts` `fill(key,wx,wy)` — all 19
  grounds switch on their assigned family. `keySeed` and `fillField` kept
  unchanged. `GRAIN` (the old [xScale,yScale] table) and the `worldMacro`
  import were removed — nothing else imports them; the new structured
  primitives supersede per-axis grain scaling.
- **Deleted** `textureProto.ts` and `buildTextureProto.mts` (content promoted).
- **Re-pinned** all 19 golden crops in `tests/pipeline/ground/fills.test.ts`.
  (All 19 changed: the 6 tuned recipes previously lived only in
  `textureProto.ts`, never in `fills.ts`, so every crop is new.)
- **Regenerated** `docs/superpowers/artifacts/ground-fills-review.html`
  (old-tiled vs new-world-position, all 19). `buildFillReview.mts` needed no
  edits — it only imports `fillField`.

## Family → ground mapping (as applied)
- **ripples** (striate, near-horizontal): sand*, frostSand
- **flowing** (double warp + worldFbm): lava*
- **facets** (worley per-cell tone + faint seams): ice*, frozenLake
- **wave bands** (fast caustic × slow swell striate + sparse crest): reefWater*, groveWater
- **clumps** (warp + threshold patches): glowMoss, rimeMoss, groveGrass, groveMoss*
- **grain** (warped clustered worley cells): groveSoil*, ash, reefSilt, asphalt, reefFloor
- **cracked** (ridged crack network over subtle body): emberRock, lavaCrust
- **soft drift** (broad smooth warp/macro): snow

(* = one of the 6 owner-tuned exemplars, carried over verbatim from protoFill.)

## How the 13 new grounds were tuned (body window ±1, extremes ≤~3%)
- **frostSand** `["bone","sandLight","skyBlue","sandShade"]` — sand's ripple
  code with the body window shifted to sandLight(1)↔skyBlue(2) (frost-tinted),
  bone(0) crest, rare sandShade(3) grain speck.
- **frozenLake** `["skyBlue","slate","indigo","ink"]` — ice's facet code, larger
  plates (freq 0.09), facets shade skyBlue(0)↔slate(1), indigo(2) bevels, rare
  ink(3) hairline cores.
- **groveWater** `["skyBlue","teal","tealDeep","indigo"]` — reefWater's wave-band
  code (identical ramp), distinct seed. teal(1)↔tealDeep(2) body, skyBlue(0)
  crest, rare indigo(3) deep speck.
- **glowMoss / rimeMoss / groveGrass** (all `["mint","jade","teal","tealDeep"]`) —
  groveMoss's clump structure, kept visually distinct via clump scale: glowMoss
  amp 6 / freq 0.08 with a more-present mint(0) glow crown (its signature),
  rimeMoss amp 5 / freq 0.11 (finer, frostier), groveGrass amp 8 / freq 0.06
  (broad blades). All body jade(1)↔teal(2), rare tealDeep(3) gap speck.
- **ash / reefSilt / asphalt / reefFloor** — groveSoil's warped-worley grain
  structure, each with its own body window and a sparse light fleck + rare dark
  hollow: ash sandShade(1)↔stone(2)/bone(0)/stoneDark(3); reefSilt
  indigo(1)↔plum(2)/tealDeep(0)/ink(3); asphalt indigo(1)↔plum(2)/slate(0)/ink(3)
  (fine aggregate, freq 0.5); reefFloor tealDeep(1)↔indigo(2)/teal(0)/ink(3).
- **emberRock** `["clay","rust","stoneDeep","ink"]` — NEW cracked recipe using
  `ridged`: warm basalt body rust(1)↔stoneDeep(2) (worldFbm), creases settle to
  stoneDeep, rarest crack cores reach ink(3), rare warm clay(0) glint.
- **lavaCrust** `["hpRed","rust","stoneDeep","ink"]` — cracked, INVERTED register
  by design (matches the owner-tuned G1 intent): DARK crust body
  stoneDeep(2)↔ink(3), the `ridged` crack network glows rust(1) fissures (~14%),
  rarest hottest cores flare hpRed(0) (~1%). This is the one intentional
  departure from "body±1, extremes rare" — its glowing fissures ARE the light
  accents over a dark body, which is what cooling crust physically is.
- **snow** `["white","bone","skyBlue","slate"]` — NEW soft-drift recipe: broad
  smooth warped worldNoise, body white(0)↔bone(1), rare soft skyBlue(2) hollow,
  rarest slate(3) speck (the speck also guarantees adjacent 16px blocks never
  coincide, so the non-tiling assertion holds on this very smooth surface).

## Index distribution (96×96 sampled at world 512,512; % per ramp idx 0/1/2/3)
```
sand        9/43/47/ 1   frostSand   9/41/48/ 1   asphalt     6/51/42/ 1
ice        59/34/ 5/ 2   reefFloor   4/52/42/ 2   reefSilt    6/55/38/ 1
reefWater   4/44/49/ 3   glowMoss    2/41/56/ 1   snow       60/37/ 1/ 2
frozenLake 50/42/ 5/ 3   rimeMoss    1/49/50/ 0   emberRock   3/38/58/ 1
ash         6/52/41/ 1   lava        3/43/51/ 3   lavaCrust   1/14/39/46
groveGrass  1/40/58/ 1   groveMoss   1/63/36/ 0   groveWater  4/44/50/ 3
groveSoil   6/50/43/ 1
```
Every ground's bulk sits in two adjacent mid tones; dark extreme idx3 is ≤3%
everywhere except lavaCrust (intentional dark body). For ice/snow/frozenLake the
high idx0/idx1 counts are the two light body tones (white↔skyBlue / white↔bone /
skyBlue↔slate) — low contrast by design, not a bright extreme.

## The 19 re-pinned golden-crop hashes (64×64 @ world 1000,1000)
```
sand        829db35993979a81e90d41079e7183f3005ae0d4098570ae1d74bbece9c8057d
frostSand   8d4be8ae87e183215af785ff4addd4d51a8122e39d01fd68d42507ec7ac2118c
asphalt     32dd54b2e1c90000e5f1c5d6e6e50ca8d238f7b533ed277ac540df8e9b1bbc14
reefFloor   bd26b90318ae1003b5a963392e2094063f4c26ba5e8c84a19dd66d6da251c7d8
reefSilt    00948a860f794b4055f48e4505b3f2ed7091105f87a3f1257fdfdbeb6c9673de
reefWater   478e82b9239f12bcc18e1d14efea320ee6a2e796d82b3a5142b04661981b9fdb
glowMoss    83b3d70a0ed30d6fa8dd6eb986bee9a54d7c0d98c8c7d31d5a7a2e9b80116ead
ice         d9456b964a51eb56d4256eb0a228e79f83119ee9e1d799d7c7a123d1ca784d83
snow        dd1191234c67ae1ee69304f40c8338a8abdd3c21cc16582f4506dc0c95b0cd06
frozenLake  c3db571ec8645b409eb1b1aabe8f23a8919c09b4f659ec5fcd717ebd00bf7d07
rimeMoss    a61724a2fb6491a1d1897c7944bb85fed66898d7bf21fd6b3a3495502901e65a
emberRock   6fb9c72ac9950df499d6e318e03834dc2e617d3cfc605e222bc963bc637ac9a6
ash         ac2c895415c489ed5ef8a3d762ec094dbde4286a3fbd453d9ec98e00dbe4f561
lava        c693daacf1fb1b56ce813933e2e62123a602ef8d7426447dbd6b3c00de8b70c6
lavaCrust   c476f6e795a7e311b1f8513705331c6f864ef8c94f6a7ac7c36d822878bb8931
groveGrass  05b17a6b26be298918a6a51c3ba87c7849d9336abebeb6309ec69a1066fc611f
groveMoss   f50011c59407b42c58a816dce8150a9e7efe3989b3c7a570b0d2bce5746cc979
groveWater  7a8b4b8bb100e38f1dbc5981540fa2c9334b8e23ccc755aae4548718f5e6f136
groveSoil   aa09a4af5cce6240eb3022ba6179f116f3869f89640fc6966c3c365c688f45a6
```

## Verification
- `npx vitest run tests/pipeline/ground/fills.test.ts` — 9/9 passed (palette-lock,
  non-tiling, and all 19 golden crops covered/green).
- `npx vitest run tests/pipeline/determinism.test.ts` — 17/17 passed, baked
  sheet pins UNCHANGED (fills.ts feeds no baked sheet; terrains.ts `floorFill`
  untouched).
- `npx tsc --noEmit` — clean.
- `npx tsx tools/pipeline/src/ground/buildFillReview.mts` — wrote
  `docs/superpowers/artifacts/ground-fills-review.html`.

## Grounds that may want owner attention
- **lavaCrust** — the one intentional deviation from the body±1 rule (dark
  crust body, rust/hpRed fissure glow as the light accents). It preserves the
  owner-tuned G1 character but reads a touch darker/higher-contrast than the
  other 18 because the fissures are the point. Worth a glance to confirm the
  fissure network (now a coherent `ridged` structure, ~14% rust) isn't too busy.
- **groveGrass / rimeMoss / glowMoss** share one ramp and one clump generator,
  differentiated only by clump scale + crown frequency. They read distinct at
  the 96×96 review size, but side-by-side in one scene they'll be close cousins
  — expected, since they're all "green mossy/grassy ground."
- **snow** is deliberately the calmest (near-flat white↔bone with rare cool
  specks); confirm it isn't *too* flat for the frozen biome's taste.
```
```
