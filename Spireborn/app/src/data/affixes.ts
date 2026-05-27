// Phase 4: 아이템 모드(접두/접미) 풀.
// 슬롯별로 prefix/suffix 6 종 씩. roll 값은 티어로 스케일되어 적용된다.
import type { ItemApplyCtx, ItemSlot } from '../types';

export interface AffixMod {
  id: string;
  label: string;            // "데미지 +" 같은 사람용 라벨 (값은 별도 포맷)
  shortName: string;        // 이름 생성용 짧은 단어
  apply: (ctx: ItemApplyCtx, roll: number) => void;
  format: (roll: number) => string; // 표시용 — 예: "12%"
  rollMin: number;          // 티어 1 기준 base 최솟값
  rollMax: number;          // 티어 1 기준 base 최댓값
  weight: number;           // 추첨 가중치
}

// === Weapon ===
const WEAPON_PREFIXES: AffixMod[] = [
  {
    id: 'wpn_pre_damage',
    label: '데미지',
    shortName: '예리한',
    apply: ({ skill }, r) => { skill.damageMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 12, rollMax: 32, weight: 5,
  },
  {
    id: 'wpn_pre_proj',
    label: '추가 투사체',
    shortName: '쌍날',
    apply: ({ skill }, r) => {
      skill.projectileCount += Math.max(1, Math.floor(r));
      skill.spreadDeg = Math.max(skill.spreadDeg, 10);
    },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 1, weight: 2,
  },
  {
    id: 'wpn_pre_cooldown',
    label: '쿨다운 −',
    shortName: '신속한',
    apply: ({ skill }, r) => { skill.cooldownMul *= 1 - r / 100; },
    format: (r) => `−${Math.round(r)}%`,
    rollMin: 6, rollMax: 18, weight: 4,
  },
  {
    id: 'wpn_pre_pierce',
    label: '관통',
    shortName: '꿰뚫는',
    apply: ({ skill }, r) => { skill.pierce += Math.max(1, Math.floor(r)); },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 2, weight: 3,
  },
  {
    id: 'wpn_pre_area',
    label: '광역',
    shortName: '광활한',
    apply: ({ skill }, r) => { skill.areaMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 25, weight: 3,
  },
  {
    id: 'wpn_pre_ignite',
    label: '점화 dps',
    shortName: '잔불의',
    apply: ({ skill }, r) => {
      skill.ignite = true;
      if (skill.igniteDuration === 0) skill.igniteDuration = 3;
      skill.igniteDamageMulPerSec = Math.max(skill.igniteDamageMulPerSec, 0.05) + r / 100;
    },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 25, rollMax: 70, weight: 2,
  },
];

const WEAPON_SUFFIXES: AffixMod[] = [
  {
    id: 'wpn_suf_projspeed',
    label: '투사체 속도',
    shortName: '폭풍',
    apply: ({ skill }, r) => { skill.projectileSpeedMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 35, weight: 4,
  },
  {
    id: 'wpn_suf_chain',
    label: '연쇄',
    shortName: '벼락',
    apply: ({ skill }, r) => { skill.chain += Math.max(1, Math.floor(r)); },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 2, weight: 3,
  },
  {
    id: 'wpn_suf_explode',
    label: '처치시 폭발',
    shortName: '폭염',
    apply: ({ skill }, r) => {
      skill.explodeOnKill = true;
      skill.explodeRadius = Math.max(skill.explodeRadius, 60);
      skill.explodeDamageMul = Math.max(skill.explodeDamageMul, 0.4) + r / 200;
    },
    format: (r) => `+${(r / 200).toFixed(2)}배`,
    rollMin: 20, rollMax: 60, weight: 2,
  },
  {
    id: 'wpn_suf_exploderad',
    label: '폭발 범위',
    shortName: '진동의',
    apply: ({ skill }, r) => {
      if (skill.explodeRadius === 0) skill.explodeRadius = 60;
      skill.explodeRadius *= 1 + r / 100;
    },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 12, rollMax: 35, weight: 3,
  },
  {
    id: 'wpn_suf_igduration',
    label: '점화 지속',
    shortName: '여운의',
    apply: ({ skill }, r) => {
      if (!skill.ignite) { skill.ignite = true; skill.igniteDuration = 0; }
      skill.igniteDuration += r / 10;
      if (skill.igniteDamageMulPerSec === 0) skill.igniteDamageMulPerSec = 0.15;
    },
    format: (r) => `+${(r / 10).toFixed(1)}초`,
    rollMin: 5, rollMax: 18, weight: 3,
  },
  {
    id: 'wpn_suf_damage',
    label: '데미지',
    shortName: '맹습',
    apply: ({ skill }, r) => { skill.damageMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 22, weight: 4,
  },
];

// === Amulet ===
const AMULET_PREFIXES: AffixMod[] = [
  {
    id: 'amu_pre_maxhp',
    label: '최대 체력',
    shortName: '활력의',
    apply: ({ player }, r) => { player.maxHp += r; },
    format: (r) => `+${Math.round(r)}`,
    rollMin: 25, rollMax: 60, weight: 5,
  },
  {
    id: 'amu_pre_movespeed',
    label: '이동 속도',
    shortName: '신속한',
    apply: ({ player }, r) => { player.moveSpeed *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 22, weight: 4,
  },
  {
    id: 'amu_pre_pickup',
    label: '픽업 범위',
    shortName: '자성의',
    apply: ({ player }, r) => { player.pickupRadius *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 15, rollMax: 40, weight: 4,
  },
  {
    id: 'amu_pre_creditgain',
    label: '크레딧 획득',
    shortName: '탐욕의',
    apply: ({ player }, r) => { player.creditGainMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 22, weight: 3,
  },
  {
    id: 'amu_pre_damage',
    label: '데미지',
    shortName: '분노의',
    apply: ({ skill }, r) => { skill.damageMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 22, weight: 3,
  },
  {
    id: 'amu_pre_area',
    label: '광역',
    shortName: '확장의',
    apply: ({ skill }, r) => { skill.areaMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 20, weight: 2,
  },
];

const AMULET_SUFFIXES: AffixMod[] = [
  {
    id: 'amu_suf_cooldown',
    label: '쿨다운 −',
    shortName: '속행',
    apply: ({ skill }, r) => { skill.cooldownMul *= 1 - r / 100; },
    format: (r) => `−${Math.round(r)}%`,
    rollMin: 5, rollMax: 14, weight: 4,
  },
  {
    id: 'amu_suf_projspeed',
    label: '투사체 속도',
    shortName: '질풍',
    apply: ({ skill }, r) => { skill.projectileSpeedMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 30, weight: 3,
  },
  {
    id: 'amu_suf_maxhp',
    label: '최대 체력',
    shortName: '강건',
    apply: ({ player }, r) => { player.maxHp += r; },
    format: (r) => `+${Math.round(r)}`,
    rollMin: 12, rollMax: 30, weight: 4,
  },
  {
    id: 'amu_suf_pierce',
    label: '관통',
    shortName: '관통',
    apply: ({ skill }, r) => { skill.pierce += Math.max(1, Math.floor(r)); },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 1, weight: 2,
  },
  {
    id: 'amu_suf_pickup',
    label: '픽업 범위',
    shortName: '유인',
    apply: ({ player }, r) => { player.pickupRadius *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 25, weight: 3,
  },
  {
    id: 'amu_suf_credit',
    label: '크레딧 획득',
    shortName: '횡재',
    apply: ({ player }, r) => { player.creditGainMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 6, rollMax: 15, weight: 3,
  },
];

// === Ring ===
const RING_PREFIXES: AffixMod[] = [
  {
    id: 'ring_pre_damage',
    label: '데미지',
    shortName: '폭풍의',
    apply: ({ skill }, r) => { skill.damageMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 24, weight: 5,
  },
  {
    id: 'ring_pre_cooldown',
    label: '쿨다운 −',
    shortName: '신속한',
    apply: ({ skill }, r) => { skill.cooldownMul *= 1 - r / 100; },
    format: (r) => `−${Math.round(r)}%`,
    rollMin: 5, rollMax: 15, weight: 4,
  },
  {
    id: 'ring_pre_proj',
    label: '추가 투사체',
    shortName: '파편의',
    apply: ({ skill }, r) => {
      skill.projectileCount += Math.max(1, Math.floor(r));
      skill.spreadDeg = Math.max(skill.spreadDeg, 12);
    },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 1, weight: 2,
  },
  {
    id: 'ring_pre_chain',
    label: '연쇄',
    shortName: '연결의',
    apply: ({ skill }, r) => { skill.chain += Math.max(1, Math.floor(r)); },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 1, weight: 3,
  },
  {
    id: 'ring_pre_area',
    label: '광역',
    shortName: '확장의',
    apply: ({ skill }, r) => { skill.areaMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 8, rollMax: 20, weight: 3,
  },
  {
    id: 'ring_pre_pierce',
    label: '관통',
    shortName: '관통의',
    apply: ({ skill }, r) => { skill.pierce += Math.max(1, Math.floor(r)); },
    format: (r) => `+${Math.max(1, Math.floor(r))}`,
    rollMin: 1, rollMax: 2, weight: 3,
  },
];

const RING_SUFFIXES: AffixMod[] = [
  {
    id: 'ring_suf_projspeed',
    label: '투사체 속도',
    shortName: '질풍',
    apply: ({ skill }, r) => { skill.projectileSpeedMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 10, rollMax: 28, weight: 4,
  },
  {
    id: 'ring_suf_explode',
    label: '처치시 폭발',
    shortName: '여진',
    apply: ({ skill }, r) => {
      skill.explodeOnKill = true;
      skill.explodeRadius = Math.max(skill.explodeRadius, 55);
      skill.explodeDamageMul = Math.max(skill.explodeDamageMul, 0.35) + r / 250;
    },
    format: (r) => `+${(r / 250).toFixed(2)}배`,
    rollMin: 20, rollMax: 55, weight: 2,
  },
  {
    id: 'ring_suf_maxhp',
    label: '최대 체력',
    shortName: '수호',
    apply: ({ player }, r) => { player.maxHp += r; },
    format: (r) => `+${Math.round(r)}`,
    rollMin: 12, rollMax: 28, weight: 3,
  },
  {
    id: 'ring_suf_movespeed',
    label: '이동 속도',
    shortName: '경쾌',
    apply: ({ player }, r) => { player.moveSpeed *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 6, rollMax: 14, weight: 3,
  },
  {
    id: 'ring_suf_credit',
    label: '크레딧 획득',
    shortName: '광휘',
    apply: ({ player }, r) => { player.creditGainMul *= 1 + r / 100; },
    format: (r) => `+${Math.round(r)}%`,
    rollMin: 5, rollMax: 14, weight: 3,
  },
  {
    id: 'ring_suf_ignitedur',
    label: '점화 지속',
    shortName: '잔열',
    apply: ({ skill }, r) => {
      if (!skill.ignite) { skill.ignite = true; skill.igniteDuration = 0; }
      skill.igniteDuration += r / 10;
      if (skill.igniteDamageMulPerSec === 0) skill.igniteDamageMulPerSec = 0.12;
    },
    format: (r) => `+${(r / 10).toFixed(1)}초`,
    rollMin: 5, rollMax: 14, weight: 2,
  },
];

export const PREFIXES: Record<ItemSlot, AffixMod[]> = {
  weapon: WEAPON_PREFIXES,
  amulet: AMULET_PREFIXES,
  ring: RING_PREFIXES,
};

export const SUFFIXES: Record<ItemSlot, AffixMod[]> = {
  weapon: WEAPON_SUFFIXES,
  amulet: AMULET_SUFFIXES,
  ring: RING_SUFFIXES,
};

// affixId -> AffixMod 빠른 조회
const ALL_AFFIXES: Record<string, AffixMod> = {};
for (const slot of Object.keys(PREFIXES) as ItemSlot[]) {
  for (const m of PREFIXES[slot]) ALL_AFFIXES[m.id] = m;
  for (const m of SUFFIXES[slot]) ALL_AFFIXES[m.id] = m;
}

export function getAffix(id: string): AffixMod | undefined {
  return ALL_AFFIXES[id];
}
