/** Generating twice must yield byte-for-byte identical output, and the v1
 *  assets (hero, npc, scarab, tiles) must never change at all. */
// 2026-07-17: ALL EIGHT tile sheets (tiles, tiles2..tiles8) were deliberately
// re-pinned below in one pass — object-props (cart, truck, crate, barrel,
// cactus, pot, bones, crystals, coral, kelp, tree trunks, ovens, columns, …)
// were converted from baking an opaque ground into themselves to a TRANSPARENT
// background, so a prop composites over the map's ground layer instead of
// carrying a wrong ground onto mismatched terrain (the minecart-on-sand bug).
// See docs/CONTRACTS.md "v27". Only prop tiles' pixels changed — no tile index
// moved, no ground/wall/autotile tile touched.
// 2026-07-20: ALL pinned hashes below were re-pinned in one pass for the
// AAP-64 palette migration (Task 5) — CORE (src/shared/palette.ts) was
// recolored to canonical AAP-64 targets (Task 4), plus the shadowOf.indigo/
// hpRed strict-darker repair in fx.ts (Task 5 Step 0). No sheet's tile
// count, frame indices, or grid geometry changed — only palette hexes did.
// See docs/superpowers/sdd/task-5-brief.md.
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildAssets, SHEET_KEYS } from "../../tools/pipeline/src/assets";
import { encodePng } from "../../tools/pipeline/src/png";

describe("determinism", () => {
  it("two runs produce identical PNG bytes and manifest JSON", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of SHEET_KEYS) {
      const bufA = encodePng(a[key]);
      const bufB = encodePng(b[key]);
      expect(bufA.equals(bufB)).toBe(true);
    }
    expect(JSON.stringify(a.manifest)).toBe(JSON.stringify(b.manifest));
  });

  it("grids themselves are cell-identical across runs", () => {
    const a = buildAssets();
    const b = buildAssets();
    for (const key of SHEET_KEYS) {
      expect(a[key].diff(b[key])).toBe(0);
    }
  });
});

describe("pre-act2 asset byte-stability", () => {
  // sha256 of the committed v1 + Act 1 PNGs. Act 2 work must not change
  // these — if a shared-code refactor moves a single pixel, this fails.
  // Deliberately re-pinned for the Phase S sprite polish (docs/ART_DIRECTION.md §6):
  // sel-out contours + NNW rim light repainted every character/creature sheet
  // in place — same grids, same frame indices, only pixels. Tile sheets are
  // untouched by this pass and keep their previous hashes.
  const FROZEN = {
    hero: "90712234982e8eef31a1ef861d839cdd607fe5121cc862dcc0c9d48881ecc46e",
    npc: "e44931c7f5b2ad2f87a54b27acc2d6869de7b583c6de9874fd90bba21298f166",
    scarab: "e8f769631f7617868aac889102e038e6f5e84072b8f748ae5e315d2ed2471522",
    // Deliberately re-pinned for the Phase O overworld art pass
    // (docs/ART_DIRECTION.md §4a, docs/CONTRACTS.md "Phase O"): the sand
    // family + water were redrawn in place — dune ridge lanes and the
    // 3-value wave recipe replace the per-pixel speckle. Same 16 tile
    // slots, no reordering; only pixels changed.
    // Re-pinned again for the AAP-64 palette migration (2026-07-20,
    // Task 5): CORE recolored, plus the shadowOf.indigo/hpRed strict-
    // darker repair (fx.ts). Same tile slots/grids, only hexes changed.
    tiles: "2e4ce54236c980453561a7f9f0bbd3f7c66e8d920917c9366e2e00c776bcdf4f",
    rosa: "b9d45fca0156c6ab0386d9019cb59aa3fffe49168e980d73c958437850d63c09",
    piggy: "dc4401b6bd437a55bb83404b315b0f9e2bce0fbe2ec4c38dd9f9be6c8a56d91b",
    jackrabbit: "916c9898a44eb36aa7d43a7bcf85dae9654364bec26673f02cc8126c4bfe429a",
    buzzard: "47d8a183fbf4aaadfd4a136851e296dea95e0ff5a58a875e3ba7ba06bf217585",
    gila: "28741373a3204edf4e43dba55c16b93f3abf7ef0f73f7866e61bf32637545fef",
    foreman: "7f899bfc30cbfd6275de21b836232ab425dfaa63a036d6b8375480b7948da475",
    queen: "236f73d477207f6e83b98faa2c9e5d45e8d76064a7e08399765eb663b4b99391",
    // Deliberately re-pinned four times: first for docs/CONTRACTS.md "v9"
    // (the eight appended mountain-ridge tiles), again for the Phase O
    // overworld art pass (docs/ART_DIRECTION.md §4a: mountain1–8 redrawn in
    // place, plus scree/shade/coast/screeSand appended, indices 0..31
    // unmoved, appendix at 32..55), again 2026-07-16 for docs/CONTRACTS.md
    // "v22"'s first pass (the overworld map-expansion: screeWater, the
    // road autotile, the town dressing kit), and a fourth time the same
    // day for v22's rework: the project owner rejected the hand-drawn
    // rectangle spine / ellipse lake AND the coast* straight-edge shore
    // tiles once the lake stopped being a clean ellipse. coastN/E/S/W/NE/
    // NW/SE/SW/InNE/InNW/InSE/InSW (12 tiles, formerly 36..47) were
    // REMOVED — superseded by the new 16-mask lakeShore0..15 tileset
    // (built from owMountains' own rounded-corner geometry, extracted to
    // roundedMask.ts for reuse) — and the town kit grew from 8 to 12 tiles
    // (townWall4/townRoof3/townWindow2/townDoor2 added) purely to keep the
    // sheet's fixed-8-column layout an even multiple after the coast
    // removal. Every tile from screeSand onward was renumbered downward by
    // 12 as a result — a deliberate one-time reshuffle while this whole
    // feature was still unshipped/uncommitted, not an append-only
    // violation of any previously-shipped index. Sheet grew from 88 to 96
    // tiles (128x176 -> 128x192).
    // Re-pinned for the AAP-64 palette migration (2026-07-20, Task 5):
    // CORE recolored; same 96 tile slots, no reordering.
    tiles2: "09997441acdaa9bf168e00d0872c8b476e492efa000faeb3d015b0057c965076"
  } as const;

  it("all twelve pre-act2 sheets still encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act1-retcon asset byte-stability", () => {
  // sha256 of the newly-generated john/pamela/chicken PNGs (docs/CONTRACTS.md
  // "Act 1 retcon: John & Pamela replace Sahra"). Pinned once here so future
  // refactors can't silently move a shipped pixel.
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    john: "0085f6285893528eea849e470c0bffb898dd1fb9a19e0db9b62965f4421f00bb",
    pamela: "e60d8ab475eab7826feaeb2e479bb765bef313893bc526263e5b1c75164a4e9f",
    chicken: "dc3f1d304a5cba8f09f9da247bb6f6770ac1a3a70ad52121831a1a4c3802ed1b"
  } as const;

  it("john/pamela/chicken sheets encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("thomas asset byte-stability", () => {
  // sha256 of the newly-generated thomas.png — Joseph's friend, the muscle-man
  // body-type introduced for the Part Two opening (see
  // tools/pipeline/src/sprites/thomas.ts). Pinned once here so future refactors
  // can't silently move a shipped pixel.
  const FROZEN = {
    thomas: "a7c429a87d98fa79f793f9033906027ab9237fccdf238f1c5cd68600731a4488"
  } as const;

  it("thomas sheet encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("bucket asset byte-stability", () => {
  // sha256 of the newly-generated bucket.png (docs/CONTRACTS.md "Act 1
  // addition: the bucket fetch-quest + a minimal inventory (v5)"). Pinned
  // once here so future refactors can't silently move a shipped pixel.
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    bucket: "4bcbfa67c8d31d9579f4f7322f5f2ffb1f69f3475862fbd6e9d7220aea1b606c"
  } as const;

  it("bucket sheet encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("spigot asset byte-stability", () => {
  // sha256 of the newly-generated spigot.png (docs/CONTRACTS.md "v6:
  // inventory window, equip, and the spigot"). Pinned once here so future
  // refactors can't silently move a shipped pixel.
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    spigot: "fc51fdc452be361195cad0e7497557e203446857a7410bad397065c035e63a9d"
  } as const;

  it("spigot sheet encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act3 asset byte-stability", () => {
  // sha256 of the newly-generated Act 3 sheets/tileset (docs/CONTRACTS.md
  // "v12: The Sunless Sea"): the three sea enemies plus the fourth tileset.
  // Pinned once here so future refactors can't silently move a shipped pixel.
  // Purely additive — no prior sheet's bytes change (asserted above).
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    anglerfish: "ba0368b1422d73365a8afe40f97853013aab2fa8b877726533520e52e71d1bb3",
    reefeel: "7651269af3b1593987fab6451aed570a28d7a1da47647e4e20fc428bfefa8938",
    lurker: "481f482d51df366ca423c5e4acac8059e9c1bd282349adf3a076b710d14894cd",
    // tiles4 deliberately re-pinned for the Phase Z 2.5D art pass
    // (docs/ART_DIRECTION.md §5): seaWater redrawn to the wave recipe,
    // floe/templeFloor speckle replaced by motif clusters, templePillar
    // reads base-lit, and 16 dressing tiles appended (floe coast ring +
    // shades). Additive — no existing tile index moved.
    tiles4: "e70e85b11c40d05110696f9acbc159dde2be42d9697bc0e37c71cd4a861c6471"
  } as const;

  it("anglerfish/reefeel/lurker/tiles4 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act4 asset byte-stability", () => {
  // sha256 of the Act 4 assets (docs/CONTRACTS.md "v13: Dirty Laundry"): the
  // midden-mite swarm enemy plus the fifth (miners' camp) tileset. Pinned
  // once here so future refactors can't silently move a shipped pixel.
  // tiles5 was deliberately re-pinned once since v13 shipped: the
  // "stringLights" tile was redrawn with a flat wire (instead of a per-tile
  // sag) so placing the tiles edge to edge reads as one continuous strand
  // rather than a repeating scalloped wave that read as eyelashes — a real
  // playtester report. Same 16 tile slots, no reordering; only that one
  // tile's pixels changed.
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    middenmite: "042b59fcd348ed8c800b4a5a6eccffa3b87c92f4017dad1f547c2481b4350f1b",
    // tiles5 deliberately re-pinned again for the Phase Z 2.5D art pass:
    // plank floor gains a lit board subgrid, campWall becomes a wall-top
    // texture, crates/barrel get lit tops (G1), and 8 dressing tiles are
    // appended (campWall cap/face + floor shades). Additive only.
    tiles5: "c85263638a411200f0232f0ecc4a52f740130e47e0b286b4816e6ba05b710255"
  } as const;

  it("middenmite/tiles5 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act5 asset byte-stability", () => {
  // sha256 of the newly-generated Act 5 assets (docs/CONTRACTS.md "v16: The
  // Sunlit Cave-In"): the grove-guardian sunwasp enemy plus the sixth
  // (underground orange grove) tileset. Pinned once here so future refactors
  // can't silently move a shipped pixel. Purely additive — no prior sheet's
  // bytes change (asserted above).
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    sunwasp: "4cb90083ac1f99d47e8d1f0579107d6b88773db63ff247968d8643353efe75d3",
    // tiles6 deliberately re-pinned for the Phase Z 2.5D art pass: the SoM
    // organic showcase — grass/moss/sunbeam redrawn as motif clusters and
    // rounded lobes, and 24 dressing tiles appended (caveWall cap/face,
    // shades, moss↔grass fingers, riverbank lips). Additive only.
    //
    // Re-pinned a second time, same-day post-ship fix: appended 16
    // `orangeCanopy_r{row}c{col}` tiles (canopy.ts's generateCanopyPieces,
    // grown as one continuous lobed crown then sliced) replacing the single
    // `orangeTreeCanopy` tile the grove chamber map used to stamp at all
    // twelve (now sixteen) overhead cells — the literal "series of circles"
    // bug reported after ship. orangeTreeCanopy itself is untouched and
    // stays in the sheet, unreferenced (additive-only); sheet grew from
    // 48 to 64 tiles (8x6 -> 8x8).
    tiles6: "e40f862bc5892b47d3ab050dc3497fc6e8c45603430e409c7f7703199c055204"
  } as const;

  it("sunwasp/tiles6 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act6 asset byte-stability", () => {
  // sha256 of the newly-generated Act 6 assets (docs/CONTRACTS.md "v17: The
  // Reef"): the reef-predator reefstalker enemy plus the seventh (reef /
  // crawlers' garden) tileset. Pinned once here so future refactors can't
  // silently move a shipped pixel. Purely additive — no prior sheet's bytes
  // change (asserted above).
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    reefstalker: "8ce177294dea0e6f7d39ab77576728d9d3415c1b76b427f6a6ada7629423aa5f",
    // tiles7 deliberately re-pinned for the Phase Z 2.5D art pass: reef
    // floors/water/glow-moss redrawn to motif clusters and rounded lobes,
    // and 16 dressing tiles appended (reefWall cap/face, shades, silt↔floor
    // fingers). Additive only.
    tiles7: "099ad72a86da3abbcaf7cb8cdb02cf71ed5086e54a2b21ee7add9b834e794572"
  } as const;

  it("reefstalker/tiles7 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("act7 asset byte-stability", () => {
  // sha256 of the newly-generated Act 7 assets (docs/CONTRACTS.md "v18: La
  // Pizzeria Sotterranea"): Chef Testudo the tortoise NPC plus the eighth
  // (restaurant / lava-vent) tileset. Pinned once here so future refactors
  // can't silently move a shipped pixel. Purely additive — no prior sheet's
  // bytes change (asserted above).
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    testudo: "5849a9c1e01ee6c716e7f3899f37802892ec082e3aa743086aa267f6a5c91ffd",
    // tiles8 deliberately re-pinned for the Phase Z 2.5D art pass: the
    // lavaVent glow ramp (rust→amber→bone heart), ember/ash motif clusters,
    // checker-floor bevel subgrid, and 16 dressing tiles appended
    // (basaltWall cap/face, shades, ash↔ember seams). Additive only.
    tiles8: "5b53fb74d09fdaab353296d35371ab47646dc6cf95924153a09342c337b5d3e4"
  } as const;

  it("testudo/tiles8 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("phase-z zone-dressing asset byte-stability", () => {
  // sha256 pinned for the Phase Z 2.5D art pass (docs/ART_DIRECTION.md §2/§5,
  // docs/CONTRACTS.md "v20"). tiles3 had never been pinned before; it is
  // pinned here alongside its Phase Z redraw: iceFloor sheen bands replace
  // speckle, and 16 dressing tiles are appended (iceWallDeep cap/face,
  // floor shades, the chasm lip set). Additive — no existing index moved.
  const FROZEN = {
    tiles3: "596debecc92151aa8855c58a79c608e72693515a727100559e8bb75afed95f51"
  } as const;

  it("tiles3 encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("phase S asset byte-stability", () => {
  // sha256 of the two Phase S sheets (docs/ART_DIRECTION.md §6; CONTRACTS.md
  // "Phase S: sprite polish, Dusty & Sahra sheets, blob shadows"): Dusty the
  // giant pack rat (replacing the jackrabbit stand-in in TrailScene) and
  // Sahra the grove keeper (replacing the generic npc in SahraGroveScene).
  // Pinned once here so future refactors can't silently move a shipped pixel.
  const FROZEN = {
    dusty: "f8fe333fca6a83e977d3948d0ef316456ef83e7963baab7e1b83a087bb5f7333",
    sahra: "c4cd6892c81ccda411ea6a304e66ed18411faaef93aac9a65ed9af491cb6519e"
  } as const;

  it("dusty/sahra encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("gearIcons byte-stability", () => {
  // sha256 of gearIcons.png (docs/CONTRACTS.md "v38"): the Equipment-tab icon
  // set — 5 muted slot/class placeholders (hat · weapon · torso · legs · shoes)
  // and 7 colour item icons (miner's hat · stick · pickaxe · t-shirt · jeans ·
  // flip-flops · frost feather), one row of 12. Pinned so a future refactor
  // can't silently shift a shipped pixel or reorder the frame contract the
  // Equipment UI indexes by.
  const FROZEN = {
    gearIcons: "23db85453a279f0fc85452b818699e53da604126f65f27041117c0ec6fb5323c"
  } as const;

  it("gearIcons encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("owMountains blob-autotile byte-stability", () => {
  // sha256 of owMountains.png (docs/CONTRACTS.md "owMountains"): the
  // mask-based rounded-corner overworld mountain autotile that replaced the
  // old per-cell content-hash pick among eight neighbor-blind mountain1..8
  // ridge tiles.
  //
  // Re-pinned once, deliberately, for a same-day post-ship fix: the deep
  // interior of every tile was a flat `x+y<=15` two-color diagonal split,
  // identical on every mask=15 tile regardless of variant or position —
  // it read as a repeating "hash mark" pattern rather than peaks. Replaced
  // with a real triangular-ridge silhouette (`generatePeakGrid`, adapted
  // from `tileset2.ts`'s proven `mountainRidge`), one distinct apex
  // shape/position per variant. A second, more serious bug shipped
  // alongside it in `overworldMap.ts`'s `assignMountainTileNames`: it
  // mutated the map's decor grid in the same forward pass it read
  // neighbors from, so by the time a cell checked its N/W neighbors those
  // cells had already been overwritten from the mountain sentinel to a
  // real tile name and no longer read as "mountain" — collapsing ~93% of
  // the map's mountain cells to the single mask "E+S present" regardless
  // of true topology. Fixed by snapshotting the sentinel grid before any
  // mutation. Same 80 tile slots, no reordering — only pixels changed.
  const FROZEN = {
    owMountains: "9048d6c0f452d373f3a502774799db3155eb93ce682dc22569f58eb5ef147e58"
  } as const;

  it("owMountains encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});

describe("cliff tileset byte-stability", () => {
  // sha256 of the desert cliff+floor+cap sheet.
  // Updated for Phase 1b (straight ramps, 238 tiles), Phase 1c 45° diagonal (270 tiles),
  // and Phase 1c shallow+steep (26.57° + 63.43° diagonal flights, 370 tiles).
  // 370 named tiles + 6 blank pad (8 columns x 47 rows). Visual look approved before pinning.
  //
  // cliffIce re-pinned for M2 Task R2: cliffFace.ts's scree-pebble band was
  // hardcoded to the ROCK ramp regardless of biome, so ice's scree pebbles
  // rendered gray instead of ice-colored. R1 fixed it to use the passed
  // faceRamp; desert (faceRamp -> ROCK) stays byte-identical, but ice's
  // scree pixels changed, moving this hash. Same 274 named tile slots, no
  // reordering — only scree pixels changed.
  //
  // cliffIce re-pinned again (frozen multi-ground): the frozen biome grew from
  // one `ice` ground to FOUR that all autotile with each other — `snow`,
  // `frozenLake`, `rimeMoss` added as grounds + fills, and ICE_CLIFF's pairings
  // went from ice-over-ice to all 6 cross-pairs (ice<->snow/frozenLake/rimeMoss,
  // snow<->frozenLake, snow<->rimeMoss, frozenLake<->rimeMoss). Crisp/faceted
  // seams (edgeIrregularity 14 -> 6). +6x47 pairings +3 fills → 274 -> 559 tiles
  // (128x1120). Appended after ice-self, so no existing tile reorders. Desert
  // (`cliff`) and reef (`cliffReef`) are untouched — same hashes.
  //
  // cliffReef re-pinned for M2 Task R3a: reef ramps (REEF wall + the four
  // reefFloor/reefSilt/reefWater/glowMoss ground ramps) recoloured to match
  // the shipped tileset7 reef zone (plum/skyBlue/indigo bio-rock wall over
  // a dark teal/indigo floor family), and the four reef ground `floorFill`
  // recipes were split out of one shared placeholder branch into distinct,
  // palette-locked recipes per ground. Desert (`cliff`) and ice (`cliffIce`)
  // are untouched by this change — same hashes as before.
  //
  // cliffReef re-pinned again for M2 Task R3c: `coralRockWallFace`
  // (materials.ts) replaces the tier-2 `blockWallFace` placeholder with a
  // bespoke plum bio-rock wall face (the REEF face-ramp in palette.ts).
  // Same 274 named tile slots, no reordering — only the reef wall's face
  // pixels changed. Desert (`cliff`) and ice (`cliffIce`) are untouched.
  //
  // cliffReef re-pinned again for M2 Task R3d: REEF_CLIFF's `cornerRounding`
  // raised 2 -> 8 (presets.ts) so the reef's ground-to-ground blob seams
  // (reefFloor<->reefSilt/reefWater/glowMoss/reefFloor) read as larger,
  // rounder, more organic corners than the cliff/plateau edges, which keep
  // their own `topRounding` (unchanged, via `linkPlateauCorners`). Same 274
  // named tile slots, no reordering — only ground-transition blob-mask
  // corner pixels changed. Desert (`cliff`) and ice (`cliffIce`) are
  // untouched.
  //
  // cliffReef re-pinned again (seam tuning + all-pairs): the reef ground
  // seams were tuned live by the owner in the seam-rounding tuner —
  // `edgeInset` 2->3, `edgeIrregularity` 14->20, `cornerRounding` stays 8,
  // new decoupled `pocketRounding` 8 (rounds patches' OUTER corners
  // independently of the INNER-corner `cornerRounding`), and a new
  // `pairingSeed` 7439 that reseeds ONLY the ground-transition blobs (the
  // coral wall face / ramps keep base seed 7777, so they're byte-identical).
  // AND the four reef grounds now autotile with EACH OTHER, not just against
  // reefFloor: three pairings appended — reefSilt<->reefWater,
  // reefSilt<->glowMoss, reefWater<->glowMoss (+3x47 = 141 tiles, sheet grows
  // 418 -> 559 tiles, 128x1120). Appended after the reefFloor pairings, so no
  // existing tile is reordered (additive). Desert (`cliff`) and ice
  // (`cliffIce`) are untouched — same hashes.
  //
  // cliffLava: NEW lava biome sheet (build order ice -> reef -> lava). Four
  // volcanic grounds all autotiling (emberRock/ash/lava/lavaCrust), organic
  // seams (edgeIrregularity 18), and a bespoke tier-3 `basaltRock` wall face
  // (Worley basalt cells with molten fissures glowing through — ~half the
  // cracks run molten, LAVA face-ramp). 559 tiles (128x1120), same shape as
  // reef. Purely additive — desert/ice/reef byte-identical.
  const FROZEN = {
    cliff: "9855c0d2a44564a413ff26ff49e06a42e696d72023e72e7e6fc67a91f9e38830",
    cliffIce: "a6f67685331ca51f28a0b950dbe44a7eb6c2de9b9fe0056061e8d87116afc0f0",
    cliffReef: "842f7eaad9e0a5264980082f13a7a5675d8774bde2a4d0f1045f612919e5769a",
    cliffLava: "8f7e28a519282d0a8532b55fbac06a4ab850d7853562254da9be0503a23a6337",
    // cliffGrove: NEW grove/cave biome sheet (build order ...lava -> grove). Four
    // grounds all autotiling (groveGrass/groveMoss/groveWater/groveSoil); moss is
    // teal-dominant with darkened umber soil showing through. Organic seams
    // (edgeIrregularity 18), tier-2 PLACEHOLDER groveStone wall face (bespoke damp-
    // cave face is future work). 559 tiles. Additive — desert/ice/reef/lava identical.
    //
    // All five re-pinned for the AAP-64 palette migration (2026-07-20,
    // Task 5): CORE recolored; same tile counts/geometry, only hexes moved.
    cliffGrove: "ece22dda91ba568c7899456cad49503c43747dc5fcab3a8afab50ae96508ee85"
  } as const;

  it("cliff.png encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});
