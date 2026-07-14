import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { minerMoScript } from "../../src/core/scripts/minerMo";
import { minerEddaScript } from "../../src/core/scripts/minerEdda";
import { minerGusScript } from "../../src/core/scripts/minerGus";
import { slitherMeetScript } from "../../src/core/scripts/slitherMeet";
import { slitherDoorScript } from "../../src/core/scripts/slitherDoor";
import { wardenIntroScript } from "../../src/core/scripts/wardenIntro";
import { act2EndingScript } from "../../src/core/scripts/act2Ending";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["minerMo", minerMoScript],
  ["minerEdda", minerEddaScript],
  ["minerGus", minerGusScript],
  ["slitherMeet", slitherMeetScript],
  ["slitherDoor", slitherDoorScript],
  ["wardenIntro", wardenIntroScript],
  ["act2Ending", act2EndingScript],
];

/**
 * Run a script to its end, feeding choice picks in order. Returns every
 * line seen, the terminal node id (read just before the final advance)
 * and every choice list encountered.
 */
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
    if (next === null) {
      return { runner, lines, terminalNodeId, choiceLists };
    }
    lines.push(next);
  }
  throw new Error("script did not terminate in 200 steps");
}

function allText(script: DialogueScript): string {
  return script.nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
}

describe("Act 2 script validation", () => {
  it.each(NAMED_SCRIPTS)("%s passes validateScript", (_name, script) => {
    expect(() => validateScript(script)).not.toThrow();
  });

  it.each(NAMED_SCRIPTS)(
    "%s keeps every line within the 48-char text box",
    (_name, script) => {
      for (const node of script.nodes) {
        for (const l of node.lines) {
          expect(l.text.length).toBeLessThanOrEqual(48);
        }
      }
    },
  );

  it.each(NAMED_SCRIPTS)("%s terminates on default picks", (_name, script) => {
    const { runner } = playThrough(script, [0, 0, 0, 0]);
    expect(runner.active).toBe(false);
  });
});

describe("Slither's hissing esses", () => {
  it("hisses in every script where he speaks", () => {
    for (const script of [slitherMeetScript, slitherDoorScript, act2EndingScript]) {
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

describe("the lost miners", () => {
  it("each identifies as Cinnabar crew", () => {
    for (const script of [minerMoScript, minerEddaScript, minerGusScript]) {
      expect(allText(script)).toMatch(/Cinnabar crew/);
    }
  });

  it("Mo smells tomato pie (Act 5 seed)", () => {
    expect(allText(minerMoScript)).toMatch(/tomato pie/i);
  });

  it("Mo teaches the lantern-post wayfinding", () => {
    expect(allText(minerMoScript)).toMatch(/lantern/i);
  });

  it("Edda hears distant waves (Act 3 seed)", () => {
    expect(allText(minerEddaScript)).toMatch(/distant waves/i);
  });

  it("Edda hints at the two true routes and the loops", () => {
    const text = allText(minerEddaScript);
    expect(text).toMatch(/two true roads/i);
    expect(text).toMatch(/loops? back/i);
  });

  it("Gus hears the singing water (Act 3 seed)", () => {
    expect(allText(minerGusScript)).toMatch(/water/i);
    expect(allText(minerGusScript)).toMatch(/sings|singing/i);
  });

  it("Gus points at the rime door and its snake-sized gap", () => {
    const text = allText(minerGusScript);
    expect(text).toMatch(/rime door/i);
    expect(text).toMatch(/snake-sized/i);
  });

  it("each miner script is linear (no dangling choices for the scene)", () => {
    for (const script of [minerMoScript, minerEddaScript, minerGusScript]) {
      const { runner, choiceLists } = playThrough(script);
      expect(choiceLists).toEqual([]);
      expect(runner.active).toBe(false);
    }
  });
});

describe("slitherMeet", () => {
  it("ends at the terminal node 'scout-end' on every branch", () => {
    for (const pick of [0, 1]) {
      const { terminalNodeId, runner } = playThrough(slitherMeetScript, [pick]);
      expect(terminalNodeId).toBe("scout-end");
      expect(runner.active).toBe(false);
    }
  });

  it("starts shy and ends with the shortcut open", () => {
    const { lines } = playThrough(slitherMeetScript, [1]);
    const text = lines.map((l) => l.text).join(" ");
    expect(text).toMatch(/don't ssstomp/i);
    expect(text).toMatch(/passsage open/i);
  });

  it("mentions the penguin on the curious branch", () => {
    const { lines } = playThrough(slitherMeetScript, [0]);
    expect(lines.map((l) => l.text).join(" ")).toMatch(/waddler/i);
  });
});

describe("slitherDoor", () => {
  it("ends at the terminal node 'join-end'", () => {
    const { terminalNodeId, runner } = playThrough(slitherDoorScript);
    expect(terminalNodeId).toBe("join-end");
    expect(runner.active).toBe(false);
  });

  it("delivers the contract join line verbatim", () => {
    expect(allText(slitherDoorScript)).toContain(
      "Sssomebody has to keep you alive.",
    );
  });

  it("opens the rime door before the join", () => {
    const { lines } = playThrough(slitherDoorScript);
    const texts = lines.map((l) => l.text);
    const doorIndex = texts.findIndex((t) => /rime shears away/i.test(t));
    const joinIndex = texts.findIndex((t) => /joins the party/i.test(t));
    expect(doorIndex).toBeGreaterThanOrEqual(0);
    expect(joinIndex).toBeGreaterThan(doorIndex);
  });
});

describe("wardenIntro", () => {
  it("is exactly two lines of construct voice", () => {
    const lines = wardenIntroScript.nodes.flatMap((n) => n.lines);
    expect(lines.length).toBe(2);
    for (const l of lines) {
      expect(l.speaker).toBe("Warden");
      expect(l.text).toBe(l.text.toUpperCase()); // machine cadence
    }
  });

  it("still follows its last order", () => {
    expect(allText(wardenIntroScript)).toMatch(/last order/i);
    expect(allText(wardenIntroScript)).toMatch(/keep the lake/i);
  });
});

describe("act2Ending", () => {
  it("cracks the lake and reveals TWO penguins", () => {
    const text = allText(act2EndingScript);
    expect(text).toMatch(/crack/i);
    expect(text).toMatch(/second penguin/i);
    expect(text).toContain("...Two? There are TWO?");
  });

  it("gives Slither the double-take line", () => {
    const line = act2EndingScript.nodes
      .flatMap((n) => n.lines)
      .find((l) => l.text === "...Two? There are TWO?");
    expect(line?.speaker).toBe("Slither");
  });

  it("ends on the Act 3 title card", () => {
    const { lines, runner } = playThrough(act2EndingScript);
    expect(lines[lines.length - 1].text).toBe("ACT 3: THE SUNLESS SEA");
    expect(lines[lines.length - 2].text).toBe("END OF ACT 2");
    expect(runner.active).toBe(false);
  });
});
