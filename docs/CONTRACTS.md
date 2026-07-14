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
