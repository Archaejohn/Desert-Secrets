import type { DialogueLine, DialogueScript } from "../dialogue";

/**
 * Sahra's grove — the first real callback payoff in the game. Sahra keeps
 * the hidden orange grove and trades its fruit only for news of the desert
 * above. When Joseph tells her what actually happened up top, her reaction
 * BRANCHES on the choices the player made back in Act 1:
 *
 *  - the cold pack: did Joseph trade it away to the thirsting jackrabbit
 *    (`rabbitTradedColdPack`) or keep it and fight the jack off
 *    (`rabbitResolved` without the trade)?
 *  - the Dust Queen: did Joseph parley with her (`parleyed`) or fight her
 *    down (`queenResolved` without the parley)?
 *
 * Each dimension yields two full, distinct lines (not a one-word swap), so a
 * player who made different Act 1 choices hears a genuinely different Sahra.
 * The result is a single linear script (terminal id `sahra`); the scene sets
 * `gotOranges` + `items.oranges` on close and rolls the ending. Pure — takes
 * the flag bag, returns a fresh script — so the branching is unit-testable.
 */

/** The jackrabbit callback: mercy (traded the ice) vs. grit (kept it). */
function coldPackLines(flags: Record<string, boolean>): DialogueLine[] {
  if (flags.rabbitTradedColdPack) {
    return [
      { speaker: "Sahra", text: "You gave a thirsting jack your only ice?" },
      { speaker: "Sahra", text: "Mercy in the dunes. Rarer than any fruit." },
    ];
  }
  if (flags.rabbitResolved) {
    return [
      { speaker: "Sahra", text: "Faced down a desert jack, kept your ice?" },
      { speaker: "Sahra", text: "Practical. The dunes respect that too." },
    ];
  }
  return [{ speaker: "Sahra", text: "You crossed the open dunes. That's enough." }];
}

/** The Dust Queen callback: words (parley) vs. force (fought her down). */
function queenLines(flags: Record<string, boolean>): DialogueLine[] {
  if (flags.parleyed) {
    return [
      { speaker: "Sahra", text: "And the Dust Queen — you TALKED to her?" },
      { speaker: "Sahra", text: "Words over a fight. I'd not have dared." },
    ];
  }
  if (flags.queenResolved) {
    return [
      { speaker: "Sahra", text: "You fought the Dust Queen and walked out?" },
      { speaker: "Sahra", text: "All muscle, that boy. Still — you walked out." },
    ];
  }
  return [{ speaker: "Sahra", text: "The deep queen's a tale I won't ask on." }];
}

export function sahraGroveScript(flags: Record<string, boolean>): DialogueScript {
  const lines: DialogueLine[] = [
    { speaker: "Sahra", text: "Careful — mind the seedlings, would you." },
    { speaker: "Sahra", text: "Nobody finds my grove. Yet here you are." },
    { speaker: "Slither", text: "Sssafe here. The air even sssmells green." },
    { speaker: "Joseph", text: "We need oranges. The oldest row, we hear." },
    { speaker: "Sahra", text: "The oldest row! Someone taught you well." },
    { speaker: "Sahra", text: "They're not for sale. I trade them — for news." },
    { speaker: "Joseph", text: "News of the desert above? I have plenty." },
    ...coldPackLines(flags),
    ...queenLines(flags),
    { speaker: "Sahra", text: "Good news, all of it. The old row is yours." },
    { speaker: "Sahra", text: "Take the low, heavy ones. Piggy knows best." },
    { speaker: "", text: "Sahra fills your arms with sun-warm oranges." },
  ];
  return { start: "sahra", nodes: [{ id: "sahra", lines }] };
}
