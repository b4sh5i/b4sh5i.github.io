// ===== Utility Functions =====

// Vector math
function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}

function angle(x1, y1, x2, y2) {
    return Math.atan2(y2 - y1, x2 - x1);
}

// Collision detection
function circleCollision(x1, y1, r1, x2, y2, r2) {
    return distance(x1, y1, x2, y2) < r1 + r2;
}

function rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
    const testX = Math.max(rx, Math.min(cx, rx + rw));
    const testY = Math.max(ry, Math.min(cy, ry + rh));
    return distance(cx, cy, testX, testY) < cr;
}

// Random utilities
function random(min, max) {
    return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

// Clamp value
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

// Lerp (linear interpolation)
function lerp(start, end, t) {
    return start + (end - start) * t;
}
