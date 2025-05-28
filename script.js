// Three.js global variables
let scene, camera, renderer;
let groundPlane;
let controls; // For OrbitControls
let gridHelper; // For editor grid
// let shadowCamHelper; // Optional: For debugging shadow camera

// Raycasting variables
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let placementPlane; // Helper plane for initial placements

// Editor variables
let gameMode = 'play'; // 'play' or 'edit'
let selectedBlockType = 'ground'; // For block placement
let currentEditorTool = 'block'; // 'block' or 'enemy'
const GRID_UNIT_SIZE = 1; // Each block/grid cell is 1x1x1 world unit

// Materials and Geometries
const enemyMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 }); // Red for enemies
const enemyGeometry = new THREE.SphereGeometry(GRID_UNIT_SIZE / 2, 16, 16); // Sphere for enemies

// Variables for merged platform mesh
let mergedPlatformsMesh = null;
const platformMaterial = new THREE.MeshStandardMaterial({ color: 0xCD853F }); // Peru, used for editor-placed blocks

let player = {
    mesh: null,    
    width: 1, height: 2, depth: 1,      
    x: 0, y: 0, z: 0, // Center position
    dx: 0, dy: 0, dz: 0,         
    speed: 0.1, jumpStrength: 0.25, gravity: 0.01,   
    isJumping: false, grounded: false,
};

// Player Reset Constants
const PLAYER_RESET_X = 0;
const PLAYER_RESET_Y_OFFSET = player.height / 2; 
const PLAYER_RESET_Z = 5;

let platforms = [];
let enemies = []; 

const keys = {
    w: false, s: false, a: false, d: false, space: false
};

// Status Message
let statusMessageTimeout = null;

function showStatusMessage(message, type = 'info', duration = 3000) {
    const statusContainer = document.getElementById('statusMessageContainer');
    const statusTextElement = document.getElementById('statusMessageText');

    if (statusContainer && statusTextElement) {
        statusTextElement.innerText = message;
        
        statusContainer.className = 'statusMessageActive'; // Reset classes by setting to a base or none
        if (type === 'success') {
            statusContainer.classList.add('success');
        } else if (type === 'error') {
            statusContainer.classList.add('error');
        }
        // else 'info' type uses default styling from .statusMessageActive (if any additional base styling for active state)

        statusContainer.style.display = 'block';

        if (statusMessageTimeout) {
            clearTimeout(statusMessageTimeout);
        }

        statusMessageTimeout = setTimeout(() => {
            statusContainer.style.display = 'none';
            statusMessageTimeout = null;
        }, duration);
    } else {
        console.warn("Status message elements not found. Falling back to console/alert.");
        if (type === 'error') console.error(message);
        else console.log(message);
        if (duration > 1000 && (type === 'success' || type === 'error')) alert(message); // Fallback alert for important messages
    }
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

function rebuildMergedPlatforms() {
    if (typeof THREE.BufferGeometryUtils === 'undefined') {
        console.warn('THREE.BufferGeometryUtils not available. Skipping platform merge.');
        platforms.forEach(platform => { if (platform.mesh) platform.mesh.visible = true; });
        return;
    }
    if (mergedPlatformsMesh) {
        scene.remove(mergedPlatformsMesh);
        if (mergedPlatformsMesh.geometry) mergedPlatformsMesh.geometry.dispose();
        mergedPlatformsMesh = null;
    }
    const geometriesToMerge = []; let hasMergeablePlatforms = false;
    platforms.forEach(platform => {
        if (platform.mesh && platform.appearance.color === platformMaterial.color.getHex()) {
            const geometryClone = platform.mesh.geometry.clone();
            geometryClone.applyMatrix4(platform.mesh.matrixWorld);
            geometriesToMerge.push(geometryClone);
            platform.mesh.visible = false; hasMergeablePlatforms = true;
        } else if (platform.mesh) { platform.mesh.visible = true; }
    });
    if (hasMergeablePlatforms && geometriesToMerge.length > 0) {
        const mergedGeometry = THREE.BufferGeometryUtils.mergeBufferGeometries(geometriesToMerge, false);
        geometriesToMerge.forEach(geom => geom.dispose()); 
        if (mergedGeometry) {
            mergedPlatformsMesh = new THREE.Mesh(mergedGeometry, platformMaterial);
            mergedPlatformsMesh.castShadow = true; mergedPlatformsMesh.receiveShadow = true;
            scene.add(mergedPlatformsMesh);
            console.log(`Merged ${geometriesToMerge.length} platform geometries.`);
        } else {
            console.log("No geometries were merged. Making individuals visible.");
            platforms.forEach(platform => { if (platform.mesh && platform.appearance.color === platformMaterial.color.getHex()) platform.mesh.visible = true; });
        }
    } else {
        console.log("No platforms found to merge for the common material.");
        platforms.forEach(platform => { if (platform.mesh && platform.appearance.color === platformMaterial.color.getHex()) platform.mesh.visible = true;});
    }
}

function saveLevel() {
    if (gameMode !== 'edit') { console.warn("Can only save in edit mode."); return; }
    try {
        const levelData = {
            platformsData: platforms.map(p => ({
                x: p.x, y: p.y, z: p.z, width: p.width, height: p.height, depth: p.depth,
                appearance: { type: p.appearance.type, color: p.appearance.color }
            })),
            enemiesData: enemies.map(e => ({
                x: e.x, y: e.y, z: e.z, type: e.type, speed: e.speed, direction: e.direction,
                patrolDistance: e.patrolDistance, initialX: e.initialX, initialY: e.initialY, initialZ: e.initialZ
            }))
        };
        localStorage.setItem('platformerLevel3D', JSON.stringify(levelData)); 
        showStatusMessage('Level Saved!', 'success');
    } catch (error) { 
        console.error('Error saving 3D level:', error); 
        showStatusMessage('Error saving level: ' + error.message, 'error');
    }
}

function loadLevel() {
    if (gameMode !== 'edit') { console.warn("Can only load in edit mode."); return; }
    try {
        const savedLevelJSON = localStorage.getItem('platformerLevel3D');
        if (savedLevelJSON) {
            const levelData = JSON.parse(savedLevelJSON);
            if (mergedPlatformsMesh) {
                scene.remove(mergedPlatformsMesh); if (mergedPlatformsMesh.geometry) mergedPlatformsMesh.geometry.dispose(); mergedPlatformsMesh = null;
            }
            platforms.forEach(p => { if (p.mesh) { scene.remove(p.mesh); if (p.mesh.geometry) p.mesh.geometry.dispose(); if (p.mesh.material) p.mesh.material.dispose(); }});
            platforms = [];
            enemies.forEach(e => { if (e.mesh) scene.remove(e.mesh); });
            enemies = [];

            if (levelData.platformsData) {
                levelData.platformsData.forEach(pd => {
                    const blockGeom = new THREE.BoxGeometry(pd.width, pd.height, pd.depth);
                    const mat = (pd.appearance.color === platformMaterial.color.getHex()) ? platformMaterial : new THREE.MeshStandardMaterial({ color: pd.appearance.color || 0xCD853F });
                    const newBlockMesh = new THREE.Mesh(blockGeom, mat);
                    newBlockMesh.position.set(pd.x, pd.y, pd.z);
                    newBlockMesh.castShadow = true; newBlockMesh.receiveShadow = true;
                    scene.add(newBlockMesh);
                    platforms.push({ mesh: newBlockMesh, ...pd });
                });
            }
            if (levelData.enemiesData) {
                levelData.enemiesData.forEach(ed => {
                    const newEnemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial); 
                    newEnemyMesh.position.set(ed.x, ed.y, ed.z);
                    newEnemyMesh.castShadow = true; scene.add(newEnemyMesh);
                    enemies.push({
                        mesh: newEnemyMesh, x: ed.x, y: ed.y, z: ed.z,
                        type: ed.type || 'basic_patrol_x', speed: ed.speed || 0.02, direction: ed.direction || 1,
                        patrolDistance: ed.patrolDistance || 3,
                        initialX: ed.initialX !== undefined ? ed.initialX : ed.x,
                        initialY: ed.initialY !== undefined ? ed.initialY : ed.y,
                        initialZ: ed.initialZ !== undefined ? ed.initialZ : ed.z,
                        width: GRID_UNIT_SIZE, height: GRID_UNIT_SIZE, depth: GRID_UNIT_SIZE 
                    });
                });
            }
            showStatusMessage('Level Loaded!', 'success');
            rebuildMergedPlatforms(); 
        } else { 
            showStatusMessage('No saved level found.', 'info');
        }
    } catch (error) { 
        console.error('Error loading 3D level:', error); 
        showStatusMessage('Error loading level: ' + error.message, 'error');
    }
}

function updateEditorInfoText() {
    const btnToggleEditor = document.getElementById('btnToggleEditor');
    if (btnToggleEditor) {
        btnToggleEditor.innerText = (gameMode === 'edit' ? 'PLAY' : 'EDIT');
    }
    const btnSwitchTool = document.getElementById('btnSwitchTool');
    if (btnSwitchTool) {
        btnSwitchTool.innerText = `TOOL: ${currentEditorTool.toUpperCase()}`;
        btnSwitchTool.style.display = (gameMode === 'edit' ? 'inline-block' : 'none'); 
    }
    const btnSaveLevel = document.getElementById('btnSaveLevel');
    if (btnSaveLevel) {
        btnSaveLevel.style.display = (gameMode === 'edit' ? 'inline-block' : 'none'); 
    }
    const btnLoadLevel = document.getElementById('btnLoadLevel');
    if (btnLoadLevel) {
        btnLoadLevel.style.display = (gameMode === 'edit' ? 'inline-block' : 'none'); 
    }
}

function toggleEditorMode() {
    if (gameMode === 'play') { 
        gameMode = 'edit'; 
        if (mergedPlatformsMesh) {
            scene.remove(mergedPlatformsMesh); 
            if (mergedPlatformsMesh.geometry) mergedPlatformsMesh.geometry.dispose(); 
            mergedPlatformsMesh = null;
        }
        platforms.forEach(p => { if (p.mesh) p.mesh.visible = true; });
        if (gridHelper) gridHelper.visible = true; 
        if (controls) controls.enabled = true; 
        console.log(`Switched to Edit Mode. Current tool: ${currentEditorTool}`);
    } else { 
        gameMode = 'play'; 
        rebuildMergedPlatforms(); 
        if (gridHelper) gridHelper.visible = false; 
        console.log('Switched to Play Mode'); 
    }
    updateEditorInfoText(); 
}

function toggleEditorPlacementTool() {
    if (gameMode !== 'edit') return; 
    currentEditorTool = (currentEditorTool === 'block') ? 'enemy' : 'block';
    console.log('Switched to ' + currentEditorTool.toUpperCase() + ' Placement Tool');
    updateEditorInfoText(); 
}


window.addEventListener('keydown', function(e) {
    if (gameMode === 'play') {
        if (e.key === 'w' || e.key === 'W') keys.w = true;
        if (e.key === 's' || e.key === 'S') keys.s = true;
        if (e.key === 'a' || e.key === 'A') keys.a = true;
        if (e.key === 'd' || e.key === 'D') keys.d = true;
        if (e.key === ' ') keys.space = true; 
    }
    if (e.key === '0') { 
        toggleEditorMode(); 
    } else if (gameMode === 'edit') { 
        if (e.key === 's' || e.key === 'S') saveLevel();
        if (e.key === 'l' || e.key === 'L') loadLevel();
        if (e.key === 'e' || e.key === 'E') { 
           toggleEditorPlacementTool();
       }
    }
});

window.addEventListener('keyup', function(e) {
    if (gameMode === 'play') {
        if (e.key === 'w' || e.key === 'W') keys.w = false;
        if (e.key === 's' || e.key === 'S') keys.s = false;
        if (e.key === 'a' || e.key === 'A') keys.a = false;
        if (e.key === 'd' || e.key === 'D') keys.d = false;
        if (e.key === ' ') keys.space = false;
    }
});

function onEditorClick(event) {
    if (gameMode !== 'edit') return;
    event.preventDefault(); mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const objectsToIntersect = [placementPlane, ...platforms.map(p => p.mesh).filter(m => m && m.visible), ...enemies.map(e => e.mesh).filter(m => m)];
    const intersects = raycaster.intersectObjects(objectsToIntersect, false);

    if (intersects.length > 0) {
        const intersect = intersects[0];
        let placementPosition = new THREE.Vector3(); let normal = intersect.face.normal.clone();
        normal.transformDirection(intersect.object.matrixWorld);
        placementPosition.copy(intersect.point).addScaledVector(normal, GRID_UNIT_SIZE / 2);
        
        const gridX = Math.round(placementPosition.x / GRID_UNIT_SIZE) * GRID_UNIT_SIZE;
        let gridY; const clickedExistingObject = intersect.object !== placementPlane;

        if (clickedExistingObject && normal.y > 0.9) { 
             gridY = Math.round( (intersect.object.position.y + (intersect.object.geometry.parameters.height || GRID_UNIT_SIZE) / 2 + GRID_UNIT_SIZE / 2) / GRID_UNIT_SIZE) * GRID_UNIT_SIZE;
        } else if (intersect.object === placementPlane && normal.y > 0.9) { 
             gridY = GRID_UNIT_SIZE / 2; 
        } else { gridY = Math.round(placementPosition.y / GRID_UNIT_SIZE) * GRID_UNIT_SIZE; }
        const gridZ = Math.round(placementPosition.z / GRID_UNIT_SIZE) * GRID_UNIT_SIZE;
        const finalY = Math.max(GRID_UNIT_SIZE / 2, gridY); 

        if (currentEditorTool === 'block') {
            let blockExists = false; let existingBlockIndex = -1;
            for (let i = 0; i < platforms.length; i++) {
                const p = platforms[i];
                if (Math.abs(p.x - gridX) < 0.1 && Math.abs(p.y - finalY) < 0.1 && Math.abs(p.z - gridZ) < 0.1) {
                    blockExists = true; existingBlockIndex = i; break; }
            }
            if (blockExists && platforms[existingBlockIndex].mesh) { 
                scene.remove(platforms[existingBlockIndex].mesh);
                if (platforms[existingBlockIndex].mesh.geometry) platforms[existingBlockIndex].mesh.geometry.dispose();
                if (platforms[existingBlockIndex].mesh.material && platforms[existingBlockIndex].mesh.material !== platformMaterial) {
                     platforms[existingBlockIndex].mesh.material.dispose();
                }
                platforms.splice(existingBlockIndex, 1); console.log(`3D Block removed.`);
            } else { 
                const blockGeom = new THREE.BoxGeometry(GRID_UNIT_SIZE,GRID_UNIT_SIZE,GRID_UNIT_SIZE);
                const newBlockMesh = new THREE.Mesh(blockGeom, platformMaterial); 
                newBlockMesh.position.set(gridX, finalY, gridZ);
                newBlockMesh.castShadow = true; newBlockMesh.receiveShadow = true;
                scene.add(newBlockMesh);
                platforms.push({
                    mesh: newBlockMesh, x: gridX, y: finalY, z: gridZ,
                    width: GRID_UNIT_SIZE, height: GRID_UNIT_SIZE, depth: GRID_UNIT_SIZE,
                    appearance: { type: selectedBlockType, color: platformMaterial.color.getHex() } 
                }); console.log(`3D Block added.`);
            }
        } else if (currentEditorTool === 'enemy') {
            let enemyExists = false; let existingEnemyIndex = -1;
            for (let i = 0; i < enemies.length; i++) {
                const e = enemies[i];
                if (Math.abs(e.x - gridX) < 0.1 && Math.abs(e.y - finalY) < 0.1 && Math.abs(e.z - gridZ) < 0.1) {
                    enemyExists = true; existingEnemyIndex = i; break; }
            }
            if (enemyExists && enemies[existingEnemyIndex].mesh) {
                scene.remove(enemies[existingEnemyIndex].mesh);
                enemies.splice(existingEnemyIndex, 1); console.log(`Enemy removed.`);
            } else {
                const newEnemyMesh = new THREE.Mesh(enemyGeometry, enemyMaterial); 
                newEnemyMesh.position.set(gridX, finalY, gridZ);
                newEnemyMesh.castShadow = true; scene.add(newEnemyMesh);
                enemies.push({
                    mesh: newEnemyMesh, x: gridX, y: finalY, z: gridZ,
                    type: 'basic_patrol_x', speed: 0.02, direction: 1, patrolDistance: 3,
                    initialX: gridX, initialY: finalY, initialZ: gridZ,
                    width: GRID_UNIT_SIZE, height: GRID_UNIT_SIZE, depth: GRID_UNIT_SIZE 
                }); console.log(`Enemy added.`);
            }
        }
    }
}

function initThreeJS() {
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x87ceeb); 
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap; 
    document.body.appendChild(renderer.domElement); 
    
    renderer.domElement.addEventListener('click', onEditorClick, false);
    const planeGeom = new THREE.PlaneGeometry(100,100); planeGeom.rotateX(-Math.PI/2);
    placementPlane = new THREE.Mesh(planeGeom, new THREE.MeshBasicMaterial({visible:false, side:THREE.DoubleSide}));
    scene.add(placementPlane);
    gridHelper = new THREE.GridHelper(100,100,0x888888,0x444444); 
    gridHelper.position.y = 0.001; gridHelper.visible = false; scene.add(gridHelper);

    if (typeof THREE.OrbitControls === 'function') {
        controls = new THREE.OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true; controls.dampingFactor = 0.05;
        controls.screenSpacePanning = false; controls.minDistance = 3; controls.maxDistance = 50;   
        controls.target.set(0,1,0); controls.update(); camera.position.set(0,5,10); 
    } else { console.warn("THREE.OrbitControls not found."); camera.position.set(0,5,15); camera.lookAt(0,1,0); }
    
    const ambientLight = new THREE.AmbientLight(0xffffff,0.6); scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff,0.8);
    directionalLight.position.set(10, 15, 10); 
    directionalLight.castShadow = true; 
    directionalLight.shadow.mapSize.width = 1024; directionalLight.shadow.mapSize.height = 1024; 
    const shadowCamSize = 20; 
    directionalLight.shadow.camera.near = 0.5; directionalLight.shadow.camera.far = 50;     
    directionalLight.shadow.camera.left = -shadowCamSize; directionalLight.shadow.camera.right = shadowCamSize;
    directionalLight.shadow.camera.top = shadowCamSize; directionalLight.shadow.camera.bottom = -shadowCamSize;
    directionalLight.shadow.bias = -0.001; 
    scene.add(directionalLight);

    const groundGeom = new THREE.PlaneGeometry(100,100);
    const groundMat = new THREE.MeshStandardMaterial({color:0x228B22, side:THREE.DoubleSide});
    groundPlane = new THREE.Mesh(groundGeom, groundMat);
    groundPlane.rotation.x = -Math.PI/2; groundPlane.position.y = 0; 
    groundPlane.receiveShadow = true; 
    scene.add(groundPlane);
    
    const playerGeom = new THREE.BoxGeometry(player.width,player.height,player.depth);
    const playerMat = new THREE.MeshStandardMaterial({color:0x0077ff}); 
    player.mesh = new THREE.Mesh(playerGeom, playerMat);
    player.y = PLAYER_RESET_Y_OFFSET; player.x = PLAYER_RESET_X; player.z = PLAYER_RESET_Z; 
    player.mesh.position.set(player.x,player.y,player.z);
    player.mesh.castShadow = true; 
    scene.add(player.mesh);
    
    window.addEventListener('resize', onWindowResize, false);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function setupMobileControls() {
    const btnForward = document.getElementById('btnForward');
    const btnBackward = document.getElementById('btnBackward');
    const btnLeft = document.getElementById('btnLeft');
    const btnRight = document.getElementById('btnRight');
    const btnJump = document.getElementById('btnJump');
    const btnToggleEditor = document.getElementById('btnToggleEditor');
    const btnSwitchTool = document.getElementById('btnSwitchTool');
    const btnSaveLevel = document.getElementById('btnSaveLevel');
    const btnLoadLevel = document.getElementById('btnLoadLevel');

    if (!btnForward || !btnBackward || !btnLeft || !btnRight) console.warn("Mobile movement buttons not found.");
    if (!btnJump) console.warn("Mobile jump button not found.");
    if (!btnToggleEditor) console.warn("Button btnToggleEditor not found.");
    if (!btnSwitchTool) console.warn("Button btnSwitchTool not found.");
    if (!btnSaveLevel) console.warn("Button btnSaveLevel not found.");
    if (!btnLoadLevel) console.warn("Button btnLoadLevel not found.");


    const setupButtonEvents = (buttonElement, keyName) => {
        if (!buttonElement) return; 
        buttonElement.addEventListener('touchstart', (e) => {
            e.preventDefault(); if (gameMode === 'play') keys[keyName] = true;
        }, { passive: false });
        buttonElement.addEventListener('touchend', (e) => {
            e.preventDefault(); if (gameMode === 'play') keys[keyName] = false;
        }, { passive: false });
        buttonElement.addEventListener('mousedown', (e) => { if (gameMode === 'play') keys[keyName] = true; });
        buttonElement.addEventListener('mouseup', (e) => { if (gameMode === 'play') keys[keyName] = false; });
        buttonElement.addEventListener('mouseleave', (e) => { if (gameMode === 'play') keys[keyName] = false; });
    };

    setupButtonEvents(btnForward, 'w');
    setupButtonEvents(btnBackward, 's');
    setupButtonEvents(btnLeft, 'a');
    setupButtonEvents(btnRight, 'd');
    setupButtonEvents(btnJump, 'space'); 

    if (btnToggleEditor) {
        btnToggleEditor.addEventListener('click', () => { toggleEditorMode(); });
        btnToggleEditor.style.webkitUserSelect = 'none'; btnToggleEditor.style.userSelect = 'none';
    }
    if (btnSwitchTool) {
        btnSwitchTool.addEventListener('click', () => { toggleEditorPlacementTool(); });
        btnSwitchTool.style.webkitUserSelect = 'none'; btnSwitchTool.style.userSelect = 'none';
    }
    if (btnSaveLevel) {
        btnSaveLevel.addEventListener('click', () => { if (gameMode === 'edit') saveLevel(); else showStatusMessage("Save is only available in Edit Mode.", "info"); });
        btnSaveLevel.style.webkitUserSelect = 'none'; btnSaveLevel.style.userSelect = 'none';
    }
    if (btnLoadLevel) {
        btnLoadLevel.addEventListener('click', () => { if (gameMode === 'edit') loadLevel(); else showStatusMessage("Load is only available in Edit Mode.", "info"); });
        btnLoadLevel.style.webkitUserSelect = 'none'; btnLoadLevel.style.userSelect = 'none';
    }
    
    updateEditorInfoText(); 
}

function update() { 
    if (gameMode === 'play') {
        let intendedDx = 0; let intendedDz = 0;
        if (keys.w) intendedDz = -player.speed; if (keys.s) intendedDz = player.speed;
        if (keys.a) intendedDx = -player.speed; if (keys.d) intendedDx = player.speed;
        player.dx = intendedDx; player.dz = intendedDz;

        if (keys.space && player.grounded && !player.isJumping) {
            player.dy = player.jumpStrength;
            player.isJumping = true; player.grounded = false;
        }
        player.dy -= player.gravity;
        let nextX = player.x + player.dx; let nextY = player.y + player.dy; let nextZ = player.z + player.dz;
        player.grounded = false; 

        if (!mergedPlatformsMesh || !mergedPlatformsMesh.visible) { 
            platforms.forEach(platform => {
                if (platform.mesh && platform.mesh.visible) { 
                    const tempPlayerCollider = { x: nextX, y: nextY, z: nextZ, width: player.width, height: player.height, depth: player.depth };
                    if (checkAABBCollision(tempPlayerCollider, platform)) {
                        const overlapX = (player.width/2 + platform.width/2) - Math.abs(nextX - platform.x);
                        const overlapY = (player.height/2 + platform.height/2) - Math.abs(nextY - platform.y);
                        const overlapZ = (player.depth/2 + platform.depth/2) - Math.abs(nextZ - platform.z);
                        if (overlapY < overlapX && overlapY < overlapZ) { 
                            if (nextY > platform.y) { 
                                nextY = platform.y + platform.height/2 + player.height/2;
                                player.dy = 0; player.grounded = true; player.isJumping = false;
                            } else { nextY = platform.y - platform.height/2 - player.height/2; player.dy = 0; }
                        } else if (overlapX < overlapY && overlapX < overlapZ) { 
                            if (nextX < platform.x) nextX = platform.x - platform.width/2 - player.width/2;
                            else nextX = platform.x + platform.width/2 + player.width/2;
                            player.dx = 0;
                        } else { 
                            if (nextZ < platform.z) nextZ = platform.z - platform.depth/2 - player.depth/2;
                            else nextZ = platform.z + platform.depth/2 + player.depth/2;
                            player.dz = 0;
                        }
                    }
                }
            });
        }
        player.x = nextX; player.y = nextY; player.z = nextZ;

        const playerBottomY = player.y - player.height / 2;
        if (playerBottomY <= 0 && !player.grounded) { 
            player.y = PLAYER_RESET_Y_OFFSET; player.dy = 0;                 
            player.grounded = true; player.isJumping = false;
        }
        
        enemies.forEach(enemy => {
            if (enemy.mesh) {
                const enemyCollider = { x: enemy.x, y: enemy.y, z: enemy.z, width: enemy.width, height: enemy.height, depth: enemy.depth };
                if (checkAABBCollision(player, enemyCollider)) {
                    console.log("Player collided with an enemy!");
                    player.x = PLAYER_RESET_X; player.y = PLAYER_RESET_Y_OFFSET; player.z = PLAYER_RESET_Z;
                    player.dx = 0; player.dy = 0; player.dz = 0;
                    player.grounded = true; player.isJumping = false;
                }
            }
        });

        enemies.forEach(enemy => {
            if (enemy.type === 'basic_patrol_x') {
                enemy.x += enemy.speed * enemy.direction;
                if (Math.abs(enemy.x - enemy.initialX) >= enemy.patrolDistance) {
                    enemy.direction *= -1; 
                    enemy.x = enemy.initialX + (enemy.patrolDistance * enemy.direction); 
                }
            }
            if (enemy.mesh) enemy.mesh.position.set(enemy.x, enemy.y, enemy.z);
        });

    } else if (gameMode === 'edit') { /* Editor logic */ }
    
    if (player.mesh) player.mesh.position.set(player.x, player.y, player.z);
}

function animate() { 
    requestAnimationFrame(animate);
    if (controls && controls.update) controls.update(); 
    update(); 
    renderer.render(scene, camera);
}

initThreeJS();
animate();
setupMobileControls(); 
console.log("Status message system implemented.");
