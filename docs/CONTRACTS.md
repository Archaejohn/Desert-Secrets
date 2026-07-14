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
