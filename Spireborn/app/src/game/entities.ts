// 풀링 대상 엔티티들의 단순한 데이터 클래스.
import type { EnemyDef } from '../types';

export class Enemy {
  active = false;
  x = 0;
  y = 0;
  hp = 0;
  maxHp = 0;
  def!: EnemyDef;
  // 점화 상태
  igniteTime = 0; // 남은 지속 시간 (초)
  igniteDps = 0;
  // 가벼운 넉백
  knockX = 0;
  knockY = 0;
  // 시각: 피격 플래시
  flash = 0;
}

export class Projectile {
  active = false;
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  damage = 0;
  pierceLeft = 0;
  // 이미 맞은 적 ID들 (관통 중 중복 타격 방지)
  hitIds: number[] = [];
  // 추적: 체인 대상 검색용
  chainLeft = 0;
  radius = 6;
  life = 0; // 남은 수명 (초)
  color = '#ffb347';
  // 생성한 스킬 상태 스냅샷에서 가져온 속성들
  explodeOnKill = false;
  explodeRadius = 0;
  explodeDamageMul = 0;
  ignite = false;
  igniteDuration = 0;
  igniteDamageMulPerSec = 0;
}

// 회전 칼날 (orbit) 인스턴스
export class OrbitBlade {
  active = false;
  // 부모(플레이어)로부터의 각도
  angle = 0;
  // 충돌 시 다시 칠 수 있도록 짧은 쿨다운
  hitCooldownByEnemy: Map<number, number> = new Map();
}

export class CreditOrb {
  active = false;
  x = 0;
  y = 0;
  value = 1;
  // 픽업되면 플레이어를 향해 가속
  vx = 0;
  vy = 0;
  attracted = false;
}

// 시각 효과 (폭발 같은 단발성)
export type VfxKind = 'ring' | 'arc';

export class Vfx {
  active = false;
  kind: VfxKind = 'ring';
  x = 0;
  y = 0;
  radius = 0;
  maxRadius = 0;
  life = 0; // 남은 시간 (초)
  maxLife = 0;
  color = '#ffffff';
  // arc 전용 — 정면 각도(라디안) 및 부채꼴 폭(라디안)
  angle = 0;
  arcSpan = 0;
}

// 데미지 숫자 띄우기
export class FloatingText {
  active = false;
  x = 0;
  y = 0;
  vy = 0;
  text = '';
  life = 0;
  maxLife = 0;
  color = '#ffffff';
  // 큰 데미지는 크게 표시
  size = 11;
}

// 작은 점/스파크 파티클 — 피격/처치/투사체 트레일 등에 두루 사용
export type ParticleKind = 'spark' | 'glow';

export class Particle {
  active = false;
  kind: ParticleKind = 'spark';
  x = 0;
  y = 0;
  vx = 0;
  vy = 0;
  life = 0;
  maxLife = 0;
  size = 2;
  color = '#ffffff';
  // 마찰계수 (0이면 등속, 양수면 점점 느려짐)
  drag = 0;
}
