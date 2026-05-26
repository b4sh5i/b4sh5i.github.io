import type { EnemyDef } from '../types';

// 적 정의 — 1차 범위에서는 4종 + 보스. 층이 올라갈수록 스폰 빈도/체력이 자연 증가한다.
export const ENEMIES: Record<string, EnemyDef> = {
  grub: {
    id: 'grub',
    name: '잡몹',
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
    hp: 26,
    damage: 14,
    moveSpeed: 50,
    radius: 12,
    credits: 2,
    color: '#a48dff',
    weight: 2,
    minFloor: 4,
  },
  boss: {
    id: 'boss',
    name: '관문 수호자',
    hp: 600,
    damage: 28,
    moveSpeed: 55,
    radius: 28,
    credits: 30,
    color: '#ff5577',
  },
};

export function listEnemies(): EnemyDef[] {
  return Object.values(ENEMIES);
}

export function getEnemy(id: string): EnemyDef {
  const e = ENEMIES[id];
  if (!e) throw new Error(`Unknown enemy: ${e}`);
  return e;
}

// 층(floor)에 등장할 수 있는 잡몹 풀
export function spawnPoolFor(floor: number): EnemyDef[] {
  return listEnemies().filter(
    (e) => e.id !== 'boss' && (e.minFloor ?? 1) <= floor && (e.weight ?? 0) > 0,
  );
}
