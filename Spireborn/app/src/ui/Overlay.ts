// 모든 오버레이(타이틀, 룰렛, 정비, 게임오버).
import type {
  ItemInstance,
  ItemMod,
  MetaState,
  RunState,
  SkillDef,
} from '../types';
import { listSkills, getSkill } from '../data/skills';
import { getSupport } from '../data/supports';
import { SLOT_LABELS } from '../data/items';
import { getAffix } from '../data/affixes';
import { decreaseOption, increaseOption } from '../game/build';
import {
  ENHANCE_COST,
  MAX_SOCKETS,
  RerollCounter,
  attachToFirstEmptySocket,
  buyRandomGem,
  detachFromSocket,
  enhanceItem,
  expandSocket,
  rerollPrefixes,
  rerollSuffixes,
  rollItemRandomSlot,
  rollLinks,
  socketExpandCost,
  swapSocketedGem,
} from '../game/shop';
import { RNG, randomSeed } from '../util/rng';

// 정비에서 옵션 한 점 올릴 때 차감되는 크레딧 비용
const REFINE_COST_PER_POINT = 5;
// 리롤 기본 비용
const REROLL_ITEM_BASE = 8;
const REROLL_LINKS_BASE = 15;
const REROLL_AFFIX_BASE = 20;
const GEM_BUY_BASE = 25;
const GEM_SWAP_BASE = 10;
// 메인 스킬 가챠 — 화톳불마다 같은 카운터에 누적되어 비싸진다.
const MAIN_SKILL_REROLL_BASE = 50;
// 장착 아이템 슬롯 정원
const MAX_EQUIPPED_ITEMS = 4;
// 미장착 인벤토리 정원
const MAX_INVENTORY = 8;

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
  // excludeId 가 주어지면 최종 결과에서 그 스킬을 제외(중복 회피용).
  runRoulette(onPicked: (skillId: string) => void, excludeId?: string): void {
    const skills = listSkills();
    const cycles = 10;
    const items: SkillDef[] = [];
    for (let i = 0; i < cycles; i++) {
      const shuf = shuffle(skills.slice());
      items.push(...shuf);
    }
    const pickPool = excludeId
      ? skills.filter((s) => s.id !== excludeId)
      : skills;
    const finalSkill =
      pickPool[Math.floor(Math.random() * pickPool.length)] ?? skills[0];
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
          const eased = 1 - Math.pow(1 - u, 5);
          const y = endY * eased;
          track.style.transform = `translateY(${y}px)`;
          if (u < 1) {
            raf = requestAnimationFrame(animate);
          } else {
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

  // === 정비 ===
  showMaintenance(opts: {
    run: RunState;
    itemRewards: ItemInstance[];
    onChange: () => void;
    onContinue: () => void;
  }): void {
    // 같은 화톳불 안에서만 누적되는 리롤 카운터.
    const counter = new RerollCounter();
    // 같은 화톳불 안에서 액션 RNG (시드는 시간 기반 — 같은 정비 안에서 일관성)
    const rng = new RNG(randomSeed());

    const renderPanel = () => {
      this.show(this.maintenanceHtml(opts.run, opts.itemRewards, counter), (panel) =>
        this.wireMaintenance(
          panel,
          opts.run,
          opts.itemRewards,
          counter,
          rng,
          () => {
            opts.onChange();
            renderPanel();
          },
          opts.onContinue,
        ),
      );
    };
    renderPanel();
  }

  private maintenanceHtml(
    run: RunState,
    itemRewards: ItemInstance[],
    counter: RerollCounter,
  ): string {
    const linksCost = counter.cost('links', REROLL_LINKS_BASE);
    const gemBuyCost = counter.cost('gemBuy', GEM_BUY_BASE);
    const itemRerollCost = counter.cost('itemReward', REROLL_ITEM_BASE);
    const socketCost = socketExpandCost(run.mainSkill.sockets);
    const mainSkillRerollCost = counter.cost(
      'mainSkill',
      MAIN_SKILL_REROLL_BASE,
    );

    const credits = run.credits;
    const hasRewards = itemRewards.length > 0;
    const slotsFull = run.items.length >= MAX_EQUIPPED_ITEMS;
    const inventoryFull = run.supports.length >= MAX_INVENTORY;

    const mainSkillDef = getSkill(run.mainSkill.defId);
    const socketsHtml = this.socketRowHtml(run);
    const inventoryHtml = this.supportInventoryHtml(run);
    const socketDetailsHtml = this.socketDetailsHtml(run);
    const itemsHtml = this.equippedItemsHtml(run, counter);
    const rewardsHtml = hasRewards
      ? this.rewardItemsHtml(itemRewards, slotsFull, itemRerollCost, credits)
      : '';

    const shopGrid = `
      <div class="shop-grid">
        <button class="shop-btn" data-shop="socket" ${socketCost === null || credits < socketCost ? 'disabled' : ''}>
          <span class="shop-label">소켓 확장</span>
          <span class="shop-cost">${socketCost === null ? '최대' : `${socketCost}c`}</span>
          <span class="shop-sub">${run.mainSkill.sockets}/${MAX_SOCKETS}</span>
        </button>
        <button class="shop-btn" data-shop="links" ${credits < linksCost ? 'disabled' : ''}>
          <span class="shop-label">링크 리롤</span>
          <span class="shop-cost">${linksCost}c</span>
          <span class="shop-sub">인접 60%</span>
        </button>
        <button class="shop-btn" data-shop="gem" ${credits < gemBuyCost || inventoryFull ? 'disabled' : ''}>
          <span class="shop-label">젬 구매</span>
          <span class="shop-cost">${gemBuyCost}c</span>
          <span class="shop-sub">${inventoryFull ? '인벤토리 가득' : `인벤토리 ${run.supports.length}/${MAX_INVENTORY}`}</span>
        </button>
        <button class="shop-btn" data-shop="mainSkill" ${credits < mainSkillRerollCost ? 'disabled' : ''}>
          <span class="shop-label">메인 스킬 가챠</span>
          <span class="shop-cost">${mainSkillRerollCost}c</span>
          <span class="shop-sub">현재: ${mainSkillDef.name}</span>
        </button>
      </div>
    `;

    return `
      <div class="panel maintenance-panel">
        <div class="maintenance-header">
          <h2>정비 — 층 ${run.floor}</h2>
          <span class="credit-badge">${credits}c</span>
        </div>
        <p class="muted">화톳불에서만 빌드 변경 가능. 옵션당 ${REFINE_COST_PER_POINT}c. 화톳불을 떠나면 리롤 비용이 리셋된다.</p>
        <section class="shop-section">
          <h3>상점</h3>
          ${shopGrid}
        </section>
        <div class="maintenance-body">
          <section class="maintenance-col">
            <h3>메인 스킬 — ${mainSkillDef.name}</h3>
            ${socketsHtml}
            ${socketDetailsHtml}
            <h3>인벤토리 <span class="slot-count">${run.supports.length}/${MAX_INVENTORY}</span></h3>
            ${inventoryHtml}
          </section>
          <section class="maintenance-col">
            <h3>장착 아이템 <span class="slot-count">${run.items.length}/${MAX_EQUIPPED_ITEMS}</span></h3>
            ${itemsHtml}
            ${rewardsHtml}
          </section>
        </div>
        <div class="maintenance-footer">
          <button class="btn" data-continue>다음 층으로 →</button>
        </div>
      </div>
    `;
  }

  private socketRowHtml(run: RunState): string {
    const skill = run.mainSkill;
    const reached = computeReached(skill);
    const cells: string[] = [];
    const mainSkillDef = getSkill(skill.defId);
    for (let i = 0; i < skill.sockets; i++) {
      const isMain = i === 0;
      const inst = skill.socketed[i];
      const active = reached[i];
      const supportDef = inst ? getSupport(inst.defId) : null;
      const dotStyle = isMain
        ? `background:${mainSkillDef.color}`
        : inst
          ? `background:${active ? 'var(--rune)' : '#3a2e44'}`
          : `background:transparent;border-style:dashed`;
      const label = isMain ? mainSkillDef.name : supportDef?.name ?? '빈 슬롯';
      cells.push(`
        <div class="socket-cell${active ? ' active' : ''}${isMain ? ' main' : ''}">
          <button class="socket-dot"
                  style="${dotStyle}"
                  data-socket="${i}"
                  ${isMain ? 'disabled' : ''}
                  title="${escapeAttr(label)}">
            ${isMain ? '★' : inst ? '◆' : '○'}
          </button>
          <div class="socket-label">${escapeHtml(isMain ? '주' : `${i}`)}</div>
        </div>
      `);
      if (i < skill.sockets - 1) {
        const linked = skill.links[i];
        cells.push(`<div class="socket-link ${linked ? 'on' : 'off'}"></div>`);
      }
    }
    return `<div class="socket-row">${cells.join('')}</div>`;
  }

  private socketDetailsHtml(run: RunState): string {
    const skill = run.mainSkill;
    const reached = computeReached(skill);
    const items: string[] = [];
    for (let i = 1; i < skill.sockets; i++) {
      const inst = skill.socketed[i];
      const active = reached[i];
      if (!inst) {
        items.push(`
          <div class="socket-detail empty${active ? '' : ' inactive'}">
            <div class="head">
              <span class="name">소켓 ${i} ${active ? '' : '<span class="tag inactive">비활성</span>'}</span>
            </div>
            <div class="muted">빈 슬롯 — 인벤토리에서 서포트를 클릭해 자동 부착.</div>
          </div>
        `);
        continue;
      }
      const def = getSupport(inst.defId);
      const optionsHtml = def.options
        .map((opt) => {
          const cur = inst.values[opt.key] ?? opt.initial;
          const cantBuy = run.credits < REFINE_COST_PER_POINT || cur >= opt.max;
          return `
            <div class="stat-row">
              <span class="label">${opt.label}</span>
              <span class="value">${opt.format(cur)}</span>
              <button class="btn-mini" data-sup-socket="${i}" data-key="${opt.key}" data-dir="-" ${cur <= opt.min ? 'disabled' : ''}>−</button>
              <button class="btn-mini" data-sup-socket="${i}" data-key="${opt.key}" data-dir="+" ${cantBuy ? 'disabled' : ''}>+</button>
            </div>
          `;
        })
        .join('');
      items.push(`
        <div class="socket-detail${active ? '' : ' inactive'}">
          <div class="head">
            <span class="name">소켓 ${i} · ${def.name} ${active ? '' : '<span class="tag inactive">비활성</span>'}</span>
            <span class="actions">
              <button class="btn-mini detach" data-socket-detach="${i}">분리</button>
              <button class="btn-mini swap" data-socket-swap="${i}">교체</button>
            </span>
          </div>
          <div class="stats">${optionsHtml}</div>
        </div>
      `);
    }
    if (items.length === 0) {
      return '<div class="muted">소켓이 없습니다. 상점에서 확장하세요.</div>';
    }
    return `<div class="socket-detail-list">${items.join('')}</div>`;
  }

  private supportInventoryHtml(run: RunState): string {
    const skill = run.mainSkill;
    const anyEmpty = skill.socketed.some((s, i) => i > 0 && s === null);
    if (run.supports.length === 0) {
      return '<div class="muted">미장착 서포트가 없습니다.</div>';
    }
    const cards = run.supports
      .map((inst, idx) => {
        const def = getSupport(inst.defId);
        const tag = def.kind === 'qualitative' ? '질적' : '양적';
        const tagClass = def.kind === 'qualitative' ? 'qual' : '';
        return `
          <button class="inv-gem" data-attach-inv="${idx}" ${anyEmpty ? '' : 'disabled'}>
            <span class="name">${def.name} <span class="tag ${tagClass}">${tag}</span></span>
            <span class="desc">${def.description}</span>
          </button>
        `;
      })
      .join('');
    return `<div class="inv-gem-list">${cards}</div>`;
  }

  private equippedItemsHtml(run: RunState, counter: RerollCounter): string {
    if (run.items.length === 0) {
      return '<div class="muted">장착된 아이템이 없습니다.</div>';
    }
    const prefixCost = counter.cost('prefix', REROLL_AFFIX_BASE);
    const suffixCost = counter.cost('suffix', REROLL_AFFIX_BASE);
    const credits = run.credits;
    const cards = run.items
      .map((item, idx) => {
        const slotLabel = SLOT_LABELS[item.slot];
        const modsHtml = this.itemModsHtml(item);
        const enhanceDisabled = item.enhanced || credits < ENHANCE_COST;
        return `
          <div class="item-card">
            <div class="head">
              <div class="name">${escapeHtml(item.name)}</div>
              <div class="actions">
                <span class="muted">${slotLabel}</span>
                <button class="btn-delete" data-item-delete="${idx}">삭제</button>
              </div>
            </div>
            ${modsHtml}
            <div class="item-shop">
              <button class="btn-reroll" data-item-prefix="${idx}" ${credits < prefixCost ? 'disabled' : ''}>접두 변경 ${prefixCost}c</button>
              <button class="btn-reroll" data-item-suffix="${idx}" ${credits < suffixCost ? 'disabled' : ''}>접미 변경 ${suffixCost}c</button>
              <button class="btn-reroll" data-item-enhance="${idx}" ${enhanceDisabled ? 'disabled' : ''}>강화 ${ENHANCE_COST}c${item.enhanced ? ' · 사용' : ''}</button>
            </div>
          </div>
        `;
      })
      .join('');
    return `<div class="item-card-list">${cards}</div>`;
  }

  private itemModsHtml(item: ItemInstance): string {
    const renderMod = (mod: ItemMod, kind: 'prefix' | 'suffix') => {
      const def = getAffix(mod.affixId);
      if (!def) return '';
      const dot = kind === 'prefix' ? 'pre' : 'suf';
      return `
        <div class="item-mod ${dot}">
          <span class="dot"></span>
          <span class="label">${def.label}</span>
          <span class="value">${def.format(mod.roll)}</span>
          <span class="tier T${mod.tier}">T${mod.tier}</span>
        </div>
      `;
    };
    const empty = item.prefixes.length === 0 && item.suffixes.length === 0;
    if (empty) {
      return '<div class="muted item-mod-empty">모드 없음</div>';
    }
    const pre = item.prefixes.map((m) => renderMod(m, 'prefix')).join('');
    const suf = item.suffixes.map((m) => renderMod(m, 'suffix')).join('');
    return `<div class="item-mods">${pre}${suf}</div>`;
  }

  private rewardItemsHtml(
    rewards: ItemInstance[],
    slotsFull: boolean,
    rerollCost: number,
    credits: number,
  ): string {
    const canReroll = rewards.length > 0 && credits >= rerollCost;
    const cards = rewards
      .map((item, idx) => {
        const slotLabel = SLOT_LABELS[item.slot];
        const modsHtml = this.itemModsHtml(item);
        return `
          <button class="item-card choice-card" data-item-pick="${idx}" ${slotsFull ? 'disabled' : ''}>
            <div class="head">
              <div class="name">${escapeHtml(item.name)}</div>
              <div class="actions"><span class="muted">${slotLabel}</span></div>
            </div>
            ${modsHtml}
          </button>
        `;
      })
      .join('');
    return `
      <div class="divider"></div>
      <h3>보상 아이템</h3>
      ${slotsFull ? '<div class="slot-warning">장착 슬롯 가득. 삭제 후 재시도.</div>' : ''}
      <div class="item-card-list">
        ${cards}
        <button class="choice" data-item-skip>건너뛰기</button>
      </div>
      <div class="reroll-row">
        <button class="btn-reroll" data-item-reward-reroll ${canReroll ? '' : 'disabled'}>
          보상 리롤 ${rerollCost}c
        </button>
      </div>
    `;
  }

  private wireMaintenance(
    panel: HTMLElement,
    run: RunState,
    itemRewards: ItemInstance[],
    counter: RerollCounter,
    rng: RNG,
    onChange: () => void,
    onContinue: () => void,
  ): void {
    // 소켓 박힌 서포트 옵션 ±
    panel.querySelectorAll('button[data-sup-socket]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt((btn as HTMLElement).dataset.supSocket!, 10);
        const key = (btn as HTMLElement).dataset.key!;
        const dir = (btn as HTMLElement).dataset.dir!;
        const inst = run.mainSkill.socketed[i];
        if (!inst) return;
        if (dir === '+') {
          if (run.credits < REFINE_COST_PER_POINT) return;
          if (increaseOption(inst, key)) {
            run.credits -= REFINE_COST_PER_POINT;
            onChange();
          }
        } else if (decreaseOption(inst, key)) {
          run.credits += REFINE_COST_PER_POINT;
          onChange();
        }
      });
    });

    // 소켓 분리
    panel.querySelectorAll('[data-socket-detach]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt((btn as HTMLElement).dataset.socketDetach!, 10);
        if (run.supports.length >= MAX_INVENTORY) return;
        detachFromSocket(run, i);
        onChange();
      });
    });

    // 소켓 교체 (랜덤 다른 종으로)
    panel.querySelectorAll('[data-socket-swap]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const i = parseInt((btn as HTMLElement).dataset.socketSwap!, 10);
        const cost = counter.cost('gemSwap', GEM_SWAP_BASE);
        if (run.credits < cost) return;
        const result = swapSocketedGem(run.mainSkill, i, rng);
        if (!result) return;
        run.credits -= cost;
        counter.bump('gemSwap');
        onChange();
      });
    });

    // 인벤토리 → 가장 가까운 빈 소켓에 자동 부착
    panel.querySelectorAll('[data-attach-inv]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.attachInv!, 10);
        if (attachToFirstEmptySocket(run, idx)) {
          onChange();
        }
      });
    });

    // 상점 — 소켓 확장
    panel.querySelector('[data-shop="socket"]')?.addEventListener('click', () => {
      const cost = socketExpandCost(run.mainSkill.sockets);
      if (cost === null) return;
      if (run.credits < cost) return;
      if (!expandSocket(run.mainSkill)) return;
      run.credits -= cost;
      onChange();
    });

    // 상점 — 링크 리롤
    panel.querySelector('[data-shop="links"]')?.addEventListener('click', () => {
      const cost = counter.cost('links', REROLL_LINKS_BASE);
      if (run.credits < cost) return;
      run.mainSkill.links = rollLinks(run.mainSkill.sockets, rng);
      run.credits -= cost;
      counter.bump('links');
      onChange();
    });

    // 상점 — 젬 구매
    panel.querySelector('[data-shop="gem"]')?.addEventListener('click', () => {
      if (run.supports.length >= MAX_INVENTORY) return;
      const cost = counter.cost('gemBuy', GEM_BUY_BASE);
      if (run.credits < cost) return;
      run.supports.push(buyRandomGem(rng));
      run.credits -= cost;
      counter.bump('gemBuy');
      onChange();
    });

    // 상점 — 메인 스킬 가챠 (룰렛 애니메이션 → defId 교체, 소켓/링크/서포트는 유지)
    panel
      .querySelector('[data-shop="mainSkill"]')
      ?.addEventListener('click', () => {
        const cost = counter.cost('mainSkill', MAIN_SKILL_REROLL_BASE);
        if (run.credits < cost) return;
        run.credits -= cost;
        counter.bump('mainSkill');
        const currentId = run.mainSkill.defId;
        this.runRoulette((skillId) => {
          run.mainSkill.defId = skillId;
          // onChange 가 정비 화면을 다시 렌더하면서 자연스럽게 룰렛 패널이 닫힌다.
          onChange();
        }, currentId);
      });

    // 장착 아이템 — 접두 변경
    panel.querySelectorAll('[data-item-prefix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.itemPrefix!, 10);
        const item = run.items[idx];
        if (!item) return;
        const cost = counter.cost('prefix', REROLL_AFFIX_BASE);
        if (run.credits < cost) return;
        rerollPrefixes(item, run.floor, rng);
        run.credits -= cost;
        counter.bump('prefix');
        onChange();
      });
    });

    // 장착 아이템 — 접미 변경
    panel.querySelectorAll('[data-item-suffix]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.itemSuffix!, 10);
        const item = run.items[idx];
        if (!item) return;
        const cost = counter.cost('suffix', REROLL_AFFIX_BASE);
        if (run.credits < cost) return;
        rerollSuffixes(item, run.floor, rng);
        run.credits -= cost;
        counter.bump('suffix');
        onChange();
      });
    });

    // 장착 아이템 — 강화 (한 아이템당 1회)
    panel.querySelectorAll('[data-item-enhance]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.itemEnhance!, 10);
        const item = run.items[idx];
        if (!item) return;
        if (item.enhanced) return;
        if (run.credits < ENHANCE_COST) return;
        if (enhanceItem(item)) {
          run.credits -= ENHANCE_COST;
          onChange();
        }
      });
    });

    // 장착 아이템 — 삭제
    panel.querySelectorAll('[data-item-delete]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt((btn as HTMLElement).dataset.itemDelete!, 10);
        if (idx >= 0 && idx < run.items.length) {
          run.items.splice(idx, 1);
          onChange();
        }
      });
    });

    // 보상 아이템 — 픽
    panel.querySelectorAll('[data-item-pick]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (run.items.length >= MAX_EQUIPPED_ITEMS) return;
        const idx = parseInt((btn as HTMLElement).dataset.itemPick!, 10);
        const item = itemRewards[idx];
        if (!item) return;
        run.items.push(item);
        itemRewards.splice(idx, 1);
        onChange();
      });
    });

    // 보상 아이템 — 건너뛰기
    panel.querySelector('[data-item-skip]')?.addEventListener('click', () => {
      itemRewards.length = 0;
      onChange();
    });

    // 보상 아이템 — 리롤
    panel
      .querySelector('[data-item-reward-reroll]')
      ?.addEventListener('click', () => {
        if (itemRewards.length === 0) return;
        const cost = counter.cost('itemReward', REROLL_ITEM_BASE);
        if (run.credits < cost) return;
        run.credits -= cost;
        const floor = run.floor;
        itemRewards.length = 0;
        itemRewards.push(rollItemRandomSlot(floor, rng), rollItemRandomSlot(floor, rng));
        counter.bump('itemReward');
        onChange();
      });

    // 다음 층
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

// === 헬퍼 ===
function computeReached(skill: RunState['mainSkill']): boolean[] {
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

