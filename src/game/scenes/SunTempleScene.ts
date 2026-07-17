/**
 * Act 3, Zone 3 — The Ancient Ruins. A dead-end pocket off the kelp
 * forest: a short orient on arrival, then the carved sun-glyph in the main
 * hall (an InteractPoint) plays the templeLore beat — "the desert was hiding
 * an ecosystem, not treasure." The east gate leads back to the kelp forest.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildSunTempleMap,
  SUNTEMPLE_EXIT_EAST,
  SUNTEMPLE_GLYPH,
  SUNTEMPLE_SPAWN
} from "../maps/sunTempleMap";
import { KELP_TEMPLE_RETURN_SPAWN } from "../maps/kelpForestMap";
import { sunTempleEntryScript } from "../../core/scripts/sunTempleEntry";
import { templeLoreScript } from "../../core/scripts/templeLore";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

export class SunTempleScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private lightMask: LightMask | null = null;

  constructor() {
    super("sunTemple");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "sunTemple",
      zoneName: "The Ancient Ruins",
      map: buildSunTempleMap(),
      defaultSpawn: SUNTEMPLE_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.animateTilePair("seaWater", "seaWater2");
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...SUNTEMPLE_EXIT_EAST }, "kelpForest", KELP_TEMPLE_RETURN_SPAWN);

    // Entry orientation (antechamber), plays once.
    if (!getState(this).flags.sawTempleEntry) {
      this.addTrigger({ x1: 14, y1: 5, x2: 19, y2: 10 }, () => {
        if (getState(this).flags.sawTempleEntry) return;
        this.openScript(sunTempleEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawTempleEntry: true } });
          this.hud.update(getState(this));
        });
      });
    }

    // The carved sun-glyph: inspect for the lore beat.
    this.addProp("seaSparkle", SUNTEMPLE_GLYPH.x, SUNTEMPLE_GLYPH.y, { depthSort: false });
    this.addInteractPoint(SUNTEMPLE_GLYPH.x, SUNTEMPLE_GLYPH.y, () => {
      this.openScript(templeLoreScript, () => {
        const s = getState(this);
        if (!s.flags.sawTemple) {
          setState(this, { ...s, flags: { ...s.flags, sawTemple: true } });
          this.hud.update(getState(this));
        }
      });
    });

    // "Pillars, silt, dark." — a drowned ruin lit only by the party's lamp.
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.5 },
      follow: this.player,
      followRadius: 110,
      followIntensity: 0.82
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
  }
}
