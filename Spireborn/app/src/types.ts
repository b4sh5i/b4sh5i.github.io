// 핵심 도메인 타입들. 데이터 주도 설계 — 스킬/서포트/아이템/적은 모두 데이터로 정의된다.

export type Vec2 = { x: number; y: number };

export type DamageType = 'physical' | 'fire' | 'cold' | 'lightning';

// === 스킬 옵션 ===
// 메인 스킬은 def(불변) + state(런 중 누적)로 분리.
// state는 서포트/아이템/정비 화면에서 모두 같은 필드를 수정한다.
export interface SkillState {
  // 양적
  damageMul: number; // 1.0 = 100%
  cooldownMul: number; // 1.0 = 100% (낮을수록 빠름)
  projectileSpeedMul: number;
  areaMul: number;
  // 발사 수/이동 변형
  projectileCount: number;
  spreadDeg: number; // 0이면 추적 발사
  // 질적 효과
  pierce: number; // 추가 관통 수
  chain: number; // 처치 후 다음 대상으로 튕기는 횟수
  explodeOnKill: boolean;
  explodeRadius: number;
  explodeDamageMul: number; // 본체 데미지 대비
  ignite: boolean; // 점화: DoT 부여
  igniteDuration: number; // 초
  igniteDamageMulPerSec: number; // 본체 데미지 대비 초당
  // 시각
  color: string;
}

export function defaultSkillState(): SkillState {
  return {
    damageMul: 1,
    cooldownMul: 1,
    projectileSpeedMul: 1,
    areaMul: 1,
    projectileCount: 1,
    spreadDeg: 0,
    pierce: 0,
    chain: 0,
    explodeOnKill: false,
    explodeRadius: 0,
    explodeDamageMul: 0,
    ignite: false,
    igniteDuration: 0,
    igniteDamageMulPerSec: 0,
    color: '#ffb347',
  };
}

// === 스킬 정의 ===
export interface SkillDef {
  id: string;
  name: string;
  description: string;
  // 기본 수치들 (state의 배율이 곱해진다)
  baseDamage: number;
  baseCooldown: number; // 초
  baseProjectileSpeed: number; // px/s
  baseArea: number; // 반경 (px)
  baseRange: number; // 사거리/탐색 반경 (px)
  damageType: DamageType;
  color: string;
  // 시전 방식
  cast: SkillCastKind;
}

export type SkillCastKind =
  | { kind: 'projectile' } // 가장 가까운 적을 향해 발사
  | { kind: 'orbit'; orbitRadius: number; rotationSpeed: number } // 플레이어 주위 회전 칼날
  | { kind: 'aura'; tickInterval: number }; // 일정 주기로 주변 데미지

// === 서포트 젬 ===
export interface SupportDef {
  id: string;
  name: string;
  description: string;
  kind: 'quantitative' | 'qualitative';
  // 정비 화면에서 조정 가능한 옵션. 각 옵션은 step 단위로 ±점.
  options: SupportOption[];
  // 한 스킬에 같은 서포트는 한 번만 부착 가능 (대신 정비에서 수치 강화)
}

export interface SupportOption {
  key: string; // 식별용
  label: string;
  // 한 점(point) 당 SkillState에 적용되는 변경량
  apply: (state: SkillState, value: number) => void;
  // 표시용 포맷터
  format: (value: number) => string;
  // 옵션이 가질 수 있는 점수 범위
  min: number;
  max: number;
  initial: number;
}

// === 부착된 서포트 (런 인스턴스) ===
export interface SupportInstance {
  defId: string;
  // 옵션 키 -> 현재 점수
  values: Record<string, number>;
}

// === 아이템 ===
export interface ItemDef {
  id: string;
  name: string;
  description: string;
  slot: 'weapon' | 'amulet' | 'ring';
  // 아이템도 SkillState/PlayerStats 양쪽에 영향을 줄 수 있다.
  apply: (ctx: ItemApplyCtx) => void;
}

export interface PlayerStats {
  maxHp: number;
  moveSpeed: number; // px/s
  pickupRadius: number; // px
  creditGainMul: number;
}

export function defaultPlayerStats(): PlayerStats {
  return {
    maxHp: 100,
    moveSpeed: 180,
    pickupRadius: 60,
    creditGainMul: 1,
  };
}

export interface ItemApplyCtx {
  player: PlayerStats;
  skill: SkillState;
}

// === 적 ===
export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  damage: number;
  moveSpeed: number; // px/s
  radius: number;
  // 처치 시 드랍하는 크레딧 (정비 화폐 — 옛 xp 자리)
  credits: number;
  color: string;
  // 등장 가중치 (층 기반 풀에서 사용)
  weight?: number;
  minFloor?: number;
}

// === 런 상태 (저장 단위) ===
export interface RunState {
  version: number;
  seed: number;
  floor: number;
  // 진행 단계
  phase: 'fighting' | 'cleared' | 'levelup' | 'maintenance' | 'dead';
  // 플레이어
  playerHp: number;
  // 빌드
  mainSkillId: string;
  supports: SupportInstance[];
  itemIds: string[];
  // 크레딧 — 잡몹 처치로 획득, 정비 옵션 강화에 사용
  credits: number;
  // 누적 통계
  killsTotal: number;
  timeAliveSec: number;
  // 현재 층에서 경과한 시간
  floorElapsedSec: number;
}

// === 영구 보관 (최고 기록) ===
export interface MetaState {
  highestFloor: number;
  longestSurvivalSec: number;
  runsPlayed: number;
}

export function defaultMetaState(): MetaState {
  return {
    highestFloor: 0,
    longestSurvivalSec: 0,
    runsPlayed: 0,
  };
}
