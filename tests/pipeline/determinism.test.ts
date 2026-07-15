/** Generating twice must yield byte-for-byte identical output, and the v1
 *  assets (hero, npc, scarab, tiles) must never change at all. */
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
  const FROZEN = {
    hero: "f04261c56e07861c1cef3d377339d1bd22c9f7bd9be2cfdc459fadb7ed4d3d53",
    npc: "fb33522d654c14306d02452dcfb313dafc4ebd9cff5052f19b5b61fb108e1f68",
    scarab: "0b5a22a21161c83c75bce3d8aaffea7ae83998907b5b2a185da3fb1b2eed0842",
    // Deliberately re-pinned for the Phase O overworld art pass
    // (docs/ART_DIRECTION.md §4a, docs/CONTRACTS.md "Phase O"): the sand
    // family + water were redrawn in place — dune ridge lanes and the
    // 3-value wave recipe replace the per-pixel speckle. Same 16 tile
    // slots, no reordering; only pixels changed.
    tiles: "95672846ff4eb27b375abea6d3ea40c0635bfc1b6e0aee8a3d8b000849fc4b66",
    rosa: "b756ef76590e50051dca7cda6b641c175f7a16d27351e2620a4b248280c03f65",
    piggy: "72e7afe420870935d599b505e6e897d4b3b139f4f10b518dafcfbd45e9662f23",
    jackrabbit: "3bbd64eb56c62e568d157a57a508603f651cc35bfe87682ec44b85706789cedb",
    buzzard: "abca02c5bcf5facefc3861747efc6ee8eae56e6f536f59a2017c6b3ee241a374",
    gila: "3d9ca6c37e39482058290a45164e98fe642a88787c50e26da881ca23f227bd42",
    foreman: "a7842a7b01d4ad9457ef3fd13348773f4854af678f76365740d1bcf09dc0dfa2",
    queen: "e318e9e692c82efdf9223524b1cf57d35915b70fa196ac0631fae6d44491ce30",
    // Deliberately re-pinned twice: first for docs/CONTRACTS.md "v9" (the
    // eight appended mountain-ridge tiles), and again for the Phase O
    // overworld art pass (docs/ART_DIRECTION.md §4a): mountain1–8 redrawn
    // in place with the FF6 3/4-view recipe, all per-pixel speckle replaced
    // by 2×2 motif clusters, and three rows appended (scree/shade tiles,
    // the coast surf ring, the sand↔scree finger set). Indices 0..31
    // unmoved; the appendix occupies 32..55 only.
    tiles2: "6c79ca4745aa7a4e87aa552ff84fc01479288cb33847e2d5832e10cd3adbc985"
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
  const FROZEN = {
    john: "19999fa7f84c95a3f6051ebb19f33190e026daff5d035b494631737a313e2a1e",
    pamela: "52f5a094c756b194f1e53ba6aba14caa9e80c81d8b2284c24f9c83d5b7444ad3",
    chicken: "f7b656b5b02aba2522d68f9c8b5d930d7e40c87a168a354087ab4510441d67c0"
  } as const;

  it("john/pamela/chicken sheets encode to their committed bytes", () => {
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
  const FROZEN = {
    bucket: "43cd2f8960b444f9862b7daa15fdc8325ea9aff0045d4256a84df627acdc6c13"
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
  const FROZEN = {
    spigot: "18c897f81e8ae093972250408175094dc7fda623380fd64440dcebf947675709"
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
  const FROZEN = {
    anglerfish: "71c1b7097f22fa8156a859add847ad21e43da7b294f6e949ae9948503ab4314a",
    reefeel: "ae3638b677ad4c33d1db03b226834d639e8c1efc4636d525672c566b4cc8ff34",
    lurker: "27a52932ab8f6c5419cea0b0409e0e7bf46869b997816487afa5286c2fdaae58",
    tiles4: "4eba3ae62821a53e8f6a80b493c87da78dc954ea7c559c3bf406b5023c2e9460"
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
  const FROZEN = {
    middenmite: "03a1629bb638bd1824cfd79aa53470ac3624394a3be49b1276c46b585ee3f50e",
    tiles5: "d0465acec6c4a59e74d6be77761f2fce3db3349d82c083dd576af99025c930e5"
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
  const FROZEN = {
    sunwasp: "de23f39059f6070b1af957854fcfa8966d9b31e7881dd9d29a60791eb047c46b",
    tiles6: "80aa215f2f5b2ea55fca962075f716141ffd98f5ea13c954af0b903a0447a9d4"
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
  const FROZEN = {
    reefstalker: "3733e41a2dd2372260fb8e325d9e913bbc69bbc8bede60da728dee45606c0492",
    tiles7: "5cc6584328754c7bb17b39939e731f3fa0bc2ee796c489f2de660f50d70c60e5"
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
  const FROZEN = {
    testudo: "bf6d3649f8c5af217aa6a174a1edb9ee2ff9b84f84096a14d7e3de718a1bffda",
    tiles8: "a901f8c9f689519c56ef078e4fbf24caf973fb2febdae6bdb62f33c53bb29be0"
  } as const;

  it("testudo/tiles8 encode to their committed bytes", () => {
    const assets = buildAssets();
    for (const key of Object.keys(FROZEN) as Array<keyof typeof FROZEN>) {
      const hash = createHash("sha256").update(encodePng(assets[key])).digest("hex");
      expect(hash, `${key}.png changed`).toBe(FROZEN[key]);
    }
  });
});
