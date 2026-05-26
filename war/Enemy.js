class Enemy {
    constructor(wave, isBoss = false) {
        this.wave = wave;
        this.isBoss = isBoss;
        // Boss HP scales x10
        this.hp = 100 * wave * (isBoss ? 10 : 1);
        this.maxHp = this.hp;
        // Base speed in pixels per second - much slower and more reasonable
        // Boss speed is 50%
        this.speed = (50 + (wave * 2)) * (isBoss ? 0.5 : 1);
        this.pathIndex = 0;
        this.x = PATH_WAYPOINTS[0].x;
        this.y = PATH_WAYPOINTS[0].y;
        this.active = true;
        this.radius = isBoss ? 25 : 15;
        this.slowTimer = 0;
        this.lapCount = 0; // Track number of laps completed
    }

    update(dt) {
        if (!this.active) return;

        const target = PATH_WAYPOINTS[this.pathIndex + 1];
        if (!target) {
            this.active = false;
            return 'leak';
        }

        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 5) {
            this.pathIndex++;
            // Check if completed one lap (reached end of path)
            if (this.pathIndex >= PATH_WAYPOINTS.length - 1) {
                this.lapCount++;

                // Enemy leaks life only after 4 laps
                if (this.lapCount >= 4) {
                    this.active = false;
                    return 'leak';
                }

                // Reset to start for another lap
                this.pathIndex = 0;
                this.x = PATH_WAYPOINTS[0].x;
                this.y = PATH_WAYPOINTS[0].y;
            }
        } else {
            let currentSpeed = this.speed;
            if (this.slowTimer > 0) {
                this.slowTimer -= dt / 1000; // Convert to seconds
                currentSpeed *= 0.6; // 40% slow
            }

            // dt is in milliseconds, so divide by 1000 to get seconds
            const moveDist = currentSpeed * (dt / 1000);
            this.x += (dx / dist) * moveDist;
            this.y += (dy / dist) * moveDist;
        }
        return null;
    }

    takeDamage(amount) {
        this.hp -= amount;
        if (this.hp <= 0) {
            this.active = false;
            // Give rewards when enemy dies
            if (window.game) {
                window.game.onEnemyKilled(this);
            }
            return 'dead';
        }
        return 'hit';
    }

    applySlow(duration) {
        this.slowTimer = duration;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.fillStyle = this.isBoss ? '#9b59b6' : '#ff3333';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();

        if (this.isBoss) {
            ctx.shadowColor = '#9b59b6';
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowBlur = 0;
        }

        const hpPct = Math.max(0, this.hp / this.maxHp);
        const barWidth = this.isBoss ? 50 : 30;
        ctx.fillStyle = 'red';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth, 4);
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(this.x - barWidth / 2, this.y - this.radius - 10, barWidth * hpPct, 4);
    }
}
