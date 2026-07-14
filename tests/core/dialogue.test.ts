import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
function line(text: string) {
  return { speaker: "NPC", text };
}

/** greet(2 lines) -> hub(1 line, 2 choices) -> lore(2 lines) -> hub / bye(1 line, terminal) */
function branchingScript(): DialogueScript {
  return {
    start: "greet",
    nodes: [
      { id: "greet", lines: [line("hello"), line("welcome")], next: "hub" },
      {
        id: "hub",
        lines: [line("what now?")],
        choices: [
          { text: "Tell me more", next: "lore" },
          { text: "Goodbye", next: "bye" },
        ],
      },
      { id: "lore", lines: [line("secret 1"), line("secret 2")], next: "hub" },
      { id: "bye", lines: [line("farewell")] },
    ],
  };
}

describe("validateScript", () => {
  it("accepts a well-formed script", () => {
    expect(() => validateScript(branchingScript())).not.toThrow();
  });

  it("throws when the start node does not exist", () => {
    const s = branchingScript();
    s.start = "nowhere";
    expect(() => validateScript(s)).toThrow(/start.*nowhere/i);
  });

  it("throws on a missing start id", () => {
    const s = branchingScript();
    s.start = "";
    expect(() => validateScript(s)).toThrow(/start/i);
  });

  it("throws on duplicate node ids", () => {
    const s = branchingScript();
    s.nodes.push({ id: "greet", lines: [line("again")] });
    expect(() => validateScript(s)).toThrow(/duplicate.*greet/i);
  });

  it("throws on a node with zero lines", () => {
    const s = branchingScript();
    s.nodes.push({ id: "empty", lines: [] });
    expect(() => validateScript(s)).toThrow(/empty.*zero lines/i);
  });

  it("throws on a dangling node.next reference", () => {
    const s = branchingScript();
    s.nodes[0].next = "missing";
    expect(() => validateScript(s)).toThrow(/greet.*missing/i);
  });

  it("throws on a dangling choice.next reference", () => {
    const s = branchingScript();
    s.nodes[1].choices![0].next = "missing";
    expect(() => validateScript(s)).toThrow(/missing/);
  });

  it("throws when a node has both choices and next", () => {
    const s = branchingScript();
    s.nodes[1].next = "bye";
    expect(() => validateScript(s)).toThrow(/both/i);
  });

  it("DialogueRunner constructor validates the script", () => {
    const s = branchingScript();
    s.start = "nowhere";
    expect(() => new DialogueRunner(s)).toThrow(/nowhere/);
  });
});

describe("DialogueRunner", () => {
  it("is inactive with a null currentLine before start()", () => {
    const r = new DialogueRunner(branchingScript());
    expect(r.active).toBe(false);
    expect(r.currentLine).toBeNull();
    expect(r.choices).toBeNull();
  });

  it("start() returns the first line of the start node and activates", () => {
    const r = new DialogueRunner(branchingScript());
    expect(r.start()).toEqual(line("hello"));
    expect(r.active).toBe(true);
    expect(r.currentLine).toEqual(line("hello"));
  });

  it("advance() steps through the lines of the current node", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    expect(r.advance()).toEqual(line("welcome"));
    expect(r.currentLine).toEqual(line("welcome"));
  });

  it("advance() past the last line follows next to the following node", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance(); // "welcome" (last line of greet)
    expect(r.advance()).toEqual(line("what now?")); // into hub
  });

  it("choices are null except on the last line of a choices node", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    expect(r.choices).toBeNull(); // greet has no choices
    r.advance();
    expect(r.choices).toBeNull();
    r.advance(); // hub's only (=last) line
    expect(r.choices).toEqual([
      { text: "Tell me more", next: "lore" },
      { text: "Goodbye", next: "bye" },
    ]);
  });

  it("choices are null on non-final lines of the branched-to node", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    r.advance(0); // into lore, line "secret 1" (not last)
    expect(r.choices).toBeNull();
  });

  it("advance(choiceIndex) jumps to the chosen node's first line", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    expect(r.advance(0)).toEqual(line("secret 1"));
    expect(r.advance()).toEqual(line("secret 2"));
    expect(r.advance()).toEqual(line("what now?")); // lore loops back to hub
    expect(r.choices).not.toBeNull();
  });

  it("advance() without an index throws while choices are pending", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance(); // choices pending
    expect(() => r.advance()).toThrow(/choice/i);
  });

  it("advance(i) throws when the index is out of range", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    expect(() => r.advance(2)).toThrow(/out of range/i);
    expect(() => r.advance(-1)).toThrow(/out of range/i);
  });

  it("advance(i) throws when no choices are pending", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    expect(() => r.advance(0)).toThrow(/no choices/i);
  });

  it("ends after the last line of a terminal node: null, inactive, null line", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    r.advance(1); // bye: "farewell" (single, last line, no next/choices)
    expect(r.advance()).toBeNull();
    expect(r.active).toBe(false);
    expect(r.currentLine).toBeNull();
    expect(r.choices).toBeNull();
  });

  it("advance() after the end throws", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    r.advance(1);
    r.advance(); // ends
    expect(() => r.advance()).toThrow(/not active/i);
  });

  it("advance() before start() throws", () => {
    const r = new DialogueRunner(branchingScript());
    expect(() => r.advance()).toThrow(/not active/i);
  });

  it("start() restarts a finished dialogue from the beginning", () => {
    const r = new DialogueRunner(branchingScript());
    r.start();
    r.advance();
    r.advance();
    r.advance(1);
    r.advance();
    expect(r.active).toBe(false);
    expect(r.start()).toEqual(line("hello"));
    expect(r.active).toBe(true);
  });
});
