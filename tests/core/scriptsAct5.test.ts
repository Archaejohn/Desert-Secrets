import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript
} from "../../src/core/dialogue";
import { groveDescentEntryScript } from "../../src/core/scripts/groveDescentEntry";
import { groveApproachEntryScript } from "../../src/core/scripts/groveApproachEntry";
import { groveGrottoEntryScript } from "../../src/core/scripts/groveGrottoEntry";
import { groveChamberEntryScript } from "../../src/core/scripts/groveChamberEntry";
import { sahraGroveEntryScript } from "../../src/core/scripts/sahraGroveEntry";
import { groveChaseScript } from "../../src/core/scripts/groveChase";
import { fluffballJoinScript } from "../../src/core/scripts/fluffballJoin";
import { act5EndingScript } from "../../src/core/scripts/act5Ending";
import { sahraGroveScript } from "../../src/core/scripts/sahraGrove";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["groveDescentEntry", groveDescentEntryScript],
  ["groveApproachEntry", groveApproachEntryScript],
  ["groveGrottoEntry", groveGrottoEntryScript],
  ["groveChamberEntry", groveChamberEntryScript],
  ["sahraGroveEntry", sahraGroveEntryScript],
  ["groveChase", groveChaseScript],
  ["fluffballJoin", fluffballJoinScript],
  ["act5Ending", act5EndingScript],
  // Sahra's reactive trade, in a few Act-1-choice combinations.
  ["sahra:mercy+parley", sahraGroveScript({ rabbitTradedColdPack: true, parleyed: true })],
  ["sahra:grit+force", sahraGroveScript({ rabbitResolved: true, queenResolved: true })],
  ["sahra:neither", sahraGroveScript({})]
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

describe("Act 5 script validation", () => {
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

describe("Slither's hissing esses (Act 5)", () => {
  it("hisses in every Act 5 script where he speaks", () => {
    for (const [, script] of NAMED_SCRIPTS) {
      const slitherLines = script.nodes
        .flatMap((n) => n.lines)
        .filter((l) => l.speaker === "Slither")
        .map((l) => l.text)
        .join(" ");
      if (slitherLines.length === 0) continue; // not every script has Slither
      expect(slitherLines).toMatch(/sss/i);
    }
  });
});

describe("groveChase — the near-catch that isn't funny", () => {
  it("lands the tone shift: Piggy is scared, not playing", () => {
    const text = allText(groveChaseScript).toLowerCase();
    expect(text).toMatch(/needle-cactus/);
    expect(text).toMatch(/scared|not playing/);
  });
});

describe("fluffballJoin — clue #3 and the join", () => {
  it("gives the oranges clue and commits Fluffball to the party", () => {
    const text = allText(fluffballJoinScript).toLowerCase();
    expect(text).toMatch(/orange/);
    expect(text).toMatch(/oldest row/);
    // Fluffball speaks here (his first real dialogue).
    const speakers = fluffballJoinScript.nodes.flatMap((n) => n.lines).map((l) => l.speaker);
    expect(speakers).toContain("Fluffball");
  });
});

describe("act5Ending — points on to Act 6 (The Reef)", () => {
  it("names the seaweed as the last ingredient and the reef ahead", () => {
    const text = allText(act5EndingScript).toLowerCase();
    expect(text).toMatch(/seaweed/);
    expect(text).toMatch(/reef/);
  });
});

// ---- The mandated payoff: Sahra reacts to Act 1–2 choices ----

describe("Sahra's reactive trade (the first real callback payoff)", () => {
  it("reacts differently to the cold-pack choice (mercy vs. grit)", () => {
    const mercy = allText(sahraGroveScript({ rabbitTradedColdPack: true }));
    const grit = allText(sahraGroveScript({ rabbitResolved: true }));
    expect(mercy).not.toBe(grit);
    expect(mercy.toLowerCase()).toMatch(/mercy/);
    expect(grit.toLowerCase()).toMatch(/practical/);
  });

  it("reacts differently to the Dust Queen choice (parley vs. fight)", () => {
    const parley = allText(sahraGroveScript({ parleyed: true }));
    const fought = allText(sahraGroveScript({ queenResolved: true }));
    expect(parley).not.toBe(fought);
    expect(parley.toLowerCase()).toMatch(/talked|words/);
    expect(fought.toLowerCase()).toMatch(/fought|muscle/);
  });

  it("produces genuinely distinct dialogue across at least two flag combos", () => {
    // Four Act-1-choice combinations; each should read differently, not a
    // one-word swap. Collect the full text of each and assert they're unique.
    const combos: Array<Record<string, boolean>> = [
      { rabbitTradedColdPack: true, parleyed: true }, // mercy + words
      { rabbitResolved: true, queenResolved: true }, // grit + force
      { rabbitTradedColdPack: true, queenResolved: true }, // mercy + force
      {} // neither remembered
    ];
    const texts = combos.map((c) => allText(sahraGroveScript(c)));
    const unique = new Set(texts);
    // At least three of the four combinations are mutually distinct.
    expect(unique.size).toBeGreaterThanOrEqual(3);
    // And no two of the first three (all fully-specified) collide.
    expect(new Set(texts.slice(0, 3)).size).toBe(3);
  });

  it("always closes by handing over the oldest-row oranges", () => {
    const combos: Array<Record<string, boolean>> = [{ parleyed: true }, { queenResolved: true }, {}];
    for (const c of combos) {
      const { lines, runner } = playThrough(sahraGroveScript(c));
      expect(runner.active).toBe(false);
      const text = lines.map((l) => l.text.toLowerCase()).join(" ");
      expect(text).toMatch(/orange/);
      expect(text).toMatch(/oldest row|old row/);
    }
  });
});
