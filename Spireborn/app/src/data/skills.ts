import type { SkillDef } from '../types';

// 메인 스킬 카탈로그. 시전 방식과 거리대 별로 다양한 선택지.
// 단일 적 기준 DPS는 비슷한 곡선이지만, 근접계는 광역/리스크 보상이 있고
// 원거리계는 안전 대신 약간 낮은 광역 효율.
export const SKILLS: Record<string, SkillDef> = {
  // === 원거리 (projectile) ===
  fireball: {
    id: 'fireball',
    name: '파이어볼',
    description: '가장 가까운 적을 향해 화염 투사체를 발사한다.',
    baseDamage: 18,
    baseCooldown: 0.85,
    baseProjectileSpeed: 420,
    baseArea: 0,
    baseRange: 240,
    damageType: 'fire',
    color: '#ff7e3d',
    cast: { kind: 'projectile' },
  },
  iceShard: {
    id: 'iceShard',
    name: '얼음 파편',
    description: '느리지만 묵직한 얼음 파편을 발사한다.',
    baseDamage: 14,
    baseCooldown: 0.65,
    baseProjectileSpeed: 320,
    baseArea: 0,
    baseRange: 220,
    damageType: 'cold',
    color: '#7fd4ff',
    cast: { kind: 'projectile' },
  },
  lightningSpear: {
    id: 'lightningSpear',
    name: '번개 창',
    description: '빠르고 가벼운 번개 창. 짧은 쿨다운에 연사한다.',
    baseDamage: 9,
    baseCooldown: 0.4,
    baseProjectileSpeed: 620,
    baseArea: 0,
    baseRange: 270,
    damageType: 'lightning',
    color: '#bfe6ff',
    cast: { kind: 'projectile' },
  },

  // === 플레이어 중심 (orbit / aura) ===
  bladeOrbit: {
    id: 'bladeOrbit',
    name: '회전 칼날',
    description: '플레이어 주위를 도는 칼날이 닿는 적에게 데미지를 준다.',
    baseDamage: 9,
    baseCooldown: 0.18,
    baseProjectileSpeed: 0,
    baseArea: 22,
    baseRange: 0,
    damageType: 'physical',
    color: '#dcdcec',
    cast: { kind: 'orbit', orbitRadius: 64, rotationSpeed: 3.2 },
  },
  shockAura: {
    id: 'shockAura',
    name: '번개 오라',
    description: '플레이어 주변의 적에게 주기적으로 번개 피해를 준다.',
    baseDamage: 14,
    baseCooldown: 0,
    baseProjectileSpeed: 0,
    baseArea: 90,
    baseRange: 0,
    damageType: 'lightning',
    color: '#9ad4ff',
    cast: { kind: 'aura', tickInterval: 0.55 },
  },
  frostNova: {
    id: 'frostNova',
    name: '서리 폭발',
    description: '주변 넓은 범위에 느리고 강한 서리 폭발이 발생한다.',
    baseDamage: 26,
    baseCooldown: 0,
    baseProjectileSpeed: 0,
    baseArea: 130,
    baseRange: 0,
    damageType: 'cold',
    color: '#a8e6ff',
    cast: { kind: 'aura', tickInterval: 1.4 },
  },

  // === 근접 (slash) — 전방 부채꼴 즉시 강타 ===
  cleave: {
    id: 'cleave',
    name: '강타',
    description: '전방 넓은 부채꼴을 강하게 휘둘러 다수의 적을 베어낸다.',
    baseDamage: 24,
    baseCooldown: 0.7,
    baseProjectileSpeed: 0,
    baseArea: 0,
    baseRange: 80,
    damageType: 'physical',
    color: '#e8d8a0',
    cast: { kind: 'slash', arcDeg: 110, reach: 80 },
  },
  flameStrike: {
    id: 'flameStrike',
    name: '화염 일격',
    description: '좁고 빠른 화염 일격. 적을 점화시키기 쉽다.',
    baseDamage: 16,
    baseCooldown: 0.45,
    baseProjectileSpeed: 0,
    baseArea: 0,
    baseRange: 75,
    damageType: 'fire',
    color: '#ff9c4a',
    cast: { kind: 'slash', arcDeg: 65, reach: 75 },
  },
};

export function listSkills(): SkillDef[] {
  return Object.values(SKILLS);
}

export function getSkill(id: string): SkillDef {
  const s = SKILLS[id];
  if (!s) throw new Error(`Unknown skill: ${id}`);
  return s;
}
