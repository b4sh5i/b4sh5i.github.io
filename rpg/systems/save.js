/**
 * 세이브/로드 시스템 (스타크래프트 유즈맵 스타일)
 * 게임 상태를 JSON으로 직렬화 후 Base64로 인코딩하여 코드 생성
 */

const SAVE_VERSION = 1; // 세이브 데이터 버전

/**
 * 게임 상태를 세이브 코드로 변환
 * @param {object} gameState - 게임 상태 객체
 * @returns {string} 세이브 코드
 */
function generateSaveCode(gameState) {
    try {
        const saveData = {
            version: SAVE_VERSION,
            timestamp: Date.now(),
            data: gameState
        };

        const jsonString = JSON.stringify(saveData);
        // Base64 인코딩으로 완전한 세이브 코드 생성
        const saveCode = btoa(encodeURIComponent(jsonString));

        // localStorage에도 백업 저장
        localStorage.setItem('rpg_save_full', saveCode);
        localStorage.setItem('rpg_save_time', Date.now().toString());

        return saveCode;
    } catch (error) {
        console.error('세이브 코드 생성 실패:', error);
        return null;
    }
}

/**
 * 세이브 코드에서 게임 상태 복원
 * @param {string} saveCode - 세이브 코드
 * @returns {object|null} 게임 상태 또는 null
 */
function loadFromSaveCode(saveCode) {
    try {
        if (!saveCode || saveCode.trim() === '') {
            return null;
        }

        // Base64 디코딩하여 게임 상태 복원
        const jsonString = decodeURIComponent(atob(saveCode.trim()));
        const saveData = JSON.parse(jsonString);

        // 버전 체크
        if (saveData.version !== SAVE_VERSION) {
            console.error('세이브 데이터 버전이 맞지 않습니다.');
            return null;
        }

        // localStorage에도 저장 (다음에 빠른 로드를 위해)
        localStorage.setItem('rpg_save_full', saveCode);
        localStorage.setItem('rpg_save_time', Date.now().toString());

        return saveData.data;
    } catch (error) {
        console.error('세이브 코드 로드 실패:', error);
        return null;
    }
}

/**
 * 자동 저장
 * @param {object} gameState - 게임 상태
 */
function autoSave(gameState) {
    try {
        const saveData = {
            version: SAVE_VERSION,
            timestamp: Date.now(),
            data: gameState
        };

        const jsonString = JSON.stringify(saveData);
        const base64 = btoa(encodeURIComponent(jsonString));

        localStorage.setItem('rpg_autosave', base64);
        localStorage.setItem('rpg_autosave_time', Date.now().toString());
    } catch (error) {
        console.error('자동 저장 실패:', error);
    }
}

/**
 * 자동 저장 데이터 로드
 * @returns {object|null} 게임 상태 또는 null
 */
function loadAutoSave() {
    try {
        const base64 = localStorage.getItem('rpg_autosave');
        if (!base64) return null;

        const jsonString = decodeURIComponent(atob(base64));
        const saveData = JSON.parse(jsonString);

        if (saveData.version === SAVE_VERSION) {
            return saveData.data;
        }

        return null;
    } catch (error) {
        console.error('자동 저장 로드 실패:', error);
        return null;
    }
}

/**
 * 세이브 데이터 삭제
 */
function deleteSaveData() {
    localStorage.removeItem('rpg_save_full');
    localStorage.removeItem('rpg_save_time');
    localStorage.removeItem('rpg_autosave');
    localStorage.removeItem('rpg_autosave_time');
}



/**
 * 마지막 자동 저장 시간 가져오기
 * @returns {number|null} 타임스탬프 또는 null
 */
function getLastAutoSaveTime() {
    const time = localStorage.getItem('rpg_autosave_time');
    return time ? parseInt(time) : null;
}
