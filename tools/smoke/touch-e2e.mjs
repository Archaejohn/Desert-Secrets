/**
 * Touch-specific regression coverage against the built bundle
 * (dist/index.html). Runs in a real touch-emulated Chromium context
 * (hasTouch + isMobile), separate from the keyboard-driven tools/smoke/e2e.mjs
 * playthrough, because these bugs only reproduce with `isTouchDevice()`
 * true: (1) tapping to use an InteractPoint (bucket/spigot/coop) — the
 * tap-to-interact path only ever checked NPCs, so touch players got no
 * response at all; (2) the dialogue choice list's on-screen ▲/✓/▼ buttons,
 * added because precisely tapping a tiny choice row was unreliable; (3)
 * the same ▲/✓/▼ column in the battle command/target menu.
 *
 * Usage:  npm run build && npm run smoke:touch
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? "/opt/pw-browsers/chromium";

let failures = 0;
function check(name, ok, extra = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  " + extra}`);
  if (!ok) failures++;
}

async function tap(page, code, ms = 70) {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
}

const browser = await chromium.launch({
  executablePath,
  args: ["--no-sandbox", "--use-gl=swiftshader"]
});
const page = await browser.newPage({ viewport: { width: 960, height: 540 }, hasTouch: true, isMobile: true });
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(e.message));

await page.goto("file://" + path.join(root, "dist/index.html"));
await page.waitForTimeout(2600);
await page.evaluate(() => localStorage.clear());

const isTouch = await page.evaluate(() => window.__game.device.input.touch);
check("game detects a touch device in this context", isTouch === true);

await tap(page, "Space"); // NEW GAME
await page.waitForTimeout(1500);

const canvasRect = async () => {
  const r = await page.evaluate(() => window.__game.canvas.getBoundingClientRect());
  return r;
};

// ---------- Tap-to-interact reaches an InteractPoint, not just NPCs ----------
await page.evaluate(() => {
  window.__game.scene.start("oasis", {});
});
await page.waitForTimeout(1200);
const coopPoint = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return w["interactPoints"][0]; // coop, added first in placeCoop()
});
await page.evaluate(
  ([x, y]) => window.__game.scene.getScene("oasis").player.body.reset(x, y),
  [coopPoint.x, coopPoint.y]
);
await page.waitForTimeout(250);
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(400);
const coopTapResult = await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  return { dialogueOpen: w.dialogue.isOpen, bucket: window.__game.registry.get("act1").items.bucket };
});
check(
  "tapping the right side at the coop (no bucket) opens the hint via touch",
  coopTapResult.dialogueOpen === true && coopTapResult.bucket === "none",
  JSON.stringify(coopTapResult)
);
// Close the hint the same way a touch player would: tap again (plain line, any tap advances).
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(300);

// ---------- Dialogue choice list: on-screen ▲ / A / ▼ buttons ----------
await page.evaluate(() => {
  const w = window.__game.scene.getScene("oasis");
  const n = w["npcs"][0]; // John — homeAct1Script opens with a choice hub
  w.player.body.reset(n.sprite.x, n.sprite.y + 14);
});
await page.waitForTimeout(200);
const tapRightSide = async () => {
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
};
await tapRightSide(); // open dialogue
await page.waitForTimeout(300);
// homeAct1Script's choice hub ("Ask about Thomas / chickens / goodbye") is
// a few plain lines in — tap through them (any tap advances a plain line).
let dlgState = null;
for (let i = 0; i < 10; i++) {
  dlgState = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
  });
  if (!dlgState.open || dlgState.choices) break;
  await tapRightSide();
  await page.waitForTimeout(220);
}
check("talking to John opens a choice list", dlgState.open === true && Array.isArray(dlgState.choices), JSON.stringify(dlgState));

if (dlgState.choices) {
  const btnScreen = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    const dlg = w.dialogue;
    const btns = dlg["touchButtons"];
    const rect = window.__game.canvas.getBoundingClientRect();
    const scaleX = rect.width / window.__game.scale.width;
    const scaleY = rect.height / window.__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    const mid = (localY) => ({
      x: rect.x + (cx + btns.x + btns.size / 2) * scaleX,
      y: rect.y + (cy + localY + btns.size / 2) * scaleY
    });
    return { up: mid(btns.top), confirm: mid(btns.top + btns.gap), down: mid(btns.top + btns.gap * 2) };
  });

  const selAfter = async () =>
    page.evaluate(() => window.__game.scene.getScene("oasis").dialogue["selected"]);

  await page.touchscreen.tap(btnScreen.down.x, btnScreen.down.y);
  await page.waitForTimeout(200);
  const selDown = await selAfter();
  check("tapping ▼ moves the choice selection down", selDown === 1, `selected=${selDown}`);

  await page.touchscreen.tap(btnScreen.up.x, btnScreen.up.y);
  await page.waitForTimeout(200);
  const selUp = await selAfter();
  check("tapping ▲ moves the choice selection back up", selUp === 0, `selected=${selUp}`);

  await page.touchscreen.tap(btnScreen.confirm.x, btnScreen.confirm.y);
  await page.waitForTimeout(300);
  const afterConfirm = await page.evaluate(() => {
    const w = window.__game.scene.getScene("oasis");
    return { open: w.dialogue.isOpen, node: w.dialogue["runner"]?.currentNodeId ?? null };
  });
  check(
    "tapping ✓ confirms the highlighted choice and advances the conversation",
    afterConfirm.open === true && afterConfirm.node !== null && afterConfirm.node !== "hub",
    JSON.stringify(afterConfirm)
  );

  // Walk the rest of this conversation out via touch alone, ending on
  // "Say goodbye" (▼▼✓), which triggers the tutorial battle on close.
  for (let i = 0; i < 12; i++) {
    const s = await page.evaluate(() => {
      const w = window.__game.scene.getScene("oasis");
      return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
    });
    if (!s.open) break;
    if (s.choices) {
      const btns = await page.evaluate(() => {
        const w = window.__game.scene.getScene("oasis");
        const dlg = w.dialogue;
        const b = dlg["touchButtons"];
        const rect = window.__game.canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__game.scale.width;
        const scaleY = rect.height / window.__game.scale.height;
        const cx = dlg["container"].x;
        const cy = dlg["container"].y;
        return {
          down: { x: rect.x + (cx + b.x + b.size / 2) * scaleX, y: rect.y + (cy + b.top + b.gap * 2 + b.size / 2) * scaleY },
          confirm: { x: rect.x + (cx + b.x + b.size / 2) * scaleX, y: rect.y + (cy + b.top + b.gap + b.size / 2) * scaleY }
        };
      });
      const lastIndex = s.choices.length - 1;
      for (let k = 0; k < lastIndex; k++) {
        await page.touchscreen.tap(btns.down.x, btns.down.y);
        await page.waitForTimeout(150);
      }
      await page.touchscreen.tap(btns.confirm.x, btns.confirm.y);
    } else {
      await tapRightSide();
    }
    await page.waitForTimeout(220);
  }
  const closed = await page.evaluate(() => window.__game.scene.getScene("oasis").dialogue.isOpen);
  check("touch-only navigation reaches 'Say goodbye' and closes the conversation", closed === false);
}

// ---------- Battle menu: on-screen ▲ / ✓ / ▼ buttons ----------
const battleUp = await page.evaluate(async () => {
  const start = Date.now();
  while (Date.now() - start < 6000) {
    const scenes = window.__game.scene.getScenes(true).map((s) => s.scene.key);
    if (scenes.includes("battle")) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
});
check("closing the parent conversation starts the tutorial battle", battleUp === true);

if (battleUp) {
  // The hero's ATB gauge takes a few seconds to fill before the menu opens.
  const menuState = await page.evaluate(async () => {
    const b = window.__game.scene.getScene("battle");
    const start = Date.now();
    while (Date.now() - start < 8000) {
      if (b["menuMode"] !== "hidden") break;
      await new Promise((r) => setTimeout(r, 150));
    }
    return { mode: b["menuMode"], items: b["menuItems"]?.map((i) => i.label) ?? null, sel: b["menuSel"] };
  });
  check(
    "battle opens the actions menu for the hero",
    menuState.mode === "actions" && Array.isArray(menuState.items) && menuState.items.length > 0,
    JSON.stringify(menuState)
  );

  const btnScreen =
    menuState.mode === "actions"
      ? await page.evaluate(() => {
          const b = window.__game.scene.getScene("battle");
          const btns = b["menuTouchButtons"];
          const rect = window.__game.canvas.getBoundingClientRect();
          const scaleX = rect.width / window.__game.scale.width;
          const scaleY = rect.height / window.__game.scale.height;
          const px = b["menuPanel"].x;
          const py = b["menuPanel"].y;
          const mid = (localY) => ({
            x: rect.x + (px + btns.x + btns.size / 2) * scaleX,
            y: rect.y + (py + localY + btns.size / 2) * scaleY
          });
          return { up: mid(btns.top), confirm: mid(btns.top + btns.gap), down: mid(btns.top + btns.gap * 2), present: !!btns };
        })
      : { present: false };
  check("battle menu has a touch button column", btnScreen.present === true);

  if (btnScreen.present) {
    await page.touchscreen.tap(btnScreen.down.x, btnScreen.down.y);
    await page.waitForTimeout(200);
    const selDown = await page.evaluate(() => window.__game.scene.getScene("battle")["menuSel"]);
    check("tapping ▼ moves the battle menu selection down", selDown === 1, `sel=${selDown}`);

    await page.touchscreen.tap(btnScreen.up.x, btnScreen.up.y);
    await page.waitForTimeout(200);
    const selUp = await page.evaluate(() => window.__game.scene.getScene("battle")["menuSel"]);
    check("tapping ▲ moves the battle menu selection back up", selUp === 0, `sel=${selUp}`);

    // Confirm "Attack" (row 0) -> opens the target submenu with its own buttons.
    await page.touchscreen.tap(btnScreen.confirm.x, btnScreen.confirm.y);
    await page.waitForTimeout(250);
    const targetState = await page.evaluate(() => {
      const b = window.__game.scene.getScene("battle");
      return { mode: b["menuMode"], present: !!b["menuTouchButtons"] };
    });
    check(
      "tapping ✓ confirms Attack and opens the target menu, also with touch buttons",
      targetState.mode === "targets" && targetState.present === true,
      JSON.stringify(targetState)
    );

    if (targetState.mode === "targets") {
      const targetBtn = await page.evaluate(() => {
        const b = window.__game.scene.getScene("battle");
        const btns = b["menuTouchButtons"];
        const rect = window.__game.canvas.getBoundingClientRect();
        const scaleX = rect.width / window.__game.scale.width;
        const scaleY = rect.height / window.__game.scale.height;
        const px = b["menuPanel"].x;
        const py = b["menuPanel"].y;
        return {
          x: rect.x + (px + btns.x + btns.size / 2) * scaleX,
          y: rect.y + (py + btns.top + btns.gap + btns.size / 2) * scaleY
        };
      });
      await page.touchscreen.tap(targetBtn.x, targetBtn.y);
      await page.waitForTimeout(300);
      const afterTarget = await page.evaluate(() => window.__game.scene.getScene("battle")["menuMode"]);
      check("tapping ✓ on the target menu commits the attack (menu closes)", afterTarget === "hidden", `mode=${afterTarget}`);
    }
  }
}

// ---------- Act 3: the fishing minigame via touch ----------
// Jump straight to the deep kelp bed (the climax zone) with the Lurker already
// beaten off, so the next interaction with the fishing spot opens the cast
// choice and the timing minigame — exercising: tapping an InteractPoint,
// confirming a dialogue choice with the ✓ column, and tapping HOOK to land it.
await page.evaluate(() => {
  const g = window.__game;
  const st = g.registry.get("act1");
  const flags = {
    ...st.flags,
    actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
    slitherJoined: true, act3Started: true, sawChase: true, sawKelpForest: true,
    sawTempleEntry: true, sawTemple: true, sawFluffbed: true, metFluffball: true,
    sawDeepBed: true, lurkerDefeated: true
  };
  g.registry.set("act1", { ...st, zone: "deepBed", hp: 999, flags });
  for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
  g.scene.start("deepBed", {});
});
await page.waitForTimeout(1300);
await page.evaluate(() => window.__game.scene.getScene("deepBed").player.body.reset(15 * 16 + 8, 9 * 16 + 8));
await page.waitForTimeout(300);

// Tap the right side to use the fishing InteractPoint → the cast choice.
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(400);
const castChoice = await page.evaluate(() => {
  const w = window.__game.scene.getScene("deepBed");
  return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
});
check(
  "tapping the fishing spot opens the cast choice via touch",
  castChoice.open === true && Array.isArray(castChoice.choices),
  JSON.stringify(castChoice)
);

if (castChoice.choices) {
  // Confirm "Cast the line" (row 0, already selected) with the ✓ column.
  const confirmBtn = await page.evaluate(() => {
    const w = window.__game.scene.getScene("deepBed");
    const dlg = w.dialogue;
    const b = dlg["touchButtons"];
    const rect = window.__game.canvas.getBoundingClientRect();
    const sx = rect.width / window.__game.scale.width;
    const sy = rect.height / window.__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    return {
      x: rect.x + (cx + b.x + b.size / 2) * sx,
      y: rect.y + (cy + b.top + b.gap + b.size / 2) * sy
    };
  });
  await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
  await page.waitForTimeout(300);
  // Advance the cast-end line (a plain line — any tap advances it).
  {
    const rect = await canvasRect();
    await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
  }
  await page.waitForTimeout(400);
}

const menuOpen = await page.evaluate(() => !!window.__game.scene.getScene("deepBed").fishingMenu);
check("casting opens the fishing minigame via touch", menuOpen === true);

if (menuOpen) {
  const rect = await canvasRect();
  const deadline = Date.now() + 40_000;
  let caught = false;
  while (Date.now() < deadline) {
    const fs = await page.evaluate(() => {
      const w = window.__game.scene.getScene("deepBed");
      const m = w.fishingMenu;
      if (!m) return { open: false, caught: window.__game.registry.get("act1").items.silverfin === true };
      return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
    });
    if (!fs.open) {
      caught = fs.caught;
      break;
    }
    // Tap (anywhere / the HOOK button) only when the marker is in the glow.
    if (Math.abs(fs.p - fs.t) < fs.w * 0.5) {
      await page.touchscreen.tap(rect.x + rect.width * 0.5, rect.y + rect.height * 0.45);
    }
    await page.waitForTimeout(30);
  }
  check("tapping HOOK inside the glow lands the silverfin (touch)", caught === true);
}

// ---------- Act 4: the midden-mite nest InteractPoint via touch ----------
// Jump to the laundry nook (mites still nesting) and confirm that tapping the
// right side at the nest — a brand-new InteractPoint with no NPC nearby —
// opens its intro dialogue on a touch device (the same tap-to-interact path
// that only ever checked NPCs before v7).
await page.evaluate(() => {
  const g = window.__game;
  const st = g.registry.get("act1");
  const flags = {
    ...st.flags,
    actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
    slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
    act4Started: true, sawOutskirts: true, sawCamp: true, sawCrateChase: true,
    sawNook: true, fluffballLedge: true
  };
  g.registry.set("act1", { ...st, zone: "laundryNook", hp: 999, flags });
  for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
  g.scene.start("laundryNook", {});
});
await page.waitForTimeout(1300);
await page.evaluate(() => window.__game.scene.getScene("laundryNook").player.body.reset(4 * 16 + 8, 7 * 16 + 8));
await page.waitForTimeout(300);
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(400);
const nestTap = await page.evaluate(() => {
  const w = window.__game.scene.getScene("laundryNook");
  return { open: w.dialogue.isOpen, cleared: window.__game.registry.get("act1").flags.middenCleared };
});
check(
  "tapping the nest InteractPoint opens the mite-nest intro via touch",
  nestTap.open === true && nestTap.cleared !== true,
  JSON.stringify(nestTap)
);

// ---------- Act 5: Sahra's reactive trade via touch ----------
// Jump to Sahra's grove (Fluffball already joined) and confirm that tapping to
// talk opens Sahra's dialogue on a touch device — and that her lines react to
// the Act 1 choices (mercy + parley here), the game's first callback payoff.
await page.evaluate(() => {
  const g = window.__game;
  const st = g.registry.get("act1");
  const flags = {
    ...st.flags,
    actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
    slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
    act4Started: true, act4Complete: true, gotSocks: true,
    act5Started: true, sawGroveDescent: true, sawGroveApproach: true, sawGroveChase: true,
    sawGroveGrotto: true, sawGroveChamber: true, fluffballJoined: true, sawSahraGrove: true,
    rabbitTradedColdPack: true, parleyed: true
  };
  g.registry.set("act1", { ...st, zone: "sahraGrove", hp: 999, flags });
  for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
  g.scene.start("sahraGrove", {});
});
await page.waitForTimeout(1300);

// Reactive spot-check: read Sahra's live script under the mercy+parley flags.
const sahraReactive = await page.evaluate(() => {
  const w = window.__game.scene.getScene("sahraGrove");
  return w.sahraScript().nodes.flatMap((n) => n.lines.map((l) => l.text)).join(" ");
});
check(
  "Sahra's dialogue reacts to Act 1 choices (mercy + parley branch)",
  /mercy/i.test(sahraReactive) && /(talked|words)/i.test(sahraReactive),
  sahraReactive
);

// Stand next to Sahra and tap the right side to talk to her via touch.
await page.evaluate(() => {
  const w = window.__game.scene.getScene("sahraGrove");
  const n = w["npcs"][0]; // Sahra, keeper of the grove
  w.player.body.reset(n.sprite.x, n.sprite.y + 14);
});
await page.waitForTimeout(250);
{
  const rect = await canvasRect();
  await page.touchscreen.tap(rect.x + rect.width * 0.75, rect.y + rect.height * 0.5);
}
await page.waitForTimeout(400);
const sahraTap = await page.evaluate(() => {
  const w = window.__game.scene.getScene("sahraGrove");
  return { open: w.dialogue.isOpen };
});
check("tapping to talk opens Sahra's reactive trade via touch", sahraTap.open === true, JSON.stringify(sahraTap));

// ---------- Act 6: the reef trade-not-fight diplomacy via touch ----------
// Jump to the crawler court (Fluffball joined, no trade/fight yet) and confirm
// that tapping to talk opens the warden's parley AND that its choice list — the
// branch point that gates the trade vs. the avoidable fight — is reachable and
// renders its ▲/✓/▼ column on a touch device.
await page.evaluate(() => {
  const g = window.__game;
  const st = g.registry.get("act1");
  const flags = {
    ...st.flags,
    actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
    slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
    act4Started: true, act4Complete: true, gotSocks: true,
    act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
    act6Started: true, sawReefDescent: true, sawReefGarden: true, sawReefWarren: true,
    sawReefChase: true, sawReefHollow: true, sawReefCourt: true
  };
  g.registry.set("act1", { ...st, zone: "reefCourt", hp: 999, flags });
  for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
  g.scene.start("reefCourt", {});
});
await page.waitForTimeout(1300);

// Stand next to the crawler warden and tap the right side to talk via touch.
await page.evaluate(() => {
  const w = window.__game.scene.getScene("reefCourt");
  const n = w["npcs"][0]; // the crawler warden, keeper of the oldest mint row
  w.player.body.reset(n.sprite.x, n.sprite.y + 14);
});
await page.waitForTimeout(250);
await tapRightSide();
await page.waitForTimeout(400);
const reefTap = await page.evaluate(() => ({ open: window.__game.scene.getScene("reefCourt").dialogue.isOpen }));
check("tapping to talk opens the crawler parley via touch", reefTap.open === true, JSON.stringify(reefTap));

// Advance the opening lines to the parley's first choice node (any tap advances
// a plain line); confirm the trade-vs-fight choice list is reached via touch.
let reefDlg = null;
for (let i = 0; i < 10; i++) {
  reefDlg = await page.evaluate(() => {
    const w = window.__game.scene.getScene("reefCourt");
    return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
  });
  if (!reefDlg.open || reefDlg.choices) break;
  await tapRightSide();
  await page.waitForTimeout(220);
}
check(
  "the crawler parley reaches its trade-vs-fight choice list via touch",
  reefDlg.open === true && Array.isArray(reefDlg.choices) && reefDlg.choices.length === 2,
  JSON.stringify(reefDlg)
);

if (reefDlg.choices) {
  // Confirm the courteous first choice (row 0) with the ✓ column — the good
  // approach that leads on toward the peaceful trade.
  const confirmBtn = await page.evaluate(() => {
    const w = window.__game.scene.getScene("reefCourt");
    const dlg = w.dialogue;
    const b = dlg["touchButtons"];
    const rect = window.__game.canvas.getBoundingClientRect();
    const sx = rect.width / window.__game.scale.width;
    const sy = rect.height / window.__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    return {
      x: rect.x + (cx + b.x + b.size / 2) * sx,
      y: rect.y + (cy + b.top + b.gap + b.size / 2) * sy
    };
  });
  await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
  await page.waitForTimeout(300);
  const afterReefChoice = await page.evaluate(() => {
    const w = window.__game.scene.getScene("reefCourt");
    return { open: w.dialogue.isOpen, node: w.dialogue["runner"]?.currentNodeId ?? null };
  });
  check(
    "tapping ✓ confirms the courteous choice and advances the parley (not to the fight)",
    afterReefChoice.node !== "affront" && afterReefChoice.node !== null,
    JSON.stringify(afterReefChoice)
  );
}

// ---------- Act 7: the cooking minigame (the bake) via touch ----------
// Jump to the pizzeria with all four ingredients in hand and Testudo already
// met, then tap to talk, confirm "Bake the pizza." with the ✓ column, and drive
// the cooking timing minigame with screen taps to land a perfect pizza.
await page.evaluate(() => {
  const g = window.__game;
  const st = g.registry.get("act1");
  const flags = {
    ...st.flags,
    actComplete: true, act2Started: true, wardenDefeated: true, act2Complete: true,
    slitherJoined: true, act3Started: true, act3Complete: true, silverfinCaught: true,
    act4Started: true, act4Complete: true, gotSocks: true,
    act5Started: true, act5Complete: true, fluffballJoined: true, gotOranges: true,
    act6Started: true, act6Complete: true, gotSeaweed: true,
    act7Started: true, sawPizzaDescent: true, sawPizzaVent: true, sawPizzaApproach: true,
    metTestudo: true
  };
  const items = { ...st.items, silverfin: true, stinkySocks: true, oranges: true, seaweed: true };
  g.registry.set("act1", { ...st, zone: "pizzeria", hp: 999, items, flags });
  for (const s of g.scene.getScenes(true)) if (s.scene.key !== "boot") g.scene.stop(s.scene.key);
  g.scene.start("pizzeria", {});
});
await page.waitForTimeout(1300);

// Stand next to Chef Testudo and tap the right side to talk via touch.
await page.evaluate(() => {
  const w = window.__game.scene.getScene("pizzeria");
  const n = w["npcs"][0]; // Chef Testudo, at his oven
  w.player.body.reset(n.sprite.x, n.sprite.y + 14);
});
await page.waitForTimeout(250);
await tapRightSide();
await page.waitForTimeout(400);
const bakeTap = await page.evaluate(() => ({ open: window.__game.scene.getScene("pizzeria").dialogue.isOpen }));
check("tapping to talk opens Testudo's bake dialogue via touch", bakeTap.open === true, JSON.stringify(bakeTap));

// Advance to the bake choice list, then confirm "Bake the pizza." (row 0) via ✓.
let bakeDlg = null;
for (let i = 0; i < 10; i++) {
  bakeDlg = await page.evaluate(() => {
    const w = window.__game.scene.getScene("pizzeria");
    return { open: w.dialogue.isOpen, choices: w.dialogue["runner"]?.choices?.map((c) => c.text) ?? null };
  });
  if (!bakeDlg.open || bakeDlg.choices) break;
  await tapRightSide();
  await page.waitForTimeout(220);
}
check(
  "Testudo's bake dialogue reaches its bake/wait choice list via touch",
  bakeDlg.open === true && Array.isArray(bakeDlg.choices) && bakeDlg.choices.length === 2,
  JSON.stringify(bakeDlg)
);
if (bakeDlg.choices) {
  const confirmBtn = await page.evaluate(() => {
    const w = window.__game.scene.getScene("pizzeria");
    const dlg = w.dialogue;
    const b = dlg["touchButtons"];
    const rect = window.__game.canvas.getBoundingClientRect();
    const sx = rect.width / window.__game.scale.width;
    const sy = rect.height / window.__game.scale.height;
    const cx = dlg["container"].x;
    const cy = dlg["container"].y;
    return {
      x: rect.x + (cx + b.x + b.size / 2) * sx,
      y: rect.y + (cy + b.top + b.gap + b.size / 2) * sy
    };
  });
  await page.touchscreen.tap(confirmBtn.x, confirmBtn.y);
  await page.waitForTimeout(300);
  // Confirming picks "Bake the pizza." → the terminal `bake-end` line; advance
  // past it to close the dialogue, whose onClose opens the cooking minigame.
  for (let i = 0; i < 6; i++) {
    const open = await page.evaluate(() => window.__game.scene.getScene("pizzeria").dialogue.isOpen);
    if (!open) break;
    await tapRightSide();
    await page.waitForTimeout(220);
  }
  await page.waitForTimeout(400);
}
const cookOpen = await page.evaluate(() => !!window.__game.scene.getScene("pizzeria").cookingMenu);
check("confirming the bake opens the cooking minigame via touch", cookOpen === true);

// Drive the bake with screen taps: PLACE only when the heat marker is inside
// the glow (a tap anywhere on the play area counts as a PLACE).
const rect = await page.evaluate(() => {
  const r = window.__game.canvas.getBoundingClientRect();
  return { x: r.x, y: r.y, w: r.width, h: r.height };
});
const cookDeadline = Date.now() + 45_000;
let baked = false;
while (Date.now() < cookDeadline) {
  const cs = await page.evaluate(() => {
    const w = window.__game.scene.getScene("pizzeria");
    const m = w.cookingMenu;
    if (!m) return { open: false, baked: window.__game.registry.get("act1").flags.pizzaBaked === true };
    return { open: true, p: m.state.position, t: m.cfg.target, w: m.cfg.windowHalf };
  });
  if (!cs.open) { baked = cs.baked; break; }
  if (Math.abs(cs.p - cs.t) < cs.w * 0.45) {
    await page.touchscreen.tap(rect.x + rect.w * 0.5, rect.y + rect.h * 0.45);
  }
  await page.waitForTimeout(30);
}
check("the cooking minigame bakes the perfect pizza via touch taps", baked === true);
const pizzaBaked = await page.evaluate(() => window.__game.registry.get("act1").flags.pizzaBaked === true);
check("the pizza is baked (touch)", pizzaBaked === true);

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));

await browser.close();
if (failures > 0) {
  console.error(`\n${failures} touch smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAll touch smoke checks passed");
