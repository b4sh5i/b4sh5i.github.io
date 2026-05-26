// 간단한 오브젝트 풀. 적/투사체/경험치 오브 같은 대량 객체에 사용.
export class Pool<T extends { active: boolean }> {
  private items: T[] = [];
  private create: () => T;

  constructor(create: () => T) {
    this.create = create;
  }

  acquire(): T {
    for (const it of this.items) {
      if (!it.active) {
        it.active = true;
        return it;
      }
    }
    const fresh = this.create();
    fresh.active = true;
    this.items.push(fresh);
    return fresh;
  }

  release(it: T): void {
    it.active = false;
  }

  forEachActive(fn: (it: T) => void): void {
    for (const it of this.items) {
      if (it.active) fn(it);
    }
  }

  countActive(): number {
    let n = 0;
    for (const it of this.items) if (it.active) n++;
    return n;
  }

  clear(): void {
    for (const it of this.items) it.active = false;
  }

  raw(): readonly T[] {
    return this.items;
  }
}
