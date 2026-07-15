/**
 * Act 5, Zone 4 — The Sunlit Cave-In. THE grove chamber: the ceiling cave-in,
 * the underground river, and one orange tree at the dead centre (CHAMBER_TREE)
 * standing in the shaft of desert sun — the visual and narrative focal point.
 *
 * Beat: **Fluffball JOINS** (`CHAMBER_JOIN_TRIGGER` at the foot of the tree).
 * Shaken by the scared chase he witnessed in the approach, the gray chick
 * edges out of the ferns, decides Joseph is trying to HELP Piggy, and sticks
 * around as a non-combat companion — his follower sprite is spawned LIVE here
 * (see FluffballFollower). Two gates: north back to the grotto, east on to
 * Sahra's corner. Sunwasps guard the fruit (encounter zone "grove").
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildGroveChamberMap,
  CHAMBER_ENTRY_TRIGGER,
  CHAMBER_EXIT_EAST,
  CHAMBER_EXIT_NORTH,
  CHAMBER_FLUFF,
  CHAMBER_JOIN_TRIGGER,
  CHAMBER_SPAWN
} from "../maps/groveChamberMap";
import { GROTTO_RETURN_SPAWN } from "../maps/groveGrottoMap";
import { SAHRA_SPAWN } from "../maps/sahraGroveMap";
import { groveChamberEntryScript } from "../../core/scripts/groveChamberEntry";
import { fluffballJoinScript } from "../../core/scripts/fluffballJoin";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";
import { PALETTE } from "../../shared/palette";

export class GroveChamberScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);

  constructor() {
    super("groveChamber");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "groveChamber",
      zoneName: "The Sunlit Cave-In",
      map: buildGroveChamberMap(),
      defaultSpawn: CHAMBER_SPAWN,
      encounterZone: "grove",
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    // On a reload that lands here after the join, Fluffball is already aboard.
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.animateTilePair("groveWater", "groveWater2");

    this.addExit({ ...CHAMBER_EXIT_NORTH }, "groveGrotto", GROTTO_RETURN_SPAWN);
    this.addExit({ ...CHAMBER_EXIT_EAST }, "sahraGrove", SAHRA_SPAWN);

    if (!getState(this).flags.sawGroveChamber) {
      this.addTrigger({ ...CHAMBER_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawGroveChamber) return;
        this.openScript(groveChamberEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawGroveChamber: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeJoin();
  }

  /** At the foot of the tree, Fluffball edges out of the ferns and joins. */
  private placeJoin(): void {
    if (getState(this).flags.fluffballJoined) return;
    this.addTrigger({ ...CHAMBER_JOIN_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.fluffballJoined) return;
      // A cosmetic Fluffball edges out of the ferns toward the party while the
      // join dialogue plays (opened synchronously so the box stays continuous).
      const fluff = this.add
        .sprite(CHAMBER_FLUFF.x * TILE + TILE / 2, CHAMBER_FLUFF.y * TILE + TILE / 2, "fluffball", 0)
        .setDepth(CHAMBER_FLUFF.y * TILE);
      fluff.play("fluffball-walk");
      this.tweens.add({
        targets: fluff,
        x: this.player.x + 12,
        y: this.player.y + 8,
        duration: 900,
        onUpdate: () => fluff.setDepth(fluff.y)
      });
      this.openScript(fluffballJoinScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, fluffballJoined: true } });
        this.hud.update(getState(this));
        fluff.destroy(); // the cosmetic sprite becomes the real follower
        this.fluffball.spawn(this.player.x, this.player.y);
        this.floatText(this.player.x, this.player.y - 16, "Fluffball joined the party!");
      });
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 1100, onComplete: () => t.destroy() });
  }
}
