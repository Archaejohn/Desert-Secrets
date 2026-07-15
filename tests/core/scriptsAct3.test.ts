import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { piggyChaseScript } from "../../src/core/scripts/piggyChase";
import { fluffballMeetScript } from "../../src/core/scripts/fluffballMeet";
import { templeLoreScript } from "../../src/core/scripts/templeLore";
import { lurkerIntroScript } from "../../src/core/scripts/lurkerIntro";
import { fishingCastScript } from "../../src/core/scripts/fishingCast";
import { act3EndingScript } from "../../src/core/scripts/act3Ending";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["piggyChase", piggyChaseScript],
  ["fluffballMeet", fluffballMeetScript],
  ["templeLore", templeLoreScript],
  ["lurkerIntro", lurkerIntroScript],
  ["fishingCast", fishingCastScript],
  ["act3Ending", act3EndingScript],
];

function playThrough(script: DialogueScript, picks: number[] = []) {
  const runner = new DialogueRunner(script);
  const lines = [runner.start()];
  const choiceLists: string[][] = [];
  let terminalNodeId: string | null = null;
  const queue = [...picks];
  for (let guard = 0; guard < 200; guard++) {
    terminalNodeId = runner.currentNodeId;
    let next;
    if (runner.choices !== null) {
      choiceLists.push(runner.choices.map((c) => c.text));
      const pick = queue.shift();
      if (pick === undefined) throw new Error("ran out of choice picks");
      next = runner.advance(pick);
    } else {
      next = runner.advance();
    }
    if (next === null) return { runner, lines, terminalNodeId, choiceLists };
    lines.push(next);
  }
  throw new Error("script did not terminate in 200 steps");
}

function allText(script: DialogueScript): string {
  return script.nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
}

describe("Act 3 script validation", () => {
  it.each(NAMED_SCRIPTS)("%s passes validateScript", (_name, script) => {
    expect(() => validateScript(script)).not.toThrow();
  });

  it.each(NAMED_SCRIPTS)("%s keeps every line within the 48-char box", (_name, script) => {
    for (const node of script.nodes) {
      for (const l of node.lines) expect(l.text.length).toBeLessThanOrEqual(48);
    }
  });

  it.each(NAMED_SCRIPTS)("%s terminates on default picks", (_name, script) => {
    const { runner } = playThrough(script, [0, 0, 0, 0]);
    expect(runner.active).toBe(false);
  });
});

describe("Slither's hissing esses (Act 3)", () => {
  it("hisses in every Act 3 script where he speaks", () => {
    for (const script of [piggyChaseScript, fluffballMeetScript, templeLoreScript, lurkerIntroScript, act3EndingScript]) {
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

describe("piggyChase", () => {
  it("shows Piggy playing tag and the penguins outrunning the raft", () => {
    const text = allText(piggyChaseScript);
    expect(text).toMatch(/gray/i);
    expect(text).toMatch(/tag/i);
    expect(text).toMatch(/fassster in water/i);
  });
});

describe("fluffballMeet", () => {
  it("has Fluffball speak exactly one line — the silverfin clue", () => {
    const fluffLines = fluffballMeetScript.nodes
      .flatMap((n) => n.lines)
      .filter((l) => l.speaker === "Fluffball");
    expect(fluffLines).toHaveLength(1);
    expect(fluffLines[0].text).toMatch(/silverfin/i);
  });

  it("points at the deepest beds past the light", () => {
    expect(allText(fluffballMeetScript)).toMatch(/deepest beds/i);
  });
});

describe("templeLore", () => {
  it("frames the desert as hiding an ecosystem, not treasure", () => {
    const text = allText(templeLoreScript);
    expect(text).toMatch(/ecosystem/i);
    expect(text).toMatch(/wasn't hiding treasure/i);
    expect(text).toMatch(/ocean once/i);
  });
});

describe("fishingCast", () => {
  it("offers cast / leave and ends at the matching terminal id", () => {
    const cast = playThrough(fishingCastScript, [0]);
    expect(cast.terminalNodeId).toBe("cast-end");
    expect(cast.runner.active).toBe(false);
    const leave = playThrough(fishingCastScript, [1]);
    expect(leave.terminalNodeId).toBe("leave-end");
    expect(leave.runner.active).toBe(false);
  });
});

describe("act3Ending", () => {
  it("ends on the Act 4 title card", () => {
    const { lines, runner } = playThrough(act3EndingScript);
    expect(lines[lines.length - 1].text).toBe("ACT 4: THE MINERS' CAMP");
    expect(lines[lines.length - 2].text).toBe("END OF ACT 3");
    expect(runner.active).toBe(false);
  });

  it("names the silverfin as one of four things Piggy loves", () => {
    const text = allText(act3EndingScript);
    expect(text).toMatch(/silverfin/i);
    expect(text).toMatch(/four things/i);
  });
});
