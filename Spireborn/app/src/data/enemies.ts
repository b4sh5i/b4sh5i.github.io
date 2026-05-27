import type { EnemyDef } from '../types';

// 적 정의 — 잡몹 4종 + 보스 풀.
// 1차 보스는 행동 패턴 다양화 없이 단순 강화. 후속에서 돌진/광역/소환 등 추가 예정.
export const ENEMIES: Record<string, EnemyDef> = {
  // === 잡몹 ===
  grub: {
    id: 'grub',
    name: '잡몹',
    role: 'normal',
    hp: 14,
    damage: 8,
    moveSpeed: 60,
    radius: 11,
    credits: 1,
    color: '#9e8e7a',
    weight: 10,
  },
  runner: {
    id: 'runner',
    name: '추적자',
    role: 'normal',
    hp: 10,
    damage: 10,
    moveSpeed: 110,
    radius: 9,
    credits: 1,
    color: '#d6a25e',
    weight: 6,
    minFloor: 2,
  },
  brute: {
    id: 'brute',
    name: '둔갑체',
    role: 'normal',
    hp: 70,
    damage: 18,
    moveSpeed: 38,
    radius: 18,
    credits: 4,
    color: '#7a4f55',
    weight: 3,
    minFloor: 3,
  },
  caster: {
    id: 'caster',
    name: '주문술사',
    role: 'normal',
    hp: 26,
    damage: 14,
    moveSpeed: 50,
    radius: 12,
    credits: 2,
    color: '#a48dff',
    weight: 2,
    minFloor: 4,
  },
  // === 보스 풀 ===
  gatekeeper: {
    id: 'gatekeeper',
    name: '관문 수호자',
    role: 'boss',
    hp: 600,
    damage: 28,
    moveSpeed: 55,
    radius: 28,
    credits: 30,
    color: '#ff5577',
  },
  stalker: {
    id: 'stalker',
    name: '추적 망령',
    role: 'boss',
    hp: 420,
    damage: 22,
    moveSpeed: 95,
    radius: 22,
    credits: 30,
    color: '#ff8c66',
  },
  colossus: {
    id: 'colossus',
    name: '거탑',
    role: 'boss',
    hp: 980,
    damage: 38,
    moveSpeed: 32,
    radius: 36,
    credits: 30,
    color: '#7a4f7a',
  },
};

export function listEnemies(): EnemyDef[] {
  return Object.values(ENEMIES);
}

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy: ${id}`);
  return e;
}

// 층(floor)에 등장할 수 있는 잡몹 풀
export function spawnPoolFor(floor: number): EnemyDef[] {
  return listEnemies().filter(
    (e) =>
      e.role !== 'boss' && (e.minFloor ?? 1) <= floor && (e.weight ?? 0) > 0,
  );
}

// 층(floor)에 등장 가능한 보스 풀. 현재는 전체 풀에서 균등 추첨.
export function bossPoolFor(_floor: number): EnemyDef[] {
  return listEnemies().filter((e) => e.role === 'boss');
}
