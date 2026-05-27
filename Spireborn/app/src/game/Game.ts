// 메인 게임 컨트롤러. 루프 + 상태 머신.
// 흐름: title → (룰렛으로 메인 스킬 결정) → fighting → boss → bossfire (화톳불) → bonfire (정비) → 다음 층
import type { ItemInstance, MetaState, RunState } from '../types';
import { World } from './World';
import { Renderer } from '../render/Renderer';
import { Joystick } from '../input/Joystick';
import { Hud } from '../ui/Hud';
import { Overlay } from '../ui/Overlay';
import { defaultMetaState, defaultPlayerStats } from '../types';
import {
  clearRun,
  loadMeta,
  loadRun,
  RUN_STATE_VERSION,
  saveMeta,
  saveRun,
} from '../save/Storage';
import { RNG, randomSeed } from '../util/rng';
import { defaultSkillInstance, rollItemRandomSlot } from './shop';

// 전투/이동이 일어나는 phase — 저장 정책에 사용
function isActivePhase(phase: RunState['phase']): boolean {
  return phase === 'fighting' || phase === 'boss' || phase === 'bossfire';
}

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
  private currentItemRewards: ItemInstance[] = [];
  // 화톳불 NPC 와 인접했을 때 표시되는 외부 프롬프트
  private bonfirePrompt: HTMLElement;
  private bonfirePromptVisible = false;

  constructor() {
    const canvas = document.getElementById('game') as HTMLCanvasElement;
    const hudEl = document.getElementById('hud') as HTMLElement;
    const overlayEl = document.getElementById('overlay') as HTMLElement;
    const joyEl = document.getElementById('joystick') as HTMLElement;
    this.bonfirePrompt = document.getElementById('bonfire-prompt') as HTMLElement;

    this.renderer = new Renderer(canvas);
    this.joystick = new Joystick(joyEl);
    this.hud = new Hud(hudEl);
    this.overlay = new Overlay(overlayEl);

    window.addEventListener('resize', () => this.renderer.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.world && isActivePhase(this.world.run.phase)) {
        saveRun(this.world.run);
      }
    });
    // 키보드 상호작용 — E / Space / Enter
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key;
      if (k === 'e' || k === 'E' || k === ' ' || k === 'Enter') {
        this.tryInteract();
      }
    });
    // 외부 프롬프트 버튼 클릭 (터치/마우스)
    this.bonfirePrompt.addEventListener('click', (e) => {
      e.stopPropagation();
      this.tryInteract();
    });

    this.renderer.resize();
    this.meta = loadMeta();
  }

  private tryInteract(): void {
    if (!this.world) return;
    if (this.world.run.phase !== 'bossfire') return;
    if (!this.world.npcInRange) return;
    this.world.queueInteract();
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
      mainSkill: defaultSkillInstance(mainSkillId),
      supports: [],
      items: [],
      credits: 0,
      killsTotal: 0,
      timeAliveSec: 0,
      floorElapsedSec: 0,
      floorCreditsEarned: 0,
    };
    this.loadIntoWorld(run);
  }

  private loadIntoWorld(run: RunState): void {
    this.world = new World(run, {
      onPlayerHurt: () => {},
      onBossDefeated: () => this.handleBossDefeated(),
      onBonfireOpened: () => this.handleBonfireOpened(),
      onPlayerDead: () => this.handleDead(),
    });
    this.world.setView(this.renderer.viewW, this.renderer.viewH);
    this.overlay.hide();
    saveRun(run);
  }

  // 보스 처치 시점에 호출. phase는 World가 이미 'bossfire'로 전환.
  private handleBossDefeated(): void {
    if (!this.world) return;
    // 보스 드랍 — 항상 ItemInstance 2 개 후보. 슬롯은 균등 추첨, 모드는 affix 풀에서 굴림.
    const rng = new RNG(randomSeed());
    const floor = this.world.run.floor;
    this.currentItemRewards = [
      rollItemRandomSlot(floor, rng),
      rollItemRandomSlot(floor, rng),
    ];
    saveRun(this.world.run);
  }

  // NPC 와 상호작용해 정비 UI 진입.
  private handleBonfireOpened(): void {
    if (!this.world) return;
    const w = this.world;
    w.paused = true;
    saveRun(w.run);
    this.overlay.showMaintenance({
      run: w.run,
      itemRewards: this.currentItemRewards,
      autoPickup: {
        getInfo: () => ({
          remainingValue: w.remainingOrbValue(),
          remainingCount: w.remainingOrbCount(),
        }),
        collect: () => w.autoCollectOrbs(),
      },
      onChange: () => {
        w.rebuild();
        w.run.playerHp = Math.min(w.run.playerHp, w.build.player.maxHp);
        saveRun(w.run);
      },
      onContinue: () => {
        // 다음 층으로
        w.run.floor += 1;
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

      if (isActivePhase(this.world.run.phase)) {
        this.saveAccum += dt;
        if (this.saveAccum >= 2) {
          this.saveAccum = 0;
          saveRun(this.world.run);
        }
      }

      // 화톳불 프롬프트 — bossfire phase + NPC 인접 시에만 표시
      const showPrompt =
        this.world.run.phase === 'bossfire' && this.world.npcInRange;
      if (showPrompt !== this.bonfirePromptVisible) {
        this.bonfirePromptVisible = showPrompt;
        this.bonfirePrompt.classList.toggle('hidden', !showPrompt);
      }

      this.renderer.render(this.world);
      this.hud.update(this.world);
    } else {
      if (this.bonfirePromptVisible) {
        this.bonfirePromptVisible = false;
        this.bonfirePrompt.classList.add('hidden');
      }
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
