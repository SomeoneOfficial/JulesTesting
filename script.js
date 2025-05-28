// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

// Near other global game variables
let gameMode = 'play'; // 'play' or 'edit'
let selectedBlockType = 'ground'; // In the future, this could change via UI
const TILE_SIZE = 40; // Define a grid tile size for block placement

// Near the top of script.js, after canvas setup
const camera = {
    x: 0,
    y: 0,
    // Optional: Add dead zone or smoothing later if needed
    deadZoneX: canvas.width / 4 // Player can move this much before camera moves
};

// Game variables (initial placeholders)
let player = {
    x: 50,
    y: canvas.height - 100, // Start player near the bottom
    width: 30,
    height: 50,
    // color: 'blue', // We might replace this or use it as a fallback
    dx: 0, // Change in x (velocity)
    dy: 0, // Change in y (velocity)
    speed: 5,
    jumpStrength: 15,
    isJumping: false,
    grounded: true,
    animationState: 'idle', // 'idle', 'run', 'jump'
    currentFrame: 0,
    animationFrameCount: { // Number of frames for each placeholder animation
        idle: 1,
        run: 2, // e.g., two alternating "frames" for running
        jump: 1
    },
    animationTimer: 0,
    animationSpeed: 10, // Higher number = slower animation (update every X game loops)
    
    // Placeholder appearances (colors for now, could be different sizes too)
    appearances: {
        idle: { color: 'blue' },
        run: [ // Array for multiple frames
            { color: 'lightblue' },
            { color: 'cornflowerblue' }
        ],
        jump: { color: 'royalblue' }
    }
};

const gravity = 1;
const friction = 0.8; // Friction/damping for horizontal movement

// Basic platform (an array to hold multiple platforms later)
let platforms = [
    {
        x: 0,
        y: canvas.height - 50,
        width: canvas.width * 2, // Ensure this width is for the scrollable ground
        height: 20,
        // The old 'color' property is removed or ignored
        appearance: {
            type: 'ground', // Example type
            color: 'green'  // Placeholder color, will be replaced by sprite details
            // Future sprite properties: image: null, sx: 0, sy: 0, sWidth: 0, sHeight: 0
        }
    }
    // Add more platforms here later with their own appearances
];

// Enemy Array and Creation
let enemies = [];

function createEnemy(x, y, width, height, movementType = 'patrol') {
    return {
        x: x,
        y: y,
        width: width,
        height: height,
        dx: 1, // Initial movement direction and speed
        speed: 1,
        movementType: movementType, // 'patrol', 'static', etc.
        originalX: x, // For patrol range
        patrolRange: 100, // How far to patrol from originalX
        isDefeated: false, // New property
        appearance: {
            color: 'red' // Placeholder color for enemies
            // Later: image: enemySpriteSheet, sx: 0, sy: 0, ...
        }
    };
}

// Initialize Enemies
// Ensure the y position places them on top of the main platform.
// The main platform is at canvas.height - 50, and is 20px high.
// So enemy y should be canvas.height - 50 (platform y) - enemy_height.
const enemyHeight = 30;
const enemyWidth = 30;
enemies.push(createEnemy(300, canvas.height - 50 - enemyHeight, enemyWidth, enemyHeight));
enemies.push(createEnemy(500, canvas.height - 50 - enemyHeight, enemyWidth, enemyHeight, 'patrol'));


// Input handling (event listeners for keyboard input)
const keys = {
    left: false,
    right: false,
    up: false
};

// --- Level Save/Load Functions ---
function saveLevel() {
    if (gameMode !== 'edit') {
        console.log("Can only save in edit mode.");
        // alert("Can only save in edit mode."); // Optional: user-facing alert
        return;
    }
    try {
        // For now, saving all platforms. If platforms[0] is special and shouldn't be
        // part of user-saved levels, it should be filtered out or handled separately.
        const levelData = platforms.map(p => ({
            x: p.x,
            y: p.y,
            width: p.width, // Save width/height to allow for different block types later
            height: p.height,
            appearance: { // Save appearance info
                type: p.appearance.type,
                color: p.appearance.color // Or sprite identifiers later
            }
        }));
        localStorage.setItem('platformerLevel', JSON.stringify(levelData));
        console.log('Level saved to Local Storage!');
        alert('Level Saved!');
    } catch (error) {
        console.error('Error saving level:', error);
        alert('Error saving level. See console for details.');
    }
}

function loadLevel() {
    // gameMode check is handled by the keydown listener
    try {
        const savedLevelData = localStorage.getItem('platformerLevel');
        if (savedLevelData) {
            const loadedPlatforms = JSON.parse(savedLevelData);
            if (Array.isArray(loadedPlatforms)) {
                platforms = loadedPlatforms.map(p => ({
                    ...p, 
                }));
                console.log('Level loaded from Local Storage!');
                alert('Level Loaded!');
            } else {
                console.log('No valid level data found in Local Storage.');
                alert('No valid level data found.');
            }
        } else {
            console.log('No saved level found in Local Storage.');
            alert('No saved level found.');
        }
    } catch (error) {
        console.error('Error loading level:', error);
        alert('Error loading level. See console for details.');
    }
}

window.addEventListener('keydown', function(e) {
    // Player movement keys (only active in 'play' mode)
    if (gameMode === 'play') {
        if (e.key === 'ArrowLeft' || e.key === 'a') {
            keys.left = true;
        }
        if (e.key === 'ArrowRight' || e.key === 'd') {
            keys.right = true;
        }
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
            keys.up = true;
        }
    }

    // Mode toggle and editor-specific keys
    if (e.key === '0') { // '0' key for editor toggle
        if (gameMode === 'play') {
            gameMode = 'edit';
            console.log('Switched to Edit Mode');
        } else {
            gameMode = 'play';
            console.log('Switched to Play Mode');
        }
    } else if (gameMode === 'edit') { // Keys specific to editor mode
        if (e.key === 's' || e.key === 'S') {
            saveLevel();
        } else if (e.key === 'l' || e.key === 'L') {
            loadLevel();
        }
    }
});

// In the input handling section
canvas.addEventListener('click', function(event) {
    if (gameMode === 'edit') {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        // Convert screen coordinates to world coordinates (considering camera)
        const worldX = mouseX + camera.x;
        const worldY = mouseY + camera.y; // Assuming camera.y is 0 for now or relevant

        // Snap to grid
        const gridX = Math.floor(worldX / TILE_SIZE) * TILE_SIZE;
        const gridY = Math.floor(worldY / TILE_SIZE) * TILE_SIZE;

        // Check if a block already exists at this grid location
        let blockExists = false;
        let existingBlockIndex = -1;
        for (let i = 0; i < platforms.length; i++) {
            if (platforms[i].x === gridX && platforms[i].y === gridY && platforms[i].width === TILE_SIZE && platforms[i].height === TILE_SIZE) {
                blockExists = true;
                existingBlockIndex = i;
                break;
            }
        }

        if (blockExists) {
            platforms.splice(existingBlockIndex, 1);
            console.log(`Block removed at ${gridX}, ${gridY}`);
        } else {
            const mainGround = platforms[0];
            if (gridX < mainGround.x + mainGround.width &&
                gridX + TILE_SIZE > mainGround.x &&
                gridY < mainGround.y + mainGround.height &&
                gridY + TILE_SIZE > mainGround.y &&
                platforms.length > 0 && platforms[0].width !== TILE_SIZE 
                ) {
                console.log(`Cannot place block: overlaps with main ground at ${gridX}, ${gridY}`);
                return; 
            }

            const newPlatform = {
                x: gridX,
                y: gridY,
                width: TILE_SIZE,
                height: TILE_SIZE,
                appearance: { 
                    type: selectedBlockType, 
                    color: 'saddlebrown' 
                }
            };
            platforms.push(newPlatform);
            console.log(`Block added at ${gridX}, ${gridY} of type ${selectedBlockType}`);
        }
    }
});


window.addEventListener('keyup', function(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = false;
    }
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = false;
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        keys.up = false;
    }
});

// Game loop functions
function update() {
    if (gameMode === 'play') {
        // Player movement logic
        if (keys.left) {
            player.dx = -player.speed;
        } else if (keys.right) {
            player.dx = player.speed;
        } else {
            player.dx *= friction; 
        }

        // Jumping logic
        if (keys.up && player.grounded && !player.isJumping) {
            player.dy = -player.jumpStrength;
            player.isJumping = true;
            player.grounded = false;
        }

        // Apply gravity
        if (!player.grounded) {
            player.dy += gravity;
        } else {
            player.dy = 0; 
        }
        
        // Update player position
        player.x += player.dx;
        player.y += player.dy;

        // Determine animation state
        if (!player.grounded) {
            player.animationState = 'jump';
        } else if (Math.abs(player.dx) > 0.1) { 
            player.animationState = 'run';
        } else {
            player.animationState = 'idle';
        }

        // Animation frame cycling
        player.animationTimer++;
        if (player.animationTimer > player.animationSpeed) {
            player.animationTimer = 0;
            player.currentFrame++;
            const currentAnimationFrames = player.animationFrameCount[player.animationState];
            if (player.currentFrame >= currentAnimationFrames) {
                player.currentFrame = 0;
            }
        }

        // Camera follow player (horizontal)
        const playerCenterX = player.x + player.width / 2;
        if (playerCenterX > camera.x + canvas.width - camera.deadZoneX) {
            camera.x = playerCenterX - (canvas.width - camera.deadZoneX);
        }
        else if (playerCenterX < camera.x + camera.deadZoneX) {
            camera.x = playerCenterX - camera.deadZoneX;
        }

        const levelWidth = canvas.width * 2; 
        if (camera.x < 0) {
            camera.x = 0;
        }
        if (camera.x + canvas.width > levelWidth) {
            // camera.x = levelWidth - canvas.width; 
        }

        // Collision detection with canvas boundaries
        if (player.x < 0) {
            player.x = 0;
            player.dx = 0;
        }
        if (player.x + player.width > canvas.width && camera.x + canvas.width >= levelWidth) { // Stop at edge of level, not just canvas if camera is at end
             player.x = levelWidth - player.width; // this was canvas.width - player.width;
             player.dx = 0;
        } else if (player.x + player.width > canvas.width && camera.x + canvas.width < levelWidth) {
             // this is the case where player is at edge of screen but not edge of level
        }


        if (player.y < 0) {
            player.y = 0;
            player.dy = 0;
        }

        // Ground collision
        player.grounded = false; 
        platforms.forEach(platform => {
            if (
                player.x < platform.x + platform.width &&
                player.x + player.width > platform.x &&
                player.y + player.height < platform.y + platform.height && 
                player.y + player.height + player.dy >= platform.y 
            ) {
                player.y = platform.y - player.height;
                player.grounded = true;
                player.isJumping = false;
                player.dy = 0;
            }
        });
        
        // Update enemies
        enemies.forEach(enemy => {
            if (enemy.movementType === 'patrol') {
                enemy.x += enemy.dx * enemy.speed;
                const platformToCheck = platforms[0]; 
                if (enemy.x > enemy.originalX + enemy.patrolRange || enemy.x < enemy.originalX - enemy.patrolRange) {
                    enemy.dx *= -1; 
                }
                if (platformToCheck) {
                    if (enemy.x < platformToCheck.x || enemy.x + enemy.width > platformToCheck.x + platformToCheck.width) {
                        enemy.dx *= -1; 
                        if (enemy.x < platformToCheck.x) {
                            enemy.x = platformToCheck.x;
                        }
                        if (enemy.x + enemy.width > platformToCheck.x + platformToCheck.width) {
                            enemy.x = platformToCheck.x + platformToCheck.width - enemy.width;
                        }
                    }
                }
            }
        });

        // Player-Enemy collision detection
        enemies.forEach((enemy, index) => {
            if (!enemy.isDefeated) { 
                if (
                    player.x < enemy.x + enemy.width &&
                    player.x + player.width > enemy.x &&
                    player.y < enemy.y + enemy.height &&
                    player.y + player.height > enemy.y
                ) {
                    const playerBottom = player.y + player.height;
                    const enemyTop = enemy.y;
                    if (player.dy > 0 &&
                        playerBottom > enemyTop && 
                        playerBottom < enemyTop + enemy.height / 2 
                       ) {
                        enemy.isDefeated = true; 
                        player.dy = -player.jumpStrength / 2; 
                        console.log('Enemy stomped!');
                    } else {
                        console.log('Player hit by enemy!');
                        player.x = 50;
                        player.y = canvas.height - 100;
                        player.dx = 0;
                        player.dy = 0;
                        player.isJumping = false;
                        player.grounded = true; 
                    }
                }
            }
        });

        enemies = enemies.filter(enemy => !enemy.isDefeated);

        // Fall off screen
        if (player.y + player.height > canvas.height) {
             if (platforms.length === 1 && player.y > platforms[0].y + platforms[0].height + 50) { 
                player.x = 50;
                player.y = canvas.height - 100;
                player.dx = 0;
                player.dy = 0;
                player.isJumping = false;
                player.grounded = true;
            } else if (platforms.length > 1 && player.y > canvas.height + 200) { // Fall off custom level
                player.x = 50; // Or some other default start for loaded levels
                player.y = canvas.height - 100;
                player.dx = 0;
                player.dy = 0;
                player.isJumping = false;
                player.grounded = true; // This might need to be smarter if start has no ground
            }
        }
    } else if (gameMode === 'edit') {
        // Editor mode updates (e.g., camera panning with arrow keys might be useful)
        // For now, camera only moves in play mode.
    }
}

function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save the current context state
    ctx.save();

    // Translate the context to simulate camera movement
    ctx.translate(-camera.x, -camera.y);

    // --- Draw all game objects relative to the camera ---

    if (gameMode === 'edit') {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)'; 
        ctx.lineWidth = 1;
        
        const visibleLeft = camera.x;
        const visibleTop = camera.y; 
        const visibleRight = camera.x + canvas.width;
        const visibleBottom = camera.y + canvas.height;

        const gridStartX = Math.floor(visibleLeft / TILE_SIZE) * TILE_SIZE;
        const gridStartY = Math.floor(visibleTop / TILE_SIZE) * TILE_SIZE;

        for (let x = gridStartX; x < visibleRight; x += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(x, visibleTop); 
            ctx.lineTo(x, visibleBottom);
            ctx.stroke();
        }
        for (let y = gridStartY; y < visibleBottom; y += TILE_SIZE) {
            ctx.beginPath();
            ctx.moveTo(visibleLeft, y); 
            ctx.lineTo(visibleRight, y);
            ctx.stroke();
        }
    }

    // Draw player
    let appearance;
    const stateAppearance = player.appearances[player.animationState];
    if (player.animationState === 'run') {
        appearance = stateAppearance[player.currentFrame];
    } else { 
        appearance = stateAppearance;
    }
    ctx.fillStyle = appearance.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw platforms
    platforms.forEach(platform => {
        ctx.fillStyle = platform.appearance.color; 
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });

    // Draw enemies
    enemies.forEach(enemy => {
        ctx.fillStyle = enemy.appearance.color;
        ctx.fillRect(enemy.x, enemy.y, enemy.width, enemy.height);
    });
    
    // --- End of drawing game objects ---

    // Restore the context to its original state
    ctx.restore();

    // UI elements that should not scroll
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.textAlign = 'left';
    if (gameMode === 'edit') {
        ctx.fillText('Edit Mode - 0:Play | S:Save | L:Load', 10, 20);
    } else {
        ctx.fillText('Play Mode - Press 0 to Edit', 10, 20);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop); 
}

// Start the game loop
gameLoop();
