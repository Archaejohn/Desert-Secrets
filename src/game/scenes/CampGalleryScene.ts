/**
 * Act 4, Zone 4 — The Back Gallery. The connecting climb between the camp
 * proper and Fluffball's ledge: a disused drift the night-raid frost tracks
 * lead up through, switching back past two half-collapsed walls. A real
 * traversal zone with random encounters (the shared minersCamp table, reek-
 * adjusted while the socks are held). South gate back to the camp, north gate
 * up to the ledge. Slither trails (shared rig).
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildCampGalleryMap,
  GALLERY_ENTRY_TRIGGER,
  GALLERY_EXIT_NORTH,
  GALLERY_EXIT_SOUTH,
  GALLERY_SPAWN
} from "../maps/campGalleryMap";
import { CAMPP_GALLERY_RETURN_SPAWN } from "../maps/campProperMap";
import { LEDGE_SPAWN } from "../maps/campLedgeMap";
import { campGalleryEntryScript } from "../../core/scripts/campGalleryEntry";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";
import { ENCOUNTERS, reekAdjusted, type EncounterTable } from "../../core/encounters";

export class CampGalleryScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("campGallery");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "campGallery",
      zoneName: "The Back Gallery",
      map: buildCampGalleryMap(),
      defaultSpawn: GALLERY_SPAWN,
      encounterZone: "minersCamp",
      battleBg: "mine"
    };
  }

  /** The "reeks" mechanic carries here too (frost scarabs avoid the party). */
  protected encounterTable(): EncounterTable {
    const base = ENCOUNTERS.minersCamp;
    return getState(this).items.stinkySocks ? reekAdjusted(base) : base;
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...GALLERY_EXIT_SOUTH }, "campProper", CAMPP_GALLERY_RETURN_SPAWN);
    this.addExit({ ...GALLERY_EXIT_NORTH }, "campLedge", LEDGE_SPAWN);

    // Arrival orientation (the frost-track trail up), plays once.
    if (!getState(this).flags.sawGallery) {
      this.addTrigger({ ...GALLERY_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawGallery) return;
        this.openScript(campGalleryEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawGallery: true } });
          this.hud.update(getState(this));
        });
      });
    }
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
