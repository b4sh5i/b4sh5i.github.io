// Game Configuration
const CANVAS_WIDTH = 800;
const CANVAS_HEIGHT = 600;
const FPS = 60;

// Grid
const GRID_SIZE = 60;
const GRID_ROWS = 6;
const GRID_COLS = 6;
const MAP_OFFSET_Y = 100;
const MAP_OFFSET_X = 220;

// Tiers
const TIERS = {
    0: { name: 'Normal', color: '#ffffff' },
    1: { name: 'Magic', color: '#00f3ff' },
    2: { name: 'Rare', color: '#fcee0a' },
    3: { name: 'Unique', color: '#ff00ff' },
    4: { name: 'Epic', color: '#ff3131' }
};

// Tower Types
const TOWER_TYPES = {
    0: { name: 'Assault', range: 120, cooldown: 800, damage: 10, color: '#e74c3c' },
    1: { name: 'Sniper', range: 300, cooldown: 2000, damage: 50, color: '#f1c40f' },
    2: { name: 'Cannon', range: 150, cooldown: 1500, damage: 30, splash: 50, color: '#2ecc71' },
    3: { name: 'Rapid', range: 100, cooldown: 200, damage: 3, color: '#3498db' },
    4: { name: 'Slow', range: 130, cooldown: 1000, damage: 5, slow: 0.3, color: '#9b59b6' },
    5: { name: 'Bomb', range: 120, cooldown: 2000, damage: 80, splash: 30, color: '#34495e' },
    6: { name: 'Laser', range: 180, cooldown: 50, damage: 1, color: '#1abc9c' },
    7: { name: 'Chaos', range: 140, cooldown: 1000, damage: 20, random: true, color: '#e67e22' }
};

// Path
const PATH_WAYPOINTS = [
    { x: MAP_OFFSET_X - 60, y: MAP_OFFSET_Y - 60 }, // Start
    { x: MAP_OFFSET_X + (GRID_COLS * GRID_SIZE) + 60, y: MAP_OFFSET_Y - 60 },
    { x: MAP_OFFSET_X + (GRID_COLS * GRID_SIZE) + 60, y: MAP_OFFSET_Y + (GRID_ROWS * GRID_SIZE) + 60 },
    { x: MAP_OFFSET_X - 60, y: MAP_OFFSET_Y + (GRID_ROWS * GRID_SIZE) + 60 },
    { x: MAP_OFFSET_X - 60, y: MAP_OFFSET_Y - 60 }  // End/Loop
];
