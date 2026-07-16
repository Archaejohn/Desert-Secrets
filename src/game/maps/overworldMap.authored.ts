/**
 * Hand-authored overworld layout — the "human touch" slot.
 *
 * `buildOverworldMap()` finishes this through the game's own autotile passes
 * (see `finishAuthoredLayout` in `overworldMap.ts`) when it is non-null,
 * otherwise it falls back to the terrain-first procedural generator. This is
 * where the map editor (`tools/mapeditor`, run via `npm run mapeditor`) drops
 * its exported layout: paint the Open Desert by hand, click "Copy authored.ts",
 * and replace the constant below.
 *
 * An `AuthoredOverworld` stores only the SEMANTIC layout — a compact terrain
 * field (`.` sand / `#` mountain / `~` water), the two gate columns, and the
 * landmark markers — never concrete `owMountain*` / `scree*` / `lakeShore*`
 * tile names. The finishing passes derive those, exactly as they do for the
 * procedural map, so a hand-drawn layout tiles identically to a generated one.
 *
 * Whatever is authored here must still satisfy every overworld invariant in
 * `tests/game/maps.test.ts` (64×64, known tile names, enclosed by mountain
 * except the two gates, every walkable cell reachable from a spawn, mostly-
 * open desert, the truck/spring near the south gate and mine timber near the
 * north). Those tests are the safety net — the editor's reachability overlay
 * mirrors them so a walled-off pocket shows up before it ever ships.
 */
import type { AuthoredOverworld } from "./overworldMap";

export const AUTHORED_OVERWORLD: AuthoredOverworld | null = null;
