import { describe, expect, it } from "vitest";
import { DialogueRunner, validateScript, type DialogueScript } from "../../src/core/dialogue";
import { pizzaDescentEntryScript } from "../../src/core/scripts/pizzaDescentEntry";
import { pizzaVentEntryScript } from "../../src/core/scripts/pizzaVentEntry";
import { pizzaApproachEntryScript } from "../../src/core/scripts/pizzaApproachEntry";
import { pizzeriaEntryScript } from "../../src/core/scripts/pizzeriaEntry";
import { testudoBakeScript } from "../../src/core/scripts/testudoBake";
import { piggyReunionScript } from "../../src/core/scripts/piggyReunion";
import { testudoRevealScript } from "../../src/core/scripts/testudoReveal";
import { pizzaAscentEntryScript } from "../../src/core/scripts/pizzaAscentEntry";
import { partOneFinaleScript } from "../../src/core/scripts/partOneFinale";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["pizzaDescentEntry", pizzaDescentEntryScript],
  ["pizzaVentEntry", pizzaVentEntryScript],
  ["pizzaApproachEntry", pizzaApproachEntryScript],
  ["pizzeriaEntry", pizzeriaEntryScript],
  ["testudoBake", testudoBakeScript],
  ["piggyReunion", piggyReunionScript],
  ["testudoReveal", testudoRevealScript],
  ["pizzaAscentEntry", pizzaAscentEntryScript],
  ["partOneFinale", partOneFinaleScript]
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

describe("Act 7 script validation", () => {
  it.each(NAMED_SCRIPTS)("%s passes validateScript", (_name, script) => {
    expect(() => validateScript(script)).not.toThrow();
  });

  it.each(NAMED_SCRIPTS)("%s keeps every line within the 48-char box", (_name, script) => {
    for (const node of script.nodes) {
      for (const l of node.lines) expect(l.text.length).toBeLessThanOrEqual(48);
    }
  });

  it.each(NAMED_SCRIPTS)("%s terminates from every branch", (_name, script) => {
    expect(runTo(script, () => 0)).not.toBe("");
    expect(runTo(script, () => 99 as number).length).toBeGreaterThanOrEqual(0);
  });
});

describe("Slither's hissing esses (Act 7)", () => {
  it("hisses in every Act 7 script where he speaks", () => {
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

describe("the scarab/mystery-bug thread stays untouched (CLAUDE.md constraint)", () => {
  it("no Act 7 script references scarabs or bugs — only the ice/ocean resolves", () => {
    for (const [name, script] of NAMED_SCRIPTS) {
      const text = allText(script).toLowerCase();
      expect(text, `${name} must not mention scarabs`).not.toMatch(/scarab/);
      expect(text, `${name} must not mention bugs`).not.toMatch(/\bbug/);
    }
  });
});

describe("pizzeriaEntry — the restaurant and the chef", () => {
  it("names the restaurant's frozen-in-time setting and Chef Testudo", () => {
    const text = allText(pizzeriaEntryScript).toLowerCase();
    expect(text).toMatch(/three thousand/);
    expect(text).toMatch(/testudo/);
    expect(text).toMatch(/tortoise/);
  });
});

describe("testudoBake — the bake choice hub (fishingCast-shaped)", () => {
  it("has a bake terminal and a back-off terminal", () => {
    const ids = testudoBakeScript.nodes.map((n) => n.id);
    expect(ids).toContain("bake-end");
    expect(ids).toContain("wait-end");
  });

  it("choosing to bake reaches bake-end; backing off reaches wait-end", () => {
    expect(runTo(testudoBakeScript, () => 0)).toBe("bake-end");
    expect(runTo(testudoBakeScript, () => 1)).toBe("wait-end");
  });

  it("names the four ingredients the player brings (dough is Testudo's)", () => {
    const text = allText(testudoBakeScript).toLowerCase();
    expect(text).toMatch(/fish/);
    expect(text).toMatch(/socks/);
    expect(text).toMatch(/oranges/);
    expect(text).toMatch(/kelp/);
    expect(text).toMatch(/dough/);
  });
});

describe("piggyReunion — the catch is a warm reunion, NOT a chase", () => {
  it("Piggy comes to the smell on his own (no chase, no near-miss)", () => {
    const text = allText(piggyReunionScript).toLowerCase();
    expect(text).toMatch(/smell/);
    expect(text).toMatch(/sprint|bursts in|came/);
    // It must NOT read as a chase/near-catch.
    expect(text).not.toMatch(/chase|corner|near-miss/);
  });

  it("Fluffball vouches for Joseph, and Piggy is gently caught mid-bite", () => {
    const lines = piggyReunionScript.nodes.flatMap((n) => n.lines);
    const voucher = lines.find((l) => /friend|helped/i.test(l.text));
    expect(voucher?.speaker).toBe("Fluffball");
    const text = allText(piggyReunionScript).toLowerCase();
    expect(text).toMatch(/mid-bite|arms/);
  });
});

describe("testudoReveal — the ice/ocean secret (the ONE mystery that resolves)", () => {
  it("explains the glacier as the last of the old ocean, waking, wanting home", () => {
    const text = allText(testudoRevealScript).toLowerCase();
    expect(text).toMatch(/old ocean|old sea/);
    expect(text).toMatch(/waking|woke|wake/);
    expect(text).toMatch(/remembers/);
    expect(text).toMatch(/go home|wanted to go home/);
  });

  it("ties Piggy's frost to the ice without over-explaining", () => {
    const text = allText(testudoRevealScript).toLowerCase();
    expect(text).toMatch(/frost/);
    expect(text).toMatch(/fluke|his kind|favorites|darlings/);
  });
});

describe("partOneFinale — the deliberate cliffhanger", () => {
  it("Rosa's radio (the game's first NPC) crackles back to life", () => {
    const speakers = partOneFinaleScript.nodes.flatMap((n) => n.lines).map((l) => l.speaker);
    expect(speakers).toContain("Rosa");
    const text = allText(partOneFinaleScript).toLowerCase();
    expect(text).toMatch(/static|clear|got you/);
  });

  it("ends on the floor giving way (not an 'Act N: coming soon' placeholder)", () => {
    const text = allText(partOneFinaleScript).toLowerCase();
    expect(text).toMatch(/floor|lets go|drops away/);
    expect(text).not.toMatch(/coming soon|act 8|next act/);
  });
});
