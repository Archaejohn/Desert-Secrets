import type { DialogueScript } from "../dialogue";
import type { ZoneId } from "../gameState";

function checkIn(lines: string[]): DialogueScript {
  return {
    start: "check",
    nodes: [
      {
        id: "check",
        lines: lines.map((text) => ({ speaker: "Rosa", text })),
      },
    ],
  };
}

/**
 * Rosa's radio check-ins — the act's clock, one short script per zone.
 */
export const radioLines: Record<ZoneId, DialogueScript> = {
  crash: checkIn(["Radio check. Loud and clear. Now scoot."]),
  oasis: checkIn(["An oasis? Ask if anyone saw my bird."]),
  trail: checkIn([
    "Sun's dropping. Good news for him. Hurry.",
  ]),
  mine: checkIn([
    "A mine? Cold air... that tracks. Careful.",
  ]),
  depths: checkIn([
    "You're breaking up... frost? Say again—",
  ]),
};
