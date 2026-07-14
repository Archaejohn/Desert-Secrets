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
    tiles: "23a632351b59297b3276a0cdd55318092bfbf83f203a7abcdf84b45dbcb72ed0",
    rosa: "b756ef76590e50051dca7cda6b641c175f7a16d27351e2620a4b248280c03f65",
    piggy: "72e7afe420870935d599b505e6e897d4b3b139f4f10b518dafcfbd45e9662f23",
    jackrabbit: "3bbd64eb56c62e568d157a57a508603f651cc35bfe87682ec44b85706789cedb",
    buzzard: "abca02c5bcf5facefc3861747efc6ee8eae56e6f536f59a2017c6b3ee241a374",
    gila: "3d9ca6c37e39482058290a45164e98fe642a88787c50e26da881ca23f227bd42",
    foreman: "a7842a7b01d4ad9457ef3fd13348773f4854af678f76365740d1bcf09dc0dfa2",
    queen: "e318e9e692c82efdf9223524b1cf57d35915b70fa196ac0631fae6d44491ce30",
    tiles2: "84c78b7e8663f5e8b15630ad2ffa4538097454f8309a846ce4847823c26c9bc7"
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
