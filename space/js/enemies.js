// ===== Enemy System =====

class Enemy {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.vx = 0;
        this.vy = 0;

        // Set stats based on type
        const stats = ENEMY_TYPES[type];
        this.maxHealth = stats.health;
        this.health = this.maxHealth;
        this.speed = stats.speed;
        this.damage = stats.damage;
        this.radius = stats.radius;
        this.color = stats.color;
        this.expValue = stats.expValue;

        // Animation
        this.rotation = 0;
        this.wobble = Math.random() * Math.PI * 2;
    }

    update(dt, player) {
        // Move towards player (except meteor)
        if (this.type !== 'METEOR') {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist > 0) {
                this.vx = (dx / dist) * this.speed;
                this.vy = (dy / dist) * this.speed;
            }
        } else {
            // Meteor just moves straight
            this.x += this.vx * dt;
            this.y += this.vy * dt;
            this.rotation += dt;
            return;
        }

        // Soft collision between enemies to prevent stacking
        // (Simplified flocking)
        // Note: For performance, this is often skipped or simplified in JS canvas games with many entities,
        // but adding a wobble helps it feel organic.

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Rotation towards movement
        if (this.vx !== 0 || this.vy !== 0) {
            const targetAngle = Math.atan2(this.vy, this.vx);
            // Smooth rotation
            this.rotation = targetAngle; // Instant for now
        }

        this.wobble += dt * 5;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        if (this.type === 'METEOR') {
            this.drawMeteor(ctx);
        } else {
            // Outline for visibility
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;

            if (this.type === 'BASIC') this.drawBasic(ctx);
            else if (this.type === 'FAST') this.drawFast(ctx);
            else if (this.type === 'TANK') this.drawTank(ctx);

            // Health bar if damaged
            if (this.health < this.maxHealth) {
                ctx.rotate(-this.rotation); // Keep bar horizontal
                const barWidth = this.radius * 2;
                const barHeight = 3;
                const barY = -this.radius - 10;

                ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
                ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);

                ctx.fillStyle = '#ff0055';
                const healthPercent = this.health / this.maxHealth;
                ctx.fillRect(-barWidth / 2, barY, barWidth * healthPercent, barHeight);
            }
        }

        ctx.restore();
    }

    drawBasic(ctx) {
        // Triangle shape
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(this.radius, 0);
        ctx.lineTo(-this.radius * 0.5, this.radius * 0.8);
        ctx.lineTo(-this.radius * 0.2, 0); // Engine indent
        ctx.lineTo(-this.radius * 0.5, -this.radius * 0.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Glow core
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(0, 0, 3, 0, Math.PI * 2);
        ctx.fill();
    }

    drawFast(ctx) {
        // Needle/Dart shape
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(this.radius * 1.5, 0);
        ctx.lineTo(-this.radius, this.radius * 0.4);
        ctx.lineTo(-this.radius, -this.radius * 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Engine trails
        ctx.strokeStyle = this.color;
        ctx.beginPath();
        ctx.moveTo(-this.radius, 0);
        ctx.lineTo(-this.radius * 2, 0);
        ctx.stroke();
    }

    drawTank(ctx) {
        // Hexagon/Bulky shape
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;

        const sides = 6;
        ctx.beginPath();
        for (let i = 0; i < sides; i++) {
            const angle = (i / sides) * Math.PI * 2;
            const x = Math.cos(angle) * this.radius;
            const y = Math.sin(angle) * this.radius;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Inner detail
        ctx.fillStyle = '#330000';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
    }

    drawMeteor(ctx) {
        // Jagged rock shape
        ctx.fillStyle = '#554466';
        ctx.strokeStyle = '#8877aa';
        ctx.lineWidth = 2;

        ctx.beginPath();
        // Determine shape roughly based on "random" but deterministic for same instance not really possible here without seed
        // We'll just draw a generic rough circle
        const segments = 8;
        for (let i = 0; i < segments; i++) {
            const angle = (i / segments) * Math.PI * 2;
            const r = this.radius * (0.8 + Math.sin(angle * 3 + this.x) * 0.2); // Pseudo-random shape based on position
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Craters
        ctx.fillStyle = '#332244';
        ctx.beginPath();
        ctx.arc(this.radius * 0.3, this.radius * 0.3, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
    }

    takeDamage(damage) {
        this.health -= damage;
        return this.health <= 0;
    }

    isDead() {
        return this.health <= 0;
    }
}

// Boss enemy
class Boss extends Enemy {
    constructor(x, y) {
        super(x, y, 'BOSS');
        this.phase = 0;
        this.armRotation = 0;
    }

    update(dt, player) {
        super.update(dt, player);
        this.armRotation += dt;

        // Boss phases
        const healthPercent = this.health / this.maxHealth;
        if (healthPercent < 0.3 && this.phase < 2) {
            this.phase = 2;
            this.speed *= 1.5;
        } else if (healthPercent < 0.6 && this.phase < 1) {
            this.phase = 1;
            this.speed *= 1.3;
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Draw Arms (behind body)
        const armCount = 4;
        for (let i = 0; i < armCount; i++) {
            const angle = (i / armCount) * Math.PI * 2 + this.armRotation;
            this.drawArm(ctx, angle);
        }

        // Boss Body
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#ff00ff');
        gradient.addColorStop(1, '#550055');

        ctx.fillStyle = gradient;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#ff00ff';
        ctx.shadowBlur = 20;

        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Cybernetic Eye
        const eyeX = Math.cos(this.wobble) * 5;
        const eyeY = Math.sin(this.wobble) * 5;

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, this.radius * 0.4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#f00'; // Pupil
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, this.radius * 0.15, 0, Math.PI * 2);
        ctx.fill();

        // Health bar
        const barWidth = 100;
        const barHeight = 8;
        const barY = -this.radius - 20;

        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(-barWidth / 2, barY, barWidth, barHeight);
        ctx.fillStyle = '#ff00ff';
        ctx.fillRect(-barWidth / 2, barY, barWidth * (this.health / this.maxHealth), barHeight);

        ctx.restore();
    }

    drawArm(ctx, angle) {
        ctx.save();
        ctx.rotate(angle);

        // Arm styling
        ctx.fillStyle = '#880088';
        ctx.strokeStyle = '#ff00ff';
        ctx.lineWidth = 2;

        // Draw segmented arm
        const length = this.radius * 1.5;
        const width = 10;

        ctx.beginPath();
        ctx.moveTo(this.radius * 0.8, -width / 2);
        ctx.lineTo(length, -width / 2);
        ctx.lineTo(length + 10, 0); // Claw tip
        ctx.lineTo(length, width / 2);
        ctx.lineTo(this.radius * 0.8, width / 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }
}

// Enemy type definitions
const ENEMY_TYPES = {
    BASIC: {
        health: 30,
        speed: 80,
        damage: 10,
        radius: 15,
        color: '#ff0055', // Neon Red
        expValue: 5
    },
    FAST: {
        health: 20,
        speed: 150,
        damage: 8,
        radius: 12,
        color: '#00ccff', // Neon Blue
        expValue: 8
    },
    TANK: {
        health: 100,
        speed: 50,
        damage: 20,
        radius: 25,
        color: '#ffaa00', // Neon Orange
        expValue: 15
    },
    BOSS: {
        health: 500,
        speed: 60,
        damage: 30,
        radius: 50,
        color: '#ff00ff', // Neon Magenta
        expValue: 100
    },
    METEOR: {
        health: 50,
        speed: 100,
        damage: 15,
        radius: 30,
        color: '#888',
        expValue: 2
    }
};

// Experience gem
class ExpGem {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.radius = 6;
        this.magnetRange = 150;
        this.collected = false;
        this.wobble = Math.random() * Math.PI;
    }

    update(dt, player) {
        this.wobble += dt * 5;
        const dist = distance(this.x, this.y, player.x, player.y);

        // Magnetic pull towards player
        if (dist < this.magnetRange + (player.pickupRange || 0)) { // Use player stats
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const speed = 400; // Strong pull

            this.x += (dx / dist) * speed * dt;
            this.y += (dy / dist) * speed * dt;
        }

        // Check collection
        if (dist < player.radius + this.radius) {
            this.collected = true;
            return true;
        }

        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.wobble) * 3); // Float animation

        // Gem glow
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#00ffff');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();

        // Gem shape (Diamond)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(0, -this.radius);
        ctx.lineTo(this.radius, 0);
        ctx.lineTo(0, this.radius);
        ctx.lineTo(-this.radius, 0);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
    }
}

// Health pickup
class HealthPickup {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 12;
        this.healAmount = 20;
        this.collected = false;
        this.wobble = 0;
    }

    update(dt, player) {
        this.wobble += dt * 3;
        const dist = distance(this.x, this.y, player.x, player.y);

        if (dist < player.radius + this.radius) {
            this.collected = true;
            return true;
        }

        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y + Math.sin(this.wobble) * 3);

        // Glow
        ctx.shadowColor = '#00ff00';
        ctx.shadowBlur = 15;

        // Container
        ctx.fillStyle = '#004400';
        ctx.strokeStyle = '#00ff00';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-8, -8, 16, 16);
        ctx.fill();
        ctx.stroke();

        // Cross
        ctx.fillStyle = '#00ff00';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillRect(-6, -2, 12, 4);

        ctx.restore();
    }
}

// Black hole
class BlackHole {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.radius = 60;
        this.triggerRadius = 80;
        this.rotation = 0;
        this.triggered = false;
        this.lifetime = 30; // seconds
        this.age = 0;
    }

    update(dt, player) {
        this.rotation += dt * 2;
        this.age += dt;

        // Check if player enters
        const dist = distance(this.x, this.y, player.x, player.y);
        if (dist < this.triggerRadius && !this.triggered) {
            this.triggered = true;
            return true; // Trigger boss spawn
        }

        return false;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);

        // Accretion disk
        const gradient = ctx.createRadialGradient(0, 0, this.radius * 0.4, 0, 0, this.radius);
        gradient.addColorStop(0, '#000000');
        gradient.addColorStop(0.5, '#7b00ff');
        gradient.addColorStop(1, 'rgba(123, 0, 255, 0)');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Swirl effect lines
        ctx.strokeStyle = '#bc13fe';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#bc13fe';

        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2);
            ctx.beginPath();
            ctx.arc(this.radius * 0.3, 0, this.radius * 0.6, 0.5, Math.PI);
            ctx.stroke();
        }

        // Event Horizon (Center)
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#fff'; // Inverted glow
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 0.3, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    isDead() {
        return this.age >= this.lifetime || this.triggered;
    }
}
