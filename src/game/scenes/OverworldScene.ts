/**
 * The Open Desert — a small proof-of-concept world map (FF3/FF6 style):
 * a tiny, compressed terrain layer with exactly two stops rather than a
 * fully detailed zone. South leads back to the oasis, past the wash and
 * the overturned truck; north climbs to the Cinnabar Mine entrance.
 * Random encounters run the length of the pass, same as the Trail.
 *
 * Renders with the same flat top-down tilemap every other zone uses, just
 * zoomed further out (`OVERWORLD_FLAT_ZOOM`) for a "see more of the map at
 * once" big-world feel — this is the default (docs/CONTRACTS.md "v21").
 * Movement, collision, exits and encounters run in ordinary tile-grid space
 * exactly as the base class drives them regardless of which view is active.
 *
 * A true SNES-Mode-7 perspective ground plane (see src/game/gfx/
 * Mode7Ground.ts + src/core/mode7.ts) is also kept fully intact behind the
 * `mode7tune` dev flag (see `readDebugMode()`) for a planned future
 * vehicle sequence (a rocketship, possibly a motorcycle/speedboat later) —
 * it is NOT the shipped default anymore, but every line of it still works
 * exactly as before when that flag selects it. If Mode-7 setup fails (no
 * WebGL, texture/shader error) it falls back to the flat tilemap rather
 * than crashing.
 */
import Phaser from "phaser";
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import { BILLBOARD_TEXTURE_KEY, Mode7Ground } from "../gfx/Mode7Ground";
import { Mode7Tuner } from "../gfx/Mode7Tuner";
import { FlatZoomTuner } from "../gfx/FlatZoomTuner";
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
/**
 * Default camera zoom for the flat overworld view (every other zone stays
 * at the implicit default of 1 — see ZoneScene's camera setup). 0.8 was
 * the first ship (the least-aggressive zoom that reveals the whole pass at
 * once); the project owner tried it live and asked for a bit further out —
 * 0.7, chosen by hand via the ?mode7tune=flat tuner rather than
 * re-deriving from the map's raw dimensions. Player sprite, HUD text and
 * tile art stay crisp at this zoom on the game's 480×270 internal
 * resolution. The map (256px) is narrower than even the old zoom=1
 * viewport (480px), so some dead space past the map's east edge is
 * unavoidable at ANY zoom ≤ 1 regardless of this constant — that's a
 * pre-existing property of this small POC map's width, not something this
 * zoom choice causes or can fix; see docs/CONTRACTS.md "v21" for the full
 * note.
 */
export const OVERWORLD_FLAT_ZOOM = 0.7;

type DebugMode = "off" | "mode7" | "flat";

export class OverworldScene extends ZoneScene {
  private mode7: Mode7Ground | null = null;
  private avatar: Phaser.GameObjects.Sprite | null = null;
  private avatarAnimKey = "";
  private tuner: Mode7Tuner | null = null;
  private flatZoomTuner: FlatZoomTuner | null = null;

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
    this.setupView();
  }

  /**
   * Picks the overworld's rendering: the flat tilemap (default, zoomed out
   * for "see more of the map" — every other zone's own rendering, just
   * zoomed) or Mode-7 (dev-only, kept intact for a future vehicle
   * sequence), based on `readDebugMode()`. Zoom is set unconditionally
   * first so a Mode-7 setup failure still falls back to the flat *zoomed*
   * view rather than the old unzoomed default; a successful Mode-7 setup
   * then resets zoom to 1, since Mode-7's shader quad and billboards are
   * screen-space content that a camera zoom would distort/clip (the same
   * "zoom scales scrollFactor(0) content too" behavior this whole
   * architecture works around for the HUD — see ZoneScene's uiCamera).
   */
  private setupView(): void {
    const mode = this.readDebugMode();
    this.cameras.main.setZoom(OVERWORLD_FLAT_ZOOM);
    if (mode === "mode7") {
      this.setupMode7();
      if (this.mode7) this.cameras.main.setZoom(1);
    } else if (mode === "flat") {
      this.flatZoomTuner = new FlatZoomTuner(this, OVERWORLD_FLAT_ZOOM, (zoom) =>
        this.cameras.main.setZoom(zoom)
      );
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.flatZoomTuner?.destroy();
        this.flatZoomTuner = null;
      });
    }
  }

  /**
   * Dev-only camera-view flag (`?mode7tune` in the URL) — never shown to
   * players by default. Tri-state, not boolean: `"off"` (default) is the
   * flat zoomed view with no tuner; `"mode7"` is full Mode-7 + Mode7Tuner,
   * exactly as this flag always behaved before the flat view existed;
   * `"flat"` is the flat zoomed view + FlatZoomTuner, for tuning
   * `OVERWORLD_FLAT_ZOOM` itself. `?mode7tune=1` (or any value that isn't
   * `"0"` or `"flat"`) means `"mode7"`, so existing bookmarks/localStorage
   * from before this flag went tri-state keep behaving exactly as they did.
   *
   * Persisted to localStorage, not just read from the URL: the PWA
   * manifest sets display:"fullscreen", so once installed to a home
   * screen the app always launches from its bare start_url with no
   * address bar to type a query string into. Visiting the URL with
   * ?mode7tune=1 (or =flat) ONCE in a normal browser tab latches it on for
   * every future launch, including the installed app; ?mode7tune=0
   * latches it back off.
   */
  private readDebugMode(): DebugMode {
    const params = new URLSearchParams(window.location.search);
    let mode: DebugMode;
    if (params.has("mode7tune")) {
      const raw = params.get("mode7tune");
      mode = raw === "flat" ? "flat" : raw === "0" || raw === null ? "off" : "mode7";
      try {
        if (mode === "off") window.localStorage.removeItem("mode7tune");
        else window.localStorage.setItem("mode7tune", mode === "flat" ? "flat" : "1");
      } catch {
        // Storage unavailable (private mode, etc.) — the query param still
        // works for this one page load.
      }
    } else {
      try {
        const stored = window.localStorage.getItem("mode7tune");
        mode = stored === "flat" ? "flat" : stored === "1" ? "mode7" : "off";
      } catch {
        mode = "off";
      }
    }
    return mode;
  }

  /** Dev-only, gated behind readDebugMode() === "mode7" — Mode-7's tuner is
   *  always shown alongside it (there's no case where Mode-7 renders for a
   *  player without the tuner; see setupView()). */
  private setupMode7(): void {
    this.mode7 = null;
    this.avatar = null;
    this.avatarAnimKey = "";
    this.tuner?.destroy();
    this.tuner = null;
    if (this.game.renderer.type !== Phaser.WEBGL) return; // Canvas fallback: keep the flat tilemap.

    this.tuner = new Mode7Tuner(
      this,
      (overrides) => this.mode7?.setOverrides(overrides),
      (peakHeight) => this.mode7?.setBillboardHeightScale(peakHeight)
    );

    try {
      this.mode7 = new Mode7Ground(this, this.cfg.map, GROUND_DEPTH, this.tuner?.current());
      if (this.tuner) this.mode7.setBillboardHeightScale(this.tuner.currentPeakHeight());

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
