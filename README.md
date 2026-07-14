# Desert Secrets

An **active time battle (ATB) RPG** for Android, built with Phaser 3 +
TypeScript, with a fully procedural pixel-art pipeline.

A wanderer crosses a dusk-lit desert valley: an oasis, half-buried ruins, and
the scarabs that guard whatever sleeps beneath the dunes.

## Act 2 — The Ice Below (~35 min)

Continues straight from Act 1's cliffhanger (progress carries over, and a
checkpoint save lets you continue after closing the browser):

- **A true maze act** — seven rooms of winding ice tunnels with multiple
  doorways, two independent routes through, loops that dump you back where
  you started, and false-lead dead ends that pay off: heal shards, an
  ambush, and **lost miners** (Mo, Edda and Gus — rescue all three for a
  bonus perk).
- **Slither** — a jade whipsnake who scouts shortcuts no human fits
  through and **joins the party** at the rime door. In battle he has his
  own ATB gauge and commands: Bite, Coil, and **Venom** (damage + slows
  the target's gauge).
- **The Rime Warden** — a two-member-party boss on the frozen lake, and
  an ending that reveals Piggy isn't alone down here.
- Leveling extends to Level 8; story plans for Acts 3–7 (a dedicated act
  per ingredient Piggy loves, Fluffball joining the party, and a certain
  underground pizzeria) live in `docs/STORY_ACTS3-7.md`.

## Act 1 — The Coldest Cargo (~30 min)

Playable in the browser, start to cliffhanger (full outline in
`docs/STORY_ACT1.md`):

- **Five zones** — the Highway 95 crash site, Sahra's oasis, the Piggy
  Trail (dry lake → Joshua grove → Last Chance Fuel), Cinnabar Mine, and
  the frozen Depths.
- **Active Time Battle** — gauges fill in real time by speed; enemies act
  whether you're ready or not. Commands grow with your level: Attack,
  Guard, Focus (L2), Cactus Guard thorns passive (L3), 2nd Wind (L4),
  Sandstep (L5).
- **XP & leveling** — battles, quest steps and discoveries award XP
  (curve: 20/45/75/110). Each level raises HP/attack/defense/speed, fully
  heals, and lets you pick a perk: Vigor, Ferocity, Bulwark or Swiftness.
- **Random encounters** on the trail and in the mine while moving.
- **Defeat is soft** — you wake at the start of the current area with
  full HP; XP, perks, items and quest progress are all kept.
- **Choices matter** — trade the cold pack to the jackrabbit and you
  can't parley with the Dust Queen; keep it and the boss can be talked
  down to a shorter skirmish.

Controls: arrows/WASD to move, `E`/`Space` to talk & advance dialogue,
↑/↓ + `Space` in menus. Touch: drag on the left half to move, tap on the
right half to interact / tap menu rows.

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
