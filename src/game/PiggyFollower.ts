/**
 * The Piggy world-follower rig — the third of its family (after SlitherFollower
 * and FluffballFollower), added in Act 7's finale once Piggy is finally caught
 * (`flags.piggyCaught`). Piggy is not a battle companion in Part One (that's
 * Part Two's job); here he simply waddles along behind the party on the walk
 * back up, the payoff of the whole chase. He trails FURTHEST back
 * (FOLLOW_FRAMES 38 vs Fluffball's 26 and Slither's 14) so the whole found
 * family lines up single-file: Joseph, Slither, Fluffball, then Piggy.
 *
 * Same shape as the other two rigs: create one per populate(), spawn() once
 * Piggy is caught, and pump update(player.x, player.y) each frame.
 */
import type Phaser from "phaser";

const FOLLOW_FRAMES = 38;

export class PiggyFollower {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];

  constructor(private scene: Phaser.Scene) {}

  /** Spawn the follower once. Idempotent — no-op if the sprite already exists. */
  spawn(x: number, y: number): void {
    if (this.sprite) return;
    this.sprite = this.scene.add.sprite(x, y + 4, "piggy", 0);
    this.sprite.play("piggy-idle");
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
    this.sprite.play(moving ? "piggy-walk" : "piggy-idle", true);
    this.sprite.setPosition(target.x, target.y);
    this.sprite.setDepth(target.y);
  }
}
