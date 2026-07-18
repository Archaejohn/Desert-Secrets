import type { Page } from "@playwright/test";

// Stashed on the Page object under one shared key so every spec's final
// "no page errors" assertion reads back exactly what its own beforeEach
// installed — dedupes what used to be a `(page as any).__pageErrors = []`
// + `page.on("pageerror", ...)` pair copy-pasted into every act/touch/walkout
// spec (and a differently-named `_smokePageErrors` in spine.spec.ts).
const KEY = "__pageErrors";

/**
 * Install a page-error listener and stash the accumulating array on `page`.
 * Call once per test (typically from a `test.beforeEach`). Returns the same
 * array `getPageErrors` will later read back.
 */
export function installPageErrors(page: Page): string[] {
  const errors: string[] = [];
  (page as any)[KEY] = errors;
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}

/** Read back the array installed by `installPageErrors` (empty if none was installed). */
export function getPageErrors(page: Page): string[] {
  return (page as any)[KEY] ?? [];
}
