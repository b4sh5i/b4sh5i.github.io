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
  | { kind: 'aura'; tickInterval: number } // 일정 주기로 주변 데미지
  | { kind: 'slash'; arcDeg: number; reach: number }; // 전방 부채꼴 즉시 강타 (근접)

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

// === 메인 스킬 인스턴스 (Phase 3) ===
// PoE2 식 내장 소켓. 소켓 0 은 항상 메인 스킬 자리 — socketed[0] = null.
// links[i] = true 면 socket i 와 socket i+1 사이가 연결.
// links 의 길이는 sockets - 1.
export interface SkillInstance {
  defId: string;
  sockets: number;           // 3..6
  links: boolean[];          // length = sockets - 1
  socketed: (SupportInstance | null)[]; // length = sockets, [0]은 null
}

// === 아이템 ===
export type ItemSlot = 'weapon' | 'amulet' | 'ring';

// 아이템 모드(접두/접미) — Phase 4. ItemDef는 더 이상 정적 카탈로그가 아니라 모드 풀에서 굴려서 만든다.
export interface ItemMod {
  affixId: string; // 모드 정의 id (affixes.ts 의 AffixMod.id)
  roll: number;    // 실제 적용된 값
  tier: number;    // 1 = 가장 강함, 5 = 가장 약함
}

export interface ItemInstance {
  id: string;
  slot: ItemSlot;
  name: string;          // 모드에 따라 자동 생성
  prefixes: ItemMod[];   // 최대 2
  suffixes: ItemMod[];   // 최대 2
  enhanced: boolean;     // 강화 1회 사용 여부 (한 아이템당 1회)
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
export type EnemyRole = 'normal' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  // 'boss'면 보스 풀에 속하고 처치 시 화톳불을 점화한다. 비우면 'normal'.
  role?: EnemyRole;
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
  // fighting: 잡몹 웨이브
  // boss: 잡몹 정지, 보스 1마리
  // bossfire: 보스 처치 후 폭발/화톳불 휴식 (NPC 상호작용 대기)
  // bonfire: NPC와 상호작용해 정비 UI 열림
  // dead: 사망
  phase: 'fighting' | 'boss' | 'bossfire' | 'bonfire' | 'dead';
  // 플레이어
  playerHp: number;
  // 빌드 (Phase 3 이후)
  mainSkill: SkillInstance;
  // supports = 미장착 서포트 인벤토리. 소켓에 박힌 것은 mainSkill.socketed[i] 에 있음.
  supports: SupportInstance[];
  // 장착 아이템 (Phase 4 이후 ItemInstance 기반)
  items: ItemInstance[];
  // 크레딧 — 잡몹 처치로 획득, 정비 옵션 강화에 사용
  credits: number;
  // 누적 통계
  killsTotal: number;
  timeAliveSec: number;
  // 현재 층에서 경과한 시간
  floorElapsedSec: number;
  // 현재 층에서 누적된 크레딧 획득량 — 자동 줍기 비용(5%) 계산용
  floorCreditsEarned: number;
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
