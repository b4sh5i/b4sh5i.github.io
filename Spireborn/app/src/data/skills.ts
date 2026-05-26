import type { SkillDef } from '../types';

// 메인 스킬 카탈로그. 1차 범위에서 시전 방식이 다른 3종.
export const SKILLS: Record<string, SkillDef> = {
  fireball: {
    id: 'fireball',
    name: '파이어볼',
    description: '가장 가까운 적을 향해 화염 투사체를 발사한다.',
    baseDamage: 18,
    baseCooldown: 0.85,
    baseProjectileSpeed: 420,
    baseArea: 0,
    baseRange: 520,
    damageType: 'fire',
    color: '#ff7e3d',
    cast: { kind: 'projectile' },
  },
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
    baseArea: 110,
    baseRange: 0,
    damageType: 'lightning',
    color: '#9ad4ff',
    cast: { kind: 'aura', tickInterval: 0.55 },
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
