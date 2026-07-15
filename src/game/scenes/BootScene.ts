/**
 * Loads the generated sprite sheets and tilesets, registers every manifest
 * animation, then shows the title menu (New Game / Continue from the
 * checkpoint save).
 */
import Phaser from "phaser";
import { MANIFEST, registerAnimations } from "../manifest";
import { PALETTE } from "../../shared/palette";
import { loadSavedState, resetGame, setState } from "../state";
import { TouchListButtons, isTouchDevice } from "../ui/touch";
import type { ZoneId } from "../../core/gameState";
import heroUrl from "../../assets/generated/hero.png";
import npcUrl from "../../assets/generated/npc.png";
import scarabUrl from "../../assets/generated/scarab.png";
import tilesUrl from "../../assets/generated/tiles.png";
import tiles2Url from "../../assets/generated/tiles2.png";
import tiles3Url from "../../assets/generated/tiles3.png";
import tiles4Url from "../../assets/generated/tiles4.png";
import tiles5Url from "../../assets/generated/tiles5.png";
import tiles6Url from "../../assets/generated/tiles6.png";
import tiles7Url from "../../assets/generated/tiles7.png";
import tiles8Url from "../../assets/generated/tiles8.png";
import rosaUrl from "../../assets/generated/rosa.png";
import piggyUrl from "../../assets/generated/piggy.png";
import jackrabbitUrl from "../../assets/generated/jackrabbit.png";
import buzzardUrl from "../../assets/generated/buzzard.png";
import gilaUrl from "../../assets/generated/gila.png";
import foremanUrl from "../../assets/generated/foreman.png";
import queenUrl from "../../assets/generated/queen.png";
import slitherUrl from "../../assets/generated/slither.png";
import minerUrl from "../../assets/generated/miner.png";
import fluffballUrl from "../../assets/generated/fluffball.png";
import icebatUrl from "../../assets/generated/icebat.png";
import crystalcrawlerUrl from "../../assets/generated/crystalcrawler.png";
import frostscarabUrl from "../../assets/generated/frostscarab.png";
import wardenUrl from "../../assets/generated/warden.png";
import johnUrl from "../../assets/generated/john.png";
import pamelaUrl from "../../assets/generated/pamela.png";
import chickenUrl from "../../assets/generated/chicken.png";
import bucketUrl from "../../assets/generated/bucket.png";
import spigotUrl from "../../assets/generated/spigot.png";
import anglerfishUrl from "../../assets/generated/anglerfish.png";
import reefeelUrl from "../../assets/generated/reefeel.png";
import lurkerUrl from "../../assets/generated/lurker.png";
import middenmiteUrl from "../../assets/generated/middenmite.png";
import sunwaspUrl from "../../assets/generated/sunwasp.png";
import reefstalkerUrl from "../../assets/generated/reefstalker.png";
import testudoUrl from "../../assets/generated/testudo.png";

const SHEET_URLS: Record<string, string> = {
  hero: heroUrl,
  npc: npcUrl,
  scarab: scarabUrl,
  rosa: rosaUrl,
  piggy: piggyUrl,
  jackrabbit: jackrabbitUrl,
  buzzard: buzzardUrl,
  gila: gilaUrl,
  foreman: foremanUrl,
  queen: queenUrl,
  slither: slitherUrl,
  miner: minerUrl,
  fluffball: fluffballUrl,
  icebat: icebatUrl,
  crystalcrawler: crystalcrawlerUrl,
  frostscarab: frostscarabUrl,
  warden: wardenUrl,
  john: johnUrl,
  pamela: pamelaUrl,
  chicken: chickenUrl,
  bucket: bucketUrl,
  spigot: spigotUrl,
  anglerfish: anglerfishUrl,
  reefeel: reefeelUrl,
  lurker: lurkerUrl,
  middenmite: middenmiteUrl,
  sunwasp: sunwaspUrl,
  reefstalker: reefstalkerUrl,
  testudo: testudoUrl
};

const ZONE_NAMES: Record<ZoneId, string> = {
  crash: "Highway 95",
  oasis: "The Homestead",
  trail: "The Piggy Trail",
  mine: "Cinnabar Mine",
  depths: "The Depths",
  crevasse: "The Crevasse",
  maze: "The Ice Maze",
  galleries: "The Galleries",
  sanctum: "The Sanctum",
  shed: "The Shed",
  overworld: "The Open Desert",
  mineEntrance: "Mine Entrance",
  sunlessSea: "The Sunless Sea",
  kelpForest: "The Kelp Forest",
  sunTemple: "The Sun-Temple Ruin",
  fluffballBed: "The Kelp Bed",
  deepBed: "The Deep Kelp Bed",
  seaAscent: "The Ascent",
  minersCamp: "The Camp Outskirts",
  campProper: "The Miners' Camp",
  laundryNook: "The Laundry Nook",
  campGallery: "The Back Gallery",
  campLedge: "The Overlook Ledge",
  groveDescent: "The Warm Descent",
  groveApproach: "The Grove Approach",
  groveGrotto: "The River Grotto",
  groveChamber: "The Sunlit Cave-In",
  sahraGrove: "Sahra's Grove",
  reefDescent: "The Drowned Stair",
  reefGarden: "The Crawlers' Garden",
  reefWarren: "The Coral Warren",
  reefHollow: "The Glowing Hollow",
  reefCourt: "The Crawler Court",
  pizzaDescent: "The Warm Deep",
  pizzaVent: "The Lava Vents",
  pizzaApproach: "The Old Kitchens",
  pizzeria: "La Pizzeria Sotterranea",
  pizzaAscent: "The Long Way Up"
};

export class BootScene extends Phaser.Scene {
  private menuTexts: Phaser.GameObjects.Text[] = [];
  private options: Array<{ label: string; action: () => void }> = [];
  private selected = 0;
  private started = false;
  private touchButtons: TouchListButtons | null = null;

  constructor() {
    super("boot");
  }

  preload(): void {
    for (const [key, sheet] of Object.entries(MANIFEST.sheets)) {
      const url = SHEET_URLS[key];
      if (!url) throw new Error(`No bundled URL for sheet "${key}"`);
      this.load.spritesheet(key, url, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      });
    }
    for (const [key, url] of [
      ["tiles", tilesUrl],
      ["tiles2", tiles2Url],
      ["tiles3", tiles3Url],
      ["tiles4", tiles4Url],
      ["tiles5", tiles5Url],
      ["tiles6", tiles6Url],
      ["tiles7", tiles7Url],
      ["tiles8", tiles8Url]
    ] as const) {
      this.load.spritesheet(key, url, { frameWidth: 16, frameHeight: 16 });
      this.load.image(`${key}-img`, url);
    }
  }

  create(): void {
    registerAnimations(this);
    const { width, height } = this.scale;
    this.menuTexts = [];
    this.selected = 0;
    this.started = false;

    this.add
      .text(width / 2, height / 2 - 52, "DESERT SECRETS", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: PALETTE.atbGold,
        stroke: PALETTE.ink,
        strokeThickness: 4
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, height / 2 - 32, "Save Piggy the penguin", {
        fontFamily: "monospace",
        fontSize: "9px",
        color: PALETTE.sand
      })
      .setOrigin(0.5);
    const piggy = this.add
      .sprite(width / 2, height / 2 - 4, "piggy", 0)
      .setScale(2);
    if (this.anims.exists("piggy-walk")) piggy.play("piggy-walk");

    const saved = loadSavedState();
    this.options = [];
    if (saved) {
      this.options.push({
        label: `CONTINUE — ${ZONE_NAMES[saved.zone] ?? saved.zone}`,
        action: () => {
          setState(this, saved);
          this.scene.start(saved.zone, {});
        }
      });
    }
    this.options.push({
      label: "NEW GAME",
      action: () => {
        resetGame(this);
        this.scene.start("crash", {});
      }
    });

    this.renderMenu(width, height);

    // NEW GAME permanently erases any saved progress, so this menu must
    // never confirm from an imprecise tap — a stray touch meant for
    // CONTINUE landing a few pixels off used to wipe the save instead.
    // Touch input is restricted to the same fixed-position ▲/✓/▼ column
    // used everywhere else (dialogue, perks, inventory, battle); there is
    // no tap-anywhere-confirms and no tap-a-row-confirms fallback here.
    this.touchButtons = isTouchDevice(this)
      ? new TouchListButtons(this, width - 8 - 22, height / 2 + 34 - 24, 22, 24)
      : null;

    const kb = this.input.keyboard!;
    kb.on("keydown-UP", () => this.move(-1));
    kb.on("keydown-DOWN", () => this.move(1));
    kb.on("keydown-SPACE", () => this.confirm());
    kb.on("keydown-ENTER", () => this.confirm());
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (!this.touchButtons) return;
      const hit = this.touchButtons.hitTest(p.x, p.y);
      if (hit === "up") this.move(-1);
      else if (hit === "down") this.move(1);
      else if (hit === "confirm") this.confirm();
    });
  }

  private renderMenu(width: number, height: number): void {
    this.menuTexts.forEach((t) => t.destroy());
    this.menuTexts = this.options.map((opt, i) =>
      this.add
        .text(width / 2, height / 2 + 34 + i * 16, `${i === this.selected ? "▸ " : "  "}${opt.label}`, {
          fontFamily: "monospace",
          fontSize: "10px",
          color: i === this.selected ? PALETTE.atbGold : PALETTE.bone
        })
        .setOrigin(0.5)
    );
  }

  private move(delta: number): void {
    if (this.started) return;
    this.selected = (this.selected + delta + this.options.length) % this.options.length;
    this.renderMenu(this.scale.width, this.scale.height);
  }

  private confirm(): void {
    if (this.started) return;
    this.started = true;
    this.cameras.main.fadeOut(300);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.options[this.selected].action();
    });
  }
}
