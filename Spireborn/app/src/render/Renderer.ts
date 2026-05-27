// Canvas 2D 렌더러 — 다크 판타지 ARPG 톤.
// 카메라는 항상 플레이어를 중심에 둔다. 화면 좌표 = (월드 - 카메라) * zoom + 화면중앙.
import { World } from '../game/World';
import { getSkill } from '../data/skills';

// 색상 해시 — glow 캐시 키용 (정수 한 개로 충분)
function colorHash(c: string): string {
  return c;
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

    // 2) 월드 변환 — 카메라(=플레이어 위치) 가 화면 중앙으로
    const cx = world.cameraX;
    const cy = world.cameraY;
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

    // 8) 투사체 — 글로우 + 코어
    world.projectiles.forEachActive((p) => {
      this.drawGlow(p.x, p.y, p.radius * 3.2, p.color, 0.6);
      // 트레일
      ctx.globalAlpha = 0.35;
      this.drawGlow(p.x - p.vx * 0.018, p.y - p.vy * 0.018, p.radius * 2.4, p.color, 0.5);
      ctx.globalAlpha = 1;
      // 코어
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * 0.55, 0, Math.PI * 2);
      ctx.fill();
    });

    // 9) VFX — 오라/폭발의 빛 펄스
    world.vfx.forEachActive((v) => {
      const a = Math.max(0, v.life / v.maxLife);
      // 바깥 글로우 링
      ctx.globalAlpha = a * 0.5;
      ctx.strokeStyle = v.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      // 내부 선명 링
      ctx.globalAlpha = a;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, v.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    // 10) 플레이어 — 갑옷 입은 영웅
    this.drawPlayer(world);

    // 11) 부유 텍스트
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 11px "Times New Roman", serif';
    world.texts.forEachActive((t) => {
      const a = Math.max(0, t.life / t.maxLife);
      ctx.globalAlpha = a;
      // 외곽선
      ctx.strokeStyle = 'rgba(0,0,0,0.85)';
      ctx.lineWidth = 3;
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

    // 무기 — 정면쪽 빛나는 검신
    const wx = bx + fx * 14;
    const wy = by + fy * 14;
    this.drawGlow(wx, wy, 10, '#ffb84a', 0.7);
    ctx.strokeStyle = '#e8d49a';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(bx + fx * 8 + lx * 1.5, by + fy * 8 + ly * 1.5);
    ctx.lineTo(bx + fx * 22, by + fy * 22);
    ctx.stroke();
    ctx.strokeStyle = '#fff7d8';
    ctx.lineWidth = 1;
    ctx.stroke();
    // 칼끝 코어
    ctx.fillStyle = '#fff8d2';
    ctx.beginPath();
    ctx.arc(bx + fx * 22, by + fy * 22, 1.6, 0, Math.PI * 2);
    ctx.fill();
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

    // 점화 표시 — 화염 링
    if (e.igniteTime > 0) {
      ctx.strokeStyle = '#ff8c44';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      this.drawGlow(e.x, e.y, r + 8, '#ff8c44', 0.4);
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
