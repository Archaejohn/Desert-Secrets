# Shipping to Android

The game is a Phaser 3 web build, which ships to Android with
[Capacitor](https://capacitorjs.com/) — the standard wrapper for web games
on Google Play. Nothing in the game assumes a browser beyond a WebView:

- `npm run build` produces a **single self-contained `dist/index.html`**
  (all code and art inlined), so the WebView needs no dev server and no
  network access.
- The game canvas is 480×270 with `Phaser.Scale.FIT` + `CENTER_BOTH`, so it
  letterboxes cleanly on any phone aspect ratio; `viewport-fit=cover` and
  `touch-action: none` are already set in `index.html`.
- Touch controls are first-class: drag-to-move virtual joystick on the left
  half of the screen, tap-to-interact on the right, tappable dialogue
  choices and battle menus.

## Steps (when ready to package)

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Desert Secrets" com.example.desertsecrets --web-dir dist
npm run build
npx cap add android
npx cap sync android
npx cap open android   # build/sign in Android Studio
```

`capacitor.config.ts` only needs `webDir: "dist"`. For release builds,
follow the standard Play Store signing flow in Android Studio.

## Performance notes

- Pixel art at a 480×270 internal resolution is trivially cheap on any
  Android GPU; Phaser's WebGL renderer is used when available and falls
  back to canvas.
- All assets are tiny generated PNGs (a few KB total) inlined as data URIs,
  so cold start is dominated by WebView spin-up, not asset loading.
