/**
 * The Open Desert — a small proof-of-concept world map (FF3/FF6 style):
 * a tiny, compressed terrain layer with exactly two stops rather than a
 * fully detailed zone. South leads back to the oasis, past the wash and
 * the overturned truck; north climbs to the Cinnabar Mine entrance.
 * Random encounters run the length of the pass, same as the Trail.
 *
 * This is the one zone rendered with a true SNES-Mode-7 perspective ground
 * plane (see src/game/gfx/Mode7Ground.ts + src/core/mode7.ts) instead of the
 * flat top-down tilemap every other zone uses. Movement, collision, exits and
 * encounters still run in ordinary tile-grid space exactly as the base class
 * drives them — only the RENDERING is swapped, and only here. If the Mode-7
 * setup fails (no WebGL, texture/shader error) it falls back to the flat
 * tilemap rather than crashing.
 */
import Phaser from "phaser";
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import { BILLBOARD_TEXTURE_KEY, Mode7Ground } from "../gfx/Mode7Ground";
import { Mode7Tuner } from "../gfx/Mode7Tuner";
import { MANIFEST } from "../manifest";
import owBillboardsUrl from "../../assets/generated/owBillboards.png";
import {
  buildOverworldMap,
  OVERWORLD_NORTH_EXIT,
  OVERWORLD_SOUTH_EXIT,
  OVERWORLD_SOUTH_SPAWN
} from "../maps/overworldMap";
import { OASIS_NORTH_SPAWN } from "../maps/oasisMap";
import { MINE_ENTRANCE_SPAWN } from "../maps/mineEntranceMap";

const GROUND_DEPTH = -100;
const AVATAR_SCALE = 2.5;
/** Player avatar feet, as a fraction of the ground band (horizon..bottom). */
const AVATAR_FEET_FRACTION = 0.66;

export class OverworldScene extends ZoneScene {
  private mode7: Mode7Ground | null = null;
  private avatar: Phaser.GameObjects.Sprite | null = null;
  private avatarAnimKey = "";
  private tuner: Mode7Tuner | null = null;

  constructor() {
    super("overworld");
  }

  /** The billboard sheet is only used here, so it loads here rather than in
   *  BootScene (frame geometry from the manifest's owBillboards contract). */
  preload(): void {
    if (this.textures.exists(BILLBOARD_TEXTURE_KEY)) return;
    this.load.spritesheet(BILLBOARD_TEXTURE_KEY, owBillboardsUrl, {
      frameWidth: MANIFEST.owBillboards.frameWidth,
      frameHeight: MANIFEST.owBillboards.frameHeight
    });
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "overworld",
      zoneName: "The Open Desert",
      map: buildOverworldMap(),
      defaultSpawn: OVERWORLD_SOUTH_SPAWN,
      encounterZone: "overworld",
      battleBg: "desert"
    };
  }

  protected populate(): void {
    this.addExit({ ...OVERWORLD_SOUTH_EXIT }, "oasis", OASIS_NORTH_SPAWN);
    this.addExit({ ...OVERWORLD_NORTH_EXIT }, "mineEntrance", MINE_ENTRANCE_SPAWN);
    this.setupMode7();
  }

  private setupMode7(): void {
    this.mode7 = null;
    this.avatar = null;
    this.avatarAnimKey = "";
    this.tuner?.destroy();
    this.tuner = null;
    if (this.game.renderer.type !== Phaser.WEBGL) return; // Canvas fallback: keep the flat tilemap.

    // Dev-only camera tuner (?mode7tune in the URL) — never shown to players
    // by default. Lets the project owner drag elevation/zoom/angle live on
    // their own device and read off the exact numbers to hand back as the
    // new MODE7_* defaults (see Mode7Tuner's doc comment).
    //
    // Persisted to localStorage, not just read from the URL: the PWA
    // manifest sets display:"fullscreen", so once installed to a home
    // screen the app always launches from its bare start_url with no
    // address bar to type a query string into. Visiting the URL with
    // ?mode7tune=1 ONCE in a normal browser tab latches it on for every
    // future launch, including the installed app; ?mode7tune=0 latches it
    // back off.
    const params = new URLSearchParams(window.location.search);
    let tuning: boolean;
    if (params.has("mode7tune")) {
      tuning = params.get("mode7tune") !== "0";
      try {
        if (tuning) window.localStorage.setItem("mode7tune", "1");
        else window.localStorage.removeItem("mode7tune");
      } catch {
        // Storage unavailable (private mode, etc.) — the query param still
        // works for this one page load.
      }
    } else {
      try {
        tuning = window.localStorage.getItem("mode7tune") === "1";
      } catch {
        tuning = false;
      }
    }
    if (tuning) {
      this.tuner = new Mode7Tuner(this, (overrides) => this.mode7?.setOverrides(overrides));
    }

    try {
      this.mode7 = new Mode7Ground(this, this.cfg.map, GROUND_DEPTH, this.tuner?.current());

      // The flat tilemap keeps driving collision but must not be seen; the
      // real player sprite likewise stays the source of truth for position
      // while a fixed on-screen avatar represents "you are here".
      this.groundLayer.setVisible(false);
      this.decorLayer.setVisible(false);
      this.player.setVisible(false);

      const feetY =
        this.mode7.horizonY +
        Math.round((this.scale.height - this.mode7.horizonY) * AVATAR_FEET_FRACTION);
      // Depth = feet screen-y so the avatar sorts among the billboards
      // (nearer masses draw in front of it, farther ones behind).
      this.avatar = this.add
        .sprite(this.scale.width / 2, feetY, "hero", 0)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setScale(AVATAR_SCALE)
        .setDepth(feetY);

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.mode7?.destroy();
        this.mode7 = null;
        this.tuner?.destroy();
        this.tuner = null;
      });
    } catch (err) {
      console.warn("Mode 7 setup failed; falling back to the flat overworld tilemap.", err);
      this.mode7?.destroy();
      this.mode7 = null;
      this.tuner?.destroy();
      this.tuner = null;
      this.groundLayer.setVisible(true);
      this.decorLayer.setVisible(true);
      this.player.setVisible(true);
      this.avatar?.destroy();
      this.avatar = null;
    }
  }

  protected onUpdate(): void {
    if (!this.mode7) return;
    this.mode7.update(this.player.x, this.player.y);
    if (this.avatar) {
      // Recomputed every frame (not just once at setup) because the tuner
      // (mode7tune) can change horizonY live — the avatar's feet must stay
      // pinned at the same fraction of the ground band as the horizon moves.
      const feetY =
        this.mode7.horizonY +
        Math.round((this.scale.height - this.mode7.horizonY) * AVATAR_FEET_FRACTION);
      this.avatar.setPosition(this.avatar.x, feetY).setDepth(feetY);
      const key = this.player.anims.currentAnim?.key ?? "";
      if (key && key !== this.avatarAnimKey) {
        this.avatar.play(key, true);
        this.avatarAnimKey = key;
      }
    }
  }
}
