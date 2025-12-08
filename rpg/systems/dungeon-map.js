/**
 * 던전 미니맵 시스템 (아이작 스타일)
 * 각 층마다 랜덤 생성된 방들로 구성
 */

// 방 타입
const ROOM_TYPE = {
    EMPTY: 'empty',           // 빈 방
    MONSTER: 'monster',       // 몬스터 방
    TREASURE: 'treasure',     // 보물 방
    WELL: 'well',            // 우물 (5층 단위)
    START: 'start'           // 시작 방
};

// 방 상태
const ROOM_STATE = {
    UNEXPLORED: 'unexplored', // 미탐험
    CURRENT: 'current',       // 현재 위치
    CLEARED: 'cleared'        // 클리어됨
};

// 방 타입별 아이콘
const ROOM_ICONS = {
    [ROOM_TYPE.EMPTY]: '⬜',
    [ROOM_TYPE.MONSTER]: '⚔️',
    [ROOM_TYPE.TREASURE]: '📦',
    [ROOM_TYPE.WELL]: '💧',
    [ROOM_TYPE.START]: '🏠'
};

/**
 * 던전 맵 생성 (아이작 스타일)
 * @param {number} floor - 현재 층수
 * @returns {object} 맵 데이터
 */
function generateFloorMap(floor) {
    const size = 5; // 5x5 그리드
    const map = [];

    // 빈 그리드 생성
    for (let y = 0; y < size; y++) {
        const row = [];
        for (let x = 0; x < size; x++) {
            row.push({
                x: x,
                y: y,
                type: ROOM_TYPE.EMPTY,
                state: ROOM_STATE.UNEXPLORED,
                enemy: null,
                cleared: false,
                accessible: false, // 접근 가능 여부
                visited: false // 방문 여부 (안개 제거용)
            });
        }
        map.push(row);
    }

    // 시작 위치 (중앙)
    const startX = 2;
    const startY = 2;
    map[startY][startX].type = ROOM_TYPE.START;
    map[startY][startX].state = ROOM_STATE.CURRENT;
    map[startY][startX].accessible = true;
    map[startY][startX].cleared = true;
    map[startY][startX].visited = true;

    // 랜덤 경로 생성 (아이작 스타일)
    const roomsToGenerate = 8 + Math.floor(Math.random() * 5); // 8-12개 방
    const generatedRooms = [[startX, startY]];

    for (let i = 0; i < roomsToGenerate; i++) {
        // 기존 방 중 하나를 선택
        const baseRoom = generatedRooms[Math.floor(Math.random() * generatedRooms.length)];
        const [bx, by] = baseRoom;

        // 인접한 방향 중 하나 선택
        const directions = [
            [0, -1], [0, 1], [-1, 0], [1, 0] // 상, 하, 좌, 우
        ];
        shuffleArray(directions);

        for (const [dx, dy] of directions) {
            const nx = bx + dx;
            const ny = by + dy;

            // 범위 체크
            if (nx >= 0 && nx < size && ny >= 0 && ny < size) {
                const room = map[ny][nx];
                // 아직 생성되지 않은 방이면
                if (!room.accessible) {
                    room.accessible = true;
                    generatedRooms.push([nx, ny]);
                    break;
                }
            }
        }
    }

    // 접근 가능한 방 목록 (시작점 제외)
    const accessibleRooms = [];
    for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
            if (map[y][x].accessible && (x !== startX || y !== startY)) {
                accessibleRooms.push({ x, y });
            }
        }
    }

    shuffleArray(accessibleRooms);

    // 5층 단위는 우물만 배치
    if (floor % 5 === 0) {
        // 우물 배치
        if (accessibleRooms.length > 0) {
            const wellPos = accessibleRooms.pop();
            map[wellPos.y][wellPos.x].type = ROOM_TYPE.WELL;
        }

        // 보스 배치
        if (accessibleRooms.length > 0) {
            const bossPos = accessibleRooms.pop();
            map[bossPos.y][bossPos.x].type = ROOM_TYPE.MONSTER;
            map[bossPos.y][bossPos.x].enemy = generateBoss(floor);
        }

        // 나머지는 몬스터 방 또는 빈 방 (50% 확률)
        for (const pos of accessibleRooms) {
            if (Math.random() < 0.5) {
                map[pos.y][pos.x].type = ROOM_TYPE.MONSTER;
                map[pos.y][pos.x].enemy = generateEnemy(floor);
            }
            // else: 빈 방으로 유지
        }
    } else {
        // 일반 층: 보물 방만 배치 (우물 없음)
        if (accessibleRooms.length > 0) {
            const treasurePos = accessibleRooms.pop();
            map[treasurePos.y][treasurePos.x].type = ROOM_TYPE.TREASURE;
        }

        // 보스 방 1개
        if (accessibleRooms.length > 0) {
            const bossPos = accessibleRooms.pop();
            map[bossPos.y][bossPos.x].type = ROOM_TYPE.MONSTER;
            map[bossPos.y][bossPos.x].enemy = generateBoss(floor);
        }

        // 나머지는 몬스터 방 또는 빈 방 (50% 확률)
        for (const pos of accessibleRooms) {
            if (Math.random() < 0.5) {
                map[pos.y][pos.x].type = ROOM_TYPE.MONSTER;
                map[pos.y][pos.x].enemy = generateEnemy(floor);
            }
            // else: 빈 방으로 유지
        }
    }

    return {
        floor: floor,
        size: size,
        grid: map,
        currentX: startX,
        currentY: startY,
        roomsCleared: 0,
        totalRooms: countRoomsByType(map, ROOM_TYPE.MONSTER),
        bossCleared: false // 보스 클리어 여부
    };
}

/**
 * 배열 셔플
 */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

/**
 * 특정 타입의 방 개수 세기
 */
function countRoomsByType(map, type) {
    let count = 0;
    for (let y = 0; y < map.length; y++) {
        for (let x = 0; x < map[y].length; x++) {
            if (map[y][x].type === type) {
                count++;
            }
        }
    }
    return count;
}

/**
 * 보스 생성
 */
function generateBoss(floor) {
    const baseHp = 100 + (floor * 20);
    const baseAttack = 10 + (floor * 3);
    const baseDefense = 5 + Math.floor(floor / 2);

    return {
        name: `${floor}층 보스`,
        hp: baseHp,
        maxHp: baseHp,
        attack: baseAttack,
        defense: baseDefense,
        isBoss: true,
        floor: floor
    };
}

/**
 * 방으로 이동
 * @param {number} x - X 좌표
 * @param {number} y - Y 좌표
 * @returns {object|null} 방 데이터 또는 null
 */
function moveToRoom(x, y) {
    const map = gameState.dungeon.currentMap;

    // 범위 체크
    if (x < 0 || x >= map.size || y < 0 || y >= map.size) {
        return null;
    }

    // 접근 가능한 방인지 체크
    if (!map.grid[y][x].accessible) {
        showError('접근할 수 없는 방입니다.');
        return null;
    }

    // 인접한 방인지 체크
    const currentX = map.currentX;
    const currentY = map.currentY;
    const distance = Math.abs(x - currentX) + Math.abs(y - currentY);

    if (distance !== 1) {
        showError('인접한 방으로만 이동할 수 있습니다.');
        return null;
    }

    // 이전 방 상태 업데이트
    map.grid[currentY][currentX].state = ROOM_STATE.CLEARED;

    // 현재 위치 업데이트
    map.currentX = x;
    map.currentY = y;

    const room = map.grid[y][x];
    room.state = ROOM_STATE.CURRENT;

    return room;
}

/**
 * 방 입장 처리
 * @param {number} x - X 좌표
 * @param {number} y - Y 좌표
 */
function enterRoom(x, y) {
    const room = moveToRoom(x, y);

    if (!room) {
        return;
    }

    // 방문 표시
    room.visited = true;

    // 이미 클리어한 방
    if (room.cleared) {
        showInfo('이미 클리어한 방입니다.');
        updateUI();
        return;
    }

    // 방 타입에 따른 이벤트
    switch (room.type) {
        case ROOM_TYPE.MONSTER:
            // 몬스터 전투 시작
            gameState.dungeon.currentEnemy = room.enemy;
            gameState.dungeon.inBattle = true;
            clearBattleLog();
            addBattleLog(`⚔️ 몬스터와 조우했습니다!`);
            updateUI();
            autoBattle();
            break;

        case ROOM_TYPE.TREASURE:
            // 보물 상자 획득
            const boxGrade = getRewardBoxGrade(gameState.dungeon.currentFloor, false);
            gameState.boxes.push({ grade: boxGrade, floor: gameState.dungeon.currentFloor });
            showSuccess(`${BOX_NAMES[boxGrade]}을(를) 획득했습니다!`);
            room.cleared = true;
            updateUI();
            break;

        case ROOM_TYPE.WELL:
            // 우물 사용
            showWellModal();
            break;

        case ROOM_TYPE.EMPTY:
        case ROOM_TYPE.START:
            // 빈 방
            showInfo('아무것도 없는 방입니다.');
            room.cleared = true;
            updateUI();
            break;
    }
}

/**
 * 우물 사용
 */
function useWell() {
    const map = gameState.dungeon.currentMap;
    const room = map.grid[map.currentY][map.currentX];

    if (room.type !== ROOM_TYPE.WELL) {
        return;
    }

    if (room.cleared) {
        showError('이미 사용한 우물입니다.');
        return;
    }

    // 50% 체력 회복
    const stats = calculatePlayerStats();
    const healAmount = Math.floor(stats.hp * 0.5);
    gameState.player.currentHp = Math.min(stats.hp, gameState.player.currentHp + healAmount);

    room.cleared = true;
    showSuccess(`💧 우물에서 체력을 ${healAmount} 회복했습니다!`);

    closeWellModal();
    updateUI();
    autoSave(gameState);
}

/**
 * 현재 층의 모든 방 클리어 확인
 */
function isFloorCleared() {
    const map = gameState.dungeon.currentMap;

    for (let y = 0; y < map.size; y++) {
        for (let x = 0; x < map.size; x++) {
            const room = map.grid[y][x];
            if (room.type === ROOM_TYPE.MONSTER && !room.cleared) {
                return false;
            }
        }
    }

    return true;
}
