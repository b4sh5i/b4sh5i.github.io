// 모든 오버레이(타이틀, 룰렛, 레벨업, 정비, 게임오버).
import type {
  RunState,
  SupportInstance,
  MetaState,
  SkillDef,
} from '../types';
import { listSkills } from '../data/skills';
import { listSupports, getSupport } from '../data/supports';
import { getItem, listItems } from '../data/items';
import {
  decreaseOption,
  increaseOption,
  makeSupportInstance,
} from '../game/build';

// 정비에서 옵션 한 점 올릴 때 차감되는 크레딧 비용
const REFINE_COST_PER_POINT = 5;

export class Overlay {
  private root: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
  }

  hide(): void {
    this.root.classList.add('hidden');
    this.root.innerHTML = '';
  }

  private show(html: string, wire: (panel: HTMLElement) => void): void {
    this.root.classList.remove('hidden');
    this.root.innerHTML = html;
    const panel = this.root.querySelector('.panel') as HTMLElement;
    wire(panel);
  }

  // === 타이틀 ===
  // 시작 버튼 한 개. 누르면 룰렛(부모가 onSpinRoulette 콜백으로 위임)
  showTitle(opts: {
    meta: MetaState;
    hasSave: boolean;
    onSpinRoulette: (onPicked: (skillId: string) => void) => void;
    onNew: (skillId: string) => void;
    onContinue: () => void;
  }): void {
    this.show(
      `
      <div class="panel title-screen">
        <h1>SPIREBORN</h1>
        <div class="muted">탑을 한 층씩 등반하라. 영구 강화는 없다.</div>
        ${
          opts.meta.highestFloor > 0
            ? `<div class="high-score">최고 도달 층 <b>${opts.meta.highestFloor}</b> · 최장 생존 ${formatTime(opts.meta.longestSurvivalSec)} · ${opts.meta.runsPlayed}번의 시도</div>`
            : ''
        }
        ${opts.hasSave ? `<button class="btn" data-continue>이어하기</button>` : ''}
        <div class="divider"></div>
        <p class="muted">시작을 누르면 룰렛이 돌아가 무기가 결정된다.</p>
        <button class="btn" data-start>${opts.hasSave ? '새로 시작 (룰렛)' : '시작'}</button>
      </div>
    `,
      (panel) => {
        panel
          .querySelector('[data-continue]')
          ?.addEventListener('click', () => opts.onContinue());
        panel.querySelector('[data-start]')?.addEventListener('click', () => {
          opts.onSpinRoulette((skillId) => opts.onNew(skillId));
        });
      },
    );
  }

  // === 룰렛 ===
  // 무기 후보들이 빠르게 스크롤되다가 ease-out 으로 멈추면서 한 개를 가리킨다.
  runRoulette(onPicked: (skillId: string) => void): void {
    const skills = listSkills();
    // 충분히 긴 트랙: 셔플된 카탈로그를 여러 번 반복
    const cycles = 10;
    const items: SkillDef[] = [];
    for (let i = 0; i < cycles; i++) {
      const shuf = shuffle(skills.slice());
      items.push(...shuf);
    }
    // 가장 마지막 사이클에서 균등 추첨
    const finalSkill = skills[Math.floor(Math.random() * skills.length)];
    // 마지막 사이클 안에서 그 스킬이 처음 나오는 인덱스
    const lastCycleStart = items.length - skills.length;
    let finalIdx = -1;
    for (let i = lastCycleStart; i < items.length; i++) {
      if (items[i].id === finalSkill.id) {
        finalIdx = i;
        break;
      }
    }
    if (finalIdx < 0) finalIdx = items.length - 1;

    const cellH = 56;
    // 중앙 셀이 finalIdx 가 되도록 트랙을 위로 이동
    const endY = -(finalIdx * cellH);

    const cellsHtml = items
      .map(
        (s) => `
          <div class="roulette-cell">
            <span class="roulette-dot" style="background:${s.color}"></span>
            <span class="roulette-name">${s.name}</span>
          </div>
        `,
      )
      .join('');

    this.show(
      `
      <div class="panel roulette-panel">
        <h2>운명의 룰렛</h2>
        <p class="muted">시작 무기를 추첨 중…</p>
        <div class="roulette">
          <div class="roulette-marker"></div>
          <div class="roulette-window">
            <div class="roulette-track" data-track style="transform: translateY(0px)">
              ${cellsHtml}
            </div>
          </div>
        </div>
        <div class="roulette-result hidden" data-result>
          <div class="roulette-result-name" data-result-name></div>
          <div class="muted" data-result-desc></div>
          <button class="btn" data-confirm>결정</button>
        </div>
      </div>
    `,
      (panel) => {
        const track = panel.querySelector('[data-track]') as HTMLElement;
        const result = panel.querySelector('[data-result]') as HTMLElement;
        const resultName = panel.querySelector('[data-result-name]') as HTMLElement;
        const resultDesc = panel.querySelector('[data-result-desc]') as HTMLElement;
        const duration = 2800;
        const startT = performance.now();
        let raf = 0;
        const animate = (t: number) => {
          const elapsed = t - startT;
          const u = Math.min(1, elapsed / duration);
          // easeOutQuint — 시원하게 감속
          const eased = 1 - Math.pow(1 - u, 5);
          const y = endY * eased;
          track.style.transform = `translateY(${y}px)`;
          if (u < 1) {
            raf = requestAnimationFrame(animate);
          } else {
            // 결과 표시
            resultName.textContent = finalSkill.name;
            resultName.style.color = finalSkill.color;
            resultDesc.textContent = finalSkill.description;
            result.classList.remove('hidden');
          }
        };
        raf = requestAnimationFrame(animate);
        panel.querySelector('[data-confirm]')?.addEventListener('click', () => {
          cancelAnimationFrame(raf);
          onPicked(finalSkill.id);
        });
      },
    );
  }

  // === 레벨업 (층 클리어 직후): 서포트 3택 ===
  showLevelUp(opts: {
    run: RunState;
    onPick: (defId: string) => void;
  }): void {
    const already = new Set(opts.run.supports.map((s) => s.defId));
    const pool = listSupports().filter((s) => !already.has(s.id));
    const choices = pickThree(pool);
    if (choices.length === 0) {
      opts.onPick('');
      return;
    }

    const cards = choices
      .map((s) => {
        const tag = s.kind === 'qualitative' ? '질적' : '양적';
        const tagClass = s.kind === 'qualitative' ? 'qual' : '';
        const optTexts = s.options
          .map((o) => `${o.label} ${o.format(o.initial)}`)
          .join(' · ');
        return `
          <button class="choice" data-pick="${s.id}">
            <div class="name">${s.name} <span class="tag ${tagClass}">${tag}</span></div>
            <div class="desc">${s.description}</div>
            <div class="tag-row"><span class="chip">${optTexts}</span></div>
          </button>
        `;
      })
      .join('');

    this.show(
      `
      <div class="panel">
        <h2>층 ${opts.run.floor} 클리어 — 서포트 젬 획득</h2>
        <p class="muted">메인 스킬 [${currentMainSkillName(opts.run)}]에 결합할 서포트를 고르세요.</p>
        <div class="choice-list">${cards}</div>
      </div>
    `,
      (panel) => {
        panel.querySelectorAll('[data-pick]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = (btn as HTMLElement).dataset.pick!;
            opts.onPick(id);
          });
        });
      },
    );
  }

  // === 정비 ===
  showMaintenance(opts: {
    run: RunState;
    itemRewardIds: string[];
    onChange: () => void;
    onContinue: () => void;
  }): void {
    const renderPanel = () => {
      this.show(this.maintenanceHtml(opts.run, opts.itemRewardIds), (panel) =>
        this.wireMaintenance(panel, opts.run, opts.itemRewardIds, () => {
          opts.onChange();
          renderPanel();
        }, opts.onContinue),
      );
    };
    renderPanel();
  }

  private maintenanceHtml(run: RunState, itemRewardIds: string[]): string {
    const supportItems = run.supports
      .map((inst, idx) => this.maintenanceSupportHtml(inst, idx, run.credits))
      .join('');
    const equippedItems = run.itemIds
      .map((id) => {
        const it = getItem(id);
        return `
          <div class="maintenance-item">
            <div class="head">
              <div class="name">${it.name}</div>
              <div class="muted">${it.slot}</div>
            </div>
            <div class="muted">${it.description}</div>
          </div>
        `;
      })
      .join('');
    const itemChoices = itemRewardIds.length
      ? `
        <div class="divider"></div>
        <h2>아이템 보상</h2>
        <p class="muted">하나를 선택해 장착. 다음 층 시작 시 적용.</p>
        <div class="choice-list">
          ${itemRewardIds
            .map((id) => {
              const it = getItem(id);
              const owned = run.itemIds.includes(id);
              return `
                <button class="choice" data-item-pick="${id}" ${owned ? 'disabled' : ''}>
                  <div class="name">${it.name} ${owned ? '<span class="tag">보유</span>' : ''}</div>
                  <div class="desc">${it.description}</div>
                  <div class="tag-row"><span class="chip">${it.slot}</span></div>
                </button>
              `;
            })
            .join('')}
          <button class="choice" data-item-skip>건너뛰기</button>
        </div>
      `
      : '';
    return `
      <div class="panel">
        <h2>정비 — 층 ${run.floor}</h2>
        <p class="muted">서포트 옵션은 옵션당 ${REFINE_COST_PER_POINT}c. 내리면 환급.</p>
        <div class="hud-row">
          <span class="credit-badge">${run.credits}c</span>
        </div>
        <div class="divider"></div>
        <h2>서포트 젬</h2>
        ${
          supportItems ||
          '<div class="muted">아직 부착된 서포트가 없습니다.</div>'
        }
        ${equippedItems ? `<div class="divider"></div><h2>장착 아이템</h2><div class="maintenance-list">${equippedItems}</div>` : ''}
        ${itemChoices}
        <div class="divider"></div>
        <button class="btn" data-continue>다음 층으로 →</button>
      </div>
    `;
  }

  private maintenanceSupportHtml(
    inst: SupportInstance,
    idx: number,
    credits: number,
  ): string {
    const def = getSupport(inst.defId);
    const optionsHtml = def.options
      .map((opt) => {
        const cur = inst.values[opt.key] ?? opt.initial;
        const cantBuy = credits < REFINE_COST_PER_POINT || cur >= opt.max;
        return `
          <div class="stat-row">
            <span class="label">${opt.label}</span>
            <span class="value">${opt.format(cur)}</span>
            <button class="btn-mini" data-sup="${idx}" data-key="${opt.key}" data-dir="-" ${cur <= opt.min ? 'disabled' : ''}>−</button>
            <button class="btn-mini" data-sup="${idx}" data-key="${opt.key}" data-dir="+" ${cantBuy ? 'disabled' : ''}>+</button>
          </div>
        `;
      })
      .join('');
    return `
      <div class="maintenance-item">
        <div class="head">
          <div class="name">${def.name}</div>
          <div class="muted">${def.kind === 'qualitative' ? '질적' : '양적'}</div>
        </div>
        <div class="stats">${optionsHtml}</div>
      </div>
    `;
  }

  private wireMaintenance(
    panel: HTMLElement,
    run: RunState,
    itemRewardIds: string[],
    onChange: () => void,
    onContinue: () => void,
  ): void {
    panel.querySelectorAll('button[data-sup]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.sup!, 10);
        const key = (btn as HTMLElement).dataset.key!;
        const dir = (btn as HTMLElement).dataset.dir!;
        const inst = run.supports[idx];
        if (!inst) return;
        if (dir === '+') {
          if (run.credits < REFINE_COST_PER_POINT) return;
          if (increaseOption(inst, key)) {
            run.credits -= REFINE_COST_PER_POINT;
            onChange();
          }
        } else {
          if (decreaseOption(inst, key)) {
            run.credits += REFINE_COST_PER_POINT;
            onChange();
          }
        }
      });
    });
    panel.querySelectorAll('[data-item-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = (btn as HTMLElement).dataset.itemPick!;
        if (!run.itemIds.includes(id)) {
          run.itemIds.push(id);
          if (run.itemIds.length > 4) run.itemIds.shift();
        }
        const i = itemRewardIds.indexOf(id);
        if (i >= 0) itemRewardIds.splice(i, 1);
        onChange();
      });
    });
    panel.querySelector('[data-item-skip]')?.addEventListener('click', () => {
      itemRewardIds.length = 0;
      onChange();
    });
    panel.querySelector('[data-continue]')?.addEventListener('click', () => {
      onContinue();
    });
  }

  // === 게임 오버 ===
  showGameOver(opts: {
    run: RunState;
    meta: MetaState;
    isNewRecord: boolean;
    onRestart: () => void;
  }): void {
    this.show(
      `
      <div class="panel gameover">
        <h2>탐색 종료</h2>
        <p class="muted">${opts.isNewRecord ? '✨ 새 기록 ✨' : ''}</p>
        <div>도달 층: <b>${opts.run.floor}</b></div>
        <div>생존 시간: <b>${formatTime(opts.run.timeAliveSec)}</b></div>
        <div>처치: <b>${opts.run.killsTotal}</b></div>
        <div>크레딧: <b>${opts.run.credits}c</b></div>
        <div class="divider"></div>
        <div class="muted">최고 기록 — 층 ${opts.meta.highestFloor} · ${formatTime(opts.meta.longestSurvivalSec)}</div>
        <button class="btn" data-restart>처음으로</button>
      </div>
    `,
      (panel) => {
        panel
          .querySelector('[data-restart]')
          ?.addEventListener('click', () => opts.onRestart());
      },
    );
  }
}

function currentMainSkillName(run: RunState): string {
  return listSkills().find((s) => s.id === run.mainSkillId)?.name ?? '?';
}

function pickThree<T>(arr: T[]): T[] {
  if (arr.length <= 3) return [...arr];
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = (s % 60).toString().padStart(2, '0');
  return `${m}:${r}`;
}

export function pickItemRewards(): string[] {
  const all = listItems().map((i) => i.id);
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  return all.slice(0, 2);
}

export function newSupportInstance(defId: string): SupportInstance {
  return makeSupportInstance(defId);
}
