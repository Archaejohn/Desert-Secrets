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
    hero: "c8d99f5cc6070c1f308da9acdfe2dab6a6381efad38f10f4337c275ddf721b79",
    npc: "f66216827e701f3845b0762116ce4f2252097354d9d481f43b27d93da1023b05",
    scarab: "e8f2bd6732bf960ed717852c43799fef5e1a90fb49272fc00c24c7a1a24dcacf",
    // Deliberately re-pinned for the Phase O overworld art pass
    // (docs/ART_DIRECTION.md §4a, docs/CONTRACTS.md "Phase O"): the sand
    // family + water were redrawn in place — dune ridge lanes and the
    // 3-value wave recipe replace the per-pixel speckle. Same 16 tile
    // slots, no reordering; only pixels changed.
    tiles: "f506d7a4c5c2401aebe324b994c8e6ee773b9d38accc3aef12f3f5ad8efc06f9",
    rosa: "7a34c3022fd0975aee7e72896fa7817ed050e1ff8fa569158b37a06e9058f800",
    piggy: "cc3f766a6eb7be16010a92dee01f32f68fcb74f3fd15004cd2657fb4ca449b14",
    jackrabbit: "673e3c6735518e804cb6889d2fa36dbc40bdc691a884497815adc843d94f24b1",
    buzzard: "6852ce5278b03a8ceb575f6f9ef6481eb5aacab8b2a231f8eee4f7c965d21515",
    gila: "8eb0b4071b8b8932c1729c5668553b328be8578c521e3fe2827d326935b0740e",
    foreman: "3a19d6645c9811766b263a7d4545cb3ccef9d07f4e7ef394acda26efac77b3d6",
    queen: "0310d5f91f7cc5fe1cee632196247bd1c8850634648468166140e068ae0fd06d",
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
    tiles2: "2323dbac873c1586ad4089d31c3e24d0c4c8e2901eeb82917479553cd34aa281"
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
    john: "f98e6e021b271968ddd0075e8185c99cde89e322521bbaa80754c2795996d3a4",
    pamela: "80de26de1cab3a87195947ba6273e335ffa1a956eaefe551e326f26aa128ff1a",
    chicken: "c5da747f347ae1642a0cee2f6eb37fcd77b099b61dd0a66f6bdf73a886db2263"
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
    thomas: "a209526cd6549ee7039ed847fec99b1128bfbc0972c659f995de026e0f121fbb"
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
    bucket: "830d0036b0193466c104cf54cc8615da923be72c1e0d6df4c53a595d655558a9"
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
    spigot: "010650cffe7d4d9d538e72ecd40050037bf7d0cd0fef77f5e56d96352c861ef3"
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
    anglerfish: "ed32256b88db361046b9b6e7b73357b45da3a688734ace23488424ce0f3f5ffd",
    reefeel: "af75f0b1261277f8fbf10aafda110435cf573c13c2ff4f1b4859246e254b9f44",
    lurker: "bd1eea8907e5ad52b0397cbf91612c5d8788ebbd470dcfff0bcbdbd532a0a799",
    // tiles4 deliberately re-pinned for the Phase Z 2.5D art pass
    // (docs/ART_DIRECTION.md §5): seaWater redrawn to the wave recipe,
    // floe/templeFloor speckle replaced by motif clusters, templePillar
    // reads base-lit, and 16 dressing tiles appended (floe coast ring +
    // shades). Additive — no existing tile index moved.
    tiles4: "bb1808e7203d861d1ccd12b46e59f11aa8e0134e5ed33f2f84b7116174ca1e16"
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
    middenmite: "c14dc21ac560222d3e0b15e0650014d3db45e38779c0809d891860ac48a25c35",
    // tiles5 deliberately re-pinned again for the Phase Z 2.5D art pass:
    // plank floor gains a lit board subgrid, campWall becomes a wall-top
    // texture, crates/barrel get lit tops (G1), and 8 dressing tiles are
    // appended (campWall cap/face + floor shades). Additive only.
    tiles5: "b25f695bb592aed06d9959fe2e6d39cef451f87988edd9f4b653768a20b2f277"
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
    sunwasp: "04f7f3606f868ce181ccbfd132b4180db663d11712fb0e92599dd463f7f4de81",
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
    tiles6: "6e1615a4e7bc3fb5f22a9190115823edfff8e910a7af9ef31e934d6d43fd685a"
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
    reefstalker: "9c3d22957812eeee4015e9f3f4025a793a4385cbaced0f2a171823d465c50848",
    // tiles7 deliberately re-pinned for the Phase Z 2.5D art pass: reef
    // floors/water/glow-moss redrawn to motif clusters and rounded lobes,
    // and 16 dressing tiles appended (reefWall cap/face, shades, silt↔floor
    // fingers). Additive only.
    tiles7: "2a60e7f02f61386adb03ee42f0ee4e9741ec68bbdca4ec94a392d96fdbac3905"
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
    testudo: "4d6f2d2ee453e69ca7dedab13f7d3dfc1833b823bb3b2f621ed46758481bf335",
    // tiles8 deliberately re-pinned for the Phase Z 2.5D art pass: the
    // lavaVent glow ramp (rust→amber→bone heart), ember/ash motif clusters,
    // checker-floor bevel subgrid, and 16 dressing tiles appended
    // (basaltWall cap/face, shades, ash↔ember seams). Additive only.
    tiles8: "a3a8e8ceb26078b05c306d983cfbfc74ffbbcc63f94a501c601897b10ccf7e24"
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
    tiles3: "ec5e17dafca75111d7e6fc8cbc7019346bf9eecbf6f9488e3d08c0a0fbfb0798"
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
    dusty: "da5fc1e2abe64a238deefafb86d576b4237e3c95f12034fdc30cea1094cb9147",
    sahra: "fb91a963b0c5dc7a2270d0dcf27cade3c864566fce3a2d031c2e640b327b62a9"
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
    gearIcons: "0e6f3de9ec6150fc574bfac9dd9ade83f60971f274ee175de673c67575c13e80"
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
    owMountains: "cdb2dbdb76f56992782acd02dc21ebff4243aa5d842776f8b1cf5185854e06b9"
  } as const;

  it("owMountains encodes to its committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});
