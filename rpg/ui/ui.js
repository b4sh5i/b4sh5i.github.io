/**
 * UI 업데이트 및 제어 함수들
 */

/**
 * 전체 UI 업데이트
 */
function updateUI() {
    updatePlayerUI();
    updateDungeonUI();
    updateInventoryUI();
    updateBoxesUI();
    updateStatsUI();
}

/**
 * 플레이어 정보 UI 업데이트
 */
function updatePlayerUI() {
    const stats = calculatePlayerStats();

    document.getElementById('player-name').textContent = gameState.player.name;
    document.getElementById('player-level').textContent = gameState.player.level;
    document.getElementById('player-hp').textContent = `${gameState.player.currentHp} / ${stats.hp}`;
    document.getElementById('player-attack').textContent = stats.attack;
    document.getElementById('player-defense').textContent = stats.defense;

    // HP 바
    const hpPercent = (gameState.player.currentHp / stats.hp) * 100;
    document.getElementById('hp-bar').style.width = `${hpPercent}%`;

    // 장착 아이템
    updateEquippedItems();
}

/**
 * 장착 아이템 UI 업데이트
 */
function updateEquippedItems() {
    const slots = ['weapon', 'armor', 'accessory'];

    slots.forEach(slot => {
        const item = gameState.player.equipped[slot];
        const element = document.getElementById(`equipped-${slot}`);

        if (item) {
            element.innerHTML = `
        <div class="equipped-item" style="border-color: ${RARITY_COLORS[item.rarity]}">
          <div class="item-name">${item.name}</div>
          <div class="item-rarity" style="color: ${RARITY_COLORS[item.rarity]}">${RARITY_NAMES[item.rarity]}</div>
          <button onclick="unequipItem('${slot}')" class="btn-small">해제</button>
        </div>
      `;
        } else {
            element.innerHTML = `<div class="empty-slot">${TYPE_NAMES[slot]} 없음</div>`;
        }
    });
}

/**
 * 던전 UI 업데이트
 */
function updateDungeonUI() {
    document.getElementById('current-floor').textContent = gameState.dungeon.currentFloor;
    document.getElementById('max-floor').textContent = gameState.dungeon.maxFloor;

    if (gameState.dungeon.inBattle && gameState.dungeon.currentEnemy) {
        const enemy = gameState.dungeon.currentEnemy;
        document.getElementById('enemy-info').innerHTML = `
      <div class="enemy-card ${enemy.isBoss ? 'boss' : ''}">
        <div class="enemy-name">${enemy.name}</div>
        <div class="enemy-hp">HP: ${enemy.hp} / ${enemy.maxHp}</div>
        <div class="enemy-stats">
          <span>⚔️ ${enemy.attack}</span>
          <span>🛡️ ${enemy.defense}</span>
        </div>
        <div class="enemy-hp-bar">
          <div class="hp-fill" style="width: ${(enemy.hp / enemy.maxHp) * 100}%"></div>
        </div>
      </div>
    `;

        document.getElementById('battle-actions').style.display = 'none';
    } else {
        document.getElementById('enemy-info').innerHTML = '<div class="no-enemy">전투 준비 중...</div>';
        document.getElementById('battle-actions').style.display = 'block';
    }
}

/**
 * 인벤토리 UI 업데이트
 */
function updateInventoryUI() {
    const container = document.getElementById('inventory-list');

    if (gameState.inventory.length === 0) {
        container.innerHTML = '<div class="empty-message">아이템이 없습니다</div>';
        return;
    }

    container.innerHTML = gameState.inventory.map((item, index) => {
        const isEquipped = Object.values(gameState.player.equipped).some(eq => eq && eq.id === item.id);

        return `
      <div class="item-card" style="border-color: ${RARITY_COLORS[item.rarity]}">
        <div class="item-header">
          <span class="item-name">${item.name}</span>
          <span class="item-rarity" style="color: ${RARITY_COLORS[item.rarity]}">${RARITY_NAMES[item.rarity]}</span>
        </div>
        <div class="item-type">${TYPE_NAMES[item.type]}</div>
        <div class="item-stats">
          ${item.attack > 0 ? `<span>⚔️ +${item.attack}</span>` : ''}
          ${item.defense > 0 ? `<span>🛡️ +${item.defense}</span>` : ''}
          ${item.hp > 0 ? `<span>❤️ +${item.hp}</span>` : ''}
        </div>
        ${isEquipped
                ? '<div class="equipped-badge">장착 중</div>'
                : `<button onclick="equipItem(${item.id})" class="btn-equip">장착</button>`
            }
      </div>
    `;
    }).join('');
}

/**
 * 상자 목록 UI 업데이트
 */
function updateBoxesUI() {
    const container = document.getElementById('boxes-list');

    if (gameState.boxes.length === 0) {
        container.innerHTML = '<div class="empty-message">보유 중인 상자가 없습니다</div>';
        return;
    }

    container.innerHTML = gameState.boxes.map((box, index) => `
    <div class="box-card" style="background: linear-gradient(135deg, ${BOX_COLORS[box.grade]}22, ${BOX_COLORS[box.grade]}44)">
      <div class="box-icon" style="color: ${BOX_COLORS[box.grade]}">📦</div>
      <div class="box-name">${BOX_NAMES[box.grade]}</div>
      <div class="box-floor">${box.floor}층 보상</div>
      <button onclick="openBox(${index})" class="btn-open">열기</button>
    </div>
  `).join('');
}

/**
 * 통계 UI 업데이트
 */
function updateStatsUI() {
    const stats = gameState.statistics;
    document.getElementById('total-boxes').textContent = stats.totalBoxesOpened;
    document.getElementById('total-floors').textContent = stats.totalFloorsCleared;
    document.getElementById('inventory-count').textContent = gameState.inventory.length;
}

/**
 * 전투 로그 추가
 */
function addBattleLog(message) {
    const log = document.getElementById('battle-log');
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = message;
    log.appendChild(entry);
    log.scrollTop = log.scrollHeight;
}

/**
 * 전투 로그 초기화
 */
function clearBattleLog() {
    document.getElementById('battle-log').innerHTML = '';
}

/**
 * 가챠 결과 모달 표시
 */
function showGachaResult(result) {
    const modal = document.getElementById('gacha-modal');
    const item = result.item;

    document.getElementById('gacha-result').innerHTML = `
    <div class="gacha-animation">
      <div class="gacha-item" style="border-color: ${RARITY_COLORS[item.rarity]}; animation: gachaReveal 0.5s ease-out;">
        <div class="gacha-rarity" style="color: ${RARITY_COLORS[item.rarity]}">${RARITY_NAMES[item.rarity]}</div>
        <div class="gacha-name">${item.name}</div>
        <div class="gacha-type">${TYPE_NAMES[item.type]}</div>
        <div class="gacha-stats">
          ${item.attack > 0 ? `<div>⚔️ 공격력 +${item.attack}</div>` : ''}
          ${item.defense > 0 ? `<div>🛡️ 방어력 +${item.defense}</div>` : ''}
          ${item.hp > 0 ? `<div>❤️ 체력 +${item.hp}</div>` : ''}
        </div>
      </div>
    </div>
  `;

    modal.style.display = 'flex';
    updateUI();
}

/**
 * 가챠 모달 닫기
 */
function closeGachaModal() {
    document.getElementById('gacha-modal').style.display = 'none';
}

/**
 * 탭 전환
 */
function switchTab(tabName) {
    // 모든 탭 숨기기
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // 모든 탭 버튼 비활성화
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // 선택한 탭 표시
    document.getElementById(`${tabName}-tab`).classList.add('active');
    document.querySelector(`[onclick="switchTab('${tabName}')"]`).classList.add('active');

    updateUI();
}

/**
 * 던전 선택 모달 표시
 */
function showDungeonSelect() {
    const modal = document.getElementById('dungeon-select-modal');
    const list = document.getElementById('dungeon-list');

    let html = '';
    for (let i = 1; i < gameState.dungeon.maxFloor; i++) {
        html += `
      <div class="dungeon-item">
        <span>${i}층 ${i % 5 === 0 ? '(보스)' : ''}</span>
        <button onclick="retryFloor(${i}); closeDungeonSelect();" class="btn-retry">재도전</button>
      </div>
    `;
    }

    list.innerHTML = html || '<div class="empty-message">재도전 가능한 던전이 없습니다</div>';
    modal.style.display = 'flex';
}

/**
 * 던전 선택 모달 닫기
 */
function closeDungeonSelect() {
    document.getElementById('dungeon-select-modal').style.display = 'none';
}

/**
 * 세이브 모달 표시
 */
function showSaveModal() {
    const modal = document.getElementById('save-modal');
    const code = generateSaveCode(gameState);

    document.getElementById('save-code-display').value = code;
    modal.style.display = 'flex';
}

/**
 * 세이브 모달 닫기
 */
function closeSaveModal() {
    document.getElementById('save-modal').style.display = 'none';
}

/**
 * 로드 모달 표시
 */
function showLoadModal() {
    document.getElementById('load-modal').style.display = 'flex';
}

/**
 * 로드 모달 닫기
 */
function closeLoadModal() {
    document.getElementById('load-modal').style.display = 'none';
}

/**
 * 세이브 코드 복사
 */
function copySaveCode() {
    const input = document.getElementById('save-code-display');
    input.select();
    document.execCommand('copy');
    alert('세이브 코드가 복사되었습니다!');
}

/**
 * 로드 실행
 */
function executeLoad() {
    const code = document.getElementById('load-code-input').value.trim();
    if (code) {
        loadGame(code);
        closeLoadModal();
    } else {
        alert('세이브 코드를 입력해주세요.');
    }
}
