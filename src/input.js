window.keys = {
  w: false, a: false, s: false, d: false,
  space: false, shift: false, q: false, e: false, r: false
};
const keys = window.keys;

window.devFlyMode  = false;
window.freeCamActive = false;

window.mouse = { deltaX: 0, deltaY: 0 };

document.addEventListener('click', () => {
  if (window.freeCamActive) {
    document.body.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {});

document.addEventListener('mousemove', (e) => {
  if (!window.freeCamActive) return;
  window.mouse.deltaX += e.movementX;
  window.mouse.deltaY += e.movementY;
});

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  if (keys.hasOwnProperty(key)) keys[key] = true;
  if (key === 'arrowup')    keys.w     = true;
  if (key === 'arrowdown')  keys.s     = true;
  if (key === 'arrowleft')  keys.a     = true;
  if (key === 'arrowright') keys.d     = true;
  if (e.code === 'Space')   keys.space = true;
  if (e.shiftKey)           keys.shift = true;

  if (key === 'r') {
    if (window.gameInstance?.player) {
      window.gameInstance.player.reset();
    }
  }

  if (key === 'v') {
    window.freeCamActive = !window.freeCamActive;

    if (window.freeCamActive) {
      document.body.requestPointerLock?.();
    } else {
      document.exitPointerLock?.();
    }
  }

  if (key === 'l') {
    const p = window.gameInstance?.camera?.position;
    if (!p) return;
    const r = n => Math.round(n * 100) / 100;
    console.log(`x: ${r(p.x)}, y: ${r(p.y)}, z: ${r(p.z)}`);
  }
});

window.addEventListener('keyup', (e) => {
  const key = e.key.toLowerCase();

  if (keys.hasOwnProperty(key)) keys[key] = false;
  if (key === 'arrowup')    keys.w     = false;
  if (key === 'arrowdown')  keys.s     = false;
  if (key === 'arrowleft')  keys.a     = false;
  if (key === 'arrowright') keys.d     = false;
  if (e.code === 'Space')   keys.space = false;
  if (!e.shiftKey)          keys.shift = false;
});