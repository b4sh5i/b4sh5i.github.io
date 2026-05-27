// 런의 빌드 상태로부터 최종 SkillState / PlayerStats를 계산한다.
// Phase 3: 메인 스킬의 소켓 중 소켓 0 과 링크로 연결된 소켓만 활성.
// Phase 4: 아이템은 ItemInstance.prefixes / suffixes 의 모드를 적용.
import type {
  PlayerStats,
  RunState,
  SkillState,
  SupportInstance,
} from '../types';
import { defaultPlayerStats, defaultSkillState } from '../types';
import { getSkill } from '../data/skills';
import { getSupport } from '../data/supports';
import { getAffix } from '../data/affixes';

export interface ComputedBuild {
  player: PlayerStats;
  skill: SkillState;
}

// 소켓 0 에서 인접 + link 가 true 인 소켓을 따라 BFS.
function reachableSockets(skill: RunState['mainSkill']): boolean[] {
  const n = skill.sockets;
  const reached = new Array<boolean>(n).fill(false);
  reached[0] = true;
  const queue: number[] = [0];
  while (queue.length > 0) {
    const i = queue.shift()!;
    if (i > 0 && skill.links[i - 1] && !reached[i - 1]) {
      reached[i - 1] = true;
      queue.push(i - 1);
    }
    if (i < n - 1 && skill.links[i] && !reached[i + 1]) {
      reached[i + 1] = true;
      queue.push(i + 1);
    }
  }
  return reached;
}

export function computeBuild(run: RunState): ComputedBuild {
  const skill = defaultSkillState();
  const player = defaultPlayerStats();

  // 메인 스킬의 색 적용 (시각 기본값)
  const def = getSkill(run.mainSkill.defId);
  skill.color = def.color;

  // 활성 소켓의 서포트만 적용
  const reached = reachableSockets(run.mainSkill);
  for (let i = 1; i < run.mainSkill.sockets; i++) {
    if (!reached[i]) continue;
    const inst = run.mainSkill.socketed[i];
    if (inst) applySupport(inst, skill);
  }

  // 아이템 적용 — 접두/접미 모든 모드
  for (const item of run.items) {
    for (const mod of item.prefixes) {
      const def = getAffix(mod.affixId);
      if (def) def.apply({ player, skill }, mod.roll);
    }
    for (const mod of item.suffixes) {
      const def = getAffix(mod.affixId);
      if (def) def.apply({ player, skill }, mod.roll);
    }
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
