/**
 * Deployed-version check + manual refresh button. Deliberately plain DOM,
 * not a Phaser GameObject: it needs to work identically on the title
 * screen, mid-battle, mid-dialogue, or even if a scene has crashed, and
 * every one of those is a different Phaser scene (see CrashScene) — a
 * single element appended once over the `#game` div sidesteps having to
 * wire it into ~38 individual scene files the way the per-scene touch
 * buttons in ui/touch.ts are.
 *
 * How it detects an update: vite.config.ts stamps each build with an
 * ISO-timestamp `APP_VERSION`, baked into the client bundle as
 * `__APP_VERSION__` AND written standalone to `version.json` next to
 * index.html. Comparing the two tells us whether the currently *running*
 * build is stale, independent of whatever the browser/service-worker
 * cache is doing. `version.json` is fetched with `cache: "no-store"` so
 * this check itself is never satisfied from a stale cache.
 *
 * Reloading is enough to pick up the new build: public/sw.js is
 * network-first (see its own doc comment), so any reload with
 * connectivity always re-fetches the current index.html from the network.
 *
 * Never auto-reloads — that could yank the page out from under an active
 * battle. An automatic background check just badges the button; applying
 * the update is always the player's own tap.
 */
const CHECK_INTERVAL_MS = 10 * 60 * 1000;
const FLASH_MS = 1500;
const RESTING_GLYPH = "⟳";

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

export function initUpdateCheck(): void {
  if (typeof document === "undefined") return; // headless smoke/test runs

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
    border: "1px solid #75485e",
    borderRadius: "4px",
    background: "#24182799",
    color: "#eec48f",
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
    btn.style.color = badged ? "#f0c439" : "#eec48f";
    btn.style.borderColor = badged ? "#f0c439" : "#75485e";
    btn.title = badged ? "Update available — tap to refresh" : "Check for updates";
  };

  const flash = (text: string): void => {
    if (flashTimer) clearTimeout(flashTimer);
    btn.textContent = text;
    flashTimer = setTimeout(() => {
      // Always back to the resting glyph, not whatever textContent held at
      // call time — that could be "…" (the in-flight check indicator) if a
      // click fires while a check is already underway, leaving the button
      // stuck on the ellipsis forever instead of reverting.
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
        location.reload();
        return;
      }
      btn.textContent = "…";
      const stale = await checkForUpdate();
      if (stale) location.reload();
      else flash("✓");
    })();
  });

  void checkForUpdate();
  setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkForUpdate();
  });
}
