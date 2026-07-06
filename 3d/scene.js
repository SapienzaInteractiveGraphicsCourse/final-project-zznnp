window.COLLISION_GROUP_CAR = 1;
window.COLLISION_GROUP_ROAD = 2;
window.COLLISION_GROUP_WALL = 4;
window.COLLISION_GROUP_CHECKPOINT = 8;
window.COLLISION_GROUP_OFFROAD    = 16;

class EnvironmentManager {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.scene.background = new THREE.Color(0x87ceeb);

    this.checkpointsData = [
      { id: 0, pos: new CANNON.Vec3(-31.00, 0.20, 3.01),      size: new CANNON.Vec3(0.8, 5, 25),  angle: -0.02  },
      { id: 1, pos: new CANNON.Vec3(-231.00, 25.12, -294.06), size: new CANNON.Vec3(12.0, 5, 0.8), angle: -2.715 },
      { id: 2, pos: new CANNON.Vec3(-156.48, 14.47, -196.73), size: new CANNON.Vec3(20.0, 5, 0.8), angle: 0.248  },
    ];

    this._setupLighting();
  }

  _setupLighting() {
    this.scene.add(new THREE.HemisphereLight(0xddeeff, 0x444444, 0.8));
    this.sunLight = new THREE.DirectionalLight(0xfff5b6, 3.5);
    this.sunLight.position.set(-30, 200, -45);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.camera.left = -180; this.sunLight.shadow.camera.right = 180;
    this.sunLight.shadow.camera.top = 180; this.sunLight.shadow.camera.bottom = -180;
    this.sunLight.shadow.mapSize.width = this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.bias = -0.0008;
    this.scene.add(this.sunLight);

    this.sunLight.target.position.set(-130, 0, -145);
    this.scene.add(this.sunLight.target);
  }

  loadAssets(onCarLoaded, onRacerLoaded, onComplete) {
    const manager = new THREE.LoadingManager();
    manager.onProgress = (url, loaded, total) => {
      if (window.updateLoadingProgress) window.updateLoadingProgress(Math.floor((loaded/total)*100));
    };
    manager.onLoad = () => { console.log('[scene] All resources are ready.'); onComplete(); };

    const loader = new THREE.GLTFLoader(manager);
    loader.load('./obj/laferrari_threejs.glb', onCarLoaded);
    loader.load('./obj/circuit_spielberg_light.glb', gltf => this._optimizeTrack(gltf.scene));
    loader.load('./obj/racer.glb', onRacerLoaded);
  }

  _optimizeTrack(track) {
    this.scene.add(track); track.updateMatrixWorld(true);
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);

    const INCLUDE_ROAD = ['road'];
    const INCLUDE_OFFROAD = ['tarmac', 'grass', 'gravel', 'sand_patches', 'pitlane', 'curb', 'kerb'];

    const INCLUDE_WALL = ['wall', 'barrier', 'plastic_barrier', 'safety_wall', 'pitwall', 'guardrail', 'armco', 'concrete', 'bump', 'bottom_spielberg', 'garages', 'paddock_base'];
    const SKIP = ['trees','tree','startlights','leds','light','led','seats','seat','noroof','prop_car','tent','rv_white','rv_beige','electrical_tower','banner','pole','adbox','distance_','white_lines','marking','garage_door','house','cone','red_bull','rb_ark','bridge','railing','support','fence','shadow','decal'];

    const gMat = typeof groundMaterial !== 'undefined' ? groundMaterial : new CANNON.Material('ground');
    let bodyCount = 0;

    track.traverse(n => {
      if (!n.isMesh) return;
      n.matrixAutoUpdate = false; n.updateMatrix();

      const nl = n.name.toLowerCase();
      const isSurface = nl.includes('tarmac') || nl.includes('road') || nl.includes('grass') || nl.includes('pitlane') || nl.includes('gravel');
      n.castShadow = !isSurface; n.receiveShadow = isSurface;

      if (SKIP.some(kw => nl.includes(kw))) return;
      const isRoad = INCLUDE_ROAD.some(kw => nl.includes(kw));
      const isOffroad = INCLUDE_OFFROAD.some(kw => nl.includes(kw));
      const isWall = INCLUDE_WALL.some(kw => nl.includes(kw));
      if (!isRoad && !isOffroad && !isWall) return;

      const pos = n.geometry.attributes.position;
      if (!pos || pos.count === 0) return;

      const verts = []; const _v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
        verts.push(_v.x, _v.y, _v.z);
      }

      const idxs = n.geometry.index ? Array.from(n.geometry.index.array) : Array.from({ length: pos.count }, (_, i) => i);
      const body = new CANNON.Body({ mass: 0, material: gMat, type: CANNON.Body.STATIC });
      body.addShape(new CANNON.Trimesh(verts, idxs));

      if (isRoad) {
        body.collisionFilterGroup = window.COLLISION_GROUP_ROAD;
      } else if (isOffroad) {
        body.collisionFilterGroup = window.COLLISION_GROUP_OFFROAD;
      } else {
        body.collisionFilterGroup = window.COLLISION_GROUP_WALL;
      }

      body.collisionFilterMask = window.COLLISION_GROUP_CAR;
      body.allowSleep = true;
      this.world.addBody(body); bodyCount++;
    });
  }

  setupCheckpoints(playerBody) {
    this.checkpointsData.forEach((data) => {
      const body = new CANNON.Body({ mass: 0, position: data.pos, type: CANNON.Body.STATIC });
      body.addShape(new CANNON.Box(data.size));
      body.isTrigger = true;
      if (data.angle !== undefined) body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), data.angle);

      body.collisionFilterGroup = window.COLLISION_GROUP_CHECKPOINT;
      body.collisionFilterMask = window.COLLISION_GROUP_CAR;

      body.addEventListener('collide', (e) => {
        if (e.body === playerBody) this._onCheckpointTriggered(data.id);
      });
      this.world.addBody(body);
    });
  }

  _onCheckpointTriggered(checkpointId) {
    if (checkpointId === window.nextCheckpointIndex) {
      const currentTime = performance.now();

      if (checkpointId === 0) {
        if (window.lapStartTime > 0) {
          window.lastLapTime = (currentTime - window.lapStartTime) / 1000;
          window.sectorTimes[2] = (currentTime - window.sectorStartTime) / 1000;
          if (typeof window.onSectorComplete === 'function') window.onSectorComplete(2, window.sectorTimes[2]);
          if (typeof window.updatePersonalBest === 'function') window.updatePersonalBest(window.lastLapTime);
          const lastLapEl = document.getElementById('last-lap-value');
          if (lastLapEl && typeof window.lastLapTime !== 'undefined') lastLapEl.textContent = (typeof formatTimeStrings === 'function' ? formatTimeStrings(window.lastLapTime) : window.lastLapTime.toFixed(3));
        }
        if (typeof window.resetSectorBoxes === 'function') window.resetSectorBoxes();
        window.lapStartTime = currentTime; window.sectorStartTime = currentTime;
      } else {
        const sectorId = checkpointId - 1;
        window.sectorTimes[sectorId] = (currentTime - window.sectorStartTime) / 1000;
        if (typeof window.onSectorComplete === 'function') window.onSectorComplete(sectorId, window.sectorTimes[sectorId]);
        window.sectorStartTime = currentTime;
      }
      window.nextCheckpointIndex = (window.nextCheckpointIndex + 1) % this.checkpointsData.length;
    }
  }
}