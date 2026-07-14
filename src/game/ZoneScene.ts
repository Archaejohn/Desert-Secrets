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
import { getState, setState } from "./state";
import { type ZoneMap, isSolidName, mapSize } from "./maps/types";
import type { DialogueScript } from "../core/dialogue";
import type { ZoneId } from "../core/gameState";
import { EncounterClock, ENCOUNTERS } from "../core/encounters";
import { makeRng } from "../core/rng";
import { PALETTE } from "../shared/palette";
import {
  JoystickVisual,
  addActionButtonHint,
  addFullscreenButton,
  inFullscreenButtonZone,
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
  encounterZone?: "trail" | "mine";
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

export abstract class ZoneScene extends Phaser.Scene {
  protected player!: Phaser.Physics.Arcade.Sprite;
  protected dialogue!: DialogueBox;
  protected hud!: Hud;
  protected facing: Dir = "down";
  protected cfg!: ZoneConfig;
  protected groundLayer!: Phaser.Tilemaps.TilemapLayer;
  protected decorLayer!: Phaser.Tilemaps.TilemapLayer;
  protected inputLocked = false;

  private npcs: Npc[] = [];
  private exits: Exit[] = [];
  private triggers: TriggerZone[] = [];
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private keyInteract!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private talkPrompt!: Phaser.GameObjects.Text;
  private joyOrigin: Phaser.Math.Vector2 | null = null;
  private joyVector = new Phaser.Math.Vector2(0, 0);
  private joystickVisual: JoystickVisual | null = null;
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

  init(data: ZoneEntryData): void {
    this.entry = data ?? {};
    this.npcs = [];
    this.exits = [];
    this.triggers = [];
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

    if (this.cfg.encounterZone) {
      this.encounterClock = new EncounterClock(makeRng(Math.floor(Math.random() * 0xffffffff)));
    }

    this.cameras.main.setBounds(0, 0, width * TILE, height * TILE);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(400);

    addFullscreenButton(this);
    if (isTouchDevice(this)) {
      this.joystickVisual = new JoystickVisual(this);
      addActionButtonHint(this);
    }

    this.populate();
    this.hud.update(getState(this));
  }

  // ---------- construction helpers ----------

  /** Resolve a tile name to a global index across both tilesets. */
  protected tileGid(name: string): number {
    const t1 = MANIFEST.tiles.names[name];
    if (t1 !== undefined) return t1;
    const t2 = MANIFEST.tiles2.names[name];
    if (t2 !== undefined) return 16 + t2;
    throw new Error(`Unknown tile name: ${name}`);
  }

  /** Texture key + frame for drawing a named tile as a plain image prop. */
  protected tileFrame(name: string): { key: string; frame: number } {
    const t1 = MANIFEST.tiles.names[name];
    if (t1 !== undefined) return { key: "tiles", frame: t1 };
    return { key: "tiles2", frame: MANIFEST.tiles2.names[name] };
  }

  private buildMap(width: number, height: number): void {
    const map = this.make.tilemap({ tileWidth: TILE, tileHeight: TILE, width, height });
    const ts1 = map.addTilesetImage("t1", "tiles-img", TILE, TILE, 0, 0, 0)!;
    const ts2 = map.addTilesetImage("t2", "tiles2-img", TILE, TILE, 0, 0, 16)!;
    const sets = [ts1, ts2];
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
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as ZoneScene["wasd"];
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
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

  /** Open a dialogue immediately (cutscenes, radio calls). */
  protected openScript(script: DialogueScript, onClose?: (endNodeId: string | null) => void): void {
    this.player.setVelocity(0, 0);
    this.player.play(`hero-idle-${this.facing}`, true);
    this.dialogue.open(script, onClose);
  }

  /** Hand off to the battle scene; we resume at the same position after victory. */
  protected startBattle(group: string[], opts?: { boss?: boolean; victoryFlag?: string; grace?: boolean }): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.flash(150, 255, 255, 255);
    this.cameras.main.fadeOut(400);
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
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start(target, { spawnTile } satisfies ZoneEntryData);
    });
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

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.inputLocked) return;
    if (inFullscreenButtonZone(this, p)) return; // handled by the button itself
    if (this.dialogue.isOpen) {
      this.dialogue.tapAt(p.x, p.y);
      return;
    }
    if (p.x < this.scale.width / 2) {
      this.joyOrigin = new Phaser.Math.Vector2(p.x, p.y);
      this.joystickVisual?.show(p.x, p.y);
    } else {
      const npc = this.nearestNpc();
      if (npc) this.talkTo(npc);
    }
  }

  update(_time: number, deltaMs: number): void {
    if (this.transitioning) return;
    const dt = deltaMs / 1000;

    // Depth-sort actors.
    this.player.setDepth(this.player.y);
    for (const n of this.npcs) n.sprite.setDepth(n.sprite.y);

    const interactPressed =
      !this.inputLocked &&
      (Phaser.Input.Keyboard.JustDown(this.keyInteract) || Phaser.Input.Keyboard.JustDown(this.keySpace));

    if (this.dialogue.isOpen) {
      this.player.setVelocity(0, 0);
      this.activeNpc?.sprite.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) this.dialogue.moveSelection(-1);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) this.dialogue.moveSelection(1);
      if (interactPressed) this.dialogue.confirm();
      this.talkPrompt.setVisible(false);
      return;
    }

    if (this.inputLocked) {
      this.player.setVelocity(0, 0);
      this.onUpdate(dt);
      return;
    }

    // Talk prompt + interaction.
    const npc = this.nearestNpc();
    this.talkPrompt.setVisible(npc !== null);
    if (npc) {
      this.talkPrompt.setPosition(npc.sprite.x, npc.sprite.y - 26);
      if (interactPressed) {
        this.talkTo(npc);
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
    if (moving && this.encounterClock && this.cfg.encounterZone) {
      const group = this.encounterClock.advance(dt, ENCOUNTERS[this.cfg.encounterZone]);
      if (group) {
        this.startBattle(group);
        return;
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
