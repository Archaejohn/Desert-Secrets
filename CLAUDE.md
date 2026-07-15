# Desert Secrets — project memory

Phaser 3 + TypeScript Android ATB RPG. Joseph rescues a baby penguin
named Piggy. Full design docs live in `docs/`:

- `docs/CONTRACTS.md` — running, append-only technical spec (versioned
  sections). Read before touching engine internals.
- `docs/STORY_ACT1.md`, `docs/STORY_ACT2.md` — built and shipped.
- `docs/STORY_ACTS3-7.md` — Part One's back half (the ingredient chase),
  in progress.
- `docs/STORY_PARTS2-4.md` — long-term roadmap past Part One.

## Durable story facts (do not silently contradict these)

- **The "scarabs" are not real scarabs.** They're an unidentified desert
  insect the locals nicknamed "scarabs" out of habit — wrong leg count,
  wrong shell, don't match anything in any field guide. **John** (Joseph's
  father) is the character who explains this in-world (`src/core/scripts/
  homeAct1.ts`, the "scarabs" hub branch): he's cracked one open and it
  spooked him. **Do not reveal an alien/off-world origin during Part
  One or Part Two** — that thread stays unconfirmed until Part 3 opens
  ("Into the Black"), where it's the reveal, not before. It's fine for
  narration/new flavor text to call them "mystery bugs" when not quoting
  a specific character's folksy speech — but don't rename the `scarab`
  family's code ids or in-battle display names off the back of this; the
  "scarab" name is the deliberate, in-world colloquialism.
- **John and Pamela have distinct dialogue lanes.** Pamela owns the
  chickens/chores thread. John owns the scarabs/mystery-bug thread (and
  general outdoor sightings, like spotting Piggy at dawn). Keep new
  homestead dialogue split along that line rather than genericizing both
  parents into interchangeable voices.
- **Act 5's orange grove is underground, inside Cinnabar Mine — not a
  surface location.** It's a mine chamber where the ceiling has caved in,
  letting sunlight through; an underground river waters it, so it's lush
  and green in deliberate contrast to the rest of the mine. **One orange
  tree grows at the center of the room.** (This corrects an earlier draft
  of `STORY_ACTS3-7.md` that had the grove behind the oasis on the
  surface — the mine location is the canonical one going forward.)

## Established engineering conventions (see CONTRACTS.md for detail)

- Procedural, palette-locked pixel art (`tools/pipeline/`), every sheet
  sha256-pinned in `tests/pipeline/determinism.test.ts`. Extending an
  existing sheet (not replacing) requires deliberately re-pinning its
  hash — additive only, never reorder existing frame indices.
- Core rules are pure TypeScript in `src/core/` (no Phaser imports), unit
  tested. Presentation lives in `src/game/` (Phaser scenes/UI).
- Every zone map is BFS-verified reachable/enclosed in
  `tests/game/maps.test.ts`.
- Verification bar before calling anything done: `tsc --noEmit`,
  `vitest run`, `npm run build`, `npm run smoke` (keyboard e2e),
  `npm run smoke:touch` (touch-emulated e2e).
- Git flow: develop on `claude/android-rpg-art-pipeline-wrxwhv`, push,
  then fast-forward `main` from it (`git push origin
  claude/android-rpg-art-pipeline-wrxwhv:main`); refresh `docs/play/`
  (`npm run pages`) as its own commit; keep the live Artifact republished
  at the same stable URL.
- For large/novel subsystems, delegate to an Agent (Opus for the build,
  independent review before merging) — established for the Mode-7
  overworld renderer. Isolate risky parallel builds in a git worktree.
