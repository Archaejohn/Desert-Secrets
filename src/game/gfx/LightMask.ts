/**
 * LightMask — a reusable, scene-owned lighting / light-mask overlay
 * (presentation only; nothing here changes game rules). It composites a
 * variable-opacity full-screen tint with any number of positioned lights on
 * top of a zone, to fake torches, glows, flashes and pulsing light sources.
 *
 * What it can do (all combinable):
 *  - **Torch / lantern** (`blend:"reveal"`): a dark full-screen base with a
 *    soft light gradient PUNCHED THROUGH it via `RenderTexture.erase`
 *    (destination-out), so the world shows at full brightness under the light
 *    and darkens toward the edges. Set `follow` to a sprite and it tracks the
 *    character as they move.
 *  - **Additive glow** (`blend:"add"`): a coloured gradient that ADDs light to
 *    the scene — a glow emanating from a point or sprite.
 *  - **Flat tint** (`blend:"normal"`) and one-shot **flash** (`flash()`): a
 *    full-screen colour at variable opacity that can e.g. flash white.
 *  - **Pulse** (`pulse`): time-driven breathing of a light's intensity — the
 *    "ice wall pulses blue" beat.
 *  - **Multi-stop gradients**: arbitrary colour+alpha+offset stops (e.g. a
 *    blue centre → white glow → clear).
 *  - **Falloff shape** (`shape:"circle"|"square"`), **linear gradients**
 *    (`gradient:"linear"` + `angle`) for a directional wash, and **hard-edge
 *    masking** (`mask`) to clip a light to a rect/polygon with a crisp edge —
 *    light through a doorway.
 *
 * Two things this file is deliberately careful about (the two most likely to
 * go subtly wrong — see the task brief):
 *
 * 1. **ERASE compositing lives inside a RenderTarget.** `Phaser.BlendModes.
 *    ERASE` (destination-out) only works when drawing INTO a render target,
 *    so the base darkness AND all the torch "holes" go into ONE
 *    RenderTexture, which is then displayed. `RenderTexture.erase(stamp)`
 *    does exactly this and honours the stamp's own alpha (so a pulse dims the
 *    torch). Additive glows are separate ADD-blend Images layered on top.
 *
 * 2. **Two-camera architecture (see ZoneScene).** Every zone runs a world
 *    camera plus a `uiCamera` that draws only `uiLayer`, and
 *    `syncUiCameraIgnore()` marks every non-uiLayer child ignored by
 *    `uiCamera` each frame. This overlay is an ordinary scene child (NOT on
 *    `uiLayer`) at a high depth, so: it renders through `cameras.main` only
 *    (the sync makes `uiCamera` ignore it — no double draw), it sits above the
 *    world but the HUD still draws on top because `uiCamera` renders after the
 *    world camera regardless of depth. The one wrinkle: `scrollFactor(0)`
 *    cancels camera SCROLL but NOT camera ZOOM (the same reason `uiCamera`
 *    exists), and the overworld runs at a fractional zoom — so every
 *    screen-space object here is counter-scaled by `1/zoom` and repositioned
 *    about the camera pivot each frame (`placeScreenObject`), and world-
 *    anchored lights project through `projectWorldToScreen`, which handles any
 *    zoom. In a plain zoom-1 zone all of that is the identity.
 *
 * Gradients are baked into a texture ONCE (cached by signature) and then only
 * positioned/scaled/tinted/alpha'd per frame — never re-filled on the canvas
 * each frame (per-frame canvas gradient fills are too slow for mobile).
 */
import Phaser from "phaser";
import {
  buildStopLut,
  linearFalloffT,
  normalizeStops,
  projectWorldToScreen,
  pulseValue,
  radialFalloffT,
  type CameraView,
  type FalloffShape,
  type LightStop,
  type PulseSpec
} from "../../core/lighting";

export type LightBlend = "reveal" | "add" | "normal";
export type LightAnchor = "world" | "screen";
export type GradientKind = "radial" | "linear";

/** A hard-edged clip applied to a light's footprint at bake time. Coordinates
 *  are fractions of the footprint (0..1), so a mask is resolution-independent.
 *  `rect` gives a crisp rectangular beam/shaft; `poly` an arbitrary hard
 *  polygon (e.g. a trapezoid of light spreading from a doorway). */
export interface LightHardMask {
  type: "rect" | "poly";
  rect?: { x: number; y: number; w: number; h: number };
  points?: ReadonlyArray<{ x: number; y: number }>;
}

/** Something with live world x/y a light can follow (a sprite, a body, …). */
export interface FollowTarget {
  x: number;
  y: number;
}

export interface LightSpec {
  /** Centre. World coords if `anchor:"world"` (default), screen px if
   *  `anchor:"screen"`. Ignored while `follow` is set (world anchor). */
  x?: number;
  y?: number;
  /** Circle/square footprint half-size. `width`/`height` override it for a
   *  non-square footprint (needed for rect beams / linear washes). */
  radius?: number;
  width?: number;
  height?: number;
  stops: LightStop[];
  blend?: LightBlend; // default "add"
  anchor?: LightAnchor; // default "world"
  gradient?: GradientKind; // default "radial"
  shape?: FalloffShape; // radial only; default "circle"
  angle?: number; // linear direction, radians; 0 = left→right
  mask?: LightHardMask; // optional hard-edge clip
  follow?: FollowTarget | null; // track a sprite (world anchor)
  pulse?: PulseSpec | null; // time-driven intensity breathe
  intensity?: number; // base alpha multiplier, default 1
  depth?: number; // display depth override (add/normal lights)
  visible?: boolean; // default true
}

/** A live handle to a placed light. */
export interface LightHandle {
  readonly id: number;
  update(patch: Partial<LightSpec>): void;
  setFollow(target: FollowTarget | null): void;
  setVisible(v: boolean): void;
  remove(): void;
}

export interface FlashOptions {
  /** Total rise time to peak (ms). Default 90. */
  riseMs?: number;
  /** Hold at peak before falling (ms). Default 0. */
  holdMs?: number;
  /** Fall time back to clear (ms). Default riseMs*2. */
  fallMs?: number;
  /** Peak alpha, 0..1. Default 0.85. */
  peak?: number;
}

interface BaseFill {
  color: number;
  alpha: number;
}

interface BakedTexture {
  key: string;
  w: number;
  h: number;
}

interface Light {
  id: number;
  spec: Required<
    Omit<LightSpec, "follow" | "pulse" | "mask" | "width" | "height" | "depth">
  > & {
    follow: FollowTarget | null;
    pulse: PulseSpec | null;
    mask: LightHardMask | null;
    width: number;
    height: number;
    depth: number;
  };
  tex: BakedTexture;
  /** Reveal lights: an off-list stamp erased into the RT each frame.
   *  add/normal lights: a live scene Image rendered over the RT. */
  stamp: Phaser.GameObjects.Image | null;
  glow: Phaser.GameObjects.Image | null;
}

const DEFAULT_DEPTH = 5000;
const MAX_BAKE = 1024;
const MIN_BAKE = 16;

let nextLightId = 1;
let nextTexSeq = 1;

export class LightMask {
  private readonly scene: Phaser.Scene;
  private readonly depth: number;
  private base: BaseFill;
  private readonly rt: Phaser.GameObjects.RenderTexture;
  private readonly lights: Light[] = [];
  private flashRect: Phaser.GameObjects.Rectangle | null = null;
  private flashTween: Phaser.Tweens.Tween | Phaser.Tweens.TweenChain | null = null;
  /** Scene-scoped bake cache: gradient signature → baked texture. Shared
   *  across lights so a followed torch that moves reuses one texture. */
  private readonly bakeCache = new Map<string, BakedTexture>();
  private readonly ownedTextureKeys: string[] = [];
  private destroyed = false;

  constructor(scene: Phaser.Scene, opts: { depth?: number; base?: Partial<BaseFill> } = {}) {
    this.scene = scene;
    this.depth = opts.depth ?? DEFAULT_DEPTH;
    this.base = { color: opts.base?.color ?? 0x000000, alpha: opts.base?.alpha ?? 0 };

    const { width, height } = scene.scale;
    this.rt = scene.add
      .renderTexture(0, 0, width, height)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(this.depth);
    // Smooth the full-screen bake when counter-scaled by 1/zoom on the
    // overworld (a soft dark gradient, so LINEAR reads better than NEAREST).
    this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    scene.events.once(Phaser.Scenes.Events.DESTROY, this.destroy, this);
  }

  /** Change the ambient full-screen fill under the reveal holes (darkness). */
  setBase(base: Partial<BaseFill>): void {
    this.base = { color: base.color ?? this.base.color, alpha: base.alpha ?? this.base.alpha };
  }

  /** Add a light; returns a handle to update/remove it. */
  addLight(spec: LightSpec): LightHandle {
    const light = this.makeLight(spec);
    this.lights.push(light);
    const id = light.id;
    return {
      id,
      update: (patch) => this.patchLight(id, patch),
      setFollow: (t) => this.patchLight(id, { follow: t }),
      setVisible: (v) => this.patchLight(id, { visible: v }),
      remove: () => this.removeLight(id)
    };
  }

  /**
   * One-shot full-screen flash that fades on its own (e.g. a white hit-flash).
   * Reuses one rectangle; a new flash interrupts any in-flight one.
   */
  flash(color: number | string, opts: FlashOptions = {}): void {
    if (this.destroyed) return;
    const rise = opts.riseMs ?? 90;
    const fall = opts.fallMs ?? rise * 2;
    const hold = opts.holdMs ?? 0;
    const peak = opts.peak ?? 0.85;
    const colorInt = typeof color === "number" ? color : Phaser.Display.Color.HexStringToColor(color).color;

    if (!this.flashRect) {
      const { width, height } = this.scene.scale;
      this.flashRect = this.scene.add
        .rectangle(0, 0, width, height, colorInt, 1)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(this.depth + 100)
        .setAlpha(0);
    }
    this.flashRect.setFillStyle(colorInt, 1);
    // Independent rise and fall timing (a hit-flash snaps up, eases down),
    // expressed as one chained tween so a later flash() cleanly interrupts it.
    this.flashTween?.remove();
    this.flashRect.setAlpha(0);
    this.flashTween = this.scene.tweens.chain({
      targets: this.flashRect,
      tweens: [
        { alpha: peak, duration: rise, ease: "Quad.easeOut" },
        { alpha: 0, delay: hold, duration: fall, ease: "Quad.easeIn" }
      ],
      onComplete: () => {
        this.flashRect?.setAlpha(0);
        this.flashTween = null;
      }
    });
  }

  /** Advance animations and reposition everything for this frame's camera.
   *  Call once per scene `update()`. */
  update(): void {
    if (this.destroyed) return;
    const cam = this.scene.cameras.main;
    const view = this.cameraView(cam);
    const now = this.scene.time.now;

    if (this.flashRect) this.placeFullScreen(this.flashRect, view);

    // The reveal RenderTexture (base darkness + erased torch holes) is only
    // needed when there's darkness to punch through — skip the full-screen
    // clear/fill/erase AND the composited quad entirely when nothing uses it
    // (a scene running only additive glows shouldn't pay for it every frame).
    const hasReveal = this.lights.some(
      (l) => l.spec.blend === "reveal" && l.spec.visible && l.stamp
    );
    if (this.base.alpha <= 0 && !hasReveal) {
      this.rt.setVisible(false);
    } else {
      this.rt.setVisible(true);
      this.placeFullScreen(this.rt, view); // counter-scale for camera zoom
      this.rt.clear();
      if (this.base.alpha > 0) this.rt.fill(this.base.color, this.base.alpha);
      for (const light of this.lights) {
        if (light.spec.blend !== "reveal") continue;
        if (!light.spec.visible || !light.stamp) continue;
        const placed = this.screenPlacement(light, view);
        if (!placed) continue;
        const alpha = light.spec.intensity * this.pulseFactor(light, now);
        light.stamp
          .setPosition(placed.sx, placed.sy)
          .setScale(placed.screenW / light.tex.w, placed.screenH / light.tex.h)
          .setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
        // erase() forces destination-out and honours the stamp's alpha.
        this.rt.erase(light.stamp);
      }
    }

    // Additive / normal lights: live Images layered over the RT.
    for (const light of this.lights) {
      if (light.spec.blend === "reveal" || !light.glow) continue;
      const placed = light.spec.visible ? this.screenPlacement(light, view) : null;
      if (!placed) {
        light.glow.setVisible(false);
        continue;
      }
      const alpha = light.spec.intensity * this.pulseFactor(light, now);
      light.glow.setVisible(true);
      this.placeScreenObject(light.glow, placed.sx, placed.sy, placed.screenW, placed.screenH, light.tex.w, light.tex.h, view);
      light.glow.setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.scene.events.off(Phaser.Scenes.Events.DESTROY, this.destroy, this);
    this.flashTween?.remove();
    this.flashTween = null;
    this.flashRect?.destroy();
    this.flashRect = null;
    for (const light of this.lights) {
      light.stamp?.destroy();
      light.glow?.destroy();
    }
    this.lights.length = 0;
    this.rt.destroy();
    for (const key of this.ownedTextureKeys) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
    this.ownedTextureKeys.length = 0;
    this.bakeCache.clear();
  }

  // ---------- internals ----------

  private cameraView(cam: Phaser.Cameras.Scene2D.Camera): CameraView {
    return {
      scrollX: cam.scrollX,
      scrollY: cam.scrollY,
      zoom: cam.zoom,
      width: cam.width,
      height: cam.height,
      originX: cam.originX,
      originY: cam.originY
    };
  }

  private makeLight(spec: LightSpec): Light {
    const blend = spec.blend ?? "add";
    const gradient = spec.gradient ?? "radial";
    const shape = spec.shape ?? "circle";
    const anchor = spec.anchor ?? "world";
    const radius = spec.radius ?? 64;
    const width = spec.width ?? radius * 2;
    const height = spec.height ?? radius * 2;
    const resolved: Light["spec"] = {
      x: spec.x ?? 0,
      y: spec.y ?? 0,
      radius,
      width,
      height,
      stops: spec.stops,
      blend,
      anchor,
      gradient,
      shape,
      angle: spec.angle ?? 0,
      follow: spec.follow ?? null,
      pulse: spec.pulse ?? null,
      mask: spec.mask ?? null,
      intensity: spec.intensity ?? 1,
      depth: spec.depth ?? this.depth + 1,
      visible: spec.visible ?? true
    };
    const tex = this.bakeGradient(resolved);
    const light: Light = { id: nextLightId++, spec: resolved, tex, stamp: null, glow: null };
    this.buildDisplay(light);
    return light;
  }

  /** Create (or recreate) the display object for a light's current blend. */
  private buildDisplay(light: Light): void {
    light.stamp?.destroy();
    light.glow?.destroy();
    light.stamp = null;
    light.glow = null;
    if (light.spec.blend === "reveal") {
      // Off-display-list stamp, used only as an erase source into the RT.
      light.stamp = this.scene.make.image({ key: light.tex.key, add: false }, false).setOrigin(0.5, 0.5);
    } else {
      light.glow = this.scene.add
        .image(0, 0, light.tex.key)
        .setOrigin(0.5, 0.5)
        .setScrollFactor(0)
        .setDepth(light.spec.depth)
        .setBlendMode(light.spec.blend === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL)
        .setVisible(false); // positioned on the first update()
    }
  }

  private pulseFactor(light: Light, now: number): number {
    return light.spec.pulse ? pulseValue(light.spec.pulse, now) : 1;
  }

  /** Resolve a light's centre + on-screen footprint size for this frame. */
  private screenPlacement(
    light: Light,
    view: CameraView
  ): { sx: number; sy: number; screenW: number; screenH: number } | null {
    const s = light.spec;
    if (s.anchor === "screen") {
      return { sx: s.x, sy: s.y, screenW: s.width, screenH: s.height };
    }
    const wx = s.follow ? s.follow.x : s.x;
    const wy = s.follow ? s.follow.y : s.y;
    const p = projectWorldToScreen(view, wx, wy);
    // World footprint scales with camera zoom on screen.
    return { sx: p.x, sy: p.y, screenW: s.width * view.zoom, screenH: s.height * view.zoom };
  }

  /** Place a `scrollFactor(0)` object so it appears centred at screen (sx,sy)
   *  with an on-screen size of screenW×screenH, cancelling the camera zoom
   *  (which scrollFactor(0) does NOT cancel — see the class doc). */
  private placeScreenObject(
    obj: Phaser.GameObjects.Components.Transform,
    sx: number,
    sy: number,
    screenW: number,
    screenH: number,
    texW: number,
    texH: number,
    view: CameraView
  ): void {
    const pivotX = view.width * view.originX;
    const pivotY = view.height * view.originY;
    const z = view.zoom;
    obj.setPosition(pivotX + (sx - pivotX) / z, pivotY + (sy - pivotY) / z);
    obj.setScale(screenW / (texW * z), screenH / (texH * z));
  }

  /** Full-screen helper: centre + counter-scale a native width×height overlay. */
  private placeFullScreen(obj: Phaser.GameObjects.Components.Transform, view: CameraView): void {
    const { width, height } = this.scene.scale;
    this.placeScreenObject(obj, width / 2, height / 2, width, height, width, height, view);
  }

  private patchLight(id: number, patch: Partial<LightSpec>): void {
    const light = this.lights.find((l) => l.id === id);
    if (!light) return;
    const s = light.spec;
    // Simple runtime fields.
    if (patch.x !== undefined) s.x = patch.x;
    if (patch.y !== undefined) s.y = patch.y;
    if (patch.intensity !== undefined) s.intensity = patch.intensity;
    if (patch.visible !== undefined) s.visible = patch.visible;
    if (patch.follow !== undefined) s.follow = patch.follow;
    if (patch.pulse !== undefined) s.pulse = patch.pulse;
    if (patch.radius !== undefined) {
      s.radius = patch.radius;
      if (patch.width === undefined) s.width = patch.radius * 2;
      if (patch.height === undefined) s.height = patch.radius * 2;
    }
    if (patch.width !== undefined) s.width = patch.width;
    if (patch.height !== undefined) s.height = patch.height;
    if (patch.depth !== undefined) {
      s.depth = patch.depth;
      light.glow?.setDepth(patch.depth);
    }

    // Fields that change the baked pixels → re-bake, and the blend/anchor that
    // change which display object we need → rebuild it.
    const rebake =
      patch.stops !== undefined ||
      patch.gradient !== undefined ||
      patch.shape !== undefined ||
      patch.angle !== undefined ||
      patch.mask !== undefined ||
      patch.width !== undefined ||
      patch.height !== undefined ||
      patch.radius !== undefined;
    if (patch.stops !== undefined) s.stops = patch.stops;
    if (patch.gradient !== undefined) s.gradient = patch.gradient;
    if (patch.shape !== undefined) s.shape = patch.shape;
    if (patch.angle !== undefined) s.angle = patch.angle;
    if (patch.mask !== undefined) s.mask = patch.mask ?? null;
    const blendChanged = patch.blend !== undefined && patch.blend !== s.blend;
    if (patch.blend !== undefined) s.blend = patch.blend;

    if (rebake) {
      const prevKey = light.tex.key;
      light.tex = this.bakeGradient(s);
      if (light.stamp) light.stamp.setTexture(light.tex.key);
      if (light.glow) light.glow.setTexture(light.tex.key);
      // Free the superseded texture if no other light references it, so
      // animating a baked param (radius/stops/…) at runtime doesn't accumulate
      // dead textures until scene shutdown.
      if (prevKey !== light.tex.key) this.releaseTextureIfUnused(prevKey);
    }
    if (blendChanged) this.buildDisplay(light);
    else if (light.glow) {
      light.glow.setBlendMode(s.blend === "add" ? Phaser.BlendModes.ADD : Phaser.BlendModes.NORMAL);
    }
  }

  private removeLight(id: number): void {
    const idx = this.lights.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const [light] = this.lights.splice(idx, 1);
    light.stamp?.destroy();
    light.glow?.destroy();
    this.releaseTextureIfUnused(light.tex.key);
  }

  /** Drop a baked texture + its cache entry once no live light references it,
   *  so re-bakes and removals don't retain dead gradient textures. */
  private releaseTextureIfUnused(key: string): void {
    if (this.lights.some((l) => l.tex.key === key)) return;
    for (const [sig, baked] of this.bakeCache) {
      if (baked.key === key) {
        this.bakeCache.delete(sig);
        break;
      }
    }
    const i = this.ownedTextureKeys.indexOf(key);
    if (i >= 0) this.ownedTextureKeys.splice(i, 1);
    if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
  }

  // ---------- gradient baking ----------

  private bakeSignature(s: Light["spec"], texW: number, texH: number): string {
    return JSON.stringify({
      st: s.stops,
      g: s.gradient,
      sh: s.gradient === "radial" ? s.shape : "", // shape only affects radial falloff
      an: s.gradient === "linear" ? Math.round(s.angle * 1000) : 0,
      mk: s.mask,
      w: texW,
      h: texH
    });
  }

  /**
   * Bake the light's gradient (optionally hard-masked) into a canvas texture,
   * ONCE per unique signature. A 256-entry stop LUT (built pure in core) turns
   * the per-pixel loop into a table lookup — no gradient re-evaluation per
   * texel, and no canvas gradient fill per frame.
   */
  private bakeGradient(s: Light["spec"]): BakedTexture {
    const texW = Phaser.Math.Clamp(Math.round(s.width), MIN_BAKE, MAX_BAKE);
    const texH = Phaser.Math.Clamp(Math.round(s.height), MIN_BAKE, MAX_BAKE);
    const sig = this.bakeSignature(s, texW, texH);
    const cached = this.bakeCache.get(sig);
    if (cached) return cached;

    const key = `__lightmask_${nextTexSeq++}`;
    const canvasTex = this.scene.textures.createCanvas(key, texW, texH);
    if (!canvasTex) throw new Error("LightMask: could not create gradient canvas texture");
    const ctx = canvasTex.context;
    const img = ctx.createImageData(texW, texH);
    const data = img.data;
    const lut = buildStopLut(normalizeStops(s.stops), 256);

    const halfW = texW / 2;
    const halfH = texH / 2;
    for (let y = 0; y < texH; y++) {
      for (let x = 0; x < texW; x++) {
        const dx = x - halfW + 0.5;
        const dy = y - halfH + 0.5;
        const t =
          s.gradient === "linear"
            ? linearFalloffT(dx, dy, s.angle, texW, texH)
            : radialFalloffT(s.shape, dx, dy, halfW, halfH);
        const li = (Math.round(t * 255) & 0xff) * 4;
        const o = (y * texW + x) * 4;
        data[o] = lut[li];
        data[o + 1] = lut[li + 1];
        data[o + 2] = lut[li + 2];
        data[o + 3] = lut[li + 3];
      }
    }
    ctx.putImageData(img, 0, 0);
    if (s.mask) this.applyHardMask(ctx, s.mask, texW, texH);
    canvasTex.refresh();
    canvasTex.setFilter(Phaser.Textures.FilterMode.LINEAR);

    const baked: BakedTexture = { key, w: texW, h: texH };
    this.bakeCache.set(sig, baked);
    this.ownedTextureKeys.push(key);
    return baked;
  }

  /** Clip the just-drawn gradient to a rect/polygon with a crisp edge
   *  (destination-in keeps only what the mask covers). */
  private applyHardMask(
    ctx: CanvasRenderingContext2D,
    mask: LightHardMask,
    w: number,
    h: number
  ): void {
    ctx.save();
    ctx.globalCompositeOperation = "destination-in";
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    if (mask.type === "rect" && mask.rect) {
      ctx.rect(mask.rect.x * w, mask.rect.y * h, mask.rect.w * w, mask.rect.h * h);
    } else if (mask.type === "poly" && mask.points && mask.points.length >= 3) {
      const pts = mask.points;
      ctx.moveTo(pts[0].x * w, pts[0].y * h);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x * w, pts[i].y * h);
      ctx.closePath();
    } else {
      // Malformed mask: keep everything (no-op) rather than blanking the light.
      ctx.rect(0, 0, w, h);
    }
    ctx.fill();
    ctx.restore();
  }
}
