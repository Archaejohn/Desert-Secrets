import { describe, expect, it } from "vitest";
import {
  MINERS_HAT_PRICE,
  PICKAXE_PRICE,
  gusShopScript,
  moShopScript,
  shopScriptFor,
} from "../../src/core/scripts/minerShop";
import { validateScript } from "../../src/core/dialogue";

const hubChoices = (script: { nodes: { id: string; choices?: { next: string }[] }[] }) =>
  script.nodes.find((n) => n.id === "hub")!.choices!.map((c) => c.next);

describe("miner-shop scripts", () => {
  it("prices are the tuned faucet values", () => {
    expect(MINERS_HAT_PRICE).toBe(2);
    expect(PICKAXE_PRICE).toBe(3);
  });

  it("both scripts are structurally valid dialogue", () => {
    expect(() => validateScript(moShopScript)).not.toThrow();
    expect(() => validateScript(gusShopScript)).not.toThrow();
  });

  it("offer=true keeps the Buy choice (leading to buy-end)", () => {
    for (const base of [moShopScript, gusShopScript]) {
      const offered = shopScriptFor(base, true);
      expect(offered).toBe(base); // no clone when nothing is stripped
      expect(hubChoices(offered)).toContain("buy-end");
    }
  });

  it("offer=false strips the Buy choice, leaving only the decline", () => {
    for (const base of [moShopScript, gusShopScript]) {
      const stripped = shopScriptFor(base, false);
      expect(stripped).not.toBe(base); // a fresh clone
      expect(hubChoices(stripped)).not.toContain("buy-end");
      expect(hubChoices(stripped)).toContain("later-end");
      // The stripped copy is still a valid, playable script.
      expect(() => validateScript(stripped)).not.toThrow();
    }
  });

  it("stripping does not mutate the source script", () => {
    const before = JSON.stringify(moShopScript);
    shopScriptFor(moShopScript, false);
    expect(JSON.stringify(moShopScript)).toBe(before);
  });

  it("keeps every spoken line within the 48-char budget", () => {
    for (const base of [moShopScript, gusShopScript]) {
      for (const node of base.nodes) {
        for (const line of node.lines) {
          expect(line.text.length).toBeLessThanOrEqual(48);
        }
      }
    }
  });
});
