// ===== Game Engine =====

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
const STATE = {
    MENU: 0,
    PLAYING: 1,
    PAUSED: 2,
    GAME_OVER: 3,
    LEVEL_UP: 4
};

let currentState = STATE.MENU;
let lastTime = 0;
let gameTime = 0;

// World & Camera
const WORLD_WIDTH = 3000;
const WORLD_HEIGHT = 3000;
const camera = {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scale: 0.6 // Zoom level (smaller = further away)
};

// Game Entities
let player;
let enemies = [];
let projectiles = [];
let pickups = []; // Exp gems, health packs
let blackHoles = [];
let particles;

// Input State
let input = {
    x: 0,
    y: 0,
    touchId: null,
    startX: 0,
    startY: 0,
    isDown: false
};

// Spawning
let nextSpawnTime = 0;
let spawnRate = 2; // seconds
let difficultyMultiplier = 1;
let bossTimer = 0;
let blackHoleTimer = 0;
let meteorTimer = 0;

// Resize handling
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    camera.width = canvas.width / camera.scale;
    camera.height = canvas.height / camera.scale;
}
window.addEventListener('resize', resize);
resize();

// Input Handling
function handleStart(x, y, id = null) {
    if (currentState !== STATE.PLAYING) return;

    input.isDown = true;
    input.startX = x;
    input.startY = y;
    input.touchId = id;
    input.x = 0;
    input.y = 0;
}

function handleMove(x, y, id = null) {
    if (!input.isDown || (id !== null && id !== input.touchId)) return;

    // Calculate drag vector
    const dx = x - input.startX;
    const dy = y - input.startY;

    // Normalize input
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len > 0) {
        input.x = dx;
        input.y = dy;
    }
}

function handleEnd(id = null) {
    if (id !== null && id !== input.touchId) return;

    input.isDown = false;
    input.touchId = null;
    input.x = 0;
    input.y = 0;
}

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    handleStart(touch.clientX, touch.clientY, touch.identifier);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    handleMove(touch.clientX, touch.clientY, touch.identifier);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    const touch = e.changedTouches[0];
    handleEnd(touch.identifier);
});

// Mouse events (for desktop testing)
canvas.addEventListener('mousedown', (e) => {
    handleStart(e.clientX, e.clientY);
});

canvas.addEventListener('mousemove', (e) => {
    handleMove(e.clientX, e.clientY);
});

canvas.addEventListener('mouseup', () => {
    handleEnd();
});

// Game Loop
function initGame() {
    player = new Player(WORLD_WIDTH / 2, WORLD_HEIGHT / 2);
    // Give initial weapon
    player.addWeapon('MISSILE');

    enemies = [];
    projectiles = [];
    pickups = [];
    blackHoles = [];
    particles = new ParticleSystem();

    gameTime = 0;
    gameTime = 0;
    spawnRate = 0.5; // Much faster initial spawn (was 2)
    difficultyMultiplier = 1;
    bossTimer = 0;
    blackHoleTimer = 0;
    meteorTimer = 0;

    // Reset Camera
    camera.x = player.x - camera.width / 2;
    camera.y = player.y - camera.height / 2;

    // UI Init
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('gameUI').classList.remove('hidden');

    currentState = STATE.PLAYING;
    lastTime = performance.now();
    requestAnimationFrame(gameLoop);
}

function handleEnemyDeath(enemy) {
    player.kills++;
    // Drop EXP gem
    pickups.push(new ExpGem(enemy.x, enemy.y, enemy.expValue));

    // SPLITTER Logic: Spawn children
    if (enemy.type === 'SPLITTER') {
        for (let k = 0; k < 2; k++) {
            const child = new Enemy(enemy.x + random(-10, 10), enemy.y + random(-10, 10), 'FAST');
            child.health *= 0.5; // Weaker children
            child.radius *= 0.7;
            enemies.push(child);
        }
    }

    // Drop Health ONLY from Bosses
    if (enemy.type === 'BOSS') {
        pickups.push(new HealthPickup(enemy.x, enemy.y));
    }
}

function spawnEnemy() {
    // Spawn somewhat near player but sufficiently far
    const angle = random(0, Math.PI * 2);
    const dist = random(camera.width * 0.6, camera.width * 1.0); // Outside view
    const x = player.x + Math.cos(angle) * dist;
    const y = player.y + Math.sin(angle) * dist;

    // Clamp to world + margin (enemies can spawn slightly outside)
    const spawnX = clamp(x, 50, WORLD_WIDTH - 50);
    const spawnY = clamp(y, 50, WORLD_HEIGHT - 50);

    // Determine type based on game time
    let type = 'BASIC';
    const rand = Math.random();

    if (gameTime > 30 && rand < 0.2) type = 'SPLITTER';
    else if (gameTime > 60 && rand < 0.3) type = 'FAST';
    else if (gameTime > 90 && rand < 0.15) type = 'ORBITER';
    else if (gameTime > 120 && rand < 0.1) type = 'TANK';
    else if (gameTime > 150 && rand < 0.1) type = 'DASHER';

    enemies.push(new Enemy(spawnX, spawnY, type));
}

function spawnBoss() {
    // Spawn far away
    const angle = random(0, Math.PI * 2);
    const dist = camera.width * 0.8;
    const x = clamp(player.x + Math.cos(angle) * dist, 100, WORLD_WIDTH - 100);
    const y = clamp(player.y + Math.sin(angle) * dist, 100, WORLD_HEIGHT - 100);

    enemies.push(new Boss(x, y));

    // Boss spawn effect
    particles.explosion(x, y, '#ff00ff');
}

function spawnBlackHole() {
    // Spawn randomly in world
    const margin = 200;
    let x, y, dist;

    do {
        x = random(margin, WORLD_WIDTH - margin);
        y = random(margin, WORLD_HEIGHT - margin);
        dist = distance(x, y, player.x, player.y);
    } while (dist < 400); // Minimum distance from player

    blackHoles.push(new BlackHole(x, y));
}

function spawnMeteor() {
    // Spawn relative to camera view
    const edge = Math.floor(Math.random() * 4); // 0: top, 1: right, 2: bottom, 3: left
    let x, y;
    const viewPadding = 100;

    // Coordinates in world space relative to camera
    switch (edge) {
        case 0: // Top
            x = camera.x + Math.random() * camera.width;
            y = camera.y - viewPadding;
            break;
        case 1: // Right
            x = camera.x + camera.width + viewPadding;
            y = camera.y + Math.random() * camera.height;
            break;
        case 2: // Bottom
            x = camera.x + Math.random() * camera.width;
            y = camera.y + camera.height + viewPadding;
            break;
        case 3: // Left
            x = camera.x - viewPadding;
            y = camera.y + Math.random() * camera.height;
            break;
    }

    // Target inside the view
    const targetX = camera.x + camera.width * 0.2 + Math.random() * camera.width * 0.6;
    const targetY = camera.y + camera.height * 0.2 + Math.random() * camera.height * 0.6;
    const angle = Math.atan2(targetY - y, targetX - x);

    const meteor = new Enemy(x, y, 'METEOR');
    meteor.vx = Math.cos(angle) * meteor.speed;
    meteor.vy = Math.sin(angle) * meteor.speed;

    enemies.push(meteor);
}

function updateCamera(dt) {
    // Look-ahead target: Player position + offset based on movement
    // "오른쪽으로 가면 정 중앙에서 살짝 우측으로"
    const lookAheadFactor = 0.3; // How much camera leads the player
    const targetX = player.x - camera.width / 2 + (player.vx * lookAheadFactor);
    const targetY = player.y - camera.height / 2 + (player.vy * lookAheadFactor);

    // Smooth camera movement (Lerp)
    const smoothSpeed = 5 * dt;
    camera.x += (targetX - camera.x) * smoothSpeed;
    camera.y += (targetY - camera.y) * smoothSpeed;

    // Clamp camera completely to world bounds?
    // User wants to see boundaries, so we should allow seeing the edge.
    // Let's clamp so we don't see TOO much emptiness, but enough to see the border line.
    const margin = 50; // Allow seeing 50px of void
    camera.x = clamp(camera.x, -margin, WORLD_WIDTH - camera.width + margin);
    camera.y = clamp(camera.y, -margin, WORLD_HEIGHT - camera.height + margin);
}

function update(dt) {
    if (currentState !== STATE.PLAYING) return;

    gameTime += dt;
    difficultyMultiplier = 1 + (gameTime / 60) * 0.5; // +50% stats every minute

    // Spawning logic
    nextSpawnTime -= dt;
    if (nextSpawnTime <= 0) {
        // Double spawn count for swarm effect
        spawnEnemy();
        // Double spawn count for swarm effect
        spawnEnemy();
        // Constant pressure
        if (enemies.length < 20) {
            spawnEnemy();
            spawnEnemy();
        }
        if (Math.random() < 0.5) spawnEnemy();

        // Spawn rate accelerates faster
        nextSpawnTime = (spawnRate / Math.sqrt(difficultyMultiplier)) * 0.8;
    }

    // Random boss spawn logic
    bossTimer += dt;
    if (bossTimer > 180) { // Every 3 minutes check for boss
        if (Math.random() < 0.3) {
            spawnBoss();
        }
        bossTimer = 0;
        // Boss Wave: Spawn minions with boss
        for (let i = 0; i < 5; i++) spawnEnemy();
    }

    // Black hole logic
    blackHoleTimer += dt;
    if (blackHoleTimer > 60) { // Every minute chance for black hole
        if (Math.random() < 0.4) {
            spawnBlackHole();
        }
        blackHoleTimer = 0;
    }

    // Meteor logic
    meteorTimer -= dt;
    if (meteorTimer <= 0) {
        // Meteor shower chance
        spawnMeteor();
        if (Math.random() < 0.3) setTimeout(spawnMeteor, 500);

        meteorTimer = random(5, 10);
    }

    // Background Update (Parallax)
    // No explicit update needed for simple drawing based on camera, 
    // but if we had animated planets we'd update them here.

    // Update Entities
    player.update(dt, input.x, input.y);
    player.updateCooldowns(dt);
    player.shoot(projectiles, enemies);

    // Confine player to WORLD
    player.x = clamp(player.x, player.radius, WORLD_WIDTH - player.radius);
    player.y = clamp(player.y, player.radius, WORLD_HEIGHT - player.radius);

    // Update Camera
    updateCamera(dt);

    // Update enemies
    enemies.forEach(enemy => enemy.update(dt, player));

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const p = projectiles[i];
        p.update(dt, enemies);

        // Check collisions (Projectile vs Enemy)
        if (p.owner === 'player') {
            for (const enemy of enemies) {
                if (circleCollision(p.x, p.y, p.radius, enemy.x, enemy.y, enemy.radius)) {
                    // Hit!
                    p.hit();

                    // Check for AoE (Area of Effect)
                    if (p.explosionRadius) {
                        // Explosion visual removed as requested
                        // particles.explosion(p.x, p.y, p.color || '#ff00ff', p.explosionRadius / 20);

                        // AoE Damage
                        for (const target of enemies) {
                            if (distance(p.x, p.y, target.x, target.y) <= p.explosionRadius) {
                                const dead = target.takeDamage(p.damage); // Full damage or falloff? Full for now.
                                if (dead) handleEnemyDeath(target);
                            }
                        }
                    } else {
                        // Single target hit
                        const dead = enemy.takeDamage(p.damage);
                        particles.explosion(p.x, p.y, p.color || '#fff');
                        if (dead) handleEnemyDeath(enemy);
                    }

                    if (p.isDead()) break;
                }
            }
        }

        // Remove dead/off-screen projectiles (relative to world now, or just time based)
        // Just use time based + huge bounds check
        if (p.isDead() ||
            p.x < -1000 || p.x > WORLD_WIDTH + 1000 ||
            p.y < -1000 || p.y > WORLD_HEIGHT + 1000) {
            projectiles.splice(i, 1);
        }
    }

    // Update pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
        const pickup = pickups[i];
        if (pickup.update(dt, player)) {
            if (pickup instanceof ExpGem) {
                if (player.gainExp(pickup.value)) {
                    currentState = STATE.LEVEL_UP;
                    showLevelUpScreen(player, () => {
                        currentState = STATE.PLAYING;
                        lastTime = performance.now();
                    });
                    particles.levelUp(player.x, player.y);
                }
            } else if (pickup instanceof HealthPickup) {
                player.heal(pickup.healAmount);
            }
            pickups.splice(i, 1);
        }
    }

    // Update black holes
    for (let i = blackHoles.length - 1; i >= 0; i--) {
        const bh = blackHoles[i];
        if (bh.update(dt, player)) {
            // Triggered!
            spawnBoss();
        }

        if (bh.isDead()) {
            blackHoles.splice(i, 1);
        }
    }

    // Check collisions (Enemy vs Player)
    for (const enemy of enemies) {
        if (circleCollision(player.x, player.y, player.radius, enemy.x, enemy.y, enemy.radius)) {
            if (player.takeDamage(enemy.damage * dt)) {
                gameOver();
            }
        }
    }

    // Remove dead enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
        if (enemies[i].isDead()) {
            enemies.splice(i, 1);
        }
    }

    particles.update(dt);
    updateUI(player, gameTime);
}

// Background Assets
const PLANETS = [
    { x: 500, y: 500, r: 200, color: '#332244', rings: true },
    { x: 2500, y: 800, r: 350, color: '#442222', type: 'gas' },
    { x: 1500, y: 2000, r: 150, color: '#224455', moons: 2 },
    { x: 300, y: 2500, r: 100, color: '#555522', crater: true }
];

const NEBULAS = [
    { x: 1500, y: 1500, r: 1000, color: 'rgba(100, 0, 255, 0.05)' },
    { x: 500, y: 2000, r: 800, color: 'rgba(255, 0, 100, 0.05)' }
];

function drawBackground(ctx) {
    // 1. Deep Space Background
    ctx.fillStyle = '#0a0a12'; // Slightly richer dark
    ctx.fillRect(camera.x, camera.y, camera.width, camera.height);

    // 2. Parallax Stars (Distant)
    // We simulate parallax by shifting stars based on camera pos * factor
    // But since this is a 2D top-down world, usually background is fixed to world.

    // Let's implement "Fixed World Background" first to give sense of location.

    // Draw Nebulas (World coordinates)
    NEBULAS.forEach(neb => {
        const grad = ctx.createRadialGradient(neb.x, neb.y, 0, neb.x, neb.y, neb.r);
        grad.addColorStop(0, neb.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(neb.x, neb.y, neb.r, 0, Math.PI * 2);
        ctx.fill();
    });

    // Draw Planets (World coordinates)
    PLANETS.forEach(p => {
        ctx.save();
        ctx.translate(p.x, p.y);

        // Planet Body
        const grad = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.3, 0, 0, 0, p.r);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, 0, Math.PI * 2);
        ctx.fill();

        // Details
        if (p.rings) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 20;
            ctx.beginPath();
            ctx.ellipse(0, 0, p.r * 1.5, p.r * 0.4, -0.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.restore();
    });

    // 3. Grid (World coordinates)
    const gridSize = 200;
    const startX = Math.floor(camera.x / gridSize) * gridSize;
    const startY = Math.floor(camera.y / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;

    for (let x = startX; x < camera.x + camera.width + gridSize; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, camera.y);
        ctx.lineTo(x, camera.y + camera.height);
        ctx.stroke();
    }
    for (let y = startY; y < camera.y + camera.height + gridSize; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(camera.x, y);
        ctx.lineTo(camera.x + camera.width, y);
        ctx.stroke();
    }

    // 4. Stars (World Coordinates - Scattered)
    // To be efficient, we generate them deterministically based on grid cells or just draw a few fixed ones
    // For 3000x3000, we can iterate just visible area too.
    // Let's use a simple deterministic random for visible grid cells

    ctx.fillStyle = '#fff';
    const starGrid = 300; // Large cells
    const sX = Math.floor(camera.x / starGrid) * starGrid;
    const sY = Math.floor(camera.y / starGrid) * starGrid;

    for (let x = sX; x < camera.x + camera.width + starGrid; x += starGrid) {
        for (let y = sY; y < camera.y + camera.height + starGrid; y += starGrid) {
            // Pseudo-random based on coord
            const seed = (x * 73856093) ^ (y * 19349663);
            const rX = x + (seed % starGrid);
            const rY = y + ((seed * 7) % starGrid);

            const absSeed = Math.abs(seed);
            const size = (absSeed % 3) + 1;

            ctx.globalAlpha = 0.3 + ((absSeed % 10) / 20); // 0.3 - 0.8
            ctx.beginPath();
            ctx.arc(rX, rY, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.globalAlpha = 1;
}

function draw() {
    // Clear handled by filling background
    // ctx.fillStyle = '#050510'; 
    // ctx.fillRect(0, 0, canvas.width, canvas.height); // Camera view clear

    ctx.save();
    // Apply Camera Transform
    // Apply Camera Transform with Zoom
    ctx.scale(camera.scale, camera.scale);
    ctx.translate(-camera.x, -camera.y);

    drawBackground(ctx);

    // Draw World Boundaries
    ctx.strokeStyle = '#ff0044'; // Bright Red/Pink Neon
    ctx.lineWidth = 4;
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0044';
    ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
    ctx.shadowBlur = 0; // Reset

    // Draw Black Holes
    blackHoles.forEach(bh => bh.draw(ctx));

    // Draw Pickups
    pickups.forEach(p => p.draw(ctx));

    // Draw Enemies
    enemies.forEach(e => e.draw(ctx));

    // Draw Player
    if (currentState !== STATE.GAME_OVER) {
        player.draw(ctx);
    }

    // Draw Projectiles
    projectiles.forEach(p => p.draw(ctx));

    // Draw Particles
    particles.draw(ctx);

    ctx.restore(); // End Camera Transform
}

function gameLoop(timestamp) {
    if (currentState === STATE.PAUSED) return;

    const dt = Math.min((timestamp - lastTime) / 1000, 0.1); // Limit dt to 0.1s
    lastTime = timestamp;

    if (currentState === STATE.PLAYING) {
        update(dt);
    }

    draw();

    if (currentState !== STATE.GAME_OVER) {
        requestAnimationFrame(gameLoop);
    }
}

function gameOver() {
    currentState = STATE.GAME_OVER;
    showGameOverScreen(player, gameTime);
}

// Event Listeners for UI
document.getElementById('startButton').addEventListener('click', initGame);
document.getElementById('restartButton').addEventListener('click', initGame);

// Initial draw
resize();
particles = new ParticleSystem(); // Init for title screen effects if needed
