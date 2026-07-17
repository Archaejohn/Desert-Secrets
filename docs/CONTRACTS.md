# Module Contracts

These contracts let the art pipeline, the game core, and the Phaser scenes be
developed independently. **Do not change names, layouts or signatures below
without updating every consumer.**

## 1. Generated asset contract

The art pipeline (`npm run art`, source in `tools/pipeline/`) writes into
`src/assets/generated/`:

| File            | Contents |
|-----------------|----------|
| `hero.png`      | 16×24 frames, grid **6 columns × 4 rows** (96×96 px) |
| `npc.png`       | same layout as hero (a desert elder, visually distinct) |
| `scarab.png`    | 24×24 frames, grid **6 columns × 1 row** (144×24 px) — battle enemy |
| `tiles.png`     | 16×16 tiles, grid **8 columns × 2 rows** (128×32 px) |
| `manifest.json` | machine-readable description (schema below) |

All pixels in every PNG must be either fully transparent (alpha 0) or an
exactly-matching colour from `src/shared/palette.ts` at alpha 255. Output must
be byte-for-byte deterministic (no `Date.now`/`Math.random`; use the seeded
RNG from the core contract if variation is needed).

### Character sheets (hero.png / npc.png)

Rows are facing directions, in order: **0 = down, 1 = left, 2 = right, 3 = up**.
Columns within a row: **0–1 idle** (breathing bob), **2–5 walk cycle**
(contact / pass / contact / pass with swinging arms and legs — real limb
motion, not sliding). Frame indices in animations are absolute (row-major
across the whole sheet), matching Phaser spritesheet numbering.

### Enemy sheet (scarab.png)

One row: frames **0–1 idle** (antennae/shell twitch), **2–5 move/attack
skitter**.

### Tile sheet (tiles.png)

Row-major named indices, all required:

```
sand:0  sand2:1  sand3:2  duneEdge:3  rock:4  cactus:5  brick:6  brickCracked:7
water:8 water2:9 palmTrunk:10 palmTop:11 pot:12 bones:13 ruinPillar:14 sandSparkle:15
```

### manifest.json schema

```jsonc
{
  "palette": { "<name>": "#rrggbb" },          // copied from palette.ts
  "sheets": {
    "hero": {
      "file": "hero.png", "frameWidth": 16, "frameHeight": 24,
      "columns": 6, "rows": 4,
      "animations": {
        // exactly these 8 keys for hero (and npc- equivalents for npc):
        "hero-idle-down":  { "frames": [0, 1],        "frameRate": 2,  "repeat": -1 },
        "hero-walk-down":  { "frames": [2, 3, 4, 5],  "frameRate": 10, "repeat": -1 },
        "hero-idle-left":  { "frames": [6, 7],        "frameRate": 2,  "repeat": -1 },
        "hero-walk-left":  { "frames": [8, 9, 10, 11],"frameRate": 10, "repeat": -1 }
        // ...same pattern for right (row 2) and up (row 3)
      }
    },
    "npc":    { /* same shape, animation keys prefixed "npc-" */ },
    "scarab": {
      "file": "scarab.png", "frameWidth": 24, "frameHeight": 24,
      "columns": 6, "rows": 1,
      "animations": {
        "scarab-idle": { "frames": [0, 1],       "frameRate": 3,  "repeat": -1 },
        "scarab-move": { "frames": [2, 3, 4, 5], "frameRate": 10, "repeat": -1 }
      }
    }
  },
  "tiles": { "file": "tiles.png", "tileSize": 16, "columns": 8,
             "names": { "sand": 0, /* ... as listed above */ } }
}
```

## 2. Game-core contract (`src/core/`)

Engine-agnostic TypeScript, no Phaser imports, fully unit-testable.

### `src/core/rng.ts`

```ts
export function makeRng(seed: number): () => number; // deterministic, [0, 1)
```

### `src/core/atb.ts` — Active Time Battle

```ts
export interface Stats { maxHp: number; hp: number; attack: number; defense: number; speed: number }
export type Side = "party" | "enemy";
export interface Combatant { id: string; name: string; side: Side; stats: Stats; gauge: number /* 0..1 */; guarding: boolean }

export type BattleEvent =
  | { type: "ready"; id: string }
  | { type: "action"; actorId: string; targetId: string; action: "attack" | "guard"; damage: number; targetHp: number }
  | { type: "defeated"; id: string }
  | { type: "victory"; winner: Side };

export interface AtbOptions { rng?: () => number; fillRate?: number /* default 0.35 gauge/sec at speed 10 */ }

export class AtbBattle {
  constructor(combatants: Array<Omit<Combatant, "gauge" | "guarding">>, opts?: AtbOptions);
  /** Advance time; fills gauges (gauge += speed/10 * fillRate * dt), emits "ready" once per fill. Stops when battle is over. */
  tick(dtSeconds: number): BattleEvent[];
  isReady(id: string): boolean;
  /** Consume actor's full gauge. attack requires targetId (must be a living opponent). guard needs no target. */
  act(actorId: string, action: "attack" | "guard", targetId?: string): BattleEvent[];
  getCombatant(id: string): Combatant;
  livingOn(side: Side): Combatant[];
  get over(): boolean;
  get winner(): Side | null;
}

/** Simple enemy brain: attack a random living party member. */
export function chooseEnemyAction(battle: AtbBattle, actorId: string, rng: () => number): { action: "attack"; targetId: string };
```

Damage: `max(1, round((atk * 2 - def) * (0.9 + rng() * 0.2)))`, halved
(floored, min 1) while the target is guarding. Guard lasts until the
guarding combatant's next `ready`. Dead combatants stop gaining gauge and
can't act or be targeted. `victory` fires exactly once when a side is wiped.

### `src/core/dialogue.ts`

```ts
export interface DialogueLine { speaker: string; text: string }
export interface DialogueChoice { text: string; next: string }
export interface DialogueNode { id: string; lines: DialogueLine[]; choices?: DialogueChoice[]; next?: string }
export interface DialogueScript { start: string; nodes: DialogueNode[] }

/** Throws with a descriptive message on dangling node refs, duplicate ids, empty nodes, or missing start. */
export function validateScript(script: DialogueScript): void;

export class DialogueRunner {
  constructor(script: DialogueScript); // validates on construction
  start(): DialogueLine;
  get active(): boolean;
  get currentLine(): DialogueLine | null;
  /** Choices for the current node — only non-null on its last line. */
  get choices(): DialogueChoice[] | null;
  /** Advance to next line/node. Pass choiceIndex when choices is non-null. Returns null when the script ends. */
  advance(choiceIndex?: number): DialogueLine | null;
}
```

## 3. Consumers

`src/game/` (Phaser scenes) imports the manifest via
`import manifest from "../assets/generated/manifest.json"`, loads sheets as
spritesheets, and registers every animation listed. It imports `AtbBattle`
and `DialogueRunner` for the battle and NPC conversation. Scenes contain no
game rules of their own — rules live in `src/core/` where they are tested.

---

# Act 1 contracts (v2)

## 4. New generated assets (art pipeline)

New character/enemy sheets in `src/assets/generated/`, same rules as §1
(palette-locked, deterministic, ink outlines, idle frames 0–1 / motion
frames 2–5, manifest animations with absolute frame indices):

| File | Frame | Grid | Animations (exact keys) | Design |
|---|---|---|---|---|
| `rosa.png` | 16×24 | 6×4 (rows down/left/right/up) | `rosa-idle-*`, `rosa-walk-*` (8 keys, same pattern as hero) | Transport driver: amber hi-vis vest, bone shirt, ink hair, clay skin |
| `piggy.png` | 16×16 | 6×1 | `piggy-idle` [0,1] fr 3, `piggy-walk` [2,3,4,5] fr 8 | Baby emperor penguin: ink back, bone belly, amber beak+feet, mint frost glint; idle = shiver, walk = waddle (side-to-side lean) |
| `jackrabbit.png` | 16×16 | 6×1 | `jackrabbit-idle` [0,1] fr 3, `jackrabbit-move` [2..5] fr 12 | Sand/clay jackrabbit, big ears; move = hop cycle |
| `buzzard.png` | 24×24 | 6×1 | `buzzard-idle` [0,1] fr 3, `buzzard-move` [2..5] fr 8 | Plum/ink buzzard; idle = perched shrug, move = flap |
| `gila.png` | 24×24 | 6×1 | `gila-idle` [0,1] fr 3, `gila-move` [2..5] fr 8 | Gila monster: rust/ink beaded pattern, low crawl |
| `foreman.png` | 24×24 | 6×1 | `foreman-idle` [0,1] fr 3, `foreman-move` [2..5] fr 10 | Armored scarab elite: slate/indigo plates over rust shell, amber eye |
| `queen.png` | 32×32 | 6×1 | `queen-idle` [0,1] fr 2, `queen-move` [2..5] fr 8 | Dust Queen: huge scarab, mauve/rust carapace, jade gem crown, bone mandibles |

New tile sheet `tiles2.png`: 16×16 tiles, **8 columns × 3 rows** (128×48).
Manifest gets a top-level `"tiles2"` entry with the same shape as
`"tiles"`. Required names/indices (row-major):

```
asphalt:0 asphaltLine:1 truckCab:2 truckBox:3 crateBroken:4 joshuaTrunk:5 joshuaTop:6 creosote:7
stationWall:8 stationWindow:9 stationSign:10 gasPump:11 mineWall:12 mineFloor:13 mineTimber:14 rail:15
cart:16 lever:17 leverOn:18 iceWall:19 iceWallCrack:20 frostSand:21 iceChip:22 eggCluster:23
```

Design notes: asphalt = plum/ink with mauve wear; truck tiles read as a
crashed box-truck when composed; joshuaTop = jade/teal spiky crown;
station tiles = rust/clay walls, skyBlue window; mine tiles dark
(ink/plum floors, mauve walls, clay timbers); ice tiles = skyBlue/mint/
bone with white glints; iceChip = small mint/white shard on sand (used as
a collectible); frostSand = sand tile with mint rime. `iceWallCrack`
must visibly differ from `iceWall` (dark fissure showing `indigo`).

## 5. Core v2 (`src/core/`)

### `progression.ts`

```ts
export type PerkId = "vigor" | "ferocity" | "bulwark" | "swiftness";
export interface Perk { id: PerkId; label: string; description: string }
export const PERKS: readonly Perk[]; // vigor +4 maxHp, ferocity +1 attack, bulwark +1 defense, swiftness +1 speed
export const MAX_LEVEL = 5;
export const LEVEL_THRESHOLDS: readonly number[]; // cumulative XP to BE level i+1: [0, 20, 45, 75, 110]
export function levelForXp(xp: number): number;           // 1..MAX_LEVEL
export function xpToNext(xp: number): number | null;      // null at max level
export function baseStatsForLevel(level: number): Stats;  // L1 = 32/9/3/12 (maxHp/attack/defense/speed); +6 maxHp, +2 attack, +1 defense, +1 speed per level; hp = maxHp
export interface HeroBuild { xp: number; perks: PerkId[] }
export function statsForBuild(build: HeroBuild): Stats;   // baseStatsForLevel(levelForXp(xp)) + sum of perk bonuses
export type CommandId = "attack" | "guard" | "focus" | "second-wind" | "sandstep";
export function commandsForLevel(level: number): CommandId[]; // attack+guard always; focus at 2+; second-wind at 4+; sandstep at 5
export function grantXp(build: HeroBuild, amount: number): { build: HeroBuild; levelsGained: number };
```

Perks stack (taking vigor twice = +8 maxHp). One perk is chosen per
level-up; `perks.length` never exceeds `level - 1` (scene enforces).

### `atb.ts` extensions (backwards compatible)

- Action union becomes `"attack" | "guard" | "focus" | "second-wind" | "sandstep"`.
- `Combatant` gains: `focused: boolean`, `secondWindUsed: boolean`,
  `sandstepUsed: boolean`, and constructor input gains optional
  `cactusGuard?: boolean` (passive, defaults false).
- **focus**: no target; sets `focused = true`; emits action event with
  `damage: 0, targetId: actorId`. The actor's next successful **attack**
  deals ×1.5 damage (multiply after the base formula+variance, before
  guard halving; round, min 1) and clears `focused`.
- **second-wind**: no target; once per battle (`secondWindUsed`), heals
  `round(maxHp * 0.3)` capped at maxHp; emits new event
  `{ type: "heal"; id: string; amount: number; hp: number }` plus the
  standard action event (damage 0). Throws if already used.
- **sandstep**: no target; once per battle; after acting, gauge is set to
  0.5 instead of 0 (still not "ready" — must refill from 0.5). Throws if
  already used.
- **cactusGuard passive**: when a guarding combatant with `cactusGuard`
  is attacked, the attacker takes 2 flat damage after the hit resolves;
  emit `{ type: "thorns"; targetId: string /* attacker */; damage: 2; targetHp: number }`,
  then defeat/victory events if it kills.
- Guard semantics, defeat/victory ordering, and all existing behavior
  unchanged; existing tests must keep passing.

### `bestiary.ts`

```ts
export interface EnemyDef { id: string; name: string; sheet: string; scale: number; stats: Stats; xp: number }
export const BESTIARY: Record<string, EnemyDef>;
// scarab  { sheet "scarab", scale 2.5, 15/6/2/9,  xp 8  }
// buzzard { sheet "buzzard", scale 2.5, 18/7/1/13, xp 10 }
// gila    { sheet "gila",   scale 2.5, 26/8/4/7,  xp 14 }
// jackrabbit { sheet "jackrabbit", scale 2.5, 14/5/1/15, xp 12 }
// foreman { sheet "foreman", scale 3,  55/9/5/8,  xp 30 }
// queen   { sheet "queen",  scale 3,  90/11/4/9,  xp 60 }
// queenWeakened (parley skirmish): queen stats but 45 maxHp, xp 60
export function makeEnemyParty(ids: string[]): Array<{ id: string; name: string; side: "enemy"; stats: Stats }>;
// unique combatant ids ("gila-1", "gila-2") and display names ("Gila A", "Gila B") when duplicated
export function xpForParty(ids: string[]): number;
```

### `encounters.ts`

```ts
export interface EncounterTable { zone: string; groups: string[][]; weights: number[] } // parallel arrays
export const ENCOUNTERS: Record<"trail" | "mine", EncounterTable>;
// trail: [["scarab"],["buzzard"],["scarab","scarab"],["gila"],["buzzard","scarab"]] weights [3,3,2,2,1]
// mine:  [["scarab"],["scarab","scarab"],["gila"],["scarab","gila"]] weights [3,3,2,1]
export class EncounterClock {
  constructor(rng: () => number, opts?: { checkInterval?: number /* s, default 1 */, chance?: number /* default 0.09 */, graceSeconds?: number /* default 5 */ });
  /** Feed seconds of ACTIVE MOVEMENT. Returns a group (string[]) when an encounter triggers, else null. Applies grace after each trigger and after reset(). */
  advance(movingDt: number, table: EncounterTable): string[] | null;
  reset(): void;
}
```

Expected cadence ≈ one encounter per 11s of continuous movement after
the grace period (tests assert statistical bounds with a seeded rng).

### `gameState.ts`

```ts
export type ZoneId = "crash" | "oasis" | "trail" | "mine" | "depths";
export interface Act1State {
  zone: ZoneId;             // current zone = respawn checkpoint
  hero: HeroBuild;
  hp: number;               // current hp between battles
  pendingPerks: number;     // level-ups not yet spent on a perk choice
  items: { coldPack: boolean; shinies: number };
  flags: Record<string, boolean>; // quest flags, see list below
}
export function newGame(): Act1State; // zone "crash", xp 0, hp = maxHp, coldPack false (Rosa grants it in dialogue), shinies 0
export function heroStats(s: Act1State): Stats;            // statsForBuild with hp clamped to s.hp
export function awardXp(s: Act1State, amount: number): { state: Act1State; levelsGained: number }; // full heal on level-up; adds levelsGained to pendingPerks
export function choosePerk(s: Act1State, perk: PerkId): Act1State; // throws if pendingPerks === 0
export function applyBattleResult(s: Act1State, heroHpAfter: number): Act1State;
export function respawn(s: Act1State): Act1State;          // full hp, same zone, everything else kept
```

Flag names used by scenes: `metRosa, gotColdPack, metSahra, tutorialBattleWon,
chip1, chip2, chip3, rabbitResolved, rabbitTradedColdPack, metDusty,
mineOpen, leverPulled, foremanDefeated, queenResolved, parleyed, actComplete`.

### `scripts/` (dialogue, all validated by `validateScript`)

`rosaCrash.ts` (crash intro; grants cold pack via flag callback in scene),
`sahraAct1.ts` (rewrites the sun-temple lore to the frost mystery; choice
hub: trail / scarabs / farewell), `dustyTrade.ts`, `rabbitChoice.ts`
(choice: "Chase it down" / "Trade the cold pack" — second option only
shown by the scene when coldPack is held; scene reads which branch ended
via terminal node id), `queenFight.ts`, `queenParley.ts`, `radio.ts`
(exported `radioLines: Record<ZoneId, DialogueScript>` one-liner check-ins),
`cliffhanger.ts` (the ice-wall reveal lines + END OF ACT 1 card text).
Each script's terminal node ids are part of the contract:
`rabbitChoice` ends at node id `fight-end` or `trade-end`;
`queenParley` ends at `parley-end`; scenes branch on these.

## 6. Scene architecture (v2, `src/game/`)

- `ZoneScene` base class (extends `Phaser.Scene`): builds a tile map from
  a `ZoneMap` (ground/decor/overhead name grids + solid names), spawns
  the player from `Act1State`, handles movement/touch/depth-sort/HUD,
  dialogue box, encounter clock (if the zone has a table), exits
  (tile-rect → other zone), and checkpoint registration
  (`state.zone = this.zoneId` on create).
- Concrete zones: `CrashScene, OasisScene, TrailScene, MineScene,
  DepthsScene` — each provides map data (in `src/game/maps/*.ts`, pure +
  unit-testable like `worldMap.ts`), NPC/prop placement, and scripted
  triggers.
- `BattleScene` v2 `init` data:
  `{ group: string[]; zoneKey: ZoneId; bg: "desert" | "mine" | "ice"; boss?: boolean; returnTo: { scene: string; x: number; y: number } }`.
  Uses `heroStats` + `commandsForLevel`; awards `xpForParty` on victory
  (`awardXp`), then shows the perk-choice menu for each `pendingPerks`;
  defeat → `respawn(state)` then `scene.start(state.zone)` at that zone's
  default spawn. Victory returns to `returnTo` position.
- Global state lives in `this.registry.get("act1")` (a single
  `Act1State`), written back after every mutation.

---

# Act 2 contracts (v3)

## 7. New generated assets

Same rules as §1/§4. New sheets:

| File | Frame | Grid | Animations (exact keys) | Design |
|---|---|---|---|---|
| `slither.png` | 16×16 | 6×1 | `slither-idle` [0,1] fr 3, `slither-move` [2..5] fr 10 | Jade whipsnake: jade/teal body, mint belly, amber eyes, ink outline; idle = coiled tongue-flick, move = S-curve undulation. Faces RIGHT (world code flips) |
| `miner.png` | 16×24 | 6×4 (rows down/left/right/up) | `miner-idle-*`, `miner-walk-*` (8 keys, hero pattern) | Lost miner: slate overalls, clay skin, bone beard, amber lantern glow pixel on helmet |
| `fluffball.png` | 16×16 | 6×1 | `fluffball-idle` [0,1] fr 3, `fluffball-walk` [2..5] fr 8 | Round GRAY chick penguin: mauve/plum down, bone face, amber beak; even rounder than Piggy; idle = fluff-shake |
| `icebat.png` | 24×24 | 6×1 | `icebat-idle` [0,1] fr 3, `icebat-move` [2..5] fr 10 | Indigo/skyBlue cave bat, mint eye glints; idle = hang-twitch, move = flap |
| `crystalcrawler.png` | 24×24 | 6×1 | `crystalcrawler-idle` [0,1] fr 3, `crystalcrawler-move` [2..5] fr 8 | Gila-like crawler grown over with jade/skyBlue crystals; move = heavy crawl, crystal glint alternates |
| `frostscarab.png` | 24×24 | 6×1 | `frostscarab-idle` [0,1] fr 3, `frostscarab-move` [2..5] fr 10 | The scarab silhouette re-dressed in frost: skyBlue/slate shell, mint gem, bone rime edge |
| `warden.png` | 32×32 | 6×1 | `warden-idle` [0,1] fr 2, `warden-move` [2..5] fr 8 | Rime Warden boss: ancient beetle-construct, slate/indigo plates under bone ice sheath, single amber core glint; slow heavy churn |

New tile sheet `tiles3.png`: 16×16, **8 columns × 2 rows**; manifest entry
`"tiles3"` shaped like `"tiles"`. Names/indices (row-major):

```
iceFloor:0 iceFloor2:1 iceWallDeep:2 crystalSmall:3 crystalBig:4 icicle:5 chasm:6 snowdrift:7
lanternPost:8 lakeIce:9 lakeCrack:10 bridgePlank:11 doorRime:12 doorOpen:13 shard:14 mossGlow:15
```

Design: iceFloor tealDeep/indigo walkable ground (clearly darker than
iceWallDeep, which is skyBlue/bone solid wall); chasm = near-black pit
(solid); crystalBig/Small jade-skyBlue; icicle is an OVERHEAD tile;
lanternPost amber glow (landmark for maze wayfinding); lakeIce vs
lakeCrack clearly differ; doorRime (solid, sealed) vs doorOpen (walkable
frame) clearly differ; shard = mint pickup sparkle; mossGlow = mint-lit
floor variant.

Solidity additions to `SOLID_TILE_NAMES` (scene layer, orchestrator):
`iceWallDeep, crystalBig, chasm, lanternPost, doorRime`.

## 8. Core v3 (`src/core/`)

### progression.ts
- `LEVEL_THRESHOLDS` extends to `[0,20,45,75,110,150,195,245]`, `MAX_LEVEL = 8`.
  `commandsForLevel` unchanged above 5. Perk per level as before.
- New: `slitherStatsForLevel(level): Stats` = maxHp 22+4·(level−1),
  attack 6+2·(level−1), defense 2+⌊(level−1)/2⌋, speed 14+(level−1); hp = maxHp.
- New: `SLITHER_COMMANDS: CommandId[]` (see atb: `["attack","guard","venom"]`,
  displayed by the scene as Bite/Coil/Venom).

### atb.ts
- Action union adds `"venom"`: requires a living opposing target. Damage =
  `max(1, round(base * 0.75))` where base is the §2 formula w/ variance
  (guard halving applies after). Then the target's CURRENT speed is
  multiplied by 0.75, floored at 50% of the speed it entered battle with.
  Events: standard `action` (action:"venom", damage, targetHp) followed by
  `{ type: "debuff"; targetId: string; stat: "speed"; speed: number }`
  (the new current speed), then defeated/victory as usual if it kills.
- Combatant gains `baseSpeed` (captured at construction) so the floor is
  computable. Everything existing stays backwards compatible.

### bestiary.ts additions
```
frostscarab    { sheet "frostscarab",   scale 2.5, 24/9/3/11,  xp 14 }
icebat         { sheet "icebat",        scale 2.5, 20/10/2/16, xp 16 }
crystalcrawler { sheet "crystalcrawler",scale 2.5, 38/11/6/8,  xp 20 }
warden         { sheet "warden",        scale 3,  130/13/6/9,  xp 80 }
```

### encounters.ts additions
```
maze:      groups [["frostscarab"],["icebat"],["frostscarab","frostscarab"],["icebat","frostscarab"]] weights [3,3,2,2]
galleries: groups [["icebat"],["crystalcrawler"],["icebat","icebat"],["crystalcrawler","icebat"]]     weights [3,2,2,1]
```
`ENCOUNTERS` keys become `"trail" | "mine" | "maze" | "galleries"`.

### gameState.ts
- `ZoneId` adds `"crevasse" | "maze" | "galleries" | "sanctum"`.
- New flags (init false in `newGame`): `act2Started, minerMo, minerEdda,
  minerGus, minersBonusGiven, metSlither, mazeShortcutOpen, rimeDoorOpen,
  slitherJoined, wardenDefeated, act2Complete, shard1, shard2`.
- Party helper: `partyFor(state): Array<{id:"hero"|"slither"; name:string;
  stats:Stats; commands:CommandId[]; cactusGuard:boolean}>` — hero always
  (as today); plus Slither when `flags.slitherJoined`
  (`slitherStatsForLevel(levelForXp(xp))`, full hp each battle, commands
  `SLITHER_COMMANDS`, no cactusGuard).

### objective.ts — extend the chain
crash/oasis/trail/mine/depths as today; then (once `actComplete`):
descend (crevasse) → "Find a way through the ice maze" → miners counter
("Lost miner found! (N/3)" moments handled by scenes; objective shows
maze/door/boss steps) → "Open the rime door" → "Cross the frozen lake" →
after `act2Complete`: "Act 2 complete!". Keep each ≤ 40 chars.

### scripts/ (new, all validated; hissing esses for Slither)
`minerMo.ts`, `minerEdda.ts`, `minerGus.ts` (each: relief + a maze hint +
one smells-tomato-pie / hears-waves seed line), `slitherMeet.ts` (shy →
offers to open the crack; terminal id `scout-end`), `slitherDoor.ts`
(opens the rime door, then JOINS: "Sssomebody has to keep you alive.";
terminal id `join-end`), `wardenIntro.ts` (2 lines, construct voice),
`act2Ending.ts` (lake cracks; TWO penguin silhouettes; Slither: "...Two?
There are TWO?"; final line exactly "ACT 3: THE SUNLESS SEA").

## 9. Scenes v3 (`src/game/`)

- Zone scene keys = zone ids. `DepthsScene` end card becomes the ACT 2
  hand-off: "SPACE — descend" → `scene.start("crevasse")` WITHOUT reset
  (sets `act2Started`).
- **crevasse** (~20×16, battleBg "ice", no random encounters): entry from
  depths; 3 exits from the entry room — one loops back into the room
  (false lead), one dead-end pocket with **Mo** (flag minerMo, +30 XP),
  one true path to `maze`. Miner camp corner where rescued miners gather
  (sprites appear per flag).
- **maze** (~44×28, encounterZone "maze", battleBg "ice"): ≥6 rooms,
  corridors with multiple doorways; ≥2 disjoint routes entry→far side;
  ≥3 false leads (dead-end shard cache → flag shard1, +heal & +10 XP;
  dead-end with **Edda** (minerEdda, +30 XP); dead-end ambush → forced
  frostscarab×2 battle + shard2). One loop corridor returns to the entry
  room. A crack passage (doorRime tile) on the shorter route: trigger →
  `slitherMeet` → metSlither + mazeShortcutOpen → replace with doorOpen.
  TWO exits to `galleries` (different edges → different galleries spawns).
  Lantern posts mark junctions (wayfinding).
- **galleries** (~36×20, encounterZone "galleries", battleBg "ice"): Gus
  down a side gallery (minerGus, +30 XP). When all three miner flags set
  and !minersBonusGiven: award +1 pendingPerk (use a state mutator, e.g.
  spread `pendingPerks + 1`) + flavor line, set minersBonusGiven. Far
  door = doorRime gate: trigger → requires metSlither → `slitherDoor` →
  rimeDoorOpen + slitherJoined; Slither becomes a world FOLLOWER (trails
  the player's position history ~20 frames back, plays slither-move,
  flips by direction) from here on. Exit to `sanctum` through the door.
- **sanctum** (~26×18, battleBg "ice", no random encounters): frozen lake
  (lakeIce), Warden sprite center. Approach trigger → `wardenIntro` →
  boss battle `["warden"]` (party = hero + slither). After wardenDefeated:
  ending cutscene — lake tiles along a line flip to lakeCrack with camera
  shake; Piggy AND Fluffball sprites (piggy-walk / fluffball-walk) cross
  the lake and exit; `act2Ending` script; then end card "END OF ACT 2 ·
  ACT 3: THE SUNLESS SEA — coming soon", SPACE/tap → `resetGame` →
  "crash". Set act2Complete before the card.
- **BattleScene party support**: build combatants from `partyFor(state)`.
  Party sprites column on the right (hero 370,140; slither 380,205, scale
  2.5, slither-idle). One gauge+HP bar per combatant. When a PARTY member
  is ready and the menu is hidden, open the menu for that member (label
  the panel with their name; hero commands as today; slither shows
  Bite/Coil/Venom → attack/guard/venom). If both are ready, hero first,
  the other right after the first acts. Venom float: "VENOM" in jade on
  actor, debuff event floats "SLOW" on target. Victory/defeat flows
  unchanged (defeat = whole party wiped; hero hp persistence as today;
  slither always enters at full hp).

## 10. Map tests v3
Same guarantees as v2 (dimensions, manifest names incl. tiles3,
determinism, enclosure-with-gates, BFS spawn→landmarks) plus maze-specific:
- ≥2 vertex-disjoint routes entry→exit-room doorway (verify by BFS after
  blocking each single corridor junction... acceptable simplification:
  BFS still reaches the exit after solidifying ANY ONE of the two named
  "route pinch" tiles the map module exports).
- Each declared false-lead dead end is reachable, and removing its single
  entrance tile makes it unreachable (proves it's a true cul-de-sac).
- Both maze→galleries exits reachable; loop corridor returns to entry.

---

# Act 1 retcon: John & Pamela replace Sahra (v4)

Sahra is removed from Act 1's oasis beat. The oasis is now framed as
Joseph's family homestead, built by the spring — his parents, **John**
and **Pamela**, live there. (Sahra herself is not deleted from the game's
future — `docs/STORY_ACTS3-7.md` Act 5 can still introduce her fresh,
unconnected to Act 1, as originally planned.)

## New generated assets

Same rules as §1/§4/§7 (palette-locked, deterministic, ink outlines,
manifest animations with absolute frame indices):

| File | Frame | Grid | Animations | Design |
|---|---|---|---|---|
| `john.png` | 16×24 | 6×4 (down/left/right/up) | `john-idle-*`, `john-walk-*` (8 keys, hero pattern) | Sturdy rancher dad: rust/clay work shirt, slate trousers, bone/gray hair, wide sand-colored hat, ink boots — broader silhouette than Joseph |
| `pamela.png` | 16×24 | 6×4 (down/left/right/up) | `pamela-idle-*`, `pamela-walk-*` (8 keys, hero pattern) | Practical mom: jade/teal apron over a bone blouse, sand hair tied back, warm posture |
| `chicken.png` | 16×16 | 6×1 | `chicken-idle` [0,1] fr 3, `chicken-move` [2..5] fr 10 | Small round hen: bone/sand feathers, amber beak+feet, small rust comb; idle = head-bob peck, move = strut |

`john.png`/`pamela.png` reuse the existing 4-direction humanoid rig
(`poses.ts`, mirror-derived left row) like `rosa.ts`/`miner.ts`.
`chicken.png` reuses the small-creature pattern (`jackrabbit.ts`).
All prior assets (through `tiles3.png`) stay byte-identical — no existing
tileset gains new tiles; the chicken coop is composed entirely from
existing tile names (`ruinPillar` fence posts, `brick`/`brickCracked`
low walls, `pot` as feed/water troughs, plain `sand` interior).

## Core changes

- `gameState.ts`: `ACT1_FLAGS` drops `metSahra`, gains `metParents` (same
  narrative slot — set on first dialogue close, same node that triggers
  the tutorial battle) and `choresDone` (the chicken side quest, optional,
  never gates progress).
- `objective.ts`: the `!f.metSahra` line ("Find the keeper of the oasis")
  becomes `!f.metParents` → `"Find your parents at the oasis"`.
- `scripts/sahra.ts` and `scripts/sahraAct1.ts` are deleted (the former
  was already orphaned/demo-only; the latter is fully superseded).
  `scripts/homeAct1.ts` replaces `sahraAct1.ts` in `OasisScene`, same
  structural contract: a greet flow ending in a 3-item choice hub
  ("Ask about Thomas" / "Ask about the chickens" / "Say goodbye"), the
  first two looping back to the hub, farewell terminating the script.
  Content: Pamela and John both voice lines (family conversation, not a
  single hermit monologue); "Ask about Thomas" reinforces the Act 1
  crash-site seed (Thomas still hasn't turned up — "That boy and his
  secrets. Find Piggy first."); "Ask about the chickens" is exactly the
  side-quest hook the design calls for ("did you feed and water them
  yet?") and points the player at the coop.

## Scene changes (`OasisScene`, `oasisMap.ts`)

- `OASIS_SAHRA` renamed `OASIS_PARENTS` (John's tile; Pamela stands one
  tile over). Both are `addNpc`'d pointing at the same `homeAct1Script`
  and the same `onClose` handler (sets `metParents`, fires the tutorial
  battle on the first close) — talking to either parent has the same
  effect, no separate bookkeeping per parent.
- New landmark `OASIS_COOP` (interaction point) plus a small fenced pen
  near it (existing tiles only, per above). One `addTrigger` there:
  walking in and interacting (if `!choresDone`) plays a short two-line
  inline flavor beat ("You fill the trough and top off the water. The
  hens go wild."), sets `choresDone`, awards **+10 XP**, floats "+10 XP".
  Entirely optional — never blocks the exit to the trail. 2–3 static
  `chicken-idle` sprites live in the pen for visual life.

---

# Act 1 addition: the bucket fetch-quest + a minimal inventory (v5)

Extends the chicken side quest from v4: instead of completing on a single
walk-in, feeding the chickens now takes three steps — get a bucket from
a new zone south of the homestead, fill it at the spring, deliver it to
the coop. A small persistent inventory HUD shows what's currently held.

## New generated asset

| File | Frame | Grid | Animations | Design |
|---|---|---|---|---|
| `bucket.png` | 16×16 | 2×1 (32×16px) | `bucket-empty` [0] repeat 0, `bucket-full` [1] repeat 0 | A static prop, not a creature — two discrete frames, no motion between them. Frame 0: a plain clay/rust pail, empty (interior in `ink` shadow). Frame 1: the same pail with a `skyBlue`/`mint` water surface visible over the rim, one small `white` glint. |

Same palette-lock/determinism rules as every other sheet; all prior
assets (through `pamela.png`/`chicken.png`) stay byte-identical.

## New zone: `shed`

A small single-screen utility area south of the homestead — Joseph's
family keeps tools and water buckets here. Composed entirely from
existing tile names (no new tileset): `brick`/`brickCracked` walls,
`ruinPillar` support posts, `pot` as barrels, `rock`/`cactus`/`bones` for
flavor, bounded on all sides, one north exit back to `oasis`. Holds one
pickup: the bucket, at a landmark tile `SHED_BUCKET`. Walking onto it (if
`items.bucket === "none"`) removes the prop, sets `items.bucket =
"empty"`, floats "Got a bucket." `ZoneId` gains `"shed"`.

## Oasis changes

- New `OASIS_SOUTH_EXIT` gate in the south border (existing visible-gate
  pattern — a real opening + a path, not an invisible trigger), placed
  near the coop, leading to `shed`; `OASIS_SOUTH_SPAWN` back the other way.
- New `OASIS_SPRING_FILL` landmark just south of the pond. A repeatable
  (`once: false`) trigger there: if `items.bucket === "empty"`, fill it
  (`items.bucket = "filled"`, float "Bucket filled!"); any other bucket
  state, no effect (silent).
- The coop trigger (v4) now branches on `items.bucket` instead of firing
  unconditionally: `"filled"` → completes the chore exactly as v4 (+10
  XP, `choresDone`, bucket is spent — reset to `"none"` since the quest
  is one-time and done); `"none"` or `"empty"` → a short inline hint line
  instead ("Trough's dry. Got a bucket?" / "Bucket's empty. Try the
  spring.") and no state change.
- `homeAct1.ts`'s "Ask about the chickens" branch gets one line added
  pointing at the shed ("Bucket's out in the shed, south of here.").

## Core changes

- `gameState.ts`: `Act1State.items` gains `bucket: "none" | "empty" |
  "filled"`, initialized `"none"` in `newGame()`. Existing `items`
  spread-update call sites are unaffected (additive field).

## Inventory HUD

A small new UI element (`src/game/ui/InventoryHud.ts` or folded into the
existing `Hud`) — shown only when there's something worth showing (the
cold pack is held, or the bucket is anything but `"none"`). Text-based
for the cold pack (no dedicated art exists for it); the bucket gets a
small icon drawn from `bucket.png` at its current frame (empty/full)
alongside a short label. This is deliberately the *minimal* version of
the inventory system `docs/STORY_ACTS3-7.md` already anticipates needing
for Act 4's stinky socks — extend this component later rather than
building a second one.

# v6: inventory window, equip, and the spigot

Replaces v5's walk-over triggers for the bucket quest with an explicit
inventory window and an equip step, and fixes a shed map bug that made
the bucket unreachable via its intended path.

## The shed reachability bug

`shedMap.ts`'s original layout put a flavor wall (`decor[5][x]` for
x=6..10) directly between the north spawn and `SHED_BUCKET` at
`{x:8,y:6}`, sealing the pickup off from the entrance entirely — reaching
it required an unintended detour around the south side. Root-caused via
a debug script that walked the player with real arrow-key input (not
`body.reset` teleportation, which bypasses collision and had masked the
bug in every prior smoke-test run) and printed an `isSolidAt()` ASCII
map. Fixed by moving `SHED_BUCKET` to `{x:8,y:5}` and restructuring the
flavor wall to sit *behind* (south of) the bucket, never between spawn
and pickup — verified with a clean walkable column from y=2 to y=5.
Lesson: e2e coverage now includes at least one real, key-driven walking
check (`walkUntilNear` in `tools/smoke/e2e.mjs`) rather than only
teleport-based state assertions, specifically to catch this class of bug.

## `Act1State.items.equipped`

`gameState.ts`: `items` gains `equipped: "bucket" | null`, `null` in
`newGame()`. Only an equipped item can be used out in the world — the
spigot and the coop both check `items.equipped === "bucket"` before
`items.bucket`, in addition to it. Picking the bucket up no longer
equips it automatically; equipping is a deliberate step in the
inventory window. Delivering the chore's filled bucket clears both
`items.bucket` (→ `"none"`) and `items.equipped` (→ `null`) — it's
spent and no longer worth carrying equipped.

## `InteractPoint`: press-E interactions replace walk-over triggers

`ZoneScene.ts` gains a new interaction primitive alongside the existing
`addTrigger` (still used for exits/cutscenes elsewhere): `addInteractPoint(tileX,
tileY, onUse, opts?: {range?, once?})`. Unlike a walk-over trigger, it
only fires on an explicit E-press/tap while in range — never just by
standing on a tile — so it structurally cannot refire on the frame right
after its own callback changes the state it reads (the root cause of an
earlier bug where a successful chicken-delivery's state reset triggered
a stray "no bucket" hint one frame later). NPCs still take priority over
interact points when both are in range; the shared `talkPrompt` ("E")
UI element is reused for both. The shed's bucket pickup, the coop
delivery, and the new spigot fill are all `InteractPoint`s now; none of
the three is a walk-over `addTrigger` any more.

## New generated asset: the spigot

| File | Frame | Grid | Animations | Design |
|---|---|---|---|---|
| `spigot.png` | 16×16 | 1×1 (16×16px) | `spigot-idle` [0] repeat 0 | A static, single-frame prop — a valve wheel, pipe and spout on a clay mound, with a falling water drop as the "fill here" tell. Placed next to the spring so the fill spot is an obvious landmark instead of an invisible trigger tile. |

Wired the same way as `bucket.png` (a `composeSheet`/`propSheet` pair in
`assets.ts`/`manifest.ts`, appended additively to `SHEET_KEYS` — not a
`tileset.ts`/`tileset2.ts`/`tileset3.ts` entry, since those three
tilesets are fixed at exactly 16 contract tiles each and inserting a
17th would risk disturbing their pinned determinism hashes). Placed in
`OasisScene` with a plain `this.add.sprite(..., "spigot", 0)`, the same
way the coop's decorative hens are placed — not `addProp()`, which only
resolves names from the tile atlases.

## `InventoryMenu`: the inventory window

`src/game/ui/InventoryMenu.ts` — a modal window opened with the "I" key
(mirroring `PerkMenu`'s styling and self-contained input-handler
lifecycle: ink background, gold border/highlight, listeners registered
on open and torn down on close). Each row is graphical, not plain text:
the item's actual sprite icon (e.g. `bucket.png` at its current
empty/full frame) plus its name, with the highlighted row's full
description shown below in a detail panel with a bigger (2×) icon and
wrapped flavor text — not just a label. Selecting the bucket row
(SPACE/ENTER, or tap) toggles `items.equipped`, marked with a `✓
equipped` tag. `ZoneScene.openInventory()` constructs it lazily against
the current `Act1State`; while `inventoryMenu` is set, `update()`
returns immediately after zeroing player velocity, so movement, dialogue
and interact points are all suspended for the duration.

Closing is deliberately redundant: ESC, "I" again, or a tap on an
always-visible ✕ in the panel's corner. The ✕ exists because a
touch-only player has no ESC key at all — the first version of this
menu only had keyboard-close bindings, which left phone players with no
way out once they opened it. The ✕ (and every row) is hit-tested
manually in `tapAt()` against the panel's local coordinates, the same
manual approach `PerkMenu` already used, rather than relying on
Phaser's per-object interactivity inside a `Container`.

Opening is wired as a single `keydown-I` event listener bound once in
`setupInput()`, calling `openInventory()` (which itself no-ops if a
menu is already open, dialogue is open, input is locked, or a scene
transition is in flight) — **not** a polled `JustDown` check in
`update()`. The polled form was tried first and had a real bug: while
the menu is open, `update()` returns before ever reading the "I" key,
so a *second* "I" press (the one meant to close the menu) sets the key's
internal justDown flag without anyone consuming it. `InventoryMenu`'s
own `keydown-I` listener closes the menu synchronously on that same
press — but then the very next `update()` tick sees the still-unconsumed
`JustDown` flag and reopens it immediately. Event-driven opening avoids
the whole failure mode: there is no polled flag left to go stale.

## Oasis/shed changes

- `ShedScene`: the bucket pickup is now an `InteractPoint` (`once:
  true`) instead of a walk-over trigger; same effect (destroys the prop,
  sets `items.bucket = "empty"`), but only fires on E/tap.
- `OasisScene`'s coop delivery and spring fill are both `InteractPoint`s
  now, gated on `items.equipped === "bucket"` in addition to the bucket
  state itself; hint copy was tightened to fit the 48-char dialogue box
  and to mention equipping via the bag.
- A `spigot` sprite marks the fill spot next to `OASIS_SPRING_FILL`.
- `homeAct1.ts`'s chicken-chore branch mentions the spigot and equipping
  from the bag.

## HUD changes

`Hud.ts`'s inventory row is no longer a full item list — it now shows
only a small "Equipped: Bucket (full/empty)" readout, and only while
something is actually equipped. The full contents live in the `I`
window; the HUD row can't go stale showing an item the player is merely
carrying but hasn't equipped.

## Touch affordances

`touch.ts` gains `addInventoryButton`/`inInventoryButtonZone`, a
top-left bag button mirroring the top-right fullscreen button, shown
only on touch devices (alongside the joystick and action-button hint).

# v7: tap-to-interact reaches InteractPoints, and bigger dialogue-choice touch targets

Two touch bugs reported right after v6 shipped: pressing "E"/tapping at
the bucket or the (bucket-less) coop did nothing, and dialogue choices
were too fiddly to tap accurately.

## Tap-to-interact only ever checked NPCs

`ZoneScene.onPointerDown()`'s tap-right-side branch called `talkTo(npc)`
if an NPC was near — full stop. It never checked
`nearestInteractPoint()`, so tapping to use the shed's bucket, the
spigot, or the coop silently did nothing on a touch device (physical "E"
still worked, which is why this shipped unnoticed: the smoke test's
touch coverage didn't exist yet). Fixed by extracting a shared
`interact()` method (NPC takes priority, falls back to the nearest
InteractPoint) used by both the keyboard `interactPressed` path in
`update()` and the tap-right-side path in `onPointerDown()` — one
codepath, so this class of divergence can't recur.

## Dialogue choice touch targets

`DialogueBox` grew from `BOX_H=64` to `100`, and two things changed for
choice lists:

- Each choice row's tap band grew from a 12px-tall (24 screen px) sliver
  to 18px (36 screen px), and now renders a full-width highlight bar
  behind the selected row — a visibly bigger target, not just a
  functionally bigger one.
- On a touch device, a persistent ▲ / ✓ / ▼ button column (22px/44
  screen-px squares) appears on the box's right edge whenever a choice
  list is showing — a fixed-position fallback that doesn't require
  hitting a specific row at all. Hidden entirely on desktop (the
  keyboard's arrows + SPACE/ENTER already cover this) and hidden for
  plain (non-choice) lines.

Both the row band and the button column are hit-tested manually in
`DialogueBox.tapAt()`, the same manual-coordinate approach already used
by `PerkMenu` and `InventoryMenu`, rather than Phaser's per-object
interactivity.

## New test coverage: `tools/smoke/touch-e2e.mjs`

A second, smaller Playwright script (`npm run smoke:touch`), separate
from the keyboard-driven `tools/smoke/e2e.mjs` playthrough, run in a
real touch-emulated browser context (`hasTouch: true, isMobile: true`).
`isTouchDevice()` reads `game.device.input.touch`, which only reads true
in a touch-emulated context — neither of these bugs was reachable from
the keyboard-only main smoke test, which is exactly how they shipped
unnoticed in v6. Covers: tapping an InteractPoint with no NPC nearby,
and tapping ▲/▼/✓ to move and confirm a dialogue choice.

# v8: the round "A" hint overlapping dialogue, a checkmark glyph, and ▲/✓/▼ everywhere there's a tappable list

Two follow-up reports right after v7 shipped: the persistent round "A"
action-button hint visually collided with the bottom of the dialogue
box, and the request to use a ✓ instead of the letter "A" on the
dialogue's touch column — plus a broader ask to put the same ▲/✓/▼
pattern on every other tap-a-row-in-a-list screen, explicitly including
battle.

## The round "A" hint overlapping the dialogue box

`addActionButtonHint()` draws a persistent circle+"A" hint at
`(scale.width - 26, scale.height - 90)` — meant for the exploration
"talk/interact" affordance. The dialogue box occupies the bottom
`BOX_H` (100px) of the screen, i.e. y ∈ [166, 270] at the 480×270 game
resolution — which contains y=180, exactly where the hint sits. It was
never hidden while dialogue (or the inventory menu) was open, so it sat
on top of — or under, depending on z-order — the new ▲/✓/▼ column added
in v7.

Fixed by having `addActionButtonHint()` return its container so
`ZoneScene` can toggle it: hidden whenever `inventoryMenu` is set,
`dialogue.isOpen`, or `inputLocked` is true (every one of `update()`'s
early-return branches, plus `openInventory()` itself for an immediate
hide rather than waiting a frame), shown again once none of those hold.

## `TouchListButtons`: one reusable ▲ / ✓ / ▼ component

Extracted from `DialogueBox`'s v7 button-drawing code into
`src/game/ui/touch.ts` as `TouchListButtons` — a small class taking a
scene and a local `(x, top, size?, gap?)`, exposing `.container` (add it
into the caller's own container), `.setVisible()`, and
`.hitTest(localX, localY): "up" | "confirm" | "down" | null`. Every
consumer hit-tests it manually inside their existing `tapAt()`/`tapMenu()`
pointerdown handler — same pattern as the row/close-button hit-testing
already in `PerkMenu` and `InventoryMenu`, not Phaser's per-object
interactivity.

The confirm button is drawn as a checkmark via `Graphics` (two short
line segments), not the Unicode "✓" glyph — the glyph rendered as a
bare, broken diagonal stroke (missing its short left leg) in at least
one monospace font fallback, illegible at this size. Graphics guarantees
the same shape everywhere. The ▲/▼ arrows stay as text glyphs, which
render fine.

Rolled out everywhere a player must move a selection and confirm it:

- `DialogueBox` — updated from its own inline v7 button code to use the
  shared component (behavior unchanged, "A" glyph → checkmark graphic).
- `PerkMenu` — a touch-only ▲/✓/▼ column beside the perk list. Tapping a
  row still equips immediately (unchanged, one-step); the column is an
  *additional* safer path (move, then confirm) for a choice that can't
  be undone.
- `InventoryMenu` — a touch-only column next to the item rows; ✓ toggles
  equip on the selected row, same as SPACE/ENTER.
- `BattleScene`'s action/target menu panel — widens from 130px to 160px
  on touch to make room for the column; both submenus (`actions` and
  `targets`) get it, since choosing an attack and then a target are both
  tap-a-row-in-a-list moments.

## The overflow bug this rollout hit twice

Both `BattleScene` and `InventoryMenu` size their panel/button-column
position off the number of list items — and both are cases where the
list can be *shorter* than the fixed-size 3-button column (battle: as
few as 2 commands early on; inventory: 1-2 items, always). Centering the
button column within the list's height with an unclamped
`(listH - btnColH) / 2` goes **negative** when the list is shorter than
the column:

- In `BattleScene`, the panel's own height was computed from the list
  alone, so a negative offset pushed the column below the panel's
  bottom edge — off the panel, and in the worst case (a very short list)
  off the visible canvas entirely, silently eating every tap aimed at
  it. Fixed by sizing the panel to `max(listHeight, buttonColumnHeight)`
  instead of list height alone.
- In `InventoryMenu`, the panel is already generously sized (it has a
  detail pane below the list), so the negative offset couldn't push
  buttons off-canvas — but it did push them up into the title/close-
  button row, visually broken. Fixed by clamping the offset to `max(0,
  ...)` instead of letting it go negative.

Lesson generalized in the `TouchListButtons` rollout: any caller with a
variable-length list must size its own layout against
`max(listHeight, buttonColumnHeight)`, not list height alone — a fixed
3-button column doesn't shrink with a short list.

## New touch-e2e.mjs coverage

Extended `tools/smoke/touch-e2e.mjs` (`npm run smoke:touch`) to walk a
full conversation to its end using only the ▲/✓/▼ column (no row taps),
triggering the tutorial battle, then exercises the battle's own
touch column: moving the actions-menu selection, confirming an attack,
and confirming a target — the exact scenario that caught the overflow
bug above (the tutorial battle's 2-item Attack/Guard list is shorter
than the button column).

# v9: The Open Desert — a small FF3/FF6-style overworld POC

A proof of concept for the "Part 2 open world" style planning in
`docs/STORY_PARTS2-4.md`, scaled way down: one tiny world-map zone
between two existing focused zones, not a real second world layer.
Additive only — the existing crash → oasis → trail → mine path is
completely unchanged; this is a second, optional route between the
oasis and the mine.

## Two new zones

- **`overworld`** (`src/game/maps/overworldMap.ts`, `OverworldScene.ts`)
  — 16×20 tiles, almost entirely solid mountain, with a single winding
  3-tile-wide pass (a 6-waypoint spine, linearly interpolated per row,
  giving a gentle S-curve rather than a straight corridor) connecting
  exactly two stops: a south clearing (the wash/spring + the overturned
  truck, flavor only — the literal spring is still the oasis's) exiting
  back to `oasis`, and a north clearing (mine-mouth timber framing + an
  abandoned cart) exiting into `mineEntrance`. `encounterZone:
  "overworld"` gives it its own `ENCOUNTERS` table (scarab/jackrabbit/
  buzzard/gila, same roster flavor as the Trail).
- **`mineEntrance`** (`mineEntranceMap.ts`, `MineEntranceScene.ts`) — a
  small 10×10 vestibule screen between the overworld and Cinnabar Mine
  proper: ground fades from sand to mine floor as you approach a
  timber-framed threshold. Sealed until `flags.mineOpen` (Dusty's flag
  from the Trail) — exactly the Trail's own grate-closed pattern, not a
  second way to unlock the mine, just a second door onto the same one.
  Walking to the threshold before `mineOpen` shows a "shored up tight"
  hint and blocks; after, it hands off to the existing `mine` zone at
  the same `MINE_SPAWN` the Trail already uses — `MineScene` itself is
  completely untouched.

## Wiring into the existing world

`OasisScene` gains a new `OASIS_NORTH_EXIT` (its north border was the
only side without a gate) leading to `overworld`, reciprocated by
`overworld`'s own south exit back to `OASIS_NORTH_SPAWN`. `ZoneId`,
`radioLines`, and `BootScene`'s `ZONE_NAMES` (all exhaustive
`Record<ZoneId, …>` types) gained entries for both new zones — TypeScript
enforced every one of these; nothing here is optional or forgettable.

## Eight new mountain tiles (`tileset2.ts`)

The overworld's "everything blocked by mountains" terrain originally
reused the existing `rock` tile (a small boulder prop) densely — this
read as a boulder field, not a mountain range. Replaced with a purpose-
built `mountainRidge(seed, phase)` generator: diagonal shingled bands
(lit face / shade transition / deep shadow, desert palette) rather than
a scattered prop, closer to the FF6 world-map reference's ridge look.
Needed **eight** variants, not two, because `composeSheet` requires the
frame count to exactly fill an 8-column grid — `tileset2.ts` grew from
24 tiles (3 rows) to 32 (4 rows), appended after every existing tile so
none of their indices moved. The determinism hash for `tiles2.png` was
deliberately re-pinned in `tests/pipeline/determinism.test.ts` to match
— extending a tileset is exactly what re-pinning is for, so long as it's
purely additive (verified: `manifest.tiles2.names` keeps every original
entry at its original index, only appending 24–31).

## A real bug this surfaced: hardcoded tileset firstgids

`ZoneScene.tileGid()`/`buildMap()` combine the three tilesets into one
virtual global tile-ID space for Phaser's tilemap system, and previously
hardcoded the offsets as *(tiles: 0, tiles2: 16, tiles3: 40)* — 40 being
`16 (tiles.png count) + 24 (the old tiles2.png count)`, baked in as a
magic number. The moment `tiles2.png` grew to 32 tiles, tiles3's real
offset should have become 48, but the hardcoded 40 didn't move — so
every tiles3 (Act 2 ice) tile silently aliased onto whatever now sat at
`tiles2` indices 24–31 (the new mountain tiles), and the overworld's
mountains rendered as Act 2 ice-cave art instead (the two tilesets'
declared GID ranges now overlapped). Fixed by computing both firstgids
from each tileset's actual tile count (`Object.keys(MANIFEST.tiles.names
).length`, etc.) instead of hardcoding them, so this class of bug can't
recur the next time any tileset grows. Caught by visual screenshot
review, not by any existing test — the map-data tests only validate tile
*names* and solidity, never which pixels a name resolves to.

---

# v10: true SNES-Mode-7 perspective terrain for the overworld

The Open Desert (v9) is now rendered as a real Mode-7 perspective ground
plane — sky above a horizon line, a flat painted map receding obliquely
into the distance below it — instead of the flat top-down tilemap every
other zone uses. This affects **`OverworldScene` only**. Crash, oasis,
shed, trail, mine, depths, crevasse, maze, galleries, sanctum, the mine
entrance and battle all render exactly as before; nothing in the shared
`ZoneScene` render path changed, and this section is purely a rendering
swap — movement, collision, exits, triggers and encounters still run in
ordinary tile-grid space, unchanged.

## What Mode 7 is (and what it deliberately isn't)

Mode 7 (FF6's world map, F-Zero) paints **one flat 2D texture** as a
ground plane seen from a fixed pitch. There is no heightmap and no 3D
geometry: the "mountains" are just the same shaded 2D ridge art from v9,
viewed obliquely. Per screen pixel below the horizon we invert the
perspective to find the ground point it looks at. The camera is
**north-up and never rotates** (FF6-faithful) — walking turns the player
sprite but not the world; rotation was intentionally left out of this v1
as it's not needed for a correct, well-scoped result. The player is a
normal fixed 2D sprite drawn on top, not part of the transform.

## The math (`src/core/mode7.ts`, pure + unit-tested)

Engine-agnostic, no Phaser import, like every other `src/core/*.ts`.
`projectGround(cam, sx, sy)` is the inverse-perspective core. With the
horizon at screen-Y `H` and a pixel `p = sy − H` scanlines below it:

```
depth = min(cameraHeight * focal / p, maxDepth)      // forward distance
right = (sx − screenW/2) * depth / focal             // lateral offset
worldX = camX + right
worldY = camY − depth                                // −y == north == "forward"
```

As `p → 0` (approaching the horizon) `depth → ∞`, so it's **clamped to
`maxDepth`** and the horizon maps to a finite far point rather than
infinity; pixels *on or above* the horizon return `null` (that's sky,
no ground). Larger `p` (nearer the bottom) → smaller `depth` → the
ground point is closer to the camera and each pixel steps further across
the texture — the classic "stretched at the horizon, magnified up close"
look. `makeCamera()` builds the camera from the player position and the
exported constants; the GLSL fragment shader re-implements the identical
formula, fed these same constants as uniforms so there's one source of
truth. Fully covered by `tests/core/mode7.test.ts` (horizon → clamped
maxDepth, bottom → near, center column dead-ahead, symmetric spread,
monotonic depth, predictable translation under camera moves,
determinism, UV clamping).

### Constants and why these values (desert-overworld defaults)

- `MODE7_HORIZON_FRACTION = 0.42` — horizon 42% down the 270px screen
  (~113px). Leaves a generous ground band while keeping room for the
  dusk sky + ridge silhouette.
- `MODE7_FOCAL_LENGTH = 160` (screen px) — 2/3 of the 240px half-width,
  a natural ~74° horizontal FOV / moderate pitch. Larger = flatter,
  narrower; smaller = steeper, wider.
- `MODE7_CAMERA_HEIGHT = 24` (world px, 1.5 tiles) — eye height above
  the plane. Low enough that near tiles loom large, high enough to see a
  fair distance ahead.
- `MODE7_MAX_DEPTH = 640` (world px) — the horizon-distance clamp. Past
  the 256×320px map this lands on the edge tiles (see edge-clamp below),
  which reads correctly as far mountains.
- `MODE7_CAMERA_BACK = 32` (world px) — the camera sits this far *behind*
  (south of) the player so the player's own tile appears a little up
  from the very bottom edge instead of directly under (and off) the
  camera; keeps the fixed avatar visually standing on its own terrain.

## The ground texture (`src/game/gfx/Mode7Ground.ts`, presentation)

At `OverworldScene` create, `buildOverworldMap()`'s ground+decor grids
are painted **once** into an offscreen `CanvasTexture` (256×320px = the
16×20 tile map at 16px/tile) via `CanvasTexture.drawFrame` from the
already-loaded `tiles`/`tiles2`/`tiles3` spritesheets — ground first,
then decor on top, so mountains/water/props all bake into one flat
top-down "map image". No art is regenerated through the Node pipeline at
runtime; this only composes textures Phaser already has. That canvas is
the `iChannel0` sampler the shader reads.

## The shader path (Phaser `GameObjects.Shader`, WebGL)

Rendered with a full-screen `Phaser.GameObjects.Shader` quad (Phaser
3.87's idiomatic "custom fragment shader on a quad with a sampler2D"
API) at `scrollFactor 0`, depth `-100`, covering 480×270. Chosen over a
`PostFXPipeline` because PostFX runs *after* the scene is drawn and would
have to key the player sprite back out of its own output to composite;
a background quad lets ordinary sprites (the avatar, HUD, dialogue) draw
on top in normal display-list order with zero compositing tricks. The
one shader draws **both** halves: below the horizon it inverse-projects
and samples the ground texture; above it, a vertical dusk gradient
(`indigo` → `amber`, from `PALETTE`) plus a **static** distant ridge
silhouette (summed sines, `mauve`, deterministic — no `Math.random`).
Far ground is hazed toward the horizon `amber` to hide the clamp seam.

- **UV addressing: edge-clamp** (`clamp(uv, 0, 1)`), not wrap. The desert
  is a walled mountain pass, so sampling past an edge holding the border
  mountains is thematically right — and it's also required for
  correctness here: the 320px map height is non-power-of-two, and `REPEAT`
  on an NPOT texture is illegal in WebGL1 (would render black). The
  sampler is uploaded `flipY:false` + `NEAREST` (crisp SNES pixels) via
  the Shader's `textureData`.
- Each frame `Mode7Ground.update(player.x, player.y)` pushes fresh
  `uCamX`/`uCamY`/`uHorizon` uniforms; the **camera world position tracks
  the player**, so the plane scrolls and reveals under the fixed avatar
  instead of a `Camera` scrolling a tilemap.

## Player representation

The real physics player sprite stays the source of truth for
position/collision/exits/encounters (and for the smoke test's
`w.player.x/y` + `body.reset` teleports) — it's just made invisible. A
separate fixed-screen **avatar** (the same `hero` sheet + shared
walk/idle anims, `scrollFactor 0`, horizontally centered, feet ~66% down
the ground band, scale 2.5) mirrors the player's current animation each
frame. Input still updates the real player's continuous world position
exactly as `ZoneScene.update()` always did.

## Fallback safety

`OverworldScene.setupMode7()` no-ops on a non-WebGL renderer and wraps
shader/texture creation in try/catch: on any failure it `console.warn`s,
tears down anything half-built, re-shows the flat tilemap + real player,
and the zone renders identically to every other zone. It degrades, never
throws. (The smoke playthrough's "no page errors" check exercises this:
whichever path the headless renderer takes, the scene must not crash.)

## Integration footprint

`ZoneScene.ts` was **not** touched — `OverworldScene` does everything
from its existing `populate()`/`onUpdate()` hooks using already-protected
members (`player`, `groundLayer`, `decorLayer`, `cfg`, `facing`), so the
diff against the shared base class is zero. New files: `src/core/mode7.ts`,
`tests/core/mode7.test.ts`, `src/game/gfx/Mode7Ground.ts`; changed:
`src/game/scenes/OverworldScene.ts` only.

# v11: small rooms (the shed, the mine entrance) render centered, not pinned to a corner

Any zone whose full map is smaller than the 480×270 viewport in both
dimensions — the shed (256×192px), the mine entrance (160×160px), and
any future one like them — used to render pinned to the top-left corner
with dead ink-colored space along the right/bottom edges, because the
camera was always set up to `startFollow(player)` against
`setBounds(0, 0, mapW, mapH)`.

The natural-looking fix, `cameras.main.setBounds(0, 0, mapW, mapH,
true)` (Phaser's own "center on these bounds" flag) or a manual
`centerOn()` call, does not actually work here: Phaser's bounds-clamping
logic re-clamps the scroll every time it runs (including immediately
after a manual `centerOn()`), and for bounds smaller than the viewport it
resolves that clamp to `(0, 0)`, not centered — so the pinned-corner bug
survives even a `centerOn()` call as long as `setBounds()` is also
active.

Fixed in `ZoneScene.create()`: when a room's full map fits within the
viewport on both axes, skip `setBounds()`/`startFollow()` entirely and
call `setScroll((mapW − viewportW) / 2, (mapH − viewportH) / 2)` once —
with no bounds set, there is nothing left to re-clamp it. Larger zones
(oasis, trail, mine, ...) are unaffected: they still get
`setBounds()` + `startFollow()` exactly as before. Verified by reading
`camera.scrollX/scrollY` directly in a headless Playwright check (shed:
`(-112, -39)`; mine entrance: `(-160, -55)` — both match the hand-computed
centering values) and by screenshot.

---

# v12: Act 3 — The Sunless Sea (fish, the fishing minigame, a fourth tileset)

> **Superseded in part by v14.** The single-`sunlessSea`-zone structure and
> the end-card hand-off described below were the shipped v12 build; **v14
> retrofits Act 3 into a six-zone chain** and replaces the end card with a
> real ascent-zone exit. The fishing minigame, the `tiles4` art, the
> bestiary/encounter entries and the fishing-flow bring-up notes here are
> all still current — only the zone topology and the fishing PACING (cast
> first, THEN the Lurker steals the line) changed. Read v14 for the current
> Act 3 shape.

Act 3 of Part One. Joseph and Slither follow the crack Piggy vanished
through (`flags.act2Complete`) under the glacier into a bioluminescent
cavern ocean: mint-glow reefs, kelp forests, drifting ice floes over dark
water. One new zone (`sunlessSea`) carries every beat — the comic chase, a
Fluffball glimpse, a flooded sun-temple ruin, and a fishing minigame gated
by a mini-boss — and ends on the Act 4 card. Additive only; nothing in
Acts 1–2 changed except the Act-2-ending wiring (below).

## The Act 2 → Act 3 hand-off (the one Act-2 change)

`SanctumScene`'s end card no longer `resetGame()`s back to the title. Its
"SPACE — follow the crack" now `scene.start("sunlessSea")` keeping all
progress and setting `flags.act3Started` — exactly the Act 1 → Act 2
pattern (`DepthsScene` → crevasse). The sanctum's epilogue branch (a
reload landing on the already-cracked lake) also gains a descend trigger
at the tunnel the penguins dove through, so a reload can't soft-lock Act 3.
The keyboard smoke's old "act 2 end card returns to the title" check became
"…dives into the Sunless Sea with progress kept".

## New zone: `sunlessSea` (`sunlessSeaMap.ts`, `SunlessSeaScene.ts`)

40×28, `encounterZone: "sunlessSea"`, `battleBg: "ice"`. **Floe-hopping
traversal is pure tile-grid**, not new physics: the map is filled with
SOLID `seaWater`, and walkable `floe`/`floe2` tiles are carved through it
as hop-corridors (same solid/walkable convention as every prior zone;
`seaWater`/`seaWater2` and the sea decor solids were added to
`SOLID_TILE_NAMES`). Themed walkable floors — `kelpBed`, `reefGlow`,
`templeFloor`, `templeGlyph` — mark the beats; `kelpStalk`/`coral`/
`templePillar`/`mossRock` are solid walk-arounds; `bubbles` is the one
OVERHEAD tile. A reef room gives a **second (loop) route** from the hub to
the deep bed (BFS-verified: blocking the east-corridor mouth alone does not
cut off the fishing spot). Beats:

- **The chase** (walk-over trigger, `sawChase`): Piggy is spotted playing
  tag with a small gray shape out on the ice; two cosmetic penguin sprites
  skate off and vanish; `piggyChase` dialogue lands the joke ("Fassster in
  water than you"). No minigame.
- **Fluffball, glimpsed** (`metFluffball`): a one-time trigger in a
  dead-end kelp bed. Fluffball speaks **exactly one line** (the silverfin
  clue), then bolts (tween-away + destroy). Cul-de-sac is BFS-proven:
  solidifying its single entrance tile makes the bed unreachable. He does
  **not** join here (that's Act 5).
- **The flooded sun-temple** (`sawTemple`): an `InteractPoint` on a carved
  `templeGlyph` amid submerged `templePillar`s; `templeLore` establishes
  "the desert was hiding an ecosystem, not treasure."
- **The fishing spot** (`InteractPoint` at the deepest kelp bed): first
  interaction → `lurkerIntro` → **the Lurker** mini-boss (a real
  `BattleScene` fight, `victoryFlag: "lurkerDefeated"`, party = hero +
  Slither). After it's beaten off → `fishingCast` choice ("Cast the line"
  / "Not yet") → the timing minigame. Landing the catch sets
  `items.silverfin` + `flags.silverfinCaught`, then the `act3Ending`
  dialogue and the end card (→ title; Act 4's zone is a teammate's next
  task). Slither trails the player as a world follower throughout (same
  trail rig as the galleries/sanctum).

## The fishing minigame (`src/core/fishing.ts`, pure + unit-tested)

Engine-agnostic like `atb.ts`: a marker slides 0..1, bouncing off both
ends (`tickFishing(state, cfg, dt)` — no `Date.now`/`Math.random`, time is
a parameter); `hookFishing(state, cfg)` registers a tap — inside
`[target ± windowHalf]` is a hit (lands after `requiredHits`), outside is a
miss (snaps the line after `maxMisses`). `DEFAULT_FISHING` = speed 0.9,
target 0.5, windowHalf 0.14, 3 hits / 5 misses. Fully covered by
`tests/core/fishing.test.ts` (bounce reflection incl. multi-bounce steps,
window edges, landing/snapping, no-op once resolved, determinism). The
thin Phaser UI is `src/game/ui/FishingMenu.ts` — a gauge with the glowing
target band, a marker, hit pips, and a HOOK button; it self-manages its
own `UPDATE`/keydown/pointerdown listeners (like PerkMenu/InventoryMenu)
and hooks on SPACE or any tap. **The pre-cast choice list uses the
existing `DialogueBox`** (hence `TouchListButtons`); the hook action is a
single confirm, not a list — consistent with battle/dialogue tap handling.
A subtlety fixed during bring-up: the ending must set `inputLocked = false`
before opening its dialogue (a locked scene never forwards confirm to the
box — same rule the Act 1/2 endings already follow), and the winning tap
stays input-locked straight through to the ending so it can't also refire
the fishing InteractPoint on the next frame.

## New art (`tools/pipeline/`, palette-locked, sha256-pinned)

- **`tiles4.ts`** — 16 sea tiles (2 rows × 8, exact `composeSheet`
  column-multiple discipline). Contract order: `seaWater seaWater2 floe
  floe2 floeEdge kelpBed reefGlow templeFloor` / `kelpStalk coral
  templePillar templeGlyph anemone seaSparkle bubbles mossRock`. `floe`
  (bright bone/skyBlue) reads clearly walkable against the dark
  `seaWater` (tealDeep/indigo with mint plankton glints); `bubbles` is the
  only non-opaque (overhead) tile. Manifest gains a top-level `tiles4`
  entry shaped like `tiles`/`tiles2`/`tiles3`.
- **Three enemy sheets** — `anglerfish` (24×24, lure esca), `reefeel`
  (24×24, undulating eel) and `lurker` (32×32 mini-boss, stolen lure in
  its jaw), all side-on facing LEFT (the battle scene flips enemies) with
  the standard idle[0,1]/move[2..5] layout.

`tiles4`/`anglerfish`/`reefeel`/`lurker` are appended after every existing
sheet — **no prior sheet's bytes change** (the pre-Act-2 frozen hashes
still hold), and the four new hashes are pinned in
`tests/pipeline/determinism.test.ts` ("act3 asset byte-stability").

## The 4th-tileset firstgid (extending the v9 dynamic-offset fix)

Adding a fourth tileset is exactly the case CONTRACTS v9 warned about.
`ZoneScene` now derives `TILES4_FIRSTGID` the same way as the others —
`tiles1+tiles2+tiles3` counts from `MANIFEST.*.names` lengths, never a
hardcoded magic number — and `buildMap()` registers a fourth
`addTilesetImage("t4", "tiles4-img", …, TILES4_FIRSTGID)`. Screenshot
review confirmed the sea renders with its own art (no aliasing onto the
ice/mountain GID ranges).

## Core / plumbing (same checklist as every prior zone addition)

- `gameState.ts`: `ZoneId += "sunlessSea"`; new `ACT3_FLAGS`
  (`act3Started, sawChase, metFluffball, sawTemple, lurkerDefeated,
  silverfinCaught, act3Complete`) init false in `newGame()`;
  `items.silverfin: boolean` (init false).
- `bestiary.ts`: `anglerfish` (30/12/4/12, xp 22), `reefeel` (26/13/3/17,
  xp 24), `lurker` (150/15/7/10, xp 90).
- `encounters.ts`: `ENCOUNTERS.sunlessSea` (anglerfish/reefeel groups,
  weights [3,3,2,2]); the `Record` key union widened to six zones.
- `objective.ts`: an Act 3 chain (gated on `act3Started` so "Act 2
  complete!" survives until the crack is followed); every line ≤ 40 chars.
- `scripts/radio.ts`: exhaustive `radioLines` gains `sunlessSea`.
- Six new dialogue scripts (`piggyChase, fluffballMeet, templeLore,
  lurkerIntro, fishingCast, act3Ending`), all `validateScript`-clean, ≤ 48
  chars/line, Slither hissing where he speaks — covered by
  `tests/core/scriptsAct3.test.ts` (incl. Fluffball speaks exactly once,
  fishingCast's `cast-end`/`leave-end` terminals, act3Ending's Act 4 card).
- `BootScene` `ZONE_NAMES` + preload (`tiles4` and the three sheets);
  `main.ts` registers `SunlessSeaScene`.
- `tests/game/maps2.test.ts`: full BFS suite for `sunlessSea` (enclosure,
  landmark reachability, the cul-de-sac, the loop route, themed floors);
  `KNOWN_NAMES` gains `tiles4`.
- `tools/smoke/e2e.mjs`: plays Act 3 end-to-end (chase, Fluffball, temple,
  Lurker fight, cast + land the silverfin by reading the pure fishing
  state and only hooking inside the window, ending → title). 76 checks.
- `tools/smoke/touch-e2e.mjs`: touch coverage of the fishing flow — tap the
  InteractPoint, confirm the cast choice with the ✓ column, tap HOOK inside
  the glow to land the catch. 18 checks.

---

# v13: Act 4 — Dirty Laundry (the miners' camp, midden mites, the "reeks" item)

> **Superseded in part by v15.** The single-`minersCamp`-zone structure below
> was the shipped v13 build; **v15 retrofits Act 4 into a five-zone chain** (the
> exact same fix Act 3 got in v14) — `minersCamp` becomes the entry outskirts
> and the beats redistribute across a camp-proper hub, the laundry-nook nest
> pocket, a back-gallery climb and Fluffball's overlook ledge. The midden-mite
> art, the `tiles5` art, the `middenmite` bestiary/encounter entries, the
> "reeks" mechanic (`REEK_AVERSE`/`reekAdjusted`, `encounterTable()` hook) and
> the dialogue scripts here are all still current — only the zone topology and
> where each beat lives changed. Read v15 for the current Act 4 shape.

Act 4 of Part One. Joseph and Slither climb back up through the tunnels to
where Mo, Edda and Gus — rescued in Act 2 — now actually live: a scrappy home
built into an abandoned Cinnabar gallery, strung with lights and a laundry
line. One new zone (`minersCamp`) carries every beat: the comic crate chase,
a Fluffball ledge glimpse (clue #2), a favor-quest fight against a nest of
midden mites, and the reward — the ripest, reekiest socks in camp, which
become a real inventory item that changes how NPCs and some enemies react.
Ends on the Act 5 card. Additive only; nothing in Acts 1–3 changed except the
Act-3-ending wiring (below).

## The Act 3 → Act 4 hand-off (the one Act-3 change)

`SunlessSeaScene`'s end card no longer returns to the title. Its "SPACE —
up through the tunnels" now `scene.start("minersCamp")` keeping all progress
and setting `flags.act4Started` — exactly the Act 2 → Act 3 pattern (sanctum
→ sunlessSea). The sea's populate() also gains a reload-safe epilogue trigger
at the north overlook: if a reload lands on the finished act (`act3Complete`
but `!act4Started`), walking back to the crack the party dropped through
climbs up to the camp, so a reload can't soft-lock Act 4. The keyboard
smoke's old "act 3 end card returns to the title" check became "…climbs into
the Miners' Camp with progress kept".

## New zone: `minersCamp` (`minersCampMap.ts`, `MinersCampScene.ts`)

32×20, `encounterZone: "minersCamp"`, `battleBg: "mine"`. A warm central hall
(the miners around a stove on a woven rug, string lights and a laundry line
overhead) reached from the north tunnel mouth. Fully **enclosed** by solid
`campWall` — no zone exits, the act ends on a card (Act 5's zone is a
teammate's next task). Beats:

- **The crate chase** (walk-over trigger, `sawCrateChase`): Piggy is caught
  sniffing the supply crates in the NE; a cosmetic penguin burrows into the
  crate stack and pops out the far side; `crateChase` dialogue. No minigame.
- **Fluffball, glimpsed** (`fluffballLedge`): a one-time trigger in the NW.
  He speaks **exactly one line** (clue #2 — the RIPEST socks, not just any
  socks), then bolts (tween-away + destroy). He does **not** join here
  (that's Act 5), same glimpse-and-flee structure as Act 3's `fluffballMeet`.
- **The favor-quest**: the three miners (NPCs, `minersFavor`) will trade the
  socks only once a nest of **midden mites** is cleared out of the laundry
  nook. The nook is a BFS-proven **cul-de-sac** in the SW behind one entrance
  tile (`CAMP_NOOK_ENTRANCE`) — the nest and the sock line both live inside
  it, so the whole quest happens in one sealed room. An `InteractPoint` on
  the nest (`CAMP_NEST`) → `nestIntro` → a real `BattleScene` fight against a
  swarm of **four** midden mites (`victoryFlag: "middenCleared"`). No new AOE
  combat mechanic — a swarm of several low-HP, low-defense enemies is
  "AOE-rewarding" purely by encounter design; the existing single-target
  commands clear them fast, and `makeEnemyParty()` already names duplicates
  (Midden Mite A/B/C/D).
- **The socks** (`InteractPoint` at `CAMP_SOCKS`, gated on `middenCleared`):
  first use → `minersReward` → sets `items.stinkySocks` + `flags.gotSocks`,
  then the `act4Ending` dialogue and the end card (→ title). Slither trails
  the player as a world follower throughout (same trail rig as Act 3).

## The "reeks" item and its concrete, testable effects

`items.stinkySocks: boolean` (init false in `newGame()`). Carrying the socks
has two held-item-dependent effects, one presentation and one pure/tested:

- **NPC reaction**: talking to a miner while the socks are held swaps their
  line to `minersReek` ("that SMELL… stand downwind"), distinct from the calm
  camp chatter — the scene's `minerScript()` branches on `items.stinkySocks`.
- **Encounter avoidance** (pure, unit-tested): `encounters.ts` gains
  `REEK_AVERSE` (currently `frostscarab`) and `reekAdjusted(table)`, which
  returns a copy with every reek-averse group's weight cut to 1 (mites, drawn
  TO the smell, keep their weight — and are deliberately absent from the
  averse set). `ZoneScene` gains an overridable `encounterTable()` hook
  (defaults to `ENCOUNTERS[zone]`); `MinersCampScene` overrides it to apply
  `reekAdjusted` while the socks are held, so frost scarabs give the stinking
  party a wide berth. Deliberately the minimal "reeks" system the story doc
  anticipates — not a general status-effect engine.

## New art (`tools/pipeline/`, palette-locked, sha256-pinned)

- **`middenmite`** sprite — 16×16, the standard idle[0,1]/move[2..5] layout;
  a deliberately tiny (~half-tile) mauve/rust pest with a single amber
  eye-glint and thin ink legs, so a nest of them reads as small and numerous.
  `BESTIARY.middenmite` = 9/6/1/13, xp 6, scale 2 (small).
- **`tiles5.ts`** — 16 miners'-camp tiles (2 rows × 8, exact `composeSheet`
  column discipline). Contract order: `campFloor campFloor2 campRug campWall
  crate crateStack barrel washtub` / `bedroll stove campPost sockBasket
  frostPrint crateOpen stringLights laundryLine`. The warm plank `campFloor`
  reads clearly brighter than the solid `campWall`; `crate/crateStack/barrel/
  washtub/stove/campPost/crateOpen` are solid walk-arounds; **`stringLights`
  and `laundryLine` are the two OVERHEAD tiles** — transparent background,
  drawn above the actors. Manifest gains a top-level `tiles5` entry.

`middenmite`/`tiles5` are appended after every existing sheet — **no prior
sheet's bytes change** — and the two new hashes are pinned in
`tests/pipeline/determinism.test.ts` ("act4 asset byte-stability").

## The 5th-tileset firstgid (extending the v9 dynamic-offset fix)

Adding a fifth tileset is the v9/v12 case again: `ZoneScene` derives
`TILES5_FIRSTGID` from the prior tilesets' `MANIFEST.*.names` counts (never a
hardcoded magic number) and `buildMap()` registers a fifth
`addTilesetImage("t5", "tiles5-img", …, TILES5_FIRSTGID)`. `tileGid`/
`tileFrame` gain a fifth branch. Screenshot review confirmed the camp renders
with its own art and the dialogue box (depth 5500) draws cleanly over the new
overhead string-lights/laundry decor (depth 5000) — no reintroduction of the
overhead-over-dialogue bug fixed before Act 3.

## Core / plumbing (same checklist as every prior zone addition)

- `gameState.ts`: `ZoneId += "minersCamp"`; new `ACT4_FLAGS` (`act4Started,
  sawCrateChase, fluffballLedge, middenCleared, gotSocks, act4Complete`) init
  false in `newGame()`; `items.stinkySocks: boolean` (init false).
- `bestiary.ts`: `middenmite` (9/6/1/13, xp 6, scale 2).
- `encounters.ts`: `ENCOUNTERS.minersCamp` (midden-mite swarms + a frost
  scarab, weights [3,3,2,2]); the `Record` key union widened to seven zones;
  `REEK_AVERSE` + `reekAdjusted()`.
- `objective.ts`: an Act 4 chain (gated on `act4Started` so "Act 3 complete!"
  survives until the tunnels are climbed); every line ≤ 40 chars.
- `scripts/radio.ts`: exhaustive `radioLines` gains `minersCamp`.
- Six new dialogue scripts (`crateChase, fluffballLedge, minersFavor,
  minersReward, minersReek, act4Ending`), all `validateScript`-clean, ≤ 48
  chars/line, Slither hissing where he speaks — covered by
  `tests/core/scriptsAct4.test.ts` (incl. Fluffball speaks exactly once,
  act4Ending's Act 5 card).
- `BootScene` `ZONE_NAMES` + preload (`tiles5` and the `middenmite` sheet);
  `main.ts` registers `MinersCampScene`.
- `tests/game/maps2.test.ts`: full BFS suite for `minersCamp` (enclosure,
  landmark reachability, the laundry-nook cul-de-sac, themed floors, overhead
  non-solidity); `KNOWN_NAMES` gains `tiles5`.
- `tests/pipeline/act4.test.ts`: layout/palette/legibility for `tiles5` +
  `middenmite` (warm floor vs dark wall, overhead transparency, the small
  pest silhouette).
- `tools/smoke/e2e.mjs`: plays Act 4 end-to-end (crate chase, Fluffball
  ledge, the favor-quest, the midden-mite swarm fight, the sock reward, the
  reek-adjusted encounter table, ending → title).
- `tools/smoke/touch-e2e.mjs`: touch coverage of the new nest InteractPoint
  (tap-to-interact with no NPC nearby opens the intro dialogue).

---

# v14: Act 3 retrofit — The Sunless Sea becomes a six-zone chain

Playtester feedback on the shipped v12 Act 3 ("act 3 is only 1 map? those
should be 4-6 maps"; "scene 3 fights the boss before fishing mini game";
"dialogue feels ungrounded") drove a structural retrofit that brings Act 3
up to the Act 1/2 quality bar (connected zones, each a distinct place with
grounding entry dialogue, dead-end pockets as true BFS cul-de-sacs). **No
new art, bestiary, encounter or fishing-core changes** — this reuses every
v12 asset and the `sunlessSea` encounter table; it only re-shapes zones,
scenes, wiring and the Lurker/fishing pacing. Additive to Acts 1/2/4 except
the Act-3-internal wiring and the ascent→camp hand-off (below).

## The six zones and how they connect

The single `sunlessSea` map is replaced by six connected zones. `sunlessSea`
is **kept as the id of the entry zone** so the Act 2 → Act 3 hand-off in
`SanctumScene` (`scene.start("sunlessSea")` / `goToZone("sunlessSea",
SEA_SPAWN)`) is unchanged; `SEA_SPAWN` is still exported from
`sunlessSeaMap.ts`.

1. **`sunlessSea`** (entry overlook, 24×16) — first sight of the cavern sea;
   the comic **Piggy-chase** beat (`piggyChase`, `sawChase`) plays here.
   South gate → `kelpForest`.
2. **`kelpForest`** (traversal, 40×26) — the through-route. A hub with a
   **true fork east** to the deep bed: routes A (y=12) and B (y=15) are
   vertex-disjoint (`KELP_PINCH_A/B` — block one, the other survives; block
   both, the deep-bed exit is cut off), plus a false-lead dead-end alcove.
   Four gates: north back to `sunlessSea`, **west spur → `sunTemple`**,
   **south spur → `fluffballBed`** (both spurs BFS-proven cul-de-sacs behind
   `KELP_TEMPLE_ENTRANCE` / `KELP_FLUFF_ENTRANCE`), east fork → `deepBed`.
   Entry beat `kelpForestEntry` (`sawKelpForest`).
3. **`sunTemple`** (dead-end pocket, 22×16) — the flooded sun-temple, now a
   few rooms (antechamber → pillared hall → inner sanctum). Entry beat
   `sunTempleEntry` (`sawTempleEntry`); the carved `templeGlyph` is an
   InteractPoint that plays `templeLore` (`sawTemple`). East gate back to
   `kelpForest`; otherwise enclosed (a cul-de-sac ZONE).
4. **`fluffballBed`** (dead-end pocket, 18×14) — the glimmering kelp bed
   where Fluffball is cornered. Entry beat `fluffballBedEntry`
   (`sawFluffbed`); the glimpse trigger plays `fluffballMeet` (`metFluffball`)
   and he bolts. North gate back to `kelpForest`.
5. **`deepBed`** (fishing climax, 28×20) — past where the light gives out.
   Entry beat `deepBedEntry` (`sawDeepBed`). **The pacing fix lives here**
   (see below). West gate back to `kelpForest`; the way onward is opened
   narratively once the fish is landed (the scene hands off to `seaAscent`),
   so the map is otherwise enclosed.
6. **`seaAscent`** (ascent/exit, 20×18) — the narrated way OUT (an old
   miners' service ladder, answering the never-explained "how do I get off
   the ice?"). Entry-ledge beat `seaAscent` (`sawAscent`); the **top gate is
   the Act 3 → Act 4 hand-off** (a real zone exit, not an end card): a
   trigger sets `act4Started` and `goToZone("minersCamp", CAMP_SPAWN)`.

## The Lurker/fishing pacing fix (the "boss before the mini game" bug)

The shipped v12 walked the player straight into the Lurker fight with no
cast-first beat. Now, at the `deepBed` fishing InteractPoint:

- **First interaction** (`!lurkerDefeated`): `seaFirstCast` plays — the
  player CASTS, the line drifts, then "snaps taut" on something far too
  heavy. On its close, `lurkerIntro` plays (the Lurker steals the lure — the
  theft is what starts the fight), then the mini-boss `BattleScene`
  (`victoryFlag: "lurkerDefeated"`, hero + Slither).
- **After the fight** (`lurkerDefeated`, `!silverfinCaught`): the line is
  intact — re-interacting opens the existing `fishingCast` choice → the
  timing minigame (`FishingMenu`) → lands the silverfin
  (`items.silverfin` + `silverfinCaught`).
- Then `act3Ending` plays (its end-card lines removed; it now points the
  party up out of the sea), sets `act3Complete`, and `goToZone("seaAscent")`.
  `deepBed.populate()` has a reload guard: `silverfinCaught && !act4Started`
  → straight to `seaAscent`, so a reload after the catch can't soft-lock.

## Slither follower, factored out

The per-scene follower rig (trail ~14 frames back, flip + depth-sort) is now
`src/game/SlitherFollower.ts` — one `new SlitherFollower(this)` per
`populate()`, `spawn()` when `flags.slitherJoined`, pumped from `onUpdate()`.
All six Act 3 zones use it (Slither is with the party the whole act). The
Act 2/4 scenes keep their inline copies (out of scope).

## Plumbing (same checklist as every zone addition)

- `gameState.ts`: `ZoneId += kelpForest, sunTemple, fluffballBed, deepBed,
  seaAscent`; `ACT3_FLAGS` gains the per-zone entry flags (`sawKelpForest,
  sawTempleEntry, sawFluffbed, sawDeepBed, sawAscent`). No new items.
- `objective.ts`: the Act 3 chain is now per-zone (a `switch (s.zone)`),
  every line ≤ 40 chars; the deep-bed line walks Lurker → recast → climb.
- `scripts/radio.ts`: `radioLines` gains all five new zones (exhaustive
  `Record<ZoneId, …>`).
- Six new scripts (`kelpForestEntry, sunTempleEntry, fluffballBedEntry,
  deepBedEntry, seaFirstCast, seaAscent`) + `act3Ending` revised (no end
  card); all `validateScript`-clean, ≤ 48 chars/line, Slither hissing.
- `BootScene` `ZONE_NAMES` + `main.ts` register the five new scenes.
- Encounters reuse `ENCOUNTERS.sunlessSea` (via `encounterZone:
  "sunlessSea"` on `kelpForest`/`deepBed`) — no `encounters.ts` change.
- `tests/game/maps2.test.ts`: full BFS suite per new zone (enclosure with
  gates, landmark reachability, the fork's disjoint routes, both spur
  cul-de-sacs + the false-lead dead end proven behind single entrance tiles).
- `tests/core/objectiveAct3.test.ts` + `scriptsAct3.test.ts` rewritten;
  `scriptsAct1.test.ts` radio list extended.
- `tools/smoke/e2e.mjs`: Act 3 now walks the full six-zone chain end to end,
  including cast → Lurker-steals-it → fight → recast → catch and the ascent
  → `minersCamp` hand-off. `touch-e2e.mjs` fishing coverage retargeted to
  `deepBed`.

## Act 4 entry (unchanged internals)

`MinersCampScene` is entered exactly as before — spawned at `CAMP_SPAWN`
with `act4Started` set — so no Act 4 internals changed; only the SOURCE of
that entry moved from the old sea end card to `seaAscent`'s top gate. (Act
4's own multi-zone retrofit is a separate task.)

---

# v15: Act 4 retrofit — the Miners' Camp becomes a five-zone chain

Playtester feedback on the shipped v13 Act 4 ("act 4 is only 1 map? those
should be 4-6 maps"; "gameplay seems unstructured, dialogue feels
ungrounded") drove the same structural retrofit Act 3 got in v14: Act 4 is
now a chain of connected zones, each a distinct place with grounding entry
dialogue, dead-end pockets as true BFS cul-de-sacs, and a narrated way in
(the ascent ladder tops out onto the camp's outskirts). **No new art,
bestiary, encounter or "reeks"-core changes** — this reuses every v13 asset
(`tiles5`, `middenmite`), the `minersCamp` encounter table, and the
`REEK_AVERSE`/`reekAdjusted` mechanic; it only re-shapes zones, scenes and
wiring. Additive to Acts 1/2/3 except the Act-4-internal wiring; the Act 3 →
Act 4 hand-off is unchanged (see below). The Act 4 → Act 5 hand-off stays a
title-card placeholder (Act 5 is a teammate's next task), exactly as Act 3
did before its own retrofit was ready.

## The five zones and how they connect

The single `minersCamp` map is replaced by five connected zones. `minersCamp`
is **kept as the id of the entry zone** so the Act 3 → Act 4 hand-off in
`SeaAscentScene` (`goToZone("minersCamp", CAMP_SPAWN)`, setting `act4Started`)
is unchanged; `CAMP_SPAWN` is still exported from `minersCampMap.ts`.

1. **`minersCamp`** (Camp Outskirts, entry, 22×14) — where the miners' service
   ladder tops out. First sight of the camp from outside; the environmental
   storytelling of Piggy's night raids lands here (frost tracks, a stolen
   boot, string lights glowing deeper in). Entry beat `campOutskirtsEntry`
   (`sawOutskirts`). South gate → `campProper`.
2. **`campProper`** (the hub, 34×20, `campProperMap.ts`) — Mo, Edda and Gus's
   living space: stove, rug, sock line, the NE supply crates. Carries the
   **crate chase** (`sawCrateChase`), the **favor-quest hook** (the three
   miners, `minersFavor`), and — once the nook is cleared — the **sock line**
   InteractPoint (`CAMPP_SOCKS`, gated on `middenCleared`) that hands over the
   socks (`minersReward` → `items.stinkySocks` + `gotSocks`) and rolls the
   `act4Ending` + end card. The **"reeks" mechanic lives here**: the miners'
   line swaps to `minersReek` while the socks are held, and `encounterTable()`
   applies `reekAdjusted` (frost scarabs give the party a wide berth). Entry
   beat `campProperEntry` (`sawCamp`). Three gates: north → `minersCamp`, west
   → `laundryNook`, east → `campGallery`.
3. **`laundryNook`** (dead-end pocket, 18×14, `laundryNookMap.ts`) — the damp
   corner nest. The **midden-mite nest** InteractPoint (`NOOK_NEST`) →
   `nestIntro` → a real swarm `BattleScene` (four mites, `victoryFlag:
   "middenCleared"`). Entry beat `laundryNookEntry` (`sawNook`). One east gate
   back to `campProper`; otherwise enclosed (a cul-de-sac ZONE, like Act 3's
   `sunTemple`/`fluffballBed`). No random encounters.
4. **`campGallery`** (the climb, 20×18, `campGalleryMap.ts`) — a disused drift
   the raids' frost-track trail leads up through, switching back past two
   half-collapsed cross-walls with **staggered gaps** (BFS-verified: the climb
   from the south gate to the north gate threads both gaps). A real traversal
   zone (`encounterZone: "minersCamp"`, reek-adjusted). Entry beat
   `campGalleryEntry` (`sawGallery`). South gate → `campProper`, north gate →
   `campLedge`.
5. **`campLedge`** (dead-end vantage, 18×14, `campLedgeMap.ts`) — a small
   overlook above the camp. **Fluffball glimpsed** (`LEDGE_TRIGGER` → clue #2,
   the RIPEST socks, `fluffballLedge`), then he bolts — same glimpse-and-flee
   structure as Act 3's `fluffballBed`; he does **not** join here (that's Act
   5). Entry beat `campLedgeEntry` (`sawLedge`) on a **separate rect** from the
   glimpse trigger, so the two never fire the same frame. One south gate back
   to `campGallery`; otherwise enclosed (a cul-de-sac ZONE).

The chain: `minersCamp` →(S)→ `campProper`; `campProper` →(W)→ `laundryNook`
(dead end) and →(E)→ `campGallery` →(N)→ `campLedge` (dead end). The socks are
handed over back in `campProper` (a well-populated, grounded scene with the
miners present), which is the natural "last" zone where the ending plays.

## Grounding the "ungrounded dialogue" fix

Every zone has real entry dialogue that names the place and the party's
purpose there, and states where they're heading next where it's a forward
step (the outskirts point "just south, into the camp"; the gallery states
"the tracks go up, someone watches"). Slither hisses in every script where he
speaks; all `validateScript`-clean, ≤ 48 chars/line. The per-zone objective
line (`objective.ts`, a `switch (s.zone)`) mirrors this, ≤ 40 chars.

## Slither follower

All five zones use the shared `src/game/SlitherFollower.ts` rig (factored out
in v14) — one `new SlitherFollower(this)` per `populate()`, spawned when
`flags.slitherJoined`, pumped from `onUpdate()`. The old inline follower copy
that lived in `MinersCampScene` is gone.

## Plumbing (same checklist as every zone addition)

- `gameState.ts`: `ZoneId += campProper, laundryNook, campGallery, campLedge`;
  `ACT4_FLAGS` gains the per-zone entry flags (`sawOutskirts, sawCamp, sawNook,
  sawGallery, sawLedge`) alongside the existing beat flags. No new items.
- `objective.ts`: the Act 4 chain is now per-zone (a `switch (s.zone)`), every
  line ≤ 40 chars.
- `scripts/radio.ts`: `radioLines` gains all four new zones (exhaustive
  `Record<ZoneId, …>`).
- Five new entry scripts (`campOutskirtsEntry, campProperEntry,
  laundryNookEntry, campGalleryEntry, campLedgeEntry`); the v13 beat scripts
  (`crateChase, fluffballLedge, minersFavor, minersReward, minersReek,
  act4Ending`) are reused unchanged. Covered by `tests/core/scriptsAct4.test.ts`.
- `BootScene` `ZONE_NAMES` + `main.ts` register the four new scenes.
- Encounters reuse `ENCOUNTERS.minersCamp` (via `encounterZone: "minersCamp"`
  on `campProper`/`campGallery`) — no `encounters.ts` change.
- `tests/game/maps2.test.ts`: full BFS suite per new zone (enclosure with
  gates, landmark reachability, both nook/ledge cul-de-sac ZONEs, the
  gallery's switchback climb, overhead non-solidity). `objectiveAct4.test.ts`
  rewritten per-zone; `scriptsAct1.test.ts` radio list extended.
- `tools/smoke/e2e.mjs`: Act 4 now walks the full five-zone chain end to end
  (outskirts → camp proper crate chase + favor → nook nest fight → gallery
  climb → ledge glimpse → back to camp → socks → reek reweight → ending), and
  re-verifies `seaAscent`'s hand-off lands in the new entry zone.
  `touch-e2e.mjs`'s nest-InteractPoint coverage retargeted to `laundryNook`.
- Screenshot review confirmed each zone renders with its own `tiles5` art and
  the dialogue box (depth 5500) draws cleanly over the overhead string-lights/
  laundry decor (depth 5000) — no reintroduction of the overhead-over-dialogue
  bug.

## Act 5 entry (still a placeholder)

`campProper`'s sock hand-over rolls `act4Ending` and the "ACT 5: THE SUNLIT
CAVE-IN — coming soon" end card (→ title), with a reload-safe epilogue guard
(`act4Complete` re-shows the card). Act 5's own multi-zone build is a separate
task; this stays a title-card placeholder until it's ready to hand off, the
same way Act 3 did before v14.

*(Superseded by v16 below — the placeholder is now a real hand-off.)*

---

# v16: Act 5 — The Sunlit Cave-In, built as a five-zone chain

Act 5 ("The Sunlit Cave-In") is built at the Act 3/4 density from the start —
five connected zones, each a distinct grounded place with real entry dialogue,
dead-end/gate structure BFS-verified, and a narrated hand-off in and out — NOT
the single-zone shape a shipped-then-retrofitted draft would have. The grove is
**underground, inside Cinnabar Mine** (per CLAUDE.md): a gallery whose ceiling
caved in long ago, letting a shaft of desert sun down onto the greenest place
in the game, watered by the underground river (the oasis spring's source). One
orange tree grows at the dead centre of the chamber. Sahra keeps it.

Reuses the good writing from an unmerged single-zone draft (Sahra's reactive
dialogue, Fluffball's join, the scared chase) redistributed across the new
zones; only the single-zone structure was the problem.

## The five zones and how they connect

1. **`groveDescent`** (The Warm Descent, 20×14) — the Act 4 → Act 5 entry zone
   (the hand-off spawns the party here at `DESCENT_SPAWN`). The camp's cold
   plank floor greens into moss and a warm `sunbeam` glow at the south gate —
   the first hint of the chamber below. One gate, south, on into the approach;
   otherwise enclosed. Entry beat `groveDescentEntry` (`sawGroveDescent`). No
   random encounters. Mirrors Act 4's `minersCamp` single-forward-gate shape.
2. **`groveApproach`** (The Grove Approach, 30×18) — first real green, a
   windfall of oranges, and a dense **needle-cactus thicket** (solid). The
   **scared near-catch chase** plays here (`APPROACH_CHASE_TRIGGER` →
   `groveChase` → `sawGroveChase`): Piggy bolts into the thicket, too dense to
   follow, and for the first time it isn't funny. A real traversal zone
   (`encounterZone: "grove"`, sunwasps). Two gates: north back to the descent,
   south on to the grotto. Entry beat `groveApproachEntry` (`sawGroveApproach`).
3. **`groveGrotto`** (The River Grotto, 22×16) — a quiet connecting cavern
   where the underground river wells up and runs on toward the light (the same
   water table that feeds the oasis spring — the geography that ties the
   underground together). Solid `groveWater`/`groveWater2` river with a
   `riverStone` stepping-stone crossing keeping both banks reachable. Two gates
   (north↔approach, south↔chamber); no encounters. Entry beat `groveGrottoEntry`
   (`sawGroveGrotto`). A breather beat between the tense chase and the reveal.
4. **`groveChamber`** (The Sunlit Cave-In, 30×20) — THE chamber: the cave-in,
   the river, and **one orange tree at the dead centre** (`CHAMBER_TREE`, a
   solid trunk under an OVERHEAD `orangeTreeCanopy` the party walks beneath,
   framed by the `sunbeam` shaft). **Fluffball JOINS here** (`CHAMBER_JOIN_
   TRIGGER` at the foot of the tree → `fluffballJoin` → `fluffballJoined`),
   following the chase he witnessed; his follower sprite is spawned LIVE. A
   traversal zone (`encounterZone: "grove"`). Two gates: north back to the
   grotto, east on to Sahra's corner. Entry beat `groveChamberEntry`
   (`sawGroveChamber`).
5. **`sahraGrove`** (Sahra's Grove, 22×16) — the keeper's tended corner just
   east of the tree (drying racks, the oldest orange row). Sahra's **reactive
   trade** (see below) sets `gotOranges` + `items.oranges` and rolls the Act 5
   ending on its Act 6 title card. One gate, west, back to the chamber;
   otherwise enclosed (the way on to Act 6 is the end card — a teammate's task).
   No encounters. Entry beat `sahraGroveEntry` (`sawSahraGrove`).

Chain: `groveDescent` →(S)→ `groveApproach` →(S)→ `groveGrotto` →(S)→
`groveChamber` →(E)→ `sahraGrove`, each with a back-gate the way it came.

## The Act 4 → Act 5 hand-off (replaces the placeholder card)

`CampProperScene`'s sock hand-over no longer shows an end card. `runEnding()`
plays the (de-carded) `act4Ending` script, then `enterAct5()` sets
`act4Complete` **and** `act5Started` and `goToZone("groveDescent",
DESCENT_SPAWN)` — the same real-zone hand-off as Act 2→3 and Act 3→4. The
epilogue reload guard (`act4Complete`) re-arms the hand-off instead of a card.
`act4Ending`'s terminal title-card lines were removed (like `act3Ending` in
v14); it now points the party "down" into the warm air.

## Sahra's reactive dialogue (the first real callback payoff)

`scripts/sahraGrove.ts` exports a **pure** `sahraGroveScript(flags)` that
branches on Act 1–2 choices: the cold pack (`rabbitTradedColdPack` = mercy vs.
`rabbitResolved` = grit) and the Dust Queen (`parleyed` = words vs.
`queenResolved` = force), each dimension yielding two full, distinct lines (not
a one-word swap), plus a neutral fallback when a thread wasn't resolved. Unit-
tested to differ across ≥2 flag combinations (`scriptsAct5.test.ts`), and the
smoke test spot-checks two live combinations in `sahraGrove`. `SahraGroveScene`
picks the script from run state (`groveChatter` once traded; `meetFirst`
defensively before the join; else the reactive trade) and, on the reactive-
trade close, sets `gotOranges` + `items.oranges` and rolls the ending.

## Fluffball follower rig (reusable by Acts 6–7)

`src/game/FluffballFollower.ts` — the twin of `SlitherFollower`, factored the
same way so it can be copied into every future zone. Fluffball is a **non-
combat companion**: he appears ONLY as a world follower (this rig) and in
dialogue/camp scenes — `partyFor()` and `BattleScene` are deliberately
untouched (verified in the smoke test: the grove battle party stays hero +
Slither). He trails 26 frames back (vs Slither's 14) so the two line up
single-file. Unlike Slither (present from Act 2), he may join MID-ACT, so
`spawn()` is idempotent and called both live from the join callback and from
`populate()` on a reload landing after the join. Every Act 5 zone instantiates
both rigs, spawns each per `flags.slitherJoined` / `flags.fluffballJoined`, and
pumps both from `onUpdate()`. **Acts 6–7: copy both rigs into your new zones,
exactly as Slither's has been copied since Act 2.**

## New generated art (additive; prior sheets byte-identical)

- `sunwasp.png` (24×24, 6×1) — grove guardian, `sunwasp-idle` [0,1] /
  `sunwasp-move` [2..5]; hot amber/ink body, skyBlue/slate wings. Bestiary
  `sunwasp` (scale 2.5, 22/11/3/16, xp 16).
- `tiles6.png` (16×16, **8 cols × 2 rows**), manifest `tiles6`. Row-major
  names: `groveGrass groveGrass2 groveMoss sunbeam caveWall collapsedRock
  vineRock fern groveWater groveWater2 riverStone orangeTreeTrunk
  orangeTreeCanopy oldOrange needleCactus groveFlower`. Solid additions to
  `SOLID_TILE_NAMES`: `caveWall, collapsedRock, vineRock, fern, groveWater,
  groveWater2, orangeTreeTrunk, needleCactus`. `orangeTreeCanopy` is the one
  OVERHEAD tile; `groveWater`↔`groveWater2` animate. Both sheets re-pinned in
  `tests/pipeline/determinism.test.ts` ("act5 asset byte-stability"). `ZoneScene`
  gains the `tiles6` firstgid/`tileGid`/`tileFrame`/`buildMap` wiring; `BootScene`
  loads `tiles6`/`sunwasp`.

## Plumbing (same checklist as every zone addition)

- `gameState.ts`: `ZoneId += groveDescent, groveApproach, groveGrotto,
  groveChamber, sahraGrove`; `ACT5_FLAGS` (`act5Started`, the five `saw*` entry
  beats, `sawGroveChase`, `fluffballJoined`, `gotOranges`, `act5Complete`), all
  false at `newGame()`; `items.oranges: boolean` (false at `newGame()`).
- `objective.ts`: the Act 5 chain (`act5ObjectiveFor`, a `switch (s.zone)`),
  hooked in after Act 4's (`act5Started || act5Complete` delegates); ≤ 40 chars.
- `bestiary.ts` `sunwasp`; `encounters.ts` `grove` table (sunwasp swarms,
  weights `[3,3,2,1]`), `ENCOUNTERS` key union gains `"grove"`.
- `scripts/`: reused `sahraGrove`, `fluffballJoin`, `groveChase`, `act5Ending`
  (adapted from the draft); five new entry scripts. `radio.ts` `radioLines`
  gains all five zones (exhaustive `Record<ZoneId, …>`). `BootScene` `ZONE_NAMES`
  + `main.ts` register the five new scenes.
- `tests/game/maps2.test.ts`: full BFS suite per new zone (enclosure with gates,
  landmark reachability, the river crossing, the tree centred + its canopy
  non-solid, the needle thicket solid). `scriptsAct5.test.ts` +
  `objectiveAct5.test.ts` new; `scriptsAct1.test.ts` radio list, `bestiary`,
  `encounters`, `gameState`, `act1Retcon`/`bucket` manifest lists, and
  `scriptsAct4` (act4Ending de-carded) extended.
- `tools/smoke/e2e.mjs`: the Act 4 hand-off now lands in `groveDescent`, then
  the full five-zone Act 5 chain (descent → approach chase → grotto → chamber
  reveal + Fluffball join + a forced sunwasp battle confirming the non-combat
  party → Sahra's reactive-dialogue spot-check + oranges trade → ending → Act 6
  card → title). `touch-e2e.mjs` gains an Act 5 InteractPoint/tap check.
- Screenshot review confirmed each zone renders with its own `tiles6` art, the
  orange tree centred in its sunbeam shaft, and the dialogue box (depth 5500)
  drawing cleanly over the overhead canopy (depth 5000) — no overhead-over-
  dialogue regression.

## Act 6 entry (a placeholder, same pattern as Acts 3/4 before their retrofits)

`SahraGroveScene`'s trade rolls `act5Ending` and the "ACT 6: THE REEF — coming
soon" end card (→ title), with a reload-safe epilogue guard (`act5Complete`
re-shows the card). Act 6's multi-zone build is a teammate's next task; this
stays a title-card placeholder until it's ready to hand off.

*(Superseded by v17 below — the placeholder is now a real hand-off, and the
`act5Ending` card lines are gone.)*

---

# v17: Act 6 — The Reef (the crawlers' garden, trade-not-fight diplomacy)

Act 6 ("The Reef") is built at the Act 3/4/5 density from the start — five
connected zones, each a distinct grounded place with real entry dialogue,
dead-end/gate structure BFS-verified, and a narrated hand-off in and out. Deeper
still and back underwater, past where Act 2's galleries only glimpsed
crystal-crawler territory, into their actual home: a garden of glowing kelp the
crawlers **farm on purpose**. The act's new mechanic is **trade, not a fight** —
a diplomacy branch point modelled on Act 1's Dust Queen (`queenParley`/
`queenFight`). Both Slither and Fluffball travel with the party (Fluffball
joined in Act 5, non-combat); this is where Fluffball's stated knack for
"getting through to reef life a little" first pays off.

## The five zones and how they connect

1. **`reefDescent`** (The Drowned Stair, 20×14) — the Act 5 → Act 6 entry zone
   (the hand-off spawns the party here at `REEF_D_SPAWN`). Back underwater: dry
   reef silt greens into the garden's bioluminescent `glowMoss` at the south
   gate. One gate, south, on into the garden; otherwise enclosed. Entry beat
   `reefDescentEntry` (`sawReefDescent`). No encounters. Mirrors Act 5's
   `groveDescent` single-forward-gate shape.
2. **`reefGarden`** (The Crawlers' Garden, 30×18) — the farmed kelp: CULTIVATED
   `mintKelp` in tidy WALKABLE rows (the crop the party is after) set against
   SOLID tangled `wildKelp`, `kelpTrellis` farm frames, and an OVERHEAD
   `kelpCanopy` the party swims under. Establishes the crawlers as territorial
   farmers, not monsters. A real traversal zone (`encounterZone: "reef"`,
   reefstalkers). Two gates: north back to the descent, south on to the warren.
   Entry beat `reefGardenEntry` (`sawReefGarden`).
3. **`reefWarren`** (The Coral Warren, 26×18) — a coral maze; the **tense
   chase-and-turn** plays here (`REEF_W_CHASE_TRIGGER` → `reefChase` →
   `sawReefChase`). The near-catch stops being cute: Piggy is cornered for real
   in a coral dead-end (a BFS-proven cul-de-sac behind `REEF_W_ALCOVE_ENTRANCE`),
   **frightened, not playful**, and slips through a gap too thin for Joseph — and
   it is **Fluffball, not Joseph, who calls after him** (his voice cracking;
   nobody laughs). `reefChase` also carries **clue #4**: the exact seaweed, the
   MINT kelp the crawlers cultivate (distinct from the wild growth). A cosmetic
   Piggy bolts from the corner through the gap while the beat plays. Traversal
   zone (`encounterZone: "reef"`). Two gates: north back to the garden, south on
   to the hollow. Entry beat `reefWarrenEntry` (`sawReefWarren`).
4. **`reefHollow`** (The Glowing Hollow, 22×16) — a quiet breather cavern: a
   still bioluminescent pool and a cold `reefWater`/`reefWater2` channel with a
   `reefStone` stepping-stone crossing keeping both banks reachable; the
   cultivated mint beds run down toward the crawler elders. A beat to let the
   tense chase settle before the diplomacy. Two gates (north↔warren,
   south↔court); no encounters. Entry beat `reefHollowEntry` (`sawReefHollow`).
5. **`reefCourt`** (The Crawler Court, 22×16) — the diplomacy zone. The crawler
   warden (a `crystalcrawler`-sheet NPC) stands by the oldest mint row; the
   trade (below) sets `gotSeaweed` + `items.seaweed` and rolls the Act 6 ending
   on its Act 7 title card. One gate, north, back to the hollow; otherwise
   enclosed (the way on to Act 7 is the end card — a teammate's task, with a
   reload-safe `act6Complete` epilogue guard). No encounters. Entry beat
   `reefCourtEntry` (`sawReefCourt`).

Chain: `reefDescent` →(S)→ `reefGarden` →(S)→ `reefWarren` →(S)→ `reefHollow`
→(S)→ `reefCourt`, each with a back-gate the way it came.

## The trade-not-fight diplomacy (the new mechanic)

`scripts/reefParley.ts` is a single script with **choices**, shaped like Act 1's
Dust Queen branch point. Talking to the warden (`ReefCourtScene`) opens it;
Slither negotiates, Fluffball translates/vouches. Two decision points, and ANY
wrong pick routes to the terminal node **`affront`**; both good picks reach
**`trade-end`**. The scene branches on the dialogue's end-node id exactly as
`DepthsScene` branches on `parley-end`:

- **`trade-end`** (good approach) → a peaceful trade: `gotSeaweed` +
  `items.seaweed`, then `act6Ending`.
- **`affront`** (bad approach) → the crawlers call a reef predator down: an
  **avoidable** `BattleScene` (`["reefstalker","reefstalker"]`, `victoryFlag:
  "reefFought"`), NOT an instant one. After winning, the warden relents
  (`reefYield`) and gives the kelp anyway — so both paths reach the seaweed, the
  peaceful one without a fight. On the post-fight talk the scene reads `yield`'s
  close the same success way as `trade-end`.

`ReefCourtScene.wardenScript()` picks the script from run state
(`courtChatter` once traded; `reefYield` after a fight; else `reefParley`).

## Follower rigs (both reused, exactly as Act 5 established)

Every Act 6 zone instantiates `SlitherFollower` **and** `FluffballFollower`,
spawns each per `flags.slitherJoined` / `flags.fluffballJoined`, and pumps both
from `onUpdate()`. Fluffball stays a **non-combat** companion: `partyFor()` and
`BattleScene` are untouched (verified in the smoke — the reef battle party stays
hero + Slither).

## New generated art (additive; prior sheets byte-identical)

- `reefstalker.png` (24×24, 6×1) — the reef predator, `reefstalker-idle` [0,1] /
  `reefstalker-move` [2..5]; a bulky slate/tealDeep armoured fish with a bone
  gulper maw, rust/amber dorsal spines, an hpRed eye, and skyBlue/mint
  biolights — deliberately distinct from Act 3's slim jade Reef Eel and the
  crab-shaped Crystal Crawler. Bestiary `reefstalker` (scale 2.5, 38/14/5/13,
  xp 22).
- `tiles7.png` (16×16, **8 cols × 2 rows**), manifest `tiles7`. Row-major names:
  `reefFloor reefFloor2 reefSilt glowMoss reefWall coralHead crystalCluster
  mintKelp reefWater reefWater2 reefStone wildKelp kelpTrellis kelpCanopy
  seaAnemone shellCluster`. A glowing cultivated-garden look (cold mint/skyBlue
  bioluminescence over dark tealDeep/indigo reef, warm coral accents) that reads
  DIFFERENTLY from Act 3's wild kelp sea (`tiles4`): cultivated `mintKelp` is a
  bright WALKABLE crop, wild `wildKelp` a dim SOLID tangle. Solid additions to
  `SOLID_TILE_NAMES`: `reefWall, coralHead, crystalCluster, reefWater,
  reefWater2, wildKelp, kelpTrellis`. `kelpCanopy` is the one OVERHEAD tile;
  `reefWater`↔`reefWater2` animate. Both sheets sha256-pinned in
  `tests/pipeline/determinism.test.ts` ("act6 asset byte-stability").
  `ZoneScene` gains the `tiles7` firstgid/`tileGid`/`tileFrame`/`buildMap`
  wiring; `BootScene` loads `tiles7`/`reefstalker`.

## The Act 5 → Act 6 hand-off (replaces the placeholder card)

`SahraGroveScene`'s trade no longer shows an end card. `runEnding()` plays the
(de-carded) `act5Ending` script, then `enterAct6()` sets `act5Complete` **and**
`act6Started` and `goToZone("reefDescent", REEF_D_SPAWN)` — the same real-zone
hand-off as Acts 2→3, 3→4 and 4→5. The epilogue reload guard (`act5Complete`)
re-arms the hand-off. `act5Ending`'s terminal title-card lines were removed
(like `act3Ending`/`act4Ending`); it now points the party "down, back to cold
water".

## Plumbing (same checklist as every zone addition)

- `gameState.ts`: `ZoneId += reefDescent, reefGarden, reefWarren, reefHollow,
  reefCourt`; `ACT6_FLAGS` (`act6Started`, the five `saw*` entry beats,
  `sawReefChase`, `reefFought`, `gotSeaweed`, `act6Complete`), all false at
  `newGame()`; `items.seaweed: boolean` (false at `newGame()`).
- `objective.ts`: the Act 6 chain (`act6ObjectiveFor`, a `switch (s.zone)`),
  hooked in after Act 5's (`act6Started || act6Complete` delegates); ≤ 40 chars.
- `bestiary.ts` `reefstalker`; `encounters.ts` `reef` table (reefstalker,
  weights `[3,3,2,1]`), `ENCOUNTERS` key union gains `"reef"`.
- `scripts/`: five entry scripts (`reefDescentEntry`…`reefCourtEntry`),
  `reefChase` (the tense turn + clue #4), `reefParley` (the branch point),
  `reefYield` (post-fight), `act6Ending`; all `validateScript`-clean, ≤ 48
  chars/line, Slither hissing. `radio.ts` `radioLines` gains all five zones
  (exhaustive `Record<ZoneId, …>`). `BootScene` `ZONE_NAMES` + `main.ts`
  register the five new scenes.
- `tests/game/maps2.test.ts`: full BFS suite per new zone (enclosure with gates,
  landmark reachability, the warren's cul-de-sac, the hollow's channel crossing,
  the cultivated-vs-wild kelp distinction, the overhead canopy non-solid).
  `scriptsAct6.test.ts` + `objectiveAct6.test.ts` new (parley terminates on both
  branches, good→`trade-end`, bad→`affront`, Fluffball not Joseph calls after);
  `scriptsAct1.test.ts` radio list, `bestiary`, `encounters`, `gameState`,
  `act1Retcon`/`bucket` manifest sheet lists, and `determinism` extended.
- `tools/smoke/e2e.mjs`: the Act 5 hand-off now lands in `reefDescent`, then the
  full five-zone Act 6 chain (descent → garden entry + a forced reefstalker
  battle confirming the non-combat party → warren chase-and-turn → hollow →
  court), then BOTH diplomacy outcomes: the parley's branches are introspected
  (good→`trade-end`, bad→`affront`), the avoidable fight is driven in-engine
  (bad approach → reefstalker battle → win → `reefFought`), then the post-fight
  trade completes (`gotSeaweed` + `items.seaweed`) → ending → Act 7 card → title.
  `touch-e2e.mjs` gains an Act 6 check: tapping to talk opens the parley and its
  trade-vs-fight choice list navigates via the ▲/✓/▼ column.
- Screenshot review confirmed each zone renders with its own `tiles7` art (a
  distinct glowing reef garden), the tense chase beat, the diplomacy choice list,
  and the dialogue box (depth 5500) drawing cleanly over the overhead kelp
  canopy (depth 5000) — no overhead-over-dialogue regression.

## Act 7 entry (a placeholder, same pattern as Acts 3–5 before their builds)

`ReefCourtScene`'s trade rolls `act6Ending` and the "ACT 7: LA PIZZERIA
SOTTERRANEA — coming soon" end card (→ title), with a reload-safe epilogue guard
(`act6Complete` re-shows the card). Act 7 (the finale — the actual catch, and
the close of Part One) is the last teammate's next task; this stays a title-card
placeholder until it's ready to hand off.

---

# v18: Act 7 — La Pizzeria Sotterranea (the finale, and the close of Part One)

Act 7 is the emotional/narrative climax and the **deliberate end of Part One**
— there is no Act 8 in Part One (a sequel, "Part Two", is planned but not built
now). Built at the Act 3–6 density: five connected zones, each a distinct
grounded place with real entry dialogue, dead-end/gate structure BFS-verified,
and a narrated hand-off in and out. Deep beneath everything, where the miners
swore they smelled tomato pie (the Act 2 seed, paid off here): a restaurant
carved into the temple's old kitchens, run by **Chef Testudo**, an ancient
tortoise. The player brings the four things Piggy loves (silverfin, socks,
oranges, seaweed — collected across Acts 3–6); Testudo provides the dough and
tomato; a **cooking/timing minigame** bakes the pizza; the smell draws Piggy in
and he is finally, gently caught (a warm reunion, NOT a chase). Testudo reveals
the glacier/old-ocean secret. Then, on the walk out, the floor gives way — the
**END OF PART ONE** cliffhanger. **Act 7 is combat-free** (no encounters, no
boss): a warm finale, not a fight.

## The two mysteries stay separate (CLAUDE.md constraint)

Testudo's reveal resolves **only** the ancient glacier / old-ocean thread
seeded since Act 1 (Rosa's frost that "isn't melting", Act 2's miners smelling
the sea, the Rime Warden, the flooded sun-temple): the glacier is the last of
the old ocean, kept asleep under the sand, waking since the Act 1 crash; Piggy's
frost was never a fluke (his kind were the old sea's darlings); "the ice
remembers… it wanted to go home." The **scarab / mystery-bug thread is left
completely untouched** — no Act 7 script references scarabs or bugs (asserted in
`tests/core/scriptsAct7.test.ts`). Only the ice/ocean mystery resolves here.

## The five zones and how they connect

1. **`pizzaDescent`** (The Warm Deep, 20×14, `pizzaDescentMap.ts`) — the Act 6 →
   Act 7 entry zone (the hand-off spawns the party here at `PIZZA_D_SPAWN`). The
   cold reef floor warms to ember stone with a lava glow at the south gate. One
   gate, south, on toward the vents; otherwise enclosed. Entry beat
   `pizzaDescentEntry` (`sawPizzaDescent`). No encounters.
2. **`pizzaVent`** (The Lava Vents, 26×18, `pizzaVentMap.ts`) — a volcanic
   gallery lit by molten `lavaVent` fissures (SOLID, animated `lavaVent` ↔
   `lavaVent2`) the party threads around. Two gates: north back to the descent,
   south on to the kitchens. Entry beat `pizzaVentEntry` (`sawPizzaVent`).
3. **`pizzaApproach`** (The Old Kitchens, 24×16, `pizzaApproachMap.ts`) — raw
   rock turns BUILT: ash/ember floor → carved steps → a dressed tile floor,
   temple columns, a cold oven relic, old signage overhead (`hangSign`). Two
   gates: north back to the vents, south into the restaurant. Entry beat
   `pizzaApproachEntry` (`sawPizzaApproach`).
4. **`pizzeria`** (La Pizzeria Sotterranea, 26×18, `pizzeriaMap.ts`) — THE
   restaurant: a checkered dining floor, tables set for guests three thousand
   years gone (`pizzaTable`, SOLID), temple columns, and the great oven
   (`pizzaOven`, SOLID) flanked by lava vents at the south end, where **Chef
   Testudo** works. Three beats play here in order (see below). One gate, north,
   back to the kitchens; the way onward is a narrated hand-off to `pizzaAscent`
   after the reveal (like `deepBed` → `seaAscent`). Entry beat `pizzeriaEntry`
   (`metTestudo`). No encounters.
5. **`pizzaAscent`** (The Long Way Up, 20×18, `pizzaAscentMap.ts`) — the finale:
   the walk back up, Piggy caught and following (a third follower rig). A
   switchback climb past two staggered basalt cross-walls, each leaving a single
   BFS-verified gap. **Enclosed with NO gate** — the only way out is the floor
   giving way. Entry beat `pizzaAscentEntry` (`sawPizzaAscent`); the finale
   trigger near the top runs `partOneFinale` and the END OF PART ONE card.

Chain: `pizzaDescent` →(S)→ `pizzaVent` →(S)→ `pizzaApproach` →(S)→ `pizzeria`;
`pizzeria` →(scripted hand-off after the reveal)→ `pizzaAscent`.

## The pizzeria's three beats (PizzeriaScene)

1. **THE BAKE** — talking to Testudo (once all four ingredients are held; a
   defensive `testudoNeedsAll` line otherwise) opens `testudoBake`, a choice hub
   shaped like `fishingCast` (`bake-end` starts the minigame, `wait-end` backs
   off; the scene branches on the terminal node id). `bake-end` opens
   `CookingMenu`. A perfect bake sets `pizzaBaked`; a scorched bake lets the
   player retry.
2. **THE CATCH** — deliberately NOT a chase (no near-miss, no minigame): a
   cosmetic Piggy waddle-sprints in from the doorway on his own; `piggyReunion`
   plays (Fluffball vouches for Joseph; Piggy is gently caught, mid-bite); sets
   `piggyCaught`. The warm payoff of every near-catch before it.
3. **THE REVEAL** — `testudoReveal` (the ice/ocean secret); sets `heardReveal`,
   then a narrated hand-off (`goToZone("pizzaAscent")`). Reload-safe guards
   resume mid-sequence (`pizzaBaked`→catch, `piggyCaught`→reveal,
   `heardReveal`→straight up).

## The cooking minigame (`src/core/cooking.ts`, pure + unit-tested)

Engine-agnostic, mirroring `fishing.ts` exactly (proven, testable): a heat
indicator slides 0..1 bouncing off both ends (`tickCooking(state, cfg, dt)` — no
`Date.now`/`Math.random`, time is a parameter); `addTopping(state, cfg)`
registers a tap — inside `[target ± windowHalf]` places a topping cleanly (lands
a **perfect** bake after `requiredAdds`), outside it is a scorch (ruins the bake
after `maxFumbles`). `DEFAULT_COOKING` = speed 1.15, target 0.5, windowHalf 0.12,
4 adds (the four ingredients) / 4 fumbles — brisker and tighter than fishing, so
it plays distinctly. Fully covered by `tests/core/cooking.test.ts` (bounce
reflection incl. multi-bounce steps, window edges, perfect/ruined resolution,
no-op once resolved, determinism), the twin of `fishing.test.ts`. The thin UI is
`src/game/ui/CookingMenu.ts` (a gauge with the glowing "just right" band, the
heat marker, four topping pips + labels, a PLACE button; self-manages its own
UPDATE/keydown/pointerdown listeners like `FishingMenu`; hooks on SPACE or any
tap). The scene sets `inputLocked` while it's open (same rule as fishing).

## Followers: a third rig (`src/game/PiggyFollower.ts`)

`PiggyFollower` is the third of the family (after `SlitherFollower` /
`FluffballFollower`), copied the same way into every Act 7 zone. Slither and
Fluffball travel the whole act (spawned per `slitherJoined` / `fluffballJoined`);
Piggy is spawned in `pizzaAscent` once `piggyCaught`, trailing furthest back
(FOLLOW_FRAMES 38 vs 26/14) so the found family lines up single-file: Joseph,
Slither, Fluffball, Piggy. Piggy is **not** a battle companion in Part One
(Part Two's job); Act 7 has no combat at all.

## The Act 6 → Act 7 hand-off (replaces the placeholder card)

`ReefCourtScene`'s trade no longer shows an end card. `runEnding()` plays the
(de-carded) `act6Ending` script, then `enterAct7()` sets `act6Complete` **and**
`act7Started` and `goToZone("pizzaDescent", PIZZA_D_SPAWN)` — the same real-zone
hand-off as Acts 2→3 … 5→6. The `act6Complete` epilogue guard re-arms the
hand-off. `act6Ending`'s terminal title-card lines were removed (de-carded like
act3/4/5Ending); it now points the party "down, following the smell."

## The finale and the Part One cliffhanger (`partOneFinale`)

In `pizzaAscent`, the finale trigger runs `partOneFinale`: **Rosa's radio (the
game's very first NPC, Act 1) crackles back to life** — a real signal, almost
home (a callback; `radioLines.pizzaAscent` also flips from static to a clear
signal). Then, mid-step, the floor gives way (camera shake + fade). The scene
renders a **genuine END OF PART ONE card** — "END OF PART ONE" + evocative text
("Piggy is safe. The secret is out. And the floor is gone." / "What waits below
has no name yet.") — NOT the "Act N: coming soon" placeholder every prior act
used for its successor. Sets `act7Complete` + `partOneComplete`, then SPACE →
`resetGame` → title (Part Two isn't built; the presentation is an intentional
cliffhanger, not a stub). Reload-safe: `act7Complete` re-shows the card.
`src/core/scripts/cliffhanger.ts` is **untouched** — it remains Act 1's ice-wall
end card (still used by `DepthsScene`); Act 7 has its own `partOneFinale.ts`.

## New generated art (additive; prior sheets byte-identical)

- `testudo.png` (24×24, 6×1) — Chef Testudo NPC, `testudo-idle` [0,1] /
  `testudo-move` [2..5]: a mossy jade/teal domed shell, a wrinkled clay/sand
  head with wise mint eyes, a bone chef's toque, an amber apron; slow and kindly.
  Placed via `addNpc` (flat-idle path, like the crawler warden).
- `tiles8.png` (16×16, **8 cols × 2 rows**), manifest `tiles8`. Row-major names:
  `emberFloor emberFloor2 ashFloor carvedStep basaltWall lavaVent lavaVent2
  lavaCrust tileFloor tileFloor2 pizzaTable pizzaOven stoneColumn hangSign
  ovenGlow steamCrack`. Two looks in one sheet: raw warm volcanic rock →
  something BUILT (checker dining floor, set tables, the great oven, columns,
  hanging sign). Solid additions to `SOLID_TILE_NAMES`: `basaltWall`, `lavaVent`,
  `lavaVent2`, `pizzaTable`, `pizzaOven`, `stoneColumn`. `lavaVent` ↔ `lavaVent2`
  animate; `hangSign` is the one OVERHEAD tile. Both sheets sha256-pinned in
  `tests/pipeline/determinism.test.ts` ("act7 asset byte-stability"). `ZoneScene`
  gains the `tiles8` firstgid/`tileGid`/`tileFrame`/`buildMap` wiring; `BootScene`
  loads `tiles8`/`testudo`.

## Plumbing (same checklist as every zone addition)

- `gameState.ts`: `ZoneId += pizzaDescent, pizzaVent, pizzaApproach, pizzeria,
  pizzaAscent`; `ACT7_FLAGS` (`act7Started`, the four `saw*` entry beats,
  `metTestudo`, `pizzaBaked`, `piggyCaught`, `heardReveal`, `act7Complete`,
  `partOneComplete`), all false at `newGame()`. No new items (the four
  ingredients from Acts 3–6 are the gate).
- `objective.ts`: the Act 7 chain (`act7ObjectiveFor`, a `switch (s.zone)`),
  hooked in after Act 6's (`act7Started || act7Complete` delegates); ≤ 40 chars.
- `scripts/`: entry scripts (`pizzaDescentEntry`, `pizzaVentEntry`,
  `pizzaApproachEntry`, `pizzeriaEntry`, `pizzaAscentEntry`), `testudoBake` (the
  bake choice hub), `piggyReunion` (the catch), `testudoReveal` (the secret),
  `partOneFinale` (the cliffhanger); all `validateScript`-clean, ≤ 48 chars/line,
  Slither hissing. `radio.ts` `radioLines` gains all five zones (exhaustive
  `Record<ZoneId, …>`; `pizzaAscent`'s flips from static to a clear signal).
  `BootScene` `ZONE_NAMES` + `main.ts` register the five new scenes.
- `tests/game/maps2.test.ts`: full BFS suite per new zone (enclosure with gates,
  landmark reachability, the vents never sealing the path, the pizzeria's oven
  solid/Testudo walkable, the ascent's switchback proven by blocking a gap).
  `cooking.test.ts`, `objectiveAct7.test.ts`, `scriptsAct7.test.ts` new;
  `scriptsAct1.test.ts` radio list, `gameState.test.ts` flag set,
  `act1Retcon`/`bucket` manifest sheet lists, and `determinism` extended.
- `tools/smoke/e2e.mjs`: the Act 6 hand-off now lands in `pizzaDescent`, then the
  full five-zone Act 7 chain (descent → vents → kitchens → pizzeria: meet Testudo,
  drive the cooking minigame to a perfect bake by reading the pure state, the
  catch, the reveal → ascent → the finale trigger → END OF PART ONE → title).
  This makes the keyboard smoke cover the ENTIRE game from a fresh save through
  the end of Part One in one run. `touch-e2e.mjs` gains an Act 7 check: tapping
  Testudo opens the bake, the ✓ column confirms it, and screen taps drive the
  cooking minigame to a perfect bake.
- Screenshot review confirmed each zone renders with its own `tiles8` art, and
  the dialogue box (depth 5500) draws cleanly over the overhead signage
  (`hangSign`, depth 5000) — no overhead-over-dialogue regression.

## Part One is complete, end to end

With Act 7 in, **Part One of Desert Secrets is fully built, Acts 1–7**: the
homestead intro and the Dust Queen (Acts 1–2), the four-ingredient chase across
the Sunless Sea, the Miners' Camp, the Sunlit Cave-In and the Reef (Acts 3–6),
and this finale — the catch, the reveal, and the deliberate cliffhanger that
opens Part Two. The full run is playable from a fresh save to END OF PART ONE
and is covered end-to-end by `npm run smoke`. Part Two is planned in
`docs/STORY_PARTS2-4.md` but not built in this pass.

# v19: Rest points — free, reusable full heals in Acts 3–7

## Why (the gap a playtester found)

After Act 2 there was **no way to restore HP except leveling up or dying**
(both full-heal). Acts 3–7 are long chains (5–6 zones each) full of random
encounters and set-piece fights (the Lurker, sunwasp, reefstalker, midden-mite
swarm, the crawler-court fallback fight, …) with nothing between them to top
off. A player who took chip damage across a chain had to either grind a level
or throw a fight to reset — a real gameplay gap, not a nice-to-have. This adds
one **rest point** per act, Acts 3–7.

## What a rest point is

A plain `addInteractPoint` (stand nearby, press E / tap) that the player can
use **any number of times, for free**. On use it fully heals the party and
plays one short zone-appropriate flavor line, then stays usable (`once: false`,
the default). No item, no charge, no cost.

- **The heal reuses the existing pure `respawn()`** (`gameState.ts`), the same
  heal-to-full that defeat and level-up already call — no duplicated max-HP
  math. Centralized in a new base-class helper `ZoneScene.restHere(flavor)`:
  `setState(this, respawn(getState(this)))` → `hud.update` → `openScript(flavor)`.
- **Party coverage:** healing the hero heals the party. Slither always fights at
  full HP every battle (`partyFor()` gives him fresh `slitherStatsForLevel`
  stats) and Fluffball is non-combat, so neither tracks persistent HP — no extra
  plumbing needed.
- **Flavor lines** live in `src/core/scripts/restPoints.ts` (one single-line
  narration script per act; `validateScript`-shaped like every other script).

## Where each rest point lives (zone + tile + visual anchor)

Each sits on a genuinely walkable tile (verified against the map builder), in a
hub or pre-boss zone the player passes more than once — reusing an existing
decorative tile/prop as the anchor, no new art:

- **Act 3 — the Kelp Forest hub**, tile `(16,13)` (`KELP_REST`): the walkable
  anemone at the centre of the hub every route forks through. "A warm mineral
  current wells up through the floe."
- **Act 4 — the Miners' Camp**, tile `(16,11)` (`CAMPP_HEARTH`): on the rug
  directly in front of the stove (the stove at `(16,12)` is solid). The camp is
  Act 4's hub. "You warm your hands at the miners' stove."
- **Act 5 — the River Grotto**, tile `(11,6)` (existing `GROTTO_POOL`): the
  underground river's source pool, on the main north–south path. "You kneel at
  the river's source and drink."
- **Act 6 — the Crawlers' Garden**, tile `(21,9)` (existing `REEF_G_MINT_ROW`):
  a walkable cultivated mint-kelp tile, right before the reefstalker stretch.
  "You settle among the glowing mint kelp."
- **Act 7 — La Pizzeria Sotterranea**, tile `(8,8)` (`PIZZA_P_TABLE`): a set
  dining table (the table at `(8,9)` is solid), usable while exploring before
  the finale beats begin. "Testudo slides over a bowl of soup."

## Plumbing

- `ZoneScene.restHere()` added (imports `respawn` from `gameState`). Five scenes
  (`KelpForestScene`, `CampProperScene`, `GroveGrottoScene`, `ReefGardenScene`,
  `PizzeriaScene`) each gain one `addInteractPoint(...restHere(script))` call.
  Map files export the three new landmark constants (`KELP_REST`, `CAMPP_HEARTH`,
  `PIZZA_P_TABLE`); Acts 5/6 reuse existing landmark constants.
- No new pure logic beyond reusing `respawn()`, so no new unit test — but
  `tools/smoke/e2e.mjs` gains a `restPointCheck()` helper and exercises the
  Act 3, 4 and 6 rest points in the live keyboard playthrough (use once to learn
  max HP, damage the hero to 1, use again, assert it heals back to full and is
  repeatable). `tools/smoke/touch-e2e.mjs` proves the Act 4 stove rest point
  full-heals via tap-to-interact (the same touch path bucket/spigot/nest use).
- Story/dialogue untouched beyond the five flavor lines; Acts 1–2 and the
  Mode-7 overworld are deliberately left alone (short enough not to need this).

# Phase O: the overworld art pass — re-authored Mode-7 ground + the billboard layer

The 2.5D art upgrade's overworld slice (docs/ART_DIRECTION.md §4, §1
G-rules, §7 constraints). Two halves: the flat art the Mode-7 plane
samples was re-authored (§4a), and the mountains/landmarks now *stand up*
as perspective-scaled billboard sprites over that plane (§4b). Everything
below is additive or an in-place redraw with a deliberate hash re-pin;
no frame index moved anywhere.

## Re-authored ground tiles

- **`tiles.png` (redrawn in place, re-pinned):** `sand/sand2/sand3` are
  now a calm plain crossed by two paired dune-ridge lanes — 1px
  `sandLight` crest over a 1px `amber` wind-shadow, S-curving as a sum of
  sines whose periods (16px and 8px) divide the tile exactly. Because
  every sand-family tile draws the SAME two lanes with the same phase,
  `crest(0) === crest(16)` and any variant continues any neighbour's
  ridges seamlessly regardless of which variant the map's cell-hash
  placed — that's the position-independent §4a "phase continuity" design.
  Variants differ only in seeded 2×2 motif clusters (light patch /
  pebble; G5 — the old per-pixel speckle is gone from the whole sheet,
  including under every prop tile). `sandSparkle` keeps its buried-glint
  read as two 3×3 diamond clusters. `water/water2` are a 3-value ramp:
  `indigo` body, 3–5px `slate` wave dashes with a `skyBlue` lit crest
  (2px-tall features, G6), loosely row-aligned, one 2px `bone` glint;
  the two frames drift by 2px. The shared sand recipe is exported as
  `sandBase(seed, motifCount)` (plus `water(phase)`) from `tileset.ts`
  and consumed by `tileset2.ts`, so both sheets' sand-based tiles seam.
- **`tiles2.png` mountains 1–8 (redrawn in place, re-pinned):** the FF6
  3/4-view recipe — an irregular main peak (apex position/height keyed
  off the variant) plus a lower shoulder on even variants, rising from a
  `plum` inter-peak shadow mass; umber/plum zigzag along the crest
  silhouette, lit NW flank (`sand` near the crest, `clay` below), shaded
  SE flank (`rust` into `plum`, ~half the mass), `sandLight` apex caps,
  a broken `umber` south-foot line, and seeded 2×2 crag clusters instead
  of the old flecks. These remain the flat-tilemap fallback and the
  distant plane texture; the near-field 3D read is the billboards.
- **`tiles2.png` appendix (indices 32..55, additive):**
  `scree`/`scree2` (clay ground, 2×2 mauve/rust/sand pebble clusters),
  `screeShade` (shadow-LUT scree whose south edge hands off into sand
  with shaded fingers — the §4a mountain foot-shadow band tile),
  `sandShade` (shadow-LUT sand), the coast surf ring
  `coastN/E/S/W`, `coastNE/NW/SE/SW`, `coastInNE/InNW/InSE/InSW`
  (built with `tilecraft.makeEdgeSet` style `"surf"`: umber land lip →
  broken bone fringe → skyBlue shallows → open water matching the water
  tile; the letters name where the water is, `In*` = water only
  diagonal; land owns the border per G9), and the sand↔scree transition
  `screeSandN/E/S/W`, `screeSandNE/NW/SE/SW` (`makeEdgeSet` style
  `"fingers"`, scree owns the border, letters name where the sand is).
  All appended tiles are walkable ground names — `SOLID_TILE_NAMES`
  needed no change.

## The overworld autotile pass (`overworldMap.ts`)

`buildOverworldMap()` now ends with a pure `applyOverworldAutotile`
selection pass over the finished layout (deterministic — cell data in,
cell data out): (1) scree-family ground under every mountain decor cell,
(2) `screeShade` on open non-water cells directly south of a mountain,
(3) `screeSand*` finger tiles on mountain cells whose N/E/W side faces
open sand (south faces meet the shade band, whose sand hand-off is baked
into the tile), (4) the coast ring on every land cell 4-adjacent (or
only diagonally adjacent → `coastIn*`) to the spring pool, applied last
so the surf wins where the pool touches a shadow row. The pool moved one
tile west (x 9–10, rows 16–17) so it has land on all sides for a full
ring; three `joshuaTrunk` decors were added beside the clearings (solid,
like all trunks) as billboard landmarks; the creosote/bones scatter now
keeps off the shore. Enclosure, both gates, BFS reachability and
walkable < ⅓ all still hold (asserted in tests/game/maps.test.ts along
with new dressing assertions).

## `worldToScreen` — the forward projection (`src/core/mode7.ts`)

The exact inverse of `projectGround`, added for billboards:

```
depth = camY − wy                 // forward = −y = north
null if depth ≤ 0 (behind camera) or depth > maxDepth (past the far haze)
scale = focal / depth             // screen px per world px
x = screenW/2 + (wx − camX) · scale
y = horizon + cameraHeight · scale   // always strictly below the horizon
```

Off-screen-lateral points are returned, not nulled — lateral/below-screen
culling is the caller's job; only depth invalidates a point. Unit-tested
against `projectGround` round-trips both ways, the maxDepth boundary
(non-null exactly at the clamp, null past it), behind-camera nulls,
horizon unreachability, scale monotonicity and determinism.

## `owBillboards.png` — the billboard sheet contract

Six bottom-anchored **48×40** frames in one 6-column row (sheet 288×40),
transparent ground, sel-out contours (`plum` rock / `umber` wood /
`tealDeep` foliage) with `ink` only along the bottom contact edge:

| index | name | content |
|---|---|---|
| 0 | `mountainMassA` | one dominant peak + right shoulder |
| 1 | `mountainMassB` | twin peaks with a saddle |
| 2 | `mountainMassC` | long low three-bump ridge |
| 3 | `joshuaTree` | forked trunk, three spiky rosettes |
| 4 | `mineMouth` | rock mound, dark opening, timber portal |
| 5 | `truckWreck` | overturned box truck, wheels in the air |

Manifest: a new top-level `owBillboards` entry (`BillboardSheetDef`:
file/frameWidth/frameHeight/columns/names — appended at the end of the
schema, nothing existing moved). The sheet is covered by the standard
determinism (via `SHEET_KEYS`), palette, layout and non-emptiness suites
(tests/pipeline/owBillboards.test.ts) and is loaded by
`OverworldScene.preload()` (it's the only consumer, so it does not join
BootScene's global preload).

## Billboard rendering (`Mode7Ground` + `OverworldScene`)

- Decor name → frame registry (frozen): `mountain..mountain8` → masses
  A/B/C cyclically, `joshuaTrunk` → 3, `mineTimber` → 4, `truckCab` → 5;
  `truckBox` is skipped and merges into the cab's single truck billboard.
- Registered decor is **not baked** into the flat ground texture (the
  autotile pass guarantees scree beneath, so no holes); each becomes a
  `Phaser.GameObjects.Image` positioned/scaled every frame from
  `worldToScreen`, `origin (0.5, 1)` at the footprint's south edge.
- 2×2 blocks of mountain decor merge greedily into one larger billboard
  (apparent world width 52px vs 30px for singles), keeping the POC map
  around a hundred sprites; loose cells stand alone.
- Depth = screen y (painter's order); the avatar's depth is its feet
  screen-y so masses sort correctly around it. Presentation-side haze:
  `setAlpha(1 − 0.75·(depth/maxDepth)^0.7)` plus a multiply tint from
  white toward `amber`, matching the shader's ground haze. Culled when
  `worldToScreen` returns null or the sprite is fully off-screen.
- If the billboard texture is missing, `Mode7Ground` bakes decor flat
  exactly as before (pre-Phase-O behaviour); the non-WebGL flat-tilemap
  fallback is untouched and still renders the tile mountains — the whole
  Mode-7 path remains wrapped in OverworldScene's try/catch and degrades,
  never throws.
- Beyond `maxDepth` there are deliberately no billboards *and* the ground
  is ~90% hazed, so the far field reads as dusk haze under the shader's
  static ridge silhouette rather than popping sprites.

## Verification

`tsc --noEmit`, full `vitest run` (1246 tests: new worldToScreen suite,
owBillboards suite, overworld dressing assertions, act1 tiles2 layout
updated to 56 tiles / 128×112), `npm run build`. `tiles.png` and
`tiles2.png` sha256 pins deliberately re-pinned for this pass (comments
in tests/pipeline/determinism.test.ts name it); every other sheet's pin
is byte-identical. Visual gate previews live in `preview/` on the phase
branch (`preview/render.mts` regenerates them).

# v20: Phase Z — the 2.5D zone dressing pass (tiles3–tiles8)

The zones half of the ART_DIRECTION.md upgrade (§2 grammar + §5 per-sheet
priorities). Two deliverables: a rule-driven map post-pass, and the dressing
tiles + redraws it consumes. Everything is additive; no existing tile index
moved. tiles3–tiles8 were deliberately re-pinned in
`tests/pipeline/determinism.test.ts` (tiles3 gains its first pin).

## The dressing pass (`src/game/maps/dressing.ts`)

`dressMap(map: ZoneMap): ZoneMap` — pure, deterministic, applied inside
EVERY zone map builder, wrapping its return (all 38 zones;
`overworldMap.ts` excluded — it belongs to Phase O). Rules, driven by the
name registry exported from the same module:

- **Faces/Caps** (decor): a registered wall cell whose south neighbour is
  walkable becomes `<wall>Face`; a wall cell above a face in the same run,
  or one whose north neighbour is walkable (a room's bottom wall), becomes
  `<wall>Cap`. Two grains each (`Face2`/`Cap2`) alternate by `cellHash` so
  long runs don't repeat.
- **Foot shadows** (ground): a walkable cell whose north neighbour is a
  face becomes `<floor>Shade` (shadow-LUT recolour of the same art);
  registered walkable decor (`frostPrint`) shades along with it.
- **Transitions** (ground, by 4-neighbour adjacency; owner per G9):
  `iceFloor(2)` chasm lips, `floe(2)`↔`seaWater(2)` coast ring (with inner
  corners), `groveMoss`→grass fingers, grass→`groveWater(2)` riverbank
  lips, `sunbeam`→grass spilled-light fingers, `reefSilt`→reef-floor
  fingers, `ashFloor`→ember seams (edges only).

Contracts (unit-tested in `tests/game/dressing.test.ts`):

- **Idempotent**: `dressMap(dressMap(m))` equals `dressMap(m)`. Rules see
  variants as their base names and never rewrite a cell that already holds
  a variant — which also means hand-placed dressed names survive.
- **Tolerant**: unregistered names pass through (Act 1 maps dress to
  themselves; tiles/tiles2 families are owned by parallel phases).
- **Solidity is mechanical**: `isSolidName` in `types.ts` treats any
  `Face`/`Face2`/`Cap`/`Cap2` suffix of a solid base name as solid; shade
  and transition variants belong to walkable floors and stay walkable. No
  per-variant listing. All 38 zones stay green on the BFS
  enclosure/reachability suites with dressing applied.

## Appended tiles (exact order; append-only after each sheet's index 15)

- `tiles3` (+16, 8×4): iceWallDeepCap, iceWallDeepCap2, iceWallDeepFace,
  iceWallDeepFace2, iceFloorShade, iceFloor2Shade, mossGlowShade,
  lakeIceShade, iceFloorChasmN/E/S/W, iceFloorChasmNE/NW/SE/SW.
- `tiles4` (+16, 8×4): floeSeaN/E/S/W, floeSeaNE/NW/SE/SW,
  floeSeaInNE/InNW/InSE/InSW, templeFloorShade, templeGlyphShade,
  floeShade, kelpBedShade.
- `tiles5` (+8, 8×3): campWallCap, campWallCap2, campWallFace,
  campWallFace2, campFloorShade, campFloor2Shade, campRugShade,
  frostPrintShade.
- `tiles6` (+32, 8×6): caveWallCap, caveWallCap2, caveWallFace,
  caveWallFace2, groveGrassShade, groveMossShade, oldOrangeShade,
  riverStoneShade, mossGrassN/E/S/W, mossGrassNE/NW/SE/SW,
  grassWaterN/E/S/W, grassWaterNE/NW/SE/SW, sunGrassN/E/S/W,
  sunGrassNE/NW/SE/SW.
- `tiles7` (+16, 8×4): reefWallCap, reefWallCap2, reefWallFace,
  reefWallFace2, reefFloorShade, reefSiltShade, glowMossShade,
  mintKelpShade, siltFloorN/E/S/W, siltFloorNE/NW/SE/SW.
- `tiles8` (+16, 8×4): basaltWallCap, basaltWallCap2, basaltWallFace,
  basaltWallFace2, tileFloorShade, tileFloor2Shade, emberFloorShade,
  emberFloor2Shade, ashFloorShade, lavaCrustShade, carvedStepShade,
  ovenGlowShade, ashEmberN/E/S/W.

Caps carry a 2px lit south lip and a 1px dark north edge line (§2's thin
north-facing read); faces are G10 gradients with broken strata, cluster-
dithered band boundaries (G7) and an ink foot line.

## Redraws in place (same indices, re-pinned)

- `tiles3`: iceFloor/iceFloor2 sheen bands + rubble chips (speckle killed,
  G5); iceWallDeep calmed into a wall-top surface. All §7 Act-2 legibility
  assertions still hold (floor ≥60% different and darker than the wall,
  doorRime≠doorOpen, lakeIce≠lakeCrack, chasm ≥80% ink, amber lantern,
  transparent icicle).
- `tiles4`: seaWater wave recipe (3-value ramp + drifting dashes),
  floe motif chips, templeFloor flagstone subgrid, templePillar base-lit.
- `tiles5`: campFloor plank subgrid with lit board edges; campWall
  becomes a wall-top brick texture; crate/crateStack/barrel/crateOpen get
  lit tops and umber feet (G1/G4).
- `tiles6`: groveGrass tuft motifs; groveMoss rounded lobed cushions;
  sunbeam soft pooling (no hard band); caveWall top texture.
- `tiles7`: reefFloor/reefSilt rounded pockets; glowMoss lobed luminous
  turf; reefWater ripple recipe.
- `tiles8`: emberFloor/ashFloor motif clusters; tileFloor bevelled checker
  subgrid; lavaVent concentric glow ramp (rust→hpRed→amber→bone heart).

## Map hand nudges (authored layouts that defeated the rules)

- Grove/reef/pizzeria scatter floors clustered into 2×2/4×4 `cellHash`
  block patches (groveChamber, groveApproach, sahraGrove, groveGrotto,
  groveDescent, reefDescent, reefWarren, pizzaDescent, pizzaVent,
  pizzaAscent) so transitions fire on real patch boundaries instead of
  ringing single-cell noise.
- crevasse/sanctum: ground orthogonally beside chasm pits normalized from
  mossGlow to iceFloor so the whole rim takes the lip set.

## Known gaps (deferred, deliberate)

- tiles2 wall families (mineWall, stationWall) got no cap/face this wave —
  that sheet is owned by the parallel overworld phase. galleries/depths
  keep undressed mineWall runs, and mineFloor/frostSand take no foot
  shadows, until those tiles exist.
- glowMoss↔reefFloor and lakeIce↔iceFloor boundaries remain unauthored
  (no tile budget this wave); orangeTreeCanopy still reads as per-tile
  crowns rather than one merged canopy.

# owMountains: the rounded-corner overworld mountain blob autotile

Replaces the Phase O `mountain1..8` per-cell content-hash pick (zero
neighbor awareness, hard square/stair-step edges where a mountain mass met
sand) with a proper mask-based blob autotile, ported from a reference
canvas demo the user tuned. `mountain1..8` and their `tiles2.png` slots are
untouched and remain as unused-by-the-map legacy tiles (additive-only
contract) — the overworld map now places `owMountains.png` tiles
exclusively for its mountain decor.

## Geometry (`tools/pipeline/src/owMountains.ts`)

Per-pixel, the tile splits into four 8×8 quadrants (TL/TR/BL/BR). Within a
quadrant, an exposed corner (both adjacent sides open to sand) rounds via
`curveRadius - hypot(...)` from a point outside the tile; an exposed single
side clips straight to the pixel distance from that edge; a fully-blocked
corner (both adjacent sides mountain) stays at a 999 sentinel (deep
interior, ported verbatim as `mountainDistToGrass`, pure and exported for
direct testing). `MOUNTAIN_CURVE_RADIUS = 16.5` — deliberately larger than
the tile's own half-width (8px), reading as a gentle chamfer rather than a
round bump; ported exactly as tuned, not "fixed" down to a smaller value.
A ±0.75 uniform RNG fuzz is added to the raw distance before banding.

Colour bands (replacing the reference demo's own palette/isotropic
banding): `fuzzyDist < 1` → `sand`/`sandLight` sand ring; `< 2` → a dusty
`amber`/`sand` ring (no green scrub — this is an all-mineral desert,
CLAUDE.md); `< 4` → `clay` foothill ring; else → deep interior/peak, where
a lit NW flank (`sand`/`clay`) and shaded SE flank (`rust`/`plum`, ~half
the interior) split on ABSOLUTE tile-local position (`x + y <= 15` = NW),
not the mask, so light direction stays globally consistent regardless of a
tile's individual mask; the reference's `(x+y) % 8` wave is repurposed
only as a crest-line zigzag texture within each flank, never to choose
lit-vs-shadow. ~5% `ink` crag flecks finish the interior. Every pixel is
opaque (no `null`/transparent cells) and drawn only from `PALETTE` names.

Verified directly against the ported formula (not assumed): a
fully-surrounded tile (mask 15) always evaluates to the 999 sentinel for
every pixel — 100% interior/peak texture, zero pixels reachable in any
transition band, for any seed. A fully-isolated tile (mask 0) is the
opposite of what a smaller-radius intuition suggests: because
`curveRadius` (16.5) exceeds the tile half-width, the four extreme
tile-corner pixels land deep in the sand ring (`fuzzyDist ≈ -6.8`) and even
the tile's single farthest-from-every-edge point (dead center, `≈ 3.06`)
never clears the foothill cutoff — an isolated single-cell mountain reads
entirely as a small rounded sand/foothill mound with no peak texture
anywhere, not "big peak, rounded corners." Both facts are asserted in
`tests/pipeline/owMountains.test.ts` against `mountainDistToGrass`
directly, rather than inferred from pixel colours (some colour names are
legitimately shared between the transition bands and the interior).

## Variant/mask indexing (frozen, append-only)

Five texture families (fixed seed-base literals, no `Math.random`/`Date`),
each spanning the full 16-value N/E/S/W neighbor mask:
**bit0=N=1, bit1=E=2, bit2=S=4, bit3=W=8** — a set bit means "the neighbor
on that side is also mountain" (this tile's edge on that side is interior,
not exposed to sand). `owMountainNames`/`owMountainFrames()` order is
**variant-major, mask-minor**: variant 0 masks 0..15, then variant 1
masks 0..15, … variant 4 masks 0..15 — 5 × 16 = 80 frames, names
`owMountain{0..4}_{0..15}`. `owMountains.png` is 128×160 (8 columns × 10
rows). Manifest: a new top-level `owMountains` entry (`TileSetDef`, same
shape as `tiles`/`tiles2` — file/tileSize/columns/names), appended after
`owBillboards` in both the pipeline (`tools/pipeline/src/manifest.ts`) and
game-side (`src/game/manifest.ts`) manifest types. Covered by the standard
determinism (`SHEET_KEYS`), palette, layout, opacity and geometric-contract
suites (`tests/pipeline/owMountains.test.ts`) plus a dedicated sha256 pin
(`tests/pipeline/determinism.test.ts`, "owMountains blob-autotile
byte-stability").

## `overworldMap.ts`: flood fill and variant assignment

`buildOverworldMap()` places every mountain cell with a
`MOUNTAIN_SENTINEL` placeholder exactly as before (full fill → carve the
pass → border re-assert → gates), then, before the existing Phase O
dressing pass, `assignMountainTileNames(decor)` runs:

1. **Connected-component flood fill**, 4-connectivity, deterministic
   row-major scan order (so component IDs are reproducible), over the
   sentinel cells — clustering contiguous mountain masses.
   `variant = componentId % 5`, so one contiguous mass reads as one
   consistent texture family throughout.
2. **Per-cell N/E/S/W neighbor mask**, using the same is-mountain
   predicate. A neighbor beyond the map edge counts as **mountain present**
   (bit set) — the overworld's outer border is intentionally solid
   mountain except at the two gate bands (the enclosure assertions in
   `tests/game/maps.test.ts`), so treating off-map as sand there would
   round the map's own solid edge into a false gap; only real interior
   boundaries against open sand/path (in-bounds, non-mountain neighbors)
   round off.
3. `decor[y][x] = "owMountain" + variant + "_" + mask`.

`applyOverworldAutotile`'s is-mountain predicate (scree ground placement,
foot-shadow band, sand↔scree fingers) now matches the `owMountain` prefix
instead of the old fixed name set — unchanged behaviour otherwise.
Determinism, both gates, BFS reachability and walkable < ⅓ all still hold
(same assertions as before Phase O; only decor names changed, not the
walkable/solid shape). On the current 16×20 POC map the mountain field is
almost entirely one or two contiguous masses (the border ring connects
most of it), so only 1–2 of the 5 variant families are actually visible in
this particular map — the flood fill and 5-family plumbing are correct and
fully exercised by the pipeline tests; a map with more disconnected
mountain clusters would show more of the variety at once.

## Consumers widened for the new sheet

- `src/game/maps/types.ts`: `isSolidName` gained an `owMountain` prefix
  check (mechanically equivalent to listing all 80 names in
  `SOLID_TILE_NAMES`).
- `src/game/gfx/Mode7Ground.ts`: `tileFrame` resolves `owMountains`;
  billboard eligibility (`BILLBOARD_SKIP`/ground-bake skip and the 2×2
  mountain-cluster merge in `collectBillboards`) now matches decor names
  by the `owMountain` prefix instead of the old fixed
  `mountain1..8` set; the per-name `BILLBOARD_FRAME` lookup for mountain
  masses is replaced by `mountainBillboardFrame(name)`, which parses the
  `(variant, mask)` back out of the name and cycles it onto the same 3
  existing `owBillboards` mass variants A/B/C exactly as the old table did
  (`(variant*16+mask) % 3`) — landmark names (`joshuaTrunk`/`mineTimber`/
  `truckCab`) keep their old fixed-table entries unchanged.
- `src/game/ZoneScene.ts`: gained a ninth tileset slot
  (`OW_MOUNTAINS_FIRSTGID`, appended after `tiles8` — additive, no
  existing gid range moves) in `tileGid`/`tileFrame`/`buildMap`, since the
  overworld's flat-tilemap layer (the Mode-7 fallback) is built once up
  front for every zone regardless of whether Mode-7 ultimately renders
  instead, and it now needs to resolve `owMountain*` names too.
  `src/game/scenes/BootScene.ts` loads `owMountains`/`owMountains-img`
  alongside the other eight tile sheets.
- `tests/game/maps.test.ts`: `KNOWN_NAMES` includes
  `manifest.owMountains.names`; the overworld dressing tests' mountain
  matcher is a prefix check instead of the old fixed name set.
- `preview/render-overworld.mts`: sheet preview + map composite widened
  the same way, for the visual gate below.

## Visual gate

`owMountains.png` (all 80 tiles, natural 8×10 grid) and the full overworld
map composite (both the flat-tile view and the billboard-ground view) were
rendered via `preview/render-overworld.mts` and reviewed directly:
mountain-mass boundaries against sand now show a soft, mottled, organic
fringe (sand/dusty/foothill banding eating into the tile edge, plus sparse
crag flecks) instead of a hard square cut, genuinely fixing the reported
stair-step look; fully-interior tiles read as a diagonal lit-NW/shaded-SE
3D peak band, not the flatter isotropic look of the reference demo's own
banding; the visible variant(s) on this particular POC map (see above —
only 1–2 of 5 appear, since the mass is largely one contiguous component)
are internally coherent and the pipeline test suite confirms all 5 are
mutually distinct. Preview PNGs committed under `preview/`
(`ow_mountains_preview.png`, `ow_map_preview.png`,
`ow_map_ground_preview.png`, refreshed `ow_tiles_preview.png`/
`ow_tiles2_preview.png`/`ow_billboards_preview.png`).

# v21: a two-camera world/UI split, and the overworld defaults to the flat view

The project owner tried Mode-7 (v10/Phase O) extensively via the
`mode7tune` live tuner and decided they prefer the ordinary flat top-down
tilemap every other zone already uses for the overworld too — same
rendering, just zoomed further out for a "see more of the map at once"
big-world feel. Mode-7 is kept **fully intact**, not deleted: it's wanted
for a future vehicle sequence (a rocketship for Thomas, possibly a
motorcycle/speedboat later).

## The naive fix was unsafe

`this.cameras.main.setZoom(0.5)` in OverworldScene visibly broke the HUD,
dialogue box, joystick, action hint and talk prompt — all shrank and
repositioned. `setScrollFactor(0)` only cancels an object's SCROLL
following; it does **not** make it immune to the camera's ZOOM. Every UI
element in this game was rendered through the same single camera as world
content (tilemap layers, player, NPCs), so any camera zoom applied to that
camera hits the UI too.

A depth-based "ignore everything above depth N" heuristic is also unsafe:
the `overhead` tilemap layer (world content, e.g. ice/kelp drawn over the
player's head) sits at depth 5000, and `InventoryMenu`'s container is
*also* depth 5000 — world and UI depths overlap, so depth can't
distinguish them.

## The real fix: two cameras, one explicit UI allow-list

`ZoneScene` (the shared base class for all 38 zones) now owns:

- `protected uiLayer: Phaser.GameObjects.Layer` — every screen-fixed UI
  element (Hud, DialogueBox, InventoryMenu, PerkMenu, CookingMenu,
  FishingMenu, the touch controls in `touch.ts`, talkPrompt, the
  zone-entry hint, FlatZoomTuner) adds itself here at construction, via a
  one-line `addToUiLayer(scene, obj)` call (`src/game/gfx/sceneUi.ts`) —
  Mode7Tuner is the one exception, deliberately left off this list (see
  below).
- `protected uiCamera: Phaser.Cameras.Scene2D.Camera` — a second camera,
  added via `this.cameras.add(...)`, fixed at zoom 1 with no
  scroll/bounds/follow. `scrollFactor(0)` content renders at the same
  fixed screen position on any camera regardless of that camera's own
  scroll, so `uiCamera` never needs to track the player.
- `this.cameras.main.ignore(this.uiLayer)` — the world camera never draws
  UI, so its zoom can never distort it.
- `syncUiCameraIgnore()`, run every `update()`: `this.uiCamera.ignore(this.children.list)`
  followed by `this.uiLayer.cameraFilter &= ~this.uiCamera.id` to unmask
  the layer itself (it's a top-level scene child too, so the blanket sweep
  would otherwise catch it). `uiCamera` therefore only ever draws
  `uiLayer`'s contents.

A `Layer`'s `ignore()` sets a bitmask on the **Layer object itself**
(`entry.cameraFilter |= id` in Phaser's `BaseCamera.ignore`; a Layer does
not have `isParent = true`, so it is never expanded into its children —
only `Group` is), and a Layer's own render gate
(`Layer.js`'s `willRender`) checks that single bitmask before drawing any
of its children. That means the ignore relationship is evaluated fresh
every frame from one flag, not baked in at add() time — objects added to
`uiLayer` at any point, including well after camera setup, are correctly
excluded from `uiCamera`'s sweep with no extra bookkeeping. Confirmed
against Phaser's own source (`node_modules/phaser/src/gameobjects/layer/
Layer.js` `addChildCallback` calls `gameObject.removeFromDisplayList()`),
not just inferred from docs.

## Deliberately NOT a mirrored `worldLayer`

The obvious symmetric design — a `worldLayer` that every world object is
explicitly reparented into, with `uiCamera.ignore(worldLayer)` — was
tried first and rejected. World content (tilemap layers, the player,
NPCs, blob shadows, `addProp()` props, the `SlitherFollower`/
`FluffballFollower`/`PiggyFollower` rigs, Mode-7's shader quad and
billboards, and dozens of one-off per-zone cameo sprites and `floatText()`
copies) is created from **dozens of call sites spread across all 38 zone
files**, not one shared choke point. Hand-tracking every one of them into
a `worldLayer` is exhaustive, easy to silently miss (a future zone script
that adds a sprite without knowing the convention regresses silently —
the object simply double-renders, once correctly through the world
camera and once as a frozen "ghost" at its raw unscrolled position through
`uiCamera`), and doesn't scale.

The per-frame negative sweep (`syncUiCameraIgnore`) achieves the identical
observable result — `uiCamera` draws only `uiLayer` — without requiring a
single line of change at any of those world-side call sites: anything not
explicitly parented into `uiLayer` is automatically treated as world
content, present and future, self-healing. The one place this trade
required extra edits was three "end of act" full-screen cards
(`DepthsScene`/`SanctumScene`/`PizzaAscentScene`'s `showEndCard()`) that
draw a screen-fixed backdrop + text above the HUD's depth — those were
moved into `uiLayer` so `uiCamera` (which now renders after `cameras.main`
in draw order) keeps drawing the HUD *under* the card instead of on top of
it, matching the pre-existing depth-sorted look.

`startBattle()`'s flash/fadeOut and `goToZone()`'s fadeOut (previously a
single `cameras.main` call, since there was only one camera) are now
mirrored onto `uiCamera` too, so a battle transition or zone change still
flashes/fades the whole screen — HUD and dialogue box included — instead
of only the world layer. Same reasoning for the zone-entry `fadeIn(400)`
in `create()`.

Mode7Tuner (the Mode-7 debug panel) and the Mode-7 shader quad/billboards
are intentionally left OFF `uiLayer` — they fall through to the default
"world" sweep. This only matters when Mode-7 is active, and Mode-7 always
keeps `cameras.main`'s zoom at 1 (see below), so rendering through the
world camera at zoom 1 is pixel-identical to the old single-camera
behaviour. `FlatZoomTuner` (new, see below) is the one dev panel that
*does* need `uiLayer`: it's tuning the very camera zoom it's drawn under,
so it must stay legible while that zoom changes.

## OverworldScene: flat view by default, Mode-7 behind a flag

`OverworldScene.setupView()` picks the rendering:

- **Default** (`readDebugMode() === "off"`): the flat tilemap, zoomed via
  `this.cameras.main.setZoom(OVERWORLD_FLAT_ZOOM)` — `0.8`. At zoom 1 the
  16×20-tile POC map's north-south span (320px) doesn't quite fit the
  270px-tall viewport; 0.8 was the least-aggressive zoom that reveals the
  whole pass (both gates) in one screen while keeping the player sprite,
  HUD text and tile art crisp — chosen by comparing Playwright screenshots
  at 0.5/0.65/0.75/0.8/0.85/1. **Known limitation, not caused by this
  zoom choice:** the map (256px wide) is narrower than even the OLD
  zoom=1 viewport (480px wide), so dead space past the map's east edge is
  unavoidable at any zoom ≤ 1 regardless of `OVERWORLD_FLAT_ZOOM` — it was
  simply invisible before because Mode-7's shader always painted the full
  screen. Widening the POC map is a content decision, out of scope here.
- **`"mode7"`**: `setupMode7()` runs exactly as before (Mode7Ground +
  Mode7Tuner), and `cameras.main.setZoom(1)` is forced once Mode-7 setup
  succeeds — Mode-7's shader quad and billboards are screen-space content
  that a camera zoom would distort/clip (the identical
  scrollFactor(0)-still-gets-zoomed hazard this whole architecture works
  around for the HUD). If Mode-7 setup throws (no WebGL, shader error),
  the flat *zoomed* view is the fallback rather than the old unzoomed one.
- **`"flat"`**: the flat zoomed view plus `FlatZoomTuner`
  (`src/game/gfx/FlatZoomTuner.ts`), a new small dev panel — same
  +/-/RESET style as Mode7Tuner — for live-tuning `OVERWORLD_FLAT_ZOOM`
  itself.

`readDebugMode()` reuses the existing `mode7tune` URL-param/localStorage
flag, now tri-state instead of boolean: `?mode7tune=1` (or any value that
isn't `"0"` or `"flat"`) means `"mode7"`, so bookmarks/localStorage set
before this change keep behaving exactly as they did (full Mode-7 +
tuner). `?mode7tune=flat` is the new third state. `?mode7tune=0` (or no
flag, the default) is the flat view with no tuner. Persistence to
localStorage is unchanged (the PWA's `display:"fullscreen"` manifest means
an installed app has no address bar to type a query string into after the
first visit).

## Verification

`tsc --noEmit`, full `vitest run` (1288 tests, all pre-existing —
`syncUiCameraIgnore`/the camera split have no dedicated new unit test
since they're Phaser-runtime behaviour with no pure-core counterpart;
`tests/game/` has no existing camera assertions this touched), `npm run
build`, `npm run smoke` (keyboard e2e, all 7 acts) and `npm run
smoke:touch` (touch e2e) both green with zero new failures. Playwright
screenshots confirmed: the flat overworld's HUD/hint text render at normal
size while the world is visibly zoomed out; the inventory menu opens
correctly over the zoomed overworld; a non-overworld zone (the oasis)
renders its HUD and an NPC dialogue box pixel-identically to before
(camera zoom reads back as exactly `1`); Mode-7 debug mode
(`?mode7tune=1`) still renders the full perspective ground, avatar and
billboards with all four Mode7Tuner sliders working; the flat-zoom tuner
mode (`?mode7tune=flat`) renders and live-adjusts the zoom correctly.

# v22: the overworld gets a big world (valleys, a lake, a town, dirt roads)

2026-07-16. The overworld POC (v9/Phase O) was a tiny 16×20 grid: solid
mountain everywhere except one carved pass. `OVERWORLD_FLAT_ZOOM = 0.7`
(v21) made that read as cramped rather than "big" — the whole map barely
exceeded one screenful, so the camera was never really scrolling. The
project owner asked for adjacent valleys on both sides of the mountains, a
lake to the southeast, a town to the northwest, and connected dirt roads
linking everything, without touching Mode-7 or redesigning the existing
pass/stops/gates.

## Grid and layout (`src/game/maps/overworldMap.ts`)

`OVERWORLD_WIDTH`/`OVERWORLD_HEIGHT` grew from 16×20 to **64×64** — big
enough that at zoom 0.7 (viewport ≈ 43×24 tiles) the camera has ~20+ tiles
of scroll room on every axis no matter where the player stands. The
original pass/stops/gates logic (`assignMountainTileNames`,
`centerXForRow`, the S-curve waypoint carve, `OVERWORLD_SOUTH_EXIT` /
`OVERWORLD_NORTH_EXIT` / `OVERWORLD_SOUTH_SPAWN` / `OVERWORLD_NORTH_SPAWN`)
is untouched in shape, just repositioned: the mountain mass is no longer
the whole grid, it's a **spine** in the middle, with the exact same
winding pass carved through it. `PATH_WAYPOINTS` centerX is pinned to 32
(the exit/spawn column, `SPINE_CX`) at both ends of the spine and beyond,
so all the winding happens strictly inside the mountain mass and the pass
meets the gate bands / open valley bands in a straight line.

Everything inside the outer border ring but outside the spine starts as
**open valley** (not mountain) — that's the entire structural change from
v9: valleys aren't a separate carve-out, they're just "not the spine." The
outer border ring (1 tile thick, solid mountain except the two gate bands)
is unchanged in concept, just bigger.

**The spine's shape shipped once as a hand-drawn rectangle
(`SPINE_X1..SPINE_X2 × SPINE_Y1..SPINE_Y2`, 22..42 × 8..55) and the lake
as a hand-drawn ellipse — both were rejected on review** ("mountain ranges
are never rectangular... you're trying to procedurally draw a world map
using your own thoughts instead of writing an algorithm that generates it
one time with organic shapes") and reworked into the procedural generators
below, same day. `SPINE_X1`/`SPINE_X2` no longer exist in the source;
`SPINE_CX` (nominal center) and `SPINE_NOMINAL_HALF_WIDTH` (nominal
half-width, only reached in the un-tapered middle) replace them as inputs
to the generator, not the boundary itself.

## The mountain spine: organic, solid and connected by construction

`buildSpineBounds()` computes one `[left(y), right(y)]` interval per row
instead of a fixed rectangle:

- **East/west boundary**: two octaves of seeded 1D value noise per edge
  (`smoothNoise1D` — random control points every few cells, smoothstep-
  eased between them so the boundary wanders instead of jittering per
  cell) added to the nominal half-width. Two octaves (a slow wide wander +
  a faster small ripple, distinct seeds) read as a genuinely irregular
  silhouette rather than one smooth sine-like curve.
- **North/south "cap"**: rather than a second, independent per-column
  noise field (the project owner's other suggested option), the SAME
  per-row half-width is tapered smoothly to zero over `SPINE_TAPER_ROWS`
  (6) rows at each end via `spineHalfWidthTaper` (smoothstep 0→1). This
  was a deliberate simplification over intersecting two independent noisy
  boundaries: doing so risks a row's valid-x interval getting cut into two
  separate pieces by the column-noise dipping below that row in the middle
  of an otherwise-open span — an actual hole in the mountain mass, which
  would need a flood-fill-and-patch cleanup pass to catch. Tapering the
  width of the SAME per-row interval instead guarantees every row's
  mountain cells are exactly one contiguous run, so a hole is structurally
  impossible, while still giving a non-rectangular, organically-tapering
  north/south termination (a real range trailing into foothills, not a
  flat cap).
- **Connectivity**: `smoothNoise1D`'s smoothstep easing bounds how much
  `left(y)`/`right(y)` can move between consecutive rows to something
  small relative to the interval's own width in the un-tapered middle
  (nominal half-width 10 vs. ≤4 combined worst-case noise per side), so
  adjacent rows' intervals always overlap and the whole spine is one
  connected mass — again by construction, not a post-hoc check. Both the
  taper and the noise terms are scaled by the SAME taper value, so
  `left <= right` is guaranteed at every row (worst case the width and the
  noise both shrink to exactly 0 together at the very ends, never
  inverting).

Verified, not just argued: `tests/game/maps.test.ts` gained "carves a pass
that stays inside the spine's own generated bounds, flanked by mountain on
both sides" (samples real rows, confirms a walkable gap strictly inside
the actual generated `[left,right]`, not merely reachable some other way)
and "keeps the spine a genuinely organic (non-rectangular) silhouette"
(samples several un-tapered rows and confirms the left/right bounds
actually differ row to row — a regression back to a fixed rectangle would
fail this). A standalone connectivity check (BFS over every walkable cell
from the south spawn, comparing reached-count to total-walkable-count —
see "the water2 solidity bug" below for what this actually caught) is not
a checked-in test by itself but is exactly what the existing "lets the
player walk the whole pass" / enclosure tests exercise implicitly across
the whole map, not just the pass.

## The lake: a noisy-radius blob

`buildLakeRadiusFn()` returns `radius(angle)`: a base radius (7.5, in an
aspect-normalized space — `LAKE_ASPECT_X=1.3`/`LAKE_ASPECT_Y=0.85`
elongate the blob east-west before noise, since a lake reads more natural
wider than tall) perturbed by 3 low-order sine harmonics (periods 2, 3, 5)
with seeded random amplitude (~22% of the base radius each) and phase.
Clamped to never drop below 40% of the base radius, which is what
guarantees the blob stays star-shaped around its center (and therefore a
single connected region with no holes) regardless of how the harmonics
combine at any given angle — a radius that could hit zero or go negative
would pinch the blob apart or puncture it.

The fill loop walks a bounding box around `(LAKE_CX, LAKE_CY) = (52, 47)`
and keeps a cell if its aspect-normalized distance from center is under
`radius(angle)` at that cell's angle, with one extra guard:
`x <= spineRight[y]` is skipped unconditionally, so the lake can never
place water on/behind the spine's own (organic, per-row) east wall no
matter where either boundary's noise happens to land on a given row.
Wherever the two organically-generated shapes end up close together,
that's where the screeWater tileset (below) actually gets exercised —
checked by `tests/game/maps.test.ts`'s "screeWater cells actually exist"
style assertions, not assumed from the nominal center positions.

`water`/`water2` (the same pair the wash pool already used) fill cells
that pass the test; the mask-based `lakeShore` autotile (see its own
section below) dresses the shoreline afterward.

Verified: "keeps the lake a genuinely organic (non-elliptical) silhouette"
samples the shore distance from the nominal center at 8 angles and
confirms real variation beyond what pure aspect-ratio scaling alone would
produce (a hand-tuned ellipse would still show *some* spread from the
aspect ratio; the noisy-radius blob's harmonics push it well past that).

## The town (northwest)

Three small rectangular buildings (`placeBuilding`, 4×4 cells: a roof cap
row, plain wall body, a door-centered front row, one window punched into
the first wall row) around a plaza the road's north branch feeds into.
Entirely solid decor (walkable-up-to, no interior — same role as
mineTimber/cart or truckCab/truckBox), dressed with three wall variants
(`townWall`/`townWall2`/`townWall3`) and two roof colourways
(`townRoof`/`townRoof2`) so the cluster doesn't wallpaper as one repeated
box, plus a standalone `townSign` post near the plaza entrance.

## The dirt-road autotile (`tools/pipeline/src/tileset2.ts`)

16 tiles (`road0`..`road15`), one per 4-bit N/E/S/W neighbor mask — **the
same bit convention as owMountains/`assignMountainTileNames` reused
verbatim** (bit0=N=1, bit1=E=2, bit2=S=4, bit3=W=8). Thin by design (the
project owner: "roads don't need to be very wide, maybe one pixel for the
actual road and a pixel on each side for the transition to sand"): a fixed
pixel lane (column/row 7 = the 1px hardpacked-`umber` core, 6 and 8 = a
1px broken-`clay` transition into sand on each side — the same
fixed-lane trick `duneRidges` in `tileset.ts` uses so neighbouring tiles'
bands always line up) with arms drawn from the tile center out to
whichever edges the mask has set.

`overworldMap.ts`'s `markRoadCells` marks a plain `boolean[][]` grid (not
tile names) for the whole network: the pass's exact walkable centerline
(`centerXForRow(y)` for every spine row) plus axis-aligned stems/branches
connecting the south stop → the wash → the lake, and the north stop → the
mine mouth → the town. `applyOverworldAutotile`'s new step 5 turns that
into `road{mask}` ground names, reading the mask from the frozen `isRoad`
grid — never from `ground` mid-mutation — deliberately avoiding the
mutate-before-read bug `assignMountainTileNames`'s own doc comment
describes (see that comment for the original incident).

**Two real bugs hit and fixed while building this, worth keeping as a
record:**

1. A pass "one cell per row, x drifting toward the next waypoint" walk is
   only 8-connected wherever x changes between consecutive rows (a
   diagonal step shares no N/E/S/W edge with its predecessor) — this
   produced dozens of isolated `road0` (mask-0, no neighbors) cells the
   first time the centerline was marked. Fixed by bridging each row's old
   column to the new one with a short horizontal run at the row being
   left (still following the same centerline, just not skipping the
   corner), keeping the whole line 4-connected end to end. Caught by a
   dedicated test (`tests/game/maps.test.ts`, "lays a connected dirt-road
   autotile...", `roadMasksPresent.has(0)` must be `false`).
2. The road's south stem/branch initially ran directly adjacent to the
   wash pool (one cell away in one case, sharing a whole edge in another
   after a first reposition), and the road ground pass runs *after* the
   coast pass and unconditionally overwrites its own cells — silently
   eating the pool's coast tiles on the side facing the road and leaving a
   butt-jointed shore. Fixed by routing the road stem/branch a clean 2+
   rows off the pool's own footprint. Caught by the existing "rings every
   body of water with the coast surf set" test once it was generalized
   (see below) rather than scoped to just the original 2×2 pool.

## The screeWater tileset (mountain ↔ water)

`screeWaterN/E/S/W/NE/NW/SE/SW` (8 tiles, `tools/pipeline/src/tileset2.ts`)
— for wherever the lake touches the spine instead of open sand. Built
**identically** to the existing `screeSand` set two tiles above it in the
same file (`makeEdgeSet(scree, ..., {style: "fingers", fingerColor:
"clay", bandDepth: 5})`), with the second argument swapped from the sand
reference tile to `water(0)`: the project owner was explicit this should
be "the exact same style of tileset as mountains/sand but with water
instead of sand," not a new visual language. Scree still owns the border
(fingers reach into the water-adjacent band) exactly like screeSand does
against sand; no inner-corner set, matching screeSand's own 8-tile shape.
`applyOverworldAutotile`'s step 3b assigns these with the same 8-branch
single-side/corner mask logic as the existing screeSand step (step 3),
just testing `isWater` on each side instead of open sand.

**Kept at 8 pieces (not widened to the full 16-mask treatment) after
review, deliberately** — once the spine and lake both became organic, a
mountain edge cell touching a genuine MIX of open sand on one side and
water on another became possible (an irregular coastline can nick a
mountain corner in a way a hand-placed rectangle/ellipse never could). The
project owner explicitly flagged this as worth checking after the
organic-shapes rework. Reviewed on the actual generated map
(`preview/render-overworld.mts` composites, "the mountain-spine + lake
meeting point" crop below): the mixed cases that do occur fall through to
whichever single-side/corner branch matches (or plain scree for a genuine
3+-side/opposite-side case), the same fallback screeSand's own 8-piece set
already relied on, and they read fine — a mountain corner with sand on one
face and water on another still shows scree rock texture at the corner
itself with the correct single-material transition on each flanking edge,
which is what a real coastline meeting a rock outcrop actually looks like.
A full mask-aware mixed-material treatment was judged unnecessary
complexity for a transition that only affects a handful of corner cells
per map.

## The lakeShore tileset — sand↔water, ported from owMountains' geometry

The original coast ring (`coastN/E/S/W/NE/NW/SE/SW/InNE/InNW/InSE/InSW`, 12
tiles, `makeEdgeSet(sandRef, water(0), {style:"surf", ...})`) was rejected
on the same review as the rectangle/ellipse: "those shore tiles are not
working — they look like the entire edge of the lake has a concrete
barrier... the sand water transition should use the same type of 16 tile
set that the mountains use but with sand and water." A straight-edge +
corner set literally cannot round to an organic shoreline; a 4-bit
neighbor-mask autotile can, the same way owMountains rounds a mountain
mass's boundary.

**`tools/pipeline/src/roundedMask.ts`** (new file): `owMountains.ts`'s
`mountainDistToGrass` — the pure per-quadrant rounded-corner distance
field (no RNG, a function of `mask`/`x`/`y`/`curveRadius` only) — extracted
here unchanged as `roundedMaskDist`, plus `DEFAULT_ROUNDED_CURVE_RADIUS =
16.5` (the same tuned constant). `owMountains.ts`'s own
`MOUNTAIN_CURVE_RADIUS`/`mountainDistToGrass` now just re-export/wrap
these, so every existing import (`tests/pipeline/owMountains.test.ts`)
keeps working unchanged — this was a pure extraction, zero behavior
change, confirmed by the existing owMountains test suite staying green
byte-for-byte.

**`tools/pipeline/src/lakeShore.ts`** (new file): 16 tiles
(`lakeShore0`..`lakeShore15`, one per mask, **no variant dimension** —
unlike owMountains' 5 variants × 16 masks, a single family was judged
sufficient: water tiles are already visually simple, and this dresses one
lake plus one small pool, not a sprawling repeated landscape texture where
variant repetition would actually be visible). Same ring-band structure as
`generateMountainTile` (`fuzzyDist<1`/`<2`/`<4`/else), reusing `±0.75`
uniform RNG fuzz, but sand/water coloring instead of rock: `<1` wet-sand
edge (mostly the shared `sandBase(1)` art, sampled by pixel so it
continues any neighbouring plain-sand tile, with a bone foam fleck at the
waterline), `<2` broken bone/skyBlue surf fringe, `<4` skyBlue/slate
shallow band, else sampled directly from `water(0)`'s own pixel art (so a
shoreline tile's deep-water pixels seam exactly into an adjacent plain
water cell).

**Mask semantics deliberately mirror owMountains, not the old coast set**:
a lakeShore tile is placed on a WATER cell, mask = which N/E/S/W neighbors
are ALSO water (bit set = same material present, exactly like "mountain
present" for owMountains) — not on the land cell with "which side is
water" like the old `coastN`/etc. naming implied. This flips which side of
the boundary "owns" the tile, but it's what makes reusing the exact same
distance field correct: `roundedMaskDist`'s "deep interior" reading (mask
15, all sides same-material) is what should render as uninterrupted open
water, and only the WATER cell's own mask can express that.

`applyOverworldAutotile`'s step 4 was rewritten from the old 8-branch
land-side if/else into a proper mask computation, run against a **frozen
snapshot** of "is this cell water" (`isWaterSnapshot`, taken before this
step mutates any cell) — the exact same mutate-before-read discipline
`assignMountainTileNames`'s own doc comment describes, now applied a
second time for a second autotile pass. `isMtn`'s sibling `isWater` helper
(used by steps 2/3) was widened to also match the `lakeShore*` prefix (not
just literal `"water"`/`"water2"`), so any code running AFTER step 4 that
checks "is this a water cell" (step 5's defensive road-vs-water guard)
still gets the right answer once step 4 has renamed shoreline cells — step
3b, which specifically needs to see the pre-rename `"water"`/`"water2"`
names, still runs before step 4, so it's never affected either way.

**Mask 15 (fully water-surrounded) is deliberately left as plain
alternating `water`/`water2`, not `lakeShore15`**: `lakeShore15` samples
`water(0)` uninterrupted at every pixel (dist stays ≥4 across the whole
tile at that mask), so a big lake's interior tiling that ONE frame would
read flatter than the established two-phase dash-offset pair. Shoreline
cells (mask 0..14) get the new rounded treatment; deep interior keeps the
existing look. This is a deliberate blend of the two systems, documented
in `lakeShore.ts`'s own module doc, not an oversight.

The wash pool goes through the exact same step 4 pass as the lake — no
separate code path, per the project owner's "no reason to keep two
different shore-tile mechanisms."

## The water2 solidity bug (found by the organic lake, not by eye)

`src/game/maps/types.ts`'s `SOLID_TILE_NAMES` listed `"water"` as solid
but never `"water2"` — every OTHER act's water pair lists both phases
(`seaWater`/`seaWater2`, `groveWater`/`groveWater2`, `reefWater`/
`reefWater2`), but the original tiles.png pair's entry only ever had one.
The v9 POC's tiny 2×2 wash pool never had a test that tried to walk INTO
it, so a checkerboard of solid `water` cells with walkable `water2` cells
between them — each 4-directionally isolated from every other walkable
cell around it, since all its cardinal neighbors are the solid phase —
shipped unnoticed. The v22 lake is big enough (146 plain-water interior
cells) that this produced a real, non-hypothetical disconnected-pocket
bug: a BFS reachability check (south spawn → every walkable cell) found 49
cells the player could stand on but never walk to. Fixed by adding
`"water2"` to `SOLID_TILE_NAMES`, matching the established both-phases-
solid convention every other act already used. Verified no existing
reachability assertion depended on `water2` being walkable (`oasisMap.ts`/
`depthsMap.ts` both use the same `water`/`water2` edge-dither pattern for
their own pools, and neither has a test that walks onto a pool cell).

## Sheet/consumer plumbing

screeWater, road, town and lakeShore were all appended to
`tiles2.png`/`TILE2_NAMES` rather than new sheets (avoiding the
ZoneScene/BootScene/manifest wiring a whole new tileset needs — the
precedent `owMountains.png` set — since every consumer already resolves
tiles2 names generically off `Object.keys(MANIFEST.tiles2.names).length`).
The 12 old `coast*` tiles were REMOVED (not just left unused) since
lakeShore fully supersedes them and this whole feature was still
unshipped/uncommitted — every tile from `screeSandN` onward was
renumbered downward by 12 as a result, a deliberate one-time reshuffle,
not an append-only violation of any previously-shipped index. The town kit
grew from 8 to 12 tiles (`townWall4`/`townRoof3`/`townWindow2`/
`townDoor2` added) purely to keep the sheet's tile count a multiple of its
fixed 8-column layout after the coast removal freed up slots at a
different offset than the new 32 tiles needed. Net: `tiles2.png` is 96
tiles (128×192), up from the pre-rework 88 (128×176). `src/game/maps/
types.ts`'s `SOLID_TILE_NAMES` gained the (now eight) town building names;
`screeWater*`/`road*`/`lakeShore*` are all ground-layer names and stay out
of that list.

`tests/pipeline/lakeShore.test.ts` (new file, mirrors
`tests/pipeline/owMountains.test.ts`'s shape): layout/naming, determinism,
the geometric contract evaluated directly against `roundedMaskDist`
(mask=15 always 999/deep-interior, mask=0 never reaches the deep-interior
band), and an explicit check that `TILE2_NAMES` and `lakeShoreNames` stay
in sync at the exact same offset — the manual name literal in
`TILE2_NAMES` and the generated `lakeShoreNames` array are two separate
sources that could drift, so this test exists specifically to catch that
rather than trusting them to agree.

## Test changes (`tests/game/maps.test.ts`, `tests/pipeline/*.test.ts`)

- The old "is mostly mountain: the walkable pass is a small fraction of
  the map" assertion (`walkable < (w*h)/3`) is now backwards — v22
  deliberately makes the map mostly open. Replaced with "is mostly open:
  valleys flank a narrower mountain spine" (`walkable > (w*h)/2`); measured
  empirically after the redesign at ~70% walkable.
- The old "rings the spring pool with the coast surf set" test was
  replaced by "dresses every water cell with the mask-correct lakeShore
  tile (mask 15 keeps plain water)" — recomputes the expected mask per
  water cell from a fresh neighbor reading and checks the ground name
  matches exactly (`lakeShore{mask}` or plain water at mask 15), rather
  than checking for the old fixed `coastN`-style literal names, which no
  longer exist.
- New: "carves a pass that stays inside the spine's own generated bounds,
  flanked by mountain on both sides", "keeps the town clear of the spine's
  generated west edge", "keeps the spine a genuinely organic
  (non-rectangular) silhouette", "keeps the lake a genuinely organic
  (non-elliptical) silhouette" — all described in their own sections
  above; "uses scree↔water finger transitions where the mountain spine
  meets the lake", "lays a connected dirt-road autotile linking the two
  stops to the town and the lake" (asserts >1 distinct mask present and
  mask 0 absent), and "lets the player walk from either stop out to the
  town and the lake via the roads" (BFS reachability to each road
  network's own hub cell from both spawns) all carried over from the
  first v22 pass, unchanged.
- `SCREE_FAMILY` (the "scree ground under every mountain cell" test)
  still includes the 8 `screeWater*` names alongside `screeSand*`.
- `tests/pipeline/act1.test.ts`: the hardcoded `tiles2.names` snapshot,
  the `128×192` sheet-size expectation and the tile-count formula for
  `tile2Frames()` (`56 - 12 + 8 + 16 + 12 + 16`, spelled out rather than a
  bare number so the removal/addition arithmetic stays legible) updated
  for the coast removal + lakeShore/town-padding additions.
- `tests/pipeline/determinism.test.ts`: `tiles2`'s sha256 re-pinned a
  fourth time (see the file's own dated comment for the full history).

## Verification

`tsc --noEmit`, full `vitest run` (1304 tests, all green), `npm run
build`, `npm run smoke` and `npm run smoke:touch` (keyboard/touch e2e)
all green. Rendered and reviewed actual composites via the existing
`preview/render-overworld.mts` (still unchanged — generic manifest-based
tile resolution) plus a scratch cropping script (deleted before
finishing, never committed): the full 64×64 map now reads as a genuinely
irregular mountain range (bulging, notching, tapering to points at both
ends — not a rectangle with fuzzy edges) with the winding pass still
clearly readable through it; the lake reads as a natural rounded blob with
real coves and points, not a fuzzy oval; a tight crop of the lake's
shoreline shows a proper graduated beach (sand → foam → shallows → deep
water, following the actual organic curve) instead of the previous
straight-edge "concrete barrier" look; a tight crop of the mountain-spine/
lake meeting point confirms the screeWater fringe still renders correctly
against the new irregular boundary; the town cluster and the road
junction/switchback composites are unchanged in character from the first
v22 pass (neither the town nor the road network needed to move — their
nominal coordinates were verified, not just assumed, against the actual
generated spine/lake shapes by the new "keeps the town clear.../lets the
player walk...via the roads" tests). Mode-7/`OverworldScene.ts` were not
touched at all, in either v22 pass — this remains a pure map-data
(`overworldMap.ts`) and pipeline-tileset (`tools/pipeline/src/tileset2.ts`,
plus the two new pipeline files `roundedMask.ts`/`lakeShore.ts`) change,
with `src/game/maps/types.ts` gaining the town's solid names and the
`water2` solidity fix.

# v23: the overworld gets rebuilt terrain-first (no pre-decided path)

2026-07-16. The project owner rejected v22's whole approach, not just its
geometry: "so maybe we're going about this the wrong way. how about let's
make a new map entirely generated. we have this one as a proof of concept
so save it. we might come back to it. but right now we're trying to build
world around an existing zigzag path. and I think that's the wrong
approach. let's build the world first. then add in the mine and truck
turnover spot and spring into that world. we can add barriers after it's
made." v22 (even after its own organic-shapes rework, above) still decided
`PATH_WAYPOINTS` and the gate x-position (`SPINE_CX = 32`) FIRST and
carved a mountain spine around that fixed shape — landmarks were the
thing terrain was built around, backwards from what the owner wanted.

**v22 is preserved verbatim, not deleted**, as `src/game/maps/
overworldMapPocV1.ts` — every exported identifier suffixed `_POC`/`Poc`
(`buildOverworldMapPoc`, `OVERWORLD_WIDTH_POC`, etc.) so it can never
collide with `overworldMap.ts`'s own exports. It still type-checks (`tsc`
covers it) but nothing in `src/` imports it — dead code kept on purpose,
per "we might come back to it." `overworldMap.ts` itself was rewritten
from scratch as three sequential, genuinely separate phases.

## Phase 1 — terrain, with zero knowledge of any landmark or gate position

`generateWorld()`'s first phase places 6 mountain masses (`TERRAIN_TIERS`:
2 elongated "ranges", 2 rounder "massifs", 2 small "buttes") using a
seeded rng stream (`TERRAIN_SEED`) that never reads or references a gate
x-coordinate, an exit rect, or a landmark position — those don't exist
yet at this point in the build. This is the literal fix for the owner's
complaint: terrain generation and landmark placement are now two separate
functions run in a fixed order, not one intertwined pass.

**Each mass is v22's own lake technique** (`buildLakeRadiusFn`'s "noisy-
radius blob": a base radius perturbed by 3 seeded sine harmonics, periods
2/3/5, clamped well above zero so the shape stays star-shaped/simply-
connected around its own center) **generalized from "one lake" to "any
number of independently-shaped, independently-rotated masses"**
(`massRadiusFactorAt`/`massContains` in `overworldMap.ts`): each mass adds
its own rotation angle and independent long/short-axis aspect on top of
the same radius-harmonic core, so the SAME primitive produces both round
buttes (aspect ≈ 1) and elongated ranges (aspect up to 1.6:0.65) at any
orientation, not just axis-aligned. Star-shaped by construction exactly
like the lake was — no flood-fill cleanup pass, same guarantee.

`sampleMaxFactor` (72-sample angular scan, +5% safety margin — comfortably
resolves the highest harmonic frequency, k=5) computes each mass's TRUE
peak radius before it's placed, rather than a loose worst-case bound; this
makes `placeMass`'s margin/spacing math exact instead of overly
conservative, which matters because an overly conservative bound made
early drafts of this file unable to fit two "range"-tier masses in a
64-row map at all. `placeMass` rejection-samples a position (`MASS_MIN_GAP
= 5` from every other already-placed mass or landmark-corridor keep-clear
box, `MASS_EDGE_MARGIN = 3` from the literal map edge), and if no position
fits at the drawn size, shrinks `base` by a fixed factor (harmonics are
proportional to `base`, so shrinking is a pure rescale, not a re-roll) and
retries, down to a floor — deterministic, and a mass that truly can't fit
is simply omitted rather than blocking the build or violating a margin.

## Phase 2 — landmarks placed into whatever phase 1 actually left open

`findGateX` scans the north (`y=0`) and south (`y=height-1`) edges for an
x position where a `(2×GATE_SCAN_HALF+1)`-wide, `CORRIDOR_DEPTH`-deep box
is entirely mountain-free, radiating outward from the map's horizontal
center (`center, center±1, center±2, ...`) so a central gate is preferred
when available but the search genuinely adapts to wherever phase 1's
masses actually ended up — this is the "real freedom to choose WHERE
along each edge the gate sits" the task called for, not a re-hardcoded
`x=32`. (A fallback exists — clear the few blocking cells at whichever
column has the fewest, rather than hand-carving a whole corridor — for
the case where literally every column is blocked at every depth down to a
floor; not exercised by the current seeds, kept for robustness.)

Both landmarks are placed with fixed offsets from their own discovered
gate x (mine: `mineTimber`×2 + `cart` + `joshuaTrunk`×2 north; spring:
`truckBox`/`truckCab` + a 2×2 water pool + `joshuaTrunk`×2 south) — the
gate POSITION is the only thing computed; "what a mine mouth looks like"
is authored flavor, same as it always was. `OVERWORLD_SOUTH_EXIT`/
`OVERWORLD_NORTH_EXIT`/`OVERWORLD_SOUTH_SPAWN`/`OVERWORLD_NORTH_SPAWN` are
now derived from the discovered gate x at module load (`generateWorld()`
runs once to populate them, then `buildOverworldMap()` re-runs it fresh
on every call — deterministic, so both produce identical results; the
re-run is cheap for a 64×64 grid and avoids the exported constants ever
aliasing a mutable array a caller could corrupt).

## Phase 3 — barriers, added last, allowed to see the landmarks

Up to 2 more masses (`BARRIER_TIER`, a bit smaller than the "range" tier)
are placed using the exact same `placeMass` primitive, but now with the
north/south landmark corridor boxes passed in as `keepClear` — the one
place in the whole build where mass placement is landmark-aware, exactly
matching "add barriers after it's made." A barrier that can't find room
without touching a corridor or another mass too closely is simply
omitted, same as any other mass — nothing about the map's core structure
depends on either barrier existing.

**Verified, not eyeballed**: `tests/game/maps.test.ts`'s new "reaches
every walkable cell on the map from at least one of the two spawns" is a
full-grid multi-source BFS (`reachableSet`, walkable-cell count vs.
reached-cell count from both spawns) — the HARD requirement the task
specified, checked directly rather than inferred from a few named
point-to-point checks. It currently passes with zero unreached cells.

## The border: still solid everywhere, no longer a flat 1-cell rectangle

The owner's core objection ("mountain ranges are never rectangular") also
applies at the map's own edge — v22's border was a uniform 1-cell-thick
ring. `applyBorder` keeps the LITERAL edge ring unconditionally solid
(enclosure holds no matter what) but adds an inward "buffer" of 0–3 extra
cells per edge position, driven by the same smoothed 1D noise v22's own
spine boundary used (`smoothNoise1D`, ported unchanged) — an irregular,
variable-thickness rim instead of one flat frame. `MASS_EDGE_MARGIN = 3`
on every interior mass guarantees rows/columns 0..2 next to any edge are
never a terrain mass, which is what lets the new "keeps the outer border
an irregular, variable-thickness rim" test measure the buffer's own depth
generically (by sampling border-only columns) without needing to know
where any mass actually landed.

## What's explicitly NOT in this pass

The lake, the town, and the dirt-road network from v22 are out of scope
per the owner's own staged instructions ("then add in the mine and truck
turnover spot and spring into that world. we can add barriers after") —
they still exist, fully working, in `overworldMapPocV1.ts` if a future
pass wants to layer them back onto the new terrain. `applyOverworldAutotile`
correspondingly drops v22's road-autotile step (step 5) and the town-
building placement entirely; the scree/screeShade/screeSand/screeWater/
lakeShore dressing steps are kept unchanged and generic (they already
never assumed the mountain shape was "a spine" or the water body was "the
lake" — they just read whichever cells the current build actually
produced mountain/water).

## Test changes (`tests/game/maps.test.ts`)

The whole "overworld map" describe block was rewritten, not just
edited — the old spine/lake/road/town-specific assertions
(`SPINE_CX`-adjacent bounds checks, lake-ellipse sampling, road mask
variety, town-clearance box) don't apply to an architecture with none of
those fixed features. New coverage: the full-grid BFS reachability
requirement above; "scatters multiple separate mountain masses across the
map, not one wall or blob" (8-connected flood fill over interior mountain
decor cells, asserts ≥3 real components and that no single one exceeds
60% of total mountain area — measured empirically at 7 components,
largest at ~24%, for the current seeds); "keeps the outer border an
irregular, variable-thickness rim"; "shows real owMountain texture
variety" (≥3 variants, ≥5 masks — measured at all 5 variants, 13 masks);
both landmark-placement tests now also assert positional proximity to
their own discovered gate x (`Math.abs(x - gateCx) <= 8`) rather than just
"the decor name exists somewhere on the map." The lakeShore mask-dressing
test's thresholds were lowered from v22's big-lake numbers (`shoreCells >
20`) to match the spring pool's real size (a 2×2 pool has exactly 4
shore cells, all with distinct masks — asserted `>= 4`/`>= 2`).

## Verification

`tsc --noEmit`, full `vitest run` (1302 tests, all green — 1 test file
touched), `npm run build`, `npm run smoke` and `npm run smoke:touch`
(keyboard/touch e2e) all green. Rendered and reviewed actual composites
via the existing `preview/render-overworld.mts` (unchanged — generic
manifest-based tile resolution) plus a scratch cropping script (deleted
before finishing, never committed): the full 64×64 map reads as genuinely
scattered organic ranges/buttes of varied size with open valley between
and around them, not a rectangle or a single spine bisecting the map; the
outer border shows a visibly irregular, varying-thickness rim rather than
a flat frame; a crop of the mine-mouth stop shows both `mineTimber`
uprights, the `cart`, and open sand connecting north to the interior; a
crop of the spring/truck stop shows the truck, both joshua trees, and the
2×2 pool dressed with 4 distinct `lakeShore{mask}` tiles forming a real
rounded-corner beach, not a straight edge; the mountain massing itself
shows real texture variety (multiple `owMountain{0..4}` variants and a
wide spread of masks visible across different masses, not one repeated
tile — the exact bug `assignMountainTileNames`'s own doc comment
describes, re-verified here since this function's snapshot-before-mutate
discipline was ported unchanged but is exercised against entirely new
mass shapes). A separate script cross-checked component connectivity
directly (8-connected flood fill including the border ring): the border
splits into exactly 2 pieces (the two gate openings, as expected from
removing 2 short arcs from one closed loop) and 7 further, well-separated
terrain/barrier masses exist with no evidence of a mass discretizing into
spurious disconnected fragments. Mode-7/`OverworldScene.ts` were not
touched — this remains a pure map-data (`overworldMap.ts`) change; no
`tools/pipeline/` files were touched either, since every tile name this
pass uses (`owMountain*`, `scree*`, `lakeShore*`, `mineTimber`, `cart`,
`truckCab`/`truckBox`, `joshuaTrunk`, `creosote`, `bones`) already shipped
in v22 or earlier.

# v24: the two stops move interior, and a human-touch map editor

2026-07-16. Two connected changes to the same terrain-first overworld.

**Interior stops.** The project owner: "I don't want the gates and spawns
at the edges of the map." The mine mouth (north) and the spring/truck stop
(south) are no longer openings punched through the map's edge — they are
INTERIOR landmarks you walk up to, and the mountain border is now FULLY
closed on all four sides (the v23 enclosure test that allowed two edge gate
bands became a plain "every border cell solid" check). `overworldMap.ts`:
`findGateX` (edge scan) is replaced by `findInteriorStop`, which radiates
out from a target point set well inside the map (`STOP_INSET = 12`) until a
stop's whole clearing is free of mountain, so a stop lands in genuinely open
desert rather than punching a hole in a range. Each stop's exit is a 3-wide
band of threshold sand at the stop (`openStopExit`), and its arrival spawn
sits two rows clear of that band so re-entering the overworld never lands
you back on the exit tile (the exit-trigger check in `ZoneScene.update` has
no just-spawned grace, so this offset is load-bearing — a map test asserts
each spawn is off its own exit band). Barriers (phase 3) take the two stop
clearings as keep-clear boxes. `OverworldScene`/`MineEntranceScene`/
`OasisScene` were not touched: they already consume `OVERWORLD_*_EXIT`
(now interior rects) and `OVERWORLD_*_SPAWN` (now interior points) as
opaque values.

**The human-touch editor (`tools/mapeditor`, `npm run mapeditor`).** A
self-contained HTML tool for hand-authoring the overworld at the SEMANTIC
layer, so a person can shape it without fighting the autotiler. It exports
an `AuthoredOverworld` — a compact, diff-friendly layout: terrain rows of
`.`/`#`/`~` (sand/mountain/water), a landmark list, and the two stops as
interior `northGate`/`northSpawn`/`southGate`/`southSpawn` points — never
concrete `owMountain*`/`scree*`/`lakeShore*` names. `buildOverworldMap()`
finishes an authored layout (dropped into `overworldMap.authored.ts`, `null`
by default so the procedural build ships unchanged) through the SAME passes
as the generator (`finishAuthoredLayout` reuses `assignMountainTileNames` +
`applyOverworldAutotile` + `applyScatter`), so a hand-drawn map tiles
identically to a generated one. `deriveAuthoredLayout` is the inverse (the
editor's seed); a map test asserts `buildAuthoredMap(deriveAuthoredLayout(
map)) === map` byte-for-byte. The editor previews the real autotiled result
with a JS port of the finishing passes, proven byte-identical to the TS
`buildAuthoredMap` on both the seed and an edited layout, and mirrors the
BFS reachability test as a live overlay so a walled-off pocket shows up
before export. No `tools/pipeline/` files were touched — every tile name is
unchanged from v23.

**First shipped authored map + the test split.** The owner hand-authored a
full Open Desert (a central basin threaded with mountain ranges, a river/lake
down the east side, mine mouth and spring stops) and asked to ship it, so
`overworldMap.authored.ts` is now non-null. A hand-authored world can
DELIBERATELY wall off an "outside desert" you never reach (the mountain ranges
cut the central play area off from the rest — the owner's original ask), which
the generator's "every walkable cell reachable" invariant forbids. So the
overworld tests split in two: `describe("… procedural generator …")` tests the
GENERATOR against its own build (`buildProceduralOverworld()`, which ignores
the override) with the strict invariants (fully-closed border, every cell
reachable, landmarks hugging their gate); `describe("… shipped build …")` tests
whatever `buildOverworldMap()` actually returns with PLAYABILITY invariants
only — correct size/names, valid walkable stops, each spawn off its exit band,
and a connected play path (from the south/entry spawn you can reach both exits
and the mine-side spawn). The editor's connectivity overlay mirrors that play-
path check rather than raw reachability, so an intentional outside reads as
"ok" and only a genuinely cut-off stop warns.

# v25: the flat overworld bakes its ground to one texture (seam fix)

2026-07-17. The flat overworld showed faint horizontal lines that flashed
on and off as you moved — a rendering artifact, not map data. Root cause:
the overworld is the ONLY zone drawn at a *fractional* camera zoom
(`OVERWORLD_FLAT_ZOOM = 0.7`); every other zone renders at integer zoom 1.
At zoom 1 each 16px tile quad is NEAREST-sampled 1:1, exact and seam-free.
At 0.7 each tile minifies to ~11px, so whole source rows/columns get
dropped by the NEAREST sampler — and *which* ones drop shifts every
sub-pixel scroll step, flashing dark tile-edge pixels in and out (verified:
the seam rows are darker adjacent-tile content, NOT the background showing
through a geometric gap — a magenta-background probe found 0% background
pixels on the seam rows). `roundPixels` on/off made no difference; only
integer zoom removed it, confirming minification aliasing as the cause.

**Fix (`ScaledGroundView`, `src/game/gfx/`).** A shared component every
zone can use: it composites the below-actor tile layers (ground + decor)
ONCE into a single `RenderTexture` sized to the map and draws that in their
place, `LINEAR`-filtered; the live layers stay put but invisible, still
driving collision. Two things had to be true together: (1) baking to one
contiguous texture removes the packed-tileset atlas boundaries, so LINEAR
can't bleed one tile into its neighbour the way it does on the shared
`tiles*`/`owMountains` sheets (plain LINEAR on the atlases produces a full
GRID of bleed lines — worse); (2) LINEAR then resamples that one image
smoothly and, crucially, *stably* as the camera scrolls, so no rows flash.
Same single-texture idea Mode-7 already uses (`Mode7Ground.paintGroundTexture`
bakes the whole map to one canvas texture). The RT sits at `GROUND_DEPTH`
(below the y-sorted player, NPCs and shadows). Player sprite, HUD and hint
text are unaffected — they render as their own quads through the same camera
and stay crisp.

`OverworldScene` is the only caller today (the only zone drawn zoomed out at
a *fractional* zoom); integer-zoom zones are seam-free already and a LINEAR
bake would only soften them, so they keep the plain `ZoneScene` tilemap path
untouched. The component is the deliberate seam of abstraction for later map
growth: the whole-map bake is O(map) and caps at the GPU max texture size
(~4096px on mobile — a 256×256-tile map; up to 16384 on desktop), well above
the 64×64 (1024px) overworld. When a map outgrows that, a moving-window
re-bake (bake only the visible window + margin, re-bake as the camera crosses
a threshold — O(viewport), any size) drops in *inside* `ScaledGroundView`
with no change to callers. Live chunk streaming (load/unload) is a separate,
later concern this render path makes possible but Part One does not need.

# v26: drop the mountain foot-shadow band from the overworld autotile

2026-07-17. The owner flagged the dark reddish tile that sat directly south
of every mountain as a quirk. It was the intentional `screeShade`
foot-shadow band (§4a, added in v20/v22) — a full-tile shadow-LUT recolor of
the `scree` rock ground meant to make masses "sit" on the plain. In the
shipped **flat top-down** view (not the standing-billboard 2.5D read it was
designed alongside) it landed as a heavy rock ledge, not a soft shadow.

Removed step 2 of `applyOverworldAutotile` (`overworldMap.ts`) — the loop
that set `screeShade` on open cells south of a mountain — and the now-dead
`!== "screeShade"` guard in the finger-transition step. With no shade row a
mountain's south edge is "open" like its other sides, so it takes the normal
sand↔scree finger transition below (a small improvement: the south edge now
matches the other three instead of being a hard cut). The map editor's JS
port of the pass (`tools/mapeditor/template.html`, regenerated
`mapeditor.html`) got the identical edit so the two stay byte-faithful, and
the derive→finish round-trip test still holds. The map test that asserted
the band exists now asserts it's gone (guards against reintroduction).

The `screeShade` **tile stays in the sheet** at its pinned index (34) — the
pipeline is additive-only, so a now-unused tile is left in place rather than
removed (removing it would reorder indices and re-pin every downstream hash).
No sheet/manifest/determinism change; this is a map-generation change only.

# v27: object-props get transparent backgrounds (composite over the ground)

2026-07-17. The owner spotted a minecart rendering with an underground
mine-floor square baked into it while sitting on desert sand. Root cause: the
art pipeline built every object-prop by drawing the object onto an OPAQUE
GROUND BASE (`stamp(sandBase(...), draw)`, `const g = mineFloor(...)`, etc.),
so the prop's tile carried a specific ground with it and mismatched wherever
it was placed on different terrain (`cart`/`mineTimber` are placed both in the
mine AND out in the overworld).

Fix: props now start from a transparent `tile()` instead of an opaque ground
base, across all eight tile sheets. Nothing else about placement changed —
props live in the `decor` tilemap layer, which already draws OVER the `ground`
layer, and the ground layer always holds the correct terrain under each prop
(verified: `sand` under the overworld cart, `mineFloor`/`rail` under the mine
cart, ice-cave floor under the galleries cart). So a transparent prop
composites over whatever ground it's actually on, in every zone.

Scope — the ~52 converted are discrete OBJECTS that sit on ground: rock,
cactus, palmTrunk/Top, pot, bones, ruinPillar (tiles); truckCab/Box,
crateBroken, joshuaTrunk/Top, creosote, gasPump, cart, lever/leverOn, iceChip,
eggCluster, townSign, mineTimber (tiles2); crystalSmall/Big, lanternPost
(tiles3); kelpStalk, coral, templePillar, anemone, mossRock (tiles4); crate,
crateStack, barrel, washtub, bedroll, stove, campPost, sockBasket, crateOpen
(tiles5); collapsedRock, vineRock, fern, orangeTreeTrunk, needleCactus,
oldOrange (tiles6); coralHead, crystalCluster, wildKelp, kelpTrellis,
seaAnemone, shellCluster (tiles7); pizzaTable, pizzaOven, stoneColumn
(tiles8). LEFT opaque: ground/wall/floor/road/autotile tiles, seamless
ground-dressing that reads as terrain (rail, floor glyphs, sparkles/decals,
stepping-stones, in-turf vegetation, campRug, lavaCrust), and wall-mounted
fixtures (stationSign, station/town windows & doors). Already-transparent
overhead tiles (icicle, bubbles, stringLights, laundryLine) and the
bucket/spigot prop sheets were untouched.

All eight tile-sheet sha256 hashes were deliberately re-pinned
(`determinism.test.ts`) — only prop pixels changed, no tile index moved. The
"every tile fully opaque (no holes)" invariant became "every GROUND tile fully
opaque", with a companion assertion that each converted prop IS transparent.

# v28: make PWA/web updates actually apply (beat the caching)

2026-07-17. The version-check existed (a `version.json` vs baked
`__APP_VERSION__` compare, badging a small corner button) but players still
couldn't reliably get a current build — the update was DETECTED but wouldn't
APPLY, and the "available" signal was easy to miss. Two caching layers and a
weak UI, all fixed:

1. **The service worker never changed bytes between deploys** (`public/sw.js`
   had a constant `CACHE = "desert-secrets-v1"`). A browser only re-installs a
   SW when its bytes differ, so the old SW — and its cache, and its fetch
   logic — lived forever. Fixed: the build stamps `APP_VERSION` into
   `dist/sw.js` (`__SW_VERSION__` placeholder, replaced in vite.config.ts's
   `writeBundle` alongside `version.json`) and the cache name is
   `desert-secrets-${VERSION}`. Every deploy is now a new SW that installs,
   `skipWaiting()`s, claims clients, and deletes every prior cache.
2. **Plain `fetch()` in the SW still honoured the browser HTTP cache**, so on
   GitHub Pages (index.html served with a max-age) even a "network-first" SW
   could answer a reload from stale HTTP cache. Fixed: navigations are fetched
   with `{ cache: "reload" }` — a true network round-trip. The single-file
   build means the navigation is the whole app, so that one bypass covers
   everything.
3. **The "update available" signal was just a recoloured 26px button.** Added
   a prominent top-center banner ("New version available" + a gold "Update
   now" button + dismiss) that slides in only when a newer build is detected.

Applying is now bulletproof (`updateCheck.ts` `applyUpdate()`): pull the new
SW + tell it to take over, delete every Cache Storage entry, then reload.
Still never auto-reloads — applying is always the player's tap, so it can't
yank the page out from under an active battle. Detection unchanged
(`version.json` fetched `no-store`, checked on load / every 10 min / on tab
re-focus). No gameplay code touched; `initUpdateCheck()` still no-ops headless.

# v29: a reusable light-mask / lighting-overlay subsystem (`LightMask`)

2026-07-17. A new presentation subsystem for lighting effects — torches,
glows, flashes, pulses, directional washes and hard-edged shafts — added as
`src/game/gfx/LightMask.ts`, with the load-bearing math split into the pure,
unit-tested `src/core/lighting.ts` (`tests/core/lighting.test.ts`, 28 cases).
No game rules touched; nothing renders unless a scene opts in.

**What it does.** A `LightMask` owns a screen-space overlay: a variable-opacity
full-screen base tint plus any number of positioned lights. Each light is a
multi-stop gradient (arbitrary colour + alpha + offset per stop) with:
- **blend** `"reveal"` (torch — a dark base with the light punched through via
  `RenderTexture.erase`/destination-out, so the world shows at full brightness
  under it and darkens at the edges), `"add"` (additive glow), or `"normal"`;
- **anchor** `"world"` (tracks the camera — projected each frame) or
  `"screen"` (fixed);
- **shape** `"circle"` (euclidean falloff) or `"square"` (chebyshev — a boxy
  glow); **gradient** `"radial"` or `"linear"` (directional wash at an angle);
- an optional hard-edge **mask** (rect or polygon, clipped crisply at bake
  time via canvas `destination-in`) — light through a doorway;
- **follow** a sprite, **pulse** a time-driven breathe, and a one-shot
  `flash()`. Handles from `addLight()` update/remove live.

**Two things done carefully** (the brief flagged both as easy to break):

1. **ERASE inside a RenderTarget.** `BlendModes.ERASE` only works drawing INTO
   a render target, so the base darkness AND every torch "hole" go into ONE
   `RenderTexture`, then it's displayed. `rt.erase(stamp)` honours the stamp's
   own alpha, so a pulse dims the torch. Additive glows are separate ADD-blend
   Images layered on top.
2. **The two-camera split (v21).** The overlay is an ordinary scene child (NOT
   on `uiLayer`) at a high depth (default 5000), so `syncUiCameraIgnore()`
   already makes `uiCamera` ignore it (no double draw) and it renders through
   `cameras.main` only; the HUD stays legible because `uiCamera` draws after
   the world camera regardless of depth. The wrinkle: `scrollFactor(0)`
   cancels camera SCROLL but not camera ZOOM, and the overworld runs at a
   fractional zoom — so every screen-space overlay object is counter-scaled by
   `1/zoom` and repositioned about the camera pivot each frame, and world-
   anchored lights go through `projectWorldToScreen` (pure, tested at zoom 1
   and fractional zoom). In a plain zoom-1 zone all of that is the identity.

**Performance.** Gradients (including hard masks) bake to a canvas texture
ONCE, cached by signature, then only get positioned/scaled/alpha'd per frame —
never a per-frame canvas gradient fill (too slow for mobile). The per-pixel
bake indexes a 256-entry stop LUT rather than re-walking stops. All animation
is driven off the scene clock (no `Math.random`).

**Dev demo.** Gated behind the `?lighttest` URL flag (latched to localStorage,
same tri-state pattern as `?mode7tune`), wired into `OverworldScene`. It lays
every capability onto the live overworld at once — a player-following torch, a
character glow, a pulsing "ice wall", a blue→white→clear multi-stop light, a
square-falloff glow, a linear wash, and a hard-edged doorway shaft — plus an
on-demand white flash (`F`). Off by default; normal play is untouched. No tile
art changed, no determinism hashes re-pinned.

# v30: the Cinnabar Mine is torch-lit (first real use of LightMask)

2026-07-17. The first shipped use of the v29 LightMask subsystem. The mine
(`MineScene`) now runs a moderate ambient darkness (ink at 0.5) that the
player's own lamp — a soft `reveal` light following the player — punches
through, plus a warm `amber→clay→rust` glow hung on each of five lantern-post
torches (`MINE_TORCHES` in `mineMap.ts`), pulsing slightly out of phase so
they flicker rather than breathe in unison. Kept deliberately navigable: the
lamp is generous (radius 116) and the darkness partial, so corridors, the
lever/gate, and the Foreman fight all stay legible.

The torch fixture reuses the Act 2 `lanternPost` tile (tiles3) as a mine wall
torch — a deliberate cross-sheet borrow (tileGid resolves any sheet), so it's
added to the Act 1 map test's KNOWN_NAMES rather than treated as a stray tile.
The five posts sit at chamber corners/edges (all in wide chambers, none
narrowing a path — BFS-verified). LightMask sits at depth 4000: above the
actors and decor it darkens, below the HUD.

# v31: act-boundary transitions become a walk-through (door/ladder/elevator)

2026-07-17. The bigger "end of act" hand-offs shouldn't read as a teleport, so
`ZoneScene.exitVia(kind, target, spawnTile)` plays a short beat on the player —
`"ladder"` climbs up (walk-up pose + rise + fade), `"door"` steps up/through,
`"elevator"` sinks down (riding the cage) — then fades the cameras and starts
the target zone (input locked for the ~0.6s beat). It's `goToZone` with a
threshold moment; the caller supplies the visible door/ladder tile, this plays
the character's part.

Scope (the owner's call): ACT BOUNDARIES ONLY — small room-to-room exits keep
their quick fade — and the kind is auto-picked by direction (descending/
climbing between levels = ladder; lateral/building = door), overridable where
it'd be wrong. First two wired:
- **Mine → Depths** (Act 1): `"elevator"` — a ride-down beat, keeping the
  established elevator rather than forcing a ladder (a deliberate override).
- **Sea Ascent → Miners' Camp** (Act 3→4): `"ladder"` — a visible service
  ladder (the reef `kelpTrellis` reused as rungs, placed OVERHEAD at the top of
  the shaft so the party climbs up THROUGH it; the walkable shaft underneath is
  untouched since kelpTrellis is solid). tileGid resolves it cross-sheet.

Remaining act boundaries (Act 4→5/5→6/6→7 descents = ladders; the Act 1→2 /
2→3 end-card hand-offs need the beat inserted after the card, not at a walk-
exit) are wired the same way as they're confirmed.

# v32: the Depths cliffhanger wall is rock that collapses to reveal the ice

2026-07-17. STORY_ACT1's cliffhanger reads "an aftershock splits the gallery
**wall** — revealing a sheer face of **blue glacial ice**": the wall is solid
rock and the ice is *behind* it, exposed only by the collapse. The map didn't
match — it rendered `iceWall` along the whole north edge (plus a second
`iceWall` course in decor row 1), so the ice was visible the entire fight and
"Piggy runs through a crack in the wall" read as ice, not rock.

Fix, in two parts:
- **`depthsMap.ts`** — the north border and the decor row-1 face are now
  `mineWall` (rock). No `iceWall` appears in the built map at all; the ice is
  introduced purely at runtime by the collapse. (Both walls stay solid, so
  enclosure/BFS are unchanged.)
- **`DepthsScene.crackWall()`** — the collapse now: puts `iceWallCrack` at the
  two `DEPTHS_CRACK` decor tiles (the exposed ice face; its dark indigo fissure
  is the "something vast hangs dark inside"), `iceWall` in the ground row above
  them (a taller ice face), and `scree` on the floor tile below each (the
  fallen rock as rubble). The revealed ice gids weren't in the layer collision
  set (never placed at build), so `crackWall` re-asserts collision on them —
  the exposed ice is solid, the rubble (`scree`) is walkable so Piggy rests on
  it at the wall's foot.

"…and the ice should glow blue": `DepthsScene.addIceGlow()` hangs a base-less
`LightMask` (add-blend, so it only *adds* light — no scene darkening) over the
crack: a tall square-falloff footprint pulsing `skyBlue→slate→clear`, the same
"ice wall" recipe as LightMaskDemo #3. It's created the moment the wall cracks
(cliffhanger reveal) and in the epilogue reload state, and pulsed from a new
`onUpdate()`. `cliffhanger.ts` is unchanged — the dialogue ("The far wall
splits… and glows blue", "That's ice. A wall of it.") already described this;
only the visuals were catching up to the words.

# v33: John/Pamela split into two NPCs, the Thomas radio thread, Part Two opening

2026-07-17. Three linked pieces of story plumbing, all additive.

**John and Pamela are now two separate NPCs, two separate voices.** They used
to share one tangled `homeAct1Script` (a Thomas/chickens/scarabs/goodbye hub
with both parents interleaved). `scripts/homeAct1.ts` now exports
`johnAct1Script` and `pamelaAct1Script`, split along the CLAUDE.md dialogue
lanes:
- **John** owns the scarabs/mystery-bug thread and outdoor sightings (he spots
  Piggy heading east at dawn), hands Joseph the hand radio and points him at
  Thomas, and keeps the frost-on-the-flats hint. His hub: scarabs / Thomas /
  goodbye. He explains "scarab" is a local nickname — no off-world hint (that's
  Part 3).
- **Pamela** owns the chickens/chores thread (the bucket fetch-quest: shed →
  spigot → trough). Her hub: chickens / goodbye.

`OasisScene` `addNpc`s them with their own scripts (John is `npcs[0]`); both
still share `onCloseParent`, so closing EITHER the first time sets `metParents`
and starts the tutorial scarab battle — unchanged progression.

**The Thomas radio thread** (`scripts/thomas.ts`), a Part-One-long one-way
through-line seeding Part Two. Thomas carries the twin of John's hand radio;
his voice breaks in, garbled at first and clearing as Joseph closes the
distance. Joseph always calls back, but nothing gets through.
- First contact is `thomasMineScript`, a one-time broken transmission in the
  mine's foreman room. `MineScene` fires it from a dedicated trigger on the
  elevator chamber's west-edge column (x=23, one tile before the foreman's
  challenge band at x=24-25, so the two beats never stack), guarded by the new
  `heardThomasMine` flag.
- The later sporadic catches are `THOMAS_FRAGMENTS`, an ordered escalating
  list, each gated by its own flag (`thomasFrag1..3`). `nextThomasFragment(flags)`
  returns the first unheard one. A reusable `ZoneScene.playNextThomas()` plays
  it and marks it heard; it's safe to call from inside another script's
  `onClose` (DialogueBox nulls its runner before firing the callback, so
  re-opening just starts the next box). Hooked into three existing key beats,
  after each beat's own dialogue closes: **Act 3** `SeaAscentScene` climb beat,
  **Act 5** `GroveDescentScene` arrival beat, **Act 7** `PizzaAscentScene`
  arrival beat (the clearest fragment, right before the finale).

**The Part Two opening cutscene** (`PartTwoOpeningScene`, script
`scripts/partTwoOpening.ts`). A self-contained non-zone scene mirroring the
end-card scenes: a dark backdrop, Joseph lying with Piggy/Fluffball/Slither on
one side and Thomas (drawn with the generic `npc` sheet — no new art) on the
other, a radio link between them, and a `DialogueBox` playing the four exact
scripted lines, then a "to be continued" beat back to the title. It's wired as
the finale hand-off: `PizzaAscentScene`'s END OF PART ONE card now advances
into it (SPACE), setting `partTwoStarted`, instead of jumping straight to the
title; the cutscene clears the save at its own end (the rest of Part Two isn't
built). Registered in `main.ts`.

New flags live in `gameState.ts`'s `PART2_FLAGS` (`heardThomasMine`,
`thomasFrag1..3`, `partTwoStarted`), all false at `newGame()`. Tests:
`scriptsAct1.test.ts` covers the two split scripts (voice separation, lane
content, hubs), the Thomas mine/fragment scripts (one-way, escalating, ordered
consumption) and the four Part Two lines; `gameState.test.ts` includes the new
flags. Smoke: `e2e.mjs` drives the finale → Part Two cutscene → four lines →
title; `touch-e2e.mjs` still talks to John (`npcs[0]`) through his choice hub.

# v34: tabbed inventory/status window, random battle drops, and the shiny economy

Three linked changes: the inventory window becomes a tabbed status screen,
battle victories can drop items, and shinies finally have a source and a sink
so Dusty's "Pay a shiny" branch is reachable.

**The tabbed window** (`src/game/ui/InventoryMenu.ts`, a full rewrite). A row
of tab chips across the top; the active tab's entries scroll in a list down the
**left**; the highlighted entry's details (icon, title, flavor/stats) show in a
panel on the **right**. Tabs are **data-driven** — a module-level `TabDef[]`,
each with `{ id, title, emptyText, build(state) }`. `build` returns the tab's
`Entry[]`; an `Entry` carries `{ label, tag?, icon?, detailTitle, detailBody,
activate? }`. The framework (tab switching, list scroll, highlight, detail
render, keyboard/touch input) is tab-agnostic — **adding a tab is adding one
`TabDef`**. Crucially `activate` lives on the ENTRY, not the tab, so the
bucket's equip toggle is just an entry action; the planned **4th "Equipment"
tab** slots in by adding a `TabDef` and moving the bucket entry's `build()`
across — no framework change. Three tabs ship: **Inventory** (bucket first — so
the smoke test's open-and-SPACE still equips it — then coldPack, silverfin,
stinky socks, oranges, mint kelp, shinies×N, each with a description),
**Party** (Joseph always with Lv + HP/ATK/DEF/SPD; Piggy once `piggyCaught`;
Fluffball once `fluffballJoined`; Slither once `slitherJoined` — portraits
reuse the existing `hero`/`piggy`/`fluffball`/`slither` sheets, no new art),
and **Skills** (the hero's chosen `PERKS`). Input mirrors PerkMenu: the menu
owns its keyboard + pointer handlers and tears them down on close. Keyboard —
↑↓/W,S move, ←→/Q,E switch tabs, SPACE/ENTER use, ESC/I close. Touch — tap a
chip, the reused `TouchListButtons` ▲/✓/▼ column moves+uses, ✕ closes.
`ZoneScene.openInventory()` now passes the full `Act1State` plus an
`InventoryCallbacks` (`onToggleBucket`, `onClose`) instead of just items.

**Random battle drops** (`src/core/drops.ts`, pure + tested). `rollDrop(rng,
group, boss)` returns a `DropId | null` off the battle's own seeded RNG (never
`Math.random`). A `DROP_CHANCE` gate (0.3) then a weighted `DROP_TABLE` pick;
today the table is a single `shiny` entry, shaped so a rarer entry (e.g. a heal
item) drops in without touching the roll logic. Bosses and empty groups never
drop (scripted rewards). `BattleScene.handleVictory` rolls once up front and
folds a `shiny` into the same state write as the XP award (via
`gameState.grantShiny`), on either the level-up or the no-level branch, and
floats a "Found a shiny!" toast. This is the main faucet feeding the economy.

**The shiny economy.** `gameState.ts` gains pure `grantShiny`/`spendShiny`
(clamped at zero) and a new `ACT1_FLAGS` entry `pamelaShiny`. Pamela's greeting
now hands Joseph his first shiny ("found this out by the coop" — her chores/coop
lane); `OasisScene` grants it once on her dialogue close, guarded by
`pamelaShiny`, then runs the shared parent beat. Dusty's "Pay a shiny" branch,
previously always shown but with nothing to spend, is now gated in
`TrailScene.placeDusty` with the same copy-and-strip pattern as the jackrabbit:
with no shiny the hub offers only "Not right now"; the paid `truth-end` branch
spends one shiny in `onClose`. Dusty still opens the mine on any close (existing
behavior the smoke relies on). Tests: `drops.test.ts` (boss/empty suppression,
determinism, rate band, labels); `gameState.test.ts` (grant/spend purity,
clamp, round-trip, flag count now 18); `scriptsAct1.test.ts` (Pamela's shiny
line, the Dusty strip → single "Not right now" → later-end).

# v35: equipment + stat buffs, and the 4th "Equipment" inventory tab

The bucket stops being purely a chore prop and becomes the first piece of
wearable gear. Three parts: a pure equipment/buff model, the buff spliced into
battle stats, and a new inventory tab that owns the equip toggle.

**The model** (`src/core/equipment.ts`, pure + tested). A catalog `EQUIPMENT`
of equippables, each `{ id: EquipId, name, description, buffs }` where `buffs`
is a `Partial<Pick<Stats,"attack"|"defense"|"speed">>` of stat deltas (may be
negative). The bucket ships first, per spec: worn as headgear it grants **+2
DEF, -1 SPD**. `applyEquipmentBuffs(stats, equipped)` layers the equipped item's
deltas onto base build stats, clamping each buffed combat stat to `STAT_FLOOR`
(=1) so a debuff can never floor a stat below a sane minimum; it's pure and
returns a fresh `Stats`. `equipmentById(id)` is the id→item lookup (null-safe).
Buffs deliberately **exclude maxHp** — the hp pool and its heal accounting live
on the build (`statsForBuild`), so equipment stays out of that math and
`heroStats` is the single safe splice point.

**Into battle.** `gameState.heroStats(s)` now returns
`applyEquipmentBuffs(statsForBuild(s.hero), s.items.equipped)` (hp still clamped
to current hp). Since `partyFor` and the Party status tab both read the hero
through `heroStats`, battle, the party screen and the equip preview all see one
consistent buffed block. `statsForBuild` (build-only) is unchanged, so the
heal/respawn paths that key off maxHp are untouched — the bucket doesn't move
maxHp anyway.

**The Equipment tab** (`InventoryMenu.ts`, now four `TabDef`s: Inventory ·
Party · Skills · Equipment). The tab lists held equippables (the bucket once
picked up), shows a name/flavor/`ATK/DEF/SPD` buff preview in the detail panel,
marks the worn item with "✓ worn", and its `activate` toggles the equip. The
old bucket-by-title-prefix (`startsWith("Bucket")`) is gone: entries now carry a
stable `equipId?: EquipId`, and `buildEntries` wires the equip action off THAT,
never off display text. The equip toggle **moved out of the Inventory tab** (it
still lists the bucket as a held item, no action) into Equipment.
`ZoneScene.openInventory` passes `onToggleEquip(id)` (was `onToggleBucket`).

**Bucket-as-tool vs bucket-as-armor (the reconciliation).** The two axes are
kept orthogonal: the equip slot (`items.equipped`) is independent of the
fill-state (`items.bucket`: none/empty/filled). Equipping grants the buff
regardless of fill-state; the chicken-chore (fill at the spigot, deliver at the
coop) still requires the bucket equipped and works while it's worn. The chore
**no longer destroys the bucket**: delivery used to clear `bucket:"none",
equipped:null`; it now only empties the pail (`filled → empty`) and leaves it
equipped, so Joseph keeps a wearable, buff-granting bucket after the chore
(`OasisScene` coop delivery). Tests: `equipment.test.ts` (catalog, the bucket
profile, buff layering, the floor clamp, purity); `gameState.test.ts` (bare vs
worn `heroStats`, maxHp untouched, JSON reload round-trip). Smoke updated: the
keyboard e2e equips via the Equipment tab (three taps right) and asserts
delivery leaves `bucket:"empty", equipped:"bucket"`.

# v36: equipment grows to FIVE slots, new gear, and the miner-camp shops

`items.equipped` stops being a single `EquipId | null` and becomes a
**five-slot record** `EquipSlots = Record<"hat"|"weapon"|"torso"|"legs"|"shoes",
EquipId | null>`. Each `Equipment` now declares a `slot`. `applyEquipmentBuffs`
takes the whole record and **SUMS** every worn slot's deltas before clamping
each combat stat to `STAT_FLOOR`. The bucket is now the `hat` slot (was the lone
slot); the coop/spigot chore and the Hud readout check `equipped.hat ===
"bucket"` (was `equipped === "bucket"`). `ZoneScene.onToggleEquip` swaps within
the item's own slot (equipping replaces that slot; toggling the worn item empties
it), so hat and weapon are independent.

**New catalog entries** (`equipment.ts`): `stick` (weapon, +1 ATK), `minersHat`
(hat, +1 DEF), `pickaxe` (weapon, +2 ATK), plus Joseph's default outfit —
`tshirt` (torso), `jeans` (legs), `flipFlops` (shoes), all zero-buff plain
clothes. Ownership: the bucket still reads off `items.bucket`; the rest get
boolean item flags (`items.stick/minersHat/pickaxe/tshirt/jeans/flipFlops`).
`newGame()` starts Joseph **owning and wearing** the three clothes
(`defaultEquipSlots()` → hat/weapon null, torso/legs/shoes filled); `clone`
deep-copies `equipped`. `normalizeEquipSlots(raw)` coerces any persisted shape
(including the LEGACY single-slot string `"bucket"`) into a full record, defaulting
missing slots to the starter outfit — `state.ts loadSavedState` runs it so a
mid-session reload of an old save can't crash.

**Equipment tab** now lists every OWNED equippable grouped by slot (`SLOT_LABEL`
prefix, e.g. `Hat: Bucket` / `Weapon: Pickaxe`), each with its own "✓ worn"
marker and a per-item buff preview (plain clothes read "No stat bonus.").

**Stick pickup** (`ShedScene`): a `palmTrunk`-marked interact just east of the
bucket; grabbing it sets `items.stick` AND auto-equips it to the empty weapon
slot (instant +1 ATK). `SHED_STICK` added to `shedMap`.

**Miner-camp shops** (`CrevasseScene` + `core/scripts/minerShop.ts`, pure
scripts). Once rescued, **Mo** sells the miner's hat (`MINERS_HAT_PRICE = 2`) and
**Gus** sells the pickaxe (`PICKAXE_PRICE = 3`). Same copy-and-strip pattern as
Dusty: the "Buy" choice appears only when `canBuyEquip(s, price, owned)` (unowned
AND affordable); on the `buy-end` node the scene runs `spendShinies` +
`grantEquipment`. Buy logic is pure/tested (`gameState.ts`: `spendShinies`,
`grantEquipment`, `canBuyEquip`; `OwnedEquipId`). Tests: `equipment.test.ts`
(slots, buff-summing, normalizer, starter outfit), `gameState.test.ts` (new
items shape, buy helpers, clone isolation), `minerShop.test.ts` (script validity,
gating strip, 48-char budget). Smoke: asserts the starter outfit at newGame, the
stick auto-equip, the bucket filling the hat slot, and buying Mo's hat.

# v37: the party becomes a data-driven roster, and everyone fights (up to 4)

The party is no longer "hero (+ Slither)". `src/core/roster.ts` is the single
source of truth: a `ROSTER` of `RosterEntry` records (`hero`, `slither`,
`fluffball`, `piggy`), each with a level-driven `statsFor`, `commandsFor`, an
`available(state)` predicate (its unlock flag), equip-eligibility `tags`
(`human`/`reptile`/`penguin`, for the gear system), and `cactusGuard`. Adding a
member (Thomas in Part Two) is one appended entry — but note the coupling:
raising the party size past four also needs `MAX_PARTY` bumped and a matching
`PARTY_COLS` layout row in `BattleScene`.

`activeParty(state)` derives the combat party (≤ `MAX_PARTY` = 4): it honours an
explicit `state.selectedParty` ordered id list (which the **Part-Two swap UI**
will set — the rocket-ship party management), filtered to currently-available
members and capped at four; absent that, it's every available member in roster
order (hero always leads). `partyFor` is now a thin alias for `activeParty`.
`selectedParty?: RosterId[]` is an optional `Act1State` field (omitted by
newGame, conditionally cloned; old saves default to derivation).

**Fluffball and Piggy are now real combatants** (`fluffballStatsForLevel` /
`piggyStatsForLevel` + `FLUFFBALL_COMMANDS` / `PIGGY_COMMANDS`), available on
`fluffballJoined` / `piggyCaught`. This SUPERSEDES every earlier "Fluffball is
non-combat" statement in this doc (v16–v19) and in scene comments. Companions
are still stateless per battle — they enter at full HP each time, so only the
hero tracks persistent HP between fights (that HP rationale still holds). On a
party victory the hero is now revived to ≥1 HP, since a companion can land the
winning blow while Joseph is down. `BattleScene` lays out 1–4 party members
(`PARTY_COLS`). Tests: `roster.test.ts`, `progressionRoster.test.ts`.

# v38: the Equipment tab becomes a per-character, near-fullscreen icon UI

The Equipment tab is no longer the interim hero-only slot list (v35/v36). It's a
bespoke, near-fullscreen PER-CHARACTER view (`src/game/ui/EquipmentPanel.ts`),
which InventoryMenu mounts in place of its generic list/detail framework while
that tab is up (and unmounts on tab-switch/close, resyncing state via
`currentState()`). The STATUS window itself grew to ~456×250 to hold it, and the
zone HUD is hidden while the window is open (it renders above the panel). Three
columns, icons over words:

- **LEFT** — a square sprite-button per member you have (`availablePartyIds`),
  no names; the highlighted one is the character being dressed.
- **MIDDLE** — the shared item POOL: every owned equippable as icon + free count
  (`availableCount`, FF6-style = owned − equipped-across-everyone), `✓ worn` when
  the selected member wears it, `locked` when a tag rule bars them (penguin-only
  frost feather), `in use` when all copies are worn elsewhere.
- **RIGHT** — the member's five slots (hat·weapon·torso·legs·shoes): the worn
  item's icon + name, or a grayed slot-placeholder icon when empty, plus a live
  buffed ATK/DEF/SPD readout.

Input: ↑↓ move the pool cursor · ←→ change character · SPACE toggles the
highlighted item on the current member (equip if free & eligible, unequip if
that member already wears it — so the pool doubles as the unequip path). Touch
taps a character button, a pool row (toggle), or a filled right-hand slot
(unequip). `InventoryCallbacks` changed from the single hero-only `onToggleEquip`
to per-character `onEquip(charId, id)` / `onUnequip(charId, slot)`, wired in
`ZoneScene` straight onto the core `equipItem` / `unequipSlot` (the pool/tag
rules already live there, so a restricted or none-free action is a safe no-op).

New art: `gearIcons` — a 16×16, one-row-of-12 sheet
(`tools/pipeline/src/sprites/gearIcons.ts`): 5 muted slot/class placeholders
(hat·weapon·torso·legs·shoes) + 7 colour item icons (miner's hat·stick·pickaxe·
t-shirt·jeans·flip-flops·frost feather); the bucket keeps its own fill-state
sheet. The frame ORDER is the contract the UI indexes by
(`src/game/ui/equipmentIcons.ts`); the sheet is sha256-pinned in
`determinism.test.ts` ("gearIcons byte-stability"), so a reorder there fails a
test — keep the two in lockstep, append never reorder.
