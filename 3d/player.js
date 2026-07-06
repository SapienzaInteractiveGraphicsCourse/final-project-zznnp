class PlayerController {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.smokeManager = new SmokeManager(scene);

    this.CHASSIS_MESH_Y_OFFSET = -0.15;

    this.GRID_SPAWN_POS = new CANNON.Vec3(-23, 0, 2);
    this.GRID_SPAWN_ANGLE = -Math.PI / 2;

    this.PIT_SPAWN_POS = new CANNON.Vec3(32.77, 0, -7.16);
    this.PIT_SPAWN_ANGLE = -Math.PI / 2;

    this.PIT_ZONE = {
      xA: 117.13,
      zA: -1.36,
      xC: -129.5,
      zC: -4.79,
      minY: -5.0,
      maxY: 10.0,
      width: 10.0
    };

    this.PIT_ZONE.dx = this.PIT_ZONE.xC - this.PIT_ZONE.xA;
    this.PIT_ZONE.dz = this.PIT_ZONE.zC - this.PIT_ZONE.zA;
    this.PIT_ZONE.lengthSq = (this.PIT_ZONE.dx * this.PIT_ZONE.dx) + (this.PIT_ZONE.dz * this.PIT_ZONE.dz);
    this.PIT_ZONE.length = Math.sqrt(this.PIT_ZONE.lengthSq);

    this.SPAWN_POS = this.GRID_SPAWN_POS;
    this.SPAWN_ANGLE = this.GRID_SPAWN_ANGLE;

    this.WHEEL_COUNT = 4;

    this.playerMesh = null;
    this.vehicle = null;
    this.chassisBody = null;
    this.playerReady = false;

    this.currentSteer = 0;
    this.currentEngineForce = 0;
    this.currentBrakeForce = 0;
    this.pitPenalty = 0;
    this._penalizedThisEntry = false;

    this.scratchDownforceVector = new CANNON.Vec3();
    this.scratchZeroVector = new CANNON.Vec3(0, 0, 0);
    this._localOff = new THREE.Vector3();

    this.wheels = Array.from({ length: this.WHEEL_COUNT }, () => ({
      group: null, pivotGroup: null, meshNode: null
    }));

    this._initPhysics();
  }

  setSpawnMode(mode) {
    if (mode === 'pit') {
      this.SPAWN_POS = this.PIT_SPAWN_POS;
      this.SPAWN_ANGLE = this.PIT_SPAWN_ANGLE;
    } else {
      this.SPAWN_POS = this.GRID_SPAWN_POS;
      this.SPAWN_ANGLE = this.GRID_SPAWN_ANGLE;
    }

    if (this.chassisBody) this.reset();
  }

  _initPhysics() {
    const chassisMat = (typeof chassisMaterial !== 'undefined') ? chassisMaterial : new CANNON.Material('chassis');
    const wheelMat = (typeof wheelMaterial !== 'undefined') ? wheelMaterial : new CANNON.Material('wheel');

    this.chassisBody = new CANNON.Body({
      mass: 1500,
      material: chassisMat,
      angularDamping: 0.6,
      linearDamping: 0.01,
      type: CANNON.Body.STATIC,
    });

    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(1.03, 0.495, 2.30)), new CANNON.Vec3(0, 0.5, 0));
    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.85, 0.12, 2.10)), new CANNON.Vec3(0, 0.10, 0));

    const sphereRadius = 0.5;
    [
      new CANNON.Vec3(-0.85, 0.50,  1.95), new CANNON.Vec3( 0.85, 0.50,  1.95),
      new CANNON.Vec3(-0.85, 0.50, -1.95), new CANNON.Vec3( 0.85, 0.50, -1.95)
    ].forEach(p => this.chassisBody.addShape(new CANNON.Sphere(sphereRadius), p));

    this.chassisBody.collisionFilterGroup = window.COLLISION_GROUP_CAR;
    this.chassisBody.collisionFilterMask = window.COLLISION_GROUP_WALL | window.COLLISION_GROUP_CHECKPOINT;

    this.chassisBody.position.copy(this.SPAWN_POS);
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.SPAWN_ANGLE);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0, indexUpAxis: 1, indexForwardAxis: 2,
    });

    const originalCastRay = this.vehicle.castRay.bind(this.vehicle);
    this.vehicle.castRay = (wheel) => {
      const target = this.vehicle.chassisBody;
      const oldMask = target.collisionFilterMask;
      target.collisionFilterMask = window.COLLISION_GROUP_ROAD | window.COLLISION_GROUP_OFFROAD;
      const res = originalCastRay(wheel);
      target.collisionFilterMask = oldMask;
      return res;
    };

    const BASE_WHEEL = {
      radius: 0.33, directionLocal: new CANNON.Vec3(0, -1, 0), axleLocal: new CANNON.Vec3(-1, 0, 0),
      suspensionStiffness: 35, suspensionRestLength: 0.25, maxSuspensionTravel: 0.3, maxSuspensionForce: 250_000,
      dampingRelaxation: 3.8, dampingCompression: 5.5, rollInfluence: 0.01,
      useCustomSlidingRotationalSpeed: true, customSlidingRotationalSpeed: -30,
    };

    const WHEEL_POSITIONS = [
      new CANNON.Vec3(-0.88, 0.15, 1.30), new CANNON.Vec3( 0.88, 0.15, 1.30),
      new CANNON.Vec3(-0.88, 0.15, -1.28), new CANNON.Vec3( 0.88, 0.15, -1.28),
    ];

    WHEEL_POSITIONS.forEach((pos, idx) => {
      this.vehicle.addWheel({
        ...BASE_WHEEL,
        chassisConnectionPointLocal: pos,
        frictionSlip: (idx < 2) ? 3.5 : 3.0
      });
    });

    this.vehicle.wheelInfos.forEach(w => { w.wheelMaterial = wheelMat; });

    this.chassisBody.addEventListener("collide", (e) => {
      if (typeof State === 'undefined' || State.phase !== 'playing') return;
      if (e.body && e.body.isTrigger) return;

      const relativeVelocity = e.contact.getImpactVelocityAlongNormal();

      if (Math.abs(relativeVelocity) > 15.0) {
        State.phase = 'gameover';

        const crashSpeedKmh = Math.floor(this.chassisBody.velocity.length() * 3.6);

        this.currentEngineForce = 0;
        for(let i=0; i<4; i++) this.vehicle.setBrake(10000, i);

        if (this.engineSound) this.engineSound.setVolume(0);
        if (this.screechSound) this.screechSound.setVolume(0);

        const gameOverScreen = document.getElementById('screen-gameover');
        const finalScore = document.getElementById('final-score');

        if (gameOverScreen && finalScore) {
          gameOverScreen.classList.remove('hidden');
          document.getElementById('hud')?.classList.add('hidden');
          document.getElementById('ui-timing')?.classList.add('hidden');
          document.getElementById('ui-controls')?.classList.add('hidden');
          finalScore.innerHTML = `Fatal crash at <b>${crashSpeedKmh} km/h</b>!`;
        }
      }
    });
  }

  _initAudio() {
    if (!window.audioListener) return;

    this.engineSound = new THREE.PositionalAudio(window.audioListener);
    this.screechSound = new THREE.PositionalAudio(window.audioListener);

    const audioLoader = new THREE.AudioLoader();

    audioLoader.load('audio/843123__fnakez__engine-idle-cut.ogg', (buffer) => {
      this.engineSound.setBuffer(buffer);
      this.engineSound.setRefDistance(10);
      this.engineSound.setLoop(true);
      this.engineSound.setVolume(0);
      this.engineSound.play();
    });

    audioLoader.load('audio/536769__egomassive__tire.ogg', (buffer) => {
      this.screechSound.setBuffer(buffer);
      this.screechSound.setRefDistance(10);
      this.screechSound.setLoop(true);
      this.screechSound.setVolume(0);
      this.screechSound.play();
    });
  }

  loadGLTF(gltf) {
    this.playerMesh = gltf.scene;
    const WHEEL_NAME_MAP = { 'wheel_fl':0, 'wheel_fr':1, 'wheel_rl':2, 'wheel_rr':3 };

    this.playerMesh.traverse(node => {
      const k = node.name.toLowerCase();
      if (k in WHEEL_NAME_MAP) this.wheels[WHEEL_NAME_MAP[k]].meshNode = node;

      if (node.isMesh && node.material) {
        const isGlass = k.includes('glass') || k.includes('window') || k.includes('finestrino');
        node.castShadow = true; node.receiveShadow = true;
        node.material.depthWrite = true; node.material.side = THREE.FrontSide;
        node.material.transparent = isGlass; node.material.opacity = isGlass ? 0.45 : 1.0;
        if (k.includes('body') || k.includes('lacar')) { node.material.metalness = 0.0; node.material.roughness = 1.0; }
      }
    });

    this.scene.add(this.playerMesh);
    this.playerMesh.updateWorldMatrix(true, true);

    this.wheels.forEach((wheel) => {
      if (!wheel.meshNode) return;
      const worldCenter = new THREE.Vector3();
      wheel.meshNode.getWorldPosition(worldCenter);
      this.scene.attach(wheel.meshNode);

      wheel.group = new THREE.Group(); wheel.group.position.copy(worldCenter);
      this.scene.add(wheel.group);
      wheel.pivotGroup = new THREE.Group(); wheel.group.add(wheel.pivotGroup);

      wheel.pivotGroup.attach(wheel.meshNode);
      wheel.pivotGroup.rotation.y = Math.PI;

      wheel.meshNode.traverse(node => {
        if (node.isMesh && node.material) {
          node.castShadow = true; node.receiveShadow = true;
          node.material.depthWrite = true; node.material.side = THREE.DoubleSide;
        }
      });
    });

    this.world.addBody(this.chassisBody);
    this.vehicle.addToWorld(this.world);
    this._syncMeshToBody();

    this._initAudio();
    if (this.engineSound) this.playerMesh.add(this.engineSound);
    if (this.screechSound) this.playerMesh.add(this.screechSound);

    this.playerReady = true;
    this._updateVisibility();
  }

  _updateVisibility() {
    if (!this.playerMesh) return;

    let isVisible = true;

    if (typeof State !== 'undefined') {
      if (State.phase === 'loading' || State.phase === 'ready' || State.phase === 'gameover') {
        isVisible = false;
      }
    }

    if (window.freeCamActive) isVisible = false;

    this.playerMesh.visible = isVisible;
    this.wheels.forEach(wheel => {
      if (wheel.group) wheel.group.visible = isVisible;
    });

    if (this.engineSound) {
      this.engineSound.setVolume(isVisible ? 0.8 : 0);
    }
    if (this.screechSound) {
      this.screechSound.setVolume(0);
    }
  }

  reset() {
    this.chassisBody.type = CANNON.Body.DYNAMIC;
    this.chassisBody.position.copy(this.SPAWN_POS);
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);
    this.chassisBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), this.SPAWN_ANGLE);

    this.currentSteer = this.currentEngineForce = this.currentBrakeForce = 0;
    this.vehicle.setSteeringValue(0, 0); this.vehicle.setSteeringValue(0, 1);
    this.vehicle.applyEngineForce(0, 2); this.vehicle.applyEngineForce(0, 3);
    for(let i=0; i<4; i++) this.vehicle.setBrake(0, i);

    this.pitPenalty = 0; this._penalizedThisEntry = false;
    window.lapStartTime = 0; window.sectorStartTime = 0; window.nextCheckpointIndex = 0;
    if (typeof window.resetSectorBoxes === 'function') window.resetSectorBoxes();
  }

  _syncMeshToBody() {
    if (!this.playerMesh) return;
    this.playerMesh.position.copy(this.chassisBody.position);
    this.playerMesh.quaternion.copy(this.chassisBody.quaternion);
    this._localOff.set(0, this.CHASSIS_MESH_Y_OFFSET, 0).applyQuaternion(this.playerMesh.quaternion);
    this.playerMesh.position.add(this._localOff);
  }

  update(dt, keys, isPlaying, devFlyMode) {
    if (!this.playerReady) return;
    dt = dt > 0.1 ? 0.016 : dt;

    this._updateVisibility();

    if (devFlyMode) return this._handleDevFlyMode(dt, keys);

    const shouldBeStatic = (typeof State !== 'undefined' && State.phase === 'ready');
    const isWalking = (typeof State !== 'undefined' && State.phase === 'walking');

    if ((isPlaying || isWalking) && this.chassisBody.type === CANNON.Body.STATIC) {
      this.reset();
      this.chassisBody.type = CANNON.Body.DYNAMIC;
      this.chassisBody.wakeUp();
    } else if (shouldBeStatic) {
      if (this.chassisBody.type !== CANNON.Body.STATIC) {
        this.chassisBody.type = CANNON.Body.STATIC;
      }
      this.chassisBody.velocity.set(0, 0, 0);
      this.chassisBody.angularVelocity.set(0, 0, 0);
    }

    this._syncMeshToBody();

    for (let i = 0; i < this.WHEEL_COUNT; i++) {
      this.vehicle.updateWheelTransform(i);
      const wt = this.vehicle.wheelInfos[i].worldTransform;
      if (this.wheels[i].group) {
        this.wheels[i].group.position.set(wt.position.x, wt.position.y, wt.position.z);
        this.wheels[i].group.quaternion.set(wt.quaternion.x, wt.quaternion.y, wt.quaternion.z, wt.quaternion.w);
      }
    }

    if (this.smokeManager) this.smokeManager.update(dt);

    const speed = this.chassisBody.velocity.length();

    const carX = this.chassisBody.position.x;
    const carY = this.chassisBody.position.y;
    const carZ = this.chassisBody.position.z;
    const pit = this.PIT_ZONE;

    const cx = carX - pit.xA;
    const cz = carZ - pit.zA;

    const t = (cx * pit.dx + cz * pit.dz) / pit.lengthSq;
    const distZ = (cz * pit.dx - cx * pit.dz) / pit.length;

    this._inPitLane = (
      t >= 0.0 && t <= 1.0 &&
      carY >= pit.minY && carY <= pit.maxY &&
      distZ >= 0.0 && distZ <= pit.width
    );

    if (this._inPitLane && speed > 17.00) {
      if (!this._penalizedThisEntry) {
        this.pitPenalty += 10;
        this._penalizedThisEntry = true;
        this._showPenaltyNotification();
      }
    } else if (!this._inPitLane) {
      this._penalizedThisEntry = false;
    }

    if (this.engineSound && this.engineSound.isPlaying && this.playerMesh.visible) {
      const targetPitch = Math.min(1.0 + (speed / 90.0), 1.6);
      this.engineSound.setPlaybackRate(targetPitch);
    }

    let isSkidding = false;
    if (this.vehicle && this.vehicle.wheelInfos && this.smokeManager && isPlaying) {
      const isBraking = keys.s || keys.space;
      if (speed > 5.0 && isBraking) {
        this.vehicle.wheelInfos.forEach(wheel => {
          if (wheel.raycastResult.hasHit && wheel.skidInfo < 0.3) {
            isSkidding = true;
            if (Math.random() < 0.3 && this.playerMesh.visible) {
              const hitPoint = new THREE.Vector3(wheel.raycastResult.hitPointWorld.x, wheel.raycastResult.hitPointWorld.y, wheel.raycastResult.hitPointWorld.z);
              this.smokeManager.emit(hitPoint);
            }
          }
        });
      }
    }

    if (this.screechSound && this.screechSound.isPlaying) {
      const targetVolume = (isSkidding && this.playerMesh.visible) ? 1.0 : 0.0;
      this.screechSound.setVolume(THREE.MathUtils.lerp(this.screechSound.getVolume(), targetVolume, dt * 10));
    }

    if (isWalking) {
      for (let i = 0; i < this.WHEEL_COUNT; i++) {
        this.vehicle.setBrake(100, i);
      }
      return;
    } else {
      for (let i = 0; i < this.WHEEL_COUNT; i++) {
        this.vehicle.setBrake(0, i);
      }
    }

    if (!isPlaying) return;

    if (this.chassisBody.position.y < -10) this.reset();

    const downforceMagnitude = Math.min(speed * 20.0, 2500);
    this.scratchDownforceVector.set(0, -downforceMagnitude, 0);
    this.chassisBody.applyLocalForce(this.scratchDownforceVector, this.scratchZeroVector);

    const activeKeys = window.freeCamActive ? { w: false, a: false, s: false, d: false, space: false, e: false } : keys;
    this._applyInputs(dt, activeKeys, speed);
  }

  _applyInputs(dt, keys, speed) {
    const MAX_ENGINE = 6000, MAX_BRAKE = 3000, ACCEL_RATE = 5000;
    const STEER_IN = 3.5, STEER_OUT = 10.0;
    const maxSteer = Math.max(0.18, 0.36 - speed * 0.0025);

    let isPitLimited = false;
    let pitLimiterBrake = 0;

    if (this._inPitLane) {
      const PIT_SPEED_LIMIT_MPS = 16.67;

      if (speed >= PIT_SPEED_LIMIT_MPS) {
        isPitLimited = true;
        pitLimiterBrake = 1200;
      }
    }

    if (keys.w && !isPitLimited) {
      this.currentEngineForce = Math.max(this.currentEngineForce - ACCEL_RATE * dt, -MAX_ENGINE);
    } else if (keys.s) {
      this.currentEngineForce = Math.min(this.currentEngineForce + ACCEL_RATE * dt, MAX_ENGINE);
    } else {
      const d = ACCEL_RATE * 1.5 * dt;
      if (this.currentEngineForce > d) this.currentEngineForce -= d;
      else if (this.currentEngineForce < -d) this.currentEngineForce += d;
      else this.currentEngineForce = 0;
    }

    if (isPitLimited && this.currentEngineForce < 0) {
        this.currentEngineForce = 0;
    }

    this.currentBrakeForce = keys.space ? Math.min(this.currentBrakeForce + 500 * dt, MAX_BRAKE) : 0;
    const finalBrake = Math.max(this.currentBrakeForce, pitLimiterBrake);

    const targetSteer = keys.a ? maxSteer : (keys.d ? -maxSteer : 0);
    const sr = (targetSteer === 0 ? STEER_OUT : STEER_IN) * dt;
    const sd = targetSteer - this.currentSteer;
    this.currentSteer += Math.sign(sd) * Math.min(sr, Math.abs(sd));
    if (targetSteer === 0 && Math.abs(this.currentSteer) < 0.005) this.currentSteer = 0;

    this.vehicle.setSteeringValue(this.currentSteer, 0);
    this.vehicle.setSteeringValue(this.currentSteer, 1);

    this.vehicle.applyEngineForce(this.currentEngineForce, 2);
    this.vehicle.applyEngineForce(this.currentEngineForce, 3);

    this.vehicle.setBrake(finalBrake * 0.60, 0);
    this.vehicle.setBrake(finalBrake * 0.60, 1);
    this.vehicle.setBrake(finalBrake * 0.40, 2);
    this.vehicle.setBrake(finalBrake * 0.40, 3);
  }

  _showPenaltyNotification() {
    const toast = document.getElementById('pit-penalty-toast');
    if (!toast) return;
    toast.classList.remove('hidden');
    toast.style.animation = 'none';
    void toast.offsetHeight;
    toast.style.animation = 'fadeOut 2s forwards';
    setTimeout(() => toast.classList.add('hidden'), 2000);
  }

  _handleDevFlyMode(dt, keys) {
    this.chassisBody.velocity.set(0,0,0); this.chassisBody.angularVelocity.set(0,0,0);
    const flySpeed = 80 * dt, rotSpeed = 3.5 * dt;
    const forward = new CANNON.Vec3(0, 0, 1);
    this.chassisBody.quaternion.vmult(forward, forward);

    if (keys.w) { this.chassisBody.position.x += forward.x * flySpeed; this.chassisBody.position.z += forward.z * flySpeed; }
    if (keys.s) { this.chassisBody.position.x -= forward.x * flySpeed; this.chassisBody.position.z -= forward.z * flySpeed; }
    if (keys.a) this.chassisBody.quaternion = this.chassisBody.quaternion.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), rotSpeed));
    if (keys.d) this.chassisBody.quaternion = this.chassisBody.quaternion.mult(new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -rotSpeed));
    if (keys.q) this.chassisBody.position.y += flySpeed * 0.6;
    if (keys.e) this.chassisBody.position.y -= flySpeed * 0.6;
    this._syncMeshToBody();
  }
}