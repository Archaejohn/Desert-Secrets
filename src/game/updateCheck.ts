/**
 * Deployed-version check + update UI. Deliberately plain DOM, not a Phaser
 * GameObject: it needs to work identically on the title screen, mid-battle,
 * mid-dialogue, or even if a scene has crashed, and every one of those is a
 * different Phaser scene (see CrashScene) — elements appended once over the
 * `#game` div sidestep wiring it into ~38 individual scene files.
 *
 * How it detects an update: vite.config.ts stamps each build with an
 * ISO-timestamp `APP_VERSION`, baked into the client bundle as
 * `__APP_VERSION__` AND written standalone to `version.json` next to
 * index.html. Comparing the two tells us whether the currently *running*
 * build is stale, independent of whatever the browser/service-worker cache is
 * doing. `version.json` is fetched with `cache: "no-store"` so this check
 * itself is never satisfied from a stale cache.
 *
 * Two affordances:
 *  - a small always-present corner button to check on demand (resting glyph
 *    ⟳; a manual tap re-checks and, if current, flashes ✓);
 *  - a PROMINENT banner that drops in only when a newer build is detected —
 *    the corner button alone was too easy to miss (it just recoloured).
 *
 * Applying an update is bulletproof against the caching that used to keep
 * players stale: `applyUpdate()` pulls the new service worker, tells it to
 * take over immediately, deletes every Cache Storage entry, then reloads —
 * and the SW itself now bypasses the HTTP cache on navigation (see
 * public/sw.js). Never auto-reloads: applying is always the player's tap, so
 * an update can't yank the page out from under an active battle.
 */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const FLASH_MS = 1500;
const RESTING_GLYPH = "⟳";

// Desert palette (mirrors src/shared/palette.ts; kept literal so this plain-DOM
// module has no Phaser/asset imports).
const INK = "#241827";
const GOLD = "#f0c439";
const BONE = "#eec48f";
const PLUM = "#75485e";

async function fetchDeployedVersion(): Promise<string | null> {
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: unknown };
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null; // offline, or version.json doesn't exist (e.g. `vite dev`)
  }
}

/**
 * Reload onto the newest bytes, defeating every cache layer: pull + take over
 * the new service worker, delete all caches, then reload (the SW's navigation
 * fetch bypasses the HTTP cache too). Best-effort — reloads even if the
 * SW/cache steps throw.
 */
async function applyUpdate(): Promise<void> {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      await reg?.update().catch(() => {});
      reg?.waiting?.postMessage("skipWaiting");
      navigator.serviceWorker.controller?.postMessage("skipWaiting");
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    // ignore — reload regardless
  }
  location.reload();
}

export function initUpdateCheck(): void {
  if (typeof document === "undefined") return; // headless smoke/test runs

  // --- prominent "update available" banner (hidden until a newer build is seen) ---
  const banner = document.createElement("div");
  Object.assign(banner.style, {
    position: "fixed",
    top: "8px",
    left: "50%",
    transform: "translateX(-50%) translateY(-140%)",
    zIndex: "10001",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    maxWidth: "92vw",
    padding: "8px 10px 8px 12px",
    border: `1px solid ${GOLD}`,
    borderRadius: "8px",
    background: "#241827f2",
    color: BONE,
    fontFamily: "monospace",
    fontSize: "13px",
    lineHeight: "1.2",
    boxShadow: "0 4px 16px #0008",
    transition: "transform 260ms ease",
    pointerEvents: "auto"
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement("span");
  label.textContent = "New version available";
  label.style.color = GOLD;

  const updateBtn = document.createElement("button");
  updateBtn.textContent = "Update now";
  Object.assign(updateBtn.style, {
    padding: "5px 10px",
    border: "none",
    borderRadius: "5px",
    background: GOLD,
    color: INK,
    fontFamily: "monospace",
    fontSize: "13px",
    fontWeight: "bold",
    cursor: "pointer"
  } satisfies Partial<CSSStyleDeclaration>);

  const dismiss = document.createElement("button");
  dismiss.textContent = "✕";
  dismiss.setAttribute("aria-label", "Dismiss");
  Object.assign(dismiss.style, {
    padding: "3px 6px",
    border: "none",
    borderRadius: "5px",
    background: "transparent",
    color: BONE,
    fontFamily: "monospace",
    fontSize: "13px",
    cursor: "pointer"
  } satisfies Partial<CSSStyleDeclaration>);

  banner.append(label, updateBtn, dismiss);
  document.body.appendChild(banner);

  const showBanner = (): void => {
    banner.style.transform = "translateX(-50%) translateY(0)";
  };
  const hideBanner = (): void => {
    banner.style.transform = "translateX(-50%) translateY(-140%)";
  };

  updateBtn.addEventListener("click", () => {
    updateBtn.textContent = "Updating…";
    void applyUpdate();
  });
  dismiss.addEventListener("click", hideBanner);

  // --- small always-present corner button (manual check) ---
  const btn = document.createElement("button");
  btn.textContent = RESTING_GLYPH;
  btn.title = "Check for updates";
  btn.setAttribute("aria-label", "Check for updates");
  Object.assign(btn.style, {
    position: "fixed",
    right: "4px",
    bottom: "4px",
    zIndex: "10000",
    width: "26px",
    height: "26px",
    padding: "0",
    border: `1px solid ${PLUM}`,
    borderRadius: "4px",
    background: "#24182799",
    color: BONE,
    fontFamily: "monospace",
    fontSize: "14px",
    lineHeight: "1",
    cursor: "pointer"
  } satisfies Partial<CSSStyleDeclaration>);
  document.body.appendChild(btn);

  let updateAvailable = false;
  let flashTimer: ReturnType<typeof setTimeout> | null = null;

  const setBadged = (badged: boolean): void => {
    updateAvailable = badged;
    btn.style.color = badged ? GOLD : BONE;
    btn.style.borderColor = badged ? GOLD : PLUM;
    btn.title = badged ? "Update available — tap to refresh" : "Check for updates";
    if (badged) showBanner();
  };

  const flash = (text: string): void => {
    if (flashTimer) clearTimeout(flashTimer);
    btn.textContent = text;
    flashTimer = setTimeout(() => {
      // Always back to the resting glyph, not whatever textContent held at
      // call time — that could be "…" (the in-flight check indicator) if a
      // click fires while a check is already underway, leaving the button
      // stuck on the ellipsis forever.
      btn.textContent = RESTING_GLYPH;
      flashTimer = null;
    }, FLASH_MS);
  };

  const checkForUpdate = async (): Promise<boolean> => {
    const deployed = await fetchDeployedVersion();
    const stale = deployed !== null && deployed !== __APP_VERSION__;
    setBadged(stale);
    return stale;
  };

  btn.addEventListener("click", () => {
    void (async () => {
      if (updateAvailable) {
        void applyUpdate();
        return;
      }
      btn.textContent = "…";
      const stale = await checkForUpdate();
      if (stale) void applyUpdate();
      else flash("✓");
    })();
  });

  void checkForUpdate();
  setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  });
}
