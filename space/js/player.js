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

        // 1. Engine Trails (High-Tech Plasma)
        if (this.vx !== 0 || this.vy !== 0) {
            const angle = Math.atan2(this.vy, this.vx);

            ctx.save();
            ctx.rotate(angle + Math.PI); // Point backwards

            // Dual Engine Trails
            const trailLen = 25 + Math.sin(this.engineFrame * 2) * 5;
            const yOffsets = [-8, 8];

            yOffsets.forEach(yOff => {
                ctx.beginPath();
                ctx.translate(15, yOff);
                const grad = ctx.createLinearGradient(0, 0, trailLen, 0);
                grad.addColorStop(0, 'rgba(255, 150, 0, 0.8)'); // Orange Core
                grad.addColorStop(1, 'rgba(255, 50, 0, 0)');   // Fade out

                ctx.fillStyle = grad;
                ctx.moveTo(0, -3);
                ctx.lineTo(trailLen, 0);
                ctx.lineTo(0, 3);
                ctx.fill();
                ctx.translate(-15, -yOff);
            });

            ctx.restore();
        }

        // 2. Ship Body (Sleek Sci-Fi)
        ctx.save();
        // Calculate detailed rotation (banking effect visible in structure)
        let dirAngle = this.rotation;
        if (this.vx !== 0 || this.vy !== 0) {
            dirAngle = Math.atan2(this.vy, this.vx);
        }
        ctx.rotate(dirAngle);

        // Main Hull (Arrowhead shape)
        ctx.beginPath();
        ctx.moveTo(25, 0);   // Nose
        ctx.lineTo(-15, 15); // Rear Left
        ctx.lineTo(-10, 0);  // Rear Center indent
        ctx.lineTo(-15, -15);// Rear Right
        ctx.closePath();

        // Hull Gradient (Silver/White)
        const hullGrad = ctx.createLinearGradient(10, -10, -10, 10);
        hullGrad.addColorStop(0, '#ffffff');
        hullGrad.addColorStop(0.5, '#d0d0e0');
        hullGrad.addColorStop(1, '#a0a0b0');

        ctx.fillStyle = hullGrad;
        ctx.fill();

        // Panel Lines / Details
        ctx.strokeStyle = '#505060';
        ctx.lineWidth = 1;
        ctx.stroke(); // Outline

        // Inner detailed lines
        ctx.beginPath();
        ctx.moveTo(5, 0);
        ctx.lineTo(-10, 8);
        ctx.moveTo(5, 0);
        ctx.lineTo(-10, -8);
        ctx.stroke();

        // Cockpit (Dark Glass)
        ctx.fillStyle = '#111122';
        ctx.beginPath();
        ctx.ellipse(0, 0, 8, 4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Cockpit Glare
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.beginPath();
        ctx.ellipse(2, -1, 3, 1.5, -0.2, 0, Math.PI * 2);
        ctx.fill();

        // Engine Glows (Rear)
        ctx.fillStyle = '#ffaa00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffaa00';
        ctx.beginPath();
        ctx.arc(-12, 8, 3, 0, Math.PI * 2);
        ctx.arc(-12, -8, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; // Reset

        // 3. Direction/Targeting Laser (Subtle forward line)
        // Helps aiming
        /*
        ctx.strokeStyle = 'rgba(255, 0, 0, 0.2)';
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(100, 0);
        ctx.stroke();
        ctx.setLineDash([]);
        */

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

        const ProjectileClass = weapon.projectileClass;
        projectiles.push(new ProjectileClass(
            this.x,
            this.y,
            targetAngle,
            weapon.speed,
            weapon.damage,
            'player'
        ));
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
