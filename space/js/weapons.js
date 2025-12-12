// ===== Weapon System =====

// Projectile base class
class Projectile {
    constructor(x, y, angle, speed, damage, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.speed = speed;
        this.damage = damage;
        this.owner = owner;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.radius = 5;
        this.life = 3; // seconds
        this.pierce = 0;
        this.hitCount = 0;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
    }

    draw(ctx) {
        ctx.save();
        ctx.fillStyle = '#4af';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0 || this.hitCount > this.pierce;
    }

    hit() {
        this.hitCount++;
    }
}

// Missile projectile
class Missile extends Projectile {
    constructor(x, y, angle, speed, damage, owner) {
        super(x, y, angle, speed, damage, owner);
        this.radius = 6;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Missile body
        ctx.fillStyle = '#ff6b6b';
        ctx.fillRect(-8, -3, 16, 6);

        // Missile tip
        ctx.fillStyle = '#ffaa00';
        ctx.beginPath();
        ctx.moveTo(8, 0);
        ctx.lineTo(12, -4);
        ctx.lineTo(12, 4);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Laser projectile
class Laser extends Projectile {
    constructor(x, y, angle, speed, damage, owner) {
        super(x, y, angle, speed, damage, owner);
        this.radius = 4;
        this.pierce = 3; // Can hit 3 enemies
        this.length = 30;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Laser beam
        ctx.strokeStyle = '#00ffff';
        ctx.lineWidth = 10; // Wider beam
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00ffff';
        ctx.beginPath();
        ctx.moveTo(-this.length / 2, 0);
        ctx.lineTo(this.length / 2, 0);
        ctx.stroke();

        ctx.restore();
    }
}

// Homing missile
class HomingMissile extends Projectile {
    constructor(x, y, angle, speed, damage, owner) {
        super(x, y, angle, speed, damage, owner);
        this.radius = 7;
        this.target = null;
        this.turnSpeed = 3; // radians per second
    }

    update(dt, enemies) {
        // Find closest enemy if no target
        if (!this.target || this.target.isDead()) {
            this.target = this.findClosestEnemy(enemies);
        }

        // Home towards target
        if (this.target) {
            const targetAngle = angle(this.x, this.y, this.target.x, this.target.y);
            let angleDiff = targetAngle - this.angle;

            // Normalize angle difference
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

            // Turn towards target
            const turnAmount = Math.sign(angleDiff) * Math.min(Math.abs(angleDiff), this.turnSpeed * dt);
            this.angle += turnAmount;
        }

        // Update velocity based on angle
        this.vx = Math.cos(this.angle) * this.speed;
        this.vy = Math.sin(this.angle) * this.speed;

        super.update(dt);
    }

    findClosestEnemy(enemies) {
        let closest = null;
        let closestDist = Infinity;

        for (const enemy of enemies) {
            const dist = distance(this.x, this.y, enemy.x, enemy.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }

        return closest;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Missile body
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(-10, -4, 20, 8);

        // Glow effect
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ff00ff';
        ctx.fillRect(-10, -4, 20, 8);

        ctx.restore();
    }
}

// Plasma ball
class PlasmaBall extends Projectile {
    constructor(x, y, angle, speed, damage, owner) {
        super(x, y, angle, speed, damage, owner);
        this.radius = 15;
        this.explosionRadius = 120; // Increased from 40 for better visibility
    }

    draw(ctx) {
        ctx.save();

        // Outer glow
        const gradient = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        gradient.addColorStop(0, '#ffff00');
        gradient.addColorStop(0.5, '#ff8800');
        gradient.addColorStop(1, 'rgba(255, 136, 0, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Drone (orbits player)
class Drone {
    constructor(player, orbitRadius, orbitSpeed, damage) {
        this.player = player;
        this.orbitRadius = orbitRadius;
        this.orbitSpeed = orbitSpeed;
        this.damage = damage;
        this.angle = random(0, Math.PI * 2);
        this.radius = 10;
        this.shootCooldown = 0;
        this.shootInterval = 0.5;
    }

    update(dt, enemies, projectiles) {
        // Orbit around player
        this.angle += this.orbitSpeed * dt;

        // Shoot at nearest enemy
        this.shootCooldown -= dt;
        if (this.shootCooldown <= 0 && enemies.length > 0) {
            const closest = this.findClosestEnemy(enemies);
            if (closest) {
                const shootAngle = angle(this.getX(), this.getY(), closest.x, closest.y);
                projectiles.push(new Missile(
                    this.getX(),
                    this.getY(),
                    shootAngle,
                    400,
                    this.damage,
                    'player'
                ));
                this.shootCooldown = this.shootInterval;
            }
        }
    }

    getX() {
        return this.player.x + Math.cos(this.angle) * this.orbitRadius;
    }

    getY() {
        return this.player.y + Math.sin(this.angle) * this.orbitRadius;
    }

    findClosestEnemy(enemies) {
        let closest = null;
        let closestDist = Infinity;

        for (const enemy of enemies) {
            const dist = distance(this.getX(), this.getY(), enemy.x, enemy.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        }

        return closest;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.getX(), this.getY());

        // Drone body
        ctx.fillStyle = '#00ff00';
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ff00';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Drone eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// Weapon definitions
// Weapon definitions
const WEAPONS = {
    MISSILE: {
        name: '미사일 런처',
        icon: '🚀',
        description: '전방으로 미사일을 발사합니다',
        cooldown: 0.5,
        damage: 25,
        projectileClass: Missile,
        speed: 450,
        explosionRadius: 60 // Added AoE
    },
    LASER: {
        name: '레이저 빔',
        icon: '⚡',
        description: '다수의 적을 관통하는 레이저',
        cooldown: 0.3,
        damage: 15,
        projectileClass: Laser,
        speed: 800,
        pierce: 999 // Infinite pierce
    },
    HOMING: {
        name: '유도 미사일',
        icon: '🎯',
        description: '적을 추적하는 미사일 3발을 발사합니다',
        cooldown: 0.9, // Slightly longer cooldown for balance
        damage: 15, // Damage per missile (3x15 = 45 total potential)
        projectileClass: HomingMissile,
        spread: 0.2, // Spread in radians
        speed: 350,
        explosionRadius: 40 // Miniature AoE
    },
    PULSE: {
        name: '펄스 노바',
        icon: '⭕',
        description: '주변의 적들을 밀쳐내고 피해를 줍니다',
        cooldown: 1.0,
        damage: 80,
        projectileClass: PlasmaBall, // Reuse PlasmaBall visual
        speed: 0, // Stationary (Pulse)
        explosionRadius: 200, // Large Melee Area
        life: 0.2 // Instant burst
    },
    DRONE: {
        name: '공격 드론',
        icon: '🛸',
        description: '주변을 돌며 자동으로 적을 공격합니다',
        isDrone: true
    }
};
