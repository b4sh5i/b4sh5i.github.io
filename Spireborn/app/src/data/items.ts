import type { ItemDef } from '../types';

// 아이템 — 시너지 축 (4.4). 메인 스킬과 결합되는 강한 모디파이어.
// 1차 범위에서는 간단한 형태로 시작.
export const ITEMS: Record<string, ItemDef> = {
  ember_focus: {
    id: 'ember_focus',
    name: '잔불의 초점',
    description: '데미지 +15%, 점화 활성화 시 점화 피해 +30%',
    slot: 'weapon',
    apply: ({ skill }) => {
      skill.damageMul *= 1.15;
      if (skill.ignite) skill.igniteDamageMulPerSec *= 1.3;
    },
  },
  storm_band: {
    id: 'storm_band',
    name: '폭풍의 띠',
    description: '쿨다운 −12%, 투사체 속도 +20%',
    slot: 'ring',
    apply: ({ skill }) => {
      skill.cooldownMul *= 0.88;
      skill.projectileSpeedMul *= 1.2;
    },
  },
  swift_boots: {
    id: 'swift_boots',
    name: '신속의 부츠',
    description: '이동 속도 +25%, 픽업 범위 +20%',
    slot: 'amulet',
    apply: ({ player }) => {
      player.moveSpeed *= 1.25;
      player.pickupRadius *= 1.2;
    },
  },
  vital_amulet: {
    id: 'vital_amulet',
    name: '활력의 부적',
    description: '최대 체력 +40, 크레딧 획득 +15%',
    slot: 'amulet',
    apply: ({ player }) => {
      player.maxHp += 40;
      player.creditGainMul *= 1.15;
    },
  },
  shard_ring: {
    id: 'shard_ring',
    name: '파편의 반지',
    description: '추가 투사체 +1, 데미지 +8%',
    slot: 'ring',
    apply: ({ skill }) => {
      skill.projectileCount += 1;
      skill.spreadDeg = Math.max(skill.spreadDeg, 10);
      skill.damageMul *= 1.08;
    },
  },
};

export function listItems(): ItemDef[] {
  return Object.values(ITEMS);
}

export function getItem(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item: ${id}`);
  return it;
}
