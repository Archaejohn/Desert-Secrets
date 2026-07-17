/**
 * The Fluffball world-follower rig — the twin of SlitherFollower, added in
 * Act 5 when the gray chick finally joins the party (`flags.fluffballJoined`).
 * This rig is Fluffball's OVERWORLD presence only: he trails the player's
 * recent positions like Slither, but sits FURTHER back (FOLLOW_FRAMES 26 vs
 * Slither's 14) so the two line up single-file behind Joseph: Joseph, then
 * Slither, then Fluffball. Since the roster refactor he is ALSO a real
 * combatant — `roster.ts` lists him and `activeParty` puts him in battle once
 * `fluffballJoined` is set; that side is fully data-driven and does not touch
 * this rig.
 *
 * ── REUSE BY ACTS 6–7 ─────────────────────────────────────────────────────
 * Copy this rig (and SlitherFollower) into every new Act 6/7 zone exactly as
 * Slither's has been copied into every zone since Act 2:
 *   private fluffball = new FluffballFollower(this);   // field
 *   this.fluffball = new FluffballFollower(this);       // in populate()
 *   if (getState(this).flags.fluffballJoined) this.fluffball.spawn(px, py);
 *   this.fluffball.update(this.player.x, this.player.y); // in onUpdate()
 * Unlike Slither (present from Act 2), Fluffball may join MID-ACT, so spawn()
 * is safe to call live from a join callback as well as from populate() on a
 * reload that lands after the join — it no-ops if the sprite already exists.
 */
import type Phaser from "phaser";

const FOLLOW_FRAMES = 26;

export class FluffballFollower {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];

  constructor(private scene: Phaser.Scene) {}

  /** Spawn the follower once. Idempotent — safe to call live on the join beat
   *  and again from populate() after a reload. */
  spawn(x: number, y: number): void {
    if (this.sprite) return;
    this.sprite = this.scene.add.sprite(x, y + 4, "fluffball", 0);
    this.sprite.play("fluffball-idle");
    this.sprite.setDepth(this.sprite.y);
  }

  update(px: number, py: number): void {
    if (!this.sprite) return;
    this.trail.push({ x: px, y: py + 4 });
    if (this.trail.length > FOLLOW_FRAMES) this.trail.shift();
    const target = this.trail[0];
    const dx = target.x - this.sprite.x;
    const moving = Math.abs(dx) + Math.abs(target.y - this.sprite.y) > 0.5;
    if (Math.abs(dx) > 0.5) this.sprite.setFlipX(dx < 0); // sheet faces right
    this.sprite.play(moving ? "fluffball-walk" : "fluffball-idle", true);
    this.sprite.setPosition(target.x, target.y);
    this.sprite.setDepth(target.y);
  }
}
