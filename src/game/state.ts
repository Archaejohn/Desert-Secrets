/**
 * Bridge between Phaser's registry and the pure Act 1 run state.
 * All rules live in src/core/gameState.ts; scenes read/write through here.
 */
import type Phaser from "phaser";
import { type Act1State, newGame } from "../core/gameState";

const KEY = "act1";

export function getState(scene: Phaser.Scene): Act1State {
  let s = scene.registry.get(KEY) as Act1State | undefined;
  if (!s) {
    s = newGame();
    scene.registry.set(KEY, s);
  }
  return s;
}

export function setState(scene: Phaser.Scene, s: Act1State): void {
  scene.registry.set(KEY, s);
}

export function resetGame(scene: Phaser.Scene): Act1State {
  const s = newGame();
  scene.registry.set(KEY, s);
  return s;
}
