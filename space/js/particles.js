// ===== Particle System =====

class Particle {
    constructor(x, y, vx, vy, color, size, life) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.size = size;
        this.life = life;
        this.maxLife = life;
        this.alpha = 1;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.life -= dt;
        this.alpha = this.life / this.maxLife;

        // Fade out
        this.vx *= 0.98;
        this.vy *= 0.98;
    }

    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isDead() {
        return this.life <= 0;
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, config = {}) {
        const {
            color = '#fff',
            minSize = 2,
            maxSize = 4,
            minSpeed = 50,
            maxSpeed = 150,
            life = 1,
            spread = Math.PI * 2
        } = config;

        for (let i = 0; i < count; i++) {
            const angle = random(0, spread);
            const speed = random(minSpeed, maxSpeed);
            const vx = Math.cos(angle) * speed;
            const vy = Math.sin(angle) * speed;
            const size = random(minSize, maxSize);

            this.particles.push(new Particle(x, y, vx, vy, color, size, life));
        }
    }

    // Explosion effect
    explosion(x, y, color = '#ff6b6b') {
        this.emit(x, y, 20, {
            color,
            minSize: 2,
            maxSize: 6,
            minSpeed: 100,
            maxSpeed: 300,
            life: 0.8
        });
    }

    // Level up effect
    levelUp(x, y) {
        this.emit(x, y, 30, {
            color: '#ffd700',
            minSize: 3,
            maxSize: 8,
            minSpeed: 50,
            maxSpeed: 200,
            life: 1.5
        });
    }

    // Weapon fire trail
    trail(x, y, color = '#4444ff') {
        this.emit(x, y, 3, {
            color,
            minSize: 1,
            maxSize: 3,
            minSpeed: 10,
            maxSpeed: 30,
            life: 0.3,
            spread: Math.PI * 0.5
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].isDead()) {
                this.particles.splice(i, 1);
            }
        }
    }

    draw(ctx) {
        this.particles.forEach(p => p.draw(ctx));
    }

    clear() {
        this.particles = [];
    }
}
