/**
 * Zone 5 — The Depths (Act 1, Beat 5 + cliffhanger). The cold gallery:
 * an underground spring ringed with scarab eggs, Piggy huddled at its
 * rim, and the Dust Queen in the way. Parley (if the cold pack is still
 * held) or fight; after victory an aftershock collapses the solid rock
 * gallery wall into rubble, exposing a sheer face of blue glacial ice that
 * glows (a LightMask blue pulse) and streams a doorway of light into the
 * gallery. Piggy waddles into it — and the player must then follow Joseph
 * INTO that glowing ice (a walk-in trigger, not an auto-teleport) to roll
 * the Act 1 end card and descend into Act 2.
 */
import type Phaser from "phaser";
import { ZoneScene, TILE, type ZoneConfig } from "../ZoneScene";
import {
  buildDepthsMap,
  DEPTHS_APPROACH,
  DEPTHS_CRACK,
  DEPTHS_PIGGY,
  DEPTHS_PIGGY_END,
  DEPTHS_QUEEN,
  DEPTHS_SOUTH_EXIT,
  DEPTHS_SPAWN
} from "../maps/depthsMap";
import { MINE_ELEVATOR_SPAWN } from "../maps/mineMap";
import { queenFightScript } from "../../core/scripts/queenFight";
import { queenParleyScript } from "../../core/scripts/queenParley";
import {
  cliffhangerAftershockScript,
  cliffhangerIceRevealScript,
  cliffhangerPiggyScript,
  cliffhangerSealedScript
} from "../../core/scripts/cliffhanger";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";

/** Piggy's final spot: centered beneath the two cracked ice tiles. */
const PIGGY_END_PX = {
  x: DEPTHS_PIGGY_END.x * TILE + TILE, // midpoint of the 2-tile crack
  y: DEPTHS_PIGGY_END.y * TILE + TILE / 2
};

export class DepthsScene extends ZoneScene {
  private iceGlow: LightMask | null = null;
  private portalHint: Phaser.GameObjects.Text | null = null;
  private endCardShown = false;

  constructor() {
    super("depths");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "depths",
      zoneName: "The Depths",
      map: buildDepthsMap(),
      defaultSpawn: DEPTHS_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.animateTilePair("water", "water2");
    this.addExit({ ...DEPTHS_SOUTH_EXIT }, "mine", MINE_ELEVATOR_SPAWN);

    const s = getState(this);
    const piggy = this.add
      .sprite(DEPTHS_PIGGY.x * TILE + TILE / 2, DEPTHS_PIGGY.y * TILE + TILE / 2, "piggy", 0)
      .setDepth(DEPTHS_PIGGY.y * TILE + TILE / 2);
    piggy.play("piggy-idle");

    if (!s.flags.queenResolved) {
      const queen = this.add
        .sprite(DEPTHS_QUEEN.x * TILE + TILE / 2, DEPTHS_QUEEN.y * TILE + TILE / 2, "queen", 0)
        .setScale(1)
        .setDepth(DEPTHS_QUEEN.y * TILE + TILE / 2);
      queen.play("queen-idle");

      this.addTrigger({ ...DEPTHS_APPROACH }, () => {
        const cur = getState(this);
        const script = cur.items.coldPack ? queenParleyScript : queenFightScript;
        this.openScript(script, (endNodeId) => {
          if (endNodeId === "parley-end") {
            const st = getState(this);
            setState(this, { ...st, flags: { ...st.flags, parleyed: true } });
            this.startBattle(["queenWeakened"], { boss: true, victoryFlag: "queenResolved" });
          } else {
            this.startBattle(["queen"], { boss: true, victoryFlag: "queenResolved" });
          }
        });
      });
    } else if (!s.flags.actComplete) {
      // Returning victorious: the Act 1 cliffhanger.
      this.runCliffhanger(piggy);
    } else {
      // Epilogue state (e.g. a reload at the end card): the wall is collapsed
      // and the ice glows as a doorway. Piggy has already gone through it in the
      // live cliffhanger, so he's not standing here — hide him. The player still
      // follows Joseph into the ice to roll the end card (the same walk-in as
      // the live cliffhanger), so a reload can't soft-lock Act 2.
      this.crackWall();
      piggy.setVisible(false);
      this.armIcePortal();
    }
  }

  /**
   * Hand control to the player at the glowing ice: light the ice as a doorway
   * (blue pulse + a shaft of light streaming down into the gallery), nudge
   * them with a hint, and arm a walk-in trigger on the tiles just below the
   * crack. Stepping into the ice — following Piggy — is what rolls the end
   * card. Deliberately an action, never an automatic teleport.
   */
  private armIcePortal(): void {
    this.addIceGlow();
    this.addPortalShaft();
    this.inputLocked = false;

    this.portalHint = this.add
      .text(this.scale.width / 2, this.scale.height - 30, "Follow Piggy into the ice ↑", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.skyBlue,
        backgroundColor: "#24182799",
        padding: { x: 4, y: 2 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(6800)
      .setAlpha(0);
    this.uiLayer.add(this.portalHint);
    this.tweens.add({ targets: this.portalHint, alpha: 1, duration: 700 });

    // The crack sits at row 1 (solid ice); the tiles just below it are where
    // Joseph steps "into" the doorway. once:true — fires a single time.
    this.addTrigger({ x1: 16, y1: 2, x2: 19, y2: 2 }, () => {
      this.portalHint?.destroy();
      this.portalHint = null;
      this.showEndCard();
    });
  }

  /**
   * The aftershock collapses the solid rock gallery wall: the DEPTHS_CRACK
   * tiles (rock, decor row 1) split open to reveal the blue glacial ice
   * behind them — iceWallCrack, whose dark fissure reads as "something vast
   * hangs dark inside" — with a plain ice face above (ground row 0), and the
   * fallen rock scattered as scree rubble on the floor at the wall's foot.
   */
  private crackWall(): void {
    const iceCrackGid = this.tileGid("iceWallCrack");
    const iceGid = this.tileGid("iceWall");
    const rubbleGid = this.tileGid("scree");
    for (const c of DEPTHS_CRACK) {
      // The exposed ice face (still solid — the party can't walk into it).
      this.decorLayer.putTileAt(iceCrackGid, c.x, c.y);
      this.groundLayer.putTileAt(iceGid, c.x, c.y - 1);
      // The collapsed rock, fallen as rubble at the base of the new gap.
      this.decorLayer.putTileAt(rubbleGid, c.x, c.y + 1);
    }
    // The revealed ice wasn't present at build time, so its gids aren't in the
    // layer's collision set yet — keep the wall solid where it's now ice.
    this.decorLayer.setCollision([iceCrackGid], true, false);
    this.groundLayer.setCollision([iceGid], true, false);
  }

  /**
   * Hang a blue glow on the exposed ice — the "and glows blue" of the reveal.
   * A tall, square-falloff footprint over the two crack tiles reads as a wall
   * of light rather than a round lamp; the slow pulse makes the ice breathe.
   * Created only once the wall is cracked (cliffhanger reveal, or the epilogue
   * reload state); pulsed each frame from onUpdate().
   */
  private addIceGlow(): void {
    if (this.iceGlow) return;
    const cx = (DEPTHS_CRACK[0].x + 1) * TILE; // midpoint of the 2-tile crack
    const cy = TILE; // straddling the top edge (ground row 0 + decor row 1)
    const mask = new LightMask(this, { depth: 3500 });
    mask.addLight({
      x: cx,
      y: cy,
      width: 44,
      height: 64,
      shape: "square",
      blend: "add",
      pulse: { min: 0.35, max: 1, periodMs: 1600 },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.skyBlue), alpha: 0.85 },
        { offset: 0.5, color: hexToInt(PALETTE.slate), alpha: 0.45 },
        { offset: 1, color: hexToInt(PALETTE.slate), alpha: 0 }
      ]
    });
    this.iceGlow = mask;
  }

  /**
   * A short doorway-style shaft of light streaming DOWN out of the ice into
   * the gallery — a linear gradient clipped to a trapezoid that widens as it
   * falls, so the exposed ice reads unmistakably as a portal to step through
   * (the "light coming from the door"). Added onto the same mask as the ice
   * pulse; pulsed each frame from onUpdate().
   */
  private addPortalShaft(): void {
    if (!this.iceGlow) return;
    const cx = (DEPTHS_CRACK[0].x + 1) * TILE; // midpoint of the 2-tile crack
    this.iceGlow.addLight({
      x: cx,
      y: TILE * 4, // centre of the shaft as it falls into the gallery
      width: 84,
      height: TILE * 7,
      gradient: "linear",
      angle: Math.PI / 2, // top → bottom: stream down, out of the ice
      blend: "add",
      intensity: 0.75,
      pulse: { min: 0.65, max: 1, periodMs: 2200 },
      mask: {
        type: "poly",
        points: [
          { x: 0.42, y: 0 },
          { x: 0.58, y: 0 },
          { x: 0.88, y: 1 },
          { x: 0.12, y: 1 }
        ]
      },
      stops: [
        { offset: 0, color: hexToInt(PALETTE.skyBlue), alpha: 0.6 },
        { offset: 0.5, color: hexToInt(PALETTE.bone), alpha: 0.28 },
        { offset: 1, color: hexToInt(PALETTE.skyBlue), alpha: 0 }
      ]
    });
  }

  protected onUpdate(): void {
    this.iceGlow?.update();
  }

  /**
   * Four beats, each with its visual counterpart triggered at the moment
   * the dialogue describes it (not minutes of game-time earlier): the
   * rumble, THEN the wall actually cracks as "it splits and glows blue"
   * opens, THEN Piggy actually walks as "he waddles toward the ice" opens,
   * THEN the elevator seals the way back. Broken into small steps (rather
   * than one deeply-nested closure) so each beat's visual cue is easy to
   * find next to the dialogue it belongs to.
   */
  private runCliffhanger(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = true;
    this.cameras.main.shake(700, 0.008);
    this.time.delayedCall(800, () => this.cliffhangerAftershock(piggy));
  }

  private cliffhangerAftershock(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerAftershockScript, () => {
      this.inputLocked = true;
      // The wall actually collapses now; a short beat to actually see it
      // before the next dialogue box describes exactly that.
      this.crackWall();
      this.addIceGlow();
      this.cameras.main.shake(300, 0.004);
      this.time.delayedCall(500, () => this.cliffhangerIceReveal(piggy));
    });
  }

  private cliffhangerIceReveal(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerIceRevealScript, () => {
      this.inputLocked = true;
      this.cliffhangerPiggyWalk(piggy);
    });
  }

  private cliffhangerPiggyWalk(piggy: Phaser.GameObjects.Sprite): void {
    this.inputLocked = false;
    this.openScript(cliffhangerPiggyScript, () => {
      this.inputLocked = true;
      // Piggy's walk starts now, as the line describing it plays out on
      // screen instead of having already finished off-screen.
      piggy.play("piggy-walk");
      this.tweens.add({
        targets: piggy,
        x: PIGGY_END_PX.x,
        y: PIGGY_END_PX.y,
        duration: 2500,
        onUpdate: () => piggy.setDepth(piggy.y),
        onComplete: () => {
          // He reaches the glowing ice and holds there a beat...
          piggy.play("piggy-idle");
          this.time.delayedCall(900, () => this.cliffhangerPiggyIntoIce(piggy));
        }
      });
    });
  }

  /**
   * ...then Piggy steps up INTO the ice-door and fades through it — so the
   * sealed beat's "Piggy's already at the ice... we follow him in" lands on a
   * doorway he's genuinely gone through, not one he's still standing in front
   * of. The rock/ice crack is the row above his feet, so he moves up (−y) as he
   * dissolves. Hidden (not destroyed) on complete so the epilogue path can rely
   * on the same sprite reference.
   */
  private cliffhangerPiggyIntoIce(piggy: Phaser.GameObjects.Sprite): void {
    piggy.play("piggy-walk");
    this.tweens.add({
      targets: piggy,
      y: PIGGY_END_PX.y - 20,
      alpha: 0,
      duration: 1100,
      onUpdate: () => piggy.setDepth(piggy.y),
      onComplete: () => {
        piggy.setVisible(false);
        this.cliffhangerSealed();
      }
    });
  }

  private cliffhangerSealed(): void {
    this.inputLocked = false;
    this.openScript(cliffhangerSealedScript, () => {
      const st = getState(this);
      setState(this, { ...st, flags: { ...st.flags, actComplete: true } });
      // Hand control back and light the doorway. The end card comes only when
      // the player walks Joseph into the ice (armIcePortal), not on its own.
      this.armIcePortal();
    });
  }

  private showEndCard(): void {
    if (this.endCardShown) return;
    this.endCardShown = true;
    const w = this.scale.width;
    const h = this.scale.height;
    const backdrop = this.add
      .rectangle(w / 2, h / 2, w, h, hexToInt(PALETTE.ink), 0.94)
      .setScrollFactor(0)
      .setDepth(7000);
    const title = this.add
      .text(w / 2, h / 2 - 28, "END OF ACT 1", {
        fontFamily: "monospace",
        fontSize: "18px",
        color: PALETTE.atbGold
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const next = this.add
      .text(w / 2, h / 2, "ACT 2: THE ICE BELOW", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: PALETTE.skyBlue
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(7001);
    const prompt = this.add
      .text(w / 2, h / 2 + 26, "SPACE to descend", {
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

    // The Act 2 hand-off: descend into the crevasse, keeping all progress.
    let descended = false;
    const descend = (): void => {
      if (descended) return;
      descended = true;
      const st = getState(this);
      setState(this, { ...st, flags: { ...st.flags, act2Started: true } });
      this.scene.start("crevasse");
    };
    this.input.keyboard?.once("keydown-SPACE", descend);
    this.input.once("pointerdown", descend);
  }
}
