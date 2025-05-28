// game.js

let scene, camera, renderer;
let groundPlane;

// Camera settings
const cameraOffset = new THREE.Vector3(0, 4, 7); 
const cameraSmoothnessFactor = 0.05; 

let player = {
    mesh: null,
    width: 1, height: 2, depth: 1, 
    x: 0, y: 0, z: 0,             
    dx: 0, dy: 0, dz: 0,           
    speed: 6,                     
    strafeSpeed: 5,               
    jumpStrength: 8, 
    gravity: 20,                  
    grounded: false,
    isJumping: false, 
    isBlocking: false, 
    hasShield: false,      
    shieldActive: false,   
    shieldMesh: null, 
    gunUpgradeLevel: 0,     
    hasGoldShield: false,   
    goldShieldActive: false 
};

let gun = {
    mesh: null,
    offsetX: 0.3, 
    offsetY: -0.1, 
    offsetZ: 0.5  
};

const keys = {
    w: false, a: false, s: false, d: false,
    space: false 
};

let clock; 

// Laser properties
let lasers = [];
const BASE_LASER_SPEED = 40; 
let currentLaserSpeed = BASE_LASER_SPEED; 
const LASER_LIFETIME = 2; 
const playerLaserMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff }); 
const powerfulLaserMaterial = new THREE.MeshBasicMaterial({ color: 0xffaa00, emissive: 0xffaa00 }); 
const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); 
laserGeometry.rotateX(Math.PI / 2);

// Enemy Laser properties
let enemyLasers = [];
const ENEMY_LASER_SPEED = 25; 
const ENEMY_LASER_LIFETIME = 3; 
const enemyLaserMaterial = new THREE.MeshBasicMaterial({ color: 0xff8800, emissive: 0xff8800 }); 
const enemyPiercingLaserMaterial = new THREE.MeshBasicMaterial({ color: 0xff00ff, emissive: 0xff00ff }); 

// Shield Materials
const shieldMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ccff, transparent: true, opacity: 0.3, side: THREE.DoubleSide
});
const goldShieldMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffd700, transparent: true, opacity: 0.4, side: THREE.DoubleSide
});


// Enemy properties
let enemies = [];
const ENEMY_SIZE = 1.5; 
const enemyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); 
const enemyMouthMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); 
const enemyMaterialsArray = [ 
    enemyBodyMaterial, enemyBodyMaterial, enemyBodyMaterial, 
    enemyBodyMaterial, enemyMouthMaterial, enemyBodyMaterial
];
const enemyGeometryShared = new THREE.BoxGeometry(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE); 

// Game State & Level Control
let isGameOver = false;
let currentLevel = 1; 
let levelState = 'not_started'; 
let levelTimer = 0; 
let lastSpawnTime = 0;
const LEVEL1_DURATION = 19; 
const LEVEL3_UPGRADE_DELAY = 5; 
const ENEMY_SPAWN_INTERVAL = 2.5; 
let maxActiveEnemies = 4; 
const spawnPoints = [ 
    new THREE.Vector3(-10, ENEMY_SIZE / 2, -15), new THREE.Vector3(10, ENEMY_SIZE / 2, -15),
    new THREE.Vector3(0, ENEMY_SIZE / 2, -20), new THREE.Vector3(-15, ENEMY_SIZE / 2, 0),
    new THREE.Vector3(15, ENEMY_SIZE / 2, 0)
];

// Player Reset Constants
const PLAYER_RESET_X = 0;
const PLAYER_RESET_Y_OFFSET = player.height / 2; 
const PLAYER_RESET_Z = 5;

// Status Message
let statusMessageTimeout = null;

// Placeholder Sound Function
function playSound(soundName) {
    console.log(`Sound: ${soundName}`); // Placeholder
    // Actual implementation would use THREE.AudioListener, THREE.Audio, THREE.AudioLoader, etc.
}

function showStatusMessage(message, type = 'info', duration = 3000) {
    const statusContainer = document.getElementById('statusMessageContainer');
    const statusTextElement = document.getElementById('statusMessageText');
    if (statusContainer && statusTextElement) {
        statusTextElement.innerText = message;
        statusContainer.className = 'statusMessageActive'; 
        if (type === 'success') statusContainer.classList.add('success');
        else if (type === 'error') statusContainer.classList.add('error');
        statusContainer.style.display = 'block';
        if (statusMessageTimeout) clearTimeout(statusMessageTimeout);
        statusMessageTimeout = setTimeout(() => {
            statusContainer.style.display = 'none'; statusMessageTimeout = null;
        }, duration);
    } else {
        console.warn("Status message elements not found. Falling back to console/alert.");
        if (type === 'error') console.error(message); else console.log(message);
        if (duration > 1000 && (type === 'success' || type === 'error')) alert(message);
    }
}

function checkAABBCollision(obj1, obj2) {
    const obj1MinX = obj1.x - obj1.width / 2; const obj1MaxX = obj1.x + obj1.width / 2;
    const obj1MinY = obj1.y - obj1.height / 2; const obj1MaxY = obj1.y + obj1.height / 2;
    const obj1MinZ = obj1.z - obj1.depth / 2; const obj1MaxZ = obj1.z + obj1.depth / 2;
    const obj2MinX = obj2.x - obj2.width / 2; const obj2MaxX = obj2.x + obj2.width / 2;
    const obj2MinY = obj2.y - obj2.height / 2; const obj2MaxY = obj2.y + obj2.height / 2;
    const obj2MinZ = obj2.z - obj2.depth / 2; const obj2MaxZ = obj2.z + obj2.depth / 2;
    return obj1MaxX > obj2MinX && obj1MinX < obj2MaxX &&
           obj1MaxY > obj2MinY && obj1MinY < obj2MaxY &&
           obj1MaxZ > obj2MinZ && obj1MinZ < obj2MaxZ;
}

function spawnEnemy(x, y, z, type = 'square_biter', baseSpeed = 1.25, patrolDist = 0, levelContext = 1) {
    const enemyMesh = new THREE.Mesh(enemyGeometryShared, enemyMaterialsArray); 
    enemyMesh.castShadow = true;
    enemyMesh.position.set(x, y, z);
    
    const enemyGunGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.4, 8);
    const enemyGunMaterial = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const enemyGunMesh = new THREE.Mesh(enemyGunGeometry, enemyGunMaterial);
    enemyGunMesh.position.set(0, 0, ENEMY_SIZE / 2 + 0.2); 
    enemyMesh.add(enemyGunMesh);

    let canShootThisEnemy = false;
    let isPiercingThisEnemy = false;

    if (levelContext === 2) { 
        canShootThisEnemy = true;
    } else if (levelContext === 3) { 
        canShootThisEnemy = true;
        isPiercingThisEnemy = true;
    }

    const enemy = {
        mesh: enemyMesh,
        gunMesh: enemyGunMesh, 
        x: x, y: y, z: z,
        width: ENEMY_SIZE, height: ENEMY_SIZE, depth: ENEMY_SIZE,
        type: type, 
        speed: baseSpeed,
        direction: 1, 
        patrolDistance: patrolDist,
        initialX: x, initialY: y, initialZ: z,
        canShoot: canShootThisEnemy,
        isPiercingShooter: isPiercingThisEnemy,
        shootCooldown: 3, 
        lastShotTime: 0,    
        shootRange: 25      
    };

    enemies.push(enemy);
    scene.add(enemyMesh);
    playSound('enemy_spawn');
    return enemy;
}

function startLevel(levelNumber) {
    isGameOver = false; 
    currentLevel = levelNumber;
    levelTimer = 0;
    lastSpawnTime = 0;
    
    enemies.forEach(enemy => { if (enemy.mesh) scene.remove(enemy.mesh); });
    enemies = []; 
    lasers.forEach(laser => scene.remove(laser));
    lasers = [];
    enemyLasers.forEach(eLaser => scene.remove(eLaser)); 
    enemyLasers = [];

    player.x = PLAYER_RESET_X; player.y = PLAYER_RESET_Y_OFFSET; player.z = PLAYER_RESET_Z;
    player.dx = 0; player.dy = 0; player.dz = 0;
    player.isJumping = false; player.grounded = true; 
    player.isBlocking = false; 
    if(player.mesh) player.mesh.position.set(player.x, player.y, player.z);
    
    player.hasShield = false; player.shieldActive = false;
    player.hasGoldShield = false; player.goldShieldActive = false;
    if(player.shieldMesh) {
        player.shieldMesh.material = shieldMaterial; 
        player.shieldMesh.visible = false;
    }
    player.gunUpgradeLevel = 0;
    currentLaserSpeed = BASE_LASER_SPEED; 

    const statusDisplay = document.getElementById('statusDisplay');
    if (statusDisplay) statusDisplay.style.display = 'none';

    playSound('level_start_level_' + levelNumber);
    // BGM: Start music for currentLevel, e.g., playMusic('level_' + currentLevel + '_bgm');


    if (currentLevel === 1) {
        levelState = 'running';
        console.log("Level 1 Started! Survive for " + LEVEL1_DURATION + " seconds.");
    } else if (currentLevel === 2) {
        levelState = 'running';
        console.log("Level 2 Started! Enemies can shoot.");
        spawnEnemy(0, ENEMY_SIZE / 2, -10, 'square_biter', 1.25, 0, 2);
    } else if (currentLevel === 3) { 
        levelState = 'running';
        console.log("Level 3 Started! Enemies shoot piercing lasers. Upgrade incoming...");
        spawnEnemy(0, ENEMY_SIZE / 2, -10, 'square_biter', 1.25, 0, 3);
    }
}


function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); 
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    document.body.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024; directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5; directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20; directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20; directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    const groundGeometry = new THREE.PlaneGeometry(100, 100); 
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2; 
    groundPlane.position.y = 0; 
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    clock = new THREE.Clock();

    const playerGeometry = new THREE.BoxGeometry(player.width, player.height, player.depth);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff }); 
    player.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    player.mesh.castShadow = true;
    scene.add(player.mesh); 

    const shieldGeometry = new THREE.SphereGeometry(player.width * 1.2, 32, 16); 
    player.shieldMesh = new THREE.Mesh(shieldGeometry, shieldMaterial); 
    player.shieldMesh.visible = false; 
    player.mesh.add(player.shieldMesh); 

    const gunGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8); 
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 }); 
    gun.mesh = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.mesh.position.set(gun.offsetX, gun.offsetY, gun.offsetZ); 
    player.mesh.add(gun.mesh); 

    if (player.mesh) {
        const initialCameraPos = player.mesh.position.clone().add(cameraOffset);
        camera.position.copy(initialCameraPos);
        const initialLookAt = player.mesh.position.clone();
        initialLookAt.y += player.height * 0.25;
        camera.lookAt(initialLookAt);
    } else { 
        camera.position.set(0, 5, 10); camera.lookAt(0,0,0);
    }

    window.addEventListener('keydown', (e) => {
        if (isGameOver) return; 
        switch (e.key.toLowerCase()) {
            case 'w': keys.w = true; break;
            case 'a': keys.a = true; break;
            case 's': keys.s = true; break;
            case 'd': keys.d = true; break;
            case ' ': 
                if (gameMode === 'play' && !isGameOver && player.grounded) {
                    player.isBlocking = true;
                    playSound('player_block_activate');
                }
                keys.space = true; 
                break;
        }
    });
    window.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w': keys.w = false; break;
            case 'a': keys.a = false; break;
            case 's': keys.s = false; break;
            case 'd': keys.d = false; break;
            case ' ': 
                if (gameMode === 'play' && !isGameOver) {
                    player.isBlocking = false;
                    // playSound('player_block_deactivate'); // Optional
                }
                keys.space = false;
                break;
        }
    });
    window.addEventListener('mousedown', (e) => {
       if (e.button === 0 && gameMode === 'play' && !isGameOver && !player.isBlocking) { 
           shootLaser();
       }
    });
    window.addEventListener('resize', onWindowResize, false);
    
    startLevel(1); 
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function shootLaser() {
    if (!player.mesh || !gun.mesh) return;
    
    let currentShotMaterial = playerLaserMaterial; 
    if (player.gunUpgradeLevel === 2) {
        currentShotMaterial = powerfulLaserMaterial;
        playSound('player_shoot_powerful');
    } else {
        playSound('player_shoot_normal');
    }
    const laser = new THREE.Mesh(laserGeometry, currentShotMaterial); 

    const gunWorldPosition = new THREE.Vector3();
    gun.mesh.getWorldPosition(gunWorldPosition);
    const gunWorldQuaternion = new THREE.Quaternion();
    gun.mesh.getWorldQuaternion(gunWorldQuaternion);
    laser.position.copy(gunWorldPosition);
    laser.quaternion.copy(gunWorldQuaternion); 
    const direction = new THREE.Vector3();
    player.mesh.getWorldDirection(direction); 
    laser.userData = { 
        velocity: direction.multiplyScalar(currentLaserSpeed), 
        spawnTime: clock.getElapsedTime()
    };
    lasers.push(laser);
    scene.add(laser);
}

function setupMobileControls() {
    const btnForward = document.getElementById('btnForward');
    const btnBackward = document.getElementById('btnBackward');
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    const btnJump = document.getElementById('btnJump'); 
    const btnShoot = document.getElementById('btnShoot'); 
    const btnBlock = document.getElementById('btnBlock'); 

    if (!btnForward || !btnBackward || !btnLeft || !btnRight) console.warn("Mobile movement buttons not found.");
    if (!btnJump) console.warn("Mobile jump button not found.");
    if (!btnShoot) console.warn("Mobile shoot button not found.");
    if (!btnBlock) console.warn("Mobile block button not found.");

    const setupKeyButtonEvents = (buttonElement, keyName) => { 
        if (!buttonElement) return; 
        buttonElement.addEventListener('touchstart', (e) => {
            e.preventDefault(); playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver) keys[keyName] = true;
        }, { passive: false });
        buttonElement.addEventListener('touchend', (e) => {
            e.preventDefault(); // playSound('ui_button_release'); // Can be noisy
            if (gameMode === 'play') keys[keyName] = false;
        }, { passive: false });
        buttonElement.addEventListener('mousedown', (e) => { playSound('ui_button_press'); if (gameMode === 'play' && !isGameOver) keys[keyName] = true; });
        buttonElement.addEventListener('mouseup', (e) => { /*playSound('ui_button_release');*/ if (gameMode === 'play') keys[keyName] = false; });
        buttonElement.addEventListener('mouseleave', (e) => { if (gameMode === 'play') keys[keyName] = false; });
        buttonElement.style.webkitUserSelect = 'none'; buttonElement.style.userSelect = 'none';
    };

    setupKeyButtonEvents(btnForward, 'w');
    setupKeyButtonEvents(btnBackward, 's');
    setupKeyButtonEvents(btnLeft, 'a');
    setupKeyButtonEvents(btnRight, 'd');
    
    if (btnJump) {
        btnJump.addEventListener('touchstart', (e) => {
            e.preventDefault(); playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && player.grounded && !player.isJumping) {
                player.dy = player.jumpStrength; player.isJumping = true; player.grounded = false;
                playSound('player_jump');
            }
        }, { passive: false });
        btnJump.addEventListener('mousedown', (e) => {
            playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && player.grounded && !player.isJumping) {
                player.dy = player.jumpStrength; player.isJumping = true; player.grounded = false;
                playSound('player_jump');
            }
        });
        btnJump.style.webkitUserSelect = 'none'; btnJump.style.userSelect = 'none';
    }

    if (btnShoot) {
        btnShoot.addEventListener('touchstart', (e) => {
            e.preventDefault(); playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && !player.isBlocking) shootLaser();
        }, { passive: false });
        btnShoot.addEventListener('mousedown', (e) => {
            playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && !player.isBlocking) shootLaser();
        });
        btnShoot.style.webkitUserSelect = 'none'; btnShoot.style.userSelect = 'none';
    }

    if (btnBlock) {
        btnBlock.addEventListener('touchstart', (e) => {
            e.preventDefault(); playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && player.grounded) {
                player.isBlocking = true; playSound('player_block_activate');
            }
        }, { passive: false });
        btnBlock.addEventListener('touchend', (e) => {
            e.preventDefault(); /*playSound('ui_button_release');*/
            if (gameMode === 'play' && !isGameOver) player.isBlocking = false;
        }, { passive: false });
        btnBlock.addEventListener('mousedown', (e) => {
            playSound('ui_button_press');
            if (gameMode === 'play' && !isGameOver && player.grounded) {
                player.isBlocking = true; playSound('player_block_activate');
            }
        });
        btnBlock.addEventListener('mouseup', (e) => {
            /*playSound('ui_button_release');*/
            if (gameMode === 'play' && !isGameOver) player.isBlocking = false;
        });
        btnBlock.addEventListener('mouseleave', (e) => {
            if (gameMode === 'play' && !isGameOver) player.isBlocking = false;
        });
        btnBlock.style.webkitUserSelect = 'none'; btnBlock.style.userSelect = 'none';
    }
}


function update(deltaTime) { 
    if (!isGameOver) {
        player.dx = 0; player.dz = 0;
        if (keys.w) player.dz = -player.speed; if (keys.s) player.dz = player.speed;
        if (keys.a) player.dx = -player.strafeSpeed; if (keys.d) player.dx = player.strafeSpeed;
        player.x += player.dx * deltaTime; player.z += player.dz * deltaTime;
        
        // Keyboard jump (Spacebar) is now for blocking. Mobile jump uses direct action.
        // If a dedicated keyboard jump key is needed, it would be handled here.
        player.dy -= player.gravity * deltaTime; player.y += player.dy * deltaTime;

        const groundY = player.height / 2; 
        if (player.y <= groundY && player.dy < 0) { // Check player.dy to ensure it's a landing event
            player.y = groundY; player.dy = 0; player.grounded = true; player.isJumping = false;
            playSound('player_land');
        } else if (player.y > groundY) { // Only set to false if actually airborne
             player.grounded = false; 
        }
        
        if ((player.dx !== 0 || player.dz !== 0) && player.mesh) {
             const moveDirection = new THREE.Vector3(player.dx, 0, player.dz).normalize();
             if(moveDirection.lengthSq() > 0.001) { 
                  const lookAtPosition = player.mesh.position.clone().add(moveDirection);
                  player.mesh.lookAt(lookAtPosition);
             }
        }
    } else {
        player.dx = 0; player.dy = 0; player.dz = 0;
    }
    
    if (player.mesh) player.mesh.position.set(player.x, player.y, player.z);

    if (player.mesh && player.shieldMesh) {
        let isShieldCurrentlyVisible = false;
        let currentShieldMaterialToUse = shieldMaterial; 
        let currentOpacity = 0.3;
        if (player.goldShieldActive) {
            isShieldCurrentlyVisible = true; currentShieldMaterialToUse = goldShieldMaterial; currentOpacity = 0.5; 
        } else if (player.shieldActive) { 
            isShieldCurrentlyVisible = true; currentShieldMaterialToUse = shieldMaterial; currentOpacity = 0.3;
        }
        if (player.isBlocking && (player.goldShieldActive || player.hasShield)) {
            currentShieldMaterialToUse = player.goldShieldActive ? goldShieldMaterial : shieldMaterial;
            isShieldCurrentlyVisible = true; currentOpacity = 0.8; 
        }
        player.shieldMesh.material = currentShieldMaterialToUse;
        player.shieldMesh.material.opacity = currentOpacity;
        player.shieldMesh.visible = isShieldCurrentlyVisible;
    }


    if (!isGameOver) {
        // --- Update Player Lasers ---
        for (let i = lasers.length - 1; i >= 0; i--) {
            const laser = lasers[i];
            laser.position.addScaledVector(laser.userData.velocity, deltaTime);
            let laserHitEnemy = false;
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (!laser.userData || !enemy.mesh) continue; 
                const simpleLaserCollider = {
                    x: laser.position.x, y: laser.position.y, z: laser.position.z,
                    width: 0.2, height: 0.2, depth: 0.2 
                };
                if (checkAABBCollision(simpleLaserCollider, enemy)) {
                    console.log("Laser hit an enemy!");
                    playSound('enemy_destroyed');
                    scene.remove(enemy.mesh); enemies.splice(j, 1); 
                    scene.remove(laser); lasers.splice(i, 1); 
                    laserHitEnemy = true; break; 
                }
            }
            if (!laserHitEnemy && clock.getElapsedTime() - laser.userData.spawnTime > LASER_LIFETIME) {
                scene.remove(laser); lasers.splice(i, 1);
            }
        }
        
        // --- Level Spawning & Upgrade Logic ---
        if (currentLevel === 1 && levelState === 'running') {
            levelTimer += deltaTime;
            if (levelTimer >= LEVEL1_DURATION) {
                levelState = 'wave_ended';
                console.log("Level 1 wave survived! Applying upgrades.");
                playSound('level1_wave_complete');
                player.hasShield = true; player.shieldActive = true;
                player.gunUpgradeLevel = 1;
                currentLaserSpeed = BASE_LASER_SPEED * 1.5; 
                levelState = 'level1_upgraded'; 
                console.log("Upgrades acquired: Shield ON, Gun Faster!");
                playSound('upgrade_acquired');
                showStatusMessage("Upgrades Acquired! Shield Active & Faster Gun!", "success", 4000);
            } else {
                if (levelTimer - lastSpawnTime >= ENEMY_SPAWN_INTERVAL && enemies.length < maxActiveEnemies) {
                    const randomSpawnPoint = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
                    spawnEnemy(randomSpawnPoint.x, randomSpawnPoint.y, randomSpawnPoint.z, 'square_biter', 1.25, 3, currentLevel); 
                    lastSpawnTime = levelTimer;
                }
            }
        } else if (currentLevel === 3 && levelState === 'running' && player.gunUpgradeLevel < 2) {
            levelTimer += deltaTime; 
            if (levelTimer > LEVEL3_UPGRADE_DELAY) { 
                player.hasGoldShield = true; player.goldShieldActive = true; 
                player.hasShield = false; player.shieldActive = false;
                player.gunUpgradeLevel = 2;
                currentLaserSpeed = BASE_LASER_SPEED * 2.0; 
                levelState = 'level3_upgraded'; 
                console.log("Level 3 Upgrades: Gold Shield & Powerful Gun!");
                playSound('upgrade_acquired_gold');
                showStatusMessage("Gold Shield & Powerful Gun Acquired!", "success", 4000);
            }
        }
    }

    // --- Enemy AI & Updates ---
    enemies.forEach(enemy => {
        if (!isGameOver) { 
            if (!player.mesh || !enemy.mesh) return; 
            if (enemy.patrolDistance > 0 && enemy.type !== 'square_biter_L3') { 
                enemy.x += enemy.speed * enemy.direction * deltaTime; 
                if (Math.abs(enemy.x - enemy.initialX) >= enemy.patrolDistance) {
                    enemy.direction *= -1; 
                    enemy.x = enemy.initialX + (enemy.patrolDistance * enemy.direction); 
                }
            } else { 
                const directionToPlayer = new THREE.Vector3(player.x - enemy.x, 0, player.z - enemy.z);
                directionToPlayer.normalize(); 
                const distanceToMove = enemy.speed * deltaTime;
                enemy.x += directionToPlayer.x * distanceToMove;
                enemy.z += directionToPlayer.z * distanceToMove;
            }
            enemy.y = ENEMY_SIZE / 2; 
            const lookAtPosition = new THREE.Vector3(player.x, enemy.y, player.z); 
            enemy.mesh.lookAt(lookAtPosition);

            const enemyCanShoot = enemy.canShoot; 
            const shootCooldown = enemy.shootCooldown || 2.0;
            const shootRange = enemy.shootRange || 20;
            
            if (enemyCanShoot && player.mesh) {
                const distanceToPlayer = enemy.mesh.position.distanceTo(player.mesh.position);
                if (distanceToPlayer <= shootRange) {
                    if (clock.getElapsedTime() - (enemy.lastShotTime || 0) > shootCooldown) {
                        let currentEnemyLaserMat = enemy.isPiercingShooter ? enemyPiercingLaserMaterial : enemyLaserMaterial;
                        playSound(enemy.isPiercingShooter ? 'enemy_shoot_piercing' : 'enemy_shoot_normal');
                        
                        const eLaser = new THREE.Mesh(laserGeometry, currentEnemyLaserMat);
                        const startPosition = new THREE.Vector3();
                        if (enemy.gunMesh) enemy.gunMesh.getWorldPosition(startPosition);
                        else startPosition.copy(enemy.mesh.position);
                        
                        const laserDirection = new THREE.Vector3().subVectors(player.mesh.position, startPosition).normalize();
                        startPosition.addScaledVector(laserDirection, 0.5); 

                        eLaser.position.copy(startPosition);
                        eLaser.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), laserDirection);

                        eLaser.userData = { 
                            velocity: laserDirection.multiplyScalar(ENEMY_LASER_SPEED), 
                            spawnTime: clock.getElapsedTime(),
                            isPiercing: enemy.isPiercingShooter 
                        };
                        enemyLasers.push(eLaser); scene.add(eLaser);
                        enemy.lastShotTime = clock.getElapsedTime();
                    }
                }
            }
        }
        if (enemy.mesh) enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
    });

    // --- Update Enemy Lasers ---
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const eLaser = enemyLasers[i];
        eLaser.position.addScaledVector(eLaser.userData.velocity, deltaTime);
        let laserRemovedThisFrame = false;

        if (player.mesh && checkAABBCollision({ ...player, x:player.x, y:player.y, z:player.z }, { x: eLaser.position.x, y: eLaser.position.y, z: eLaser.position.z, width: 0.2, height: 0.2, depth: 1.0 })) {
            const isPiercing = eLaser.userData.isPiercing || false;
            let playerIsHit = false;

            if (isPiercing) {
                if (player.isBlocking && player.hasGoldShield) { 
                    showStatusMessage("Gold Shield blocked piercing laser!", "success", 1500);
                    playSound('laser_blocked_by_player'); // Or gold_shield_block
                } else if (player.goldShieldActive) { 
                    player.goldShieldActive = false; 
                    showStatusMessage("Gold Shield absorbed piercing laser and broke!", "warn", 2500);
                    playSound('gold_shield_hit');
                } else if (!isGameOver) { 
                    playerIsHit = true;
                    showStatusMessage("Hit by PIERCING enemy laser! Game Over!", "error", 4000);
                }
            } else { 
                if (player.isBlocking && player.hasShield) { 
                    showStatusMessage("Blocked enemy laser!", "success", 1500);
                    playSound('laser_blocked_by_player');
                } else if (player.shieldActive) { 
                    player.shieldActive = false;
                    showStatusMessage("Passive shield absorbed enemy laser!", "info", 2000);
                    playSound('normal_shield_hit');
                } else if (!isGameOver) { 
                    playerIsHit = true;
                    showStatusMessage("Hit by enemy laser! Game Over!", "error");
                }
            }

            if (playerIsHit && !isGameOver) {
                isGameOver = true;
                playSound('player_hit_gameover');
                console.log("Player hit, game over."); 
            }

            scene.remove(eLaser); enemyLasers.splice(i, 1);
            laserRemovedThisFrame = true; 
        }

        if (!laserRemovedThisFrame && clock.getElapsedTime() - eLaser.userData.spawnTime > ENEMY_LASER_LIFETIME) {
            scene.remove(eLaser); enemyLasers.splice(i, 1);
        }
    }


    // --- Player-Enemy Collision & Game Over ---
    if (!isGameOver) { 
        for (let j = enemies.length - 1; j >= 0; j--) { 
            const enemy = enemies[j];
            if (!player.mesh || !enemy.mesh) continue;
            if (checkAABBCollision(player, enemy)) {
                if (player.shieldActive) { 
                    player.shieldActive = false;
                    console.log("Shield absorbed enemy body hit!");
                    playSound('normal_shield_hit');
                    showStatusMessage("Shield Blocked Enemy Attack!", "info", 2000);
                    scene.remove(enemy.mesh); enemies.splice(j, 1); 
                } else { 
                    console.log("Game Over! Player Eaten!");
                    isGameOver = true;
                    playSound('player_hit_gameover');
                    // BGM: Stop gameplay music, playMusic('game_over_stinger');
                    const statusDisplay = document.getElementById('statusDisplay');
                    if (statusDisplay) {
                        statusDisplay.innerText = "Game Over! Player Eaten!";
                        statusDisplay.style.display = 'block';
                    } else { alert("Game Over! Player Eaten!"); }
                    break; 
                }
            }
        }
    }

    // --- Third-Person Follow Camera Logic (always update) ---
    if (player.mesh) { 
        const targetCameraPosition = player.mesh.position.clone().add(cameraOffset);
        camera.position.lerp(targetCameraPosition, cameraSmoothnessFactor);
        const lookAtTarget = player.mesh.position.clone();
        lookAtTarget.y += player.height * 0.25; 
        camera.lookAt(lookAtTarget);
    }
}


function animate() {
    requestAnimationFrame(animate);
    const deltaTime = clock.getDelta(); 
    update(deltaTime); 
    renderer.render(scene, camera);
}

// Initialize the game
init();
console.log("Sound effect placeholders and BGM comments added.");
