/**
 * Base class for all explorable Act 1 zones. Owns the shared machinery:
 * two-tileset map building, player movement (keyboard + touch), NPCs and
 * dialogue, exits between zones, random-encounter clock, checkpoint
 * registration, HUD, and battle hand-off. Concrete zones supply map data,
 * NPCs/props and scripted triggers via config()/populate().
 */
import Phaser from "phaser";
import { MANIFEST } from "./manifest";
import { DialogueBox } from "./ui/DialogueBox";
import { Hud } from "./ui/Hud";
import { InventoryMenu } from "./ui/InventoryMenu";
import { getState, setState } from "./state";
import { type ZoneMap, isSolidName, mapSize } from "./maps/types";
import type { DialogueScript } from "../core/dialogue";
import { respawn, type ZoneId } from "../core/gameState";
import { nextThomasFragment } from "../core/scripts/thomas";
import { EncounterClock, ENCOUNTERS, type EncounterTable } from "../core/encounters";
import { makeRng } from "../core/rng";
import { PALETTE, hexToInt } from "../shared/palette";
import {
  JoystickVisual,
  addActionButtonHint,
  addFullscreenButton,
  addInventoryButton,
  inFullscreenButtonZone,
  inInventoryButtonZone,
  isTouchDevice
} from "./ui/touch";

export const TILE = 16;
const PLAYER_SPEED = 72;
const TALK_RANGE = 26;

export type Dir = "down" | "left" | "right" | "up";
export type BattleBg = "desert" | "mine" | "ice";

export interface ZoneConfig {
  zoneId: ZoneId;
  zoneName: string;
  map: ZoneMap;
  /** Default spawn in tile coords (used on zone entry and respawn). */
  defaultSpawn: { x: number; y: number };
  encounterZone?: keyof typeof ENCOUNTERS;
  battleBg: BattleBg;
}

export interface ZoneEntryData {
  spawnTile?: { x: number; y: number };
  spawnPx?: { x: number; y: number };
}

interface Npc {
  sprite: Phaser.Physics.Arcade.Sprite;
  animPrefix: string;
  facing: Dir;
  wanderHome: { x: number; y: number } | null;
  script: () => DialogueScript | null;
  onClose?: (endNodeId: string | null) => void;
}

interface Exit {
  rect: { x1: number; y1: number; x2: number; y2: number };
  target: ZoneId;
  spawnTile: { x: number; y: number };
}

interface TriggerZone {
  rect: { x1: number; y1: number; x2: number; y2: number };
  once: boolean;
  fired: boolean;
  cb: () => void;
}

/** A stand-in-range, press-E interaction (spigot, bucket pickup, coop drop-off). */
interface InteractPoint {
  x: number;
  y: number;
  range: number;
  once: boolean;
  onUse: () => void;
}

export abstract class ZoneScene extends Phaser.Scene {
  protected player!: Phaser.Physics.Arcade.Sprite;
  protected dialogue!: DialogueBox;
  protected hud!: Hud;
  protected facing: Dir = "down";
  protected cfg!: ZoneConfig;
  protected groundLayer!: Phaser.Tilemaps.TilemapLayer;
  protected decorLayer!: Phaser.Tilemaps.TilemapLayer;
  protected inputLocked = false;

  /**
   * Two-camera world/UI split (docs/CONTRACTS.md "v21"). `uiLayer` is an
   * explicit allow-list: every screen-fixed UI element (Hud, DialogueBox,
   * InventoryMenu/PerkMenu/CookingMenu/FishingMenu, the touch controls, the
   * entry hint) adds itself here at construction. `uiCamera` renders ONLY
   * `uiLayer`, at a fixed zoom/scroll, so UI never inherits a world camera
   * zoom change (see OverworldScene's flat-view zoom) the way a naive
   * `cameras.main.setZoom()` would — scrollFactor(0) cancels SCROLL-
   * following only, not zoom. NOT everything with a fixed depth belongs
   * here: `talkPrompt` is deliberately excluded (see its own creation
   * site) because despite living at a UI-ish depth, it's positioned from
   * world coordinates and must scroll/zoom with the world, not stay
   * screen-fixed.
   *
   * Deliberately NOT a mirrored `worldLayer`: a Layer's `ignore()` sets a
   * bitmask on the Layer object itself (checked at render time, so it's
   * agnostic to when children are added/removed — see Phaser's
   * `Layer.js`/`BaseCamera.ignore`), but reparenting is a one-time move at
   * add() time, and this codebase creates world content (tilemap layers,
   * the player, NPCs, blob shadows, addProp() props, world-follower rigs,
   * per-zone cameo sprites, floating XP text, Mode-7's shader quad and
   * billboards) from dozens of call sites across 38 zone files — hand-
   * tracking every one of them into a `worldLayer` is exactly the kind of
   * exhaustive, easy-to-silently-miss sweep that regresses the moment a
   * future zone script adds a sprite without knowing the convention.
   * Instead, `syncUiCameraIgnore()` (called every `update()`) sweeps the
   * scene's own top-level display list (`this.children.list`) each frame
   * and marks everything NOT already parented into `uiLayer` as ignored by
   * `uiCamera` — since `Layer.add()` removes an object from the scene's
   * default display list (Phaser's `Layer.addChildCallback`), anything
   * added to `uiLayer` is automatically excluded from that sweep. This is
   * self-healing for any object creation anywhere, present or future,
   * without per-call-site bookkeeping.
   */
  protected uiLayer!: Phaser.GameObjects.Layer;
  protected uiCamera!: Phaser.Cameras.Scene2D.Camera;

  private npcs: Npc[] = [];
  private blobShadows: Array<{
    owner: Phaser.Physics.Arcade.Sprite;
    shadow: Phaser.GameObjects.Ellipse;
  }> = [];
  private exits: Exit[] = [];
  private triggers: TriggerZone[] = [];
  private interactPoints: InteractPoint[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private keyInteract!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private inventoryMenu: InventoryMenu | null = null;
  private talkPrompt!: Phaser.GameObjects.Text;
  private joyOrigin: Phaser.Math.Vector2 | null = null;
  private joyVector = new Phaser.Math.Vector2(0, 0);
  private joystickVisual: JoystickVisual | null = null;
  private actionHint: Phaser.GameObjects.Container | null = null;
  private transitioning = false;
  private encounterClock: EncounterClock | null = null;
  private animatedTilePairs: Array<[number, number]> = [];
  private animatedTiles: Phaser.Tilemaps.Tile[] = [];
  private tileFlip = false;
  private activeNpc: Npc | null = null;
  private entry: ZoneEntryData = {};

  /** Zone description; called once per create(). */
  protected abstract config(): ZoneConfig;
  /** Place NPCs, props, triggers. Runs after the map and player exist. */
  protected abstract populate(): void;
  /** Per-frame hook for subclasses (runs unless input is locked). */
  protected onUpdate(_dt: number): void {}

  /**
   * The random-encounter table currently in force, or null if this zone has
   * no encounters. Defaults to the zone's static ENCOUNTERS entry; a subclass
   * can override to reweight it from run state (e.g. Act 4's "reeks" mechanic,
   * where carrying the stinky socks makes some enemies avoid the party).
   */
  protected encounterTable(): EncounterTable | null {
    return this.cfg.encounterZone ? ENCOUNTERS[this.cfg.encounterZone] : null;
  }

  init(data: ZoneEntryData): void {
    this.entry = data ?? {};
    this.npcs = [];
    this.blobShadows = [];
    this.exits = [];
    this.triggers = [];
    this.interactPoints = [];
    this.inventoryMenu = null;
    this.transitioning = false;
    this.inputLocked = false;
    this.joyOrigin = null;
    this.joyVector = new Phaser.Math.Vector2(0, 0);
    this.animatedTilePairs = [];
    this.animatedTiles = [];
    this.activeNpc = null;
    this.encounterClock = null;
  }

  create(): void {
    // Created before anything else this frame so every UI widget built
    // below (dialogue, hud, talkPrompt, touch controls, ...) has somewhere
    // to register itself as it's constructed.
    this.uiLayer = this.add.layer();

    this.cfg = this.config();
    const { width, height } = mapSize(this.cfg.map);

    // Checkpoint: entering a zone makes it the respawn point.
    const state = getState(this);
    setState(this, { ...state, zone: this.cfg.zoneId });

    this.buildMap(width, height);
    this.spawnPlayer();
    this.setupInput();

    this.dialogue = new DialogueBox(this);
    this.hud = new Hud(this, this.cfg.zoneName);
    this.talkPrompt = this.add
      .text(0, 0, "E", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.ink,
        backgroundColor: PALETTE.atbGold,
        padding: { x: 2, y: 0 }
      })
      .setOrigin(0.5, 1)
      .setDepth(6000)
      .setVisible(false);
    // Deliberately NOT added to uiLayer: unlike the HUD/dialogue/joystick,
    // this isn't screen-fixed chrome — it's positioned directly from
    // npc.sprite.x/y or interactPoint.x/y (world coordinates, see
    // showTalkPrompt()) and has no scrollFactor(0), so it must render via
    // the world camera (scroll + zoom) to track the NPC it points at. Put
    // on uiLayer once by mistake: uiCamera never scrolls/follows, so a
    // world coordinate rendered through it landed at the wrong screen
    // position entirely, worse once the overworld's camera zoom made the
    // mismatch between "where the camera actually is" and "uiCamera's fixed
    // view of world (0,0)" visible.

    if (this.cfg.encounterZone) {
      this.encounterClock = new EncounterClock(makeRng(Math.floor(Math.random() * 0xffffffff)));
    }

    const mapPxW = width * TILE;
    const mapPxH = height * TILE;
    if (mapPxW <= this.scale.width && mapPxH <= this.scale.height) {
      // The whole room fits on screen at once (the shed, the mine entrance,
      // ...): center it statically rather than following the player. No
      // setBounds() here on purpose — Phaser's bounds-clamping fights a
      // manual centered scroll and snaps it straight back to (0,0) when the
      // bounds are smaller than the viewport, which is exactly the pinned-
      // to-a-corner bug this is fixing.
      this.cameras.main.stopFollow();
      this.cameras.main.setScroll((mapPxW - this.scale.width) / 2, (mapPxH - this.scale.height) / 2);
    } else {
      this.cameras.main.setBounds(0, 0, mapPxW, mapPxH);
      this.cameras.main.startFollow(this.player, true);
    }
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(400);

    // Second camera: renders only `uiLayer`, at a fixed zoom of 1 and no
    // scroll/bounds/follow (scrollFactor(0) content renders at the same
    // fixed screen position on any camera regardless of that camera's own
    // scroll, so uiCamera never needs to track the player). Mirrors the
    // entry fade so UI doesn't pop in ahead of (or lag behind) the world.
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.uiCamera.setRoundPixels(true);
    this.cameras.main.ignore(this.uiLayer);
    this.uiCamera.fadeIn(400);

    addFullscreenButton(this);
    if (isTouchDevice(this)) {
      this.joystickVisual = new JoystickVisual(this);
      this.actionHint = addActionButtonHint(this);
      addInventoryButton(this, () => this.openInventory());
    }

    // Controls reminder on zone entry; fades away after a few seconds.
    const hint = this.add
      .text(
        this.scale.width / 2,
        this.scale.height - 10,
        isTouchDevice(this)
          ? "drag left side to move · tap right side / A to talk · bag to open inventory"
          : "arrows/WASD move · E or SPACE talk & confirm · I for inventory",
        {
          fontFamily: "monospace",
          fontSize: "8px",
          color: PALETTE.bone,
          backgroundColor: "#24182799",
          padding: { x: 4, y: 2 }
        }
      )
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(6000);
    this.uiLayer.add(hint);
    this.tweens.add({ targets: hint, alpha: 0, delay: 7000, duration: 800 });

    this.populate();
    this.hud.update(getState(this));
    // Initial sweep so the very first rendered frame is already correct —
    // update() (which repeats this every frame) doesn't run until after
    // this first frame renders.
    this.syncUiCameraIgnore();
  }

  // ---------- construction helpers ----------

  /**
   * Firstgids across the three tilesets, computed from each tileset's
   * actual tile count rather than hardcoded — a hardcoded tiles3 offset
   * (16 + a hardcoded tiles2 count) previously went stale the moment
   * tiles2 grew (the overworld POC's mountain tiles), silently aliasing
   * onto tiles3's GID range and rendering Act 1 mountains as Act 2 ice.
   */
  private static readonly TILES1_COUNT = Object.keys(MANIFEST.tiles.names).length;
  private static readonly TILES2_COUNT = Object.keys(MANIFEST.tiles2.names).length;
  private static readonly TILES3_COUNT = Object.keys(MANIFEST.tiles3.names).length;
  private static readonly TILES4_COUNT = Object.keys(MANIFEST.tiles4.names).length;
  private static readonly TILES5_COUNT = Object.keys(MANIFEST.tiles5.names).length;
  private static readonly TILES6_COUNT = Object.keys(MANIFEST.tiles6.names).length;
  private static readonly TILES7_COUNT = Object.keys(MANIFEST.tiles7.names).length;
  private static readonly TILES8_COUNT = Object.keys(MANIFEST.tiles8.names).length;
  private static readonly TILES2_FIRSTGID = ZoneScene.TILES1_COUNT;
  private static readonly TILES3_FIRSTGID = ZoneScene.TILES1_COUNT + ZoneScene.TILES2_COUNT;
  private static readonly TILES4_FIRSTGID =
    ZoneScene.TILES1_COUNT + ZoneScene.TILES2_COUNT + ZoneScene.TILES3_COUNT;
  private static readonly TILES5_FIRSTGID =
    ZoneScene.TILES1_COUNT + ZoneScene.TILES2_COUNT + ZoneScene.TILES3_COUNT + ZoneScene.TILES4_COUNT;
  private static readonly TILES6_FIRSTGID =
    ZoneScene.TILES1_COUNT +
    ZoneScene.TILES2_COUNT +
    ZoneScene.TILES3_COUNT +
    ZoneScene.TILES4_COUNT +
    ZoneScene.TILES5_COUNT;
  private static readonly TILES7_FIRSTGID =
    ZoneScene.TILES1_COUNT +
    ZoneScene.TILES2_COUNT +
    ZoneScene.TILES3_COUNT +
    ZoneScene.TILES4_COUNT +
    ZoneScene.TILES5_COUNT +
    ZoneScene.TILES6_COUNT;
  private static readonly TILES8_FIRSTGID =
    ZoneScene.TILES1_COUNT +
    ZoneScene.TILES2_COUNT +
    ZoneScene.TILES3_COUNT +
    ZoneScene.TILES4_COUNT +
    ZoneScene.TILES5_COUNT +
    ZoneScene.TILES6_COUNT +
    ZoneScene.TILES7_COUNT;
  /** owMountains.png (docs/CONTRACTS.md "owMountains"): the overworld's
   *  rounded-corner mountain autotile. Only `overworldMap.ts` ever places
   *  these names, but every zone's flat tilemap is built through this same
   *  shared machinery (the overworld's flat layer is the Mode-7 fallback,
   *  and is always built once up front regardless of whether Mode-7
   *  ultimately renders instead), so it needs a firstgid/tileset slot here
   *  too, appended after tiles8 — additive, no existing gid range moves. */
  private static readonly OW_MOUNTAINS_FIRSTGID =
    ZoneScene.TILES1_COUNT +
    ZoneScene.TILES2_COUNT +
    ZoneScene.TILES3_COUNT +
    ZoneScene.TILES4_COUNT +
    ZoneScene.TILES5_COUNT +
    ZoneScene.TILES6_COUNT +
    ZoneScene.TILES7_COUNT +
    ZoneScene.TILES8_COUNT;

  /** Resolve a tile name to a global index across the tilesets. */
  protected tileGid(name: string): number {
    const t1 = MANIFEST.tiles.names[name];
    if (t1 !== undefined) return t1;
    const t2 = MANIFEST.tiles2.names[name];
    if (t2 !== undefined) return ZoneScene.TILES2_FIRSTGID + t2;
    const t3 = MANIFEST.tiles3.names[name];
    if (t3 !== undefined) return ZoneScene.TILES3_FIRSTGID + t3;
    const t4 = MANIFEST.tiles4.names[name];
    if (t4 !== undefined) return ZoneScene.TILES4_FIRSTGID + t4;
    const t5 = MANIFEST.tiles5.names[name];
    if (t5 !== undefined) return ZoneScene.TILES5_FIRSTGID + t5;
    const t6 = MANIFEST.tiles6.names[name];
    if (t6 !== undefined) return ZoneScene.TILES6_FIRSTGID + t6;
    const t7 = MANIFEST.tiles7.names[name];
    if (t7 !== undefined) return ZoneScene.TILES7_FIRSTGID + t7;
    const t8 = MANIFEST.tiles8.names[name];
    if (t8 !== undefined) return ZoneScene.TILES8_FIRSTGID + t8;
    const t9 = MANIFEST.owMountains.names[name];
    if (t9 !== undefined) return ZoneScene.OW_MOUNTAINS_FIRSTGID + t9;
    throw new Error(`Unknown tile name: ${name}`);
  }

  /**
   * Pixel centres of every tile named `name` on the ground + decor layers.
   * Used to hang lights (or other effects) on all matching tiles without a
   * hand-maintained position array — e.g. a glow on every lantern post or
   * ice crystal. Layers sit at the origin, so tile pixel coords are world
   * coords.
   */
  protected tileCentersNamed(name: string): Array<{ x: number; y: number }> {
    const gid = this.tileGid(name);
    const out: Array<{ x: number; y: number }> = [];
    for (const layer of [this.groundLayer, this.decorLayer]) {
      layer.forEachTile((t) => {
        if (t.index === gid) out.push({ x: t.pixelX + TILE / 2, y: t.pixelY + TILE / 2 });
      });
    }
    return out;
  }

  /** Texture key + frame for drawing a named tile as a plain image prop. */
  protected tileFrame(name: string): { key: string; frame: number } {
    const t1 = MANIFEST.tiles.names[name];
    if (t1 !== undefined) return { key: "tiles", frame: t1 };
    const t2 = MANIFEST.tiles2.names[name];
    if (t2 !== undefined) return { key: "tiles2", frame: t2 };
    const t3 = MANIFEST.tiles3.names[name];
    if (t3 !== undefined) return { key: "tiles3", frame: t3 };
    const t4 = MANIFEST.tiles4.names[name];
    if (t4 !== undefined) return { key: "tiles4", frame: t4 };
    const t5 = MANIFEST.tiles5.names[name];
    if (t5 !== undefined) return { key: "tiles5", frame: t5 };
    const t6 = MANIFEST.tiles6.names[name];
    if (t6 !== undefined) return { key: "tiles6", frame: t6 };
    const t7 = MANIFEST.tiles7.names[name];
    if (t7 !== undefined) return { key: "tiles7", frame: t7 };
    const t8 = MANIFEST.tiles8.names[name];
    if (t8 !== undefined) return { key: "tiles8", frame: t8 };
    return { key: "owMountains", frame: MANIFEST.owMountains.names[name] };
  }

  private buildMap(width: number, height: number): void {
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width, height });
    const ts1 = map.addTilesetImage("t1", "tiles-img", TILE, TILE, 0, 0, 0)!;
    const ts2 = map.addTilesetImage("t2", "tiles2-img", TILE, TILE, 0, 0, ZoneScene.TILES2_FIRSTGID)!;
    const ts3 = map.addTilesetImage("t3", "tiles3-img", TILE, TILE, 0, 0, ZoneScene.TILES3_FIRSTGID)!;
    const ts4 = map.addTilesetImage("t4", "tiles4-img", TILE, TILE, 0, 0, ZoneScene.TILES4_FIRSTGID)!;
    const ts5 = map.addTilesetImage("t5", "tiles5-img", TILE, TILE, 0, 0, ZoneScene.TILES5_FIRSTGID)!;
    const ts6 = map.addTilesetImage("t6", "tiles6-img", TILE, TILE, 0, 0, ZoneScene.TILES6_FIRSTGID)!;
    const ts7 = map.addTilesetImage("t7", "tiles7-img", TILE, TILE, 0, 0, ZoneScene.TILES7_FIRSTGID)!;
    const ts8 = map.addTilesetImage("t8", "tiles8-img", TILE, TILE, 0, 0, ZoneScene.TILES8_FIRSTGID)!;
    const ts9 = map.addTilesetImage(
      "t9",
      "owMountains-img",
      TILE,
      TILE,
      0,
      0,
      ZoneScene.OW_MOUNTAINS_FIRSTGID
    )!;
    const sets = [ts1, ts2, ts3, ts4, ts5, ts6, ts7, ts8, ts9];
    this.groundLayer = map.createBlankLayer("ground", sets)!;
    this.decorLayer = map.createBlankLayer("decor", sets)!;
    const overhead = map.createBlankLayer("overhead", sets)!;
    overhead.setDepth(5000);

    const solidGids = new Set<number>();
    const m = this.cfg.map;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const g = m.ground[y][x];
        this.groundLayer.putTileAt(this.tileGid(g), x, y);
        if (isSolidName(g)) solidGids.add(this.tileGid(g));
        const d = m.decor[y][x];
        if (d !== null) {
          this.decorLayer.putTileAt(this.tileGid(d), x, y);
          if (isSolidName(d)) solidGids.add(this.tileGid(d));
        }
        const o = m.overhead?.[y]?.[x];
        if (o) overhead.putTileAt(this.tileGid(o), x, y);
      }
    }
    this.groundLayer.setCollision([...solidGids]);
    this.decorLayer.setCollision([...solidGids]);
  }

  /** Animate all tiles of nameA <-> nameB on a timer (e.g. water). */
  protected animateTilePair(nameA: string, nameB: string, delay = 550): void {
    const a = this.tileGid(nameA);
    const b = this.tileGid(nameB);
    this.animatedTilePairs.push([a, b]);
    for (const layer of [this.groundLayer, this.decorLayer]) {
      layer.forEachTile((t) => {
        if (t.index === a || t.index === b) this.animatedTiles.push(t);
      });
    }
    if (this.animatedTilePairs.length === 1) {
      this.time.addEvent({
        delay,
        loop: true,
        callback: () => {
          this.tileFlip = !this.tileFlip;
          for (const [ga, gb] of this.animatedTilePairs) {
            for (const t of this.animatedTiles) {
              if (t.index === ga) t.index = gb;
              else if (t.index === gb) t.index = ga;
            }
          }
        }
      });
    }
  }

  private spawnPlayer(): void {
    const spawn = this.entry.spawnPx ??
      (this.entry.spawnTile
        ? { x: this.entry.spawnTile.x * TILE + TILE / 2, y: this.entry.spawnTile.y * TILE + TILE / 2 }
        : {
            x: this.cfg.defaultSpawn.x * TILE + TILE / 2,
            y: this.cfg.defaultSpawn.y * TILE + TILE / 2
          });
    this.player = this.physics.add.sprite(spawn.x, spawn.y, "hero", 0);
    this.player.body!.setSize(10, 8).setOffset(3, 16);
    this.player.play("hero-idle-down");
    this.physics.add.collider(this.player, this.groundLayer);
    this.physics.add.collider(this.player, this.decorLayer);
    this.addBlobShadow(this.player);
  }

  /**
   * Soft elliptical blob shadow grounding an actor (docs/ART_DIRECTION.md §6
   * "engine grounding"): a ~12×5 plum ellipse at low alpha under the feet,
   * kept one depth step below its owner. Pure presentation — no physics body,
   * no effect on the y-depth sort itself.
   */
  private addBlobShadow(owner: Phaser.Physics.Arcade.Sprite): void {
    const shadow = this.add.ellipse(
      owner.x,
      owner.y + owner.displayHeight / 2 - 2,
      12,
      5,
      hexToInt(PALETTE.plum),
      0.35
    );
    this.blobShadows.push({ owner, shadow });
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as ZoneScene["wasd"];
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    // Event-driven, not polled: openInventory() itself is a no-op while a
    // menu is already open, so this can't race with InventoryMenu's own
    // "keydown-I" close listener (a polled JustDown check would — see the
    // bug this replaced in docs/CONTRACTS.md "v6").
    kb.on("keydown-I", () => this.openInventory());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.joyOrigin && p.isDown) {
        this.joyVector.set(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
        this.joystickVisual?.move(this.joyVector.x, this.joyVector.y);
      }
    });
    this.input.on("pointerup", () => {
      this.joyOrigin = null;
      this.joyVector.set(0, 0);
      this.joystickVisual?.hide();
    });
  }

  // ---------- population API for subclasses ----------

  protected addNpc(opts: {
    sheet: string;
    animPrefix?: string;
    tileX: number;
    tileY: number;
    wander?: boolean;
    script: () => DialogueScript | null;
    onClose?: (endNodeId: string | null) => void;
  }): Phaser.Physics.Arcade.Sprite {
    const sprite = this.physics.add.sprite(
      opts.tileX * TILE + TILE / 2,
      opts.tileY * TILE + TILE / 2,
      opts.sheet,
      0
    );
    const prefix = opts.animPrefix ?? opts.sheet;
    if (this.anims.exists(`${prefix}-idle-down`)) {
      sprite.body!.setSize(10, 8).setOffset(3, 16);
      sprite.play(`${prefix}-idle-down`);
    } else if (this.anims.exists(`${prefix}-idle`)) {
      sprite.play(`${prefix}-idle`);
    }
    (sprite.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.physics.add.collider(sprite, this.groundLayer);
    this.physics.add.collider(sprite, this.decorLayer);
    this.physics.add.collider(this.player, sprite);
    const npc: Npc = {
      sprite,
      animPrefix: prefix,
      facing: "down",
      wanderHome: opts.wander ? { x: opts.tileX, y: opts.tileY } : null,
      script: opts.script,
      onClose: opts.onClose
    };
    this.npcs.push(npc);
    this.addBlobShadow(sprite);
    if (opts.wander) {
      this.time.addEvent({ delay: 2400, loop: true, callback: () => this.wanderNpc(npc) });
    }
    return sprite;
  }

  /** A static prop drawn from a named tile (non-colliding unless asked). */
  protected addProp(name: string, tileX: number, tileY: number, opts?: { depthSort?: boolean }): Phaser.GameObjects.Image {
    const { key, frame } = this.tileFrame(name);
    const img = this.add.image(tileX * TILE + TILE / 2, tileY * TILE + TILE / 2, key, frame);
    if (opts?.depthSort) img.setDepth(img.y);
    return img;
  }

  protected addExit(rect: Exit["rect"], target: ZoneId, spawnTile: { x: number; y: number }): void {
    this.exits.push({ rect, target, spawnTile });
  }

  protected addTrigger(rect: TriggerZone["rect"], cb: () => void, once = true): void {
    this.triggers.push({ rect, once, fired: false, cb });
  }

  /**
   * A stand-nearby, press-E interaction (spigot, bucket, coop). Unlike
   * addTrigger, this only fires on an explicit key/tap press — never by
   * just standing on a tile — so it can't refire on its own next frame.
   */
  protected addInteractPoint(
    tileX: number,
    tileY: number,
    onUse: () => void,
    opts?: { range?: number; once?: boolean }
  ): void {
    this.interactPoints.push({
      x: tileX * TILE + TILE / 2,
      y: tileY * TILE + TILE / 2,
      range: opts?.range ?? TALK_RANGE,
      once: opts?.once ?? false,
      onUse
    });
  }

  /**
   * A free, unlimited-use rest point: fully heals the party (reusing the pure
   * respawn() heal-to-full — the same function defeat/level-up use) and plays
   * a short zone-appropriate flavor line. Wired by Acts 3–7 to close the
   * mid-chain "no way to restore HP between fights" gap (see docs/CONTRACTS.md
   * "v19"). Slither always fights at full HP and Fluffball is non-combat, so
   * healing the hero fully heals the party — no extra plumbing needed. Reusable
   * every time: the caller's addInteractPoint stays `once: false` (the default).
   */
  protected restHere(flavor: DialogueScript): void {
    setState(this, respawn(getState(this)));
    this.hud.update(getState(this));
    this.openScript(flavor);
  }

  /** Open a dialogue immediately (cutscenes, radio calls). */
  protected openScript(script: DialogueScript, onClose?: (endNodeId: string | null) => void): void {
    this.player.setVelocity(0, 0);
    this.player.play(`hero-idle-${this.facing}`, true);
    this.dialogue.open(script, onClose);
  }

  /**
   * The Thomas radio thread's sporadic hook (see `scripts/thomas.ts`): play the
   * next unheard one-way fragment and mark it heard, or no-op once all have
   * played. Key story beats call this once their own beat's dialogue closes, so
   * Thomas's voice escalates across Part One toward the Part Two reunion. Safe
   * to call from inside another script's onClose — DialogueBox clears its runner
   * before firing the callback, so re-opening here just starts the next box.
   */
  protected playNextThomas(): void {
    const s = getState(this);
    const frag = nextThomasFragment(s.flags);
    if (!frag) return;
    setState(this, { ...s, flags: { ...s.flags, [frag.flag]: true } });
    this.hud.update(getState(this));
    this.openScript(frag.script);
  }

  /** Hand off to the battle scene; we resume at the same position after victory. */
  protected startBattle(group: string[], opts?: { boss?: boolean; victoryFlag?: string; grace?: boolean }): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(150, 255, 255, 255);
    this.cameras.main.fadeOut(400);
    // Mirrored onto uiCamera: it renders a disjoint set of objects
    // (uiLayer) from a separate camera, so the world camera's flash/fadeOut
    // wouldn't otherwise touch the HUD/dialogue box at all, and the screen
    // would flash-and-fade everywhere except behind the UI.
    this.uiCamera.flash(150, 255, 255, 255);
    this.uiCamera.fadeOut(400);
    const returnTo = { scene: this.cfg.zoneId, x: this.player.x, y: this.player.y };
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("battle", {
        group,
        bg: this.cfg.battleBg,
        boss: opts?.boss ?? false,
        victoryFlag: opts?.victoryFlag,
        returnTo
      });
    });
  }

  protected goToZone(target: ZoneId, spawnTile: { x: number; y: number }): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(350);
    this.uiCamera.fadeOut(350); // see startBattle()'s comment — same reasoning.
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target, { spawnTile } satisfies ZoneEntryData);
    });
  }

  /**
   * Like `goToZone`, but the player visibly GOES THROUGH the exit first
   * instead of the screen just fading — used for the major "act boundary"
   * hand-offs so they read as a real threshold, not a teleport. The kind
   * picks the beat: `"ladder"` climbs up (walk-up pose + rise), `"door"`
   * steps up/through, `"elevator"` sinks down (riding the cage). The player
   * fades out on the beat, then the cameras fade and the target zone starts.
   * Input is locked for the ~0.6s beat. The caller supplies the visible
   * door/ladder tile at the exit; this only plays the character's part.
   */
  protected exitVia(
    kind: "door" | "ladder" | "elevator",
    target: ZoneId,
    spawnTile: { x: number; y: number }
  ): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.inputLocked = true;
    this.player.setVelocity(0, 0);
    const dy = kind === "ladder" ? -TILE * 1.4 : kind === "elevator" ? TILE * 0.7 : -TILE * 0.7;
    const facing: Dir = kind === "elevator" ? this.facing : "up";
    if (this.anims.exists(`hero-walk-${facing}`)) this.player.play(`hero-walk-${facing}`, true);
    this.tweens.add({
      targets: this.player,
      y: this.player.y + dy,
      alpha: 0,
      duration: 640,
      ease: "Sine.easeInOut",
      onComplete: () => {
        this.cameras.main.fadeOut(300);
        this.uiCamera.fadeOut(300);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.start(target, { spawnTile } satisfies ZoneEntryData);
        });
      }
    });
  }

  /**
   * Marks every game object NOT already parented into `uiLayer` as ignored
   * by `uiCamera`, so `uiCamera` only ever draws `uiLayer`'s contents. Run
   * every frame (see `update()`) rather than once: `Camera.ignore()` sets a
   * bitmask on each object at call time (Phaser's `BaseCamera.ignore`), not
   * a live relationship, so a one-time sweep would miss anything added
   * later (NPCs/props from populate(), floating XP text, world-follower
   * spawns, cutscene sprites, ...). `this.uiLayer` itself is a top-level
   * scene child too (that's how `this.add.layer()` works), so the blanket
   * sweep over `this.children.list` would also mark the layer itself as
   * ignored by uiCamera — the explicit unmask after it undoes exactly that
   * one bit. Cheap: `ignore()` is just an OR of a bitmask per object, and
   * the top-level child list is small (a few dozen to a couple hundred
   * objects for a densely propped zone).
   */
  private syncUiCameraIgnore(): void {
    this.uiCamera.ignore(this.children.list);
    this.uiLayer.cameraFilter &= ~this.uiCamera.id;
  }

  // ---------- runtime ----------

  private wanderNpc(npc: Npc): void {
    if (this.dialogue.isOpen || this.inputLocked || !npc.wanderHome) return;
    const speed = 18;
    const choice = Math.floor(Math.random() * 5);
    if (choice === 4) {
      npc.sprite.setVelocity(0, 0);
      this.playNpcAnim(npc, "idle");
      return;
    }
    const dirs: Dir[] = ["down", "left", "right", "up"];
    let dir = dirs[choice];
    if (npc.sprite.x < (npc.wanderHome.x - 3) * TILE) dir = "right";
    if (npc.sprite.x > (npc.wanderHome.x + 3) * TILE) dir = "left";
    if (npc.sprite.y < (npc.wanderHome.y - 2) * TILE) dir = "down";
    if (npc.sprite.y > (npc.wanderHome.y + 2) * TILE) dir = "up";
    npc.facing = dir;
    const v = { down: [0, speed], up: [0, -speed], left: [-speed, 0], right: [speed, 0] }[dir];
    npc.sprite.setVelocity(v[0], v[1]);
    this.playNpcAnim(npc, "walk");
  }

  private playNpcAnim(npc: Npc, kind: "idle" | "walk"): void {
    const directional = `${npc.animPrefix}-${kind}-${npc.facing}`;
    if (this.anims.exists(directional)) npc.sprite.play(directional, true);
    else {
      const flat = `${npc.animPrefix}-${kind === "walk" ? "move" : "idle"}`;
      if (this.anims.exists(flat)) npc.sprite.play(flat, true);
    }
  }

  private nearestNpc(): Npc | null {
    let best: Npc | null = null;
    let bestD = TALK_RANGE;
    for (const n of this.npcs) {
      if (n.script() === null) continue;
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, n.sprite.x, n.sprite.y);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  private nearestInteractPoint(): InteractPoint | null {
    let best: InteractPoint | null = null;
    let bestD = Infinity;
    for (const ip of this.interactPoints) {
      const d = Phaser.Math.Distance.Between(this.player.x, this.player.y, ip.x, ip.y);
      if (d < ip.range && d < bestD) {
        bestD = d;
        best = ip;
      }
    }
    return best;
  }

  /** Opens the inventory window; toggling the bucket equips/unequips it. */
  private openInventory(): void {
    if (this.dialogue.isOpen || this.inputLocked || this.inventoryMenu || this.transitioning) return;
    this.player.setVelocity(0, 0);
    this.player.play(`hero-idle-${this.facing}`, true);
    this.talkPrompt.setVisible(false);
    this.actionHint?.setVisible(false);
    this.inventoryMenu = new InventoryMenu(this, getState(this), {
      onToggleBucket: () => {
        const s = getState(this);
        const equipped: "bucket" | null = s.items.equipped === "bucket" ? null : "bucket";
        const items = { ...s.items, equipped };
        setState(this, { ...s, items });
        return items;
      },
      onClose: () => {
        this.inventoryMenu = null;
      }
    });
  }

  private talkTo(npc: Npc): void {
    const script = npc.script();
    if (!script) return;
    this.activeNpc = npc;
    npc.sprite.setVelocity(0, 0);
    const dx = this.player.x - npc.sprite.x;
    const dy = this.player.y - npc.sprite.y;
    npc.facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    this.playNpcAnim(npc, "idle");
    this.player.setVelocity(0, 0);
    this.player.play(`hero-idle-${this.facing}`, true);
    this.dialogue.open(script, (endNodeId) => {
      this.activeNpc = null;
      npc.onClose?.(endNodeId);
    });
  }

  /**
   * Talk to the nearest NPC, or use the nearest interact point (bucket,
   * spigot, coop) if no NPC is in range. Shared by the keyboard E/SPACE
   * path in update() and the tap-right-side path in onPointerDown() —
   * touch previously only ever checked NPCs, so tapping to use an
   * InteractPoint silently did nothing.
   */
  private interact(): void {
    const npc = this.nearestNpc();
    if (npc) {
      this.talkTo(npc);
      return;
    }
    const interactPoint = this.nearestInteractPoint();
    if (interactPoint) {
      interactPoint.onUse();
      if (interactPoint.once) {
        this.interactPoints = this.interactPoints.filter((p) => p !== interactPoint);
      }
    }
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.inputLocked) return;
    if (this.inventoryMenu) return; // the menu owns pointer input while open
    if (inFullscreenButtonZone(this, p)) return; // handled by the button itself
    if (inInventoryButtonZone(this, p)) return; // handled by the button itself
    if (this.dialogue.isOpen) {
      this.dialogue.tapAt(p.x, p.y);
      return;
    }
    if (p.x < this.scale.width / 2) {
      this.joyOrigin = new Phaser.Math.Vector2(p.x, p.y);
      this.joystickVisual?.show(p.x, p.y);
    } else {
      this.interact();
    }
  }

  update(_time: number, deltaMs: number): void {
    // Runs unconditionally, ahead of every early-return below, so newly
    // added objects (mid-dialogue cutscene sprites, floating XP text, a
    // follower's first spawn(), ...) never get one stray frame of
    // double-rendering through both cameras.
    this.syncUiCameraIgnore();
    if (this.transitioning) return;
    const dt = deltaMs / 1000;

    if (this.inventoryMenu) {
      // The menu owns keyboard/pointer input while open; just idle the player.
      this.actionHint?.setVisible(false);
      this.player.setVelocity(0, 0);
      return;
    }

    // Depth-sort actors.
    this.player.setDepth(this.player.y);
    for (const n of this.npcs) n.sprite.setDepth(n.sprite.y);
    // Blob shadows ride along under their owners' feet, one depth step down.
    for (const { owner, shadow } of this.blobShadows) {
      shadow.setPosition(owner.x, owner.y + owner.displayHeight / 2 - 2);
      shadow.setDepth(owner.depth - 1);
      shadow.setVisible(owner.visible);
    }

    const interactPressed =
      !this.inputLocked &&
      (Phaser.Input.Keyboard.JustDown(this.keyInteract) || Phaser.Input.Keyboard.JustDown(this.keySpace));

    if (this.dialogue.isOpen) {
      // The dialogue box occupies the same bottom-right area as this hint.
      this.actionHint?.setVisible(false);
      this.player.setVelocity(0, 0);
      this.activeNpc?.sprite.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) this.dialogue.moveSelection(-1);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) this.dialogue.moveSelection(1);
      if (interactPressed) this.dialogue.confirm();
      this.talkPrompt.setVisible(false);
      return;
    }

    if (this.inputLocked) {
      this.actionHint?.setVisible(false);
      this.player.setVelocity(0, 0);
      this.onUpdate(dt);
      return;
    }

    this.actionHint?.setVisible(true);

    // Talk prompt + interaction. NPCs take priority over interact points.
    const npc = this.nearestNpc();
    const interactPoint = npc ? null : this.nearestInteractPoint();
    this.talkPrompt.setVisible(npc !== null || interactPoint !== null);
    if (npc) {
      this.talkPrompt.setPosition(npc.sprite.x, npc.sprite.y - 26);
      if (interactPressed) {
        this.interact();
        return;
      }
    } else if (interactPoint) {
      this.talkPrompt.setPosition(interactPoint.x, interactPoint.y - 20);
      if (interactPressed) {
        this.interact();
        return;
      }
    }

    // Movement.
    let vx = 0;
    let vy = 0;
    if (this.cursors.left!.isDown || this.wasd.A.isDown) vx = -1;
    else if (this.cursors.right!.isDown || this.wasd.D.isDown) vx = 1;
    if (this.cursors.up!.isDown || this.wasd.W.isDown) vy = -1;
    else if (this.cursors.down!.isDown || this.wasd.S.isDown) vy = 1;
    if (vx === 0 && vy === 0 && this.joyOrigin && this.joyVector.length() > 8) {
      vx = this.joyVector.x;
      vy = this.joyVector.y;
    }
    const v = new Phaser.Math.Vector2(vx, vy);
    const moving = v.length() > 0;
    if (moving) {
      v.normalize().scale(PLAYER_SPEED);
      this.player.setVelocity(v.x, v.y);
      this.facing = Math.abs(v.x) > Math.abs(v.y) ? (v.x < 0 ? "left" : "right") : v.y < 0 ? "up" : "down";
      this.player.play(`hero-walk-${this.facing}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.play(`hero-idle-${this.facing}`, true);
    }

    // Random encounters while moving.
    if (moving && this.encounterClock) {
      const table = this.encounterTable();
      if (table) {
        const group = this.encounterClock.advance(dt, table);
        if (group) {
          this.startBattle(group);
          return;
        }
      }
    }

    // Exits and triggers by player tile position.
    const tx = Math.floor(this.player.x / TILE);
    const ty = Math.floor(this.player.y / TILE);
    for (const e of this.exits) {
      if (tx >= e.rect.x1 && tx <= e.rect.x2 && ty >= e.rect.y1 && ty <= e.rect.y2) {
        this.goToZone(e.target, e.spawnTile);
        return;
      }
    }
    for (const t of this.triggers) {
      if (t.fired && t.once) continue;
      if (tx >= t.rect.x1 && tx <= t.rect.x2 && ty >= t.rect.y1 && ty <= t.rect.y2) {
        t.fired = true;
        t.cb();
      }
    }

    this.hud.update(getState(this));
    this.onUpdate(dt);
  }
}
