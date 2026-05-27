// HUD: 체력, 크레딧, 층, 남은 시간, 킬 수.
// 모바일 친화 — 한 줄에 정보 4개 대신 카드형 칩으로 묶고,
// 작은 화면에서는 자동으로 줄바꿈된다.
import { World } from '../game/World';

export class Hud {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-row hud-hp-row">
        <div class="bar hp">
          <div class="fill" data-hp></div>
          <div class="bar-text" data-hp-text>0 / 0</div>
        </div>
      </div>
      <div class="hud-row hud-chip-row">
        <div class="hud-chip floor-chip">
          <span class="chip-icon" aria-hidden="true">▲</span>
          <span class="chip-value" data-floor>1</span>
        </div>
        <div class="hud-chip timer-chip">
          <span class="chip-icon" aria-hidden="true">⏱</span>
          <span class="chip-value" data-timer>0:00</span>
        </div>
        <div class="hud-chip credit-chip">
          <span class="chip-icon" aria-hidden="true">◆</span>
          <span class="chip-value" data-credits>0</span>
        </div>
        <div class="hud-chip kill-chip">
          <span class="chip-icon" aria-hidden="true">⚔</span>
          <span class="chip-value" data-kills>0</span>
        </div>
      </div>
    `;
  }

  update(world: World): void {
    const ps = world.build.player;
    const hpPct = Math.max(0, Math.min(1, world.run.playerHp / ps.maxHp));
    this.set('[data-hp]', hpPct * 100, '%');
    this.text('[data-hp-text]', `${Math.max(0, Math.round(world.run.playerHp))} / ${Math.round(ps.maxHp)}`);
    this.text('[data-floor]', `${world.run.floor}`);

    const phase = world.run.phase;
    const timerEl = this.root.querySelector('.timer-chip') as HTMLElement | null;
    let timerText: string;
    let timerClass = '';
    if (phase === 'boss') {
      timerText = '보스';
      timerClass = 'boss';
    } else if (phase === 'bossfire') {
      timerText = '화톳불';
      timerClass = 'fire';
    } else {
      const sec = Math.max(
        0,
        world.floorSpec.durationSec - world.run.floorElapsedSec,
      );
      const mm = Math.floor(sec / 60);
      const ss = Math.floor(sec % 60).toString().padStart(2, '0');
      timerText = `${mm}:${ss}`;
      if (sec <= 5) timerClass = 'critical';
    }
    this.text('[data-timer]', timerText);
    if (timerEl) {
      timerEl.classList.remove('boss', 'fire', 'critical');
      if (timerClass) timerEl.classList.add(timerClass);
    }
    this.text('[data-credits]', `${world.run.credits}`);
    this.text('[data-kills]', `${world.run.killsTotal}`);
  }

  private set(sel: string, value: number, unit: string): void {
    const el = this.root.querySelector(sel) as HTMLElement | null;
    if (el) el.style.width = `${value}${unit}`;
  }

  private text(sel: string, t: string): void {
    const el = this.root.querySelector(sel) as HTMLElement | null;
    if (el && el.textContent !== t) el.textContent = t;
  }
}
