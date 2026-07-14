# Desert Secrets — Parts 2–4 (long-term roadmap)

Part One is a rescue that succeeds — Piggy is caught, fed, and the
desert's secret is out. Parts 2–4 are the reason it doesn't end there:
the walk back to the surface goes wrong, and "go home" turns out to be a
much bigger trip than anyone signed up for.

Acts are numbered **within each Part** (Part 2's Act 1 is not the game's
8th act overall — it's Part 2's first). Every Part in this document is a
rough **8–10 act** outline, not a locked beat sheet — exact counts get
decided during production, the way Acts 1–2's five-beat structure firmed
up once building started. Treat the act ranges below ("roughly acts
3–5") as scaffolding, not a contract.

## The whole game, at a glance

| Part | Setting | Driving goal | Resolved by the Part's end? |
|---|---|---|---|
| **One** (Acts 1–7, built) | Mojave desert & the ice below | Save Piggy | **Yes** — he's caught |
| **Two** — *The World Below* | A hidden underground overworld | Get back to the surface; "save the world" is first spoken aloud | **No** — they reach the surface completely by accident |
| **Three** — *Into the Black* | Space: planet to planet, out to Planet X2 | Stop an alien attack on Earth | **Yes** — but the rocket is wrecked doing it |
| **Four** — *The Long Way Home* | A space junkyard, and the trip back | Repair the rocket, get home | **Yes** — the game ends |

A structural throughline worth keeping on purpose: **Part One paced
itself one ingredient per act. Part Two paces itself one region/town per
act. Part Three paces itself one planet per act. Part Four paces itself
one junkyard section (one part) per act.** Four different subjects, the
same "one place, one act, keep moving" rhythm underneath. It's a good
scaffold to build against even before exact act counts are locked.

---

## Part 2 — "The World Below" (working title, ~8–10 acts)

### Cold open

Piggy caught, ice seed in hand, the party starts back up through the
tunnels toward the surface and Rosa. The floor gives way. They fall — not
into more tunnel, but into a **vast, previously unknown underground
world**: an open, Final-Fantasy-style overworld map, roads and all, with
real towns on it. The mine was the doorway to something much older and
much bigger than a glacier.

### New systems this Part introduces

- **An overworld map layer**, separate from the single-zone traversal
  used in Parts 1's acts: a zoomed-out map connecting town/location
  nodes, each of which opens into its own walkable interior (a town is a
  small ZoneScene with NPCs, not just a bigger prop).
- **Progressive map unlock.** The world doesn't open all at once —
  finishing each Part-2 act reveals a new region (a cleared pass, a
  repaired bridge, a gate someone finally opens), Metroidvania-by-way-of-
  FF1 rather than the player wandering freely from minute one.
  **No dead unlocks:** every gate that opens should also make an
  *earlier* town newly reachable/reversible if it wasn't before, so
  backtracking always has somewhere fresh to reach, not just old ground.
- **Revisit-and-talk-again.** Any completed town stays open, and NPC
  dialogue there updates with current progress — this graduates the
  reactive-Sahra idea from `STORY_ACTS3-7.md` Act 5 into a first-class
  system instead of a one-off.

### Rough progression

- **Acts 1–~2:** the fall; the first town; the world-map mechanic
  introduced; an elder/info-broker NPC lays out the actual stakes —
  something out there is coming for the surface world, and four
  travelers under a desert can't be the whole plan. This is where "save
  the world" first gets said out loud as the game's real banner goal —
  and where Part 2 quietly declines to solve it.
- **Acts ~3–5:** further regions unlock as they're earned; worldbuilding,
  side content, maybe a literal map/compass macguffin gating where
  Thomas can even be found; rumors sharpen into a name.
- **Act ~6 (or 7): find Thomas** — a stranded pilot/tinkerer holed up in a
  hidden hangar-town, guarding a rocket ship that hasn't flown in a very
  long time.
- **The very next act: find Baby Chick**, Thomas's sidekick — off on his
  own somewhere in the underground world, probably in some kind of
  trouble, which is a deliberate structural echo of Part One's whole
  premise (the party doing for someone else what Rosa once needed done
  for Piggy).
- **Final acts (~8–10):** Thomas and Baby Chick each send the party after
  what the rocket needs — Thomas wants **parts**, Baby Chick wants
  **fuel**. (The rocket runs on chocolate chip cookies. This is not a
  metaphor and nobody in-world finds it strange.) Once both are
  satisfied, the ship is flightworthy-ish and the party boards.

**End of Part 2:** they reach the rocket, not the surface — that's the
next Part's cold open, and it doesn't go how anyone plans.

### Cast

| Character | Role |
|---|---|
| **Thomas** | Stranded pilot/engineer, comic and gadget-obsessed, has clearly been down here a long time. From here on he's Joseph's permanent co-lead — the two of them never leave the active party. |
| **Baby Chick** | Thomas's sidekick — an actual baby chicken. Very smart, a bit of a nerd, does real math out loud... and gets it wrong just often enough to be dangerous. Sent off on his own fuel-quest once found; joins for good once it's done. |

**Character note:** Baby Chick is genuinely brilliant — he's the one who
*can* calculate fuel loads, trajectories, part tolerances, whatever the
plot needs solved with math — which is exactly what makes his mistakes
land. He's not careless, he's confidently wrong at the worst moment,
often by one decimal place. That's not a one-off joke for the Part 3
cold open; it's a running trait worth reusing anywhere Parts 2–4 need a
smart plan to go sideways in a specific, character-driven way rather than
generic chaos. (Also worth keeping in mind: unlike Piggy, Fluffball, and
Part 3's *Mr. Goose*, his name and species actually match — a baby chick
who's exactly as advertised, next to three characters who aren't, is its
own small joke.)

---

## Part 3 — "Into the Black" (working title, ~8–10 acts)

### Cold open

The rocket launches — and doesn't stop. Baby Chick ran the fuel numbers
himself, confidently, out loud, and got one figure wrong: he topped the
tank off with **Super Duper chocolate chip cookies and a cup of milk**
instead of the standard batch, sure right up until liftoff that he'd
accounted for the difference. He hadn't. Instead of a short hop to the
surface, the ship blasts clean through the atmosphere and out of control
into space before anyone can do anything about it. Rosa never gets her
radio call.

### Structure

Once the ship stabilizes, the "world map" becomes a star map: an open
field of planets reachable by rocket, same unlock rhythm as Part 2's
regions but reskinned — clear a planet, open the next leg of the route.
Word reaches the party (or they piece it together) that an alien force is
inbound for Earth, and the only lead on stopping it points to **Planet
X2**, out past the Kuiper Belt.

- **The rocket is the hub**, in the spirit of the airship in FF3/FF6: a
  small internal map of a few rooms (bridge, engine room, crew quarters
  are the obvious three; a cargo bay is a natural fourth if there's a
  reason to visit it) that the party walks around between planets.
- **Party bench/swap.** By this Part the roster is bigger than two — a
  swap screen (most naturally on the bridge) lets the player choose who's
  active for the next planet. **Joseph and Thomas are locked in
  permanently**; everyone else (Slither, Fluffball, Piggy if he ever
  fights, Mr. Goose once recruited) rotates through the remaining slots.
  This is new engineering: the battle core currently assumes a fixed
  party built fresh per fight (`partyFor()`); a real roster needs a
  persisted bench, not just a flag check.
- **New crewmate: Mr. Goose**, a red panda, recruited at one of the
  planet stops and folded into the roster from there.

### Rough progression

- **Act 1:** the runaway launch; first sight of open space; the star-map
  mechanic introduced.
- **Act 2:** first planet; the alien threat is confirmed as real and
  Earth-bound, not a rumor.
- **Acts ~3–6:** one planet per act, each with its own theme/hook (allies
  to recruit, intel, resources, a reason the ship needs a specific part
  or upgrade later) — Mr. Goose is picked up somewhere in this stretch.
- **Acts ~7–8:** the approach to and arrival at Planet X2.
- **Final act(s):** the confrontation. Unlike Part 2, Part 3's stated goal
  *is* achieved — the immediate threat to Earth is stopped — but not for
  free: **the rocket is badly damaged** in or right after the fight,
  crippling the trip home.

**End of Part 3:** threat stopped, ship wrecked, stranded a long way from
the Kuiper Belt's nearest exit. That's Part 4's cold open.

---

## Part 4 — "The Long Way Home" (working title, ~8–10 acts)

### Cold open

Drifting on a damaged ship, the party finds (or is found by) **Liberty
and Chase**, two dogs running a sprawling space junkyard stocked with
salvage — the only realistic source of the specific parts a homemade
rocket needs to fly again.

### Structure

Same unlock rhythm as Parts 2–3, reskinned again: the junkyard isn't one
map, it's sections that open up as the party proves useful/earns trust,
each section holding one of the parts the ship actually needs. Getting a
part isn't a straight purchase — expect **puzzles**, and possibly a
**memory-quest** device (Liberty and Chase, or salvaged wreckage itself,
surfacing flashback content) as an optional way to add some emotional
weight to what would otherwise be a pure fetch structure. Both are open
design questions, not decided here.

### Rough progression

- **Act 1:** arrival, damaged and stuck; meet Liberty and Chase; scope
  what the ship actually needs (a parts checklist is the natural
  throughline for the whole Part, mirroring Fluffball's ingredient list
  from Part One).
- **Acts ~2–8:** one junkyard section, one part, one act at a time, each
  unlocking the next as trust/progress is earned.
- **Final act:** the rocket is whole again. Launch for Earth.

### The ending

The rocket lands back on Highway 95 — the game's very first location,
full circle. Rosa is there. Reunion. **Piggy asks to stay** — with
Joseph, Thomas, and Fluffball, not go wherever Rosa was originally going
to send him. Rosa agrees: **Piggy is more trouble than she can handle.**

**THE END** — of Part 4, and of the whole game.

---

## Production notes (all three Parts)

- Same discipline as everything shipped so far applies once any of this
  moves from planning to building: contracts written into
  `docs/CONTRACTS.md` first, palette-locked generated art, pure/tested
  core rules, BFS-verified maps, a headless e2e per act.
- **Scope flag, said plainly:** Part One is ~7 acts at ~30–35 minutes
  each. Three more Parts at 8–10 acts apiece is a genuinely long game
  (roughly 15–20 hours all in) if every act stays that dense. Worth
  deciding early whether every Part-2/3/4 act is mandatory critical path
  at Part-One density, or whether some become shorter/optional beats —
  that's a pacing call for whoever starts building Part 2, not something
  this document should force.
- **New systems this back half needs, roughly in the order they're first
  required:** overworld map + town sub-zones + progressive unlock +
  persistent NPC dialogue state (Part 2); a roster/bench system replacing
  the current fixed two-member party, plus a rocket hub with its own
  interior map and a star-map travel layer (Part 3); section-gated hub
  world reused a third time, plus whatever the puzzle/memory-quest
  mechanic ends up being (Part 4).
- **Character continuity:** Slither and Fluffball (established, Part
  One) carry forward. Thomas and Baby Chick (Part 2) become permanent
  cast — Thomas specifically becomes a second locked-in party member
  alongside Joseph for the rest of the game. Mr. Goose (Part 3) joins the
  roster. Liberty and Chase (Part 4) are likely NPC-only (junkyard
  proprietors), not party members, unless later planning says otherwise.
- **Open thread, not committed to:** Part One's ice/ocean reveal ("the
  ice remembers... it wanted to go home") and Part 3's alien threat are
  sitting right next to each other thematically. Nothing here ties them
  together, but it's a live option for whoever writes Part 3 in detail —
  flagging it so it isn't lost, not deciding it now.
