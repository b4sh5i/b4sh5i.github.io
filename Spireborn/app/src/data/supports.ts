import type { SupportDef } from '../types';

// 서포트 젬 카탈로그. 양적/질적을 분명히 나눠 PoE 느낌을 살린다.
// 각 서포트는 정비 화면에서 점수를 조정할 수 있는 옵션을 가진다.

export const SUPPORTS: Record<string, SupportDef> = {
  // === 양적 (수치 강화) ===
  added_damage: {
    id: 'added_damage',
    name: '추가 피해',
    description: '스킬 데미지를 증폭한다.',
    kind: 'quantitative',
    options: [
      {
        key: 'dmg',
        label: '데미지 +',
        apply: (s, v) => {
          s.damageMul *= 1 + 0.18 * v;
        },
        format: (v) => `${Math.round(18 * v)}%`,
        min: 1,
        max: 6,
        initial: 1,
      },
    ],
  },
  faster_attacks: {
    id: 'faster_attacks',
    name: '빠른 시전',
    description: '쿨다운을 줄여 더 자주 발동한다.',
    kind: 'quantitative',
    options: [
      {
        key: 'cd',
        label: '쿨다운 −',
        apply: (s, v) => {
          // 쿨다운 감소는 곱셈으로 누적 (감쇠 효과)
          s.cooldownMul *= Math.pow(0.88, v);
        },
        format: (v) => `${Math.round((1 - Math.pow(0.88, v)) * 100)}%`,
        min: 1,
        max: 6,
        initial: 1,
      },
    ],
  },
  swift_projectiles: {
    id: 'swift_projectiles',
    name: '신속 투사체',
    description: '투사체 속도와 사거리를 증가시킨다.',
    kind: 'quantitative',
    options: [
      {
        key: 'speed',
        label: '투사체 속도 +',
        apply: (s, v) => {
          s.projectileSpeedMul *= 1 + 0.2 * v;
        },
        format: (v) => `${Math.round(20 * v)}%`,
        min: 1,
        max: 5,
        initial: 1,
      },
    ],
  },
  greater_area: {
    id: 'greater_area',
    name: '광역화',
    description: '범위 효과의 크기를 증가시킨다.',
    kind: 'quantitative',
    options: [
      {
        key: 'area',
        label: '범위 +',
        apply: (s, v) => {
          s.areaMul *= 1 + 0.15 * v;
        },
        format: (v) => `${Math.round(15 * v)}%`,
        min: 1,
        max: 6,
        initial: 1,
      },
    ],
  },

  // === 질적 (작동 방식 변경) ===
  pierce: {
    id: 'pierce',
    name: '관통',
    description: '투사체가 적을 관통한다.',
    kind: 'qualitative',
    options: [
      {
        key: 'pierce',
        label: '관통 횟수',
        apply: (s, v) => {
          s.pierce += v;
        },
        format: (v) => `${v}회`,
        min: 1,
        max: 4,
        initial: 1,
      },
    ],
  },
  fork: {
    id: 'fork',
    name: '다중 투사체',
    description: '동시에 여러 발을 부채꼴로 발사한다.',
    kind: 'qualitative',
    options: [
      {
        key: 'count',
        label: '추가 투사체',
        apply: (s, v) => {
          s.projectileCount += v;
          // 발사 수가 많아지면 자연스레 퍼지게 한다 (추적 정확도는 떨어짐)
          s.spreadDeg = Math.max(s.spreadDeg, 12 + v * 8);
        },
        format: (v) => `+${v}발`,
        min: 1,
        max: 4,
        initial: 1,
      },
    ],
  },
  chain: {
    id: 'chain',
    name: '연쇄',
    description: '처치 시 가까운 다음 적에게 연쇄된다.',
    kind: 'qualitative',
    options: [
      {
        key: 'chain',
        label: '연쇄 횟수',
        apply: (s, v) => {
          s.chain += v;
        },
        format: (v) => `${v}회`,
        min: 1,
        max: 3,
        initial: 1,
      },
    ],
  },
  explode_on_kill: {
    id: 'explode_on_kill',
    name: '처치 시 폭발',
    description: '대상을 처치하면 폭발해 주변에 피해를 입힌다.',
    kind: 'qualitative',
    options: [
      {
        key: 'radius',
        label: '폭발 범위',
        apply: (s, v) => {
          s.explodeOnKill = true;
          s.explodeRadius = Math.max(s.explodeRadius, 50 + v * 20);
        },
        format: (v) => `${50 + v * 20}px`,
        min: 1,
        max: 4,
        initial: 1,
      },
      {
        key: 'dmg',
        label: '폭발 피해',
        apply: (s, v) => {
          s.explodeOnKill = true;
          s.explodeDamageMul = Math.max(s.explodeDamageMul, 0.4 + v * 0.2);
        },
        format: (v) => `${Math.round((0.4 + v * 0.2) * 100)}%`,
        min: 1,
        max: 4,
        initial: 1,
      },
    ],
  },
  ignite: {
    id: 'ignite',
    name: '점화',
    description: '대상을 점화시켜 지속 피해를 입힌다.',
    kind: 'qualitative',
    options: [
      {
        key: 'dur',
        label: '지속 시간',
        apply: (s, v) => {
          s.ignite = true;
          s.igniteDuration = Math.max(s.igniteDuration, 1.5 + v * 0.5);
        },
        format: (v) => `${(1.5 + v * 0.5).toFixed(1)}초`,
        min: 1,
        max: 4,
        initial: 1,
      },
      {
        key: 'dps',
        label: '초당 피해',
        apply: (s, v) => {
          s.ignite = true;
          s.igniteDamageMulPerSec = Math.max(s.igniteDamageMulPerSec, 0.2 + v * 0.1);
        },
        format: (v) => `${Math.round((0.2 + v * 0.1) * 100)}%`,
        min: 1,
        max: 4,
        initial: 1,
      },
    ],
  },
};

export function listSupports(): SupportDef[] {
  return Object.values(SUPPORTS);
}

export function getSupport(id: string): SupportDef {
  const s = SUPPORTS[id];
  if (!s) throw new Error(`Unknown support: ${id}`);
  return s;
}
