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
