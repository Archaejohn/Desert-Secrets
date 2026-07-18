/**
 * Soundtrack playback. Each track is an mp3 in public/music/ (copied verbatim
 * into the build — NOT base64-inlined the way generated art is — and loaded at
 * runtime by relative URL, which keeps the single-file index.html small and
 * works offline in the Capacitor WebView / docs/play).
 *
 * A single MusicManager lives on the game registry and survives scene changes
 * (Phaser's sound manager is game-global), so a looping track started in one
 * zone keeps playing into the next when they share a theme — the music only
 * swaps (cross-fading) when the track actually changes. Tracks fade in on
 * scene entrance and loop. Missing/failed files are remembered and skipped, so
 * a zone with no assigned track (or a load error) is simply silent.
 */
import Phaser from "phaser";
import type { ZoneId } from "../../core/gameState";

export type TrackId =
  | "homestead"
  | "desert"
  | "mine"
  | "ice"
  | "camp"
  | "battle"
  | "boss"
  | "testudo"
  | "piggy";

/** Track id -> filename under public/music/. */
const TRACK_FILES: Record<TrackId, string> = {
  homestead: "homestead.mp3",
  desert: "desert.mp3",
  mine: "mine.mp3",
  ice: "ice.mp3",
  camp: "camp.mp3",
  battle: "battle.mp3",
  boss: "boss.mp3",
  testudo: "testudo.mp3",
  piggy: "piggy.mp3"
};

/**
 * Which theme plays in each zone (grouped by act/area). Zones with no entry
 * are silent — we only have tracks for the areas listed here. The pizzeria is
 * handled by PizzeriaScene itself (Testudo's theme, then Piggy's on the catch);
 * pizzaAscent is the post-catch finale walk, so it carries Piggy's theme.
 */
export const ZONE_MUSIC: Partial<Record<ZoneId, TrackId>> = {
  // Act 1 — the crash flats & open desert / the homestead.
  crash: "desert",
  trail: "desert",
  overworld: "desert",
  mineEntrance: "desert",
  oasis: "homestead",
  shed: "homestead",
  // Act 1 — Cinnabar Mine.
  mine: "mine",
  depths: "mine",
  // Act 2 — the ice caves.
  crevasse: "ice",
  maze: "ice",
  galleries: "ice",
  sanctum: "ice",
  // Act 4 — the Miners' Camp.
  minersCamp: "camp",
  campProper: "camp",
  laundryNook: "camp",
  campGallery: "camp",
  campLedge: "camp",
  // Act 7 — the finale walk out, Piggy in tow.
  pizzaAscent: "piggy"
};

const REGISTRY_KEY = "music";
const VOLUME = 0.6;
const FADE_IN_MS = 1000;
const FADE_OUT_MS = 500;

/**
 * Owns soundtrack playback across the whole game. One instance lives on the
 * game registry (see getMusic). Tracks load on demand; a track whose file is
 * missing is remembered in `failed` and never retried.
 */
export class MusicManager {
  /** The track we currently intend to be playing (null = silence). */
  private current: TrackId | null = null;
  /** The track mid-load, if any (guards against double-loading one key). */
  private loading: TrackId | null = null;
  private sound: Phaser.Sound.BaseSound | null = null;
  private readonly failed = new Set<TrackId>();

  constructor(private readonly game: Phaser.Game) {
    void this.game;
  }

  /**
   * Play (fading in) the given track, or null to fade out to silence. Passing
   * the track already playing is a no-op, so zones sharing a theme cross into
   * each other with unbroken music.
   */
  play(scene: Phaser.Scene, track: TrackId | null): void {
    if (track === this.current) return;
    this.current = track;
    if (!track || this.failed.has(track)) {
      this.fadeOutStop(scene);
      return;
    }
    const key = cacheKey(track);
    if (scene.cache.audio.exists(key)) this.start(scene, track, key);
    else this.loadThenPlay(scene, track, key);
  }

  private loadThenPlay(scene: Phaser.Scene, track: TrackId, key: string): void {
    if (this.loading === track) return;
    this.loading = track;
    const clearLoading = () => {
      if (this.loading === track) this.loading = null;
    };
    scene.load.once(`filecomplete-audio-${key}`, () => {
      clearLoading();
      // Only start if it's still the theme we want and it truly landed.
      if (this.current === track && scene.cache.audio.exists(key)) this.start(scene, track, key);
    });
    scene.load.once(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      if (file.key !== key) return;
      this.failed.add(track);
      clearLoading();
      if (this.current === track) this.fadeOutStop(scene);
    });
    scene.load.audio(key, `music/${TRACK_FILES[track]}`);
    if (!scene.load.isLoading()) scene.load.start();
  }

  private start(scene: Phaser.Scene, track: TrackId, key: string): void {
    const prev = this.sound;
    const sound = scene.sound.add(key, { loop: true, volume: 0 });
    this.sound = sound;
    // Plays immediately if the audio context is unlocked; otherwise Phaser
    // starts it on the first user gesture (the title menu tap/keypress).
    sound.play();
    scene.tweens.add({ targets: sound, volume: VOLUME, duration: FADE_IN_MS });
    if (prev) this.retire(scene, prev);
  }

  private fadeOutStop(scene: Phaser.Scene): void {
    if (this.sound) {
      this.retire(scene, this.sound);
      this.sound = null;
    }
  }

  /** Fade a sound out and dispose it (safe if it was never audible). */
  private retire(scene: Phaser.Scene, snd: Phaser.Sound.BaseSound): void {
    scene.tweens.add({
      targets: snd,
      volume: 0,
      duration: FADE_OUT_MS,
      onComplete: () => {
        snd.stop();
        snd.destroy();
      }
    });
  }
}

function cacheKey(track: TrackId): string {
  return `music-${track}`;
}

/** The one MusicManager for this game, created on first use. */
export function getMusic(scene: Phaser.Scene): MusicManager {
  const existing = scene.game.registry.get(REGISTRY_KEY) as MusicManager | undefined;
  if (existing) return existing;
  const created = new MusicManager(scene.game);
  scene.game.registry.set(REGISTRY_KEY, created);
  return created;
}
