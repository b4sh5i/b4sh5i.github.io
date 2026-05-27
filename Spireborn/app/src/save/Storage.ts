// localStorage 어댑터. "폰 닫았다 켜도 이어하기" 목적.
// 꼼수 방지/세이브 코드는 명시적으로 만들지 않는다.
import type { RunState, MetaState } from '../types';
import { defaultMetaState } from '../types';

const RUN_KEY = 'spireborn:run';
const META_KEY = 'spireborn:meta';
// 5 = floorCreditsEarned 추가 (자동 줍기 비용 계산용). 기존 세이브는 무효 처리.
const RUN_VERSION = 5;

export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(RUN_KEY, JSON.stringify(run));
  } catch {
    // 저장 실패는 조용히 무시 (사파리 사적 모드 등)
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(RUN_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as RunState;
    if (obj.version !== RUN_VERSION) return null;
    if (obj.phase === 'dead') return null;
    return obj;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
}

export function loadMeta(): MetaState {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return defaultMetaState();
    const m = JSON.parse(raw) as MetaState;
    return { ...defaultMetaState(), ...m };
  } catch {
    return defaultMetaState();
  }
}

export function saveMeta(meta: MetaState): void {
  try {
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch {
    // ignore
  }
}

export function hasSavedRun(): boolean {
  return loadRun() !== null;
}

export const RUN_STATE_VERSION = RUN_VERSION;
