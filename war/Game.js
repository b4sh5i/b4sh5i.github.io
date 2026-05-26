class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        // Fix for high DPI displays
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = CANVAS_WIDTH * dpr;
        this.canvas.height = CANVAS_HEIGHT * dpr;
        this.canvas.style.width = `${CANVAS_WIDTH}px`;
        this.canvas.style.height = `${CANVAS_HEIGHT}px`;
        this.ctx.scale(dpr, dpr);

        // Game State
        this.lastTime = 0;
        this.gameStarted = false; // New: track if game has started
        this.playing = false;
        this.gameOver = false;
        this.wave = 1;
        this.life = 50;
        this.gold = 400; // Starting Gold (increased from 100)
        this.silver = 0; // Starting Silver
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];

        // Upgrades: Multipliers for each tier [0..4]
        this.upgrades = [1, 1, 1, 1, 1];

        // Wave Logic
        this.waveTimer = 0;
        this.enemiesToSpawn = 0;
        this.spawnTimer = 0;
        this.waveEnemiesSpawned = 0;
        this.waveTotalEnemies = 10; // Base enemies per wave

        // Build Mode
        this.buildMode = false;
        this.selectedTower = null;

        // Drag-and-Drop for Tower Merging
        this.draggedTower = null;
        this.isDragging = false;
        this.dragStartPos = null;

        // Bind Inputs
        this.bindEvents();

        // Start render loop but don't start game yet
        requestAnimationFrame((t) => this.loop(t));
        this.updateUI();
    }

    bindEvents() {
        // Helper to get canvas coordinates
        const getCanvasCoords = (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const clientX = e.clientX || e.touches[0].clientX;
            const clientY = e.clientY || e.touches[0].clientY;

            // Fixed: Calculate scale based on logical canvas size
            const scaleX = CANVAS_WIDTH / rect.width;
            const scaleY = CANVAS_HEIGHT / rect.height;

            const x = (clientX - rect.left) * scaleX;
            const y = (clientY - rect.top) * scaleY;

            return { x, y };
        };

        // Mouse/Touch Start (for dragging)
        const handleStart = (e) => {
            if (this.gameOver || !this.gameStarted) return;

            const { x, y } = getCanvasCoords(e);
            this.handleDragStart(x, y);
        };

        // Mouse/Touch Move (for dragging)
        const handleMove = (e) => {
            if (this.gameOver || !this.gameStarted || !this.isDragging) return;

            const { x, y } = getCanvasCoords(e);
            this.handleDragMove(x, y);
        };

        // Mouse/Touch End (for dropping)
        const handleEnd = (e) => {
            if (this.gameOver || !this.gameStarted || !this.isDragging) return;

            this.handleDragEnd();
        };

        // Canvas event listeners
        this.canvas.addEventListener('mousedown', handleStart);
        this.canvas.addEventListener('mousemove', handleMove);
        this.canvas.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('mouseleave', handleEnd);

        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            handleStart(e);
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            handleMove(e);
        }, { passive: false });

        this.canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            handleEnd(e);
        }, { passive: false });

        // Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('btn-build').addEventListener('click', () => this.toggleBuildMode());

        // Upgrade Buttons
        document.querySelectorAll('.upgrade-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const type = e.target.dataset.type;
                this.buyUpgrade(type);
            });
        });
    }

    start() {
        this.playing = true;
        this.prepareWave();
        requestAnimationFrame((t) => this.loop(t));
    }

    startGame() {
        if (this.gameStarted) return; // Prevent multiple starts

        this.gameStarted = true;
        document.getElementById('start-screen').classList.add('hidden');
        this.start();
    }

    restart() {
        this.wave = 1;
        this.life = 50;
        this.gold = 400; // Reset to 400
        this.silver = 0;
        this.enemies = [];
        this.towers = [];
        this.projectiles = [];
        this.upgrades = [1, 1, 1, 1, 1];
        this.gameOver = false;
        this.gameStarted = true;

        document.getElementById('game-overlay').classList.add('hidden');
        document.getElementById('start-screen').classList.add('hidden');
        this.updateUI();
        this.start();
    }

    prepareWave() {
        this.enemiesToSpawn = this.waveTotalEnemies + (this.wave * 2);
        this.waveEnemiesSpawned = 0;
        this.waveTimer = 2000; // 2s break between waves
    }

    toggleBuildMode() {
        if (this.gameOver) return;
        this.buildMode = !this.buildMode;
        const btn = document.getElementById('btn-build');
        if (this.buildMode) {
            btn.classList.add('active');
            btn.innerHTML = '<span class="icon">❌</span> CANCEL';
        } else {
            btn.classList.remove('active');
            btn.innerHTML = '<span class="icon">⚡</span> SUMMON UNIT <span class="cost">100 G</span>';
        }
    }

    buyUpgrade(typeStr) {
        // Map string type to tier index
        const typeMap = { 'common': 0, 'magic': 1, 'rare': 2, 'unique': 3, 'epic': 4 };
        const tier = typeMap[typeStr];

        // Cost formula (example)
        const cost = 100 * Math.pow(2, tier);

        // Here we use Silver for upgrades as per plan
        if (this.silver >= cost) {
            this.silver -= cost;
            this.upgrades[tier] += 0.5; // 50% damage boost
            this.updateUI();
            console.log(`Upgraded ${typeStr} to x${this.upgrades[tier]}`);
        } else {
            console.log("Not enough silver!");
        }
    }

    handleDragStart(x, y) {
        // Check if clicking on grid
        if (x < MAP_OFFSET_X || y < MAP_OFFSET_Y) return;

        const c = Math.floor((x - MAP_OFFSET_X) / GRID_SIZE);
        const r = Math.floor((y - MAP_OFFSET_Y) / GRID_SIZE);

        if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) {
            if (this.buildMode) {
                // In build mode, just place a tower
                this.tryBuildTower(r, c);
            } else {
                // Try to select a tower for dragging
                const tower = this.towers.find(t => t.r === r && t.c === c);
                if (tower) {
                    this.isDragging = true;
                    this.draggedTower = tower;
                    this.dragStartPos = { r, c, x, y };
                }
            }
        }
    }

    handleDragMove(x, y) {
        if (!this.isDragging || !this.draggedTower) return;

        // Update drag position for visual feedback
        this.dragStartPos.x = x;
        this.dragStartPos.y = y;
    }

    handleDragEnd() {
        if (!this.isDragging || !this.draggedTower) return;

        const x = this.dragStartPos.x;
        const y = this.dragStartPos.y;

        // Get grid position
        if (x < MAP_OFFSET_X || y < MAP_OFFSET_Y) {
            // Dropped outside grid - cancel
            this.isDragging = false;
            this.draggedTower = null;
            this.dragStartPos = null;
            return;
        }

        const c = Math.floor((x - MAP_OFFSET_X) / GRID_SIZE);
        const r = Math.floor((y - MAP_OFFSET_Y) / GRID_SIZE);

        if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) {
            // Check if there's a tower at drop location
            const targetTower = this.towers.find(t => t.r === r && t.c === c && t !== this.draggedTower);

            if (targetTower) {
                // Try to merge towers
                this.tryMergeTowers(this.draggedTower, targetTower);
            } else {
                // Move tower to new position
                this.draggedTower.r = r;
                this.draggedTower.c = c;
            }
        }

        // Reset drag state
        this.isDragging = false;
        this.draggedTower = null;
        this.dragStartPos = null;
    }

    tryMergeTowers(tower1, tower2) {
        // Can only merge same type and same tier
        if (tower1.type !== tower2.type) {
            console.log("Cannot merge different tower types!");
            return;
        }

        if (tower1.tier !== tower2.tier) {
            console.log("Cannot merge different tower tiers!");
            return;
        }

        if (tower1.tier >= 4) {
            console.log("Cannot merge max tier towers!");
            return;
        }

        // Merge successful!
        const newTier = tower1.tier + 1;
        const keepTower = tower2;  // Keep the target tower location
        const removeTower = tower1; // Remove the dragged tower

        // Upgrade the kept tower
        keepTower.tier = newTier;
        keepTower.updateStats();

        // Remove the merged tower
        const index = this.towers.indexOf(removeTower);
        if (index > -1) {
            this.towers.splice(index, 1);
        }

        console.log(`Merged to ${TIERS[newTier].name} tier!`);
    }

    tryBuildTower(r, c) {
        // Check if occupied
        if (this.towers.some(t => t.r === r && t.c === c)) {
            console.log("Spot occupied!");
            return;
        }

        const cost = 100;
        if (this.gold >= cost) {
            this.gold -= cost;
            // Random tower logic
            const type = Math.floor(Math.random() * Object.keys(TOWER_TYPES).length);
            // Tier 0 (Common)
            this.towers.push(new Tower(0, type, r, c));

            this.updateUI();
            this.toggleBuildMode(); // Exit build mode after placing
        } else {
            console.log("Not enough gold!");
        }
    }

    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        if (this.playing && !this.gameOver) {
            this.update(dt);
            this.draw();
        }

        requestAnimationFrame((t) => this.loop(t));
    }

    update(dt) {
        // Wave Management
        if (this.enemiesToSpawn > 0) {
            if (this.waveTimer > 0) {
                this.waveTimer -= dt;
            } else {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    const isBoss = (this.wave % 5 === 0) && (this.waveEnemiesSpawned === this.enemiesToSpawn - 1);
                    this.enemies.push(new Enemy(this.wave, isBoss));
                    this.enemiesToSpawn--;
                    this.waveEnemiesSpawned++;
                    this.spawnTimer = 1000; // 1s between enemies
                }
            }
        } else if (this.enemies.length === 0) {
            // Wave Complete
            this.wave++;
            if (this.wave > 30) {
                this.triggerGameOver(true);
            } else {
                this.prepareWave();
                this.updateUI();
            }
        }

        // Update Entities
        // Enemies - dt is in milliseconds
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];

            // Check if enemy died and remove it
            if (!e.active) {
                this.enemies.splice(i, 1);
                continue;
            }

            const result = e.update(dt);
            if (result === 'leak') {
                this.life--;
                this.enemies.splice(i, 1);
                this.updateUI();
                if (this.life <= 0) this.triggerGameOver(false);
            }
        }

        // Towers - use this.lastTime for tower timing
        this.towers.forEach(t => t.update(this.lastTime, this.enemies, this.projectiles));

        // Projectiles - dt is in milliseconds
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.update(dt);
            if (!p.active) {
                this.projectiles.splice(i, 1);
            }
        }

        this.updateUI(); // Keep UI synced
    }

    onEnemyKilled(enemy) {
        // Boss gives 10x resources
        const baseGold = 10;
        const baseSilver = 1;
        const multiplier = enemy.isBoss ? 10 : 1;

        this.gold += baseGold * multiplier;
        this.silver += baseSilver * multiplier;
        this.updateUI();
    }

    triggerGameOver(win) {
        this.gameOver = true;
        const overlay = document.getElementById('game-overlay');
        const title = document.getElementById('overlay-title');
        title.textContent = win ? "VICTORY!" : "GAME OVER";
        title.style.color = win ? "#00ff00" : "#ff0000";
        overlay.classList.remove('hidden');
    }

    draw() {
        // Clear
        this.ctx.fillStyle = '#050510';
        this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

        // Draw Grid
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        for (let r = 0; r <= GRID_ROWS; r++) {
            this.ctx.beginPath();
            this.ctx.moveTo(MAP_OFFSET_X, MAP_OFFSET_Y + r * GRID_SIZE);
            this.ctx.lineTo(MAP_OFFSET_X + GRID_COLS * GRID_SIZE, MAP_OFFSET_Y + r * GRID_SIZE);
            this.ctx.stroke();
        }
        for (let c = 0; c <= GRID_COLS; c++) {
            this.ctx.beginPath();
            this.ctx.moveTo(MAP_OFFSET_X + c * GRID_SIZE, MAP_OFFSET_Y);
            this.ctx.lineTo(MAP_OFFSET_X + c * GRID_SIZE, MAP_OFFSET_Y + GRID_ROWS * GRID_SIZE);
            this.ctx.stroke();
        }

        // Draw Path
        this.ctx.strokeStyle = '#444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        if (PATH_WAYPOINTS.length > 0) {
            this.ctx.moveTo(PATH_WAYPOINTS[0].x, PATH_WAYPOINTS[0].y);
            for (let i = 1; i < PATH_WAYPOINTS.length; i++) {
                this.ctx.lineTo(PATH_WAYPOINTS[i].x, PATH_WAYPOINTS[i].y);
            }
        }
        this.ctx.stroke();

        // Draw Towers
        this.towers.forEach(t => {
            const x = MAP_OFFSET_X + t.c * GRID_SIZE;
            const y = MAP_OFFSET_Y + t.r * GRID_SIZE;

            // Don't draw the tower normally if it's being dragged
            if (this.isDragging && t === this.draggedTower) {
                return;
            }

            t.draw(this.ctx, x, y);
        });

        // Draw Enemies
        this.enemies.forEach(e => e.draw(this.ctx));

        // Draw Projectiles
        this.projectiles.forEach(p => p.draw(this.ctx));

        // Draw Build Mode Highlight
        if (this.buildMode) {
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            this.ctx.fillRect(MAP_OFFSET_X, MAP_OFFSET_Y, GRID_COLS * GRID_SIZE, GRID_ROWS * GRID_SIZE);

            this.ctx.strokeStyle = '#00ff00';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(MAP_OFFSET_X - 2, MAP_OFFSET_Y - 2, GRID_COLS * GRID_SIZE + 4, GRID_ROWS * GRID_SIZE + 4);
        }

        // Draw Dragged Tower
        if (this.isDragging && this.draggedTower && this.dragStartPos) {
            const x = this.dragStartPos.x;
            const y = this.dragStartPos.y;

            // Draw tower at cursor position with transparency
            this.ctx.globalAlpha = 0.7;

            // Calculate grid position for drop target highlight
            if (x >= MAP_OFFSET_X && y >= MAP_OFFSET_Y) {
                const c = Math.floor((x - MAP_OFFSET_X) / GRID_SIZE);
                const r = Math.floor((y - MAP_OFFSET_Y) / GRID_SIZE);

                if (c >= 0 && c < GRID_COLS && r >= 0 && r < GRID_ROWS) {
                    const targetTower = this.towers.find(t => t.r === r && t.c === c && t !== this.draggedTower);

                    // Highlight drop target
                    const gridX = MAP_OFFSET_X + c * GRID_SIZE;
                    const gridY = MAP_OFFSET_Y + r * GRID_SIZE;

                    if (targetTower) {
                        // Check if merge is possible
                        const canMerge = targetTower.type === this.draggedTower.type &&
                            targetTower.tier === this.draggedTower.tier &&
                            targetTower.tier < 4;

                        this.ctx.strokeStyle = canMerge ? '#00ff00' : '#ff0000';
                        this.ctx.lineWidth = 3;
                        this.ctx.strokeRect(gridX + 2, gridY + 2, GRID_SIZE - 4, GRID_SIZE - 4);
                    } else {
                        // Valid empty spot
                        this.ctx.strokeStyle = '#00ff00';
                        this.ctx.lineWidth = 3;
                        this.ctx.strokeRect(gridX + 2, gridY + 2, GRID_SIZE - 4, GRID_SIZE - 4);
                    }
                }

                // Draw tower centered at cursor
                this.draggedTower.draw(this.ctx, x - GRID_SIZE / 2, y - GRID_SIZE / 2);
            }

            this.ctx.globalAlpha = 1.0;
        }
    }

    updateUI() {
        document.getElementById('wave-display').textContent = this.wave;
        document.getElementById('enemy-count-display').textContent = this.enemies.length;
        document.getElementById('life-display').textContent = this.life;
        document.getElementById('gold-display').textContent = this.gold;
        document.getElementById('silver-display').textContent = this.silver;
    }
}
