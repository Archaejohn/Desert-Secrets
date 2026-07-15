/**
 * Act 1 enemy definitions and party builders. Engine-agnostic.
 * See docs/CONTRACTS.md section 5.
 */

import type { Stats } from "./atb";

export interface EnemyDef {
  id: string;
  name: string;
  sheet: string;
  scale: number;
  stats: Stats;
  xp: number;
}

function def(
  id: string,
  name: string,
  sheet: string,
  scale: number,
  maxHp: number,
  attack: number,
  defense: number,
  speed: number,
  xp: number,
): EnemyDef {
  return {
    id,
    name,
    sheet,
    scale,
    stats: { maxHp, hp: maxHp, attack, defense, speed },
    xp,
  };
}

export const BESTIARY: Record<string, EnemyDef> = {
  scarab: def("scarab", "Scarab", "scarab", 2.5, 15, 6, 2, 9, 8),
  buzzard: def("buzzard", "Buzzard", "buzzard", 2.5, 18, 7, 1, 13, 10),
  gila: def("gila", "Gila", "gila", 2.5, 26, 8, 4, 7, 14),
  jackrabbit: def("jackrabbit", "Jackrabbit", "jackrabbit", 2.5, 14, 5, 1, 15, 12),
  foreman: def("foreman", "Foreman Scarab", "foreman", 3, 55, 9, 5, 8, 30),
  queen: def("queen", "Dust Queen", "queen", 3, 90, 11, 4, 9, 60),
  /** Parley-route skirmish: the Queen holding back. */
  queenWeakened: def("queenWeakened", "Dust Queen", "queen", 3, 45, 11, 4, 9, 60),
  // Act 2 — the ice below.
  frostscarab: def("frostscarab", "Frost Scarab", "frostscarab", 2.5, 24, 9, 3, 11, 14),
  icebat: def("icebat", "Ice Bat", "icebat", 2.5, 20, 10, 2, 16, 16),
  crystalcrawler: def("crystalcrawler", "Crystal Crawler", "crystalcrawler", 2.5, 38, 11, 6, 8, 20),
  warden: def("warden", "Rime Warden", "warden", 3, 130, 13, 6, 9, 80),
  // Act 3 — the Sunless Sea.
  anglerfish: def("anglerfish", "Anglerfish", "anglerfish", 2.5, 30, 12, 4, 12, 22),
  reefeel: def("reefeel", "Reef Eel", "reefeel", 2.5, 26, 13, 3, 17, 24),
  lurker: def("lurker", "The Lurker", "lurker", 3, 150, 15, 7, 10, 90),
  // Act 4 — the Miners' Camp. Small, numerous, low-HP swarm pest: single-
  // target commands clear a nest of them fast (AOE-rewarding by design).
  middenmite: def("middenmite", "Midden Mite", "middenmite", 2, 9, 6, 1, 13, 6),
  // Act 5 — Sahra's grove. A sunstung wasp that swarms to guard the fruit;
  // the tonal-breather register — a fast nuisance, not a monster.
  sunwasp: def("sunwasp", "Sunwasp", "sunwasp", 2.5, 22, 11, 3, 16, 16),
  // Act 6 — The Reef. A bulky ambush predator that hunts the crawlers' kelp
  // rows — the reef's actual danger, distinct from the (peaceful) crawlers
  // themselves; also the avoidable fallback fight if the trade goes badly.
  reefstalker: def("reefstalker", "Reef Stalker", "reefstalker", 2.5, 38, 14, 5, 13, 22),
};

function lookup(id: string): EnemyDef {
  const d = BESTIARY[id];
  if (!d) throw new Error(`bestiary: unknown enemy id "${id}"`);
  return d;
}

const LETTERS = "ABCDEFGH";

/**
 * Build enemy-side combatant seeds for AtbBattle. Duplicated species get
 * unique ids ("gila-1", "gila-2") and display names ("Gila A", "Gila B");
 * single occurrences keep the plain id and name. Stats are fresh copies
 * with hp = maxHp.
 */
export function makeEnemyParty(
  ids: string[],
): Array<{ id: string; name: string; side: "enemy"; stats: Stats }> {
  const counts = new Map<string, number>();
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);

  const seen = new Map<string, number>();
  return ids.map((id) => {
    const d = lookup(id);
    const duplicated = (counts.get(id) ?? 0) > 1;
    const index = seen.get(id) ?? 0;
    seen.set(id, index + 1);
    if (duplicated && index >= LETTERS.length) {
      throw new Error(`makeEnemyParty: too many copies of "${id}"`);
    }
    return {
      id: duplicated ? `${id}-${index + 1}` : id,
      name: duplicated ? `${d.name} ${LETTERS[index]}` : d.name,
      side: "enemy" as const,
      stats: { ...d.stats, hp: d.stats.maxHp },
    };
  });
}

/** Total XP awarded for defeating a group. */
export function xpForParty(ids: string[]): number {
  return ids.reduce((sum, id) => sum + lookup(id).xp, 0);
}
