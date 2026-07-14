import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { rosaCrashScript } from "../../src/core/scripts/rosaCrash";
import { sahraAct1Script } from "../../src/core/scripts/sahraAct1";
import { dustyTradeScript } from "../../src/core/scripts/dustyTrade";
import { rabbitChoiceScript } from "../../src/core/scripts/rabbitChoice";
import { queenFightScript } from "../../src/core/scripts/queenFight";
import { queenParleyScript } from "../../src/core/scripts/queenParley";
import { radioLines } from "../../src/core/scripts/radio";
import { cliffhangerScript } from "../../src/core/scripts/cliffhanger";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["rosaCrash", rosaCrashScript],
  ["sahraAct1", sahraAct1Script],
  ["dustyTrade", dustyTradeScript],
  ["rabbitChoice", rabbitChoiceScript],
  ["queenFight", queenFightScript],
  ["queenParley", queenParleyScript],
  ["cliffhanger", cliffhangerScript],
  ...Object.entries(radioLines).map(
    ([zone, script]) => [`radio.${zone}`, script] as [string, DialogueScript],
  ),
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
  let queue = [...picks];
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

describe("Act 1 script validation", () => {
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
});

describe("rosaCrash", () => {
  it("hands over the radio and cold pack and sets the stakes", () => {
    const { lines } = playThrough(rosaCrashScript, [0]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/cold pack/i);
    expect(all).toMatch(/radio/i);
    expect(all).toMatch(/hours, not days/i);
    expect(all).toMatch(/Piggy/);
  });

  it("mentions the unmelting frost on the crate branch", () => {
    const { lines } = playThrough(rosaCrashScript, [0]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/isn't melting/i);
  });

  it("terminates on both choice branches", () => {
    for (const pick of [0, 1]) {
      const { runner } = playThrough(rosaCrashScript, [pick]);
      expect(runner.active).toBe(false);
    }
  });
});

describe("sahraAct1", () => {
  it("offers the trail / scarabs / farewell hub", () => {
    const { choiceLists } = playThrough(sahraAct1Script, [2]);
    expect(choiceLists[0]).toEqual([
      "Ask about the trail",
      "Ask about the scarabs",
      "Say farewell",
    ]);
  });

  it("corrects the old sun-temple lore to the cold below", () => {
    const { lines } = playThrough(sahraAct1Script, [2]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/sun-temple/);
    expect(all).toMatch(/what sleeps below is cold/i);
  });

  it("trail and scarab branches loop back to the hub", () => {
    const { choiceLists, runner } = playThrough(sahraAct1Script, [0, 1, 2]);
    expect(choiceLists.length).toBe(3); // hub seen three times
    expect(runner.active).toBe(false);
  });

  it("gives the three-ice-chips quest on the trail branch", () => {
    const { lines } = playThrough(sahraAct1Script, [0, 2]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/three chips/i);
  });
});

describe("dustyTrade", () => {
  it("points to Cinnabar Mine when paid a shiny", () => {
    const { lines, terminalNodeId } = playThrough(dustyTradeScript, [0]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/Cinnabar Mine/);
    expect(all).toMatch(/cold air/i);
    expect(terminalNodeId).toBe("truth-end");
  });

  it("lets the player walk away and come back", () => {
    const { terminalNodeId, runner } = playThrough(dustyTradeScript, [1]);
    expect(terminalNodeId).toBe("later-end");
    expect(runner.active).toBe(false);
  });

  it("talks in shinies", () => {
    const { lines } = playThrough(dustyTradeScript, [0]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/shin(y|e|ies)/i);
  });
});

describe("rabbitChoice", () => {
  it("offers exactly the two contract choices", () => {
    const { choiceLists } = playThrough(rabbitChoiceScript, [0]);
    expect(choiceLists).toEqual([["Chase it down", "Trade the cold pack"]]);
  });

  it("ends at the terminal node 'fight-end' when chasing", () => {
    const { terminalNodeId, runner } = playThrough(rabbitChoiceScript, [0]);
    expect(terminalNodeId).toBe("fight-end");
    expect(runner.active).toBe(false);
  });

  it("ends at the terminal node 'trade-end' when trading", () => {
    const { terminalNodeId, runner } = playThrough(rabbitChoiceScript, [1]);
    expect(terminalNodeId).toBe("trade-end");
    expect(runner.active).toBe(false);
  });
});

describe("queenFight", () => {
  it("frames the Queen as a mother, not a villain", () => {
    const { lines } = playThrough(queenFightScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/eggs/i);
    expect(all).toMatch(/heat kills eggs/i);
    expect(all).toMatch(/sorry/i);
  });

  it("terminates without choices", () => {
    const { runner, choiceLists } = playThrough(queenFightScript);
    expect(choiceLists).toEqual([]);
    expect(runner.active).toBe(false);
  });
});

describe("queenParley", () => {
  it("ends at the terminal node 'parley-end'", () => {
    const { terminalNodeId, runner } = playThrough(queenParleyScript);
    expect(terminalNodeId).toBe("parley-end");
    expect(runner.active).toBe(false);
  });

  it("offers the cold pack and is interrupted by the tremor", () => {
    const { lines } = playThrough(queenParleyScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/cold pack/i);
    expect(all).toMatch(/shudders|trembles?/i);
  });
});

describe("radioLines", () => {
  it("covers every zone", () => {
    expect(Object.keys(radioLines).sort()).toEqual([
      "crash",
      "depths",
      "mine",
      "oasis",
      "trail",
    ]);
  });

  it("keeps each check-in to a single short node from Rosa", () => {
    for (const script of Object.values(radioLines)) {
      expect(script.nodes.length).toBe(1);
      for (const l of script.nodes[0].lines) {
        expect(l.speaker).toBe("Rosa");
      }
      const { runner } = playThrough(script);
      expect(runner.active).toBe(false);
    }
  });
});

describe("cliffhanger", () => {
  it("reveals the ice wall and what hangs inside it", () => {
    const { lines } = playThrough(cliffhangerScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/ice/i);
    expect(all).toMatch(/something vast/i);
    expect(all).toMatch(/elevator/i);
  });

  it("ends on the Act 2 title card", () => {
    const { lines, runner } = playThrough(cliffhangerScript);
    expect(lines[lines.length - 1].text).toBe("ACT 2: THE ICE BELOW");
    expect(lines[lines.length - 2].text).toBe("END OF ACT 1");
    expect(runner.active).toBe(false);
  });
});

describe("DialogueRunner.currentNodeId", () => {
  it("is null before start() and after the script ends", () => {
    const r = new DialogueRunner(rabbitChoiceScript);
    expect(r.currentNodeId).toBeNull();
    r.start();
    expect(r.currentNodeId).toBe("spot");
    while (r.active) {
      if (r.choices !== null) r.advance(0);
      else r.advance();
    }
    expect(r.currentNodeId).toBeNull();
  });

  it("tracks node transitions through lines and choices", () => {
    const r = new DialogueRunner(rabbitChoiceScript);
    r.start();
    expect(r.currentNodeId).toBe("spot");
    r.advance(); // second line of spot
    expect(r.currentNodeId).toBe("spot");
    r.advance(); // into decide
    expect(r.currentNodeId).toBe("decide");
    r.advance(1); // choose the trade branch
    expect(r.currentNodeId).toBe("trade-end");
  });
});
