// 게임 시뮬레이션의 핵심 — 플레이어, 적, 투사체, 충돌, 데미지를 다룬다.
// UI/입력/저장과 분리해 단위로 update/render만 호출되도록 한다.
import type { DamageType, RunState, SkillState } from '../types';
import { getSkill } from '../data/skills';
import { bossPoolFor, spawnPoolFor } from '../data/enemies';
import { listSupports } from '../data/supports';
import { Pool } from '../util/pool';
import { RNG } from '../util/rng';
import {
  Enemy,
  Projectile,
  OrbitBlade,
  CreditOrb,
  Vfx,
  FloatingText,
  Particle,
} from './entities';
import { specForFloor, currentSpawnInterval, FloorSpec } from './floor';
import { computeBuild, ComputedBuild, makeSupportInstance } from './build';

export interface WorldEvents {
  onPlayerHurt?: () => void;
  onBossDefeated?: () => void;
  onBonfireOpened?: () => void;
  onPlayerDead?: () => void;
}

// 보스 처치 후 화톳불이 드러나는 폭발 연출 길이.
const BOSS_EXPLODE_TIME = 0.8;
const BOSS_EXPLODE_RADIUS = 130;
// NPC 와 인접하다고 판정하는 거리. 이 이내에서 상호작용 입력 시 정비 진입.
export const NPC_INTERACT_RANGE = 60;

// 한 층의 원형 아레나 반경 (월드 단위). 층마다 살짝 커지면서 적이 등장 후
// 충분한 진입 거리를 확보하도록 여유 있게 잡는다.
export function arenaRadius(floor: number): number {
  return 440 + Math.min(220, (floor - 1) * 10);
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
    // 무기 휘두름 애니메이션 — attackPhase 가 양수일 때 진행 중.
    attackPhase: 0,
    attackDuration: 0.22,
    attackKind: 'idle' as 'idle' | 'slash' | 'thrust',
    // 슬래시 방향 — 매 타격마다 좌우 교대로 휘둘러 자연스럽게 보이게.
    attackDir: 1 as 1 | -1,
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
  particles = new Pool<Particle>(() => new Particle());

  // 아레나
  arenaR = 440;

  // 적 ID 발급기 (관통 중복 방지용)
  private nextEnemyId = 1;
  private enemyIds = new WeakMap<Enemy, number>();

  // 스폰 누적
  private spawnAccum = 0;
  private bossSpawned = false;
  // 보스 폭발 진행 시간 (역카운트). > 0 이면 폭발 연출 중.
  private bossExplodeTime = 0;
  private bossExplodePos = { x: 0, y: 0 };

  // 화톳불 / NPC — 보스 처치 후 폭발이 끝나는 시점에 생성.
  bonfire: { x: number; y: number; sparkPhase: number } | null = null;
  npc: { x: number; y: number; bob: number } | null = null;
  // NPC 와 상호작용 가능한 거리 안에 있는지 (Game 에서 프롬프트 표시용)
  npcInRange = false;
  // 외부에서 누른 상호작용 입력 (E / 탭). update에서 소비.
  private interactQueued = false;

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

  // 카메라 셰이크 — 남은 지속 시간 / 진폭(픽셀) / 위상
  shakeT = 0;
  shakeMaxT = 0;
  shakeAmp = 0;
  private shakeTime = 0;
  // 외부(Renderer)에서 매 프레임 카메라에 더할 오프셋
  cameraOffsetX = 0;
  cameraOffsetY = 0;

  // 히트스톱 — 남은 시간(초). 0보다 크면 시뮬레이션 dt 를 거의 0으로 줄여
  // 한 프레임 정지된 듯한 무게감을 만든다. 강한 명중/보스 처치에서만 사용.
  hitstopT = 0;

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
    this.run.floorCreditsEarned = 0;
    this.run.phase = 'fighting';
    this.floorSpec = specForFloor(this.run.floor);
    this.arenaR = arenaRadius(this.run.floor);
    this.rng = new RNG(this.runSeedForFloor());
    this.spawnAccum = 0;
    this.bossSpawned = false;
    this.bossExplodeTime = 0;
    this.bonfire = null;
    this.npc = null;
    this.npcInRange = false;
    this.interactQueued = false;
    this.enemies.clear();
    this.projectiles.clear();
    this.creditOrbs.clear();
    this.vfx.clear();
    this.texts.clear();
    this.particles.clear();
    this.player.x = 0;
    this.player.y = 0;
    this.nextCast = 0;
    this.auraTick = 0;
    this.refreshOrbitBlades();
  }

  // 외부(키보드/탭)에서 상호작용 요청. update에서 phase/거리 조건 만족 시 'bonfire' 전환.
  queueInteract(): void {
    this.interactQueued = true;
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
    const def = getSkill(this.run.mainSkill.defId);
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
    if (this.paused) return;
    const phase = this.run.phase;
    if (phase === 'dead' || phase === 'bonfire') return;
    // 히트스톱 — 시뮬레이션을 거의 멈춤 (VFX/파티클은 자체 시간으로 진행하도록 dt를 0이 아닌 매우 작은 값으로).
    // 카메라 셰이크와 VFX 페이드는 계속 흐르게 두기 위해 한 번 분기.
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      // VFX/파티클/텍스트만 정상 속도로, 게임 로직은 패스.
      this.updateShake(dt);
      this.updateVfx(dt);
      this.updateParticles(dt);
      this.updateTexts(dt);
      return;
    }

    // 플레이어 이동 / 카메라 / 무적 — fighting · boss · bossfire 모두 동일
    const ps = this.build.player;
    const moveMag = Math.hypot(this.inputX, this.inputY);
    this.player.x += this.inputX * ps.moveSpeed * dt;
    this.player.y += this.inputY * ps.moveSpeed * dt;
    if (this.player.invuln > 0) this.player.invuln -= dt;
    if (this.player.flash > 0) this.player.flash -= dt;
    if (this.player.attackPhase > 0) this.player.attackPhase -= dt;

    // 바라보는 방향 — 이동 중이면 진행 방향, 정지하면 가장 가까운 적쪽
    if (moveMag > 0.05) {
      this.player.facing = Math.atan2(this.inputY, this.inputX);
      this.player.stepPhase += dt * 8 * moveMag;
    } else {
      const tgt = this.findNearestEnemy(600);
      if (tgt) {
        const dx = tgt.x - this.player.x;
        const dy = tgt.y - this.player.y;
        this.player.facing = Math.atan2(dy, dx);
      } else if (this.npc) {
        // 적이 없을 땐 NPC 쪽을 바라본다 (자연스러운 휴식 톤)
        const dx = this.npc.x - this.player.x;
        const dy = this.npc.y - this.player.y;
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

    // 카메라 — 플레이어 추적 + 셰이크 오프셋
    this.cameraX = this.player.x;
    this.cameraY = this.player.y;
    this.updateShake(dt);

    // 시각 효과 / 부유 텍스트 / 크레딧 오브는 항상 진행
    this.updateVfx(dt);
    this.updateParticles(dt);
    this.updateTexts(dt);
    this.updateCreditOrbs(dt);

    if (phase === 'fighting') {
      this.run.floorElapsedSec += dt;
      this.run.timeAliveSec += dt;
      // 보스 등장 트리거
      if (
        !this.bossSpawned &&
        this.run.floorElapsedSec >= this.floorSpec.durationSec
      ) {
        this.spawnBoss();
      } else {
        // 잡몹 스폰
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
      this.autoCast(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateOrbits(dt);
    } else if (phase === 'boss') {
      this.run.timeAliveSec += dt;
      // 보스 등장 후엔 잡몹 스폰 정지. 적/투사체/스킬은 그대로 동작.
      this.autoCast(dt);
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateOrbits(dt);
    } else if (phase === 'bossfire') {
      this.run.timeAliveSec += dt;
      // 폭발 카운트다운 — 끝나면 화톳불 + NPC 드러남
      if (this.bossExplodeTime > 0) {
        this.bossExplodeTime -= dt;
        if (this.bossExplodeTime <= 0) {
          this.bossExplodeTime = 0;
          this.spawnBonfire(this.bossExplodePos.x, this.bossExplodePos.y);
        }
      }
      // 화톳불 / NPC 애니메이션 진행
      if (this.bonfire) this.bonfire.sparkPhase += dt;
      if (this.npc) this.npc.bob += dt;
      // NPC 인접 + 상호작용 입력 → 정비 진입
      this.npcInRange = false;
      if (this.npc) {
        const dx = this.npc.x - this.player.x;
        const dy = this.npc.y - this.player.y;
        const d = Math.hypot(dx, dy);
        this.npcInRange = d <= NPC_INTERACT_RANGE;
        if (this.npcInRange && this.interactQueued) {
          this.run.phase = 'bonfire';
          this.events.onBonfireOpened?.();
        }
      }
      // 남은 적 / 투사체 / 칼날도 마저 정리되도록 갱신
      this.updateEnemies(dt);
      this.updateProjectiles(dt);
      this.updateOrbits(dt);
    }
    this.interactQueued = false;

    // 사망 체크 — 어느 phase에서든 동일
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
    e.chillTime = 0;
    e.shockTime = 0;
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
    this.run.phase = 'boss';
    // 보스 풀에서 추첨 — 같은 층에선 결정적 시드로 같은 보스 유지
    const pool = bossPoolFor(this.run.floor);
    const def = this.rng.pick(pool);
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
    this.spawnText(e.x, e.y - 40, `${def.name} 등장`, def.color, 1.8);
  }

  private spawnBonfire(x: number, y: number): void {
    this.bonfire = { x, y, sparkPhase: 0 };
    // NPC 는 화톳불 옆 (오른쪽으로 약간 떨어져)
    this.npc = { x: x + 42, y: y + 6, bob: 0 };
    this.spawnText(x, y - 28, '화톳불 점화', '#ffa760', 2.0);
  }

  // 보스 드랍: Phase 2 단독 빌드용 임시 — 미보유 서포트 중 1개를 자동 인벤토리 추가.
  // 추후 Phase 3 의 상점 구매 / 소켓 UI 와 통합되면 제거.
  private dropBossSupport(): void {
    const already = new Set(this.run.supports.map((s) => s.defId));
    const pool = listSupports().filter((s) => !already.has(s.id));
    if (pool.length === 0) return;
    const def = pool[Math.floor(this.rng.next() * pool.length)];
    this.run.supports.push(makeSupportInstance(def.id));
    this.rebuild();
    this.spawnText(
      this.player.x,
      this.player.y - 50,
      `+ 서포트 ${def.name}`,
      '#c8a4ff',
      2.4,
    );
  }

  // === 자동 시전 ===
  private autoCast(dt: number): void {
    const def = getSkill(this.run.mainSkill.defId);
    const s = this.build.skill;
    if (def.cast.kind === 'projectile') {
      this.nextCast -= dt;
      if (this.nextCast <= 0) {
        const target = this.findNearestEnemy(def.baseRange);
        if (target) {
          this.fireProjectiles(def.color, def.baseDamage, def.baseProjectileSpeed, s, target, def.damageType);
          this.triggerAttackAnim('thrust');
          this.spawnMuzzleFlash(this.player.x, this.player.y, def.color, def.damageType, target);
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
        this.auraPulse(def.baseDamage, def.baseArea * s.areaMul, def.color, s, def.damageType);
        this.triggerAttackAnim('thrust');
      }
    } else if (def.cast.kind === 'orbit') {
      // 회전은 updateOrbits에서 다룸 — 여기선 칼날 회전만 진행
      const speed = def.cast.rotationSpeed * (s.projectileSpeedMul || 1);
      this.orbitAngle += dt * speed;
    } else if (def.cast.kind === 'slash') {
      this.nextCast -= dt;
      if (this.nextCast <= 0) {
        // slash 는 reach 안에 있는 적만 타격 — baseRange 는 사용하지 않고 reach 로 검색
        const target = this.findNearestEnemy(def.cast.reach + 40);
        if (target) {
          this.slashStrike(def.baseDamage, def.cast.arcDeg, def.cast.reach, def.color, s, target, def.damageType);
          this.triggerAttackAnim('slash');
          this.nextCast = def.baseCooldown * s.cooldownMul;
        } else {
          this.nextCast = 0.15;
        }
      }
    }
  }

  // 무기 휘두름 애니메이션 트리거 — Renderer 가 player.attackPhase 를 읽어 모션을 그린다.
  private triggerAttackAnim(kind: 'slash' | 'thrust'): void {
    const p = this.player;
    if (kind === 'slash') {
      p.attackDuration = 0.22;
      p.attackDir = p.attackDir === 1 ? -1 : 1;
    } else {
      p.attackDuration = 0.16;
    }
    p.attackKind = kind;
    p.attackPhase = p.attackDuration;
  }

  private fireProjectiles(
    color: string,
    baseDamage: number,
    baseSpeed: number,
    s: SkillState,
    target: Enemy,
    damageType: DamageType,
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
      this.spawnProjectile(this.player.x, this.player.y, a, color, baseDamage, baseSpeed, s, damageType);
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
    damageType: DamageType,
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
    p.radius = damageType === 'cold' ? 7 : damageType === 'lightning' ? 5 : 6;
    p.life = 0.75;
    p.color = color;
    p.damageType = damageType;
    p.spin = this.rng.next() * Math.PI * 2;
    p.explodeOnKill = s.explodeOnKill;
    p.explodeRadius = s.explodeRadius * s.areaMul;
    p.explodeDamageMul = s.explodeDamageMul;
    p.ignite = s.ignite;
    p.igniteDuration = s.igniteDuration;
    p.igniteDamageMulPerSec = s.igniteDamageMulPerSec;
  }

  // 시전 위치 머즐 플래시 — 짧고 강한 발광 + 진행 방향 파편.
  private spawnMuzzleFlash(
    x: number,
    y: number,
    color: string,
    damageType: DamageType,
    target: Enemy,
  ): void {
    const ang = Math.atan2(target.y - y, target.x - x);
    // 진행 방향으로 살짝 앞쪽에 위치
    const fx = x + Math.cos(ang) * 12;
    const fy = y + Math.sin(ang) * 12;
    const v = this.vfx.acquire();
    v.kind = 'muzzle';
    v.x = fx;
    v.y = fy;
    v.radius = 0;
    v.maxRadius = 22;
    v.life = 0.16;
    v.maxLife = 0.16;
    v.color = color;
    v.angle = ang;
    v.arcSpan = Math.PI * 0.7;
    v.damageType = damageType;
    v.phase = this.rng.next() * Math.PI * 2;
    // 진행 방향 정렬된 스파크 — 타입에 따라 분포 조정
    const sparkCount = damageType === 'lightning' ? 5 : damageType === 'cold' ? 7 : 6;
    this.spawnHitSparks(fx, fy, color, sparkCount, 260, {
      baseAngle: ang,
      spread: damageType === 'lightning' ? Math.PI * 0.35 : Math.PI * 0.55,
      life: 0.28,
      size: damageType === 'lightning' ? 1.4 : 2,
    });
    // 발 아래 룬 (PoE 식 캐스트 잔재) — fire/cold/lightning 만
    if (damageType !== 'physical') {
      const rune = this.vfx.acquire();
      rune.kind = 'rune';
      rune.x = x;
      rune.y = y + 4;
      rune.radius = 0;
      rune.maxRadius = 24;
      rune.life = 0.32;
      rune.maxLife = 0.32;
      rune.color = color;
      rune.damageType = damageType;
      rune.phase = this.rng.next() * Math.PI * 2;
    }
  }

  private auraPulse(
    baseDamage: number,
    radius: number,
    color: string,
    s: SkillState,
    damageType: DamageType,
  ): void {
    const dmg = baseDamage * s.damageMul;
    // 시각 효과 — 펄스 링 (타입별 다른 형태)
    const vfx = this.vfx.acquire();
    vfx.kind = 'ring';
    vfx.x = this.player.x;
    vfx.y = this.player.y;
    vfx.radius = 0;
    vfx.maxRadius = radius;
    vfx.maxLife = 0.4;
    vfx.life = vfx.maxLife;
    vfx.color = color;
    vfx.damageType = damageType;
    vfx.phase = this.rng.next() * Math.PI * 2;

    // 범위 내 모든 적에게 데미지
    this.enemies.forEachActive((e) => {
      const dx = e.x - this.player.x;
      const dy = e.y - this.player.y;
      if (dx * dx + dy * dy <= radius * radius) {
        this.hitEnemy(e, dmg, s, true, damageType);
      }
    });
  }

  // 전방 부채꼴 즉시 타격 — target 이 가리키는 방향을 기준으로 arcDeg/reach 만큼.
  private slashStrike(
    baseDamage: number,
    arcDeg: number,
    reach: number,
    color: string,
    s: SkillState,
    target: Enemy,
    damageType: DamageType,
  ): void {
    const dmg = baseDamage * s.damageMul;
    const reachScaled = reach * s.areaMul;
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const aim = Math.atan2(dy, dx);
    this.player.facing = aim;
    const half = (arcDeg * Math.PI) / 180 / 2;

    // 시각 효과 — 부채꼴
    const vfx = this.vfx.acquire();
    vfx.kind = 'arc';
    vfx.x = this.player.x;
    vfx.y = this.player.y;
    vfx.radius = 0;
    vfx.maxRadius = reachScaled;
    vfx.maxLife = 0.24;
    vfx.life = vfx.maxLife;
    vfx.color = color;
    vfx.angle = aim;
    vfx.arcSpan = half * 2;
    vfx.damageType = damageType;
    vfx.phase = this.rng.next() * Math.PI * 2;

    // 부채꼴 안 적 모두 타격
    this.enemies.forEachActive((e) => {
      const ex = e.x - this.player.x;
      const ey = e.y - this.player.y;
      const distSq = ex * ex + ey * ey;
      const reachWithEnemy = reachScaled + e.def.radius;
      if (distSq > reachWithEnemy * reachWithEnemy) return;
      // 각도 차이
      const ang = Math.atan2(ey, ex);
      let diff = ang - aim;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      if (Math.abs(diff) > half) return;
      this.hitEnemy(e, dmg, s, false, damageType);
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
      // 한기 적용 시 30% 둔화 (PoE 식 chill)
      const chillSlow = e.chillTime > 0 ? 0.7 : 1;
      const sp = e.def.moveSpeed * this.floorSpec.enemySpeedMul * chillSlow;
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
      // 한기/감전 ailment 감쇠
      if (e.chillTime > 0) e.chillTime -= dt;
      if (e.shockTime > 0) e.shockTime -= dt;

      // 플레이어 충돌
      if (dist < pr + e.def.radius && this.player.invuln <= 0) {
        const dmg = e.def.damage * this.floorSpec.enemyDmgMul;
        this.run.playerHp -= dmg;
        this.player.invuln = 0.6;
        this.player.flash = 0.15;
        this.events.onPlayerHurt?.();
        // 임팩트 — 붉은 스파크 + 큰 셰이크 + 짧은 붉은 페이드
        this.spawnHitSparks(this.player.x, this.player.y, '#ff6478', 12, 260, {
          life: 0.4,
          size: 2.4,
        });
        this.spawnImpactGlow(this.player.x, this.player.y, '#ff6478', 22);
        this.shake(0.32, 6);
        this.flashScreen('#b8243a', 0.18);
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
    e.knockX += (dx / len) * 80;
    e.knockY += (dy / len) * 80;
    e.flash = 0.14;
    e.hp -= p.damage;
    // 데미지 텍스트 색을 타입에 맞게
    const dmgColor = this.damageTextColor(p.damageType);
    this.spawnDamageText(e.x, e.y - e.def.radius, p.damage, dmgColor, 0.55);
    // 임팩트 — 투사체 진행 방향 반대로 스파크가 튀고 큰 글로우 한 번
    const impactAngle = Math.atan2(p.vy, p.vx);
    this.spawnTypedImpact(p.x, p.y, p.color, p.damageType, impactAngle + Math.PI);
    this.shake(0.18, 2.6);
    // 보스에는 매 명중마다 짧은 hitstop — 묵직한 타격감
    if (e.def.role === 'boss') {
      this.freeze(0.04);
    }
    // ailment 적용 — 타입별
    this.applyAilment(e, p.damageType, p.damage);
    // 점화 적용 (스킬 옵션)
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

  // 데미지 타입별 텍스트/이펙트 색
  private damageTextColor(type: DamageType): string {
    switch (type) {
      case 'fire': return '#ffb380';
      case 'cold': return '#bce8ff';
      case 'lightning': return '#e6e2ff';
      default: return '#ffe2b3';
    }
  }

  // 타입별 명중 임팩트 — 스파크 패턴/사이즈를 다르게.
  private spawnTypedImpact(
    x: number,
    y: number,
    color: string,
    type: DamageType,
    backAngle: number,
  ): void {
    if (type === 'lightning') {
      // 좁은 분포로 빠른 스파크 + 흰 코어
      this.spawnHitSparks(x, y, color, 10, 320, {
        baseAngle: backAngle,
        spread: Math.PI * 0.6,
        life: 0.22,
        size: 1.6,
      });
      this.spawnHitSparks(x, y, '#ffffff', 3, 360, {
        baseAngle: backAngle,
        spread: Math.PI * 0.45,
        life: 0.18,
        size: 1.2,
      });
      this.spawnImpactGlow(x, y, color, 22);
    } else if (type === 'cold') {
      // 결정 파편 — 사방으로 천천히
      this.spawnHitSparks(x, y, color, 10, 180, {
        spread: Math.PI * 2,
        life: 0.5,
        size: 2.2,
      });
      this.spawnImpactGlow(x, y, color, 20);
    } else if (type === 'fire') {
      // 깃털 일렁임 — 위쪽으로 살짝 솟아오름
      this.spawnHitSparks(x, y, color, 9, 240, {
        baseAngle: backAngle - Math.PI / 8,
        spread: Math.PI * 1.0,
        life: 0.42,
        size: 2.4,
      });
      this.spawnImpactGlow(x, y, color, 22);
      // 위쪽 잔열 스파크
      this.spawnHitSparks(x, y - 4, '#ffd9a0', 3, 100, {
        baseAngle: -Math.PI / 2,
        spread: Math.PI * 0.4,
        life: 0.55,
        size: 1.6,
      });
    } else {
      // 물리 — 기본 스파크
      this.spawnHitSparks(x, y, color, 8, 220, {
        baseAngle: backAngle,
        spread: Math.PI * 0.9,
        life: 0.35,
        size: 2.2,
      });
      this.spawnImpactGlow(x, y, color, 18);
    }
  }

  // PoE 식 ailment 부여. 한기는 cold, 감전은 lightning에서.
  private applyAilment(e: Enemy, type: DamageType, _dmg: number): void {
    if (type === 'cold') {
      e.chillTime = Math.max(e.chillTime, 1.6);
    } else if (type === 'lightning') {
      e.shockTime = Math.max(e.shockTime, 1.4);
    }
  }

  private chainProjectile(p: Projectile, fromEnemy: Enemy): void {
    p.chainLeft--;
    // 가장 가까운 다른 적 찾기
    const maxRange = 160;
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
    const def = getSkill(this.run.mainSkill.defId);
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
          e.flash = 0.14;
          this.spawnDamageText(e.x, e.y - e.def.radius, dmg, '#ffffff', 0.5);
          // 임팩트 — 타입별 스파크
          this.spawnTypedImpact(e.x, e.y, def.color, def.damageType, 0);
          // ailment
          this.applyAilment(e, def.damageType, dmg);
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
    if (def.role === 'boss') {
      this.killBoss(e);
      return;
    }
    // 일반 적 사망 임팩트 — 흰 코어 폭발 + 큰 컬러 글로우 + 파편
    this.spawnHitSparks(e.x, e.y, def.color, 14, 240, { life: 0.45, size: 2.2 });
    this.spawnHitSparks(e.x, e.y, '#ffffff', 5, 320, { life: 0.22, size: 1.6 });
    this.spawnImpactGlow(e.x, e.y, '#ffffff', 14);
    this.spawnImpactGlow(e.x, e.y, def.color, 28);
    this.shake(0.22, 3.2);
    // 짧은 hitstop — 잡몹은 매우 짧게 (체감만 살짝)
    this.freeze(0.035);
    if (byProj?.explodeOnKill && byProj.explodeRadius > 0) {
      this.explosion(
        e.x,
        e.y,
        byProj.explodeRadius,
        byProj.damage * byProj.explodeDamageMul,
      );
    }
    this.spawnCreditOrb(e.x, e.y, def.credits);
    this.run.killsTotal += 1;
    this.enemies.release(e);
  }

  // 보스 처치 — 데미지 재귀 없이 전용 연출.
  // (explosion() 을 재사용하면 보스 본인이 release되기 전에 다시 데미지를
  //  받아 killEnemy 가 재귀 호출되는 버그가 있었음 → 별도 함수로 분리.)
  private killBoss(boss: Enemy): void {
    const def = boss.def;
    const bx = boss.x;
    const by = boss.y;
    // 1) 보스를 먼저 release — 이후 어떤 forEachActive 도 보스를 건드리지 못함
    this.run.killsTotal += 1;
    this.enemies.release(boss);
    // 2) phase 전환
    this.run.phase = 'bossfire';
    this.bossExplodeTime = BOSS_EXPLODE_TIME;
    this.bossExplodePos = { x: bx, y: by };
    // 3) 시각 폭발 (데미지 없음)
    const ring = this.vfx.acquire();
    ring.kind = 'ring';
    ring.x = bx;
    ring.y = by;
    ring.radius = 0;
    ring.maxRadius = BOSS_EXPLODE_RADIUS;
    ring.life = 0.55;
    ring.maxLife = 0.55;
    ring.color = def.color;
    ring.damageType = 'physical';
    // 두 번째 큰 링 — 보스 톤
    const ring2 = this.vfx.acquire();
    ring2.kind = 'ring';
    ring2.x = bx;
    ring2.y = by;
    ring2.radius = 0;
    ring2.maxRadius = BOSS_EXPLODE_RADIUS * 1.6;
    ring2.life = 0.7;
    ring2.maxLife = 0.7;
    ring2.color = '#ffffff';
    ring2.damageType = 'physical';
    this.spawnHitSparks(bx, by, def.color, 28, 360, { life: 0.7, size: 2.6 });
    this.spawnHitSparks(bx, by, '#ffffff', 10, 420, { life: 0.4, size: 1.8 });
    this.spawnImpactGlow(bx, by, '#ffffff', 40);
    this.spawnImpactGlow(bx, by, def.color, 56);
    this.shake(0.55, 7);
    // 화이트아웃 + 깊은 hitstop (디아블로식 컷)
    this.flashScreen('#ffffff', 0.32);
    this.freeze(0.18);
    // 4) 남은 잡몹은 조용히 정리 — 데미지/재귀 없이 작은 이펙트만
    this.enemies.forEachActive((other) => {
      this.spawnHitSparks(other.x, other.y, other.def.color, 4, 180, {
        life: 0.25, size: 1.4,
      });
      this.spawnCreditOrb(other.x, other.y, other.def.credits);
      this.run.killsTotal += 1;
      this.enemies.release(other);
    });
    // 5) 클리어 보너스 + 보스 드랍 + 이벤트
    this.run.credits += this.floorSpec.creditClearBonus;
    this.run.floorCreditsEarned += this.floorSpec.creditClearBonus;
    this.spawnCreditOrb(bx, by, def.credits);
    this.dropBossSupport();
    this.events.onBossDefeated?.();
  }

  private explosion(x: number, y: number, radius: number, dmg: number): void {
    const v = this.vfx.acquire();
    v.kind = 'ring';
    v.x = x;
    v.y = y;
    v.radius = 0;
    v.maxRadius = radius;
    v.life = 0.32;
    v.maxLife = 0.32;
    v.color = '#ff9244';
    // 임팩트 — 화염 파편 + 셰이크
    this.spawnHitSparks(x, y, '#ff9244', 18, 300, { life: 0.45, size: 2.4 });
    this.spawnImpactGlow(x, y, '#ffd9a0', 32);
    this.shake(0.28, 4);
    this.enemies.forEachActive((e) => {
      // 이미 처치 중인 적은 건너뜀 — killEnemy 재귀 차단
      if (e.hp <= 0) return;
      // 보스는 폭발 광역 데미지에 영향받지 않게 (자기 사망 처리 별도 경로)
      if (e.def.role === 'boss') return;
      const dx = e.x - x;
      const dy = e.y - y;
      if (dx * dx + dy * dy <= radius * radius) {
        e.hp -= dmg;
        e.flash = 0.08;
        this.spawnDamageText(e.x, e.y - e.def.radius, dmg, '#ffb380', 0.5);
        if (e.hp <= 0) this.killEnemy(e, null);
      }
    });
  }

  // 일반 적 피격 (오라/슬래시용)
  private hitEnemy(
    e: Enemy,
    dmg: number,
    s: SkillState,
    ignoreFlash = false,
    damageType: DamageType = 'physical',
  ): void {
    e.hp -= dmg;
    if (!ignoreFlash) e.flash = 0.14;
    const dmgColor = this.damageTextColor(damageType);
    this.spawnDamageText(e.x, e.y - e.def.radius, dmg, dmgColor, 0.45);
    // 임팩트 — 타입별 다른 패턴
    this.spawnTypedImpact(e.x, e.y, s.color, damageType, 0);
    // ailment
    this.applyAilment(e, damageType, dmg);
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

  // 남은 크레딧 오브의 가치 합 — 자동 줍기 미리보기용
  remainingOrbValue(): number {
    const ps = this.build.player;
    let total = 0;
    this.creditOrbs.forEachActive((o) => {
      total += Math.max(1, Math.round(o.value * ps.creditGainMul));
    });
    return total;
  }

  // 활성 오브 수
  remainingOrbCount(): number {
    let n = 0;
    this.creditOrbs.forEachActive(() => {
      n += 1;
    });
    return n;
  }

  // 남은 모든 크레딧 오브를 즉시 회수. 비용 차감은 호출자 책임.
  // floorCreditsEarned 에는 누적하지 않는다 (이미 이 층에서 발생한 값이라 비용 계산이 변동하면 안 됨).
  autoCollectOrbs(): number {
    const ps = this.build.player;
    let gained = 0;
    this.creditOrbs.forEachActive((o) => {
      const v = Math.max(1, Math.round(o.value * ps.creditGainMul));
      gained += v;
      this.creditOrbs.release(o);
    });
    if (gained > 0) {
      this.run.credits += gained;
      this.spawnText(this.player.x, this.player.y - 22, `+${gained}c`, '#ffd86b', 0.6);
    }
    return gained;
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
        this.run.floorCreditsEarned += gained;
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

  private updateParticles(dt: number): void {
    this.particles.forEachActive((p) => {
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.release(p);
        return;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.drag > 0) {
        const damp = Math.exp(-p.drag * dt);
        p.vx *= damp;
        p.vy *= damp;
      }
    });
  }

  // 피격/처치 시 색깔 파편을 방사형으로 흩뿌린다.
  spawnHitSparks(
    x: number,
    y: number,
    color: string,
    count: number,
    speed: number,
    options: { spread?: number; baseAngle?: number; life?: number; size?: number } = {},
  ): void {
    const spread = options.spread ?? Math.PI * 2;
    const baseAngle = options.baseAngle ?? this.rng.next() * Math.PI * 2;
    const life = options.life ?? 0.35;
    const size = options.size ?? 2;
    for (let i = 0; i < count; i++) {
      const p = this.particles.acquire();
      const a = baseAngle + (spread === Math.PI * 2
        ? this.rng.next() * Math.PI * 2
        : -spread / 2 + this.rng.next() * spread);
      const sp = speed * (0.6 + this.rng.next() * 0.5);
      p.kind = 'spark';
      p.x = x;
      p.y = y;
      p.vx = Math.cos(a) * sp;
      p.vy = Math.sin(a) * sp;
      p.life = life * (0.7 + this.rng.next() * 0.6);
      p.maxLife = p.life;
      p.size = size * (0.8 + this.rng.next() * 0.6);
      p.color = color;
      p.drag = 5;
    }
  }

  // 카메라 셰이크 트리거 — 더 강한 셰이크가 약한 걸 덮어쓴다 (중첩 없음).
  shake(duration: number, amplitude: number): void {
    // 진행 중인 셰이크가 더 강하면 무시
    const remainingAmp = this.shakeT > 0 ? this.shakeAmp * (this.shakeT / this.shakeMaxT) : 0;
    if (amplitude < remainingAmp) return;
    this.shakeT = duration;
    this.shakeMaxT = duration;
    this.shakeAmp = amplitude;
  }

  // 히트스톱 — 짧은 게임 정지. 더 긴 hitstop 이 진행 중이면 무시.
  freeze(duration: number): void {
    if (duration > this.hitstopT) this.hitstopT = duration;
  }

  // 화면 전체 페이드 (보스 처치 화이트아웃 등). color는 'white' 권장.
  flashScreen(color: string, life: number): void {
    const v = this.vfx.acquire();
    v.kind = 'flash';
    v.x = 0;
    v.y = 0;
    v.radius = 0;
    v.maxRadius = 0;
    v.life = life;
    v.maxLife = life;
    v.color = color;
    v.damageType = 'physical';
    v.phase = 0;
  }

  private updateShake(dt: number): void {
    if (this.shakeT <= 0) {
      this.cameraOffsetX = 0;
      this.cameraOffsetY = 0;
      return;
    }
    this.shakeT -= dt;
    this.shakeTime += dt;
    const decay = Math.max(0, this.shakeT / this.shakeMaxT);
    // 빠르게 진동하면서 점점 잦아드는 톱니파형
    const f1 = Math.sin(this.shakeTime * 62) * decay;
    const f2 = Math.cos(this.shakeTime * 41) * decay;
    this.cameraOffsetX = f1 * this.shakeAmp;
    this.cameraOffsetY = f2 * this.shakeAmp;
    if (this.shakeT <= 0) {
      this.cameraOffsetX = 0;
      this.cameraOffsetY = 0;
    }
  }

  // 임팩트 발광 — 부드러운 글로우 점, 더 큰 사이즈
  spawnImpactGlow(x: number, y: number, color: string, size: number): void {
    const p = this.particles.acquire();
    p.kind = 'glow';
    p.x = x;
    p.y = y;
    p.vx = 0;
    p.vy = 0;
    p.life = 0.18;
    p.maxLife = p.life;
    p.size = size;
    p.color = color;
    p.drag = 0;
  }

  spawnText(x: number, y: number, text: string, color: string, life: number, size = 11): void {
    const t = this.texts.acquire();
    t.x = x;
    t.y = y;
    t.vy = -38;
    t.text = text;
    t.life = life;
    t.maxLife = life;
    t.color = color;
    t.size = size;
  }

  // 데미지 텍스트 — 데미지 값에 따라 크기가 자동으로 커진다.
  spawnDamageText(x: number, y: number, dmg: number, color: string, life = 0.5): void {
    // 10 데미지 ≈ 10pt, 100 데미지 ≈ 18pt 정도로 부드러운 곡선
    const size = Math.min(20, 9 + Math.log10(Math.max(1, dmg)) * 4.2);
    this.spawnText(x, y, `${Math.round(dmg)}`, color, life, size);
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
