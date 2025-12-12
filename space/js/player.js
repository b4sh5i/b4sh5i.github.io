// ===== Player Class =====

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.radius = 20;
        this.baseRadius = 20;

        // Stats
        this.maxHealth = 100;
        this.health = this.maxHealth;
        this.speed = 200;
        this.baseSpeed = 200;
        this.defense = 0;

        // Level and experience
        this.level = 1;
        this.exp = 0;
        this.expToLevel = 10;

        // Weapons (max 3)
        this.weapons = [];
        this.weaponCooldowns = {};

        // Drones
        this.drones = [];

        // Accessories (max 4)
        this.accessories = [];

        // Stats
        this.kills = 0;
        this.pickupRange = 150;

        // Animation
        this.rotation = 0;
        this.engineFrame = 0;
    }

    update(dt, inputX, inputY) {
        // Movement
        if (inputX !== 0 || inputY !== 0) {
            const norm = normalize(inputX, inputY);
            this.vx = norm.x * this.speed;
            this.vy = norm.y * this.speed;

            // Tilt effect based on movement
            this.rotation += dt * 2;
        } else {
            this.vx = 0;
            this.vy = 0;
            this.rotation += dt;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        this.engineFrame += dt * 10;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Animation: "Bouncing/Breathing" effect
        const bounce = 1 + Math.sin(this.engineFrame * 0.5) * 0.05;
        ctx.scale(bounce, 1 / bounce);

        // 1. Engine (Cute puff)
        if (this.vx !== 0 || this.vy !== 0) {
            const angle = Math.atan2(this.vy, this.vx);
            ctx.save();
            ctx.rotate(angle + Math.PI);
            ctx.translate(12, 0);

            // Pop effect trails
            ctx.fillStyle = '#fff';
            ctx.globalAlpha = 0.6;
            const puffSize = 6 + Math.sin(this.engineFrame * 2) * 3;
            ctx.beginPath();
            ctx.arc(0, 0, puffSize, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = '#00e5ff'; // Cyan glow
            ctx.beginPath();
            ctx.arc(5, 0, 4, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }

        // 2. Body (Cute Round Bot)
        ctx.save();
        // Slight tilt
        ctx.rotate(this.vx * 0.001);

        // Main Shell (Bright Yellow)
        const grad = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
        grad.addColorStop(0, '#fff59d'); // Light Yellow
        grad.addColorStop(1, '#ffea00'); // Pop Yellow

        ctx.fillStyle = grad;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;

        ctx.beginPath();
        // Egg shape
        ctx.ellipse(0, 0, this.radius, this.radius * 0.9, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Face/Visor (Cyan Glass)
        ctx.fillStyle = '#00e5ff';
        ctx.beginPath();
        // Wide cute visor
        ctx.ellipse(0, -2, this.radius * 0.7, this.radius * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Eyes (Digital)
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = 0.9;
        // Left Eye
        ctx.beginPath();
        ctx.ellipse(-8, -4, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        // Right Eye
        ctx.beginPath();
        ctx.ellipse(8, -4, 4, 6, 0, 0, Math.PI * 2);
        ctx.fill();

        // Antenna
        ctx.beginPath();
        ctx.moveTo(0, -this.radius * 0.8);
        ctx.lineTo(0, -this.radius * 1.5);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Antenna Ball
        ctx.fillStyle = '#ff1744'; // Red tip
        ctx.beginPath();
        ctx.arc(0, -this.radius * 1.5, 3, 0, Math.PI * 2);
        ctx.fill();

        // Drones
        this.drones.forEach(drone => drone.draw(ctx));

        ctx.restore();
        ctx.restore();
    }

    takeDamage(damage) {
        const actualDamage = Math.max(1, damage - this.defense);
        this.health -= actualDamage;
        return this.health <= 0;
    }

    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    gainExp(amount) {
        this.exp += amount;
        if (this.exp >= this.expToLevel) {
            this.levelUp();
            return true;
        }
        return false;
    }

    levelUp() {
        this.level++;
        this.exp -= this.expToLevel;
        this.expToLevel = Math.floor(this.expToLevel * 1.5);
    }

    addWeapon(weaponType) {
        if (this.weapons.length >= 3) return false;

        const weapon = WEAPONS[weaponType];
        if (weapon.isDrone) {
            this.drones.push(new Drone(this, 100 + this.drones.length * 30, 2, 15));
        } else {
            this.weapons.push({
                type: weaponType,
                level: 1,
                ...weapon
            });
            this.weaponCooldowns[weaponType] = 0;
        }

        return true;
    }

    upgradeWeapon(index) {
        if (index >= this.weapons.length) return;

        const weapon = this.weapons[index];
        weapon.level++;
        weapon.damage *= 1.3;
        weapon.cooldown *= 0.9;
    }

    addAccessory(accessory) {
        if (this.accessories.length >= 4) return false;

        this.accessories.push(accessory);
        this.applyAccessory(accessory);
        return true;
    }

    applyAccessory(accessory) {
        // Apply accessory effects
        if (accessory.speedMult) this.speed = this.baseSpeed * accessory.speedMult;
        if (accessory.sizeMult) this.radius = this.baseRadius * accessory.sizeMult;
        if (accessory.maxHealthBonus) {
            this.maxHealth += accessory.maxHealthBonus;
            this.health += accessory.maxHealthBonus;
        }
        if (accessory.defenseBonus) this.defense += accessory.defenseBonus;
        if (accessory.pickupRangeBonus) this.pickupRange += accessory.pickupRangeBonus;
    }

    shoot(projectiles, enemies) {
        // Auto-fire all weapons
        for (const weapon of this.weapons) {
            if (this.weaponCooldowns[weapon.type] <= 0) {
                this.fireWeapon(weapon, projectiles, enemies);
                this.weaponCooldowns[weapon.type] = weapon.cooldown;
            }
        }
        // Update drones
        this.drones.forEach(drone => drone.update(0.016, enemies, projectiles));
    }

    fireWeapon(weapon, projectiles, enemies) {
        let targetAngle = 0;
        let hasTarget = false;

        if (enemies.length > 0) {
            const nearest = enemies.reduce((closest, enemy) => {
                const dist = distance(this.x, this.y, enemy.x, enemy.y);
                const closestDist = distance(this.x, this.y, closest.x, closest.y);
                return dist < closestDist ? enemy : closest;
            });
            targetAngle = angle(this.x, this.y, nearest.x, nearest.y);
            hasTarget = true;
        }

        // Only fire if we have a target or if it's not a directional weapon
        // Actually, let's fire mostly forward if no target
        if (!hasTarget && (weapon.type === 'MISSILE' || weapon.type === 'LASER')) {
            if (this.vx !== 0 || this.vy !== 0) {
                targetAngle = Math.atan2(this.vy, this.vx);
            } else {
                targetAngle = Math.random() * Math.PI * 2;
            }
        } else if (!hasTarget && weapon.type === 'HOMING') {
            // Random direction for homing without target
            targetAngle = Math.random() * Math.PI * 2;
        }

        const angleSpread = weapon.spread || 0;
        const count = weapon.count || 1;

        // Calculate start angle for spread (centered around targetAngle)
        const startAngle = targetAngle - ((count - 1) * angleSpread) / 2;

        for (let i = 0; i < count; i++) {
            const currentAngle = startAngle + (i * angleSpread);

            const ProjectileClass = weapon.projectileClass;
            projectiles.push(new ProjectileClass(
                this.x,
                this.y,
                currentAngle,
                weapon.speed,
                weapon.damage,
                'player'
            ));
        }
    }

    updateCooldowns(dt) {
        for (const key in this.weaponCooldowns) {
            this.weaponCooldowns[key] = Math.max(0, this.weaponCooldowns[key] - dt);
        }
    }

    isDead() {
        return this.health <= 0;
    }
}
