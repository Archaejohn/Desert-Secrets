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
