// Get the canvas element and its 2D rendering context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set canvas dimensions
canvas.width = 800;
canvas.height = 600;

// Game variables (initial placeholders)
let player = {
    x: 50,
    y: canvas.height - 100, // Start player near the bottom
    width: 30,
    height: 50,
    color: 'blue',
    dx: 0, // Change in x (velocity)
    dy: 0, // Change in y (velocity)
    speed: 5,
    jumpStrength: 15,
    isJumping: false,
    grounded: true
};

const gravity = 1;
const friction = 0.8; // Friction/damping for horizontal movement

// Basic platform (an array to hold multiple platforms later)
let platforms = [
    { x: 0, y: canvas.height - 50, width: canvas.width, height: 20, color: 'green' } // A simple ground platform
];

// Input handling (event listeners for keyboard input)
const keys = {
    left: false,
    right: false,
    up: false
};

window.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowLeft' || e.key === 'a') {
        keys.left = true;
    }
    if (e.key === 'ArrowRight' || e.key === 'd') {
        keys.right = true;
    }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') {
        keys.up = true;
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
    // Player movement logic (will be expanded)
    if (keys.left) {
        player.dx = -player.speed;
    } else if (keys.right) {
        player.dx = player.speed;
    } else {
        player.dx *= friction; // Apply friction if no horizontal input
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
        player.dy = 0; // Stop vertical movement if grounded
    }
    
    // Update player position
    player.x += player.dx;
    player.y += player.dy;

    // Collision detection with canvas boundaries (simple)
    // Left boundary
    if (player.x < 0) {
        player.x = 0;
        player.dx = 0;
    }
    // Right boundary
    if (player.x + player.width > canvas.width) {
        player.x = canvas.width - player.width;
        player.dx = 0;
    }
    // Top boundary (prevent sticking to ceiling if jumping too high)
    if (player.y < 0) {
        player.y = 0;
        player.dy = 0;
    }

    // Ground collision (with the main platform for now)
    player.grounded = false; // Assume not grounded until a collision is detected
    platforms.forEach(platform => {
        if (
            player.x < platform.x + platform.width &&
            player.x + player.width > platform.x &&
            player.y + player.height < platform.y + platform.height && // Check if above platform top
            player.y + player.height + player.dy >= platform.y // Check if will intersect or pass platform top in next frame
        ) {
            player.y = platform.y - player.height;
            player.grounded = true;
            player.isJumping = false;
            player.dy = 0;
        }
    });
    
    // Fall off screen (simple reset)
    if (player.y + player.height > canvas.height) {
        // For now, let's just reset to starting position if player falls off the initial platform
        // Later, this could be a game over or level reset
         if (platforms.length === 1 && player.y > platforms[0].y + platforms[0].height + 50) { // only if fallen below the initial ground
            player.x = 50;
            player.y = canvas.height - 100;
            player.dx = 0;
            player.dy = 0;
            player.isJumping = false;
            player.grounded = true;
        }
    }
}

function draw() {
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw player
    ctx.fillStyle = player.color;
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Draw platforms
    platforms.forEach(platform => {
        ctx.fillStyle = platform.color;
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop); // Call gameLoop again for the next frame
}

// Start the game loop
gameLoop();
