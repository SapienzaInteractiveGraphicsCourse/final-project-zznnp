const _cinematic = {
  active:      false,
  shotIndex:   0,
  tween:       null,
  camRef:      null,
  _pos:        { x: 0, y: 0, z: 0 },
};

function _getEasing(name) {
  switch (name) {
    case 'quadIn':     return TWEEN.Easing.Quadratic.In;
    case 'quadOut':    return TWEEN.Easing.Quadratic.Out;
    case 'quadInOut':  return TWEEN.Easing.Quadratic.InOut;
    case 'cubicInOut': return TWEEN.Easing.Cubic.InOut;
    case 'linear':
    default:           return TWEEN.Easing.Linear.None;
  }
}

function _playShot(cam, shotIndex) {
  if (!_cinematic.active) return;

  const shot = CIRCUIT_SHOTS[shotIndex % CIRCUIT_SHOTS.length];
  _cinematic.shotIndex = shotIndex;

  cam.position.set(shot.from.x, shot.from.y, shot.from.z);
  cam.lookAt(shot.lookAt.x, shot.lookAt.y, shot.lookAt.z);

  _cinematic._pos.x = shot.from.x;
  _cinematic._pos.y = shot.from.y;
  _cinematic._pos.z = shot.from.z;

  _cinematic.tween = new TWEEN.Tween(_cinematic._pos)
    .to({ x: shot.to.x, y: shot.to.y, z: shot.to.z }, shot.duration)
    .easing(_getEasing(shot.easing))
    .onUpdate(() => {
      cam.position.set(_cinematic._pos.x, _cinematic._pos.y, _cinematic._pos.z);
      cam.lookAt(shot.lookAt.x, shot.lookAt.y, shot.lookAt.z);
    })
    .onComplete(() => {
      setTimeout(() => {
        if (_cinematic.active) {
          _playShot(cam, (_cinematic.shotIndex + 1) % CIRCUIT_SHOTS.length);
        }
      }, 400);
    })
    .start();
}

function startCinematicLoop(cam) {
  _cinematic.active   = true;
  _cinematic.camRef   = cam;
  _cinematic.shotIndex = 0;

  const startShot = Math.floor(Math.random() * CIRCUIT_SHOTS.length);
  _playShot(cam, startShot);
}

function stopCinematicLoop() {
  _cinematic.active = false;
  if (_cinematic.tween) {
    _cinematic.tween.stop();
    _cinematic.tween = null;
  }
}

function startRaceAnimation(callback) {
  stopCinematicLoop();

  if (!window.racerMesh || !window.playerMesh) {
    if (callback) callback();
    return;
  }

  const racer  = window.racerMesh;
  const player = window.playerMesh;

  if (racer.parent !== scene) scene.attach(racer);

  racer.position.set(player.position.x - 2, player.position.y, player.position.z);
  racer.visible = true;

  const t1 = new TWEEN.Tween(racer.position)
    .to({ x: player.position.x, y: player.position.y + 5, z: player.position.z }, 800)
    .easing(TWEEN.Easing.Quadratic.Out);

  const t2 = new TWEEN.Tween(racer.position)
    .to({ x: player.position.x, y: player.position.y + 0.4, z: player.position.z }, 500)
    .easing(TWEEN.Easing.Bounce.Out)
    .onComplete(() => {
      scene.attach(racer);
      player.attach(racer);
      racer.position.set(0, 0.4, -0.2);
      racer.rotation.set(0, Math.PI / 2, 0);
      if (callback) callback();
    });

  t1.chain(t2);
  t1.start();
}