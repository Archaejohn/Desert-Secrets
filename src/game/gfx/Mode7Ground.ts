/**
 * Mode-7 ground-plane renderer (presentation layer for OverworldScene only).
 *
 * Composes the zone's ground+decor tile grids ONCE into an offscreen painted
 * top-down texture (the flat "map image"), then draws a full-screen quad whose
 * fragment shader inverse-projects each pixel below the horizon onto that
 * texture — the SNES Mode-7 look. Above the horizon it paints a dusk sky
 * gradient with a static ridge silhouette. The math and its constants live in
 * the pure, tested `src/core/mode7.ts`; this file only feeds them to the GPU.
 *
 * Phase O billboard layer (docs/ART_DIRECTION.md §4b): decor names registered
 * in `BILLBOARD_FRAME` are NOT baked flat into the ground texture (the map's
 * autotile pass puts scree ground beneath them, so there are no holes) —
 * they're drawn as standing sprites from the `owBillboards` sheet instead,
 * positioned/scaled each frame via the pure `worldToScreen` forward
 * projection, depth-sorted by screen y, haze-tinted toward amber and faded
 * with depth, and culled when behind the camera / beyond maxDepth /
 * off-screen. 2×2 mountain blocks cluster into one bigger billboard to keep
 * the sprite count low (~a hundred for the 16×20 POC map).
 *
 * WebGL-only. The caller is responsible for falling back to the flat tilemap
 * if construction throws (no WebGL, texture/shader failure) — in that
 * fallback the mountains still render as the tiles2 mountain tiles.
 */
import Phaser from "phaser";
import { MANIFEST } from "../manifest";
import { TILE } from "../ZoneScene";
import type { ZoneMap } from "../maps/types";
import { PALETTE, hexToRgb } from "../../shared/palette";
import { makeCamera, worldToScreen, type Mode7Overrides } from "../../core/mode7";

const GROUND_TEXTURE_KEY = "overworld-mode7-ground";

/** Texture key the scene preloads the billboard sheet under. */
export const BILLBOARD_TEXTURE_KEY = "owBillboards";

/**
 * Decor name → owBillboards frame index (frozen contract, docs/CONTRACTS.md
 * "Phase O"): joshuaTrunk/mineTimber/truckCab map onto their landmark
 * frames. Mountain decor is handled separately below by
 * `mountainBillboardFrame` — owMountains.png (docs/CONTRACTS.md
 * "owMountains") replaced the old eight fixed `mountain1..8` names (which
 * used to have their own entries here) with 80 `owMountain{variant}_{mask}`
 * names, so a per-name lookup table is no longer practical. The
 * `mountain1..8` tiles themselves are untouched and still exist in
 * `tiles2.png` (additive-only contract) — they're simply unused by the
 * overworld map now, so they no longer need an entry here either.
 */
const BILLBOARD_FRAME: Record<string, number> = {
  joshuaTrunk: 3,
  mineTimber: 4,
  truckCab: 5
};

/** Prefix shared by every owMountains.png tile name
 *  (`tools/pipeline/src/owMountains.ts`'s `owMountainNames`). */
const OW_MOUNTAIN_PREFIX = "owMountain";

function isMountainDecorName(name: string): boolean {
  return name.startsWith(OW_MOUNTAIN_PREFIX);
}

/**
 * Cyclic-by-name assignment onto the 3 existing owBillboards mass variants
 * A/B/C (frames 0/1/2) — replaces the old per-name `BILLBOARD_FRAME`
 * lookup (which cycled `mountain1..8` through 0,1,2,0,1,2,0,1) now that
 * there are 80 `owMountain{variant}_{mask}` names instead of 8 fixed ones.
 * Parses the two numbers back out of the name and cycles through 0/1/2
 * exactly the same way, just keyed by (variant, mask) instead of by a
 * hardcoded per-name table.
 */
function mountainBillboardFrame(name: string): number {
  const m = /^owMountain(\d+)_(\d+)$/.exec(name);
  if (!m) return 0;
  const variant = Number(m[1]);
  const mask = Number(m[2]);
  return (variant * 16 + mask) % 3;
}

/** Non-mountain decor names left out of the flat ground bake when
 *  billboards are live. truckBox merges into the cab's single truck
 *  billboard. Mountain decor is skipped via `isMountainDecorName` instead
 *  (see `isBillboardSkip` below), since there are 80 possible names. */
const BILLBOARD_SKIP = new Set([...Object.keys(BILLBOARD_FRAME), "truckBox"]);

function isBillboardSkip(name: string): boolean {
  return isMountainDecorName(name) || BILLBOARD_SKIP.has(name);
}

/** Apparent world width (px) each billboard's 48px frame spans on the
 *  ground. Mountains deliberately loom larger than their tile footprint —
 *  that's the point of standing them up. */
const WORLD_WIDTH_CLUSTER = 52;
const WORLD_WIDTH_MOUNTAIN = 30;
const WORLD_WIDTH_BY_NAME: Record<string, number> = {
  joshuaTrunk: 22,
  mineTimber: 30,
  truckCab: 34
};

const FRAGMENT_SRC = [
  "precision mediump float;",
  "",
  "uniform vec2 resolution;",
  "uniform sampler2D iChannel0;",
  "uniform float uCamX;",
  "uniform float uCamY;",
  "uniform float uHorizon;",
  "uniform float uFocal;",
  "uniform float uCamHeight;",
  "uniform float uMaxDepth;",
  "uniform vec2 uMapSize;",
  "uniform vec3 uSkyTop;",
  "uniform vec3 uSkyHorizon;",
  "uniform vec3 uGroundHaze;",
  "uniform vec3 uRidge;",
  "",
  "varying vec2 fragCoord;",
  "",
  "void main (void) {",
  // fragCoord is y-up (0 at the bottom); convert to a top-origin scanline.
  "  float sx = fragCoord.x;",
  "  float syTop = resolution.y - fragCoord.y;",
  "  float p = syTop - uHorizon;",
  "",
  "  if (p <= 0.0) {",
  "    float t = clamp(syTop / max(uHorizon, 1.0), 0.0, 1.0);",
  "    vec3 col = mix(uSkyTop, uSkyHorizon, t);",
  // Static distant ridge hugging the horizon: summed sines, no randomness.
  "    float ridge = 5.0 * sin(sx * 0.035)",
  "                + 3.0 * sin(sx * 0.013 + 1.7)",
  "                + 2.0 * sin(sx * 0.091 + 0.5);",
  "    float ridgeTop = uHorizon - 13.0 - ridge;",
  "    if (syTop >= ridgeTop) {",
  "      col = mix(col, uRidge, 0.6);",
  "    }",
  "    gl_FragColor = vec4(col, 1.0);",
  "    return;",
  "  }",
  "",
  // Inverse perspective (mirrors core/mode7.ts projectGround).
  "  float depth = min((uCamHeight * uFocal) / p, uMaxDepth);",
  "  float wx = uCamX + (sx - resolution.x * 0.5) * depth / uFocal;",
  "  float wy = uCamY - depth;",
  "  vec2 uv = clamp(vec2(wx / uMapSize.x, wy / uMapSize.y), 0.0, 1.0);",
  "  vec3 ground = texture2D(iChannel0, uv).rgb;",
  "",
  // Fade far ground into the horizon haze to hide the edge-clamp seam.
  "  float haze = pow(clamp(depth / uMaxDepth, 0.0, 1.0), 0.7);",
  "  ground = mix(ground, uGroundHaze, haze * 0.9);",
  "",
  "  gl_FragColor = vec4(ground, 1.0);",
  "}"
].join("\n");

function rgbVec(name: keyof typeof PALETTE): { x: number; y: number; z: number } {
  const [r, g, b] = hexToRgb(PALETTE[name]);
  return { x: r / 255, y: g / 255, z: b / 255 };
}

function tileFrame(name: string): { key: string; frame: number } {
  const t1 = MANIFEST.tiles.names[name];
  if (t1 !== undefined) return { key: "tiles", frame: t1 };
  const t2 = MANIFEST.tiles2.names[name];
  if (t2 !== undefined) return { key: "tiles2", frame: t2 };
  const tm = MANIFEST.owMountains.names[name];
  if (tm !== undefined) return { key: "owMountains", frame: tm };
  return { key: "tiles3", frame: MANIFEST.tiles3.names[name] };
}

const AMBER_RGB = hexToRgb(PALETTE.amber);

/** Multiply-tint colour blending white → amber as haze increases. */
function hazeTint(haze: number): number {
  const r = Math.round(255 + (AMBER_RGB[0] - 255) * haze);
  const g = Math.round(255 + (AMBER_RGB[1] - 255) * haze);
  const b = Math.round(255 + (AMBER_RGB[2] - 255) * haze);
  return (r << 16) | (g << 8) | b;
}

interface Billboard {
  img: Phaser.GameObjects.Image;
  /** World anchor: footprint centre x, footprint south edge (the feet). */
  wx: number;
  wy: number;
  worldWidth: number;
}

interface BillboardSpec {
  wx: number;
  wy: number;
  frame: number;
  worldWidth: number;
}

export class Mode7Ground {
  private readonly scene: Phaser.Scene;
  private readonly shader: Phaser.GameObjects.Shader;
  private readonly mapWidthPx: number;
  private readonly mapHeightPx: number;
  private readonly billboards: Billboard[] = [];
  private readonly billboardsEnabled: boolean;
  /** Live-tunable camera params (Mode7Tuner, dev-only — see OverworldScene's
   *  `mode7tune` URL gate). Empty by default: every field falls back to its
   *  MODE7_* constant exactly as before this existed. */
  private overrides: Mode7Overrides;
  /** Vertical-only scale applied to every billboard on top of its normal
   *  width-derived scale (Mode7Tuner's "Peak Height", dev-only) — 1 = full
   *  height (today's look), lower values squash mountains shorter/flatter
   *  while keeping their footprint (world width, ground-contact base
   *  point) unchanged. A camera-independent lever: unlike height/focal/
   *  horizonFraction this doesn't touch the projection at all, it just
   *  scales the standee sprites themselves. */
  private billboardHeightScale = 1;

  constructor(scene: Phaser.Scene, map: ZoneMap, depth: number, overrides: Mode7Overrides = {}) {
    this.scene = scene;
    this.overrides = overrides;
    const rows = map.ground.length;
    const cols = map.ground[0].length;
    this.mapWidthPx = cols * TILE;
    this.mapHeightPx = rows * TILE;

    // Billboards need their sheet; without it, fall back to baking every
    // decor tile flat (the pre-Phase-O look) rather than leaving gaps.
    this.billboardsEnabled = scene.textures.exists(BILLBOARD_TEXTURE_KEY);

    this.paintGroundTexture(map, cols, rows);

    const { width, height } = scene.scale;
    const cam = makeCamera(0, 0, width, height, this.overrides);

    const baseShader = new Phaser.Display.BaseShader("mode7-ground", FRAGMENT_SRC, undefined, {
      uCamX: { type: "1f", value: 0 },
      uCamY: { type: "1f", value: 0 },
      uHorizon: { type: "1f", value: cam.horizon },
      uFocal: { type: "1f", value: cam.focal },
      uCamHeight: { type: "1f", value: cam.height },
      uMaxDepth: { type: "1f", value: cam.maxDepth },
      uMapSize: { type: "2f", value: { x: this.mapWidthPx, y: this.mapHeightPx } },
      uSkyTop: { type: "3f", value: rgbVec("indigo") },
      uSkyHorizon: { type: "3f", value: rgbVec("amber") },
      uGroundHaze: { type: "3f", value: rgbVec("amber") },
      uRidge: { type: "3f", value: rgbVec("mauve") }
    });

    // No flip: the canvas is uploaded top-row-first, so texture v=0 is the map
    // north (tile row 0), matching uv.v = wy / mapHeight in the shader (north =
    // small world y = into the distance). Clamp so sampling past an edge holds
    // the border terrain (NPOT-safe: REPEAT on the non-power-of-two height
    // would break in WebGL1); nearest for crisp pixels.
    const textureData = {
      source: scene.textures.get(GROUND_TEXTURE_KEY).getSourceImage(),
      flipY: false,
      wrapS: "clamp_to_edge",
      wrapT: "clamp_to_edge",
      magFilter: "nearest",
      minFilter: "nearest"
    };

    this.shader = scene.add
      .shader(baseShader, width / 2, height / 2, width, height, [GROUND_TEXTURE_KEY], textureData)
      .setScrollFactor(0)
      .setDepth(depth);

    if (this.billboardsEnabled) this.createBillboards(map);
  }

  private paintGroundTexture(map: ZoneMap, cols: number, rows: number): void {
    const textures = this.scene.textures;
    if (textures.exists(GROUND_TEXTURE_KEY)) textures.remove(GROUND_TEXTURE_KEY);
    const canvas = textures.createCanvas(GROUND_TEXTURE_KEY, this.mapWidthPx, this.mapHeightPx);
    if (!canvas) throw new Error("Mode7Ground: could not create ground canvas texture");

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const g = tileFrame(map.ground[y][x]);
        canvas.drawFrame(g.key, g.frame, x * TILE, y * TILE, false);
        const decorName = map.decor[y][x];
        // Billboard decor stands up instead of baking flat; the ground
        // beneath it (scree, via the map's autotile pass) shows through.
        if (decorName !== null && !(this.billboardsEnabled && isBillboardSkip(decorName))) {
          const d = tileFrame(decorName);
          canvas.drawFrame(d.key, d.frame, x * TILE, y * TILE, false);
        }
      }
    }
    canvas.refresh();
  }

  /** Walk the decor grid into billboard specs: 2×2 mountain blocks merge
   *  into one larger billboard; everything else stands on its own cell. */
  private collectBillboards(map: ZoneMap): BillboardSpec[] {
    const rows = map.ground.length;
    const cols = map.ground[0].length;
    const specs: BillboardSpec[] = [];
    const isMtn = (x: number, y: number): boolean =>
      x >= 0 &&
      y >= 0 &&
      x < cols &&
      y < rows &&
      map.decor[y][x] !== null &&
      isMountainDecorName(map.decor[y][x] as string);
    const used: boolean[][] = map.decor.map((row) => row.map(() => false));

    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const name = map.decor[y][x];
        if (name === null) continue;
        if (isMountainDecorName(name)) {
          if (used[y][x]) continue;
          if (
            isMtn(x + 1, y) &&
            isMtn(x, y + 1) &&
            isMtn(x + 1, y + 1) &&
            !used[y][x + 1] &&
            !used[y + 1][x] &&
            !used[y + 1][x + 1]
          ) {
            used[y][x] = used[y][x + 1] = used[y + 1][x] = used[y + 1][x + 1] = true;
            specs.push({
              wx: (x + 1) * TILE,
              wy: (y + 2) * TILE,
              frame: mountainBillboardFrame(name),
              worldWidth: WORLD_WIDTH_CLUSTER
            });
          } else {
            used[y][x] = true;
            specs.push({
              wx: (x + 0.5) * TILE,
              wy: (y + 1) * TILE,
              frame: mountainBillboardFrame(name),
              worldWidth: WORLD_WIDTH_MOUNTAIN
            });
          }
        } else if (BILLBOARD_FRAME[name] !== undefined) {
          specs.push({
            wx: (x + 0.5) * TILE,
            wy: (y + 1) * TILE,
            frame: BILLBOARD_FRAME[name],
            worldWidth: WORLD_WIDTH_BY_NAME[name] ?? WORLD_WIDTH_MOUNTAIN
          });
        }
      }
    }
    return specs;
  }

  private createBillboards(map: ZoneMap): void {
    for (const spec of this.collectBillboards(map)) {
      const img = this.scene.add
        .image(0, 0, BILLBOARD_TEXTURE_KEY, spec.frame)
        .setOrigin(0.5, 1)
        .setScrollFactor(0)
        .setVisible(false);
      this.billboards.push({ img, wx: spec.wx, wy: spec.wy, worldWidth: spec.worldWidth });
    }
  }

  /** Live-updates the tunable camera params (Mode7Tuner). Takes effect next
   *  `update()` call — every field is optional, so a caller can patch just
   *  the one the player is currently adjusting. */
  setOverrides(next: Mode7Overrides): void {
    this.overrides = next;
  }

  setBillboardHeightScale(scale: number): void {
    this.billboardHeightScale = scale;
  }

  /** Track the player: the camera looks north from just behind their position. */
  update(playerX: number, playerY: number): void {
    const { width, height } = this.scene.scale;
    const cam = makeCamera(playerX, playerY, width, height, this.overrides);
    this.shader.setUniform("uCamX.value", cam.x);
    this.shader.setUniform("uCamY.value", cam.y);
    this.shader.setUniform("uHorizon.value", cam.horizon);
    this.shader.setUniform("uFocal.value", cam.focal);
    this.shader.setUniform("uCamHeight.value", cam.height);
    this.shader.setUniform("uMaxDepth.value", cam.maxDepth);

    const frameW = MANIFEST.owBillboards?.frameWidth ?? 48;
    for (const b of this.billboards) {
      const s = worldToScreen(cam, b.wx, b.wy);
      if (s === null) {
        b.img.setVisible(false);
        continue;
      }
      const displayW = b.worldWidth * s.scale;
      const displayH = ((displayW * b.img.height) / frameW) * this.billboardHeightScale;
      // Lateral / below-screen culling (worldToScreen already culled depth).
      if (s.x + displayW / 2 < 0 || s.x - displayW / 2 > width || s.y - displayH > height) {
        b.img.setVisible(false);
        continue;
      }
      const depth01 = Math.min((cam.y - b.wy) / cam.maxDepth, 1);
      const haze = Math.pow(depth01, 0.7);
      const scaleX = displayW / frameW;
      b.img
        .setVisible(true)
        .setPosition(s.x, s.y)
        .setScale(scaleX, scaleX * this.billboardHeightScale) // origin (0.5,1): base stays planted, only the top compresses
        .setDepth(s.y) // painter's order: nearer (lower on screen) draws on top
        .setAlpha(1 - haze * 0.75)
        .setTint(hazeTint(haze * 0.8));
    }
  }

  /** Screen Y (top-origin px) of the horizon line, for placing the avatar. */
  get horizonY(): number {
    return makeCamera(0, 0, this.scene.scale.width, this.scene.scale.height, this.overrides).horizon;
  }

  destroy(): void {
    this.shader.destroy();
    for (const b of this.billboards) b.img.destroy();
    this.billboards.length = 0;
    if (this.scene.textures.exists(GROUND_TEXTURE_KEY)) {
      this.scene.textures.remove(GROUND_TEXTURE_KEY);
    }
  }
}
