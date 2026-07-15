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
 * Below the depths the radio is dead: the Act 2 zones carry only static
 * (the objective line does the wayfinding down there).
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
  crevasse: checkIn([
    "—shhhk— ...Joseph? ...if you hear— shhhk—",
  ]),
  maze: checkIn(["...static..."]),
  galleries: checkIn(["...static..."]),
  sanctum: checkIn(["...static..."]),
  shed: checkIn(["Bucket duty? Sure. Very heroic of you."]),
  overworld: checkIn(["Nothing but rock out there. Watch your step."]),
  mineEntrance: checkIn(["Careful going in. Radio dies fast underground."]),
  sunlessSea: checkIn(["...only the sea answers now. Static... waves..."]),
  kelpForest: checkIn(["...kelp on the water? Static swallows you..."]),
  sunTemple: checkIn(["...a temple, down THERE? ...shhhk... gone..."]),
  fluffballBed: checkIn(["...that gray one again? Static... lost you..."]),
  deepBed: checkIn(["...deep water. Nothing but static now."]),
  seaAscent: checkIn(["...wait — a signal? Climbing back? Static..."]),
  minersCamp: checkIn(["...string lights? Down there? Static..."]),
  campProper: checkIn(["...a whole camp under the sand? Static..."]),
  laundryNook: checkIn(["...bugs in the laundry? Ugh. Static..."]),
  campGallery: checkIn(["...climbing again? You're fading. Static..."]),
  campLedge: checkIn(["...that gray one, up high? Static... gone..."]),
  groveDescent: checkIn(["...warmer down there? That's... odd. Static..."]),
  groveApproach: checkIn(["...is that SUNLIGHT? Underground? Static..."]),
  groveGrotto: checkIn(["...running water? Down THERE? ...shhhk..."]),
  groveChamber: checkIn(["...a garden? In the MINE? ...static..."]),
  sahraGrove: checkIn(["...someone LIVES down there? ...static..."]),
  reefDescent: checkIn(["...underWATER again? Joseph, how DEEP— static..."]),
  reefGarden: checkIn(["...a kelp FARM? Someone tends it? ...shhhk..."]),
  reefWarren: checkIn(["...coral everywhere. You're a whisper now..."]),
  reefHollow: checkIn(["...just glow and dark down there. Static..."]),
  reefCourt: checkIn(["...you're TALKING to the reef? ...only static."]),
};
