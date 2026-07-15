import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { crateChaseScript } from "../../src/core/scripts/crateChase";
import { fluffballLedgeScript } from "../../src/core/scripts/fluffballLedge";
import { minersFavorScript } from "../../src/core/scripts/minersFavor";
import { minersRewardScript } from "../../src/core/scripts/minersReward";
import { minersReekScript } from "../../src/core/scripts/minersReek";
import { act4EndingScript } from "../../src/core/scripts/act4Ending";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["crateChase", crateChaseScript],
  ["fluffballLedge", fluffballLedgeScript],
  ["minersFavor", minersFavorScript],
  ["minersReward", minersRewardScript],
  ["minersReek", minersReekScript],
  ["act4Ending", act4EndingScript],
];

function playThrough(script: DialogueScript) {
  const runner = new DialogueRunner(script);
  const lines = [runner.start()];
  for (let guard = 0; guard < 200; guard++) {
    const next = runner.advance();
    if (next === null) return { runner, lines };
    lines.push(next);
  }
  throw new Error("script did not terminate in 200 steps");
}

function allText(script: DialogueScript): string {
  return script.nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
}

describe("Act 4 script validation", () => {
  it.each(NAMED_SCRIPTS)("%s passes validateScript", (_name, script) => {
    expect(() => validateScript(script)).not.toThrow();
  });

  it.each(NAMED_SCRIPTS)("%s keeps every line within the 48-char box", (_name, script) => {
    for (const node of script.nodes) {
      for (const l of node.lines) expect(l.text.length).toBeLessThanOrEqual(48);
    }
  });

  it.each(NAMED_SCRIPTS)("%s terminates", (_name, script) => {
    const { runner } = playThrough(script);
    expect(runner.active).toBe(false);
  });
});

describe("Slither's hissing esses (Act 4)", () => {
  it("hisses in every Act 4 script where he speaks", () => {
    for (const script of [crateChaseScript, fluffballLedgeScript, minersFavorScript, minersRewardScript, act4EndingScript]) {
      const slitherLines = script.nodes
        .flatMap((n) => n.lines)
        .filter((l) => l.speaker === "Slither")
        .map((l) => l.text)
        .join(" ");
      expect(slitherLines.length).toBeGreaterThan(0);
      expect(slitherLines).toMatch(/sss/i);
    }
  });
});

describe("crateChase", () => {
  it("catches Piggy raiding and burrowing out the far side of the crates", () => {
    const text = allText(crateChaseScript);
    expect(text).toMatch(/crate/i);
    expect(text).toMatch(/raiding/i);
    expect(text).toMatch(/far side/i);
  });
});

describe("fluffballLedge", () => {
  it("has Fluffball speak exactly one line — the ripest-socks clue", () => {
    const fluffLines = fluffballLedgeScript.nodes
      .flatMap((n) => n.lines)
      .filter((l) => l.speaker === "Fluffball");
    expect(fluffLines).toHaveLength(1);
    expect(fluffLines[0].text).toMatch(/ripest socks/i);
    expect(fluffLines[0].text).toMatch(/not just any/i);
  });
});

describe("minersFavor", () => {
  it("sets up the midden-mite favor before the socks change hands", () => {
    const text = allText(minersFavorScript);
    expect(text).toMatch(/midden mites/i);
    expect(text).toMatch(/laundry nook/i);
    expect(text).toMatch(/socks are yours/i);
  });
});

describe("minersReek", () => {
  it("is the comic held-socks reaction, distinct from calm camp chatter", () => {
    const text = allText(minersReekScript);
    expect(text).toMatch(/smell/i);
    expect(text).toMatch(/downwind/i);
  });
});

describe("act4Ending", () => {
  it("ends on the Act 5 title card", () => {
    const { lines, runner } = playThrough(act4EndingScript);
    expect(lines[lines.length - 1].text).toBe("ACT 5: THE SUNLIT CAVE-IN");
    expect(lines[lines.length - 2].text).toBe("END OF ACT 4");
    expect(runner.active).toBe(false);
  });

  it("names the socks as the second of the four things Piggy loves", () => {
    const text = allText(act4EndingScript);
    expect(text).toMatch(/socks/i);
    expect(text).toMatch(/two down/i);
  });
});
