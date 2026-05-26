class Projectile {
    constructor(x, y, target, damage, colorTier, typeData) {
        this.x = x;
        this.y = y;
        this.target = target;
        this.damage = damage;
        this.speed = 300; // Pixels per second - reduced for better visibility
        this.active = true;
        this.color = TIERS[colorTier].color;
        this.typeData = typeData || {};
    }

    update(dt) {
        if (!this.active) return;
        if (!this.target.active) {
            this.active = false;
            return;
        }

        const dx = this.target.x - this.x;
        const dy = this.target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 10) {
            this.hitTarget();
            this.active = false;
        } else {
            // dt is in milliseconds, so divide by 1000 to get seconds
            const moveDist = this.speed * (dt / 1000);
            this.x += (dx / dist) * moveDist;
            this.y += (dy / dist) * moveDist;
        }
    }

    hitTarget() {
        let finalDamage = this.damage;
        // Random Damage Logic
        if (this.typeData.random) {
            finalDamage = this.damage * (0.5 + Math.random() * 1.5);
        }

        if (this.typeData.splash) {
            const splashRadius = this.typeData.splash;
            // Assuming window.game.enemies is accessible. 
            if (window.game && window.game.enemies) {
                window.game.enemies.forEach(e => {
                    if (!e.active) return;
                    const dx = e.x - this.x;
                    const dy = e.y - this.y;
                    if (Math.sqrt(dx * dx + dy * dy) <= splashRadius) {
                        e.takeDamage(finalDamage * 0.8);
                    }
                });
            }
        } else {
            this.target.takeDamage(finalDamage);
        }

        if (this.typeData.slow) {
            this.target.applySlow(2.0);
        }
    }

    draw(ctx) {
        if (!this.active) return;

        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}
