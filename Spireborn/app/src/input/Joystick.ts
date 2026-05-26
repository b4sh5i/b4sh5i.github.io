// 가상 조이스틱 — 모바일 한 손 조작 기준.
// 화면 어디든 터치하면 그 자리에 조이스틱 베이스가 나타나고, 드래그하면 방향이 입력된다.
export class Joystick {
  private root: HTMLElement;
  private stick: HTMLElement;
  private active = false;
  private originX = 0;
  private originY = 0;
  private currentX = 0;
  private currentY = 0;
  private pointerId: number | null = null;
  private maxRadius = 56; // 시각적 베이스 반경
  private deadzone = 0.12;

  constructor(root: HTMLElement) {
    this.root = root;
    this.stick = root.querySelector('#joystick-stick') as HTMLElement;
    this.attach();
  }

  private attach(): void {
    const target = document.body;
    target.addEventListener('pointerdown', this.onDown, { passive: false });
    target.addEventListener('pointermove', this.onMove, { passive: false });
    target.addEventListener('pointerup', this.onUp, { passive: false });
    target.addEventListener('pointercancel', this.onUp, { passive: false });
  }

  private isOverlay(e: PointerEvent): boolean {
    const t = e.target as HTMLElement | null;
    if (!t) return false;
    // 오버레이(레벨업/정비)가 열려있을 때, 그 위 터치는 조이스틱이 가로채지 않는다.
    if (t.closest('#overlay')) return true;
    if (t.closest('.btn')) return true;
    return false;
  }

  private onDown = (e: PointerEvent): void => {
    if (this.isOverlay(e)) return;
    if (this.pointerId !== null) return;
    this.pointerId = e.pointerId;
    this.active = true;
    this.originX = e.clientX;
    this.originY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.root.classList.remove('hidden');
    this.root.style.left = `${this.originX - 70}px`;
    this.root.style.top = `${this.originY - 70}px`;
    this.root.style.bottom = 'auto';
    this.updateStick();
    e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.updateStick();
    e.preventDefault();
  };

  private onUp = (e: PointerEvent): void => {
    if (this.pointerId !== e.pointerId) return;
    this.pointerId = null;
    this.active = false;
    this.root.classList.add('hidden');
    this.stick.style.transform = 'translate(0px, 0px)';
  };

  private updateStick(): void {
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const len = Math.hypot(dx, dy);
    const clamped = Math.min(len, this.maxRadius);
    const nx = len > 0 ? (dx / len) * clamped : 0;
    const ny = len > 0 ? (dy / len) * clamped : 0;
    this.stick.style.transform = `translate(${nx}px, ${ny}px)`;
  }

  // 정규화된 방향 벡터 (max 길이 1, 데드존 처리)
  getDirection(): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    const dx = this.currentX - this.originX;
    const dy = this.currentY - this.originY;
    const len = Math.hypot(dx, dy);
    if (len < 4) return { x: 0, y: 0 };
    const norm = Math.min(len / this.maxRadius, 1);
    if (norm < this.deadzone) return { x: 0, y: 0 };
    return { x: (dx / len) * norm, y: (dy / len) * norm };
  }

  reset(): void {
    this.pointerId = null;
    this.active = false;
    this.root.classList.add('hidden');
    this.stick.style.transform = 'translate(0px, 0px)';
  }
}
