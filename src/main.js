window.updateLoadingProgress = function (pct) {
  const progressBar = document.getElementById('progress-bar');
  const progressText = document.getElementById('progress-text') || document.getElementById('loading-perc');
  if (progressBar) progressBar.style.width = pct + '%';
  if (progressText) progressText.textContent = pct + '%';
};

class Game {
  constructor() {
    this.FIXED_STEP = 1 / 60;
    this.MAX_SUBSTEPS = 1;
    this.lastTime = null;
    this.isPaused = false;

    this.fpsFrames = 0;
    this.fpsPrevTime = 0;

    window.nextCheckpointIndex = 0; window.lapStartTime = 0;
    window.sectorStartTime = 0; window.lastLapTime = 0;
    window.bestLapTime = window.bestLapTime || Infinity;
    window.sectorTimes = [0, 0, 0];

    this.scene = new THREE.Scene();
    this._initThreeJS();

    this.audioListener = new THREE.AudioListener();
    this.camera.add(this.audioListener);

    window.audioListener = this.audioListener;

    this.environment = new EnvironmentManager(this.scene, world);
    this.player = new PlayerController(this.scene, world);
    if (typeof window.RacerController === 'function') {
      this.racer = new window.RacerController(this.scene, this.camera, world);
    }

    this._bindEvents();
    this.environment.loadAssets(
      (gltf) => this.player.loadGLTF(gltf),
        (gltf) => this.racer.loadGLTF(gltf),
      () => this._onAssetsLoaded()
    );

    requestAnimationFrame((t) => this.loop(t));
  }

  _initThreeJS() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.style.visibility = 'hidden';
    document.body.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(0, 10, 20);
    this.freeCamPitch = 0;
    this.freeCamYaw = 0;

    if (typeof setupControls === 'function') {
      this.controls = setupControls(this.camera, this.renderer.domElement);
    }

    this._camOffset = new THREE.Vector3(0, 3.5, -10);
    this._camIdeal = new THREE.Vector3();
    this._camBodyQ = new THREE.Quaternion();
    this._camTarget = new THREE.Vector3();
  }

  _bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const btnPlayGrid = document.getElementById('btn-play');
    if (btnPlayGrid) {
      btnPlayGrid.onclick = () => {
        if (this.player.setSpawnMode) this.player.setSpawnMode('grid');
        this._startGame();
      };
    }

    const btnPlayPit = document.getElementById('btn-play-pit');
    if (btnPlayPit) {
      btnPlayPit.onclick = () => {
        if (this.player.setSpawnMode) this.player.setSpawnMode('pit');
        this._startGame('pit');
      };
    }

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && (State.phase === 'playing' || State.phase === 'walking')) {
        this._togglePause();
      }

      if (e.key.toLowerCase() === 'r') {
        if (typeof State !== 'undefined') {
           if (State.phase === 'walking' && this.racer) {
             this.racer.reset();
           } else if (State.phase === 'playing' && this.player) {
             this.player.reset();
           }
        }
      }
    });

    const btnResume = document.getElementById('btn-resume');
    if (btnResume) {
      btnResume.onclick = () => this._togglePause();
    }

    const btnCamera = document.getElementById('btn-camera');
    const panelCamera = document.getElementById('ui-camera-settings');
    const screenPause = document.getElementById('screen-pause');
    const btnCloseCamera = document.getElementById('btn-close-camera');

    if (btnCamera && panelCamera && screenPause) {
      btnCamera.onclick = () => {
        screenPause.classList.add('hidden');
        panelCamera.classList.remove('hidden');
      };

      if (btnCloseCamera) {
        btnCloseCamera.onclick = () => {
          panelCamera.classList.add('hidden');
          screenPause.classList.remove('hidden');
        };
      }

      const distSlider = document.getElementById('cam-dist');
      const heightSlider = document.getElementById('cam-height');
      const valDist = document.getElementById('val-dist');
      const valHeight = document.getElementById('val-height');

      const updateCameraLive = () => {
        if (!this._camOffset) return;

        const dist = parseFloat(distSlider.value);
        const height = parseFloat(heightSlider.value);

        valDist.textContent = dist.toFixed(1);
        valHeight.textContent = height.toFixed(1);

        this._camOffset.set(0, height, -dist);

        if (this.isPaused && State.phase === 'playing') {
          this._followCamera(1 / 60);
          this.renderer.render(this.scene, this.camera);
        }
      };

      if (distSlider && heightSlider) {
        distSlider.addEventListener('input', updateCameraLive);
        heightSlider.addEventListener('input', updateCameraLive);
      }
    }

    const btnQuit = document.getElementById('btn-quit');
    if (btnQuit) {
      btnQuit.onclick = () => this._quitToMainMenu();
    }

    const btnRestart = document.getElementById('btn-restart');
    if (btnRestart) {
      btnRestart.onclick = () => {
        document.getElementById('screen-gameover')?.classList.add('hidden');
        document.getElementById('hud')?.classList.remove('hidden');
        document.getElementById('ui-timing')?.classList.remove('hidden');

        // Assicurati che l'FPS riappaia al restart
        document.getElementById('fps-counter')?.classList.remove('hidden');

        this.player.reset();
        State.phase = 'playing';
      };
    }

    if (!this._walkCamListenersAdded) {
      window.addEventListener('mousedown', () => {
        if (State.phase === 'walking') this.isDraggingCam = true;
      });

      window.addEventListener('mouseup', () => {
        this.isDraggingCam = false;
      });

      window.addEventListener('mousemove', (e) => {
        if (State.phase === 'walking' && this.isDraggingCam) {
          const sensitivity = 0.005;
          this.walkCamYaw -= e.movementX * sensitivity;
          this.walkCamPitch -= e.movementY * sensitivity;
          this.walkCamPitch = Math.max(-0.1, Math.min(1.2, this.walkCamPitch));
        }
      });

      window.addEventListener('wheel', (e) => {
        if (State.phase === 'walking') {
          this.walkCamDistance += e.deltaY * 0.005;
          this.walkCamDistance = Math.max(2.0, Math.min(12.0, this.walkCamDistance));
        }
      }, { passive: true });

      this._walkCamListenersAdded = true;
    }
  }

  _togglePause() {
    this.isPaused = !this.isPaused;
    const pauseScreen = document.getElementById('screen-pause');

    if (this.isPaused) {
      this._pauseEnterTime = performance.now();
      if (pauseScreen) pauseScreen.classList.remove('hidden');
    } else {
      if (this._pauseEnterTime) {
        const timeSpentPaused = performance.now() - this._pauseEnterTime;
        if (window.lapStartTime > 0) window.lapStartTime += timeSpentPaused;
        if (window.sectorStartTime > 0) window.sectorStartTime += timeSpentPaused;
      }
      if (pauseScreen) pauseScreen.classList.add('hidden');
    }
  }

  _quitToMainMenu() {
    this.isPaused = false;
    document.getElementById('screen-pause')?.classList.add('hidden');

    ['ui-game', 'hud', 'ui-timing', 'screen-gameover', 'fps-counter', 'ui-controls'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    document.getElementById('screen-start')?.classList.remove('hidden');

    State.phase = 'ready';
    this.player.reset();

    if (typeof startCinematicLoop === 'function') {
      startCinematicLoop(this.camera);
    }
  }

  _startGame(mode) {
    document.getElementById('screen-start')?.classList.add('hidden');

    if (window.audioListener && window.audioListener.context.state === 'suspended') {
      window.audioListener.context.resume();
    }

    if (typeof stopCinematicLoop === 'function') {
      stopCinematicLoop();
    }

    if (mode === 'pit' && this.racer) {
      State.mode = 'play';
      State.phase = 'walking';

      ['ui-game', 'hud', 'ui-timing'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
      document.getElementById('ui-controls')?.classList.remove('hidden');

      this.racer.spawn();

      this.walkCamYaw = Math.PI / 2;
      this.walkCamPitch = 0.2;
      this.walkCamDistance = 4.5;
      this.isDraggingCam = false;

      if (this.controls) this.controls.enabled = false;

      return;
    }

    State.mode = 'play';

    if (typeof startRaceAnimation === 'function') {
      startRaceAnimation(() => {
        State.phase = 'playing';
        this._showGameHUD();
      });
    } else {
      State.phase = 'playing';
      this._showGameHUD();
    }
  }

  _showGameHUD() {
    ['ui-game', 'hud', 'ui-timing', 'fps-counter', 'ui-controls'].forEach(id => document.getElementById(id)?.classList.remove('hidden'));
  }

  _setPrompt(text) {
    let promptEl = document.getElementById('ui-action-prompt');
    if (!promptEl) {
      promptEl = document.createElement('div');
      promptEl.id = 'ui-action-prompt';
      promptEl.className = 'action-prompt hidden';
      document.body.appendChild(promptEl);
    }

    if (text) {
      promptEl.innerHTML = text;
      promptEl.classList.remove('hidden');
    } else {
      promptEl.classList.add('hidden');
    }
  }

  _onAssetsLoaded() {
    State.phase = 'ready';
    this.environment.setupCheckpoints(this.player.chassisBody);
    this.renderer.domElement.style.visibility = 'visible';
    document.getElementById('screen-loading')?.classList.add('hidden');
    document.getElementById('screen-start')?.classList.remove('hidden');

    if (typeof startCinematicLoop === 'function') {
      startCinematicLoop(this.camera);
    }

    window.gameInstance = this;
  }

  updateUI() {
    const speedEl = document.getElementById('speed') || document.getElementById('speed-value');
    if (speedEl && this.player.chassisBody) {
      speedEl.textContent = Math.floor(this.player.chassisBody.velocity.length() * 3.6);
    }
    const pitEl = document.getElementById('pit-limiter');
    if (pitEl && this.player) {
      pitEl.classList.toggle('hidden', !this.player._inPitLane);
    }
    const penaltyEl = document.getElementById('pit-penalty');
    if (penaltyEl && this.player) {
      if (this.player.pitPenalty > 0) {
        penaltyEl.textContent = `PENALTY +${this.player.pitPenalty}s`;
        penaltyEl.classList.remove('hidden');
      } else {
        penaltyEl.classList.add('hidden');
      }
    }
  }

  loop(time) {
    requestAnimationFrame((t) => this.loop(t));

    if (this.lastTime === null) this.lastTime = time;
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    if (this.isPaused) {
      this._setPrompt(null);
      return;
    }

    if (typeof TWEEN !== 'undefined') TWEEN.update(time);

    if (State.phase !== 'loading') {
      world.step(this.FIXED_STEP, dt, this.MAX_SUBSTEPS);
      if (typeof syncPhysics === 'function') syncPhysics();
    }

    const isPlaying = State.phase === 'playing';
    const isReady = State.phase === 'ready';
    const isWalking = State.phase === 'walking';

    if (isPlaying || isReady || isWalking) {
      this.player.update(dt, window.keys, isPlaying, window.devFlyMode);
    }

    let currentPrompt = null;

    if (isWalking && this.racer) {
      if (window.freeCamActive) {
        this.racer.mesh.visible = false;
        this._setPrompt(null);
      } else {
        this.racer.mesh.visible = true;
        this.racer.update(dt, window.keys);

        if (this.player.playerMesh) {
          const carPos = this.player.playerMesh.position;
          const rPos = this.racer.mesh.position;
          const dx = rPos.x - carPos.x;
          const dz = rPos.z - carPos.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          const minDist = 2.0;
          if (dist < minDist && dist > 0.001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const nz = dz / dist;
            this.racer.body.position.x += nx * overlap * 1.5;
            this.racer.body.position.z += nz * overlap * 1.5;
            const vDot = this.racer.body.velocity.x * nx + this.racer.body.velocity.z * nz;
            if (vDot < 0) {
              this.racer.body.velocity.x -= vDot * nx;
              this.racer.body.velocity.z -= vDot * nz;
            }
            this.racer.mesh.position.set(
              this.racer.body.position.x,
              this.racer.body.position.y - 0.9,
              this.racer.body.position.z
            );
          }
        }

        const rPos = this.racer.mesh.position;

        if (window.mouse) {
          const sensitivity = 0.0025;
          this.walkCamYaw   -= window.mouse.deltaX * sensitivity;
          this.walkCamPitch -= window.mouse.deltaY * sensitivity;
          this.walkCamPitch = Math.max(-0.1, Math.min(1.2, this.walkCamPitch));
          window.mouse.deltaX = 0;
          window.mouse.deltaY = 0;
        }

        const offset = new THREE.Vector3(
          Math.cos(this.walkCamPitch) * Math.sin(this.walkCamYaw),
          Math.sin(this.walkCamPitch),
          Math.cos(this.walkCamPitch) * Math.cos(this.walkCamYaw)
        ).multiplyScalar(this.walkCamDistance);

        const targetLook = new THREE.Vector3(rPos.x, rPos.y + 1.2, rPos.z);
        this.camera.position.copy(targetLook).add(offset);
        this.camera.lookAt(targetLook);

        if (this.player.playerMesh) {
          const carPos = this.player.playerMesh.position;
          const distance = rPos.distanceTo(carPos);

          if (distance < 3.5) {
            currentPrompt = '<span class="key-btn">E</span> ENTER CAR';

            if (window.keys.e) {
              window.keys.e = false;
              this.racer.hide();

              State.mode = 'play';
              State.phase = 'playing';
              this._showGameHUD();

              const cb = this.player.chassisBody;
              this._camBodyQ.set(cb.quaternion.x, cb.quaternion.y, cb.quaternion.z, cb.quaternion.w);
              this._camIdeal.copy(this._camOffset).applyQuaternion(this._camBodyQ).add(carPos);

              this.camera.position.copy(this._camIdeal);
              this._camTarget.copy(carPos);
              this._camTarget.y += 1.2;
              this.camera.lookAt(this._camTarget);

              window.keys.w = window.keys.a = window.keys.s = window.keys.d = false;
            }
          } else {
            currentPrompt = 'REACH THE CAR';
          }
        }
      }
    } else if (isPlaying) {
      this.updateUI();
      if (typeof window.updateLiveTimer === 'function') window.updateLiveTimer();

      const carSpeed = this.player.chassisBody.velocity.length();

      if (carSpeed < 1.0) {
        currentPrompt = '<span class="key-btn">E</span> EXIT CAR';

        if (window.keys.e) {
          window.keys.e = false;
          State.phase = 'walking';

          ['ui-game', 'hud', 'ui-timing'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
          document.getElementById('ui-controls')?.classList.remove('hidden');

          const carPos = this.player.chassisBody.position;
          const carQuat = this.player.chassisBody.quaternion;
          const leftOffset = new CANNON.Vec3(2.5, 1.0, 0);
          carQuat.vmult(leftOffset, leftOffset);

          this.racer.spawn(new CANNON.Vec3(carPos.x + leftOffset.x, carPos.y + 1.0, carPos.z + leftOffset.z));

          const currentEuler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
          this.walkCamYaw = currentEuler.y;
          this.walkCamPitch = 0.2;
          this.walkCamDistance = 4.5;
        }
      }

      if (window.keys.shift && this.controls) {
        this.controls.enabled = true;
        if (this.player.playerMesh) this.controls.target.copy(this.player.playerMesh.position);
      } else {
        if (this.controls) this.controls.enabled = false;
        this._followCamera(dt);
      }
    }

    if (isWalking || isReady) {
      if (window.freeCamActive) {
        this._followCamera(dt);
      } else if (this._hudHidden) {
        this._hudHidden = false;
      }
    }

    this._setPrompt(currentPrompt);

    if (this.controls?.enabled) this.controls.update();

    this.renderer.render(this.scene, this.camera);

    if (!this.fpsPrevTime) this.fpsPrevTime = time;
    this.fpsFrames++;
    if (time - this.fpsPrevTime >= 1000) {
      const fpsEl = document.getElementById('fps-value');
      if (fpsEl) fpsEl.textContent = this.fpsFrames;
      const counterEl = document.getElementById('fps-counter');
      if (counterEl) {
        if (this.fpsFrames >= 55) counterEl.style.color = '#2ecc71';
        else if (this.fpsFrames >= 30) counterEl.style.color = '#f1c40f';
        else counterEl.style.color = '#e74c3c';
      }
      this.fpsFrames = 0;
      this.fpsPrevTime = time;
    }
  }

  _followCamera(dt) {
    if (!this.camera) return;

    const hudIds = ['hud', 'ui-timing', 'ui-game', 'fps-counter'];

    if (window.freeCamActive) {
      if (!this._hudHidden) {
        this._hudHidden = true;
        hudIds.forEach(id => document.getElementById(id)?.classList.add('hidden'));
      }

      const sensitivity = 0.0022;

      this.freeCamYaw   -= window.mouse.deltaX * sensitivity;
      this.freeCamPitch -= window.mouse.deltaY * sensitivity;
      window.mouse.deltaX = 0;
      window.mouse.deltaY = 0;

      this.freeCamPitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.freeCamPitch));
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.freeCamPitch, this.freeCamYaw, 0, 'YXZ'));

      const speed = (window.keys.shift ? 80 : 20) * dt;
      const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
      const right   = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);

      if (window.keys.w) this.camera.position.addScaledVector(forward,  speed);
      if (window.keys.s) this.camera.position.addScaledVector(forward, -speed);
      if (window.keys.a) this.camera.position.addScaledVector(right,   -speed);
      if (window.keys.d) this.camera.position.addScaledVector(right,    speed);
      if (window.keys.space) this.camera.position.y += speed;
      if (window.keys.q)     this.camera.position.y -= speed;

      return;
    }

    if (this._hudHidden) {
      this._hudHidden = false;
      if (State.phase === 'playing') {
        hudIds.forEach(id => document.getElementById(id)?.classList.remove('hidden'));
      }
    }

    const currentEuler = new THREE.Euler().setFromQuaternion(this.camera.quaternion, 'YXZ');
    this.freeCamYaw = currentEuler.y;
    this.freeCamPitch = currentEuler.x;

    if (!this.player.vehicle || !this.player.chassisBody || !this.player.playerMesh) return;

    const cb = this.player.chassisBody;
    this._camBodyQ.set(cb.quaternion.x, cb.quaternion.y, cb.quaternion.z, cb.quaternion.w);
    this._camIdeal.copy(this._camOffset).applyQuaternion(this._camBodyQ).add(this.player.playerMesh.position);

    this.camera.position.lerp(this._camIdeal, 1 - Math.exp(-8 * dt));

    this._camTarget.copy(this.player.playerMesh.position);
    this._camTarget.y += 1.2;
    this.camera.lookAt(this._camTarget);
  }
}

window.gameInstance = new Game();