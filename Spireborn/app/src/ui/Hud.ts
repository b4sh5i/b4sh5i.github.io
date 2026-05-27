// HUD: 체력, 크레딧, 층, 남은 시간, 킬 수.
import { World } from '../game/World';

export class Hud {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    root.innerHTML = `
      <div class="hud-row">
        <div class="hud-label">HP</div>
        <div class="bar hp"><div class="fill" data-hp></div></div>
        <div class="hud-label" data-hp-text>0/0</div>
      </div>
      <div class="hud-row">
        <div class="hud-label" data-floor>층 1</div>
        <div class="hud-label" data-timer>00:00</div>
        <div class="hud-label credit-badge" data-credits>0c</div>
        <div class="hud-label" data-kills>0킬</div>
      </div>
    `;
  }

  update(world: World): void {
    const ps = world.build.player;
    const hpPct = Math.max(0, Math.min(1, world.run.playerHp / ps.maxHp));
    this.set('[data-hp]', hpPct * 100, '%');
    this.text('[data-hp-text]', `${Math.max(0, Math.round(world.run.playerHp))}/${Math.round(ps.maxHp)}`);
    this.text('[data-floor]', `층 ${world.run.floor}`);
    // phase 에 따라 타이머 자리에 다른 정보 표시
    const phase = world.run.phase;
    let timerText: string;
    if (phase === 'boss') {
      timerText = '★ 보스 ★';
    } else if (phase === 'bossfire') {
      timerText = '화톳불';
    } else {
      const sec = Math.max(
        0,
        world.floorSpec.durationSec - world.run.floorElapsedSec,
      );
      const mm = Math.floor(sec / 60);
      const ss = Math.floor(sec % 60).toString().padStart(2, '0');
      timerText = `${mm}:${ss}`;
    }
    this.text('[data-timer]', timerText);
    this.text('[data-credits]', `${world.run.credits}c`);
    this.text('[data-kills]', `${world.run.killsTotal}킬`);
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
