/**
 * 메인 게임 로직 및 상태 관리
 */

// 게임 상태
let gameState = {
    player: {
        name: '모험가',
        level: 1,
        exp: 0,
        baseAttack: 10,
        baseDefense: 5,
        baseHp: 100,
        currentHp: 100,
        equipped: {
            weapon: null,
            armor: null,
            accessory: null
        }
    },
    dungeon: {
        currentFloor: 1,
        maxFloor: 1,
        inBattle: false,
        currentEnemy: null
    },
    inventory: [],
    boxes: [], // 획득한 상자들
    statistics: {
        totalBoxesOpened: 0,
        totalFloorsCleared: 0,
        itemsObtained: {
            common: 0,
            rare: 0,
            hero: 0,
            legendary: 0
        }
    }
};

/**
 * 플레이어 총 스탯 계산
 */
function calculatePlayerStats() {
    let totalAttack = gameState.player.baseAttack;
    let totalDefense = gameState.player.baseDefense;
    let totalHp = gameState.player.baseHp;

    // 장착한 아이템 스탯 합산
    Object.values(gameState.player.equipped).forEach(item => {
        if (item) {
            totalAttack += item.attack || 0;
            totalDefense += item.defense || 0;
            totalHp += item.hp || 0;
        }
    });

    return { attack: totalAttack, defense: totalDefense, hp: totalHp };
}

/**
 * 적 생성
 */
function generateEnemy(floor) {
    const baseHp = 50 + (floor * 10);
    const baseAttack = 5 + (floor * 2);
    const baseDefense = 2 + Math.floor(floor / 2);

    // 5층 단위는 보스
    const isBoss = floor % 5 === 0;
    const multiplier = isBoss ? 3 : 1;

    return {
        name: isBoss ? `${floor}층 보스` : `${floor}층 몬스터`,
        hp: baseHp * multiplier,
        maxHp: baseHp * multiplier,
        attack: baseAttack * multiplier,
        defense: baseDefense * multiplier,
        isBoss: isBoss,
        floor: floor
    };
}

/**
 * 전투 시작
 */
function startBattle() {
    gameState.dungeon.currentEnemy = generateEnemy(gameState.dungeon.currentFloor);
    gameState.dungeon.inBattle = true;

    // 플레이어 HP 초기화
    const stats = calculatePlayerStats();
    gameState.player.currentHp = stats.hp;

    updateUI();
    autoBattle();
}

/**
 * 자동 전투 (턴제)
 */
function autoBattle() {
    if (!gameState.dungeon.inBattle) return;

    const enemy = gameState.dungeon.currentEnemy;
    const playerStats = calculatePlayerStats();

    // 플레이어 공격
    const playerDamage = Math.max(1, playerStats.attack - enemy.defense);
    enemy.hp -= playerDamage;

    addBattleLog(`플레이어가 ${playerDamage} 데미지를 입혔습니다!`);

    if (enemy.hp <= 0) {
        // 전투 승리
        battleVictory();
        return;
    }

    // 적 공격
    const enemyDamage = Math.max(1, enemy.attack - playerStats.defense);
    gameState.player.currentHp -= enemyDamage;

    addBattleLog(`${enemy.name}이(가) ${enemyDamage} 데미지를 입혔습니다!`);

    if (gameState.player.currentHp <= 0) {
        // 전투 패배
        battleDefeat();
        return;
    }

    updateUI();

    // 다음 턴
    setTimeout(autoBattle, 800);
}

/**
 * 전투 승리
 */
function battleVictory() {
    gameState.dungeon.inBattle = false;
    const floor = gameState.dungeon.currentFloor;

    addBattleLog(`🎉 ${floor}층 클리어!`);

    // 보상 상자 지급
    const boxGrade = getRewardBoxGrade(floor, false);
    gameState.boxes.push({ grade: boxGrade, floor: floor });

    addBattleLog(`${BOX_NAMES[boxGrade]}을(를) 획득했습니다!`);

    // 최대 층수 업데이트
    if (floor >= gameState.dungeon.maxFloor) {
        gameState.dungeon.maxFloor = floor + 1;
    }

    gameState.statistics.totalFloorsCleared++;

    // 자동 저장
    autoSave(gameState);

    updateUI();
}

/**
 * 전투 패배
 */
function battleDefeat() {
    gameState.dungeon.inBattle = false;
    addBattleLog('💀 전투에서 패배했습니다...');

    // HP 회복
    const stats = calculatePlayerStats();
    gameState.player.currentHp = stats.hp;

    updateUI();
}

/**
 * 다음 층으로 이동
 */
function moveToNextFloor() {
    if (gameState.dungeon.inBattle) return;

    gameState.dungeon.currentFloor++;
    clearBattleLog();
    startBattle();
}

/**
 * 이전 층 재도전
 */
function retryFloor(floor) {
    if (gameState.dungeon.inBattle) return;
    if (floor >= gameState.dungeon.maxFloor) return;

    gameState.dungeon.currentFloor = floor;
    clearBattleLog();

    // 재도전 전투 시작
    gameState.dungeon.currentEnemy = generateEnemy(floor);
    gameState.dungeon.inBattle = true;

    const stats = calculatePlayerStats();
    gameState.player.currentHp = stats.hp;

    updateUI();
    autoBattleRetry();
}

/**
 * 재도전 자동 전투
 */
function autoBattleRetry() {
    if (!gameState.dungeon.inBattle) return;

    const enemy = gameState.dungeon.currentEnemy;
    const playerStats = calculatePlayerStats();

    const playerDamage = Math.max(1, playerStats.attack - enemy.defense);
    enemy.hp -= playerDamage;

    addBattleLog(`플레이어가 ${playerDamage} 데미지를 입혔습니다!`);

    if (enemy.hp <= 0) {
        // 재도전 승리
        gameState.dungeon.inBattle = false;
        const floor = gameState.dungeon.currentFloor;

        addBattleLog(`🎉 ${floor}층 재도전 성공!`);

        // 중급/하급 상자 랜덤 지급
        const boxGrade = getRewardBoxGrade(floor, true);
        gameState.boxes.push({ grade: boxGrade, floor: floor });

        addBattleLog(`${BOX_NAMES[boxGrade]}을(를) 획득했습니다!`);

        autoSave(gameState);
        updateUI();
        return;
    }

    const enemyDamage = Math.max(1, enemy.attack - playerStats.defense);
    gameState.player.currentHp -= enemyDamage;

    addBattleLog(`${enemy.name}이(가) ${enemyDamage} 데미지를 입혔습니다!`);

    if (gameState.player.currentHp <= 0) {
        battleDefeat();
        return;
    }

    updateUI();
    setTimeout(autoBattleRetry, 800);
}

/**
 * 아이템 장착
 */
function equipItem(itemId) {
    const item = gameState.inventory.find(i => i.id === itemId);
    if (!item) return;

    const slot = item.type;

    // 기존 아이템 해제
    if (gameState.player.equipped[slot]) {
        gameState.player.equipped[slot] = null;
    }

    // 새 아이템 장착
    gameState.player.equipped[slot] = item;

    autoSave(gameState);
    updateUI();
}

/**
 * 아이템 해제
 */
function unequipItem(slot) {
    gameState.player.equipped[slot] = null;
    autoSave(gameState);
    updateUI();
}

/**
 * 상자 열기
 */
function openBox(index) {
    if (index >= gameState.boxes.length) return;

    const box = gameState.boxes[index];
    const result = openGachaBox(box.grade);

    // 인벤토리에 추가
    gameState.inventory.push(result.item);

    // 통계 업데이트
    gameState.statistics.totalBoxesOpened++;
    gameState.statistics.itemsObtained[result.item.rarity]++;

    // 상자 제거
    gameState.boxes.splice(index, 1);

    autoSave(gameState);

    // 가챠 결과 표시
    showGachaResult(result);
}

/**
 * 게임 초기화
 */
function initGame() {
    // 자동 저장 로드 시도
    const savedState = loadAutoSave();

    if (savedState) {
        gameState = savedState;
        console.log('자동 저장 데이터 로드 완료');
    }

    updateUI();
}

/**
 * 새 게임 시작
 */
function newGame() {
    if (confirm('새 게임을 시작하시겠습니까? 현재 진행 상황이 삭제됩니다.')) {
        deleteSaveData();
        location.reload();
    }
}

/**
 * 세이브 코드로 로드
 */
function loadGame(saveCode) {
    const savedState = loadFromSaveCode(saveCode);

    if (savedState) {
        gameState = savedState;
        updateUI();
        alert('게임 데이터를 불러왔습니다!');
    } else {
        alert('잘못된 세이브 코드입니다.');
    }
}

/**
 * 세이브 코드 생성 및 표시
 */
function showSaveCode() {
    const code = generateSaveCode(gameState);
    if (code) {
        alert(`세이브 코드: ${code}\n\n이 코드를 저장해두면 언제든지 게임을 불러올 수 있습니다!`);
    } else {
        alert('세이브 코드 생성에 실패했습니다.');
    }
}
