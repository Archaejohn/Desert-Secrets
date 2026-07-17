/**
 * Act 6, Zone 4 — The Glowing Hollow. A quiet connecting cavern past the coral
 * warren: a still bioluminescent pool and a cold reef channel with a
 * stepping-stone crossing, the crawlers' mint-kelp beds running down toward
 * their elders. A breather beat between the tense chase and the diplomacy. Two
 * gates (north back to the warren, south on to the court); no random encounters.
 * Both follower rigs pumped.
 */
import { ZoneScene, type ZoneConfig } from "../ZoneScene";
import {
  buildReefHollowMap,
  REEF_H_ENTRY_TRIGGER,
  REEF_H_EXIT_NORTH,
  REEF_H_EXIT_SOUTH,
  REEF_H_SPAWN
} from "../maps/reefHollowMap";
import { REEF_W_RETURN_SPAWN } from "../maps/reefWarrenMap";
import { REEF_C_SPAWN } from "../maps/reefCourtMap";
import { reefHollowEntryScript } from "../../core/scripts/reefHollowEntry";
import { SlitherFollower } from "../SlitherFollower";
import { FluffballFollower } from "../FluffballFollower";
import { getState, setState } from "../state";
import { PALETTE, hexToInt } from "../../shared/palette";
import { LightMask } from "../gfx/LightMask";
import { setupZoneLighting } from "../gfx/zoneLighting";

export class ReefHollowScene extends ZoneScene {
  private slither = new SlitherFollower(this);
  private fluffball = new FluffballFollower(this);
  private lightMask: LightMask | null = null;

  constructor() {
    super("reefHollow");
  }

  protected config(): ZoneConfig {
    return {
      zoneId: "reefHollow",
      zoneName: "The Glowing Hollow",
      map: buildReefHollowMap(),
      defaultSpawn: REEF_H_SPAWN,
      battleBg: "ice"
    };
  }

  protected populate(): void {
    this.slither = new SlitherFollower(this);
    this.fluffball = new FluffballFollower(this);
    if (getState(this).flags.slitherJoined) this.slither.spawn(this.player.x, this.player.y);
    if (getState(this).flags.fluffballJoined) this.fluffball.spawn(this.player.x, this.player.y);

    this.animateTilePair("reefWater", "reefWater2");

    this.addExit({ ...REEF_H_EXIT_NORTH }, "reefWarren", REEF_W_RETURN_SPAWN);
    this.addExit({ ...REEF_H_EXIT_SOUTH }, "reefCourt", REEF_C_SPAWN);

    if (!getState(this).flags.sawReefHollow) {
      this.addTrigger({ ...REEF_H_ENTRY_TRIGGER }, () => {
        if (getState(this).flags.sawReefHollow) return;
        this.openScript(reefHollowEntryScript, () => {
          const s = getState(this);
          setState(this, { ...s, flags: { ...s.flags, sawReefHollow: true } });
          this.hud.update(getState(this));
        });
      });
    }

    this.setupGlowLighting();
  }

  /**
   * Lit only by the kelp's own glow: a bioluminescent ambient dark the party's
   * lamp reveals, plus a soft green breathe on every glow-moss bed so the
   * hollow reads as a still, self-lit cavern. Kept navigable — the lamp is
   * generous and the moss glows do most of the work.
   */
  private setupGlowLighting(): void {
    this.lightMask = setupZoneLighting(this, {
      base: { color: hexToInt(PALETTE.ink), alpha: 0.5 },
      follow: this.player,
      followRadius: 110,
      followIntensity: 0.82,
      green: this.tileCentersNamed("glowMoss"),
      greenIntensity: 0.6
    });
  }

  protected onUpdate(): void {
    this.lightMask?.update();
    this.slither.update(this.player.x, this.player.y);
    this.fluffball.update(this.player.x, this.player.y);
  }
}
