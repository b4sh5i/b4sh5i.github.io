// ===== UI System =====

// Accessory definitions (Using CSS classes for icons)
const ACCESSORIES = {
    SPEED_BOOST: {
        name: '속도 증폭기',
        icon: '<div class="icon-graphic icon-speed"></div>',
        description: '이동 속도 +30%',
        speedMult: 1.3
    },
    PICKUP_RANGE: {
        name: '자석 필드',
        icon: '<div class="icon-graphic icon-homing" style="border-color:#00f; color:#00f;"></div>',
        description: '획득 범위 +100',
        pickupRangeBonus: 100
    },
    MAX_HEALTH: {
        name: '실드 생성기',
        icon: '<div class="icon-graphic icon-health"></div>',
        description: '최대 체력 +50',
        maxHealthBonus: 50
    },
    ATTACK_SPEED: {
        name: '오버클럭',
        icon: '<div class="icon-graphic icon-drone" style="background:#ff0;"></div>',
        description: '공격 속도 +20%',
        cooldownMult: 0.8
    },
    // Debuff accessories
    BIG_SLOW: {
        name: '중장갑',
        icon: '<div class="icon-graphic icon-health" style="background:#555;"></div>',
        description: '공격력 +50%, 이동 속도 -30%',
        debuff: true,
        damageMult: 1.5,
        speedMult: 0.7
    },
    SMALL_FRAGILE: {
        name: '나노 코어',
        icon: '<div class="icon-graphic icon-plasma" style="width:20px; height:20px;"></div>',
        description: '크기 -40%, 최대 체력 -30',
        debuff: true,
        sizeMult: 0.6,
        maxHealthBonus: -30
    },
    TANK_MODE: {
        name: '요새 모드',
        icon: '<div class="icon-graphic icon-drone" style="background:#888;"></div>',
        description: '방어력 +20, 이동 속도 -40%',
        debuff: true,
        defenseBonus: 20,
        speedMult: 0.6
    },
    GLASS_CANNON: {
        name: '광전사',
        icon: '<div class="icon-graphic icon-missile" style="background:#f0f;"></div>',
        description: '이동 속도 +50%, 최대 체력 -40',
        debuff: true,
        speedMult: 1.5,
        maxHealthBonus: -40
    }
};

// Update UI elements
function updateUI(player, gameTime) {
    // Health
    const healthPercent = (player.health / player.maxHealth) * 100;
    document.getElementById('healthBar').style.width = healthPercent + '%';
    document.getElementById('healthText').textContent =
        `${Math.ceil(player.health)}/${player.maxHealth}`;

    // Experience
    const expPercent = (player.exp / player.expToLevel) * 100;
    document.getElementById('expBar').style.width = expPercent + '%';
    document.getElementById('levelText').textContent = player.level;

    // Time
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);
    document.getElementById('timeText').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Kills
    document.getElementById('killText').textContent = player.kills;

    // Weapon slots
    for (let i = 0; i < 3; i++) {
        const slot = document.getElementById(`weapon${i + 1}`);
        if (i < player.weapons.length) {
            slot.innerHTML = player.weapons[i].icon;
            slot.classList.remove('empty');
        } else {
            slot.innerHTML = '';
            slot.classList.add('empty');
        }
    }

    // Accessory slots
    for (let i = 0; i < 4; i++) {
        const slot = document.getElementById(`accessory${i + 1}`);
        if (i < player.accessories.length) {
            slot.innerHTML = player.accessories[i].icon;
            slot.classList.remove('empty');
        } else {
            slot.innerHTML = '';
            slot.classList.add('empty');
        }
    }
}

// Show level up screen
function showLevelUpScreen(player, onResume) {
    const upgradeOptions = document.getElementById('upgradeOptions');
    upgradeOptions.innerHTML = '';

    const options = generateUpgradeOptions(player);

    options.forEach(option => {
        const card = document.createElement('div');
        card.className = `upgrade-card ${option.category}`;

        // Create structure: Icon Container + Info Container + Badge
        card.innerHTML = `
            <div class="upgrade-icon-container">
                ${option.icon}
            </div>
            <div class="upgrade-info">
                <div class="upgrade-name">${option.name}</div>
                <div class="upgrade-description">${option.description}</div>
                ${option.debuff ? `<div class="upgrade-debuff">⚠️ ${option.debuff}</div>` : ''}
            </div>
            <div class="upgrade-new-badge">NEW!</div>
        `;

        card.addEventListener('click', () => {
            option.apply(player);
            hideLevelUpScreen();
            if (onResume) onResume();
        });

        upgradeOptions.appendChild(card);
    });

    document.getElementById('levelUpScreen').classList.remove('hidden');
}

function hideLevelUpScreen() {
    document.getElementById('levelUpScreen').classList.add('hidden');
}

// Generate upgrade options
function generateUpgradeOptions(player) {
    const options = [];

    // Weapon options (only if less than 3 weapons)
    if (player.weapons.length < 3) {
        const availableWeapons = Object.keys(WEAPONS).filter(key =>
            !player.weapons.some(w => w.type === key)
        );

        if (availableWeapons.length > 0) {
            // Weighted Random Selection
            const weights = {
                'PULSE': 0.3, // Lower chance for Pulse
                'default': 1.0
            };

            let totalWeight = 0;
            const weightedList = availableWeapons.map(key => {
                const weight = weights[key] || weights['default'];
                totalWeight += weight;
                return { key, weight };
            });

            let randomValue = Math.random() * totalWeight;
            let weaponKey = availableWeapons[0];

            for (const item of weightedList) {
                randomValue -= item.weight;
                if (randomValue <= 0) {
                    weaponKey = item.key;
                    break;
                }
            }

            const weapon = WEAPONS[weaponKey];
            options.push({
                category: 'weapon',
                icon: weapon.icon,
                name: weapon.name,
                description: weapon.description,
                apply: (p) => p.addWeapon(weaponKey)
            });
        }
    }

    // Weapon upgrade options
    if (player.weapons.length > 0) {
        const weaponIndex = randomInt(0, player.weapons.length - 1);
        const weapon = player.weapons[weaponIndex];
        options.push({
            category: 'weapon',
            icon: weapon.icon, // Keep same icon
            name: `${weapon.name} 강화`,
            description: `레벨 ${weapon.level} → ${weapon.level + 1}\n공격력 +30%, 쿨다운 -10%`,
            apply: (p) => p.upgradeWeapon(weaponIndex)
        });
    }

    // Accessory options (only if less than 4)
    if (player.accessories.length < 4) {
        const accessoryKey = randomChoice(Object.keys(ACCESSORIES));
        const accessory = ACCESSORIES[accessoryKey];
        options.push({
            category: 'accessory',
            icon: accessory.icon,
            name: accessory.name,
            description: accessory.description,
            debuff: accessory.debuff ? '부정적 효과 포함' : null,
            apply: (p) => p.addAccessory(accessory)
        });
    }

    // Stat boost options
    const statBoosts = [
        {
            category: 'stat',
            icon: '<div class="icon-graphic icon-health" style="background:#0f0;"></div>',
            name: '체력 회복',
            description: '체력 50 회복',
            apply: (p) => p.heal(50)
        },
        {
            category: 'stat',
            icon: '<div class="icon-graphic icon-health"></div>',
            name: '최대 체력 증가',
            description: '최대 체력 +20',
            apply: (p) => {
                p.maxHealth += 20;
                p.health += 20;
            }
        },
        {
            category: 'stat',
            icon: '<div class="icon-graphic icon-speed"></div>',
            name: '이동 속도 증가',
            description: '이동 속도 +10%',
            apply: (p) => {
                p.baseSpeed *= 1.1;
                p.speed = p.baseSpeed;
            }
        }
    ];

    options.push(randomChoice(statBoosts));

    // Return 3 random options
    while (options.length > 3) {
        options.splice(randomInt(0, options.length - 1), 1);
    }

    return options;
}

// Show game over screen
function showGameOverScreen(player, gameTime) {
    const minutes = Math.floor(gameTime / 60);
    const seconds = Math.floor(gameTime % 60);

    document.getElementById('finalTime').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('finalKills').textContent = player.kills;
    document.getElementById('finalLevel').textContent = player.level;

    document.getElementById('gameOverScreen').classList.remove('hidden');
}

function hideGameOverScreen() {
    document.getElementById('gameOverScreen').classList.add('hidden');
}

