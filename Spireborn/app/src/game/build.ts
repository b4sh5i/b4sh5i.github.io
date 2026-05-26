// 런의 빌드 상태로부터 최종 SkillState / PlayerStats를 계산한다.
// 서포트 옵션과 아이템이 매 변경 시 다시 합산된다.
import type {
  PlayerStats,
  RunState,
  SkillState,
  SupportInstance,
} from '../types';
import { defaultPlayerStats, defaultSkillState } from '../types';
import { getSkill } from '../data/skills';
import { getSupport } from '../data/supports';
import { getItem } from '../data/items';

export interface ComputedBuild {
  player: PlayerStats;
  skill: SkillState;
}

export function computeBuild(run: RunState): ComputedBuild {
  const skill = defaultSkillState();
  const player = defaultPlayerStats();

  // 메인 스킬의 색 적용 (시각 기본값)
  const def = getSkill(run.mainSkillId);
  skill.color = def.color;

  // 서포트 적용
  for (const inst of run.supports) {
    applySupport(inst, skill);
  }

  // 아이템 적용
  for (const id of run.itemIds) {
    getItem(id).apply({ player, skill });
  }

  // 안전 가드
  skill.cooldownMul = Math.max(0.05, skill.cooldownMul);
  skill.damageMul = Math.max(0.1, skill.damageMul);

  return { player, skill };
}

export function applySupport(inst: SupportInstance, skill: SkillState): void {
  const def = getSupport(inst.defId);
  for (const opt of def.options) {
    const v = inst.values[opt.key] ?? opt.initial;
    opt.apply(skill, v);
  }
}

export function makeSupportInstance(defId: string): SupportInstance {
  const def = getSupport(defId);
  const values: Record<string, number> = {};
  for (const opt of def.options) {
    values[opt.key] = opt.initial;
  }
  return { defId, values };
}

// 한 옵션의 점수를 한 단계 올린다. 가능하면 true, 한계면 false.
export function increaseOption(
  inst: SupportInstance,
  optKey: string,
): boolean {
  const def = getSupport(inst.defId);
  const opt = def.options.find((o) => o.key === optKey);
  if (!opt) return false;
  const cur = inst.values[optKey] ?? opt.initial;
  if (cur >= opt.max) return false;
  inst.values[optKey] = cur + 1;
  return true;
}

export function decreaseOption(
  inst: SupportInstance,
  optKey: string,
): boolean {
  const def = getSupport(inst.defId);
  const opt = def.options.find((o) => o.key === optKey);
  if (!opt) return false;
  const cur = inst.values[optKey] ?? opt.initial;
  if (cur <= opt.min) return false;
  inst.values[optKey] = cur - 1;
  return true;
}
