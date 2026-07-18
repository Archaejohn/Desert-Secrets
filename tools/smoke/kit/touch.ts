/**
 * Touch-only helpers, ported from tools/smoke/touch-e2e.mjs (canvasRect
 * :51, tapRightSide :98, tapCampRest :442). These drive the CANVAS via
 * `page.touchscreen.tap(x, y)` in a touch-emulated context (hasTouch +
 * isMobile) — distinct from kit/actions.ts's `tap`, which holds a keyboard
 * key. Import shared snapshot/action helpers from kit/ rather than
 * redefining them here.
 */
import type { Page } from "@playwright/test";

/** Screen-space bounding rect of the game canvas (for touch taps). */
export async function canvasRect(page: Page): Promise<DOMRect> {
  return page.evaluate(() => (window as any).__game.canvas.getBoundingClientRect());
}

/**
 * Tap the right side of the canvas — the game's touch tap-to-interact /
 * advance-dialogue target (an InteractPoint/NPC in range, or any plain
 * dialogue line).
 */
export async function tapRightSide(page: Page): Promise<void> {
  const rect = await canvasRect(page);
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}

/**
 * Touch equivalent of kit/actions.ts's restPointCheck: stand on a rest
 * point's tile and use it via a right-side tap (not a keyboard tap),
 * dismissing the flavor line the same way if it opens. Ported from
 * touch-e2e.mjs's `tapCampRest` (:442), generalized to any zone/tile the
 * way restPointCheck is (the source hardcoded campProper).
 */
export async function tapCampRest(page: Page, zone: string, tx: number, ty: number): Promise<void> {
  await page.evaluate(
    ([zone, tx, ty]) => {
      const w = (window as any).__game.scene.getScene(zone as string);
      w.player.body.reset((tx as number) * 16 + 8, (ty as number) * 16 + 8);
    },
    [zone, tx, ty] as const
  );
  await page.waitForTimeout(200);
  await tapRightSide(page);
  await page.waitForTimeout(300);
  const open = await page.evaluate(
    (zone) => (window as any).__game.scene.getScene(zone as string).dialogue.isOpen,
    zone
  );
  if (open) {
    await tapRightSide(page);
    await page.waitForTimeout(200);
  }
}
