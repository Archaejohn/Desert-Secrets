/**
 * The Slither world-follower rig, factored out of the Act 2/3/4 zones so
 * every Sunless Sea zone shares one implementation. Slither trails the
 * player's recent positions (~14 frames back), facing the way he moves and
 * depth-sorting like any actor. Create one per populate() (scene objects are
 * destroyed on restart), call spawn() once the party has Slither, and pump
 * update(player.x, player.y) each frame from the scene's onUpdate().
 */
import type Phaser from "phaser";

const FOLLOW_FRAMES = 14;

export class SlitherFollower {
  private sprite: Phaser.GameObjects.Sprite | null = null;
  private trail: Array<{ x: number; y: number }> = [];

  constructor(private scene: Phaser.Scene) {}

  spawn(x: number, y: number): void {
    if (this.sprite) return;
    this.sprite = this.scene.add.sprite(x, y + 4, "slither", 0);
    this.sprite.play("slither-move");
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
    this.sprite.play(moving ? "slither-move" : "slither-idle", true);
    this.sprite.setPosition(target.x, target.y);
    this.sprite.setDepth(target.y);
  }
}
