/**
 * Act 4, Zone 5 — The Overlook Ledge. A dead-end pocket at the head of the
 * back gallery: a short orient on arrival, then the gray chick is glimpsed on
 * the high side, blurts clue #2 (the RIPEST socks), and bolts. He does NOT
 * join here (that's Act 5) — same glimpse-and-flee structure as Act 3's
 * fluffballBed. The south gate leads back down to the gallery.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildCampLedgeMap,
  LEDGE_ENTRY_TRIGGER,
  LEDGE_EXIT_SOUTH,
  LEDGE_FLUFFBALL,
  LEDGE_SPAWN,
  LEDGE_TRIGGER
} from "../maps/campLedgeMap";
import { GALLERY_LEDGE_RETURN_SPAWN } from "../maps/campGalleryMap";
import { campLedgeEntryScript } from "../../core/scripts/campLedgeEntry";
import { fluffballLedgeScript } from "../../core/scripts/fluffballLedge";
import { SlitherFollower } from "../SlitherFollower";
import { getState, setState } from "../state";

export class CampLedgeScene extends ZoneScene {
  private slither = new SlitherFollower(this);

  constructor() {
    super("campLedge");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "campLedge",
      zoneName: "The Overlook Ledge",
      map: buildCampLedgeMap(),
      defaultSpawn: LEDGE_SPAWN,
      battleBg: "mine"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);

    this.addExit({ ...LEDGE_EXIT_SOUTH }, "campGallery", GALLERY_LEDGE_RETURN_SPAWN);

    // Arrival orientation, plays once.
    if (!getState(this).flags.sawLedge) {
      this.addTrigger({ ...LEDGE_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawLedge) return;
        this.openScript(campLedgeEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawLedge: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.placeFluffball();
  }

  /** Fluffball, glimpsed on the ledge: one line (clue #2), then he bolts. */
  private placeFluffball(): void {
    if (getState(this).flags.fluffballLedge) return;
    const fluff = this.add
      .sprite(LEDGE_FLUFFBALL.x * TILE + TILE / 2, LEDGE_FLUFFBALL.y * TILE + TILE / 2, "fluffball", 0)
      .setDepth(LEDGE_FLUFFBALL.y * TILE + TILE / 2);
    fluff.play("fluffball-idle");
    this.addTrigger({ ...LEDGE_TRIGGER }, () => {
      const s = getState(this);
      if (s.flags.fluffballLedge) return;
      this.openScript(fluffballLedgeScript, () => {
        const cur = getState(this);
        setState(this, { ...cur, flags: { ...cur.flags, fluffballLedge: true } });
        this.hud.update(getState(this));
        // He bolts up and off the ledge, a gray blur.
        fluff.play("fluffball-walk");
        this.tweens.add({
          targets: fluff,
          x: fluff.x - 2 * TILE,
          y: fluff.y - TILE,
          duration: 650,
          onUpdate: () => fluff.setDepth(fluff.y),
          onComplete: () =>
            this.tweens.add({ targets: fluff, alpha: 0, duration: 250, onComplete: () => fluff.destroy() })
        });
      });
    });
  }

  protected onUpdate(): void {
    this.slither.update(this.player.x, this.player.y);
  }
}
