class Tower {
    constructor(tier, type, r, c) {
        this.tier = tier; // 0..4
        this.type = type; // 0..7
        this.r = r;
        this.c = c;

        this.updateStats();
        this.lastShot = 0;
    }

    updateStats() {
        const base = TOWER_TYPES[this.type];
        this.range = base.range + (this.tier * 10);
        this.cooldown = base.cooldown;
        this.baseDamage = base.damage;
        this.typeName = base.name;
    }

    getDamage(upgradeMultipliers) {
        const tierMult = Math.pow(2, this.tier);
        const upgradeMult = upgradeMultipliers ? (upgradeMultipliers[this.tier] || 1) : 1;
        return this.baseDamage * tierMult * upgradeMult;
    }

    update(time, enemies, projectiles) {
        if (time - this.lastShot < this.cooldown) return;

        const target = this.findTarget(enemies);
        if (target) {
            const dmg = this.getDamage(window.game?.upgrades);
            this.shoot(target, projectiles, dmg);
            this.lastShot = time;
        }
    }

    findTarget(enemies) {
        const tx = MAP_OFFSET_X + this.c * GRID_SIZE + GRID_SIZE / 2;
        const ty = MAP_OFFSET_Y + this.r * GRID_SIZE + GRID_SIZE / 2;
        const activeEnemies = enemies.filter(e => e.active);

        let closest = null;
        let minMsg = Infinity;

        for (const enemy of activeEnemies) {
            const dx = enemy.x - tx;
            const dy = enemy.y - ty;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist <= this.range) {
                if (dist < minMsg) {
                    minMsg = dist;
                    closest = enemy;
                }
            }
        }
        return closest;
    }

    shoot(target, projectiles, dmg) {
        const tx = MAP_OFFSET_X + this.c * GRID_SIZE + GRID_SIZE / 2;
        const ty = MAP_OFFSET_Y + this.r * GRID_SIZE + GRID_SIZE / 2;
        const typeData = TOWER_TYPES[this.type];

        projectiles.push(new Projectile(
            tx, ty,
            target,
            dmg,
            this.tier,
            typeData
        ));
    }

    draw(ctx, x, y) {
        const cx = x + GRID_SIZE / 2;
        const cy = y + GRID_SIZE / 2;
        const typeInfo = TOWER_TYPES[this.type];

        // Base Tier Circle
        ctx.fillStyle = TIERS[this.tier].color;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(cx, cy, GRID_SIZE * 0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner Type Visual
        ctx.fillStyle = typeInfo.color || '#333';
        ctx.beginPath();
        ctx.arc(cx, cy, GRID_SIZE * 0.25, 0, Math.PI * 2);
        ctx.fill();

        // Icon / Letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 16px "Orbitron", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const icons = ['⚡', '🔭', '💣', '🚀', '❄️', '☢️', '🔦', '🎲'];
        ctx.fillText(icons[this.type] || this.type, cx, cy);

        // Tier Indicator (Dots)
        ctx.fillStyle = '#fff';
        for (let i = 0; i <= this.tier; i++) {
            ctx.beginPath();
            ctx.arc(cx - 10 + (i * 5), cy + 18, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
