// 탑의 한 층(Floor) 사양 계산. 층이 올라갈수록 스폰 속도/체력이 상승한다.
export interface FloorSpec {
  index: number;
  durationSec: number; // 이 시간 버티면 보스가 등장
  baseSpawnInterval: number; // 잡몹 스폰 간격 (초)
  spawnIntervalFloor: number; // 절대 최소치
  enemyHpMul: number;
  enemyDmgMul: number;
  enemySpeedMul: number;
  bossHpMul: number;
  // 층 클리어 시 보너스 크레딧
  creditClearBonus: number;
}

export function specForFloor(floor: number): FloorSpec {
  const f = Math.max(1, floor);
  return {
    index: f,
    // 첫 층은 짧게(45초), 이후 점진 증가
    durationSec: 45 + (f - 1) * 6,
    baseSpawnInterval: Math.max(0.25, 1.4 - (f - 1) * 0.08),
    spawnIntervalFloor: 0.22,
    enemyHpMul: 1 + (f - 1) * 0.22,
    enemyDmgMul: 1 + (f - 1) * 0.14,
    enemySpeedMul: 1 + (f - 1) * 0.045,
    bossHpMul: 1 + (f - 1) * 0.45,
    creditClearBonus: 15 + f * 5,
  };
}

// 현재 층 진행 중 시간에 따른 동적 스폰 간격 (후반에 점점 빨라짐)
export function currentSpawnInterval(
  spec: FloorSpec,
  elapsedSec: number,
): number {
  const t = Math.min(1, elapsedSec / spec.durationSec);
  const interval = spec.baseSpawnInterval * (1 - 0.55 * t);
  return Math.max(spec.spawnIntervalFloor, interval);
}
