// Canvas 2D 렌더러.
// 화면 좌표계 = (월드 좌표 - 카메라) × zoom + 화면 중앙.
import { World } from '../game/World';
import { getSkill } from '../data/skills';

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  dpr = 1;
  // 월드 → 화면 줌. 큰 값일수록 더 가까이 보임(공간이 좁아 보임).
  zoom = 1.6;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2D context');
    this.ctx = ctx;
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    // 작은 화면에선 아레나가 안 잘리도록 줌을 약간 줄임
    const minSide = Math.min(w, h);
    if (minSide < 420) this.zoom = 1.3;
    else if (minSide < 640) this.zoom = 1.5;
    else this.zoom = 1.7;
  }

  // 월드 단위 가시 폭/높이 (스폰 거리 계산용)
  get viewW(): number {
    return this.canvas.width / this.dpr / this.zoom;
  }

  get viewH(): number {
    return this.canvas.height / this.dpr / this.zoom;
  }

  render(world: World): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, cw, ch);

    // 월드 변환: 화면 중앙으로 평행이동, 줌, 카메라(=월드 중심) 오프셋
    const screenW = cw / this.dpr;
    const screenH = ch / this.dpr;
    ctx.setTransform(
      this.dpr * this.zoom,
      0,
      0,
      this.dpr * this.zoom,
      Math.floor(screenW / 2) * this.dpr,
      Math.floor(screenH / 2) * this.dpr,
    );
    // 카메라는 (0,0) 고정 — 추가 평행이동 불필요

    // 아레나 외곽 (월드 좌표 기준)
    this.drawArena(world);

    // 크레딧 오브 — 금색
    world.creditOrbs.forEachActive((o) => {
      ctx.fillStyle = '#ffd86b';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4, 0, Math.PI * 2);
      ctx.fill();
      // 살짝 광택
      ctx.strokeStyle = '#fff4c2';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // 적
    world.enemies.forEachActive((e) => {
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.def.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.def.radius, 0, Math.PI * 2);
      ctx.fill();
      // 점화 표시
      if (e.igniteTime > 0) {
        ctx.strokeStyle = '#ff8c44';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.def.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 체력 바 (잡몹은 다친 경우만, 보스는 항상)
      if (e.def.id === 'boss' || e.hp < e.maxHp) {
        const bw = Math.max(16, e.def.radius * 2.2);
        const bh = 3;
        const bx = e.x - bw / 2;
        const by = e.y - e.def.radius - 6;
        ctx.fillStyle = 'rgba(0,0,0,0.66)';
        ctx.fillRect(bx, by, bw, bh);
        ctx.fillStyle = e.def.id === 'boss' ? '#ff5577' : '#ff9b9b';
        ctx.fillRect(bx, by, bw * Math.max(0, e.hp / e.maxHp), bh);
      }
    });

    // 회전 칼날
    const def = getSkill(world.run.mainSkillId);
    if (def.cast.kind === 'orbit') {
      const s = world.build.skill;
      const orbitR = def.cast.orbitRadius * s.areaMul;
      const bladeR = def.baseArea * s.areaMul;
      ctx.fillStyle = def.color;
      world.orbits.forEachActive((b) => {
        const bx = world.player.x + Math.cos(b.angle) * orbitR;
        const by = world.player.y + Math.sin(b.angle) * orbitR;
        ctx.beginPath();
        ctx.arc(bx, by, bladeR, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // 투사체
    world.projectiles.forEachActive((p) => {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      // 트레일 (약하게)
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(p.x - p.vx * 0.015, p.y - p.vy * 0.015, p.radius * 0.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    // VFX (폭발/오라 펄스)
    world.vfx.forEachActive((v) => {
      const a = Math.max(0, v.life / v.maxLife);
      ctx.strokeStyle = v.color;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // 플레이어
    {
      const blink = world.player.invuln > 0 && Math.floor(world.player.invuln * 16) % 2 === 0;
      ctx.fillStyle = blink ? '#ffffff' : '#ffd486';
      ctx.beginPath();
      ctx.arc(world.player.x, world.player.y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#332218';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 부유 텍스트 — 줌이 적용된 좌표계에 맞춰 폰트도 작게
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    world.texts.forEachActive((t) => {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    });
  }

  // 아레나: 외곽 링 + 살짝 그라데이션
  private drawArena(world: World): void {
    const ctx = this.ctx;
    const R = world.arenaR;
    // 내부 그라데이션
    const grad = ctx.createRadialGradient(0, 0, R * 0.5, 0, 0, R);
    grad.addColorStop(0, 'rgba(40, 40, 60, 0.15)');
    grad.addColorStop(1, 'rgba(80, 60, 100, 0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // 외곽선
    ctx.strokeStyle = 'rgba(180, 140, 240, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    // 글로우
    ctx.strokeStyle = 'rgba(180, 140, 240, 0.12)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, R - 2, 0, Math.PI * 2);
    ctx.stroke();
  }
}
