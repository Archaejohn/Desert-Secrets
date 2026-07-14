/**
 * The Shed — a small utility yard south of the homestead. One job: find
 * the bucket needed to feed and water the chickens back at the coop.
 * Entirely optional; nothing here blocks the main storyline.
 */
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import { buildShedMap, SHED_BUCKET, SHED_NORTH_EXIT, SHED_SPAWN } from "../maps/shedMap";
import { OASIS_SOUTH_SPAWN } from "../maps/oasisMap";
import { getState, setState } from "../state";
import { PALETTE } from "../../shared/palette";

export class ShedScene extends ZoneScene {
  constructor() {
    super("shed");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "shed",
      zoneName: "The Shed",
      map: buildShedMap(),
      defaultSpawn: SHED_SPAWN,
      battleBg: "desert"
    };
  }

  protected populate(): void {
    if (getState(this).items.bucket === "none") {
      const bucket = this.add.sprite(
        SHED_BUCKET.x * TILE + TILE / 2,
        SHED_BUCKET.y * TILE + TILE / 2,
        "bucket",
        0
      );
      bucket.play("bucket-empty");
      bucket.setDepth(bucket.y);
      // Press-E pickup: fires once, on an explicit key/tap press only.
      this.addInteractPoint(
        SHED_BUCKET.x,
        SHED_BUCKET.y,
        () => {
          bucket.destroy();
          const s = getState(this);
          setState(this, { ...s, items: { ...s.items, bucket: "empty" } });
          this.floatText(SHED_BUCKET.x * TILE + TILE / 2, SHED_BUCKET.y * TILE, "Got a bucket. Open the bag (I) to equip it.");
        },
        { once: true }
      );
    }

    this.addExit({ ...SHED_NORTH_EXIT }, "oasis", OASIS_SOUTH_SPAWN);
  }

  private floatText(x: number, y: number, msg: string): void {
    const t = this.add
      .text(x, y, msg, { fontFamily: "monospace", fontSize: "8px", color: PALETTE.atbGold })
      .setOrigin(0.5, 1)
      .setDepth(6500);
    this.tweens.add({ targets: t, y: y - 18, alpha: 0, duration: 900, onComplete: () => t.destroy() });
  }
}
