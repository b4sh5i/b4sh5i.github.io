// ==================== Game Configuration ====================
const CONFIG = {
    canvas: {
        width: 1280,
        height: 720
    },
    player: {
        speed: 200,
        maxHealth: 100,
        size: 20
    },
    enemy: {
        baseSpeed: 80,
        baseHealth: 10,
        baseDamage: 10,
        spawnInterval: 1000,
        spawnDistance: 100
    },
    experience: {
        collectRadius: 50,
        magnetRadius: 150,
        baseValue: 5
    }
};

// ==================== Utility Functions ====================
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    return len > 0 ? { x: x / len, y: y / len } : { x: 0, y: 0 };
}

function randomRange(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ==================== Particle System ====================
class Particle {
    constructor(x, y, color, size, vx, vy, lifetime) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = size;
        this.vx = vx;
        this.vy = vy;
        this.lifetime = lifetime;
        this.maxLifetime = lifetime;
        this.alpha = 1;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifetime -= dt;
        this.alpha = this.lifetime / this.maxLifetime;
        return this.lifetime > 0;
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    emit(x, y, count, color, sizeRange, speedRange, lifetime) {
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = randomRange(speedRange[0], speedRange[1]);
            const size = randomRange(sizeRange[0], sizeRange[1]);
            this.particles.push(new Particle(
                x, y, color, size,
                Math.cos(angle) * speed,
                Math.sin(angle) * speed,
                lifetime
            ));
        }
    }

    update(dt) {
        this.particles = this.particles.filter(p => p.update(dt));
    }

    draw(ctx, camera) {
        this.particles.forEach(p => p.draw(ctx, camera));
    }
}

// ==================== Player ====================
class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.size = CONFIG.player.size;
        this.health = CONFIG.player.maxHealth;
        this.maxHealth = CONFIG.player.maxHealth;
        this.level = 1;
        this.experience = 0;
        this.experienceToNext = 10;
        this.invulnerable = false;
        this.invulnerableTime = 0;
        this.damageFlash = 0;
    }

    takeDamage(damage) {
        if (this.invulnerable) return;
        
        this.health -= damage;
        this.invulnerable = true;
        this.invulnerableTime = 0.5;
        this.damageFlash = 0.2;
        
        if (this.health <= 0) {
            this.health = 0;
            return true; // Player died
        }
        return false;
    }

    gainExperience(amount) {
        this.experience += amount;
        if (this.experience >= this.experienceToNext) {
            this.experience -= this.experienceToNext;
            this.level++;
            this.experienceToNext = Math.floor(this.experienceToNext * 1.5);
            return true; // Level up
        }
        return false;
    }

    update(dt, keys, worldWidth, worldHeight) {
        // Movement
        let dx = 0, dy = 0;
        if (keys['ArrowLeft'] || keys['a']) dx -= 1;
        if (keys['ArrowRight'] || keys['d']) dx += 1;
        if (keys['ArrowUp'] || keys['w']) dy -= 1;
        if (keys['ArrowDown'] || keys['s']) dy += 1;

        const normalized = normalize(dx, dy);
        this.vx = normalized.x * CONFIG.player.speed;
        this.vy = normalized.y * CONFIG.player.speed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        // Keep in bounds
        this.x = Math.max(this.size, Math.min(worldWidth - this.size, this.x));
        this.y = Math.max(this.size, Math.min(worldHeight - this.size, this.y));

        // Update invulnerability
        if (this.invulnerable) {
            this.invulnerableTime -= dt;
            if (this.invulnerableTime <= 0) {
                this.invulnerable = false;
            }
        }

        if (this.damageFlash > 0) {
            this.damageFlash -= dt;
        }
    }

    draw(ctx, camera) {
        ctx.save();
        
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Invulnerability flash
        if (this.invulnerable && Math.floor(this.invulnerableTime * 20) % 2 === 0) {
            ctx.globalAlpha = 0.5;
        }

        // Damage flash
        if (this.damageFlash > 0) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#ff0066';
        }

        // Draw player
        ctx.fillStyle = '#00ffff';
        ctx.strokeStyle = '#0088ff';
        ctx.lineWidth = 3;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Inner glow
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size * 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ==================== Enemy ====================
class Enemy {
    constructor(x, y, level) {
        this.x = x;
        this.y = y;
        this.size = 15;
        this.speed = CONFIG.enemy.baseSpeed + level * 5;
        this.health = CONFIG.enemy.baseHealth + level * 5;
        this.maxHealth = this.health;
        this.damage = CONFIG.enemy.baseDamage + level * 2;
        this.hitFlash = 0;
    }

    takeDamage(damage) {
        this.health -= damage;
        this.hitFlash = 0.1;
        return this.health <= 0;
    }

    update(dt, player) {
        // Move towards player
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        const normalized = normalize(dx, dy);

        this.x += normalized.x * this.speed * dt;
        this.y += normalized.y * this.speed * dt;

        if (this.hitFlash > 0) {
            this.hitFlash -= dt;
        }
    }

    draw(ctx, camera) {
        ctx.save();
        
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y;

        // Hit flash
        if (this.hitFlash > 0) {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ff0066';
        }

        // Draw enemy
        ctx.fillStyle = '#ff0066';
        ctx.strokeStyle = '#cc0044';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Health bar
        const healthBarWidth = this.size * 2;
        const healthBarHeight = 4;
        const healthPercent = this.health / this.maxHealth;

        ctx.fillStyle = '#000';
        ctx.fillRect(screenX - healthBarWidth / 2, screenY - this.size - 10, healthBarWidth, healthBarHeight);
        
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(screenX - healthBarWidth / 2, screenY - this.size - 10, healthBarWidth * healthPercent, healthBarHeight);

        ctx.restore();
    }
}

// ==================== Experience Gem ====================
class ExperienceGem {
    constructor(x, y, value) {
        this.x = x;
        this.y = y;
        this.value = value;
        this.size = 6;
        this.magnetized = false;
        this.collected = false;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(dt, player, time) {
        const dist = distance(this.x, this.y, player.x, player.y);
        
        if (dist < CONFIG.experience.collectRadius) {
            this.collected = true;
            return true;
        }

        if (dist < CONFIG.experience.magnetRadius) {
            this.magnetized = true;
        }

        if (this.magnetized) {
            const dx = player.x - this.x;
            const dy = player.y - this.y;
            const normalized = normalize(dx, dy);
            const speed = 300;
            this.x += normalized.x * speed * dt;
            this.y += normalized.y * speed * dt;
        }

        return false;
    }

    draw(ctx, camera, time) {
        const screenX = this.x - camera.x;
        const screenY = this.y - camera.y + Math.sin(time * 3 + this.bobOffset) * 3;

        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#00ffff';
        ctx.fillStyle = '#00ffff';
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ==================== Weapons ====================
class Projectile {
    constructor(x, y, vx, vy, damage, size, color, lifetime) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.damage = damage;
        this.size = size;
        this.color = color;
        this.lifetime = lifetime;
        this.hit = false;
    }

    update(dt) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.lifetime -= dt;
        return this.lifetime > 0 && !this.hit;
    }

    draw(ctx, camera) {
        ctx.save();
        ctx.shadowBlur = 10;
        ctx.shadowColor = this.color;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class Weapon {
    constructor(name, description) {
        this.name = name;
        this.description = description;
        this.level = 1;
        this.cooldown = 0;
    }

    update(dt) {
        if (this.cooldown > 0) {
            this.cooldown -= dt;
        }
    }

    canFire() {
        return this.cooldown <= 0;
    }

    levelUp() {
        this.level++;
    }
}

class MagicWand extends Weapon {
    constructor() {
        super('마법봉', '가장 가까운 적을 향해 마법 탄환 발사');
        this.fireRate = 1.5;
        this.projectileSpeed = 400;
        this.damage = 15;
    }

    fire(player, enemies, projectiles) {
        if (!this.canFire() || enemies.length === 0) return;

        // Find closest enemy
        let closest = null;
        let closestDist = Infinity;
        enemies.forEach(enemy => {
            const dist = distance(player.x, player.y, enemy.x, enemy.y);
            if (dist < closestDist) {
                closestDist = dist;
                closest = enemy;
            }
        });

        if (closest) {
            const count = Math.min(this.level, 3);
            for (let i = 0; i < count; i++) {
                const angle = Math.atan2(closest.y - player.y, closest.x - player.x) + (i - count / 2 + 0.5) * 0.2;
                const vx = Math.cos(angle) * this.projectileSpeed;
                const vy = Math.sin(angle) * this.projectileSpeed;
                projectiles.push(new Projectile(
                    player.x, player.y, vx, vy,
                    this.damage + this.level * 5, 6, '#8a2be2', 3
                ));
            }
            this.cooldown = this.fireRate / (1 + this.level * 0.1);
        }
    }
}

class Whip extends Weapon {
    constructor() {
        super('채찍', '주변을 휘두르는 강력한 근접 공격');
        this.fireRate = 2;
        this.damage = 25;
        this.range = 80;
        this.angle = 0;
    }

    fire(player, enemies, projectiles) {
        if (!this.canFire()) return;

        this.angle += Math.PI / 4;
        const count = 2 + Math.floor(this.level / 2);
        
        for (let i = 0; i < count; i++) {
            const angle = this.angle + (Math.PI * 2 / count) * i;
            const vx = Math.cos(angle) * this.range * 3;
            const vy = Math.sin(angle) * this.range * 3;
            projectiles.push(new Projectile(
                player.x, player.y, vx, vy,
                this.damage + this.level * 8, 10, '#ff6b00', 0.3
            ));
        }
        
        this.cooldown = this.fireRate / (1 + this.level * 0.15);
    }
}

class HolyBible extends Weapon {
    constructor() {
        super('성서', '플레이어 주위를 도는 보호막');
        this.fireRate = 0.1;
        this.damage = 10;
        this.orbitRadius = 60;
        this.orbitSpeed = 2;
        this.orbitAngle = 0;
    }

    update(dt) {
        super.update(dt);
        this.orbitAngle += this.orbitSpeed * dt;
    }

    fire(player, enemies, projectiles) {
        if (!this.canFire()) return;

        const count = 1 + Math.floor(this.level / 2);
        for (let i = 0; i < count; i++) {
            const angle = this.orbitAngle + (Math.PI * 2 / count) * i;
            const x = player.x + Math.cos(angle) * this.orbitRadius;
            const y = player.y + Math.sin(angle) * this.orbitRadius;
            const vx = Math.cos(angle + Math.PI / 2) * this.orbitRadius * this.orbitSpeed;
            const vy = Math.sin(angle + Math.PI / 2) * this.orbitRadius * this.orbitSpeed;
            
            projectiles.push(new Projectile(
                x, y, vx, vy,
                this.damage + this.level * 3, 8, '#ffff00', 0.1
            ));
        }
        
        this.cooldown = this.fireRate;
    }
}

// ==================== Game ====================
class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.canvas.width = CONFIG.canvas.width;
        this.canvas.height = CONFIG.canvas.height;

        this.worldWidth = 3000;
        this.worldHeight = 3000;

        this.keys = {};
        this.gameState = 'menu'; // menu, playing, paused, levelup, gameover
        this.time = 0;
        this.lastTime = 0;

        this.player = null;
        this.enemies = [];
        this.projectiles = [];
        this.experienceGems = [];
        this.weapons = [];
        this.particles = new ParticleSystem();

        this.camera = { x: 0, y: 0 };
        this.enemySpawnTimer = 0;
        this.killCount = 0;
        this.difficultyLevel = 1;

        this.setupEventListeners();
        this.setupUI();
    }

    setupEventListeners() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key] = true;
            
            if (e.key === 'Escape' && this.gameState === 'playing') {
                this.pause();
            }
        });

        document.addEventListener('keyup', (e) => {
            this.keys[e.key] = false;
        });

        document.getElementById('start-button').addEventListener('click', () => this.startGame());
        document.getElementById('restart-button').addEventListener('click', () => this.startGame());
        document.getElementById('resume-button').addEventListener('click', () => this.resume());
        document.getElementById('quit-button').addEventListener('click', () => this.quitToMenu());
        document.getElementById('menu-button').addEventListener('click', () => this.quitToMenu());
    }

    setupUI() {
        // UI will be updated in updateHUD method
    }

    startGame() {
        this.gameState = 'playing';
        this.time = 0;
        this.killCount = 0;
        this.difficultyLevel = 1;

        this.player = new Player(this.worldWidth / 2, this.worldHeight / 2);
        this.enemies = [];
        this.projectiles = [];
        this.experienceGems = [];
        this.particles = new ParticleSystem();
        
        // Start with magic wand
        this.weapons = [new MagicWand()];

        this.enemySpawnTimer = 0;

        document.getElementById('start-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('hud').classList.remove('hidden');
        this.canvas.style.display = 'block';

        this.lastTime = performance.now();
        this.gameLoop();
    }

    pause() {
        this.gameState = 'paused';
        document.getElementById('pause-screen').classList.remove('hidden');
    }

    resume() {
        this.gameState = 'playing';
        document.getElementById('pause-screen').classList.add('hidden');
        this.lastTime = performance.now();
        this.gameLoop();
    }

    quitToMenu() {
        this.gameState = 'menu';
        this.canvas.style.display = 'none';
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('gameover-screen').classList.add('hidden');
        document.getElementById('levelup-screen').classList.add('hidden');
        document.getElementById('start-screen').classList.remove('hidden');
    }

    gameOver() {
        this.gameState = 'gameover';
        
        const minutes = Math.floor(this.time / 60);
        const seconds = Math.floor(this.time % 60);
        document.getElementById('final-time').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('final-kills').textContent = this.killCount;
        document.getElementById('final-level').textContent = this.player.level;
        
        document.getElementById('gameover-screen').classList.remove('hidden');
    }

    showLevelUp() {
        this.gameState = 'levelup';
        
        const options = this.generateLevelUpOptions();
        const container = document.getElementById('levelup-options');
        container.innerHTML = '';

        options.forEach((option, index) => {
            const div = document.createElement('div');
            div.className = 'levelup-option';
            div.innerHTML = `
                <div class="option-name">${option.name}</div>
                <div class="option-description">${option.description}</div>
                <div class="option-level">레벨 ${option.level}</div>
            `;
            div.addEventListener('click', () => this.selectLevelUpOption(option));
            container.appendChild(div);
        });

        document.getElementById('levelup-screen').classList.remove('hidden');
    }

    generateLevelUpOptions() {
        const options = [];
        const availableWeapons = [
            { class: MagicWand, name: '마법봉', description: '가장 가까운 적을 향해 마법 탄환 발사' },
            { class: Whip, name: '채찍', description: '주변을 휘두르는 강력한 근접 공격' },
            { class: HolyBible, name: '성서', description: '플레이어 주위를 도는 보호막' }
        ];

        // Existing weapons upgrade
        this.weapons.forEach(weapon => {
            if (weapon.level < 5) {
                options.push({
                    type: 'upgrade',
                    weapon: weapon,
                    name: weapon.name,
                    description: weapon.description + ' (강화)',
                    level: weapon.level + 1
                });
            }
        });

        // New weapons
        availableWeapons.forEach(w => {
            if (!this.weapons.find(weapon => weapon.name === w.name)) {
                options.push({
                    type: 'new',
                    weaponClass: w.class,
                    name: w.name,
                    description: w.description,
                    level: 1
                });
            }
        });

        // Stat upgrades
        options.push({
            type: 'stat',
            stat: 'health',
            name: '체력 회복',
            description: '체력을 완전히 회복하고 최대 체력 증가',
            level: '+'
        });

        // Shuffle and return 3 random options
        return options.sort(() => Math.random() - 0.5).slice(0, 3);
    }

    selectLevelUpOption(option) {
        if (option.type === 'upgrade') {
            option.weapon.levelUp();
        } else if (option.type === 'new') {
            this.weapons.push(new option.weaponClass());
        } else if (option.type === 'stat') {
            if (option.stat === 'health') {
                this.player.maxHealth += 20;
                this.player.health = this.player.maxHealth;
            }
        }

        document.getElementById('levelup-screen').classList.add('hidden');
        this.gameState = 'playing';
        this.lastTime = performance.now();
        this.gameLoop();
    }

    spawnEnemy() {
        const side = randomInt(0, 3);
        let x, y;

        const spawnDist = Math.max(CONFIG.canvas.width, CONFIG.canvas.height) / 2 + CONFIG.enemy.spawnDistance;

        switch (side) {
            case 0: // Top
                x = this.player.x + randomRange(-spawnDist, spawnDist);
                y = this.player.y - spawnDist;
                break;
            case 1: // Right
                x = this.player.x + spawnDist;
                y = this.player.y + randomRange(-spawnDist, spawnDist);
                break;
            case 2: // Bottom
                x = this.player.x + randomRange(-spawnDist, spawnDist);
                y = this.player.y + spawnDist;
                break;
            case 3: // Left
                x = this.player.x - spawnDist;
                y = this.player.y + randomRange(-spawnDist, spawnDist);
                break;
        }

        x = Math.max(50, Math.min(this.worldWidth - 50, x));
        y = Math.max(50, Math.min(this.worldHeight - 50, y));

        this.enemies.push(new Enemy(x, y, this.difficultyLevel));
    }

    update(dt) {
        this.time += dt;

        // Update difficulty
        this.difficultyLevel = 1 + Math.floor(this.time / 30);

        // Update player
        this.player.update(dt, this.keys, this.worldWidth, this.worldHeight);

        // Update camera
        this.camera.x = this.player.x - CONFIG.canvas.width / 2;
        this.camera.y = this.player.y - CONFIG.canvas.height / 2;

        // Spawn enemies
        this.enemySpawnTimer += dt;
        const spawnRate = Math.max(0.3, 1 - this.time / 300);
        if (this.enemySpawnTimer >= spawnRate) {
            this.enemySpawnTimer = 0;
            const count = 1 + Math.floor(this.time / 60);
            for (let i = 0; i < count; i++) {
                this.spawnEnemy();
            }
        }

        // Update enemies
        this.enemies.forEach(enemy => {
            enemy.update(dt, this.player);

            // Check collision with player
            if (distance(enemy.x, enemy.y, this.player.x, this.player.y) < enemy.size + this.player.size) {
                if (this.player.takeDamage(enemy.damage * dt)) {
                    this.gameOver();
                }
            }
        });

        // Update weapons
        this.weapons.forEach(weapon => {
            weapon.update(dt);
            weapon.fire(this.player, this.enemies, this.projectiles);
        });

        // Update projectiles
        this.projectiles = this.projectiles.filter(proj => {
            const alive = proj.update(dt);
            
            // Check collision with enemies
            this.enemies.forEach(enemy => {
                if (!proj.hit && distance(proj.x, proj.y, enemy.x, enemy.y) < proj.size + enemy.size) {
                    if (enemy.takeDamage(proj.damage)) {
                        // Enemy died
                        this.killCount++;
                        this.experienceGems.push(new ExperienceGem(
                            enemy.x, enemy.y, CONFIG.experience.baseValue
                        ));
                        this.particles.emit(enemy.x, enemy.y, 15, '#ff0066', [2, 5], [50, 150], 0.5);
                        this.enemies = this.enemies.filter(e => e !== enemy);
                    } else {
                        this.particles.emit(proj.x, proj.y, 5, proj.color, [1, 3], [20, 60], 0.3);
                    }
                    proj.hit = true;
                }
            });

            return alive;
        });

        // Update experience gems
        this.experienceGems = this.experienceGems.filter(gem => {
            const collected = gem.update(dt, this.player, this.time);
            if (collected) {
                if (this.player.gainExperience(gem.value)) {
                    this.showLevelUp();
                }
                this.particles.emit(gem.x, gem.y, 10, '#00ffff', [2, 4], [30, 80], 0.4);
            }
            return !collected;
        });

        // Update particles
        this.particles.update(dt);

        // Update HUD
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('player-level').textContent = this.player.level;
        document.getElementById('health-bar').style.width = (this.player.health / this.player.maxHealth * 100) + '%';
        document.getElementById('health-text').textContent = 
            `${Math.ceil(this.player.health)}/${this.player.maxHealth}`;
        document.getElementById('exp-bar').style.width = 
            (this.player.experience / this.player.experienceToNext * 100) + '%';
        
        const minutes = Math.floor(this.time / 60);
        const seconds = Math.floor(this.time % 60);
        document.getElementById('timer').textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.getElementById('kill-count').textContent = this.killCount;
    }

    draw() {
        // Clear canvas
        this.ctx.fillStyle = '#0f0f1e';
        this.ctx.fillRect(0, 0, CONFIG.canvas.width, CONFIG.canvas.height);

        // Draw grid
        this.drawGrid();

        // Draw experience gems
        this.experienceGems.forEach(gem => gem.draw(this.ctx, this.camera, this.time));

        // Draw enemies
        this.enemies.forEach(enemy => enemy.draw(this.ctx, this.camera));

        // Draw projectiles
        this.projectiles.forEach(proj => proj.draw(this.ctx, this.camera));

        // Draw player
        this.player.draw(this.ctx, this.camera);

        // Draw particles
        this.particles.draw(this.ctx, this.camera);
    }

    drawGrid() {
        const gridSize = 50;
        const startX = Math.floor(this.camera.x / gridSize) * gridSize;
        const startY = Math.floor(this.camera.y / gridSize) * gridSize;

        this.ctx.strokeStyle = 'rgba(138, 43, 226, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = startX; x < this.camera.x + CONFIG.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x - this.camera.x, 0);
            this.ctx.lineTo(x - this.camera.x, CONFIG.canvas.height);
            this.ctx.stroke();
        }

        for (let y = startY; y < this.camera.y + CONFIG.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y - this.camera.y);
            this.ctx.lineTo(CONFIG.canvas.width, y - this.camera.y);
            this.ctx.stroke();
        }
    }

    gameLoop() {
        if (this.gameState !== 'playing') return;

        const currentTime = performance.now();
        const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
        this.lastTime = currentTime;

        this.update(dt);
        this.draw();

        requestAnimationFrame(() => this.gameLoop());
    }
}

// ==================== Initialize Game ====================
window.addEventListener('load', () => {
    const game = new Game();
});
