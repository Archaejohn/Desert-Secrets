import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { rosaCrashScript } from "../../src/core/scripts/rosaCrash";
import { homeAct1Script } from "../../src/core/scripts/homeAct1";
import { dustyTradeScript } from "../../src/core/scripts/dustyTrade";
import { rabbitChoiceScript } from "../../src/core/scripts/rabbitChoice";
import { queenFightScript } from "../../src/core/scripts/queenFight";
import { queenParleyScript } from "../../src/core/scripts/queenParley";
import { radioLines } from "../../src/core/scripts/radio";
import {
  cliffhangerAftershockScript,
  cliffhangerIceRevealScript,
  cliffhangerPiggyScript,
  cliffhangerSealedScript,
} from "../../src/core/scripts/cliffhanger";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["rosaCrash", rosaCrashScript],
  ["homeAct1", homeAct1Script],
  ["dustyTrade", dustyTradeScript],
  ["rabbitChoice", rabbitChoiceScript],
  ["queenFight", queenFightScript],
  ["queenParley", queenParleyScript],
  ["cliffhangerAftershock", cliffhangerAftershockScript],
  ["cliffhangerIceReveal", cliffhangerIceRevealScript],
  ["cliffhangerPiggy", cliffhangerPiggyScript],
  ["cliffhangerSealed", cliffhangerSealedScript],
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

  it("seeds the Thomas thread on both choice branches", () => {
    for (const pick of [0, 1]) {
      const { lines } = playThrough(rosaCrashScript, [pick]);
      const all = lines.map((l) => l.text).join(" ");
      expect(all).toMatch(/Thomas/);
    }
  });

  it("terminates on both choice branches", () => {
    for (const pick of [0, 1]) {
      const { runner } = playThrough(rosaCrashScript, [pick]);
      expect(runner.active).toBe(false);
    }
  });
});

describe("homeAct1", () => {
  it("offers the Thomas / chickens / scarabs / goodbye hub", () => {
    const { choiceLists } = playThrough(homeAct1Script, [3]);
    expect(choiceLists[0]).toEqual([
      "Ask about Thomas",
      "Ask about the chickens",
      "Ask about the scarabs",
      "Say goodbye",
    ]);
  });

  it("reinforces the Thomas thread on that branch", () => {
    const { lines } = playThrough(homeAct1Script, [0, 3]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/Thomas/);
  });

  it("hints the chicken side quest and the coop's location, opened by Pamela", () => {
    const { lines } = playThrough(homeAct1Script, [1, 3]);
    const chickenNode = lines.find((l) => /chickens/i.test(l.text));
    expect(chickenNode?.speaker).toBe("Pamela");
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/chickens/i);
    expect(all).toMatch(/trough/i);
  });

  it("has John explain the scarabs are a local nickname, not a known species", () => {
    const { lines } = playThrough(homeAct1Script, [2, 3]);
    const scarabLines = lines.filter((l) => l.speaker === "John");
    const johnText = scarabLines.map((l) => l.text).join(" ");
    expect(johnText).toMatch(/scarabs/i);
    expect(johnText).toMatch(/call/i);
    expect(johnText).not.toMatch(/planet|alien|space/i);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/legs|shell/i);
  });

  it("Thomas, chickens and scarabs branches loop back to the hub", () => {
    const { choiceLists, runner } = playThrough(homeAct1Script, [0, 1, 2, 3]);
    expect(choiceLists.length).toBe(4); // hub seen four times
    expect(runner.active).toBe(false);
  });

  it("preserves the frost-on-the-flats hint that motivates the trail", () => {
    const { lines } = playThrough(homeAct1Script, [3]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/ice/i);
    expect(all).toMatch(/flats/i);
  });

  it("mentions Piggy headed east and the scarabs stirring", () => {
    const { lines } = playThrough(homeAct1Script, [3]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/east/i);
    expect(all).toMatch(/scarabs/i);
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
      "campGallery",
      "campLedge",
      "campProper",
      "crash",
      "crevasse",
      "deepBed",
      "depths",
      "fluffballBed",
      "galleries",
      "groveApproach",
      "groveChamber",
      "groveDescent",
      "groveGrotto",
      "kelpForest",
      "laundryNook",
      "maze",
      "mine",
      "mineEntrance",
      "minersCamp",
      "oasis",
      "overworld",
      "pizzaApproach",
      "pizzaAscent",
      "pizzaDescent",
      "pizzaVent",
      "pizzeria",
      "reefCourt",
      "reefDescent",
      "reefGarden",
      "reefHollow",
      "reefWarren",
      "sahraGrove",
      "sanctum",
      "seaAscent",
      "shed",
      "sunTemple",
      "sunlessSea",
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
  // Split into four beats (DepthsScene.runCliffhanger) so the wall-crack
  // and Piggy's walk each trigger at the moment their own beat's dialogue
  // opens, instead of both already having finished off-screen well before
  // any of this text was shown (a real playtester report).
  it("reveals the ice wall and what hangs inside it, across the reveal beat", () => {
    const { lines } = playThrough(cliffhangerIceRevealScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/ice/i);
    expect(all).toMatch(/something vast/i);
  });

  it("the aftershock beat doesn't jump ahead to the ice itself", () => {
    const { lines } = playThrough(cliffhangerAftershockScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).not.toMatch(/ice/i);
  });

  it("the sealed beat mentions the elevator and ends on the Act 2 title card", () => {
    const { lines, runner } = playThrough(cliffhangerSealedScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/elevator/i);
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
