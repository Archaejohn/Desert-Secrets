/**
 * Current quest objective, derived from run state. Shown in the HUD so
 * the player always knows where to go next.
 */
import type { Act1State } from "./gameState";

export function objectiveFor(s: Act1State): string {
  const f = s.flags;
  if (f.actComplete) return act2ObjectiveFor(s);
  if (!f.metRosa) return "Talk to Rosa by the truck";
  if (s.zone === "crash") return "Follow the frost trail east";
  if (!f.metParents) return "Find your parents at the oasis";
  if (!f.tutorialBattleWon) return "Fight off the scarab!";
  if (s.zone === "oasis") return "Follow Piggy's trail east";
  if (s.zone === "overworld") return "The mine lies north, past the wash";
  if (s.zone === "mineEntrance") return "The mine's just ahead";
  if (!f.mineOpen) {
    return f.metDusty ? "Head to the mine (northeast)" : "Ask around at Last Chance Fuel";
  }
  if (s.zone === "trail") return "Enter the mine to the northeast";
  if (!f.leverPulled && s.zone === "mine") return "Find the lever that opens the gate";
  if (!f.foremanDefeated && s.zone === "mine") return "Reach the elevator, past its guardian";
  if (s.zone === "mine") return "Take the elevator down";
  if (!f.queenResolved) return "Find Piggy in the cold below";
  return "Piggy needs you";
}

/** The Act 2 chain, once actComplete is set. Every string ≤ 40 chars. */
function act2ObjectiveFor(s: Act1State): string {
  const f = s.flags;
  // Act 3 takes over once the crack is followed into the sea.
  if (f.act3Started || f.act3Complete) return act3ObjectiveFor(s);
  if (f.act2Complete) return "Act 2 complete!";
  if (!f.act2Started) return "Descend through the ice";
  if (s.zone === "crevasse") return "Find a way through the ice maze";
  if (s.zone === "maze") {
    return f.mazeShortcutOpen
      ? "Push on to the galleries"
      : "Find a way through the ice maze";
  }
  if (s.zone === "galleries") {
    return f.rimeDoorOpen ? "Enter the sanctum" : "Open the rime door";
  }
  if (s.zone === "sanctum") {
    return f.wardenDefeated ? "Follow the penguins!" : "Cross the frozen lake";
  }
  // Still in an Act 1 zone after the hand-off: get down there.
  return "Descend through the ice";
}

/**
 * The Act 3 chain (The Sunless Sea, a six-zone chain), once act3Started is
 * set. Each zone produces its own grounded objective line. ≤ 40 chars.
 */
function act3ObjectiveFor(s: Act1State): string {
  const f = s.flags;
  // Act 4 takes over once the party climbs back up to the miners' camp.
  if (f.act4Started || f.act4Complete) return act4ObjectiveFor(s);
  if (f.act3Complete) return "Act 3 complete!";
  switch (s.zone) {
    case "sunlessSea":
      return "Press on into the kelp forest";
    case "kelpForest":
      return f.metFluffball ? "Head east to the deep kelp beds" : "Explore the kelp forest";
    case "sunTemple":
      return "Search the drowned sun-temple";
    case "fluffballBed":
      return "Corner the chick in the kelp bed";
    case "deepBed":
      if (!f.lurkerDefeated) return "Fish the deep bed for silverfin";
      if (!f.silverfinCaught) return "Cast again — land the silverfin";
      return "Climb up, out of the sea";
    case "seaAscent":
      return "Climb the shaft to the surface";
    default:
      // Still in an Act 1/2 zone after the hand-off: get down there.
      return "Descend into the Sunless Sea";
  }
}

/**
 * The Act 4 chain (Dirty Laundry — the Miners' Camp, a five-zone chain), once
 * act4Started is set. Each zone produces its own grounded objective line.
 * ≤ 40 chars.
 */
function act4ObjectiveFor(s: Act1State): string {
  const f = s.flags;
  if (f.act4Complete) return "Act 4 complete!";
  switch (s.zone) {
    case "minersCamp":
      return "Head into the miners' camp";
    case "campProper":
      if (!f.middenCleared) return "Clear the mites from the laundry nook";
      if (!f.gotSocks) return "Take the ripe socks off the line";
      return "You have the stinky socks!";
    case "laundryNook":
      return "Clear the midden-mite nest";
    case "campGallery":
      return "Climb the gallery to the ledge";
    case "campLedge":
      return "Corner the chick on the ledge";
    default:
      // Still in an Act 3 zone after the hand-off: get up to the camp.
      return "Head up to the miners' camp";
  }
}
