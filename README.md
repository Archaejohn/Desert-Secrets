# Desert Secrets

An **active time battle (ATB) RPG** for Android, built with Phaser 3 +
TypeScript, with a fully procedural pixel-art pipeline.

A wanderer crosses a dusk-lit desert valley: an oasis, half-buried ruins, and
the scarabs that guard whatever sleeps beneath the dunes.

## The demo

The browser sample demonstrates:

- **Animated character motion** — the hero walks in four directions with a
  proper limb-swinging walk cycle and breathing idle; the NPC wanders the
  oasis; a scarab patrols the dunes; the oasis water animates.
- **Talking to an NPC** — walk up to Sahra the Keeper by the oasis and press
  `E` (or tap her) for a branching conversation.
- **Active Time Battle** — touch the patrolling scarab to enter battle. ATB
  gauges (gold) fill in real time by each combatant's speed; when yours is
  full, choose *Attack* (then a target) or *Guard*. Enemies act on their own
  gauges whether you're ready or not — that's the "active" in ATB.

Controls: arrows/WASD to move, `E`/`Space` to talk & advance dialogue,
↑/↓ + `Space` in menus. Touch: drag on the left half to move, tap on the
right half to interact.

## Quick start

```bash
npm install
npm run art      # regenerate all sprites/tiles from code (deterministic)
npm run dev      # dev server
npm test         # unit tests (core rules + art pipeline + world map)
npm run build    # single-file dist/index.html — runs anywhere, incl. Android WebView
npm run smoke    # headless-browser e2e: boots the build, talks, fights, wins
```

## Project layout

| Path | Purpose |
|------|---------|
| `src/shared/palette.ts` | Master palette — the single source of truth for every colour |
| `tools/pipeline/` | Procedural art generator (`npm run art`) — see `docs/ART_PIPELINE.md` |
| `src/assets/generated/` | Pipeline output: sprite sheets + `manifest.json` (committed) |
| `src/core/` | Engine-agnostic game rules: ATB battle, dialogue, RNG — fully unit tested |
| `src/game/` | Phaser presentation layer: scenes, world map, UI |
| `tests/` | Vitest suites for core, pipeline and map |
| `docs/CONTRACTS.md` | The interface contracts the modules are built against |
| `docs/ANDROID.md` | How this ships to Android (Capacitor) |

## Design principles

- **Art is code.** Every sprite is generated deterministically from the
  palette; unit tests reject any pixel outside the palette, any missing
  animation frame, and any walk cycle whose frames don't actually move.
  Original generated art also means there is nothing to license.
- **Rules are engine-free.** `src/core/` never imports Phaser, so the ATB
  and dialogue logic is tested headlessly and would survive an engine swap.
- **Scenes only present.** The Phaser layer renders state and forwards
  input; it makes no rules decisions of its own.
