// 아이템 등급
const ITEM_RARITY = {
    COMMON: 'common',      // 일반
    RARE: 'rare',          // 희귀
    HERO: 'hero',          // 영웅
    LEGENDARY: 'legendary' // 전설
};

// 아이템 타입
const ITEM_TYPE = {
    WEAPON: 'weapon',      // 무기
    ARMOR: 'armor',        // 방어구
    ACCESSORY: 'accessory', // 악세서리
    CONSUMABLE: 'consumable' // 소모품
};

// 전체 아이템 데이터베이스
const ITEMS_DATABASE = [
    // === 무기 (WEAPON) ===
    // 일반 무기
    { id: 1, name: '낡은 검', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.COMMON, attack: 5, defense: 0, hp: 0 },
    { id: 2, name: '나무 지팡이', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.COMMON, attack: 4, defense: 0, hp: 0 },
    { id: 3, name: '철 단검', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.COMMON, attack: 6, defense: 0, hp: 0 },

    // 희귀 무기
    { id: 4, name: '강철 대검', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.RARE, attack: 15, defense: 0, hp: 0 },
    { id: 5, name: '마법 지팡이', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.RARE, attack: 12, defense: 0, hp: 10 },
    { id: 6, name: '은빛 활', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.RARE, attack: 14, defense: 0, hp: 0 },

    // 영웅 무기
    { id: 7, name: '용의 검', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.HERO, attack: 30, defense: 5, hp: 20 },
    { id: 8, name: '현자의 지팡이', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.HERO, attack: 25, defense: 0, hp: 50 },
    { id: 9, name: '천상의 활', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.HERO, attack: 28, defense: 0, hp: 30 },

    // 전설 무기
    { id: 10, name: '엑스칼리버', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.LEGENDARY, attack: 60, defense: 10, hp: 50 },
    { id: 11, name: '세계수의 지팡이', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.LEGENDARY, attack: 50, defense: 15, hp: 100 },
    { id: 12, name: '심판의 활', type: ITEM_TYPE.WEAPON, rarity: ITEM_RARITY.LEGENDARY, attack: 55, defense: 5, hp: 70 },

    // === 방어구 (ARMOR) ===
    // 일반 방어구
    { id: 13, name: '천 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.COMMON, attack: 0, defense: 5, hp: 10 },
    { id: 14, name: '가죽 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.COMMON, attack: 0, defense: 6, hp: 15 },
    { id: 15, name: '철 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.COMMON, attack: 0, defense: 8, hp: 20 },

    // 희귀 방어구
    { id: 16, name: '강철 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.RARE, attack: 0, defense: 18, hp: 50 },
    { id: 17, name: '마법 로브', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.RARE, attack: 5, defense: 12, hp: 40 },
    { id: 18, name: '은빛 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.RARE, attack: 0, defense: 20, hp: 60 },

    // 영웅 방어구
    { id: 19, name: '용의 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.HERO, attack: 10, defense: 40, hp: 120 },
    { id: 20, name: '현자의 로브', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.HERO, attack: 15, defense: 30, hp: 100 },
    { id: 21, name: '천상의 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.HERO, attack: 5, defense: 45, hp: 150 },

    // 전설 방어구
    { id: 22, name: '불멸의 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.LEGENDARY, attack: 20, defense: 80, hp: 300 },
    { id: 23, name: '세계수의 로브', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.LEGENDARY, attack: 30, defense: 60, hp: 250 },
    { id: 24, name: '신의 갑옷', type: ITEM_TYPE.ARMOR, rarity: ITEM_RARITY.LEGENDARY, attack: 15, defense: 90, hp: 350 },

    // === 악세서리 (ACCESSORY) ===
    // 일반 악세서리
    { id: 25, name: '구리 반지', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.COMMON, attack: 3, defense: 2, hp: 5 },
    { id: 26, name: '나무 목걸이', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.COMMON, attack: 2, defense: 3, hp: 8 },
    { id: 27, name: '가죽 팔찌', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.COMMON, attack: 4, defense: 1, hp: 5 },

    // 희귀 악세서리
    { id: 28, name: '은 반지', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.RARE, attack: 8, defense: 8, hp: 20 },
    { id: 29, name: '마법 목걸이', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.RARE, attack: 10, defense: 6, hp: 25 },
    { id: 30, name: '루비 팔찌', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.RARE, attack: 12, defense: 5, hp: 15 },

    // 영웅 악세서리
    { id: 31, name: '용의 반지', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.HERO, attack: 20, defense: 20, hp: 60 },
    { id: 32, name: '현자의 목걸이', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.HERO, attack: 18, defense: 15, hp: 80 },
    { id: 33, name: '천상의 팔찌', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.HERO, attack: 25, defense: 18, hp: 50 },

    // 전설 악세서리
    { id: 34, name: '영원의 반지', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.LEGENDARY, attack: 40, defense: 40, hp: 150 },
    { id: 35, name: '세계수의 목걸이', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.LEGENDARY, attack: 35, defense: 35, hp: 200 },
    { id: 36, name: '신의 팔찌', type: ITEM_TYPE.ACCESSORY, rarity: ITEM_RARITY.LEGENDARY, attack: 50, defense: 30, hp: 120 },

    // === 소모품 (CONSUMABLE) ===
    // 포션류
    { id: 37, name: '작은 체력 물약', type: ITEM_TYPE.CONSUMABLE, rarity: ITEM_RARITY.COMMON, attack: 0, defense: 0, hp: 0, healPercent: 10, isConsumable: true },
    { id: 38, name: '중간 체력 물약', type: ITEM_TYPE.CONSUMABLE, rarity: ITEM_RARITY.RARE, attack: 0, defense: 0, hp: 0, healPercent: 25, isConsumable: true },
    { id: 39, name: '큰 체력 물약', type: ITEM_TYPE.CONSUMABLE, rarity: ITEM_RARITY.HERO, attack: 0, defense: 0, hp: 0, healPercent: 50, isConsumable: true },
    { id: 40, name: '완전 회복 물약', type: ITEM_TYPE.CONSUMABLE, rarity: ITEM_RARITY.LEGENDARY, attack: 0, defense: 0, hp: 0, healPercent: 100, isConsumable: true }
];

// 등급별 색상 (UI용)
const RARITY_COLORS = {
    [ITEM_RARITY.COMMON]: '#9e9e9e',      // 회색
    [ITEM_RARITY.RARE]: '#2196f3',        // 파란색
    [ITEM_RARITY.HERO]: '#9c27b0',        // 보라색
    [ITEM_RARITY.LEGENDARY]: '#ff9800'    // 주황색
};

// 등급별 한글 이름
const RARITY_NAMES = {
    [ITEM_RARITY.COMMON]: '일반',
    [ITEM_RARITY.RARE]: '희귀',
    [ITEM_RARITY.HERO]: '영웅',
    [ITEM_RARITY.LEGENDARY]: '전설'
};

// 타입별 한글 이름
const TYPE_NAMES = {
    [ITEM_TYPE.WEAPON]: '무기',
    [ITEM_TYPE.ARMOR]: '방어구',
    [ITEM_TYPE.ACCESSORY]: '악세서리',
    [ITEM_TYPE.CONSUMABLE]: '소모품'
};
