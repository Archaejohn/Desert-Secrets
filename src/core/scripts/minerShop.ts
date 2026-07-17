/**
 * Act 2 — the crevasse camp shops. Two rescued miners sell gear for shinies:
 * Mo sells the miner's hat, Gus sells the pickaxe. Each script follows the
 * same copy-and-strip pattern as Dusty's "Pay a shiny" (see TrailScene): the
 * "Buy" choice is offered ONLY when the player can afford it AND doesn't
 * already own the item; the scene strips it otherwise. On the `buy-end`
 * terminal node the scene spends the shinies and grants the item.
 *
 * Engine-agnostic: pure DialogueScript data + price constants, no Phaser.
 */
import type { DialogueScript } from "../dialogue";

/** Shiny prices, tuned to the faucet (Pamela's 1 + ~30% battle drops). */
export const MINERS_HAT_PRICE = 2;
export const PICKAXE_PRICE = 3;

/** Mo's camp chatter, extended with the miner's-hat offer. */
export const moShopScript: DialogueScript = {
  start: "camp",
  nodes: [
    {
      id: "camp",
      lines: [
        { speaker: "Mo", text: "Camp's holding. Trust the amber lanterns." },
        { speaker: "Mo", text: "Got a spare lamp-hat, if you've the shine." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [{ speaker: "Mo", text: `Miner's hat. ${MINERS_HAT_PRICE} shinies. Saves a skull.` }],
      choices: [
        { text: `Buy the miner's hat (${MINERS_HAT_PRICE} shinies)`, next: "buy-end" },
        { text: "Maybe later", next: "later-end" },
      ],
    },
    {
      id: "buy-end",
      lines: [{ speaker: "Mo", text: "Wear it proud. Lamp's still good." }],
    },
    {
      id: "later-end",
      lines: [{ speaker: "Mo", text: "It'll keep. Not much call for hats down here." }],
    },
  ],
};

/** Gus's camp chatter, extended with the pickaxe offer. */
export const gusShopScript: DialogueScript = {
  start: "camp",
  nodes: [
    {
      id: "camp",
      lines: [
        { speaker: "Gus", text: "Still smell tomato pie some nights. Swear it." },
        { speaker: "Gus", text: "My old pick's yours — for a little shine." },
      ],
      next: "hub",
    },
    {
      id: "hub",
      lines: [{ speaker: "Gus", text: `The pickaxe. ${PICKAXE_PRICE} shinies. Swings hard.` }],
      choices: [
        { text: `Buy the pickaxe (${PICKAXE_PRICE} shinies)`, next: "buy-end" },
        { text: "Maybe later", next: "later-end" },
      ],
    },
    {
      id: "buy-end",
      lines: [{ speaker: "Gus", text: "Mind the swing. She bites both ways." }],
    },
    {
      id: "later-end",
      lines: [{ speaker: "Gus", text: "She's not going anywhere. Nor am I." }],
    },
  ],
};

/**
 * Return the shop script with the "Buy" choice removed when `offer` is false
 * (can't afford, or already owned). Pure — clones so the source script is never
 * mutated. Mirrors the scene-side copy-and-strip used for Dusty/the jackrabbit.
 */
export function shopScriptFor(base: DialogueScript, offer: boolean): DialogueScript {
  if (offer) return base;
  const stripped = structuredClone(base);
  const hub = stripped.nodes.find((n) => n.id === "hub")!;
  hub.choices = hub.choices!.filter((c) => c.next !== "buy-end");
  return stripped;
}
