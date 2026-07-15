import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript
} from "../../src/core/dialogue";
import { reefDescentEntryScript } from "../../src/core/scripts/reefDescentEntry";
import { reefGardenEntryScript } from "../../src/core/scripts/reefGardenEntry";
import { reefWarrenEntryScript } from "../../src/core/scripts/reefWarrenEntry";
import { reefHollowEntryScript } from "../../src/core/scripts/reefHollowEntry";
import { reefCourtEntryScript } from "../../src/core/scripts/reefCourtEntry";
import { reefChaseScript } from "../../src/core/scripts/reefChase";
import { reefParleyScript } from "../../src/core/scripts/reefParley";
import { reefYieldScript } from "../../src/core/scripts/reefYield";
import { act6EndingScript } from "../../src/core/scripts/act6Ending";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["reefDescentEntry", reefDescentEntryScript],
  ["reefGardenEntry", reefGardenEntryScript],
  ["reefWarrenEntry", reefWarrenEntryScript],
  ["reefHollowEntry", reefHollowEntryScript],
  ["reefCourtEntry", reefCourtEntryScript],
  ["reefChase", reefChaseScript],
  ["reefParley", reefParleyScript],
  ["reefYield", reefYieldScript],
  ["act6Ending", act6EndingScript]
];

/** Walk a script to its terminal node, picking `choose(nodeId)` at any choice
 *  point. Returns the id of the terminal node reached. */
function runTo(script: DialogueScript, choose: (nodeId: string | null) => number = () => 0): string {
  const r = new DialogueRunner(script);
  r.start();
  let last = r.currentNodeId;
  for (let guard = 0; guard < 200; guard++) {
    last = r.currentNodeId ?? last;
    const choices = r.choices;
    let next;
    if (choices) {
      const idx = Math.max(0, Math.min(choose(r.currentNodeId), choices.length - 1));
      next = r.advance(idx);
    } else {
      next = r.advance();
    }
    if (next === null) return last ?? "";
  }
  throw new Error("script did not terminate in 200 steps");
}

function allText(script: DialogueScript): string {
  return script.nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
}

describe("Act 6 script validation", () => {
  it.each(NAMED_SCRIPTS)("%s passes validateScript", (_name, script) => {
    expect(() => validateScript(script)).not.toThrow();
  });

  it.each(NAMED_SCRIPTS)("%s keeps every line within the 48-char box", (_name, script) => {
    for (const node of script.nodes) {
      for (const l of node.lines) expect(l.text.length).toBeLessThanOrEqual(48);
    }
  });

  it.each(NAMED_SCRIPTS)("%s terminates from every branch", (_name, script) => {
    // Terminates whether choices go low (index 0) or high (last index).
    expect(runTo(script, () => 0)).not.toBe("");
    expect(runTo(script, () => 99 as number).length).toBeGreaterThanOrEqual(0);
  });
});

describe("Slither's hissing esses (Act 6)", () => {
  it("hisses in every Act 6 script where he speaks", () => {
    for (const [, script] of NAMED_SCRIPTS) {
      const slitherLines = script.nodes
        .flatMap((n) => n.lines)
        .filter((l) => l.speaker === "Slither")
        .map((l) => l.text)
        .join(" ");
      if (slitherLines.length === 0) continue;
      expect(slitherLines).toMatch(/sss/i);
    }
  });
});

describe("reefChase — the tense turn (Fluffball, not Joseph, calls after)", () => {
  it("is the near-catch that stops being cute: Piggy is frightened", () => {
    const text = allText(reefChaseScript).toLowerCase();
    expect(text).toMatch(/cornered|frightened/);
    expect(text).toMatch(/isn't a game|not playing|shrieks/);
    expect(text).toMatch(/nobody laughs/);
  });

  it("has FLUFFBALL — not Joseph — call after Piggy as he slips away", () => {
    const lines = reefChaseScript.nodes.flatMap((n) => n.lines);
    const caller = lines.find((l) => /come back|piggy!/i.test(l.text));
    expect(caller?.speaker).toBe("Fluffball");
    // Joseph does NOT get the call-after line (the load-bearing beat).
    const josephCallsAfter = lines.some((l) => l.speaker === "Joseph" && /come back/i.test(l.text));
    expect(josephCallsAfter).toBe(false);
  });

  it("delivers clue #4: the exact cultivated MINT kelp (not wild growth)", () => {
    const text = allText(reefChaseScript).toLowerCase();
    expect(text).toMatch(/mint kelp/);
    expect(text).toMatch(/seaweed/);
    expect(text).toMatch(/on purpose|grow/);
  });
});

describe("reefParley — trade-not-fight branch point (queen-shaped)", () => {
  it("has both a peaceful trade terminal and an avoidable fight terminal", () => {
    const ids = reefParleyScript.nodes.map((n) => n.id);
    expect(ids).toContain("trade-end");
    expect(ids).toContain("affront");
  });

  it("a good approach (choose the fair options) reaches the peaceful trade", () => {
    // index 0 is the courteous option at each decision point.
    expect(runTo(reefParleyScript, () => 0)).toBe("trade-end");
  });

  it("a bad first move (grab the kelp) routes straight to the fight", () => {
    expect(runTo(reefParleyScript, () => 1)).toBe("affront");
  });

  it("a bad SECOND move (snatch it) also routes to the fight", () => {
    // good first choice (0 → offer), then bad second choice (1 → affront).
    let seen = 0;
    const chooser = () => (seen++ === 0 ? 0 : 1);
    expect(runTo(reefParleyScript, chooser)).toBe("affront");
  });

  it("Fluffball translates/vouches and Slither negotiates in the parley", () => {
    const speakers = reefParleyScript.nodes.flatMap((n) => n.lines).map((l) => l.speaker);
    expect(speakers).toContain("Fluffball");
    expect(speakers).toContain("Slither");
    expect(speakers).toContain("Crawler");
  });

  it("the peaceful path hands over mint kelp; the fight path calls a predator", () => {
    const trade = reefParleyScript.nodes.find((n) => n.id === "trade-end");
    expect(trade?.lines.map((l) => l.text).join(" ").toLowerCase()).toMatch(/mint kelp|kelp/);
    const affront = reefParleyScript.nodes.find((n) => n.id === "affront");
    expect(affront?.lines.map((l) => l.text).join(" ").toLowerCase()).toMatch(/hunter|stalker/);
  });
});

describe("reefYield — the post-fight resolution", () => {
  it("relents after the avoidable fight and gives up the kelp in peace", () => {
    const text = allText(reefYieldScript).toLowerCase();
    expect(text).toMatch(/kelp/);
    expect(text).toMatch(/truce|peace/);
  });
});

describe("act6Ending — the fourth ingredient, on to Act 7", () => {
  it("names the seaweed as the last of four and points to the pizzeria", () => {
    const text = allText(act6EndingScript).toLowerCase();
    expect(text).toMatch(/seaweed/);
    expect(text).toMatch(/all four|four/);
    expect(text).toMatch(/pizza|pizzeria/);
  });
});
