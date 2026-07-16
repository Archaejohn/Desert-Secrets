/**
 * Duck-typed accessor for ZoneScene's UI camera layer (see ZoneScene.ts's
 * `uiLayer`/`uiCamera` fields and docs/CONTRACTS.md's camera-architecture
 * section for the full picture).
 *
 * Small reusable UI widget classes (Hud, DialogueBox, InventoryMenu,
 * PerkMenu, CookingMenu, FishingMenu, the touch controls in touch.ts,
 * FlatZoomTuner) are handed a plain `Phaser.Scene` and can't statically
 * know it's a ZoneScene subclass with a `uiLayer` field — this adds
 * defensively and no-ops when the scene has no such layer. That matters for
 * PerkMenu specifically: it's also constructed by BattleScene, which
 * predates this split and still renders everything through its own single
 * camera (battle isn't part of this camera architecture), so the no-op
 * path there is load-bearing, not just defensive.
 */
import type Phaser from "phaser";

interface SceneWithUiLayer {
  uiLayer?: Phaser.GameObjects.Layer;
}

export function addToUiLayer(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject): void {
  (scene as unknown as SceneWithUiLayer).uiLayer?.add(obj);
}
