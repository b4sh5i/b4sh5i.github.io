// Canvas 2D 렌더러 — 다크 판타지 ARPG 톤 (디아블로 + PoE 짬뽕).
// 카메라는 항상 플레이어를 중심에 둔다. 화면 좌표 = (월드 - 카메라) * zoom + 화면중앙.
import { World } from '../game/World';
import { getSkill } from '../data/skills';

// 색상 해시 — glow 캐시 키용 (정수 한 개로 충분)
function colorHash(c: string): string {
  return c;
}

// 결정적 의사난수 — 위상/위치에서 안정된 형태 변형이 나오게.
function hashSin(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export class Renderer {
  ctx: CanvasRenderingContext2D;
  canvas: HTMLCanvasElement;
  dpr = 1;
  // 월드 → 화면 줌. 모바일에서 캐릭터를 또렷이 보여주려고 살짝 크게.
  zoom = 1.8;

  // 캐시 — 매 프레임 새로 만들지 않도록
  private ground: HTMLCanvasElement | null = null;
  private arenaRing: HTMLCanvasElement | null = null;
  private arenaRingR = 0;
  private glowCache = new Map<string, HTMLCanvasElement>();
  private playerShadow: HTMLCanvasElement | null = null;

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
    // 화면 크기에 따라 줌 — 작아도 캐릭터는 충분히 크게 보이도록
    const minSide = Math.min(w, h);
    if (minSide < 380) this.zoom = 1.6;
    else if (minSide < 600) this.zoom = 1.9;
    else this.zoom = 2.2;
  }

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
    const screenW = cw / this.dpr;
    const screenH = ch / this.dpr;

    // 1) 배경 클리어 (스크린 공간)
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#050306';
    ctx.fillRect(0, 0, screenW, screenH);

    // 2) 월드 변환 — 카메라(=플레이어 위치) 가 화면 중앙으로 + 셰이크 오프셋
    const cx = world.cameraX + world.cameraOffsetX;
    const cy = world.cameraY + world.cameraOffsetY;
    const tx = Math.floor(screenW / 2) - cx * this.zoom;
    const ty = Math.floor(screenH / 2) - cy * this.zoom;
    ctx.setTransform(
      this.dpr * this.zoom,
      0,
      0,
      this.dpr * this.zoom,
      tx * this.dpr,
      ty * this.dpr,
    );

    // 3) 돌 바닥 (월드 공간 패턴, 카메라 따라 스크롤)
    this.drawGround(world);

    // 4) 아레나 외곽 — 룬 새겨진 석조 링
    this.drawArena(world);

    // 5) 크레딧 오브 — 황금 보석
    world.creditOrbs.forEachActive((o) => {
      this.drawGlow(o.x, o.y, 10, '#ffd86b', 0.55);
      ctx.fillStyle = '#ffe8a2';
      ctx.beginPath();
      ctx.arc(o.x, o.y, 3.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b07e1a';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    });

    // 6) 적
    world.enemies.forEachActive((e) => {
      this.drawEnemy(e);
    });

    // 6.5) 화톳불 + NPC (보스 처치 후 표시) — 적 아래, 투사체 위
    if (world.bonfire) this.drawBonfire(world.bonfire);
    if (world.npc) this.drawNpc(world.npc, world.npcInRange);

    // 7) 회전 칼날 — 빛나는 검신
    const def = getSkill(world.run.mainSkill.defId);
    if (def.cast.kind === 'orbit') {
      const s = world.build.skill;
      const orbitR = def.cast.orbitRadius * s.areaMul;
      const bladeR = def.baseArea * s.areaMul;
      world.orbits.forEachActive((b) => {
        const bx = world.player.x + Math.cos(b.angle) * orbitR;
        const by = world.player.y + Math.sin(b.angle) * orbitR;
        this.drawBlade(bx, by, b.angle, bladeR, def.color);
      });
    }

    // 8) 투사체 — 타입별 분기 (fire/cold/lightning/physical)
    const projTime = performance.now() / 1000;
    world.projectiles.forEachActive((p) => {
      this.drawProjectile(p, projTime);
    });

    // 9) VFX — kind & damageType 별 분기
    world.vfx.forEachActive((v) => {
      const a = Math.max(0, v.life / v.maxLife);
      if (v.kind === 'arc') {
        this.drawArcVfx(v, a);
      } else if (v.kind === 'muzzle') {
        this.drawMuzzleVfx(v, a);
      } else if (v.kind === 'rune') {
        this.drawRuneVfx(v, a);
      } else if (v.kind === 'flash') {
        // 화면 전체 페이드 — render() 의 마지막 단계에서 스크린 공간으로 그림.
        // 여기선 패스.
      } else {
        this.drawRingVfx(v, a);
      }
    });

    // 9.5) 파티클 — 스파크/글로우. 가산 합성으로 화려하게.
    ctx.globalCompositeOperation = 'lighter';
    world.particles.forEachActive((p) => {
      const a = Math.max(0, p.life / p.maxLife);
      if (p.kind === 'glow') {
        // 빠르게 페이드 아웃하는 큰 글로우
        this.drawGlow(p.x, p.y, p.size, p.color, 0.8 * a);
      } else {
        // 점 스파크 — 진행 방향 짧은 꼬리
        const trailLen = 0.025;
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * trailLen, p.y - p.vy * trailLen);
        ctx.stroke();
        ctx.lineCap = 'butt';
        ctx.globalAlpha = 1;
      }
    });
    ctx.globalCompositeOperation = 'source-over';

    // 10) 플레이어 — 갑옷 입은 영웅
    this.drawPlayer(world);

    // 11) 부유 텍스트 — 데미지가 클수록 크게 보인다
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    world.texts.forEachActive((t) => {
      const a = Math.max(0, t.life / t.maxLife);
      // 등장 시 살짝 팝 — life 초반 0~20%에서 1.0→1.25 사이 펄스
      const lifeT = t.life / t.maxLife;
      const popK = lifeT > 0.8 ? 1 + (lifeT - 0.8) * 1.4 : 1;
      ctx.font = `700 ${Math.round(t.size * popK)}px "Times New Roman", serif`;
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = Math.max(2.5, t.size * 0.28);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    });

    // 12) 스크린 공간 비네팅 — 캐릭터 주변만 밝게
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const vx = screenW / 2;
    const vy = screenH / 2;
    const r1 = Math.min(screenW, screenH) * 0.28;
    const r2 = Math.max(screenW, screenH) * 0.78;
    const v = ctx.createRadialGradient(vx, vy, r1, vx, vy, r2);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(0.7, 'rgba(0,0,0,0.45)');
    v.addColorStop(1, 'rgba(0,0,0,0.85)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, screenW, screenH);

    // 13) 스크린 공간 화이트아웃/플래시 — 보스 처치 등.
    //     남은 life 비율의 cubic out 으로 빠르게 사라짐.
    world.vfx.forEachActive((vv) => {
      if (vv.kind !== 'flash') return;
      const t = Math.max(0, vv.life / vv.maxLife);
      const ease = t * t;
      const alpha = ease * 0.85;
      const c = this.toRgba(vv.color, alpha);
      ctx.fillStyle = c;
      ctx.fillRect(0, 0, screenW, screenH);
    });
  }

  // === 투사체 ===
  // damageType 별 형태:
  //   fire      — 일렁이는 코어 + 깃털 트레일
  //   cold      — 회전하는 결정 (육각 별) + 차가운 트레일
  //   lightning — jagged 지그재그 + 흰 코어
  //   physical  — 본 글로우 + 흰 코어 (기존)
  private drawProjectile(
    p: import('../game/entities').Projectile,
    time: number,
  ): void {
    const ctx = this.ctx;
    const type = p.damageType;
    const ang = Math.atan2(p.vy, p.vx);

    if (type === 'lightning') {
      // 트레일 — 짧은 지그재그 잔상
      ctx.globalCompositeOperation = 'lighter';
      const segLen = 10;
      const segs = 5;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      let px = p.x;
      let py = p.y;
      ctx.moveTo(px, py);
      for (let i = 1; i <= segs; i++) {
        const tt = i / segs;
        const cx = p.x - p.vx * 0.012 * i;
        const cy = p.y - p.vy * 0.012 * i;
        const jitter = (hashSin(p.spin + i * 7.13 + Math.floor(time * 30)) - 0.5) * 6 * (1 - tt);
        const nx = -p.vy;
        const ny = p.vx;
        const nl = Math.hypot(nx, ny) || 1;
        px = cx + (nx / nl) * jitter;
        py = cy + (ny / nl) * jitter;
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      // 외곽 글로우
      this.drawGlow(p.x, p.y, p.radius * 4, p.color, 0.9);
      // 흰 코어
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
      // 작은 십자 — 번개 코어 강조
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      const r = p.radius * 1.3;
      ctx.beginPath();
      ctx.moveTo(p.x - r, p.y);
      ctx.lineTo(p.x + r, p.y);
      ctx.moveTo(p.x, p.y - r);
      ctx.lineTo(p.x, p.y + r);
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
      void segLen;
    } else if (type === 'cold') {
      // 트레일 — 옅은 푸른 잔상
      for (let i = 4; i >= 1; i--) {
        const tt = i / 4;
        const ddt = i * 0.014;
        ctx.globalAlpha = 0.18 * (1 - tt * 0.5);
        this.drawGlow(
          p.x - p.vx * ddt,
          p.y - p.vy * ddt,
          p.radius * (2 + (1 - tt) * 1.6),
          p.color,
          0.5,
        );
      }
      ctx.globalAlpha = 1;
      // 외곽 글로우
      this.drawGlow(p.x, p.y, p.radius * 4, p.color, 0.7);
      // 결정 — 회전하는 육각형
      const rot = p.spin + time * 6;
      this.drawCrystal(p.x, p.y, p.radius * 1.6, rot, p.color);
    } else if (type === 'fire') {
      // 트레일 — 깃털처럼 펄럭임
      for (let i = 6; i >= 1; i--) {
        const tt = i / 6;
        const ddt = i * 0.014;
        const wobble = Math.sin(time * 30 + p.spin + i) * 2;
        const nx = -p.vy;
        const ny = p.vx;
        const nl = Math.hypot(nx, ny) || 1;
        ctx.globalAlpha = 0.22 * (1 - tt * 0.5);
        this.drawGlow(
          p.x - p.vx * ddt + (nx / nl) * wobble,
          p.y - p.vy * ddt + (ny / nl) * wobble,
          p.radius * (2.2 + (1 - tt) * 2),
          p.color,
          0.65,
        );
      }
      ctx.globalAlpha = 1;
      // 외곽 큰 글로우 (불 후광)
      this.drawGlow(p.x, p.y, p.radius * 4.5, p.color, 0.85);
      // 노란 중심
      this.drawGlow(p.x, p.y, p.radius * 2.2, '#ffd9a0', 0.7);
      // 흰 코어
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // physical — 기존 톤 유지하되 약간 다듬음
      for (let i = 5; i >= 1; i--) {
        const tt = i / 5;
        const ddt = i * 0.012;
        ctx.globalAlpha = 0.16 * (1 - tt * 0.5);
        this.drawGlow(
          p.x - p.vx * ddt,
          p.y - p.vy * ddt,
          p.radius * (1.8 + (1 - tt) * 1.8),
          p.color,
          0.5,
        );
      }
      ctx.globalAlpha = 1;
      this.drawGlow(p.x, p.y, p.radius * 3.6, p.color, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    void ang;
  }

  // 얼음 결정 — 회전하는 육각별. 두 개의 회전 사각형을 겹쳐 별 모양을 만듦.
  private drawCrystal(x: number, y: number, r: number, rot: number, color: string): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    // 외곽 별
    ctx.fillStyle = color;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.8;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const a1 = (i / 6) * Math.PI * 2;
      const a2 = a1 + Math.PI / 6;
      const r1 = r;
      const r2 = r * 0.45;
      const x1 = Math.cos(a1) * r1;
      const y1 = Math.sin(a1) * r1;
      const x2 = Math.cos(a2) * r2;
      const y2 = Math.sin(a2) * r2;
      if (i === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 내부 흰 코어
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // 부채꼴 검흔 — 타입에 따라 톤이 살짝 바뀜.
  private drawArcVfx(v: import('../game/entities').Vfx, a: number): void {
    const ctx = this.ctx;
    const half = v.arcSpan / 2;
    const start = v.angle - half;
    const end = v.angle + half;
    const isFire = v.damageType === 'fire';
    const isCold = v.damageType === 'cold';
    // 외곽 두꺼운 발광
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.55;
    ctx.strokeStyle = v.color;
    ctx.lineWidth = isFire ? 12 : 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.radius, start, end);
    ctx.stroke();
    // 부채꼴 채우기 (반투명)
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = a * (isFire ? 0.44 : 0.38);
    ctx.fillStyle = v.color;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.arc(v.x, v.y, v.radius, start, end);
    ctx.closePath();
    ctx.fill();
    // 외곽 곡면 코어선 — cold 면 점선 톤
    ctx.globalAlpha = a;
    ctx.strokeStyle = v.color;
    ctx.lineWidth = 2;
    if (isCold) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.radius, start, end);
    ctx.stroke();
    if (isCold) ctx.setLineDash([]);
    // 안쪽 흰 코어 검흔
    ctx.globalAlpha = a * 0.9;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(v.x, v.y, v.radius * 0.96, start + 0.1, end - 0.1);
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.globalAlpha = 1;
  }

  // 펄스 링 — 오라/폭발. 타입별로 다중 링/지그재그 등 차별화.
  private drawRingVfx(v: import('../game/entities').Vfx, a: number): void {
    const ctx = this.ctx;
    const type = v.damageType;
    ctx.globalCompositeOperation = 'lighter';
    if (type === 'lightning') {
      // 들쭉날쭉한 지그재그 다각형 + 펄스
      const sides = 24;
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = a;
      ctx.beginPath();
      for (let i = 0; i <= sides; i++) {
        const aa = (i / sides) * Math.PI * 2;
        const jitter = hashSin(v.phase + i * 3.7) * 0.18 + 0.92;
        const rr = v.radius * jitter;
        const x = v.x + Math.cos(aa) * rr;
        const y = v.y + Math.sin(aa) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      // 외곽 글로우 링
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
    } else if (type === 'cold') {
      // 결정형 — 다각형 + 외곽 점선
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 6;
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      // 내부 결정 다각형 (12면)
      ctx.globalAlpha = a * 0.85;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      const sides = 12;
      for (let i = 0; i <= sides; i++) {
        const aa = (i / sides) * Math.PI * 2 + v.phase * 0.2;
        const rr = v.radius * 0.96;
        const x = v.x + Math.cos(aa) * rr;
        const y = v.y + Math.sin(aa) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (type === 'fire') {
      // 일렁임 — 두 겹 링 + 둘레 작은 결정 스파크
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 7;
      ctx.globalAlpha = a * 0.55;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 1.6;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius * 0.92, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // physical — 기존 톤
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 머즐 플래시 — 시전 위치에서 짧고 강한 발광.
  private drawMuzzleVfx(v: import('../game/entities').Vfx, a: number): void {
    const ctx = this.ctx;
    const half = v.arcSpan / 2;
    // 발광 콘 — 진행 방향으로 펼쳐진 부채꼴 외곽 빛
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(v.x, v.y, 0, v.x, v.y, v.maxRadius * (1.3 - a));
    grad.addColorStop(0, this.toRgba('#ffffff', a * 0.95));
    grad.addColorStop(0.3, this.toRgba(v.color, a * 0.7));
    grad.addColorStop(1, this.toRgba(v.color, 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(v.x, v.y);
    ctx.arc(v.x, v.y, v.maxRadius * 1.6, v.angle - half, v.angle + half);
    ctx.closePath();
    ctx.fill();
    // 코어 흰 점
    ctx.fillStyle = this.toRgba('#ffffff', a);
    ctx.beginPath();
    ctx.arc(v.x, v.y, 3 + a * 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // 지면 룬 — 시전 잔재 (디아블로 스킬 시전 라인). 색·도형은 타입별.
  private drawRuneVfx(v: import('../game/entities').Vfx, a: number): void {
    const ctx = this.ctx;
    const type = v.damageType;
    ctx.save();
    ctx.translate(v.x, v.y);
    // 지면처럼 보이게 살짝 눌러 (Y 축 압축)
    ctx.scale(1, 0.45);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = a * 0.7;
    ctx.strokeStyle = v.color;
    ctx.lineWidth = 1.8;
    if (type === 'cold') {
      // 결정형 12각형
      ctx.beginPath();
      const sides = 12;
      for (let i = 0; i <= sides; i++) {
        const aa = (i / sides) * Math.PI * 2 + v.phase;
        const rr = v.radius;
        const x = Math.cos(aa) * rr;
        const y = Math.sin(aa) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (type === 'lightning') {
      // 5각 별
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) {
        const aa = (i / 10) * Math.PI * 2 + v.phase;
        const rr = v.radius * (i % 2 === 0 ? 1 : 0.5);
        const x = Math.cos(aa) * rr;
        const y = Math.sin(aa) * rr;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else {
      // fire — 동심 두 겹 원
      ctx.beginPath();
      ctx.arc(0, 0, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = a * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, v.radius * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  // === 바닥 ===
  private drawGround(world: World): void {
    const ctx = this.ctx;
    if (!this.ground) this.ground = this.buildGroundTile();
    const pat = ctx.createPattern(this.ground, 'repeat');
    if (!pat) return;
    ctx.fillStyle = pat;
    // 화면 가시 영역을 월드 좌표로 채움
    const w = this.viewW + 16;
    const h = this.viewH + 16;
    const x = world.cameraX - w / 2;
    const y = world.cameraY - h / 2;
    ctx.fillRect(x, y, w, h);

    // 약간의 컬러 워시 — 한기 도는 보라
    ctx.fillStyle = 'rgba(40, 28, 56, 0.18)';
    ctx.fillRect(x, y, w, h);
  }

  private buildGroundTile(): HTMLCanvasElement {
    const size = 128;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    // 베이스
    g.fillStyle = '#1a141a';
    g.fillRect(0, 0, size, size);
    // 결정적 의사난수
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    // 돌타일 — 다각 비스무리
    for (let i = 0; i < 14; i++) {
      const x = rnd() * size;
      const y = rnd() * size;
      const r = 10 + rnd() * 22;
      const shade = 24 + (rnd() * 26) | 0;
      const tint = (rnd() * 10) | 0;
      g.fillStyle = `rgb(${shade + tint},${shade},${shade + tint + 4})`;
      g.beginPath();
      const sides = 5 + ((rnd() * 3) | 0);
      for (let s = 0; s < sides; s++) {
        const a = (s / sides) * Math.PI * 2 + rnd() * 0.4;
        const rr = r * (0.8 + rnd() * 0.3);
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (s === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.6)';
      g.lineWidth = 1;
      g.stroke();
      // 하이라이트 한쪽
      g.strokeStyle = 'rgba(120,110,130,0.18)';
      g.lineWidth = 0.6;
      g.stroke();
    }
    // 균열
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 0.7;
    for (let i = 0; i < 10; i++) {
      g.beginPath();
      g.moveTo(rnd() * size, rnd() * size);
      g.lineTo(rnd() * size, rnd() * size);
      g.stroke();
    }
    // 노이즈
    const img = g.getImageData(0, 0, size, size);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (rnd() - 0.5) * 18;
      img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
      img.data[i + 1] = Math.max(0, Math.min(255, img.data[i + 1] + n));
      img.data[i + 2] = Math.max(0, Math.min(255, img.data[i + 2] + n));
    }
    g.putImageData(img, 0, 0);
    return c;
  }

  // === 아레나 외곽 ===
  private drawArena(world: World): void {
    const ctx = this.ctx;
    const R = world.arenaR;
    if (!this.arenaRing || this.arenaRingR !== R) {
      this.arenaRing = this.buildArenaRing(R);
      this.arenaRingR = R;
    }
    // 아레나 안쪽 미묘한 빛
    const grad = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R);
    grad.addColorStop(0, 'rgba(60, 40, 80, 0.08)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fill();
    // 캐시된 링 비트맵
    ctx.drawImage(this.arenaRing, -R - 32, -R - 32);
  }

  private buildArenaRing(R: number): HTMLCanvasElement {
    const pad = 32;
    const size = Math.ceil((R + pad) * 2);
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    g.translate(R + pad, R + pad);
    // 외곽 글로우
    g.strokeStyle = 'rgba(170, 110, 230, 0.18)';
    g.lineWidth = 10;
    g.beginPath();
    g.arc(0, 0, R + 2, 0, Math.PI * 2);
    g.stroke();
    // 어두운 석조 띠
    g.strokeStyle = '#0d0a14';
    g.lineWidth = 8;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    // 본 링
    g.strokeStyle = '#3a2e44';
    g.lineWidth = 3.5;
    g.beginPath();
    g.arc(0, 0, R, 0, Math.PI * 2);
    g.stroke();
    // 룬 점 — 12개 등간격
    const runeColor = 'rgba(190, 140, 255, 0.85)';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = Math.cos(a) * R;
      const y = Math.sin(a) * R;
      // 룬 베이스
      g.fillStyle = '#10081a';
      g.beginPath();
      g.arc(x, y, 5, 0, Math.PI * 2);
      g.fill();
      // 룬 글로우
      const rg = g.createRadialGradient(x, y, 0, x, y, 10);
      rg.addColorStop(0, runeColor);
      rg.addColorStop(1, 'rgba(190, 140, 255, 0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fill();
      // 코어
      g.fillStyle = '#e9d4ff';
      g.beginPath();
      g.arc(x, y, 1.6, 0, Math.PI * 2);
      g.fill();
    }
    // 안쪽 얇은 보조선
    g.strokeStyle = 'rgba(120, 90, 160, 0.35)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(0, 0, R - 10, 0, Math.PI * 2);
    g.stroke();
    return c;
  }

  // === 플레이어 ===
  private drawPlayer(world: World): void {
    const ctx = this.ctx;
    const p = world.player;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 16) % 2 === 0;
    const bob = Math.sin(p.stepPhase) * 1.2;

    // 발 그림자
    if (!this.playerShadow) this.playerShadow = this.buildPlayerShadow();
    ctx.drawImage(this.playerShadow, p.x - 20, p.y - 6);

    const fx = Math.cos(p.facing);
    const fy = Math.sin(p.facing);
    const lx = -fy; // 좌측 수직
    const ly = fx;

    // 망토 (등 뒤)
    const backX = p.x - fx * 6;
    const backY = p.y - fy * 6 + bob * 0.4;
    ctx.fillStyle = blink ? '#ffffff' : '#4a1020';
    ctx.beginPath();
    ctx.moveTo(p.x + lx * 11, p.y + ly * 11);
    ctx.quadraticCurveTo(
      backX - fx * 6,
      backY - fy * 6,
      p.x - lx * 11,
      p.y - ly * 11,
    );
    ctx.lineTo(p.x - fx * 16 - lx * 7, p.y - fy * 16 - ly * 7);
    ctx.quadraticCurveTo(
      p.x - fx * 22,
      p.y - fy * 22,
      p.x - fx * 16 + lx * 7,
      p.y - fy * 16 + ly * 7,
    );
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#1a0408';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // 바디 (강철 갑옷)
    const bodyR = 11;
    const bx = p.x;
    const by = p.y + bob;
    const grad = ctx.createRadialGradient(bx - 3, by - 4, 2, bx, by, bodyR + 2);
    grad.addColorStop(0, '#a8a4b0');
    grad.addColorStop(0.55, '#5a5664');
    grad.addColorStop(1, '#1c1820');
    ctx.fillStyle = blink ? '#ffffff' : grad;
    ctx.beginPath();
    ctx.arc(bx, by, bodyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#08060a';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 가슴 장식 — 황금 십자
    ctx.strokeStyle = blink ? '#ffffff' : '#d4a64a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx - 4, by);
    ctx.lineTo(bx + 4, by);
    ctx.moveTo(bx, by - 5);
    ctx.lineTo(bx, by + 4);
    ctx.stroke();

    // 어깨 보호구
    ctx.fillStyle = blink ? '#ffffff' : '#231a26';
    ctx.beginPath();
    ctx.arc(bx + lx * 10, by + ly * 10, 5, 0, Math.PI * 2);
    ctx.arc(bx - lx * 10, by - ly * 10, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 헬멧 — 정면 위쪽
    const hx = bx + fx * 2;
    const hy = by + fy * 2 - 3;
    const hgrad = ctx.createRadialGradient(hx - 2, hy - 2, 1, hx, hy, 8);
    hgrad.addColorStop(0, '#3a3440');
    hgrad.addColorStop(1, '#0c0a10');
    ctx.fillStyle = blink ? '#ffffff' : hgrad;
    ctx.beginPath();
    ctx.arc(hx, hy, 7.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 바이저 슬릿 — 빛나는 눈
    const ex = hx + fx * 3.5;
    const ey = hy + fy * 3.5;
    ctx.fillStyle = 'rgba(255, 170, 60, 0.95)';
    ctx.beginPath();
    ctx.arc(ex + lx * 2.2, ey + ly * 2.2, 1.4, 0, Math.PI * 2);
    ctx.arc(ex - lx * 2.2, ey - ly * 2.2, 1.4, 0, Math.PI * 2);
    ctx.fill();

    // 무기 — 십자가드가 달린 한손검. attackPhase 에 따라 휘두름/찌르기 모션.
    this.drawSword(p, bx, by, fx, fy, lx, ly, bob);
  }

  // 검 — local +X 가 칼끝 방향. 손잡이 피벗을 플레이어 손 위치로 옮긴 뒤 회전.
  private drawSword(
    p: { facing: number; attackPhase: number; attackDuration: number; attackKind: 'idle' | 'slash' | 'thrust'; attackDir: 1 | -1 },
    bx: number,
    by: number,
    fx: number,
    fy: number,
    lx: number,
    ly: number,
    bob: number,
  ): void {
    const ctx = this.ctx;

    // 모션 — 0 = 휘두름 시작, 1 = 끝
    const t =
      p.attackPhase > 0
        ? Math.min(1, 1 - p.attackPhase / Math.max(0.001, p.attackDuration))
        : 1;
    let swingAngle = -0.32; // 휴식 자세: 살짝 정면 위로 비스듬히
    let thrustOffset = 0;

    if (p.attackPhase > 0 && p.attackKind === 'slash') {
      // 좌→우로 휙 스윙. easeInOutCubic 으로 가속 후 감속.
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      const startA = -1.6; // 시작각 (라디안)
      const endA = 1.6;
      swingAngle = (startA + (endA - startA) * e) * p.attackDir;
    } else if (p.attackPhase > 0 && p.attackKind === 'thrust') {
      // 앞으로 살짝 찌르고 되돌아옴.
      thrustOffset = Math.sin(t * Math.PI) * 8;
      swingAngle = -0.12;
    }

    // 손 위치 (오른손) — 몸 앞쪽 + 우측 약간.
    const handFwd = 5 + thrustOffset;
    const handSide = 4;
    const handX = bx + fx * handFwd + lx * handSide;
    const handY = by + fy * handFwd + ly * handSide + bob * 0.3;
    const angle = p.facing + swingAngle;

    ctx.save();
    ctx.translate(handX, handY);
    ctx.rotate(angle);

    // 1) 폼멜 — 손잡이 끝의 황금 구슬
    ctx.fillStyle = '#d4a64a';
    ctx.beginPath();
    ctx.arc(-7, 0, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a3e10';
    ctx.lineWidth = 0.6;
    ctx.stroke();

    // 2) 그립 — 가죽 감긴 손잡이
    ctx.fillStyle = '#2a1810';
    ctx.fillRect(-6, -1.4, 6, 2.8);
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-6, -1.4, 6, 2.8);
    // 감김 라인
    ctx.strokeStyle = 'rgba(180,140,80,0.55)';
    ctx.lineWidth = 0.5;
    for (let i = -5; i <= 0; i += 1.4) {
      ctx.beginPath();
      ctx.moveTo(i, -1.4);
      ctx.lineTo(i + 0.7, 1.4);
      ctx.stroke();
    }

    // 3) 십자 가드 — 황금
    ctx.fillStyle = '#d4a64a';
    ctx.beginPath();
    ctx.moveTo(-0.6, -5.4);
    ctx.lineTo(1.8, -4.6);
    ctx.lineTo(1.8, 4.6);
    ctx.lineTo(-0.6, 5.4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#4a3010';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    // 중앙 보석
    ctx.fillStyle = '#ff6478';
    ctx.beginPath();
    ctx.arc(0.6, 0, 1, 0, Math.PI * 2);
    ctx.fill();

    // 4) 검신 — 길게 가늘어지는 형태 + 중앙 홈(fuller)
    const bladeLen = 22;
    const bladeW = 3.2;
    ctx.fillStyle = '#dde2ea';
    ctx.strokeStyle = '#1b1f28';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(1.8, -bladeW);
    ctx.lineTo(1.8 + bladeLen * 0.82, -bladeW * 0.55);
    ctx.lineTo(1.8 + bladeLen, 0);
    ctx.lineTo(1.8 + bladeLen * 0.82, bladeW * 0.55);
    ctx.lineTo(1.8, bladeW);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // fuller — 중앙 얕은 홈
    ctx.strokeStyle = 'rgba(60,70,90,0.55)';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(1.8 + bladeLen * 0.78, 0);
    ctx.stroke();
    // 칼날 하이라이트 — 윗면 빛
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(2.4, -bladeW * 0.72);
    ctx.lineTo(1.8 + bladeLen * 0.82, -bladeW * 0.35);
    ctx.stroke();

    ctx.restore();

    // 5) 휘두르는 중 — 칼끝 글로우 & 잔상
    if (p.attackPhase > 0) {
      const tipLocalX = 1.8 + 22;
      const tipX = handX + Math.cos(angle) * tipLocalX;
      const tipY = handY + Math.sin(angle) * tipLocalX;
      const intensity = Math.sin(t * Math.PI); // 가운데서 가장 강함
      this.drawGlow(tipX, tipY, 9, '#ffd07a', 0.55 * intensity);
      if (p.attackKind === 'slash') {
        // 잔상 — 0.06s 전 위치를 흐리게
        const past = Math.max(0, t - 0.18);
        const ep =
          past < 0.5 ? 4 * past * past * past : 1 - Math.pow(-2 * past + 2, 3) / 2;
        const pastAng = p.facing + (-1.6 + (1.6 - -1.6) * ep) * p.attackDir;
        ctx.save();
        ctx.globalAlpha = 0.35 * intensity;
        ctx.translate(handX, handY);
        ctx.rotate(pastAng);
        ctx.strokeStyle = 'rgba(255,240,200,0.85)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(2, 0);
        ctx.lineTo(2 + 22, 0);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  private buildPlayerShadow(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = 40;
    c.height = 18;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(20, 9, 2, 20, 9, 18);
    grad.addColorStop(0, 'rgba(0,0,0,0.55)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(20, 9, 18, 7, 0, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  // === 적 ===
  private drawEnemy(e: import('../game/entities').Enemy): void {
    const ctx = this.ctx;
    const def = e.def;
    const r = def.radius;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.ellipse(e.x, e.y + r * 0.55, r * 0.95, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();

    // 본체 — 2톤 그라데이션 + 외곽
    const isFlash = e.flash > 0;
    const baseCol = def.color;
    const darkCol = this.darken(baseCol, 0.55);
    const lightCol = this.lighten(baseCol, 0.18);
    const grad = ctx.createRadialGradient(e.x - r * 0.3, e.y - r * 0.4, 1, e.x, e.y, r);
    grad.addColorStop(0, isFlash ? '#ffffff' : lightCol);
    grad.addColorStop(0.65, isFlash ? '#ffffff' : baseCol);
    grad.addColorStop(1, isFlash ? '#ffffff' : darkCol);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#08050a';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    // 타입별 디테일
    const isBoss = def.role === 'boss';
    if (def.id === 'brute' || isBoss) {
      // 가시 / 뿔
      const spikes = isBoss ? 8 : 5;
      ctx.fillStyle = darkCol;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 0.8;
      for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2 - Math.PI / 2;
        const x1 = e.x + Math.cos(a) * r;
        const y1 = e.y + Math.sin(a) * r;
        const x2 = e.x + Math.cos(a) * (r + (isBoss ? 9 : 5));
        const y2 = e.y + Math.sin(a) * (r + (isBoss ? 9 : 5));
        const lx = -Math.sin(a) * 2.4;
        const ly = Math.cos(a) * 2.4;
        ctx.beginPath();
        ctx.moveTo(x1 + lx, y1 + ly);
        ctx.lineTo(x2, y2);
        ctx.lineTo(x1 - lx, y1 - ly);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
    if (def.id === 'runner') {
      // 등에 길쭉한 가시
      ctx.fillStyle = darkCol;
      ctx.beginPath();
      ctx.moveTo(e.x - 2, e.y - r);
      ctx.lineTo(e.x, e.y - r - 6);
      ctx.lineTo(e.x + 2, e.y - r);
      ctx.closePath();
      ctx.fill();
    }
    if (def.id === 'caster') {
      // 후광 — 마법사
      this.drawGlow(e.x, e.y - r + 2, r * 1.6, baseCol, 0.5);
    }

    // 빛나는 눈 — 적의 정수
    const eyeCol = def.id === 'caster' ? '#cba8ff' :
                   isBoss ? '#ff5566' :
                   '#ffae3d';
    const ed = Math.max(2, r * 0.3);
    ctx.fillStyle = eyeCol;
    ctx.beginPath();
    ctx.arc(e.x - ed * 0.8, e.y - r * 0.15, ed * 0.32, 0, Math.PI * 2);
    ctx.arc(e.x + ed * 0.8, e.y - r * 0.15, ed * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // ailment 표시 — 점화/한기/감전
    const t = performance.now() / 1000;
    if (e.igniteTime > 0) {
      // 화염 링 + 위로 일렁이는 작은 불꽃 자국
      const flicker = 0.85 + Math.sin(t * 18 + e.x * 0.1) * 0.12;
      this.drawGlow(e.x, e.y, (r + 8) * flicker, '#ff7a30', 0.55);
      ctx.strokeStyle = '#ff9c44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      // 위로 솟는 작은 불 — 3개
      for (let i = 0; i < 3; i++) {
        const off = ((t * 1.6 + i * 0.33) % 1);
        const fx = e.x + Math.sin(t * 5 + i * 2.1) * 3 + (i - 1) * 4;
        const fy = e.y - r * 0.6 - off * 14;
        const fa = 1 - off;
        ctx.fillStyle = `rgba(255, 180, 80, ${fa * 0.8})`;
        ctx.beginPath();
        ctx.arc(fx, fy, 1.6 * (1 - off * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (e.chillTime > 0) {
      // 청량한 한기 링 — 결정 점선
      const a = Math.min(1, e.chillTime / 1.6);
      ctx.strokeStyle = `rgba(180, 230, 255, ${0.7 * a})`;
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 작은 얼음 결정 두 개 위쪽
      for (let i = 0; i < 2; i++) {
        const ax = e.x + (i === 0 ? -1 : 1) * (r + 2);
        const ay = e.y - r * 0.2;
        this.drawCrystal(ax, ay, 2.6, t * 2 + i, '#bce8ff');
      }
    }
    if (e.shockTime > 0) {
      // 감전 — 띄엄띄엄 흰 호 + 머리 위 작은 번개
      const a = Math.min(1, e.shockTime / 1.4);
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(220, 200, 255, ${0.9 * a})`;
      ctx.lineWidth = 1.4;
      const arcs = 3;
      for (let i = 0; i < arcs; i++) {
        const off = (t * 6 + i * (Math.PI * 2 / arcs)) % (Math.PI * 2);
        const span = 0.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, r + 5, off, off + span);
        ctx.stroke();
      }
      // 머리 위 작은 번개 (지그재그)
      ctx.beginPath();
      const bx = e.x;
      const by = e.y - r - 6;
      ctx.moveTo(bx, by);
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        const yy = by + i * 2;
        const xx = bx + (hashSin(t * 22 + i * 1.3 + e.x * 0.05) - 0.5) * 4;
        ctx.lineTo(xx, yy);
      }
      ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }

    // 체력 바
    if (isBoss || e.hp < e.maxHp) {
      const bw = Math.max(18, r * 2.4);
      const bh = isBoss ? 4 : 3;
      const bx = e.x - bw / 2;
      const by = e.y - r - 7;
      ctx.fillStyle = 'rgba(0,0,0,0.78)';
      ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      ctx.fillStyle = isBoss ? '#a8112a' : '#5a1620';
      ctx.fillRect(bx, by, bw, bh);
      const pct = Math.max(0, e.hp / e.maxHp);
      const fillCol = isBoss ? '#ff3859' : '#ff8c8c';
      ctx.fillStyle = fillCol;
      ctx.fillRect(bx, by, bw * pct, bh);
      // 하이라이트
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bx, by, bw * pct, 1);
    }
  }

  // === 화톳불 ===
  private drawBonfire(bf: { x: number; y: number; sparkPhase: number }): void {
    const ctx = this.ctx;
    const t = bf.sparkPhase;
    // 바닥 그림자 / 잔재
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath();
    ctx.ellipse(bf.x, bf.y + 6, 22, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 통나무 (X 자 배치)
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(bf.x - 14, bf.y + 4);
    ctx.lineTo(bf.x + 14, bf.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(bf.x - 12, bf.y);
    ctx.lineTo(bf.x + 14, bf.y + 5);
    ctx.stroke();
    ctx.strokeStyle = '#4a2810';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(bf.x - 14, bf.y + 4);
    ctx.lineTo(bf.x + 14, bf.y);
    ctx.stroke();
    // 글로우 (깜빡임 — sparkPhase 로 강도 변조)
    const flicker = 0.85 + Math.sin(t * 14) * 0.1 + Math.sin(t * 7.3) * 0.05;
    this.drawGlow(bf.x, bf.y - 4, 42 * flicker, '#ff8c44', 0.7);
    this.drawGlow(bf.x, bf.y - 8, 26 * flicker, '#ffd86b', 0.8);
    // 불꽃 — 위로 흔들리는 삼각형
    const flames = 5;
    for (let i = 0; i < flames; i++) {
      const off = (i / flames - 0.5) * 12;
      const sway = Math.sin(t * 6 + i * 1.7) * 2.4;
      const h = 14 + Math.sin(t * 5 + i * 2.1) * 4 + i * 1.5;
      const fx = bf.x + off + sway;
      const fy = bf.y - 2;
      const col = i % 2 === 0 ? '#ffb348' : '#ff6a1c';
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(fx - 3, fy);
      ctx.quadraticCurveTo(fx - 1, fy - h * 0.5, fx, fy - h);
      ctx.quadraticCurveTo(fx + 1, fy - h * 0.5, fx + 3, fy);
      ctx.closePath();
      ctx.fill();
    }
    // 내부 흰 코어
    ctx.fillStyle = `rgba(255, 245, 200, ${0.7 + Math.sin(t * 12) * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(bf.x, bf.y - 6, 4, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    // 떠오르는 불티
    for (let i = 0; i < 4; i++) {
      const ph = (t * 0.9 + i * 0.5) % 1;
      const sx = bf.x + Math.sin(t * 2 + i) * 8;
      const sy = bf.y - 12 - ph * 30;
      ctx.fillStyle = `rgba(255, 200, 120, ${1 - ph})`;
      ctx.beginPath();
      ctx.arc(sx, sy, 1.1, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // === NPC (후드 실루엣) ===
  private drawNpc(
    npc: { x: number; y: number; bob: number },
    inRange: boolean,
  ): void {
    const ctx = this.ctx;
    const bob = Math.sin(npc.bob * 1.6) * 0.8;
    const x = npc.x;
    const y = npc.y + bob;
    // 그림자
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.ellipse(x, y + 12, 11, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    // 인접 상태면 미묘한 글로우
    if (inRange) {
      this.drawGlow(x, y, 36, '#d4a64a', 0.35);
    }
    // 로브 (사다리꼴)
    ctx.fillStyle = '#1a0e22';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x - 5, y - 4);
    ctx.lineTo(x + 5, y - 4);
    ctx.lineTo(x + 9, y + 12);
    ctx.lineTo(x - 9, y + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 후드 (상단 둥근 그늘)
    ctx.fillStyle = '#0e0616';
    ctx.beginPath();
    ctx.arc(x, y - 6, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 가슴 매듭 — 골드 점
    ctx.fillStyle = '#d4a64a';
    ctx.beginPath();
    ctx.arc(x, y + 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    // 후드 안 빛나는 눈
    ctx.fillStyle = inRange ? '#f4d486' : '#7a5a1a';
    ctx.beginPath();
    ctx.arc(x - 1.6, y - 5, 0.9, 0, Math.PI * 2);
    ctx.arc(x + 1.6, y - 5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    // 근접 시 머리 위 프롬프트
    if (inRange) {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '700 9px "Times New Roman", serif';
      const py = y - 20 + Math.sin(npc.bob * 3) * 1.2;
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
      ctx.strokeText('E / 탭하여 정비', x, py);
      ctx.fillStyle = '#f4d486';
      ctx.fillText('E / 탭하여 정비', x, py);
      ctx.restore();
    }
  }

  // === 회전 칼날 ===
  private drawBlade(x: number, y: number, angle: number, r: number, color: string): void {
    const ctx = this.ctx;
    this.drawGlow(x, y, r * 2.4, color, 0.55);
    // 검신 모양 — 가늘고 긴 마름모
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = '#f4f4ff';
    ctx.strokeStyle = '#222a3a';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.4);
    ctx.lineTo(r * 0.6, 0);
    ctx.lineTo(0, r * 1.4);
    ctx.lineTo(-r * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 중앙 빛
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // === 글로우 (캐시된 방사형 텍스처) ===
  private drawGlow(x: number, y: number, radius: number, color: string, alpha: number): void {
    const ctx = this.ctx;
    const tex = this.getGlow(color);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(tex, x - radius, y - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  private getGlow(color: string): HTMLCanvasElement {
    const k = colorHash(color);
    const hit = this.glowCache.get(k);
    if (hit) return hit;
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, this.toRgba(color, 1));
    grad.addColorStop(0.4, this.toRgba(color, 0.4));
    grad.addColorStop(1, this.toRgba(color, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    this.glowCache.set(k, c);
    return c;
  }

  // === 색 유틸 ===
  private parseHex(c: string): [number, number, number] {
    let s = c.trim();
    if (s.startsWith('#')) s = s.slice(1);
    if (s.length === 3) s = s.split('').map((x) => x + x).join('');
    const n = parseInt(s, 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  private toRgba(c: string, a: number): string {
    if (c.startsWith('rgb')) return c;
    const [r, g, b] = this.parseHex(c);
    return `rgba(${r},${g},${b},${a})`;
  }

  private darken(c: string, k: number): string {
    const [r, g, b] = this.parseHex(c);
    return `rgb(${(r * (1 - k)) | 0},${(g * (1 - k)) | 0},${(b * (1 - k)) | 0})`;
  }

  private lighten(c: string, k: number): string {
    const [r, g, b] = this.parseHex(c);
    return `rgb(${Math.min(255, r + (255 - r) * k) | 0},${Math.min(255, g + (255 - g) * k) | 0},${Math.min(255, b + (255 - b) * k) | 0})`;
  }
}
