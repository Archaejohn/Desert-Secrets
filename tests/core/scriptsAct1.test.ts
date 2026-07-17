import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { rosaCrashScript } from "../../src/core/scripts/rosaCrash";
import { johnAct1Script, pamelaAct1Script } from "../../src/core/scripts/homeAct1";
import {
  thomasMineScript,
  THOMAS_FRAGMENTS,
  nextThomasFragment,
} from "../../src/core/scripts/thomas";
import { partTwoOpeningScript } from "../../src/core/scripts/partTwoOpening";
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
  ["johnAct1", johnAct1Script],
  ["pamelaAct1", pamelaAct1Script],
  ["thomasMine", thomasMineScript],
  ["partTwoOpening", partTwoOpeningScript],
  ...THOMAS_FRAGMENTS.map(
    (f, i) => [`thomasFragment.${i}`, f.script] as [string, DialogueScript],
  ),
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

describe("johnAct1", () => {
  it("is one coherent voice — every named line is John's (or Joseph's)", () => {
    // No Pamela lines leak into John's script (the two are fully split).
    for (const node of johnAct1Script.nodes) {
      for (const l of node.lines) {
        expect(l.speaker).not.toBe("Pamela");
      }
    }
  });

  it("spots Piggy heading east at dawn (John owns outdoor sightings)", () => {
    const { lines } = playThrough(johnAct1Script, [2]); // goodbye is last choice
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/dawn/i);
    expect(all).toMatch(/east/i);
  });

  it("hands over the radio, points Joseph at Thomas, and garbles a fragment", () => {
    const { lines } = playThrough(johnAct1Script, [2]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/radio/i);
    expect(all).toMatch(/Thomas/);
    // A garbled, caption-style fragment (empty speaker + onomatopoeia).
    const garbled = lines.find((l) => l.speaker === "" && /crackle|pop|hiss/i.test(l.text));
    expect(garbled).toBeTruthy();
  });

  it("offers a scarabs / Thomas / goodbye hub and loops back", () => {
    const { choiceLists, runner } = playThrough(johnAct1Script, [0, 1, 2]);
    expect(choiceLists[0]).toEqual([
      "Ask about the scarabs",
      "Ask about Thomas",
      "Say goodbye",
    ]);
    expect(choiceLists.length).toBe(3); // hub seen three times (loops back twice)
    expect(runner.active).toBe(false);
  });

  it("explains the scarabs are a local nickname, not a known species — no off-world hint", () => {
    const { lines } = playThrough(johnAct1Script, [0, 2]);
    const johnText = lines
      .filter((l) => l.speaker === "John")
      .map((l) => l.text)
      .join(" ");
    expect(johnText).toMatch(/scarab/i);
    expect(johnText).toMatch(/call/i);
    expect(johnText).toMatch(/legs|shell/i);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).not.toMatch(/planet|alien|space|off-world/i);
  });

  it("preserves the frost-on-the-flats hint that motivates the trail", () => {
    const { lines } = playThrough(johnAct1Script, [2]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/ice/i);
    expect(all).toMatch(/flats/i);
  });
});

describe("pamelaAct1", () => {
  it("is one coherent voice — every named line is Pamela's (or Joseph's)", () => {
    for (const node of pamelaAct1Script.nodes) {
      for (const l of node.lines) {
        expect(l.speaker).not.toBe("John");
      }
    }
  });

  it("owns the chickens/chores thread — hints the coop fetch quest", () => {
    const { lines } = playThrough(pamelaAct1Script, [0, 1]);
    const chickenLine = lines.find((l) => /chickens/i.test(l.text));
    expect(chickenLine?.speaker).toBe("Pamela");
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/bucket/i);
    expect(all).toMatch(/spigot/i);
    expect(all).toMatch(/trough/i);
  });

  it("stays out of John's lane — no scarabs, radio or Thomas talk", () => {
    const { lines } = playThrough(pamelaAct1Script, [0, 1]);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).not.toMatch(/scarab/i);
    expect(all).not.toMatch(/Thomas/);
    expect(all).not.toMatch(/radio/i);
  });

  it("offers a chickens / goodbye hub and loops back", () => {
    const { choiceLists, runner } = playThrough(pamelaAct1Script, [0, 1]);
    expect(choiceLists[0]).toEqual(["Ask about the chickens", "Say goodbye"]);
    expect(runner.active).toBe(false);
  });
});

describe("thomas radio thread", () => {
  it("mine first-contact: garbled call, Joseph replies, only static answers", () => {
    const { lines, runner } = playThrough(thomasMineScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/Thomas/);
    expect(all).toMatch(/hiss|crackle/i);
    // Joseph calls back...
    expect(lines.some((l) => l.speaker === "Joseph" && /come in|Thomas/i.test(l.text))).toBe(true);
    // ...but there's no answer (one-way).
    expect(all).toMatch(/static answers|no answer|static/i);
    expect(runner.active).toBe(false);
  });

  it("nextThomasFragment hands back fragments in order, then nothing", () => {
    const flags: Record<string, boolean> = {};
    const seen: string[] = [];
    for (let i = 0; i < THOMAS_FRAGMENTS.length; i++) {
      const frag = nextThomasFragment(flags);
      expect(frag).not.toBeNull();
      seen.push(frag!.flag);
      flags[frag!.flag] = true;
    }
    expect(seen).toEqual(["thomasFrag1", "thomasFrag2", "thomasFrag3"]);
    expect(nextThomasFragment(flags)).toBeNull();
  });

  it("fragments are one-way (Joseph calls, no reply) and escalate toward coherence", () => {
    for (const f of THOMAS_FRAGMENTS) {
      const { lines } = playThrough(f.script);
      // Each has a garbled Thomas caption and a Joseph call-back.
      expect(lines.some((l) => l.speaker === "Joseph")).toBe(true);
      expect(lines.some((l) => l.speaker === "" && /["*]/.test(l.text))).toBe(true);
    }
    // The last fragment is the clearest — it names Joseph and says "close".
    const lastText = THOMAS_FRAGMENTS[THOMAS_FRAGMENTS.length - 1].script.nodes[0].lines
      .map((l) => l.text)
      .join(" ");
    expect(lastText).toMatch(/close/i);
    expect(lastText).toMatch(/Joseph/);
  });
});

describe("partTwoOpening", () => {
  it("plays exactly the four scripted lines, Thomas ↔ Joseph, in order", () => {
    const { lines, runner } = playThrough(partTwoOpeningScript);
    expect(lines).toEqual([
      { speaker: "Thomas", text: "Joseph can you hear me?" },
      { speaker: "Joseph", text: "I CAN!! Finally! where are you?" },
      { speaker: "Thomas", text: "You Won't believe it if I told you!" },
      { speaker: "Joseph", text: "I'm coming to find you." },
    ]);
    expect(runner.active).toBe(false);
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

  it("the sealed beat mentions the elevator and hands control back (no baked-in title card)", () => {
    const { lines, runner } = playThrough(cliffhangerSealedScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(all).toMatch(/elevator/i);
    // The END OF ACT 1 / ACT 2 title is now the VISUAL end card the player
    // reaches by following Piggy into the glowing ice — deliberately not baked
    // into this dialogue, so the act can't end without the player's action.
    expect(all).not.toMatch(/END OF ACT 1/);
    expect(all).not.toMatch(/ACT 2: THE ICE BELOW/);
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
