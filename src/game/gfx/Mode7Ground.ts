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
 * WebGL-only. The caller is responsible for falling back to the flat tilemap
 * if construction throws (no WebGL, texture/shader failure).
 */
import Phaser from "phaser";
import { MANIFEST } from "../manifest";
import { TILE } from "../ZoneScene";
import type { ZoneMap } from "../maps/types";
import { PALETTE, hexToRgb } from "../../shared/palette";
import {
  MODE7_CAMERA_HEIGHT,
  MODE7_FOCAL_LENGTH,
  MODE7_MAX_DEPTH,
  makeCamera
} from "../../core/mode7";

const GROUND_TEXTURE_KEY = "overworld-mode7-ground";

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
  return { key: "tiles3", frame: MANIFEST.tiles3.names[name] };
}

export class Mode7Ground {
  private readonly scene: Phaser.Scene;
  private readonly shader: Phaser.GameObjects.Shader;
  private readonly mapWidthPx: number;
  private readonly mapHeightPx: number;

  constructor(scene: Phaser.Scene, map: ZoneMap, depth: number) {
    this.scene = scene;
    const rows = map.ground.length;
    const cols = map.ground[0].length;
    this.mapWidthPx = cols * TILE;
    this.mapHeightPx = rows * TILE;

    this.paintGroundTexture(map, cols, rows);

    const { width, height } = scene.scale;
    const cam = makeCamera(0, 0, width, height);

    const baseShader = new Phaser.Display.BaseShader("mode7-ground", FRAGMENT_SRC, undefined, {
      uCamX: { type: "1f", value: 0 },
      uCamY: { type: "1f", value: 0 },
      uHorizon: { type: "1f", value: cam.horizon },
      uFocal: { type: "1f", value: MODE7_FOCAL_LENGTH },
      uCamHeight: { type: "1f", value: MODE7_CAMERA_HEIGHT },
      uMaxDepth: { type: "1f", value: MODE7_MAX_DEPTH },
      uMapSize: { type: "2f", value: { x: this.mapWidthPx, y: this.mapHeightPx } },
      uSkyTop: { type: "3f", value: rgbVec("indigo") },
      uSkyHorizon: { type: "3f", value: rgbVec("amber") },
      uGroundHaze: { type: "3f", value: rgbVec("amber") },
      uRidge: { type: "3f", value: rgbVec("mauve") }
    });

    // No flip: the canvas is uploaded top-row-first, so texture v=0 is the map
    // north (tile row 0), matching uv.v = wy / mapHeight in the shader (north =
    // small world y = into the distance). Clamp so sampling past an edge holds
    // the border mountains (NPOT-safe: REPEAT on the non-power-of-two height
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
        if (decorName !== null) {
          const d = tileFrame(decorName);
          canvas.drawFrame(d.key, d.frame, x * TILE, y * TILE, false);
        }
      }
    }
    canvas.refresh();
  }

  /** Track the player: the camera looks north from just behind their position. */
  update(playerX: number, playerY: number): void {
    const { width, height } = this.scene.scale;
    const cam = makeCamera(playerX, playerY, width, height);
    this.shader.setUniform("uCamX.value", cam.x);
    this.shader.setUniform("uCamY.value", cam.y);
    this.shader.setUniform("uHorizon.value", cam.horizon);
  }

  /** Screen Y (top-origin px) of the horizon line, for placing the avatar. */
  get horizonY(): number {
    return makeCamera(0, 0, this.scene.scale.width, this.scene.scale.height).horizon;
  }

  destroy(): void {
    this.shader.destroy();
    if (this.scene.textures.exists(GROUND_TEXTURE_KEY)) {
      this.scene.textures.remove(GROUND_TEXTURE_KEY);
    }
  }
}
