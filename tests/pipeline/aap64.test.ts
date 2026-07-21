import { describe, it, expect } from "vitest";
import { AAP64 } from "../../tools/pipeline/src/palette/aap64";

describe("AAP64 canonical list", () => {
  it("has exactly 64 unique lowercase #rrggbb colors", () => {
    expect(AAP64).toHaveLength(64);
    for (const c of AAP64) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(new Set(AAP64).size).toBe(64);
  });
  it("matches the pinned provenance checksum", () => {
    // Guards against accidental edits to the canonical list.
    const { createHash } = require("node:crypto");
    const sum = createHash("sha256").update(AAP64.join(",")).digest("hex");
    expect(sum).toBe(PINNED_AAP64_SHA); // fill from Step 4
  });
});
const PINNED_AAP64_SHA =
  "40ee047ef989f05635e2c0560b8748998d32feb7cb9434995b49d26a96d2cec7";
