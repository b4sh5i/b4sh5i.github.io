// Phase 3 / 4 — 화톳불 상점 액션과 누적 비용 계산.
// RerollCounter 는 같은 화톳불 내에서만 누적되며, 다음 층 진입 시 폐기된다.
import type {
  ItemInstance,
  ItemMod,
  ItemSlot,
  RunState,
  SkillInstance,
  SupportInstance,
} from '../types';
import { listSupports } from '../data/supports';
import { ALL_SLOTS } from '../data/items';
import { PREFIXES, SUFFIXES, getAffix } from '../data/affixes';
import type { AffixMod } from '../data/affixes';
import { makeSupportInstance } from './build';
import type { RNG } from '../util/rng';

export type RerollKey =
  | 'itemReward'
  | 'links'
  | 'gemBuy'
  | 'gemSwap'
  | 'prefix'
  | 'suffix';

export class RerollCounter {
  private counts: Map<RerollKey, number> = new Map();
  cost(key: RerollKey, base: number): number {
    const n = this.counts.get(key) ?? 0;
    return Math.ceil(base * Math.pow(1.5, n));
  }
  bump(key: RerollKey): void {
    this.counts.set(key, (this.counts.get(key) ?? 0) + 1);
  }
  reset(): void {
    this.counts.clear();
  }
}

// === 소켓 ===
export const MIN_SOCKETS = 3;
export const MAX_SOCKETS = 6;

// 단발성 비용 (RerollCounter 미사용) — 30 × 2^(N-3)
export function socketExpandCost(currentSockets: number): number | null {
  if (currentSockets >= MAX_SOCKETS) return null;
  return 30 * Math.pow(2, currentSockets - MIN_SOCKETS);
}

export function expandSocket(skill: SkillInstance): boolean {
  if (skill.sockets >= MAX_SOCKETS) return false;
  skill.sockets += 1;
  skill.links.push(false);
  skill.socketed.push(null);
  return true;
}

// === 링크 ===
// 각 인접쌍을 60% 확률로 링크. 최소 1 개는 보장.
export function rollLinks(socketCount: number, rng: RNG): boolean[] {
  const n = socketCount - 1;
  if (n <= 0) return [];
  const links = new Array<boolean>(n);
  for (let i = 0; i < n; i++) links[i] = rng.next() < 0.6;
  if (!links.some((l) => l)) {
    links[Math.floor(rng.next() * n)] = true;
  }
  return links;
}

// === 서포트 젬 ===
// 같은 화톳불 안에서 같은 defId 가 인벤토리/소켓에 중복 생길 수 있음.
// 인벤토리 채워서 같은 풀 다시 굴려도 OK — 단순화 우선.
export function buyRandomGem(rng: RNG): SupportInstance {
  const pool = listSupports();
  const def = pool[Math.floor(rng.next() * pool.length)];
  return makeSupportInstance(def.id);
}

// 소켓에 박힌 서포트를 다른 종으로 교체 (현재와 다른 종 보장).
export function swapSocketedGem(
  skill: SkillInstance,
  socketIdx: number,
  rng: RNG,
): SupportInstance | null {
  if (socketIdx <= 0 || socketIdx >= skill.sockets) return null;
  const pool = listSupports();
  const curId = skill.socketed[socketIdx]?.defId;
  const candidates = pool.filter((s) => s.id !== curId);
  if (candidates.length === 0) return null;
  const def = candidates[Math.floor(rng.next() * candidates.length)];
  const fresh = makeSupportInstance(def.id);
  skill.socketed[socketIdx] = fresh;
  return fresh;
}

// === 활성 소켓 판정 — 소켓 0 에서 link 가 true 인 인접 소켓을 따라 BFS.
export function reachableSockets(skill: SkillInstance): boolean[] {
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

// === 아이템 roll ===
// 접두/접미 개수: 0 = 10%, 1 = 30%, 2 = 60%
function rollAffixCount(rng: RNG): number {
  const r = rng.next();
  if (r < 0.1) return 0;
  if (r < 0.4) return 1;
  return 2;
}

// 한 모드를 선택하고 roll/tier 결정.
function rollMod(def: AffixMod, floor: number, rng: RNG): ItemMod {
  // tier = clamp(6 - floor/5, 1, 5) 부근
  const tier = Math.max(1, Math.min(5, Math.round(6 - floor / 5)));
  // 스케일: tier 5 = 60%, tier 1 = 100% (선형)
  const scale = 0.6 + 0.1 * (5 - tier);
  const base = def.rollMin + (def.rollMax - def.rollMin) * rng.next();
  const roll = base * scale;
  return { affixId: def.id, roll, tier };
}

// 가중치 풀에서 한 개 추첨 (이미 선택된 인덱스는 제외)
function weightedPickIndex(
  pool: readonly AffixMod[],
  rng: RNG,
  excluded: readonly number[],
): number {
  let total = 0;
  for (let i = 0; i < pool.length; i++) {
    if (excluded.includes(i)) continue;
    total += pool[i].weight;
  }
  if (total <= 0) return -1;
  let r = rng.next() * total;
  for (let i = 0; i < pool.length; i++) {
    if (excluded.includes(i)) continue;
    r -= pool[i].weight;
    if (r <= 0) return i;
  }
  return pool.length - 1;
}

function rollAffixLine(
  pool: readonly AffixMod[],
  count: number,
  floor: number,
  rng: RNG,
): ItemMod[] {
  const picked: number[] = [];
  for (let n = 0; n < count; n++) {
    const idx = weightedPickIndex(pool, rng, picked);
    if (idx < 0) break;
    picked.push(idx);
  }
  return picked.map((i) => rollMod(pool[i], floor, rng));
}

import { SLOT_LABELS } from '../data/items';

function generateName(
  slot: ItemSlot,
  prefixes: ItemMod[],
  suffixes: ItemMod[],
): string {
  const slotName = SLOT_LABELS[slot];
  const pre = prefixes[0]
    ? getAffix(prefixes[0].affixId)?.shortName ?? ''
    : '';
  const suf = suffixes[0]
    ? getAffix(suffixes[0].affixId)?.shortName ?? ''
    : '';
  if (!pre && !suf) return `평범한 ${slotName}`;
  if (pre && suf) return `${pre} ${slotName}의 ${suf}`;
  return `${pre || suf} ${slotName}`;
}

let itemSeq = 1;
function newItemId(rng: RNG): string {
  return `it_${Date.now().toString(36)}_${(itemSeq++).toString(36)}_${Math.floor(rng.next() * 1e6).toString(36)}`;
}

export function rollItem(
  slot: ItemSlot,
  floor: number,
  rng: RNG,
): ItemInstance {
  const prefixCount = rollAffixCount(rng);
  const suffixCount = rollAffixCount(rng);
  const prefixes = rollAffixLine(PREFIXES[slot], prefixCount, floor, rng);
  const suffixes = rollAffixLine(SUFFIXES[slot], suffixCount, floor, rng);
  return {
    id: newItemId(rng),
    slot,
    name: generateName(slot, prefixes, suffixes),
    prefixes,
    suffixes,
    enhanced: false,
  };
}

export function rollItemRandomSlot(floor: number, rng: RNG): ItemInstance {
  const slot = ALL_SLOTS[Math.floor(rng.next() * ALL_SLOTS.length)];
  return rollItem(slot, floor, rng);
}

// === 아이템 모드 변경 ===
// 접두/접미 라인 전체를 재롤 (개수도 다시 추첨).
export function rerollPrefixes(item: ItemInstance, floor: number, rng: RNG): void {
  const count = rollAffixCount(rng);
  item.prefixes = rollAffixLine(PREFIXES[item.slot], count, floor, rng);
  item.name = generateName(item.slot, item.prefixes, item.suffixes);
}

export function rerollSuffixes(item: ItemInstance, floor: number, rng: RNG): void {
  const count = rollAffixCount(rng);
  item.suffixes = rollAffixLine(SUFFIXES[item.slot], count, floor, rng);
  item.name = generateName(item.slot, item.prefixes, item.suffixes);
}

// === 아이템 강화 — 모든 mod 의 티어 1 단계 ↑ (최대 tier 1). 한 아이템당 1 회. ===
export const ENHANCE_COST = 60;

export function enhanceItem(item: ItemInstance): boolean {
  if (item.enhanced) return false;
  const bump = (m: ItemMod) => {
    if (m.tier <= 1) return;
    const oldTier = m.tier;
    m.tier = m.tier - 1;
    // roll 스케일 조정: scale = 0.6 + 0.1 * (5 - tier)
    const oldScale = 0.6 + 0.1 * (5 - oldTier);
    const newScale = 0.6 + 0.1 * (5 - m.tier);
    if (oldScale > 0) m.roll = (m.roll / oldScale) * newScale;
  };
  for (const m of item.prefixes) bump(m);
  for (const m of item.suffixes) bump(m);
  item.enhanced = true;
  return true;
}

// === 인벤토리 ↔ 소켓 부착/탈착 ===
export function attachToFirstEmptySocket(
  run: RunState,
  inventoryIdx: number,
): boolean {
  const skill = run.mainSkill;
  for (let i = 1; i < skill.sockets; i++) {
    if (skill.socketed[i] === null) {
      const inst = run.supports[inventoryIdx];
      if (!inst) return false;
      skill.socketed[i] = inst;
      run.supports.splice(inventoryIdx, 1);
      return true;
    }
  }
  return false;
}

export function detachFromSocket(run: RunState, socketIdx: number): void {
  const inst = run.mainSkill.socketed[socketIdx];
  if (!inst) return;
  run.mainSkill.socketed[socketIdx] = null;
  run.supports.push(inst);
}

// === SkillInstance 기본값 ===
export function defaultSkillInstance(defId: string): SkillInstance {
  return {
    defId,
    sockets: MIN_SOCKETS,
    links: new Array(MIN_SOCKETS - 1).fill(false),
    socketed: new Array(MIN_SOCKETS).fill(null),
  };
}
