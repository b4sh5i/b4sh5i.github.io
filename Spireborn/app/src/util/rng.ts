// 시드 기반 PRNG (mulberry32). 시드를 저장하면 던전 생성을 정확히 복원할 수 있다.
export class RNG {
  private state: number;

  constructor(seed: number) {
    // 0이 들어오면 작동 안 함 — 안전망
    this.state = (seed || 1) >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }

  weighted<T extends { weight?: number }>(arr: readonly T[]): T {
    let total = 0;
    for (const a of arr) total += a.weight ?? 1;
    let r = this.next() * total;
    for (const a of arr) {
      r -= a.weight ?? 1;
      if (r <= 0) return a;
    }
    return arr[arr.length - 1];
  }
}

export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
