// Phase 4: 정적 아이템 카탈로그는 사라지고, 슬롯 헬퍼만 남는다.
// 아이템 인스턴스는 affix 풀에서 굴려 생성한다 — game/shop.ts 의 rollItem 참고.
import type { ItemSlot } from '../types';

export const ALL_SLOTS: readonly ItemSlot[] = ['weapon', 'amulet', 'ring'];

export const SLOT_LABELS: Record<ItemSlot, string> = {
  weapon: '무기',
  amulet: '부적',
  ring: '반지',
};
