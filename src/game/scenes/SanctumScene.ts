/**
 * Act 2, Zone 4 — The Sanctum. The frozen lake: the Rime Warden boss
 * (fought with the full party), then the ending — the lake cracks in a
 * racing line, TWO penguin silhouettes waddle across and dive into the
 * far tunnel, the act2Ending script rolls, and the END OF ACT 2 card
 * sends us back to the title. No random encounters.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildSanctumMap,
  SANCTUM_APPROACH,
  SANCTUM_CRACK,
  SANCTUM_EXIT_WEST,
  SANCTUM_LAKE,
  SANCTUM_PENGUIN_START,
  SANCTUM_SPAWN,
  SANCTUM_TUNNEL,
  SANCTUM_WARDEN
} from "../maps/sanctumMap";
import { GALLERIES_DOOR_SPAWN } from "../maps/galleriesMap";
import { SEA_SPAWN } from "../maps/sunlessSeaMap";
import { wardenIntroScript } from "../../core/scripts/wardenIntro";
import { act2EndingScript } from "../../core/scripts/act2Ending";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

/** How many recent player positions the follower trails behind. */
const FOLLOW_FRAMES = 14;

const TUNNEL_PX = {
  x: SANCTUM_TUNNEL.x * TILE + TILE / 2,
  y: SANCTUM_TUNNEL.y * TILE + TILE / 2
};

export class SanctumScene extends ZoneScene {
  private follower: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];
  private lightMask: LightMask | null = null;

  constructor() {
    super("sanctum");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "sanctum",
      zoneName: "The Sanctum",
      map: buildSanctumMap(),
      defaultSpawn: SANCTUM_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.follower = null;
    this.trail = [];

    this.addExit({ ...SANCTUM_EXIT_WEST }, "galleries", GALLERIES_DOOR_SPAWN);
    this.setupIceLighting();
    if (getState(this).flags.slitherJoined) this.spawnFollower();

    const flags = getState(this).flags;
    if (!flags.wardenDefeated) {
      this.placeWarden();
    } else if (!flags.act2Complete) {
      this.runEnding();
    } else {
      // Epilogue: the quiet lake, already cracked, penguins long gone. A
      // reload at the Act 2 end card must not soft-lock Act 3 — walking to
      // the tunnel the penguins dove through follows them into the sea.
      this.crackLake();
      this.addTrigger(
        { x1: SANCTUM_TUNNEL.x - 1, y1: SANCTUM_TUNNEL.y, x2: SANCTUM_TUNNEL.x + 1, y2: SANCTUM_TUNNEL.y + 1 },
        () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, act3Started: true } });
          this.goToZone("sunlessSea", SEA_SPAWN);
        }
      );
    }
  }

  /** The Rime Warden stands sentinel mid-lake until defeated. */
  private placeWarden(): void {
    const warden = this.add
      .sprite(SANCTUM_WARDEN.x * TILE + TILE / 2, SANCTUM_WARDEN.y * TILE + TILE / 2, "warden", 0)
      .setScale(1.4)
      .setDepth(SANCTUM_WARDEN.y * TILE + TILE / 2);
    warden.play("warden-idle");
    this.addTrigger({ ...SANCTUM_APPROACH }, () => {
      this.openScript(wardenIntroScript, () => {
        this.startBattle(["warden"], { boss: true, victoryFlag: "wardenDefeated" });
      });
    });
  }

  /** Flip the crack line to lakeCrack instantly (epilogue state). */
  private crackLake(): void {
    for (const c of SANCTUM_CRACK) {
      this.groundLayer.putTileAt(this.tileGid("lakeCrack"), c.x, c.y);
    }
  }

  /** The ending: crack race, two penguins cross, script, end card. */
  private runEnding(): void {
    this.inputLocked = true;
    this.cameras.main.shake(600, 0.006);

    // The crack races west → east across the lake.
    SANCTUM_CRACK.forEach((c, i) => {
      this.time.delayedCall(400 + i * 110, () => {
        this.groundLayer.putTileAt(this.tileGid("lakeCrack"), c.x, c.y);
        if (i % 4 === 0) this.cameras.main.shake(140, 0.003);
      });
    });
    const crackDone = 400 + SANCTUM_CRACK.length * 110;

    // Two small shapes waddle the crack line and dive into the tunnel.
    this.time.delayedCall(crackDone + 200, () => {
      this.sendPenguin("piggy", SANCTUM_PENGUIN_START.piggy, 0);
      this.sendPenguin("fluffball", SANCTUM_PENGUIN_START.fluffball, 350);
    });

    this.time.delayedCall(crackDone + 3600, () => {
      // Unlock so the dialogue can be advanced (movement stays blocked
      // while the box is open); relock before the end card.
      this.inputLocked = false;
      this.openScript(act2EndingScript, () => {
        this.inputLocked = true;
        const s = getState(this);
        setState(this, { ...s, flags: { ...s.flags, act2Complete: true } });
        this.showEndCard();
      });
    });
  }

  private sendPenguin(sheet: "piggy" | "fluffball", start: { x: number; y: number }, delay: number): void {
    const p = this.add
      .sprite(start.x * TILE + TILE / 2, start.y * TILE + TILE / 2, sheet, 0)
      .setDepth(start.y * TILE + TILE / 2);
    p.play(`${sheet}-walk`);
    p.setFlipX(false);
    this.tweens.add({
      targets: p,
      x: TUNNEL_PX.x,
      y: TUNNEL_PX.y,
      delay,
      duration: 2600,
      onUpdate: () => p.setDepth(p.y),
      onComplete: () => {
        this.tweens.add({ targets: p, alpha: 0, duration: 250, onComplete: () => p.destroy() });
      }
    });
  }

  private showEndCard(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const backdrop = this.add
      .rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94)
      .setScrollFactor(0)
      .setDepth(7000);
    const title = this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 2", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const next = this.add
      .text(w / 2, h / 2, "ACT 3: THE SUNLESS SEA", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.skyBlue
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const prompt = this.add
      .text(w / 2, h / 2 + 26, "SPACE — follow the crack", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.bone
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    // See PizzaAscentScene's showEndCard() for why this must join uiLayer
    // (the two-camera world/UI split would otherwise let the HUD draw on
    // top of this card instead of under it).
    this.uiLayer.add([backdrop, title, next, prompt]);

    // The Act 3 hand-off: dive after the penguins, keeping all progress.
    let descended = false;
    const descend = (): void => {
      if (descended) return;
      descended = true;
      const s = getState(this);
      setState(this, { ...s, flags: { ...s.flags, act3Started: true } });
      this.scene.start("sunlessSea", {});
    };
    this.input.keyboard?.once("keydown-SPACE", descend);
    this.input.once("pointerdown", descend);
  }

  /**
   * The frozen lake's blue glow: a gentle, even ambient dark (no follow lamp —
   * the two-penguin ending must stay evenly lit, not spotlit on Joseph) that
   * the cold blue ice cuts through. The crystals each breathe, and the whole
   * lake sheet gets one wide, slow square wash so the ice reads as putting off
   * its own light.
   */
  private setupIceLighting(): void {
    const mask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.42 },
      blue: [
        ...this.tileCentersNamed("crystalBig"),
        ...this.tileCentersNamed("crystalSmall").map((p) => ({ ...p, radius: 30 }))
      ],
      blueIntensity: 0.6
    });
    mask.addLight({
      x: ((SANCTUM_LAKE.x1 + SANCTUM_LAKE.x2 + 1) / 2) * TILE,
      y: ((SANCTUM_LAKE.y1 + SANCTUM_LAKE.y2 + 1) / 2) * TILE,
      width: (SANCTUM_LAKE.x2 - SANCTUM_LAKE.x1 + 1) * TILE,
      height: (SANCTUM_LAKE.y2 - SANCTUM_LAKE.y1 + 1) * TILE,
      shape: "square",
      blend: "add",
      pulse: { min: 0.4, max: 0.85, periodMs: 2600 },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.skyBlue), alpha: 0.28 },
        { offset: 0.6, color: hexToInt(PALETTE.slate), alpha: 0.14 },
        { offset: 1, color: hexToInt(PALETTE.slate), alpha: 0 }
      ]
    });
    this.lightMask = mask;
  }

  /** Slither trails the player's recent positions (~14 frames back). */
  private spawnFollower(): void {
    if (this.follower) return;
    this.follower = this.add.sprite(this.player.x, this.player.y + 4, "slither", 0);
    this.follower.play("slither-move");
    this.follower.setDepth(this.follower.y);
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    if (!this.follower) return;
    this.trail.push({ x: this.player.x, y: this.player.y + 4 });
    if (this.trail.length > FOLLOW_FRAMES) this.trail.shift();
    const target = this.trail[0];
    const dx = target.x - this.follower.x;
    const moving = Math.abs(dx) + Math.abs(target.y - this.follower.y) > 0.5;
    if (Math.abs(dx) > 0.5) this.follower.setFlipX(dx < 0); // sheet faces right
    this.follower.play(moving ? "slither-move" : "slither-idle", true);
    this.follower.setPosition(target.x, target.y);
    this.follower.setDepth(target.y);
  }
}
