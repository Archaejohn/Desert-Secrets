/**
 * The explorable desert: tilemap terrain, the playable wanderer, Sahra the
 * Keeper (talk to her), and a patrolling scarab that starts an ATB battle
 * on contact. Works with keyboard (arrows/WASD + E/Space) and touch
 * (drag left half to move, tap right half to interact/advance).
 */
import Phaser from "phaser";
import { tileIndex } from "../manifest";
import {
  buildWorldMap,
  MAP_HEIGHT,
  MAP_WIDTH,
  SOLID_NAMES,
  SPAWNS
} from "../worldMap";
import { DialogueBox } from "../ui/DialogueBox";
import { sahraScript } from "../../core/scripts/sahra";
import { PALETTE } from "../../shared/palette";

const TILE = 16;
const PLAYER_SPEED = 72;
const NPC_SPEED = 18;
const TALK_RANGE = 26;

type Dir = "down" | "left" | "right" | "up";

export interface WorldSceneData {
  scarabDefeated?: boolean;
  playerSpawn?: { x: number; y: number };
}

export class WorldScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private npc!: Phaser.Physics.Arcade.Sprite;
  private scarab: Phaser.Physics.Arcade.Sprite | null = null;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D", Phaser.Input.Keyboard.Key>;
  private keyInteract!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private facing: Dir = "down";
  private npcFacing: Dir = "down";
  private dialogue!: DialogueBox;
  private talkPrompt!: Phaser.GameObjects.Text;
  private waterTiles: Phaser.Tilemaps.Tile[] = [];
  private waterFlip = false;
  private joyOrigin: Phaser.Math.Vector2 | null = null;
  private joyVector = new Phaser.Math.Vector2(0, 0);
  private battleStarting = false;
  private sceneData: WorldSceneData = {};

  constructor() {
    super("World");
  }

  init(data: WorldSceneData): void {
    this.sceneData = data ?? {};
    this.battleStarting = false;
    this.waterTiles = [];
    this.joyOrigin = null;
    this.joyVector.set(0, 0);
    this.scarab = null;
  }

  create(): void {
    const mapData = buildWorldMap();
    const map = this.make.tilemap({
      tileWidth: TILE,
      tileHeight: TILE,
      width: MAP_WIDTH,
      height: MAP_HEIGHT
    });
    const tileset = map.addTilesetImage("tiles-img")!;
    const ground = map.createBlankLayer("ground", tileset)!;
    const decor = map.createBlankLayer("decor", tileset)!;
    const overhead = map.createBlankLayer("overhead", tileset)!;
    overhead.setDepth(5000);

    const solidIndices = new Set(SOLID_NAMES.map((n) => tileIndex(n)));
    const waterIdx = tileIndex("water");
    const water2Idx = tileIndex("water2");

    for (let y = 0; y < MAP_HEIGHT; y++) {
      for (let x = 0; x < MAP_WIDTH; x++) {
        const g = ground.putTileAt(tileIndex(mapData.ground[y][x]), x, y);
        if (g.index === waterIdx || g.index === water2Idx) this.waterTiles.push(g);
        const d = mapData.decor[y][x];
        if (d === "palmTop") overhead.putTileAt(tileIndex(d), x, y);
        else if (d) decor.putTileAt(tileIndex(d), x, y);
      }
    }
    ground.setCollision([...solidIndices].filter((i) => i === waterIdx || i === water2Idx));
    decor.setCollision([...solidIndices]);

    // Animated oasis water.
    this.time.addEvent({
      delay: 550,
      loop: true,
      callback: () => {
        this.waterFlip = !this.waterFlip;
        for (const t of this.waterTiles) {
          t.index = this.waterFlip
            ? t.index === waterIdx
              ? water2Idx
              : waterIdx
            : t.index === water2Idx
              ? waterIdx
              : water2Idx;
        }
      }
    });

    // --- Characters ---
    const spawn = this.sceneData.playerSpawn ?? {
      x: SPAWNS.player.x * TILE + TILE / 2,
      y: SPAWNS.player.y * TILE + TILE / 2
    };
    this.player = this.physics.add.sprite(spawn.x, spawn.y, "hero", 0);
    this.player.body!.setSize(10, 8).setOffset(3, 16);
    this.player.play("hero-idle-down");

    this.npc = this.physics.add.sprite(
      SPAWNS.npc.x * TILE + TILE / 2,
      SPAWNS.npc.y * TILE + TILE / 2,
      "npc",
      0
    );
    this.npc.body!.setSize(10, 8).setOffset(3, 16);
    (this.npc.body as Phaser.Physics.Arcade.Body).setImmovable(true);
    this.npc.play("npc-idle-down");
    this.time.addEvent({ delay: 2400, loop: true, callback: () => this.npcWander() });

    if (!this.sceneData.scarabDefeated) {
      this.scarab = this.physics.add.sprite(
        SPAWNS.scarab.x * TILE + TILE / 2,
        SPAWNS.scarab.y * TILE + TILE / 2,
        "scarab",
        0
      );
      this.scarab.play("scarab-move");
      this.scarab.setVelocityX(24);
      this.physics.add.collider(this.scarab, decor, () => this.turnScarab());
      this.physics.add.overlap(this.player, this.scarab, () => this.startBattle());
    }

    for (const s of [this.player, this.npc]) {
      this.physics.add.collider(s, ground);
      this.physics.add.collider(s, decor);
    }
    this.physics.add.collider(this.player, this.npc);

    // --- Camera ---
    this.cameras.main.setBounds(0, 0, MAP_WIDTH * TILE, MAP_HEIGHT * TILE);
    this.cameras.main.startFollow(this.player, true);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(400);

    // --- Input ---
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = kb.addKeys("W,A,S,D") as WorldScene["wasd"];
    this.keyInteract = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.keySpace = kb.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.onPointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (this.joyOrigin && p.isDown) {
        this.joyVector.set(p.x - this.joyOrigin.x, p.y - this.joyOrigin.y);
      }
    });
    this.input.on("pointerup", () => {
      this.joyOrigin = null;
      this.joyVector.set(0, 0);
    });

    // --- UI ---
    this.dialogue = new DialogueBox(this);
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

    this.add
      .text(4, 4, "move: arrows/WASD or drag · talk: E / tap", {
        fontFamily: "monospace",
        fontSize: "8px",
        color: PALETTE.bone,
        backgroundColor: "#24182799",
        padding: { x: 3, y: 2 }
      })
      .setScrollFactor(0)
      .setDepth(6000);
  }

  private onPointerDown(p: Phaser.Input.Pointer): void {
    if (this.dialogue.isOpen) {
      this.dialogue.tapAt(p.y);
      return;
    }
    if (p.x < this.scale.width / 2) {
      this.joyOrigin = new Phaser.Math.Vector2(p.x, p.y);
    } else if (this.nearNpc()) {
      this.openDialogue();
    }
  }

  private nearNpc(): boolean {
    return (
      Phaser.Math.Distance.Between(this.player.x, this.player.y, this.npc.x, this.npc.y) <
      TALK_RANGE
    );
  }

  private openDialogue(): void {
    this.npc.setVelocity(0, 0);
    // Face the player.
    const dx = this.player.x - this.npc.x;
    const dy = this.player.y - this.npc.y;
    this.npcFacing =
      Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : dy < 0 ? "up" : "down";
    this.npc.play(`npc-idle-${this.npcFacing}`);
    this.player.setVelocity(0, 0);
    this.player.play(`hero-idle-${this.facing}`);
    this.dialogue.open(sahraScript);
  }

  private npcWander(): void {
    if (this.dialogue.isOpen) return;
    const home = SPAWNS.npc;
    const choice = Math.floor(Math.random() * 5);
    if (choice === 4) {
      this.npc.setVelocity(0, 0);
      this.npc.play(`npc-idle-${this.npcFacing}`);
      return;
    }
    const dirs: Dir[] = ["down", "left", "right", "up"];
    let dir = dirs[choice];
    // Drift back toward home if straying.
    if (this.npc.x < (home.x - 3) * TILE) dir = "right";
    if (this.npc.x > (home.x + 3) * TILE) dir = "left";
    if (this.npc.y < (home.y - 2) * TILE) dir = "down";
    if (this.npc.y > (home.y + 2) * TILE) dir = "up";
    this.npcFacing = dir;
    const v = {
      down: [0, NPC_SPEED],
      up: [0, -NPC_SPEED],
      left: [-NPC_SPEED, 0],
      right: [NPC_SPEED, 0]
    }[dir];
    this.npc.setVelocity(v[0], v[1]);
    this.npc.play(`npc-walk-${dir}`, true);
  }

  private turnScarab(): void {
    if (!this.scarab || !this.scarab.body) return;
    const vx = this.scarab.body.velocity.x <= 0 ? 24 : -24;
    this.scarab.setVelocityX(vx);
    this.scarab.setFlipX(vx < 0);
  }

  private startBattle(): void {
    if (this.battleStarting || this.dialogue.isOpen) return;
    this.battleStarting = true;
    this.player.setVelocity(0, 0);
    this.scarab?.setVelocity(0, 0);
    this.cameras.main.flash(150, 255, 255, 255);
    this.cameras.main.fadeOut(450);
    const returnSpawn = { x: this.player.x, y: this.player.y - 12 };
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start("Battle", { returnSpawn });
    });
  }

  update(): void {
    if (this.battleStarting) return;

    // Depth-sort actors by feet position.
    for (const s of [this.player, this.npc, this.scarab]) {
      if (s) s.setDepth(s.y);
    }

    // Scarab patrol turnaround on a simple leash.
    if (this.scarab?.body) {
      const sx = SPAWNS.scarab.x * TILE;
      if (this.scarab.x < sx - 56 && this.scarab.body.velocity.x < 0) this.turnScarab();
      if (this.scarab.x > sx + 56 && this.scarab.body.velocity.x > 0) this.turnScarab();
    }

    const interactPressed =
      Phaser.Input.Keyboard.JustDown(this.keyInteract) ||
      Phaser.Input.Keyboard.JustDown(this.keySpace);

    if (this.dialogue.isOpen) {
      this.player.setVelocity(0, 0);
      this.npc.setVelocity(0, 0);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up!)) this.dialogue.moveSelection(-1);
      if (Phaser.Input.Keyboard.JustDown(this.cursors.down!)) this.dialogue.moveSelection(1);
      if (interactPressed) this.dialogue.confirm();
      this.talkPrompt.setVisible(false);
      return;
    }

    // Talk prompt + interaction.
    const canTalk = this.nearNpc();
    this.talkPrompt.setVisible(canTalk);
    if (canTalk) {
      this.talkPrompt.setPosition(this.npc.x, this.npc.y - 26);
      if (interactPressed) {
        this.openDialogue();
        return;
      }
    }

    // Movement: keyboard OR touch joystick.
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
    if (v.length() > 0) {
      v.normalize().scale(PLAYER_SPEED);
      this.player.setVelocity(v.x, v.y);
      this.facing =
        Math.abs(v.x) > Math.abs(v.y) ? (v.x < 0 ? "left" : "right") : v.y < 0 ? "up" : "down";
      this.player.play(`hero-walk-${this.facing}`, true);
    } else {
      this.player.setVelocity(0, 0);
      this.player.play(`hero-idle-${this.facing}`, true);
    }
  }
}
