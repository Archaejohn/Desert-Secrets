/**
 * Touch-specific regression coverage, ported from tools/smoke/touch-e2e.mjs
 * onto the shared kit + @playwright/test. Runs in a real touch-emulated
 * Chromium context (hasTouch + isMobile — see the `touch` project in
 * playwright.config.ts), separate from the keyboard-driven act specs,
 * because these bugs only reproduce with `isTouchDevice()` true: (1) tapping
 * to use an InteractPoint (bucket/spigot/coop) — the tap-to-interact path
 * only ever checked NPCs, so touch players got no response at all; (2) the
 * dialogue choice list's on-screen ▲/✓/▼ buttons, added because precisely
 * tapping a tiny choice row was unreliable; (3) the same ▲/✓/▼ column in the
 * battle command/target menu.
 *
 * This is targeted touch-regression coverage, not a full playthrough: after
 * a fresh NEW GAME (needed to exercise touch-only navigation through John's
 * opening choice hub and the tutorial battle for real), later beats jump
 * straight to their zone via a direct registry/scene patch — exactly as the
 * source did — because no committed fixture lands on the exact mid-act
 * states this test exercises (e.g. deepBed with the Lurker already beaten
 * but not yet re-cast, or campProper mid-chain with no fixture at all).
 *
 * Every check() from the source becomes one expect() below, in the same
 * order.
 */
import { test, expect, type Page } from "@playwright/test";
import { snapshot, waitFor, waitForBoot } from "../kit/snapshot";
import { tap } from "../kit/actions";
import { canvasRect, tapRightSide, tapCampRest } from "../kit/touch";
import { jumpTo as debugJumpTo } from "../kit/debug";
import { installPageErrors, getPageErrors } from "../kit/errors";

test.beforeEach(async ({ page }) => {
  installPageErrors(page);
});

// ---------- spec-local helpers: on-screen ▲/✓/▼ button geometry ----------
// These read a scene's `touchButtons`/`menuTouchButtons` descriptor and its
// container's local origin, then convert to screen-space (canvas rect +
// game-scale factor) the same way the source computed it inline at each
// call site. Kept local to this spec (not kit/touch.ts) since they're
// UI-geometry glue specific to this port, not general touch-input helpers.
type Pt = { x: number; y: number };

async function dialogueButtonColumn(page: Page, zone: string): Promise<{ up: Pt; confirm: Pt; down: Pt }> {
  return page.evaluate((zone) => {
    const w = (window as any).__game.scene.getScene(zone);
    const dlg = w.dialogue;
    const btns = dlg["touchButtons"];
    const rect = (window as any).__game.canvas.getBoundingClientRect();
    const scaleX = rect.width / (window as any).__game.scale.width;
    const scaleY = rect.height / (window as any).__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    const mid = (localY: number) => ({
      x: rect.x + (cx + btns.x + btns.size / 2) * scaleX,
      y: rect.y + (cy + localY + btns.size / 2) * scaleY,
    });
    return { up: mid(btns.top), confirm: mid(btns.top + btns.gap), down: mid(btns.top + btns.gap * 2) };
  }, zone);
}

async function dialogueDownConfirmButtons(page: Page, zone: string): Promise<{ down: Pt; confirm: Pt }> {
  return page.evaluate((zone) => {
    const w = (window as any).__game.scene.getScene(zone);
    const dlg = w.dialogue;
    const b = dlg["touchButtons"];
    const rect = (window as any).__game.canvas.getBoundingClientRect();
    const scaleX = rect.width / (window as any).__game.scale.width;
    const scaleY = rect.height / (window as any).__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    return {
      down: { x: rect.x + (cx + b.x + b.size / 2) * scaleX, y: rect.y + (cy + b.top + b.gap * 2 + b.size / 2) * scaleY },
      confirm: { x: rect.x + (cx + b.x + b.size / 2) * scaleX, y: rect.y + (cy + b.top + b.gap + b.size / 2) * scaleY },
    };
  }, zone);
}

async function dialogueConfirmButton(page: Page, zone: string): Promise<Pt> {
  return page.evaluate((zone) => {
    const w = (window as any).__game.scene.getScene(zone);
    const dlg = w.dialogue;
    const b = dlg["touchButtons"];
    const rect = (window as any).__game.canvas.getBoundingClientRect();
    const sx = rect.width / (window as any).__game.scale.width;
    const sy = rect.height / (window as any).__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    return { x: rect.x + (cx + b.x + b.size / 2) * sx, y: rect.y + (cy + b.top + b.gap + b.size / 2) * sy };
  }, zone);
}

// ---------- spec-local helper: jump straight to a mid-act checkpoint ----------
// Ported verbatim from the source's repeated inline blocks (Acts 3-7):
// patch the act1 registry state (zone/hp/flags/items), stop every non-boot
// scene, and start the target zone fresh. `driveTriggersUntil`/`exitTo`
// style kit helpers don't apply here — the source deliberately skips the
// preceding acts' navigation to land on a specific touch-input surface.
async function jumpTo(
  page: Page,
  patch: { zone: string; hp?: number; flags: Record<string, boolean>; items?: Record<string, boolean> }
): Promise<void> {
  await debugJumpTo(page, { zone: patch.zone, flags: patch.flags, items: patch.items, hp: patch.hp, settleMs: 1300 });
}

test.setTimeout(600_000);

test("touch — tap-to-interact, dialogue/battle touch buttons, and title-menu button gating", async ({
  page,
}) => {
  // ---------- Boot fresh, confirm touch is detected, NEW GAME ----------
  // A plain one-time evaluate (not addInitScript, which re-runs on every
  // navigation) — this test reloads later to exercise the title menu's
  // CONTINUE, and an addInitScript clear would wipe that save on reload too.
  await page.goto("/");
  await waitForBoot(page);
  await page.evaluate(() => localStorage.clear());
  const isTouch = await page.evaluate(() => (window as any).__game.device.input.touch);
  expect(isTouch, "game detects a touch device in this context").toBe(true);

  await tap(page, "Space"); // NEW GAME
  await waitFor(page, (x) => x.zoneKey === "crash", 8000);

  // ---------- Tap-to-interact reaches an InteractPoint, not just NPCs ----------
  // Stop every other active scene first: a bare scene.start() does not stop
  // the current one, and kit's snapshot() picks the current zone as the
  // FIRST active scene matching ZONE_KEYS — leaving "crash" running would
  // shadow "oasis" there (same gotcha noted in flows/act1.ts).
  await page.evaluate(() => {
    const g = (window as any).__game;
    for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
    g.scene.start("oasis", {});
  });
  await waitFor(page, (x) => x.zoneKey === "oasis", 8000);
  const coopPoint = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    return w["interactPoints"][0]; // coop, added first in placeCoop()
  });
  await page.evaluate(
    ([x, y]) => (window as any).__game.scene.getScene("oasis").player.body.reset(x, y),
    [coopPoint.x, coopPoint.y]
  );
  await page.waitForTimeout(250);
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const coopTapResult = await snapshot(page);
  expect(
    coopTapResult.dialogueOpen === true && coopTapResult.state.items.bucket === "none",
    "tapping the right side at the coop (no bucket) opens the hint via touch"
  ).toBeTruthy();
  // Close the hint the same way a touch player would: tap again (plain line, any tap advances).
  await tapRightSide(page);
  await page.waitForTimeout(300);

  // ---------- Dialogue choice list: on-screen ▲ / ✓ / ▼ buttons ----------
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("oasis");
    const n = w["npcs"][0]; // John — johnAct1Script opens with a choice hub
    w.player.body.reset(n.sprite.x, n.sprite.y + 14);
  });
  await page.waitForTimeout(200);
  await tapRightSide(page); // open dialogue
  await page.waitForTimeout(300);
  // johnAct1Script's choice hub ("scarabs / Thomas / goodbye") is several
  // plain lines in (greet + the radio hand-off) — tap through them (any tap
  // advances a plain line).
  let dlgState = await snapshot(page);
  for (let i = 0; i < 16; i++) {
    if (!dlgState.dialogueOpen || dlgState.choices) break;
    await tapRightSide(page);
    await page.waitForTimeout(220);
    dlgState = await snapshot(page);
  }
  expect(
    dlgState.dialogueOpen === true && Array.isArray(dlgState.choices),
    "talking to John opens a choice list"
  ).toBeTruthy();

  if (dlgState.choices) {
    const johnBtns = await dialogueButtonColumn(page, "oasis");
    const selected = () => page.evaluate(() => (window as any).__game.scene.getScene("oasis").dialogue["selected"]);

    await page.touchscreen.tap(johnBtns.down.x, johnBtns.down.y);
    await page.waitForTimeout(200);
    const johnSelDown = await selected();
    expect(johnSelDown, "tapping ▼ moves the choice selection down").toBe(1);

    await page.touchscreen.tap(johnBtns.up.x, johnBtns.up.y);
    await page.waitForTimeout(200);
    const johnSelUp = await selected();
    expect(johnSelUp, "tapping ▲ moves the choice selection back up").toBe(0);

    await page.touchscreen.tap(johnBtns.confirm.x, johnBtns.confirm.y);
    await page.waitForTimeout(300);
    const afterConfirm = await page.evaluate(() => {
      const w = (window as any).__game.scene.getScene("oasis");
      return { open: w.dialogue.isOpen, node: w.dialogue["runner"]?.currentNodeId ?? null };
    });
    expect(
      afterConfirm.open === true && afterConfirm.node !== null && afterConfirm.node !== "hub",
      "tapping ✓ confirms the highlighted choice and advances the conversation"
    ).toBeTruthy();

    // Walk the rest of this conversation out via touch alone, ending on
    // "Say goodbye" (▼▼✓), which triggers the tutorial battle on close. The
    // first confirm above picked "scarabs" (a long ~9-line branch), so allow
    // enough steps to traverse it, loop back to the hub, then take goodbye.
    for (let i = 0; i < 30; i++) {
      const s = await snapshot(page);
      if (!s.dialogueOpen) break;
      if (s.choices) {
        const btns = await dialogueDownConfirmButtons(page, "oasis");
        const lastIndex = s.choices.length - 1;
        for (let k = 0; k < lastIndex; k++) {
          await page.touchscreen.tap(btns.down.x, btns.down.y);
          await page.waitForTimeout(150);
        }
        await page.touchscreen.tap(btns.confirm.x, btns.confirm.y);
      } else {
        await tapRightSide(page);
      }
      await page.waitForTimeout(220);
    }
    const closed = await page.evaluate(() => (window as any).__game.scene.getScene("oasis").dialogue.isOpen);
    expect(closed, "touch-only navigation reaches 'Say goodbye' and closes the conversation").toBe(false);
  }

  // ---------- Battle menu: on-screen ▲ / ✓ / ▼ buttons ----------
  const battleUp = await page.evaluate(async () => {
    const start = Date.now();
    while (Date.now() - start < 6000) {
      const scenes = (window as any).__game.scene.getScenes(true).map((s: any) => s.scene.key);
      if (scenes.includes("battle")) return true;
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  });
  expect(battleUp, "closing the parent conversation starts the tutorial battle").toBeTruthy();

  if (battleUp) {
    // The hero's ATB gauge takes a few seconds to fill before the menu opens.
    const menuState = await page.evaluate(async () => {
      const b = (window as any).__game.scene.getScene("battle");
      const start = Date.now();
      while (Date.now() - start < 8000) {
        if (b["menuMode"] !== "hidden") break;
        await new Promise((r) => setTimeout(r, 150));
      }
      return { mode: b["menuMode"], items: b["menuItems"]?.map((i: any) => i.label) ?? null, sel: b["menuSel"] };
    });
    expect(
      menuState.mode === "actions" && Array.isArray(menuState.items) && menuState.items.length > 0,
      "battle opens the actions menu for the hero"
    ).toBeTruthy();

    let battleBtns: { up: Pt; confirm: Pt; down: Pt; present: boolean } = {
      up: { x: 0, y: 0 },
      confirm: { x: 0, y: 0 },
      down: { x: 0, y: 0 },
      present: false,
    };
    if (menuState.mode === "actions") {
      battleBtns = await page.evaluate(() => {
        const b = (window as any).__game.scene.getScene("battle");
        const btns = b["menuTouchButtons"];
        const rect = (window as any).__game.canvas.getBoundingClientRect();
        const scaleX = rect.width / (window as any).__game.scale.width;
        const scaleY = rect.height / (window as any).__game.scale.height;
        const px = b["menuPanel"].x;
        const py = b["menuPanel"].y;
        const mid = (localY: number) => ({
          x: rect.x + (px + btns.x + btns.size / 2) * scaleX,
          y: rect.y + (py + localY + btns.size / 2) * scaleY,
        });
        return { up: mid(btns.top), confirm: mid(btns.top + btns.gap), down: mid(btns.top + btns.gap * 2), present: !!btns };
      });
    }
    expect(battleBtns.present, "battle menu has a touch button column").toBe(true);

    if (battleBtns.present) {
      await page.touchscreen.tap(battleBtns.down.x, battleBtns.down.y);
      await page.waitForTimeout(200);
      const battleSelDown = await page.evaluate(() => (window as any).__game.scene.getScene("battle")["menuSel"]);
      expect(battleSelDown, "tapping ▼ moves the battle menu selection down").toBe(1);

      await page.touchscreen.tap(battleBtns.up.x, battleBtns.up.y);
      await page.waitForTimeout(200);
      const battleSelUp = await page.evaluate(() => (window as any).__game.scene.getScene("battle")["menuSel"]);
      expect(battleSelUp, "tapping ▲ moves the battle menu selection back up").toBe(0);

      // Confirm "Attack" (row 0) -> opens the target submenu with its own buttons.
      await page.touchscreen.tap(battleBtns.confirm.x, battleBtns.confirm.y);
      await page.waitForTimeout(250);
      const targetState = await page.evaluate(() => {
        const b = (window as any).__game.scene.getScene("battle");
        return { mode: b["menuMode"], present: !!b["menuTouchButtons"] };
      });
      expect(
        targetState.mode === "targets" && targetState.present === true,
        "tapping ✓ confirms Attack and opens the target menu, also with touch buttons"
      ).toBeTruthy();

      if (targetState.mode === "targets") {
        const targetBtn = await page.evaluate(() => {
          const b = (window as any).__game.scene.getScene("battle");
          const btns = b["menuTouchButtons"];
          const rect = (window as any).__game.canvas.getBoundingClientRect();
          const scaleX = rect.width / (window as any).__game.scale.width;
          const scaleY = rect.height / (window as any).__game.scale.height;
          const px = b["menuPanel"].x;
          const py = b["menuPanel"].y;
          return {
            x: rect.x + (px + btns.x + btns.size / 2) * scaleX,
            y: rect.y + (py + btns.top + btns.gap + btns.size / 2) * scaleY,
          };
        });
        await page.touchscreen.tap(targetBtn.x, targetBtn.y);
        await page.waitForTimeout(300);
        const afterTarget = await page.evaluate(() => (window as any).__game.scene.getScene("battle")["menuMode"]);
        expect(afterTarget, "tapping ✓ on the target menu commits the attack (menu closes)").toBe("hidden");
      }
    }
  }

  // ---------- Act 3: the fishing minigame via touch ----------
  // Jump straight to the deep kelp bed (the climax zone) with the Lurker already
  // beaten off, so the next interaction with the fishing spot opens the cast
  // choice and the timing minigame.
  await jumpTo(page, {
    zone: "deepBed",
    hp: 999,
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, sawChase: true, sawKelpForest: true,
      sawTempleEntry: true, sawTemple: true, sawFluffbed: true, metFluffball: true,
      sawDeepBed: true, lurkerDefeated: true,
    },
  });
  await page.evaluate(() => (window as any).__game.scene.getScene("deepBed").player.body.reset(15 * 16 + 8, 9 * 16 + 8));
  await page.waitForTimeout(300);

  // Tap the right side to use the fishing InteractPoint → the cast choice.
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const castChoice = await snapshot(page);
  expect(
    castChoice.dialogueOpen === true && Array.isArray(castChoice.choices),
    "tapping the fishing spot opens the cast choice via touch"
  ).toBeTruthy();

  if (castChoice.choices) {
    // Confirm "Cast the line" (row 0, already selected) with the ✓ column.
    const confirmBtn = await dialogueConfirmButton(page, "deepBed");
    await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
    await page.waitForTimeout(300);
    // Advance the cast-end line (a plain line — any tap advances it).
    await tapRightSide(page);
    await page.waitForTimeout(400);
  }

  const menuOpen = await page.evaluate(() => !!(window as any).__game.scene.getScene("deepBed").fishingMenu);
  expect(menuOpen, "casting opens the fishing minigame via touch").toBe(true);

  if (menuOpen) {
    const rect = await canvasRect(page);
    const deadline = Date.now() + 40_000;
    let caught = false;
    while (Date.now() < deadline) {
      const fs = await page.evaluate(() => {
        const w = (window as any).__game.scene.getScene("deepBed");
        const m = w.fishingMenu;
        if (!m) return { open: false, caught: (window as any).__game.registry.get("act1").items.silverfin === true };
        return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
      });
      if (!fs.open) {
        caught = (fs as any).caught;
        break;
      }
      // Tap (anywhere / the HOOK button) only when the marker is in the glow.
      if (Math.abs(fs.p! - fs.t!) < fs.w! * 0.5) {
        await page.touchscreen.tap(rect.x + rect.width * 0.5, rect.y + rect.height * 0.45);
      }
      await page.waitForTimeout(30);
    }
    expect(caught, "tapping HOOK inside the glow lands the silverfin (touch)").toBe(true);
  }

  // ---------- Act 4: the midden-mite nest InteractPoint via touch ----------
  // Jump to the laundry nook (mites still nesting) and confirm that tapping the
  // right side at the nest — a brand-new InteractPoint with no NPC nearby —
  // opens its intro dialogue on a touch device.
  await jumpTo(page, {
    zone: "laundryNook",
    hp: 999,
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
      act4Started: true, sawOutskirts: true, sawCamp: true, sawCrateChase: true,
      sawNook: true, fluffballLedge: true,
    },
  });
  await page.evaluate(() => (window as any).__game.scene.getScene("laundryNook").player.body.reset(4 * 16 + 8, 7 * 16 + 8));
  await page.waitForTimeout(300);
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const nestTap = await snapshot(page);
  expect(
    nestTap.dialogueOpen === true && nestTap.state.flags.middenCleared !== true,
    "tapping the nest InteractPoint opens the mite-nest intro via touch"
  ).toBeTruthy();

  // ---------- Rest point: a repeatable full heal via touch (Acts 3–7) ----------
  await jumpTo(page, {
    zone: "campProper",
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
      act4Started: true, sawOutskirts: true, sawCamp: true, sawCrateChase: true,
    },
  });
  await tapCampRest(page, "campProper", 16, 11);
  const restFull = await page.evaluate(() => (window as any).__game.registry.get("act1").hp);
  await page.evaluate(() => {
    const g = (window as any).__game;
    g.registry.set("act1", { ...g.registry.get("act1"), hp: 1 });
  });
  await page.waitForTimeout(100);
  await tapCampRest(page, "campProper", 16, 11);
  const restAfter = await page.evaluate(() => (window as any).__game.registry.get("act1").hp);
  expect(
    restFull > 1 && restAfter === restFull,
    "tapping the camp rest point full-heals the party via touch (repeatable)"
  ).toBeTruthy();

  // ---------- Act 5: Sahra's reactive trade via touch ----------
  await jumpTo(page, {
    zone: "sahraGrove",
    hp: 999,
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
      act4Started: true, act4Complete: true, gotSocks: true,
      act5Started: true, sawGroveDescent: true, sawGroveApproach: true, sawGroveChase: true,
      sawGroveGrotto: true, sawGroveChamber: true, fluffballJoined: true, sawSahraGrove: true,
      rabbitTradedColdPack: true, parleyed: true,
    },
  });

  // Reactive spot-check: read Sahra's live script under the mercy+parley flags.
  const sahraReactive = await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("sahraGrove");
    return w.sahraScript().nodes.flatMap((n: any) => n.lines.map((l: any) => l.text)).join(" ");
  });
  expect(
    /mercy/i.test(sahraReactive) && /(talked|words)/i.test(sahraReactive),
    "Sahra's dialogue reacts to Act 1 choices (mercy + parley branch)"
  ).toBeTruthy();

  // Stand next to Sahra and tap the right side to talk to her via touch.
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("sahraGrove");
    const n = w["npcs"][0]; // Sahra, keeper of the grove
    w.player.body.reset(n.sprite.x, n.sprite.y + 14);
  });
  await page.waitForTimeout(250);
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const sahraTap = await snapshot(page);
  expect(sahraTap.dialogueOpen, "tapping to talk opens Sahra's reactive trade via touch").toBe(true);

  // ---------- Act 6: the reef trade-not-fight diplomacy via touch ----------
  await jumpTo(page, {
    zone: "reefCourt",
    hp: 999,
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
      act4Started: true, act4Complete: true, gotSocks: true,
      act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
      act6Started: true, sawReefDescent: true, sawReefGarden: true, sawReefWarren: true,
      sawReefChase: true, sawReefHollow: true, sawReefCourt: true,
    },
  });

  // Stand next to the crawler warden and tap the right side to talk via touch.
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("reefCourt");
    const n = w["npcs"][0]; // the crawler warden, keeper of the oldest mint row
    w.player.body.reset(n.sprite.x, n.sprite.y + 14);
  });
  await page.waitForTimeout(250);
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const reefTap = await snapshot(page);
  expect(reefTap.dialogueOpen, "tapping to talk opens the crawler parley via touch").toBe(true);

  // Advance the opening lines to the parley's first choice node.
  let reefDlg = await snapshot(page);
  for (let i = 0; i < 10; i++) {
    if (!reefDlg.dialogueOpen || reefDlg.choices) break;
    await tapRightSide(page);
    await page.waitForTimeout(220);
    reefDlg = await snapshot(page);
  }
  expect(
    reefDlg.dialogueOpen === true && Array.isArray(reefDlg.choices) && reefDlg.choices.length === 2,
    "the crawler parley reaches its trade-vs-fight choice list via touch"
  ).toBeTruthy();

  if (reefDlg.choices) {
    // Confirm the courteous first choice (row 0) with the ✓ column.
    const confirmBtn = await dialogueConfirmButton(page, "reefCourt");
    await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
    await page.waitForTimeout(300);
    const afterReefChoice = await page.evaluate(() => {
      const w = (window as any).__game.scene.getScene("reefCourt");
      return { open: w.dialogue.isOpen, node: w.dialogue["runner"]?.currentNodeId ?? null };
    });
    expect(
      afterReefChoice.node !== "affront" && afterReefChoice.node !== null,
      "tapping ✓ confirms the courteous choice and advances the parley (not to the fight)"
    ).toBeTruthy();
  }

  // ---------- Act 7: the cooking minigame (the bake) via touch ----------
  await jumpTo(page, {
    zone: "pizzeria",
    hp: 999,
    items: { silverfin: true, stinkySocks: true, oranges: true, seaweed: true },
    flags: {
      actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
      slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
      act4Started: true, act4Complete: true, gotSocks: true,
      act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
      act6Started: true, act6Complete: true, gotSeaweed: true,
      act7Started: true, sawPizzaDescent: true, sawPizzaVent: true, sawPizzaApproach: true,
      metTestudo: true,
    },
  });

  // Stand next to Chef Testudo and tap the right side to talk via touch.
  await page.evaluate(() => {
    const w = (window as any).__game.scene.getScene("pizzeria");
    const n = w["npcs"][0]; // Chef Testudo, at his oven
    w.player.body.reset(n.sprite.x, n.sprite.y + 14);
  });
  await page.waitForTimeout(250);
  await tapRightSide(page);
  await page.waitForTimeout(400);
  const bakeTap = await snapshot(page);
  expect(bakeTap.dialogueOpen, "tapping to talk opens Testudo's bake dialogue via touch").toBe(true);

  // Advance to the bake choice list, then confirm "Bake the pizza." (row 0) via ✓.
  let bakeDlg = await snapshot(page);
  for (let i = 0; i < 10; i++) {
    if (!bakeDlg.dialogueOpen || bakeDlg.choices) break;
    await tapRightSide(page);
    await page.waitForTimeout(220);
    bakeDlg = await snapshot(page);
  }
  expect(
    bakeDlg.dialogueOpen === true && Array.isArray(bakeDlg.choices) && bakeDlg.choices.length === 2,
    "Testudo's bake dialogue reaches its bake/wait choice list via touch"
  ).toBeTruthy();

  if (bakeDlg.choices) {
    const confirmBtn = await dialogueConfirmButton(page, "pizzeria");
    await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
    await page.waitForTimeout(300);
    // Confirming picks "Bake the pizza." → the terminal `bake-end` line; advance
    // past it to close the dialogue, whose onClose opens the cooking minigame.
    for (let i = 0; i < 6; i++) {
      const open = await page.evaluate(() => (window as any).__game.scene.getScene("pizzeria").dialogue.isOpen);
      if (!open) break;
      await tapRightSide(page);
      await page.waitForTimeout(220);
    }
    await page.waitForTimeout(400);
  }
  const cookOpen = await page.evaluate(() => !!(window as any).__game.scene.getScene("pizzeria").cookingMenu);
  expect(cookOpen, "confirming the bake opens the cooking minigame via touch").toBe(true);

  // Drive the bake with screen taps: PLACE only when the heat marker is inside
  // the glow (a tap anywhere on the play area counts as a PLACE).
  const cookRect = await page.evaluate(() => {
    const r = (window as any).__game.canvas.getBoundingClientRect();
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  });
  const cookDeadline = Date.now() + 45_000;
  let baked = false;
  while (Date.now() < cookDeadline) {
    const cs = await page.evaluate(() => {
      const w = (window as any).__game.scene.getScene("pizzeria");
      const m = w.cookingMenu;
      if (!m) return { open: false, baked: (window as any).__game.registry.get("act1").flags.pizzaBaked === true };
      return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
    });
    if (!cs.open) {
      baked = (cs as any).baked;
      break;
    }
    if (Math.abs(cs.p! - cs.t!) < cs.w! * 0.45) {
      await page.touchscreen.tap(cookRect.x + cookRect.w * 0.5, cookRect.y + cookRect.h * 0.45);
    }
    await page.waitForTimeout(30);
  }
  expect(baked, "the cooking minigame bakes the perfect pizza via touch taps").toBe(true);
  const pizzaBaked = await page.evaluate(() => (window as any).__game.registry.get("act1").flags.pizzaBaked === true);
  expect(pizzaBaked, "the pizza is baked (touch)").toBe(true);

  // ---------- Title menu: no tap-anywhere-confirms (regression) ----------
  // A save now exists from the whole playthrough above. Reload to hit the
  // title menu with CONTINUE present, and prove touch input there is
  // restricted to the same ▲/✓/▼ column as everywhere else — a stray tap
  // used to confirm whatever was selected from anywhere on the screen,
  // which could wipe the save by launching NEW GAME instead of CONTINUE.
  await page.reload();
  await page.waitForTimeout(2600);

  const savedZoneBefore = await page.evaluate(() => {
    const raw = localStorage.getItem("desert-secrets-save-v1");
    return raw ? JSON.parse(raw).state.zone : null;
  });

  const titleBtnScreen = await page.evaluate(() => {
    const boot = (window as any).__game.scene.getScene("boot");
    const btns = boot["touchButtons"];
    const rect = (window as any).__game.canvas.getBoundingClientRect();
    const scaleX = rect.width / (window as any).__game.scale.width;
    const scaleY = rect.height / (window as any).__game.scale.height;
    const mid = (localY: number) => ({
      x: rect.x + (btns.x + btns.size / 2) * scaleX,
      y: rect.y + (localY + btns.size / 2) * scaleY,
    });
    return { up: mid(btns.top), confirm: mid(btns.top + btns.gap), down: mid(btns.top + btns.gap * 2) };
  });

  // A tap on the menu text itself (not the button column) must do nothing.
  const titleRect = await canvasRect(page);
  await page.touchscreen.tap(titleRect.x + titleRect.width * 0.5, titleRect.y + titleRect.height * 0.5);
  await page.waitForTimeout(250);
  let titleStillUp = await page.evaluate(() => (window as any).__game.scene.getScene("boot").scene.isActive());
  expect(titleStillUp, "tapping the title menu's text (not the button column) does nothing").toBe(true);

  // Navigate down to NEW GAME and back up to CONTINUE via the button column,
  // then confirm — this must land back on the saved zone, not a fresh game.
  await page.touchscreen.tap(titleBtnScreen.down.x, titleBtnScreen.down.y);
  await page.waitForTimeout(200);
  await page.touchscreen.tap(titleBtnScreen.up.x, titleBtnScreen.up.y);
  await page.waitForTimeout(200);
  titleStillUp = await page.evaluate(() => (window as any).__game.scene.getScene("boot").scene.isActive());
  expect(titleStillUp, "▲/▼ navigation on the title menu doesn't confirm by itself").toBe(true);

  await page.touchscreen.tap(titleBtnScreen.confirm.x, titleBtnScreen.confirm.y);
  await page.waitForTimeout(1200);
  const zoneAfterContinue = await page.evaluate(() => (window as any).__game.registry.get("act1")?.zone ?? null);
  expect(
    zoneAfterContinue !== null && zoneAfterContinue === savedZoneBefore && zoneAfterContinue !== "crash",
    "tapping ✓ confirms CONTINUE via the button column, not an accidental NEW GAME"
  ).toBeTruthy();

  // ---------- no uncaught page errors across the whole run ----------
  expect(getPageErrors(page), "no page errors").toEqual([]);
});
