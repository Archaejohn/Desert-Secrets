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
  // Deliberately re-pinned for the Phase S sprite polish (docs/ART_DIRECTION.md §6):
  // sel-out contours + NNW rim light repainted every character/creature sheet
  // in place — same grids, same frame indices, only pixels. Tile sheets are
  // untouched by this pass and keep their previous hashes.
  const FROZEN = {
    hero: "c8d99f5cc6070c1f308da9acdfe2dab6a6381efad38f10f4337c275ddf721b79",
    npc: "f66216827e701f3845b0762116ce4f2252097354d9d481f43b27d93da1023b05",
    scarab: "e8f2bd6732bf960ed717852c43799fef5e1a90fb49272fc00c24c7a1a24dcacf",
    tiles: "23a632351b59297b3276a0cdd55318092bfbf83f203a7abcdf84b45dbcb72ed0",
    rosa: "7a34c3022fd0975aee7e72896fa7817ed050e1ff8fa569158b37a06e9058f800",
    piggy: "cc3f766a6eb7be16010a92dee01f32f68fcb74f3fd15004cd2657fb4ca449b14",
    jackrabbit: "673e3c6735518e804cb6889d2fa36dbc40bdc691a884497815adc843d94f24b1",
    buzzard: "6852ce5278b03a8ceb575f6f9ef6481eb5aacab8b2a231f8eee4f7c965d21515",
    gila: "8eb0b4071b8b8932c1729c5668553b328be8578c521e3fe2827d326935b0740e",
    foreman: "3a19d6645c9811766b263a7d4545cb3ccef9d07f4e7ef394acda26efac77b3d6",
    queen: "0310d5f91f7cc5fe1cee632196247bd1c8850634648468166140e068ae0fd06d",
    // Deliberately re-pinned (docs/CONTRACTS.md "v9"): tiles2 grew a fourth
    // row of eight mountain-ridge tiles for the overworld POC. The row was
    // appended after every existing tile, so none of their indices moved —
    // only the sheet's overall bytes/dimensions changed, which is exactly
    // what re-pinning here is for.
    tiles2: "5e85ceabae38fd349347a11cca04eb18bfdfc8d07062bbcefd4ca2edd9e904d1"
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
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    middenmite: "c14dc21ac560222d3e0b15e0650014d3db45e38779c0809d891860ac48a25c35",
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
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    sunwasp: "04f7f3606f868ce181ccbfd132b4180db663d11712fb0e92599dd463f7f4de81",
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
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    reefstalker: "9c3d22957812eeee4015e9f3f4025a793a4385cbaced0f2a171823d465c50848",
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
  // Re-pinned for the Phase S sprite polish — see the note on the first block.
  const FROZEN = {
    testudo: "4d6f2d2ee453e69ca7dedab13f7d3dfc1833b823bb3b2f621ed46758481bf335",
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
