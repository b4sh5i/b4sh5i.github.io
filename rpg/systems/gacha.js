// 상자 등급
const BOX_GRADE = {
    BASIC: 'basic',           // 하급
    INTERMEDIATE: 'intermediate', // 중급
    ADVANCED: 'advanced',     // 상급
    SUPREME: 'supreme'        // 최상급
};

// 상자별 등급 확률 테이블
const BOX_PROBABILITIES = {
    [BOX_GRADE.BASIC]: {
        [ITEM_RARITY.COMMON]: 70,
        [ITEM_RARITY.RARE]: 25,
        [ITEM_RARITY.HERO]: 5,
        [ITEM_RARITY.LEGENDARY]: 0
    },
    [BOX_GRADE.INTERMEDIATE]: {
        [ITEM_RARITY.COMMON]: 50,
        [ITEM_RARITY.RARE]: 35,
        [ITEM_RARITY.HERO]: 13,
        [ITEM_RARITY.LEGENDARY]: 2
    },
    [BOX_GRADE.ADVANCED]: {
        [ITEM_RARITY.COMMON]: 30,
        [ITEM_RARITY.RARE]: 40,
        [ITEM_RARITY.HERO]: 25,
        [ITEM_RARITY.LEGENDARY]: 5
    },
    [BOX_GRADE.SUPREME]: {
        [ITEM_RARITY.COMMON]: 10,
        [ITEM_RARITY.RARE]: 30,
        [ITEM_RARITY.HERO]: 45,
        [ITEM_RARITY.LEGENDARY]: 15
    }
};

// 상자 등급별 한글 이름
const BOX_NAMES = {
    [BOX_GRADE.BASIC]: '하급 상자',
    [BOX_GRADE.INTERMEDIATE]: '중급 상자',
    [BOX_GRADE.ADVANCED]: '상급 상자',
    [BOX_GRADE.SUPREME]: '최상급 상자'
};

// 상자 등급별 색상
const BOX_COLORS = {
    [BOX_GRADE.BASIC]: '#795548',
    [BOX_GRADE.INTERMEDIATE]: '#607d8b',
    [BOX_GRADE.ADVANCED]: '#673ab7',
    [BOX_GRADE.SUPREME]: '#f44336'
};

/**
 * 확률에 따라 아이템 등급 결정
 * @param {string} boxGrade - 상자 등급
 * @returns {string} 아이템 등급
 */
function determineItemRarity(boxGrade) {
    const probabilities = BOX_PROBABILITIES[boxGrade];
    const random = Math.random() * 100;

    let cumulative = 0;
    for (const [rarity, probability] of Object.entries(probabilities)) {
        cumulative += probability;
        if (random < cumulative) {
            return rarity;
        }
    }

    return ITEM_RARITY.COMMON;
}

/**
 * 특정 등급의 랜덤 아이템 가져오기
 * @param {string} rarity - 아이템 등급
 * @returns {object} 아이템 객체
 */
function getRandomItemByRarity(rarity) {
    const itemsOfRarity = ITEMS_DATABASE.filter(item => item.rarity === rarity);
    const randomIndex = Math.floor(Math.random() * itemsOfRarity.length);
    return { ...itemsOfRarity[randomIndex] }; // 복사본 반환
}

/**
 * 가챠 상자 열기
 * @param {string} boxGrade - 상자 등급
 * @returns {object} 획득한 아이템
 */
function openGachaBox(boxGrade) {
    const rarity = determineItemRarity(boxGrade);
    const item = getRandomItemByRarity(rarity);

    return {
        item: item,
        boxGrade: boxGrade,
        timestamp: Date.now()
    };
}

/**
 * 여러 개의 가챠 상자 열기
 * @param {string} boxGrade - 상자 등급
 * @param {number} count - 열 상자 개수
 * @returns {array} 획득한 아이템 배열
 */
function openMultipleBoxes(boxGrade, count) {
    const results = [];
    for (let i = 0; i < count; i++) {
        results.push(openGachaBox(boxGrade));
    }
    return results;
}

/**
 * 던전 클리어 보상 상자 결정
 * @param {number} floor - 클리어한 층수
 * @param {boolean} isRetry - 재도전 여부
 * @returns {string} 상자 등급
 */
function getRewardBoxGrade(floor, isRetry = false) {
    if (isRetry) {
        // 재도전: 중급 또는 하급 랜덤
        return Math.random() < 0.5 ? BOX_GRADE.INTERMEDIATE : BOX_GRADE.BASIC;
    }

    // 5층 단위: 최상급
    if (floor % 5 === 0) {
        return BOX_GRADE.SUPREME;
    }

    // 일반 층: 상급
    return BOX_GRADE.ADVANCED;
}
