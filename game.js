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
    speed: 5,                     
    strafeSpeed: 4,               
    jumpStrength: 8,            
    gravity: 20,                  
    grounded: false,
    isJumping: false
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
const LASER_SPEED = 50; 
const LASER_LIFETIME = 2; 
const laserMaterial = new THREE.MeshBasicMaterial({ color: 0x00ffff, emissive: 0x00ffff }); 
const laserGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8); 
laserGeometry.rotateX(Math.PI / 2);

// Enemy properties
let enemies = [];
const ENEMY_SIZE = 1.5; // Size of the square enemy body
const enemyBodyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red body
const enemyMouthMaterial = new THREE.MeshStandardMaterial({ color: 0x333333 }); // Dark gray for mouth
const enemyMaterials = [
    enemyBodyMaterial, // right
    enemyBodyMaterial, // left
    enemyBodyMaterial, // top
    enemyBodyMaterial, // bottom
    enemyMouthMaterial, // front (mouth face)
    enemyBodyMaterial  // back
];
const enemyGeometry = new THREE.BoxGeometry(ENEMY_SIZE, ENEMY_SIZE, ENEMY_SIZE);


// Player Reset Constants
const PLAYER_RESET_X = 0;
const PLAYER_RESET_Y_OFFSET = player.height / 2; 
const PLAYER_RESET_Z = 5;


function spawnEnemy(x, y, z) {
    const enemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterials); 
    enemyMesh.castShadow = true;
    enemyMesh.position.set(x, y, z);
    
    const enemy = {
        mesh: enemyMesh,
        x: x, y: y, z: z,
        width: ENEMY_SIZE, height: ENEMY_SIZE, depth: ENEMY_SIZE,
        type: 'square_biter', 
        speed: 1.5 
    };

    enemies.push(enemy);
    scene.add(enemyMesh);
    return enemy;
}


function init() {
    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x222222); 

    // Camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000 );
    
    // Renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true; 
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    document.body.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 15, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 1024;
    directionalLight.shadow.mapSize.height = 1024;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 50;
    directionalLight.shadow.camera.left = -20;
    directionalLight.shadow.camera.right = 20;
    directionalLight.shadow.camera.top = 20;
    directionalLight.shadow.camera.bottom = -20;
    scene.add(directionalLight);

    // Ground Plane
    const groundGeometry = new THREE.PlaneGeometry(100, 100); 
    const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x444444, side: THREE.DoubleSide });
    groundPlane = new THREE.Mesh(groundGeometry, groundMaterial);
    groundPlane.rotation.x = -Math.PI / 2; 
    groundPlane.position.y = 0; 
    groundPlane.receiveShadow = true;
    scene.add(groundPlane);

    // Initialize Clock
    clock = new THREE.Clock();

    // Create Player Mesh
    const playerGeometry = new THREE.BoxGeometry(player.width, player.height, player.depth);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x0077ff }); 
    player.mesh = new THREE.Mesh(playerGeometry, playerMaterial);
    player.mesh.castShadow = true;

    player.y = PLAYER_RESET_Y_OFFSET; 
    player.x = PLAYER_RESET_X;
    player.z = PLAYER_RESET_Z; 
    player.mesh.position.set(player.x, player.y, player.z);
    scene.add(player.mesh);

    // Create and attach Gun Mesh
    const gunGeometry = new THREE.BoxGeometry(0.2, 0.2, 0.8); 
    const gunMaterial = new THREE.MeshStandardMaterial({ color: 0x555555 }); 
    gun.mesh = new THREE.Mesh(gunGeometry, gunMaterial);
    gun.mesh.position.set(gun.offsetX, gun.offsetY, gun.offsetZ); 
    player.mesh.add(gun.mesh); 

    // Spawn initial enemies
    spawnEnemy(-5, ENEMY_SIZE / 2, -5);
    spawnEnemy(0, ENEMY_SIZE / 2, -8);
    spawnEnemy(5, ENEMY_SIZE / 2, -5);

    // Set initial camera position based on player
    if (player.mesh) {
        const initialCameraPos = player.mesh.position.clone().add(cameraOffset);
        camera.position.copy(initialCameraPos);
        const initialLookAt = player.mesh.position.clone();
        initialLookAt.y += player.height * 0.25;
        camera.lookAt(initialLookAt);
    } else { 
        camera.position.set(0, 5, 10);
        camera.lookAt(0,0,0);
    }

    // Setup Keyboard Event Listeners
    window.addEventListener('keydown', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w': keys.w = true; break;
            case 'a': keys.a = true; break;
            case 's': keys.s = true; break;
            case 'd': keys.d = true; break;
            case ' ': keys.space = true; break;
        }
    });

    window.addEventListener('keyup', (e) => {
        switch (e.key.toLowerCase()) {
            case 'w': keys.w = false; break;
            case 'a': keys.a = false; break;
            case 's': keys.s = false; break;
            case 'd': keys.d = false; break;
            case ' ': keys.space = false; break;
        }
    });

    // Mouse Click Listener for Shooting
    window.addEventListener('mousedown', (e) => {
       if (e.button === 0) { 
           shootLaser();
       }
    });

    window.addEventListener('resize', onWindowResize, false);
    animate();
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

// Helper function for AABB collision detection
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

function shootLaser() {
    if (!player.mesh || !gun.mesh) return;
    const laser = new THREE.Mesh(laserGeometry, laserMaterial);
    const gunWorldPosition = new THREE.Vector3();
    gun.mesh.getWorldPosition(gunWorldPosition);
    const gunWorldQuaternion = new THREE.Quaternion();
    gun.mesh.getWorldQuaternion(gunWorldQuaternion);
    laser.position.copy(gunWorldPosition);
    laser.quaternion.copy(gunWorldQuaternion); 
    const direction = new THREE.Vector3();
    player.mesh.getWorldDirection(direction); 
    laser.userData = { 
        velocity: direction.multiplyScalar(LASER_SPEED), 
        spawnTime: clock.getElapsedTime()
    };
    lasers.push(laser);
    scene.add(laser);
}

function update(deltaTime) {
    // --- Player Movement ---
    player.dx = 0; player.dz = 0;
    if (keys.w) player.dz = -player.speed; if (keys.s) player.dz = player.speed;
    if (keys.a) player.dx = -player.strafeSpeed; if (keys.d) player.dx = player.strafeSpeed;
    player.x += player.dx * deltaTime; player.z += player.dz * deltaTime;

    // --- Player Jumping & Gravity ---
    if (keys.space && player.grounded && !player.isJumping) {
        player.dy = player.jumpStrength; player.isJumping = true; player.grounded = false;
    }
    player.dy -= player.gravity * deltaTime; player.y += player.dy * deltaTime;

    // --- Ground Collision ---
    const groundY = player.height / 2; 
    if (player.y <= groundY) {
        player.y = groundY; player.dy = 0; player.grounded = true; player.isJumping = false;
    } else { player.grounded = false; }
    
    // --- Player Rotation ---
    if ((player.dx !== 0 || player.dz !== 0) && player.mesh) {
         const moveDirection = new THREE.Vector3(player.dx, 0, player.dz).normalize();
         if(moveDirection.lengthSq() > 0.001) { 
              const lookAtPosition = player.mesh.position.clone().add(moveDirection);
              player.mesh.lookAt(lookAtPosition);
         }
    }

    // --- Update Player Mesh Position ---
    if (player.mesh) player.mesh.position.set(player.x, player.y, player.z);

    // --- Update Lasers ---
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
                
                scene.remove(enemy.mesh);
                // Note: Shared enemyGeometry and enemyMaterials are not disposed
                enemies.splice(j, 1); 

                scene.remove(laser);
                // Note: Shared laserGeometry and laserMaterial are not disposed
                lasers.splice(i, 1); 
                
                laserHitEnemy = true;
                break; // Laser is destroyed, stop checking this laser against other enemies
            }
        }

        if (!laserHitEnemy && clock.getElapsedTime() - laser.userData.spawnTime > LASER_LIFETIME) {
            scene.remove(laser);
            lasers.splice(i, 1);
        }
    }

    // --- Enemy AI & Updates ---
    enemies.forEach(enemy => {
        if (!player.mesh || !enemy.mesh) return; 
        const directionToPlayer = new THREE.Vector3(player.x - enemy.x, 0, player.z - enemy.z);
        directionToPlayer.normalize(); 
        const distanceToMove = enemy.speed * deltaTime;
        enemy.x += directionToPlayer.x * distanceToMove;
        enemy.z += directionToPlayer.z * distanceToMove;
        enemy.y = ENEMY_SIZE / 2; 
        enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
        const lookAtPosition = new THREE.Vector3(player.x, enemy.y, player.z); 
        enemy.mesh.lookAt(lookAtPosition);
    });


    // --- Third-Person Follow Camera Logic ---
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
console.log("Laser-enemy collision and destruction implemented.");
