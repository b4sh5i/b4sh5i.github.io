// 게임 시뮬레이션의 핵심 — 플레이어, 적, 투사체, 충돌, 데미지를 다룬다.
// UI/입력/저장과 분리해 단위로 update/render만 호출되도록 한다.
import type { RunState, SkillState } from '../types';
import { getSkill } from '../data/skills';
import { ENEMIES, spawnPoolFor } from '../data/enemies';
import { Pool } from '../util/pool';
import { RNG } from '../util/rng';
import {
  Enemy,
  Projectile,
  OrbitBlade,
  CreditOrb,
  Vfx,
  FloatingText,
} from './entities';
import { specForFloor, currentSpawnInterval, FloorSpec } from './floor';
import { computeBuild, ComputedBuild } from './build';

export interface WorldEvents {
  onPlayerHurt?: () => void;
  onFloorCleared?: () => void;
  onPlayerDead?: () => void;
}

// 한 층의 원형 아레나 반경 (월드 단위). 층마다 살짝 커지지만 화면 안에 들어가는 크기.
export function arenaRadius(floor: number): number {
  return 280 + Math.min(120, (floor - 1) * 6);
}

export class World {
  // 외부 참조
  run: RunState;
  rng: RNG;
  events: WorldEvents;
  build: ComputedBuild;
  floorSpec: FloorSpec;

  // 플레이어 상태 (월드 좌표)
  player = {
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    invuln: 0, // 피격 후 무적 시간 (초)
    flash: 0,
    // 캐릭터가 바라보는 방향 (라디안). 이동 중이면 입력 방향, 정지면 최근 타겟 방향.
    facing: 0,
    // 걸음 진행 (애니메이션용)
    stepPhase: 0,
  };

  // 다음 자동 발동 타이밍
  private nextCast = 0;
  private auraTick = 0;
  private orbitAngle = 0;

  // 풀
  enemies = new Pool<Enemy>(() => new Enemy());
  projectiles = new Pool<Projectile>(() => new Projectile());
  orbits = new Pool<OrbitBlade>(() => new OrbitBlade());
  creditOrbs = new Pool<CreditOrb>(() => new CreditOrb());
  vfx = new Pool<Vfx>(() => new Vfx());
  texts = new Pool<FloatingText>(() => new FloatingText());

  // 아레나
  arenaR = 280;

  // 적 ID 발급기 (관통 중복 방지용)
  private nextEnemyId = 1;
  private enemyIds = new WeakMap<Enemy, number>();

  // 스폰 누적
  private spawnAccum = 0;
  private bossSpawned = false;
  private bossActive = false;

  // 입력 방향 (정규화된 -1..1)
  inputX = 0;
  inputY = 0;

  // 카메라 (월드 -> 화면). 플레이어 중심.
  cameraX = 0;
  cameraY = 0;

  // 화면 크기 (Game에서 매 프레임 전달)
  viewW = 0;
  viewH = 0;

  // 일시정지 (레벨업/정비 UI 동안)
  paused = false;

  constructor(run: RunState, events: WorldEvents) {
    this.run = run;
    this.rng = new RNG(this.runSeedForFloor());
    this.events = events;
    this.build = computeBuild(run);
    this.floorSpec = specForFloor(run.floor);
    this.arenaR = arenaRadius(run.floor);

    // 회전 칼날 스킬이면 초기 칼날 인스턴스 준비
    this.refreshOrbitBlades();
  }

  // 빌드 재합산 (서포트/아이템 변경 후 호출)
  rebuild(): void {
    this.build = computeBuild(this.run);
    this.refreshOrbitBlades();
  }

  // 층 시작 — 새 시드, 스폰 초기화 (이어하기 시에는 시드 유지)
  startFloor(): void {
    this.run.floorElapsedSec = 0;
    this.run.phase = 'fighting';
    this.floorSpec = specForFloor(this.run.floor);
    this.arenaR = arenaRadius(this.run.floor);
    this.rng = new RNG(this.runSeedForFloor());
    this.spawnAccum = 0;
    this.bossSpawned = false;
    this.bossActive = false;
    this.enemies.clear();
    this.projectiles.clear();
    this.creditOrbs.clear();
    this.vfx.clear();
    this.texts.clear();
    this.player.x = 0;
    this.player.y = 0;
    this.nextCast = 0;
    this.auraTick = 0;
    this.refreshOrbitBlades();
  }

  private runSeedForFloor(): number {
    // 층마다 다른 시드를 결정적으로 파생. 런 시드를 저장하면 같은 층에서 같은 진행.
    return ((this.run.seed ^ ((this.run.floor * 2654435761) >>> 0)) >>> 0) || 1;
  }

  private getEnemyId(e: Enemy): number {
    let id = this.enemyIds.get(e);
    if (id === undefined) {
      id = this.nextEnemyId++;
      this.enemyIds.set(e, id);
    }
    return id;
  }

  private refreshOrbitBlades(): void {
    const def = getSkill(this.run.mainSkillId);
    if (def.cast.kind !== 'orbit') {
      this.orbits.clear();
      return;
    }
    const wantCount = Math.max(1, Math.floor(this.build.skill.projectileCount));
    // 활성 개수와 맞춤
    let active = 0;
    this.orbits.forEachActive(() => active++);
    while (active < wantCount) {
      const b = this.orbits.acquire();
      b.angle = (Math.PI * 2 * active) / wantCount;
      b.hitCooldownByEnemy = new Map();
      active++;
    }
    if (active > wantCount) {
      // 초과분 비활성
      const toFree: OrbitBlade[] = [];
      this.orbits.forEachActive((b) => {
        if (toFree.length < active - wantCount) toFree.push(b);
      });
      for (const b of toFree) this.orbits.release(b);
    }
    // 균등 분배
    let i = 0;
    const total = this.orbits.countActive();
    this.orbits.forEachActive((b) => {
      b.angle = (Math.PI * 2 * i) / Math.max(1, total);
      i++;
    });
  }

  setView(w: number, h: number): void {
    this.viewW = w;
    this.viewH = h;
  }

  setInput(dx: number, dy: number): void {
    this.inputX = dx;
    this.inputY = dy;
  }

  update(dt: number): void {
    if (this.paused || this.run.phase !== 'fighting') return;

    // 플레이어 이동
    const ps = this.build.player;
    const moveMag = Math.hypot(this.inputX, this.inputY);
    this.player.x += this.inputX * ps.moveSpeed * dt;
    this.player.y += this.inputY * ps.moveSpeed * dt;
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.player.flash > 0) this.player.flash -= dt;

    // 바라보는 방향 — 이동 중이면 진행 방향, 정지하면 최근 타겟쪽
    if (moveMag > 0.05) {
      this.player.facing = Math.atan2(this.inputY, this.inputX);
      this.player.stepPhase += dt * 8 * moveMag;
    } else {
      const tgt = this.findNearestEnemy(600);
      if (tgt) {
        const dx = tgt.x - this.player.x;
        const dy = tgt.y - this.player.y;
        this.player.facing = Math.atan2(dy, dx);
      }
    }

    // 아레나 경계 안으로 클램프 — 플레이어 반경 14
    const playerR = 14;
    const limit = Math.max(0, this.arenaR - playerR);
    const pd = Math.hypot(this.player.x, this.player.y);
    if (pd > limit) {
      this.player.x = (this.player.x / pd) * limit;
      this.player.y = (this.player.y / pd) * limit;
    }

    // 카메라 — 플레이어 추적 (모바일에서 캐릭터가 화면 밖으로 나가지 않게 고정 뷰)
    this.cameraX = this.player.x;
    this.cameraY = this.player.y;

    // 시간 진행 / 보스 트리거
    this.run.floorElapsedSec += dt;
    this.run.timeAliveSec += dt;
    if (
      !this.bossSpawned &&
      this.run.floorElapsedSec >= this.floorSpec.durationSec
    ) {
      this.spawnBoss();
    }

    // 적 스폰 (보스 등장 후엔 잡몹 스폰 멈춤)
    if (!this.bossActive) {
      this.spawnAccum += dt;
      const interval = currentSpawnInterval(
        this.floorSpec,
        this.run.floorElapsedSec,
      );
      while (this.spawnAccum >= interval) {
        this.spawnAccum -= interval;
        this.spawnEnemyRandom();
      }
    }

    // 자동 시전
    this.autoCast(dt);

    // 적 업데이트
    this.updateEnemies(dt);

    // 투사체 업데이트
    this.updateProjectiles(dt);

    // 회전 칼날
    this.updateOrbits(dt);

    // 크레딧 오브
    this.updateCreditOrbs(dt);

    // 시각 효과
    this.updateVfx(dt);
    this.updateTexts(dt);

    // 모든 적 사라지고 보스도 죽었으면 클리어
    if (this.bossSpawned && !this.bossActive && this.enemies.countActive() === 0) {
      this.run.phase = 'cleared';
      this.events.onFloorCleared?.();
    }

    // 사망 체크
    if (this.run.playerHp <= 0) {
      this.run.phase = 'dead';
      this.events.onPlayerDead?.();
    }
  }

  // === 스폰 ===
  private spawnEnemyRandom(): void {
    const pool = spawnPoolFor(this.run.floor);
    if (pool.length === 0) return;
    const def = this.rng.weighted(pool);
    const e = this.enemies.acquire();
    e.def = def;
    e.hp = def.hp * this.floorSpec.enemyHpMul;
    e.maxHp = e.hp;
    e.igniteTime = 0;
    e.igniteDps = 0;
    e.knockX = 0;
    e.knockY = 0;
    e.flash = 0;
    // 아레나 가장자리 바로 바깥에서 등장 — 안쪽 플레이어를 향해 이동
    const angle = this.rng.next() * Math.PI * 2;
    const radius = this.arenaR + 24 + this.rng.next() * 36;
    e.x = Math.cos(angle) * radius;
    e.y = Math.sin(angle) * radius;
    // 새 ID 부여
    this.enemyIds.delete(e);
    this.getEnemyId(e);
  }

  private spawnBoss(): void {
    this.bossSpawned = true;
    this.bossActive = true;
    const def = ENEMIES.boss;
    const e = this.enemies.acquire();
    e.def = def;
    e.hp = def.hp * this.floorSpec.bossHpMul;
    e.maxHp = e.hp;
    e.igniteTime = 0;
    e.igniteDps = 0;
    e.flash = 0;
    e.knockX = 0;
    e.knockY = 0;
    const angle = this.rng.next() * Math.PI * 2;
    const radius = this.arenaR + 60;
    e.x = Math.cos(angle) * radius;
    e.y = Math.sin(angle) * radius;
    this.enemyIds.delete(e);
    this.getEnemyId(e);
    this.spawnText(
      e.x,
      e.y - 40,
      `${def.name} 등장`,
      '#ff5577',
      1.6,
    );
  }

  // === 자동 시전 ===
  private autoCast(dt: number): void {
    const def = getSkill(this.run.mainSkillId);
    const s = this.build.skill;
    if (def.cast.kind === 'projectile') {
      this.nextCast -= dt;
      if (this.nextCast <= 0) {
        const target = this.findNearestEnemy(def.baseRange);
        if (target) {
          this.fireProjectiles(def.color, def.baseDamage, def.baseProjectileSpeed, s, target);
          this.nextCast = def.baseCooldown * s.cooldownMul;
        } else {
          // 적 없으면 살짝 기다림
          this.nextCast = 0.15;
        }
      }
    } else if (def.cast.kind === 'aura') {
      this.auraTick += dt;
      const interval = def.cast.tickInterval * s.cooldownMul;
      while (this.auraTick >= interval) {
        this.auraTick -= interval;
        this.auraPulse(def.baseDamage, def.baseArea * s.areaMul, s);
      }
    } else if (def.cast.kind === 'orbit') {
      // 회전은 updateOrbits에서 다룸 — 여기선 칼날 회전만 진행
      const speed = def.cast.rotationSpeed * (s.projectileSpeedMul || 1);
      this.orbitAngle += dt * speed;
    }
  }

  private fireProjectiles(
    color: string,
    baseDamage: number,
    baseSpeed: number,
    s: SkillState,
    target: Enemy,
  ): void {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const baseAngle = Math.atan2(dy, dx);
    const count = Math.max(1, Math.floor(s.projectileCount));
    const spread = (s.spreadDeg * Math.PI) / 180;
    for (let i = 0; i < count; i++) {
      // 균등 분포: count=1이면 0, count=2이면 ±spread/2, 등
      const off =
        count === 1 ? 0 : -spread / 2 + (spread * i) / (count - 1);
      const a = baseAngle + off;
      this.spawnProjectile(this.player.x, this.player.y, a, color, baseDamage, baseSpeed, s);
    }
  }

  private spawnProjectile(
    x: number,
    y: number,
    angle: number,
    color: string,
    baseDamage: number,
    baseSpeed: number,
    s: SkillState,
  ): void {
    const p = this.projectiles.acquire();
    const speed = baseSpeed * s.projectileSpeedMul;
    p.x = x;
    p.y = y;
    p.vx = Math.cos(angle) * speed;
    p.vy = Math.sin(angle) * speed;
    p.damage = baseDamage * s.damageMul;
    p.pierceLeft = s.pierce;
    p.chainLeft = s.chain;
    p.hitIds = [];
    p.radius = 6;
    p.life = 2.4;
    p.color = color;
    p.explodeOnKill = s.explodeOnKill;
    p.explodeRadius = s.explodeRadius * s.areaMul;
    p.explodeDamageMul = s.explodeDamageMul;
    p.ignite = s.ignite;
    p.igniteDuration = s.igniteDuration;
    p.igniteDamageMulPerSec = s.igniteDamageMulPerSec;
  }

  private auraPulse(baseDamage: number, radius: number, s: SkillState): void {
    const dmg = baseDamage * s.damageMul;
    // 시각 효과
    const vfx = this.vfx.acquire();
    vfx.x = this.player.x;
    vfx.y = this.player.y;
    vfx.radius = 0;
    vfx.maxRadius = radius;
    vfx.maxLife = 0.35;
    vfx.life = vfx.maxLife;
    vfx.color = '#9ad4ff';

    // 범위 내 모든 적에게 데미지
    this.enemies.forEachActive((e) => {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy <= radius * radius) {
        this.hitEnemy(e, dmg, s, true);
      }
    });
  }

  // === 적 업데이트 ===
  private updateEnemies(dt: number): void {
    const ps = this.build.player;
    const pr = 14; // 플레이어 충돌 반경
    this.enemies.forEachActive((e) => {
      // 이동: 플레이어 향해
      const dx = this.player.x - e.x;
      const dy = this.player.y - e.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const sp = e.def.moveSpeed * this.floorSpec.enemySpeedMul;
      e.x += (dx / dist) * sp * dt + e.knockX * dt;
      e.y += (dy / dist) * sp * dt + e.knockY * dt;
      // 넉백 감쇠
      e.knockX *= Math.exp(-dt * 6);
      e.knockY *= Math.exp(-dt * 6);
      // 점화 DoT
      if (e.igniteTime > 0) {
        e.hp -= e.igniteDps * dt;
        e.igniteTime -= dt;
        if (e.hp <= 0) {
          this.killEnemy(e, null);
          return;
        }
      }
      if (e.flash > 0) e.flash -= dt;

      // 플레이어 충돌
      if (dist < pr + e.def.radius && this.player.invuln <= 0) {
        const dmg = e.def.damage * this.floorSpec.enemyDmgMul;
        this.run.playerHp -= dmg;
        this.player.invuln = 0.6;
        this.player.flash = 0.15;
        this.events.onPlayerHurt?.();
        // 살짝 밀어내기
        e.knockX = -(dx / dist) * 60;
        e.knockY = -(dy / dist) * 60;
      }

      // 아레나에서 멀리 벗어나면 디스폰
      const ed = Math.hypot(e.x, e.y);
      if (ed > this.arenaR + 200) {
        this.enemies.release(e);
      }
    });
    void ps;
  }

  // === 투사체 업데이트 ===
  private updateProjectiles(dt: number): void {
    this.projectiles.forEachActive((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.projectiles.release(p);
        return;
      }
      // 충돌
      this.enemies.forEachActive((e) => {
        if (!p.active) return;
        const id = this.getEnemyId(e);
        if (p.hitIds.includes(id)) return;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const r = e.def.radius + p.radius;
        if (dx * dx + dy * dy <= r * r) {
          p.hitIds.push(id);
          const isKill = this.hitProjectile(p, e);
          if (isKill && p.chainLeft > 0) {
            this.chainProjectile(p, e);
          }
          if (p.pierceLeft > 0) {
            p.pierceLeft--;
          } else if (p.chainLeft <= 0 || !isKill) {
            this.projectiles.release(p);
          }
        }
      });
    });
  }

  // 투사체가 적에게 명중. 처치했으면 true.
  private hitProjectile(p: Projectile, e: Enemy): boolean {
    // 살짝 넉백
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    e.knockX += (dx / len) * 40;
    e.knockY += (dy / len) * 40;
    e.flash = 0.08;
    e.hp -= p.damage;
    this.spawnText(e.x, e.y - e.def.radius, `${Math.round(p.damage)}`, '#ffe2b3', 0.55);
    // 점화 적용
    if (p.ignite && p.igniteDuration > 0) {
      e.igniteTime = Math.max(e.igniteTime, p.igniteDuration);
      const newDps = p.damage * p.igniteDamageMulPerSec;
      if (newDps > e.igniteDps) e.igniteDps = newDps;
    }
    if (e.hp <= 0) {
      this.killEnemy(e, p);
      return true;
    }
    return false;
  }

  private chainProjectile(p: Projectile, fromEnemy: Enemy): void {
    p.chainLeft--;
    // 가장 가까운 다른 적 찾기
    const maxRange = 220;
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    this.enemies.forEachActive((e) => {
      if (e === fromEnemy) return;
      const id = this.getEnemyId(e);
      if (p.hitIds.includes(id)) return;
      const dx = e.x - fromEnemy.x;
      const dy = e.y - fromEnemy.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    });
    if (best) {
      const target = best as Enemy;
      const dx = target.x - fromEnemy.x;
      const dy = target.y - fromEnemy.y;
      const len = Math.hypot(dx, dy) || 1;
      const speed = Math.hypot(p.vx, p.vy) || 240;
      p.x = fromEnemy.x;
      p.y = fromEnemy.y;
      p.vx = (dx / len) * speed;
      p.vy = (dy / len) * speed;
      p.life = 1.2;
    } else {
      this.projectiles.release(p);
    }
  }

  // === 회전 칼날 ===
  private updateOrbits(dt: number): void {
    const def = getSkill(this.run.mainSkillId);
    if (def.cast.kind !== 'orbit') return;
    const s = this.build.skill;
    const orbitR = def.cast.orbitRadius * s.areaMul;
    const total = this.orbits.countActive();
    let i = 0;
    const baseAngle = this.orbitAngle;
    this.orbits.forEachActive((b) => {
      b.angle = baseAngle + (Math.PI * 2 * i) / Math.max(1, total);
      i++;
      const bx = this.player.x + Math.cos(b.angle) * orbitR;
      const by = this.player.y + Math.sin(b.angle) * orbitR;
      // 충돌 검사
      this.enemies.forEachActive((e) => {
        const id = this.getEnemyId(e);
        const cd = b.hitCooldownByEnemy.get(id) ?? 0;
        if (cd > 0) {
          b.hitCooldownByEnemy.set(id, cd - dt);
          return;
        }
        const dx = e.x - bx;
        const dy = e.y - by;
        const r = e.def.radius + def.baseArea * s.areaMul;
        if (dx * dx + dy * dy <= r * r) {
          // 단발 데미지로 처리 (가짜 투사체)
          const dmg = def.baseDamage * s.damageMul;
          e.hp -= dmg;
          e.flash = 0.08;
          this.spawnText(e.x, e.y - e.def.radius, `${Math.round(dmg)}`, '#ffffff', 0.5);
          // 점화 부여
          if (s.ignite && s.igniteDuration > 0) {
            e.igniteTime = Math.max(e.igniteTime, s.igniteDuration);
            const newDps = dmg * s.igniteDamageMulPerSec;
            if (newDps > e.igniteDps) e.igniteDps = newDps;
          }
          // 처치
          if (e.hp <= 0) {
            this.killEnemy(e, null);
          } else {
            b.hitCooldownByEnemy.set(id, 0.35);
          }
        }
      });
    });
  }

  // === 적 처치 ===
  private killEnemy(e: Enemy, byProj: Projectile | null): void {
    const def = e.def;
    // 보스였다면
    if (def.id === 'boss') {
      this.bossActive = false;
    }
    // 폭발
    if (byProj?.explodeOnKill && byProj.explodeRadius > 0) {
      this.explosion(e.x, e.y, byProj.explodeRadius, byProj.damage * byProj.explodeDamageMul);
    }
    // 크레딧 오브 드랍
    this.spawnCreditOrb(e.x, e.y, def.credits);
    this.run.killsTotal += 1;
    this.enemies.release(e);
  }

  private explosion(x: number, y: number, radius: number, dmg: number): void {
    const v = this.vfx.acquire();
    v.x = x;
    v.y = y;
    v.radius = 0;
    v.maxRadius = radius;
    v.life = 0.32;
    v.maxLife = 0.32;
    v.color = '#ff9244';
    this.enemies.forEachActive((e) => {
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        e.hp -= dmg;
        e.flash = 0.08;
        this.spawnText(e.x, e.y - e.def.radius, `${Math.round(dmg)}`, '#ffb380', 0.5);
        if (e.hp <= 0) this.killEnemy(e, null);
      }
    });
  }

  // 일반 적 피격 (오라용)
  private hitEnemy(e: Enemy, dmg: number, s: SkillState, ignoreFlash = false): void {
    e.hp -= dmg;
    if (!ignoreFlash) e.flash = 0.08;
    this.spawnText(e.x, e.y - e.def.radius, `${Math.round(dmg)}`, '#bce8ff', 0.45);
    if (s.ignite && s.igniteDuration > 0) {
      e.igniteTime = Math.max(e.igniteTime, s.igniteDuration);
      const newDps = dmg * s.igniteDamageMulPerSec;
      if (newDps > e.igniteDps) e.igniteDps = newDps;
    }
    if (e.hp <= 0) this.killEnemy(e, null);
  }

  // === 가장 가까운 적 ===
  findNearestEnemy(maxRange: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxRange * maxRange;
    this.enemies.forEachActive((e) => {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestD) {
        bestD = d2;
        best = e;
      }
    });
    return best;
  }

  // === 크레딧 오브 ===
  private spawnCreditOrb(x: number, y: number, value: number): void {
    const o = this.creditOrbs.acquire();
    o.x = x;
    o.y = y;
    o.value = value;
    o.vx = (Math.random() - 0.5) * 80;
    o.vy = (Math.random() - 0.5) * 80;
    o.attracted = false;
  }

  private updateCreditOrbs(dt: number): void {
    const ps = this.build.player;
    const pr2 = ps.pickupRadius * ps.pickupRadius;
    this.creditOrbs.forEachActive((o) => {
      const dx = this.player.x - o.x;
      const dy = this.player.y - o.y;
      const d2 = dx * dx + dy * dy;
      // 초기 발사 감쇠
      o.vx *= Math.exp(-dt * 3);
      o.vy *= Math.exp(-dt * 3);
      // 픽업 범위 안에 들면 자성
      if (!o.attracted && d2 <= pr2) o.attracted = true;
      if (o.attracted) {
        const d = Math.sqrt(d2) || 0.001;
        const pull = 360;
        o.vx += (dx / d) * pull * dt;
        o.vy += (dy / d) * pull * dt;
        const v = Math.hypot(o.vx, o.vy);
        const max = 520;
        if (v > max) {
          o.vx = (o.vx / v) * max;
          o.vy = (o.vy / v) * max;
        }
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      // 픽업
      const closeR = 16;
      if (d2 < closeR * closeR) {
        const gained = Math.max(1, Math.round(o.value * ps.creditGainMul));
        this.run.credits += gained;
        this.spawnText(this.player.x, this.player.y - 22, `+${gained}c`, '#ffd86b', 0.5);
        this.creditOrbs.release(o);
      }
    });
  }

  // === VFX/Text ===
  private updateVfx(dt: number): void {
    this.vfx.forEachActive((v) => {
      v.life -= dt;
      const t = 1 - v.life / v.maxLife;
      v.radius = v.maxRadius * (0.6 + 0.4 * t);
      if (v.life <= 0) this.vfx.release(v);
    });
  }

  spawnText(x: number, y: number, text: string, color: string, life: number): void {
    const t = this.texts.acquire();
    t.x = x;
    t.y = y;
    t.vy = -38;
    t.text = text;
    t.life = life;
    t.maxLife = life;
    t.color = color;
  }

  private updateTexts(dt: number): void {
    this.texts.forEachActive((t) => {
      t.y += t.vy * dt;
      t.vy *= Math.exp(-dt * 2);
      t.life -= dt;
      if (t.life <= 0) this.texts.release(t);
    });
  }
}
