import { describe, expect, it } from "vitest";
import {
  DialogueRunner,
  validateScript,
  type DialogueScript,
} from "../../src/core/dialogue";
import { piggyChaseScript } from "../../src/core/scripts/piggyChase";
import { kelpForestEntryScript } from "../../src/core/scripts/kelpForestEntry";
import { sunTempleEntryScript } from "../../src/core/scripts/sunTempleEntry";
import { fluffballBedEntryScript } from "../../src/core/scripts/fluffballBedEntry";
import { fluffballMeetScript } from "../../src/core/scripts/fluffballMeet";
import { templeLoreScript } from "../../src/core/scripts/templeLore";
import { deepBedEntryScript } from "../../src/core/scripts/deepBedEntry";
import { seaFirstCastScript } from "../../src/core/scripts/seaFirstCast";
import { lurkerIntroScript } from "../../src/core/scripts/lurkerIntro";
import { fishingCastScript } from "../../src/core/scripts/fishingCast";
import { seaAscentScript } from "../../src/core/scripts/seaAscent";
import { act3EndingScript } from "../../src/core/scripts/act3Ending";

const NAMED_SCRIPTS: Array<[string, DialogueScript]> = [
  ["piggyChase", piggyChaseScript],
  ["kelpForestEntry", kelpForestEntryScript],
  ["sunTempleEntry", sunTempleEntryScript],
  ["fluffballBedEntry", fluffballBedEntryScript],
  ["fluffballMeet", fluffballMeetScript],
  ["templeLore", templeLoreScript],
  ["deepBedEntry", deepBedEntryScript],
  ["seaFirstCast", seaFirstCastScript],
  ["lurkerIntro", lurkerIntroScript],
  ["fishingCast", fishingCastScript],
  ["seaAscent", seaAscentScript],
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
    for (const script of [
      piggyChaseScript,
      kelpForestEntryScript,
      sunTempleEntryScript,
      fluffballBedEntryScript,
      fluffballMeetScript,
      templeLoreScript,
      deepBedEntryScript,
      lurkerIntroScript,
      seaAscentScript,
      act3EndingScript
    ]) {
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

describe("seaFirstCast", () => {
  it("has the player cast first and the line go taut before the Lurker strikes", () => {
    const text = allText(seaFirstCastScript);
    expect(text).toMatch(/cast/i);
    expect(text).toMatch(/taut/i);
    expect(text).toMatch(/too heavy/i);
    // No Lurker/battle text here — the theft is its own beat (lurkerIntro).
    expect(text).not.toMatch(/lurker/i);
  });

  it("terminates cleanly (leads into the lurkerIntro beat, then the fight)", () => {
    const { runner } = playThrough(seaFirstCastScript);
    expect(runner.active).toBe(false);
  });
});

describe("seaAscent", () => {
  it("answers how the party gets off the ice, up toward the camp", () => {
    const text = allText(seaAscentScript);
    expect(text).toMatch(/ladder/i);
    expect(text).toMatch(/off the ice/i);
    expect(text).toMatch(/miners' camp/i);
  });
});

describe("act3Ending", () => {
  it("lands the catch and points the party up out of the sea (no end card)", () => {
    const { lines, runner } = playThrough(act3EndingScript);
    const all = lines.map((l) => l.text).join(" ");
    expect(runner.active).toBe(false);
    expect(all).not.toMatch(/END OF ACT 3/);
    expect(all).not.toMatch(/ACT 4:/);
    expect(all).toMatch(/out of the sssea/i);
  });

  it("names the silverfin as one of four things Piggy loves", () => {
    const text = allText(act3EndingScript);
    expect(text).toMatch(/silverfin/i);
    expect(text).toMatch(/four things/i);
  });
});
