// 메인 게임 컨트롤러. 루프 + 상태 머신.
// 흐름: title → (룰렛으로 메인 스킬 결정) → fighting → cleared → levelup → maintenance → 다음 층
import type { RunState, MetaState } from '../types';
import { World } from './World';
import { Renderer } from '../render/Renderer';
import { Joystick } from '../input/Joystick';
import { Hud } from '../ui/Hud';
import { Overlay, pickItemRewards, newSupportInstance } from '../ui/Overlay';
import { defaultMetaState, defaultPlayerStats } from '../types';
import {
  clearRun,
  loadMeta,
  loadRun,
  RUN_STATE_VERSION,
  saveMeta,
  saveRun,
} from '../save/Storage';
import { randomSeed } from '../util/rng';

export class Game {
  private renderer: Renderer;
  private joystick: Joystick;
  private hud: Hud;
  private overlay: Overlay;
  private world: World | null = null;
  private meta: MetaState = defaultMetaState();
  private rafId = 0;
  private lastT = 0;
  private saveAccum = 0;
  // 현재 정비 화면에서 제안된 아이템 (한 번만 보여주려고 보관)
  private currentItemRewards: string[] = [];

  constructor() {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const hudEl = document.getElementById('hud') as HTMLElement;
    const overlayEl = document.getElementById('overlay') as HTMLElement;
    const joyEl = document.getElementById('joystick') as HTMLElement;

    this.renderer = new Renderer(canvas);
    this.joystick = new Joystick(joyEl);
    this.hud = new Hud(hudEl);
    this.overlay = new Overlay(overlayEl);

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.world && this.world.run.phase === 'fighting') {
        saveRun(this.world.run);
      }
    });

    this.renderer.resize();
    this.meta = loadMeta();
  }

  start(): void {
    this.showTitle();
    this.lastT = performance.now();
    this.tick();
  }

  private showTitle(): void {
    this.world = null;
    const saved = loadRun();
    this.overlay.showTitle({
      meta: this.meta,
      hasSave: !!saved,
      onSpinRoulette: (onPicked) => this.overlay.runRoulette(onPicked),
      onNew: (skillId) => this.startNewRun(skillId),
      onContinue: () => {
        if (saved) this.loadIntoWorld(saved);
      },
    });
  }

  private startNewRun(mainSkillId: string): void {
    clearRun();
    const run: RunState = {
      version: RUN_STATE_VERSION,
      seed: randomSeed(),
      floor: 1,
      phase: 'fighting',
      playerHp: defaultPlayerStats().maxHp,
      mainSkillId,
      supports: [],
      itemIds: [],
      credits: 0,
      killsTotal: 0,
      timeAliveSec: 0,
      floorElapsedSec: 0,
    };
    this.loadIntoWorld(run);
  }

  private loadIntoWorld(run: RunState): void {
    this.world = new World(run, {
      onPlayerHurt: () => {},
      onFloorCleared: () => this.handleFloorCleared(),
      onPlayerDead: () => this.handleDead(),
    });
    this.world.setView(this.renderer.viewW, this.renderer.viewH);
    this.overlay.hide();
    saveRun(run);
  }

  // 층 클리어 시: 서포트 젬 1택 → 정비 → 다음 층
  private handleFloorCleared(): void {
    if (!this.world) return;
    const w = this.world;
    // 클리어 보너스 크레딧
    w.run.credits += w.floorSpec.creditClearBonus;
    w.run.phase = 'levelup';
    w.paused = true;
    saveRun(w.run);

    this.overlay.showLevelUp({
      run: w.run,
      onPick: (defId) => {
        if (defId) {
          if (!w.run.supports.find((s) => s.defId === defId)) {
            w.run.supports.push(newSupportInstance(defId));
          }
          w.rebuild();
          w.run.playerHp = Math.min(w.run.playerHp, w.build.player.maxHp);
        }
        // 아이템 보상 후보 결정
        this.currentItemRewards =
          Math.random() < w.floorSpec.itemRewardChance ? pickItemRewards() : [];
        w.run.phase = 'maintenance';
        saveRun(w.run);
        this.showMaintenance();
      },
    });
  }

  private showMaintenance(): void {
    if (!this.world) return;
    const w = this.world;
    this.overlay.showMaintenance({
      run: w.run,
      itemRewardIds: this.currentItemRewards,
      onChange: () => {
        w.rebuild();
        w.run.playerHp = Math.min(w.run.playerHp, w.build.player.maxHp);
        saveRun(w.run);
      },
      onContinue: () => {
        // 다음 층으로
        w.run.floor += 1;
        w.run.phase = 'fighting';
        // 회복: 다음 층 시작 시 최대 체력의 30% 회복 (영구 강화 아님)
        w.run.playerHp = Math.min(
          w.build.player.maxHp,
          w.run.playerHp + w.build.player.maxHp * 0.3,
        );
        w.startFloor();
        w.paused = false;
        this.overlay.hide();
        saveRun(w.run);
      },
    });
  }

  private handleDead(): void {
    if (!this.world) return;
    const w = this.world;
    let isNewRecord = false;
    if (w.run.floor > this.meta.highestFloor) {
      this.meta.highestFloor = w.run.floor;
      isNewRecord = true;
    }
    if (w.run.timeAliveSec > this.meta.longestSurvivalSec) {
      this.meta.longestSurvivalSec = w.run.timeAliveSec;
    }
    this.meta.runsPlayed += 1;
    saveMeta(this.meta);
    clearRun();
    this.overlay.showGameOver({
      run: w.run,
      meta: this.meta,
      isNewRecord,
      onRestart: () => {
        this.showTitle();
      },
    });
  }

  private tick = (): void => {
    this.rafId = requestAnimationFrame(this.tick);
    const now = performance.now();
    const rawDt = (now - this.lastT) / 1000;
    this.lastT = now;
    const dt = Math.min(rawDt, 1 / 30);

    if (this.world) {
      this.world.setView(this.renderer.viewW, this.renderer.viewH);
      const dir = this.joystick.getDirection();
      this.world.setInput(dir.x, dir.y);
      this.world.update(dt);

      if (this.world.run.phase === 'fighting') {
        this.saveAccum += dt;
        if (this.saveAccum >= 2) {
          this.saveAccum = 0;
          saveRun(this.world.run);
        }
      }

      this.renderer.render(this.world);
      this.hud.update(this.world);
    } else {
      const ctx = this.renderer.ctx;
      ctx.setTransform(this.renderer.dpr, 0, 0, this.renderer.dpr, 0, 0);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, this.renderer.viewW * this.renderer.zoom, this.renderer.viewH * this.renderer.zoom);
    }
  };

  stop(): void {
    cancelAnimationFrame(this.rafId);
  }
}
