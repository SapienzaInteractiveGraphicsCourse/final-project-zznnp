class SmokeManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];

    this.poolSize = 120;

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(230, 230, 230, 0.6)');
    gradient.addColorStop(0.4, 'rgba(200, 200, 200, 0.2)');
    gradient.addColorStop(1, 'rgba(100, 100, 100, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const smokeTexture = new THREE.CanvasTexture(canvas);

    this.material = new THREE.SpriteMaterial({
      map: smokeTexture,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    for (let i = 0; i < this.poolSize; i++) {
      const sprite = new THREE.Sprite(this.material);
      sprite.visible = false;
      this.scene.add(sprite);

      this.particles.push({
        mesh: sprite,
        life: 0,
        maxLife: 0,
        velocity: new THREE.Vector3(),
        baseScale: 1.0
      });
    }
  }

  emit(position) {
    const p = this.particles.find(part => part.life <= 0);
    if (!p) return;

    p.mesh.position.copy(position);
    p.mesh.position.y += 0.2;

    p.maxLife = 0.6 + Math.random() * 0.5;
    p.life = p.maxLife;
    p.baseScale = 0.8 + Math.random() * 1.0;
    p.mesh.visible = true;


    p.velocity.set(
      (Math.random() - 0.5) * 4.0,
      0.5 + Math.random() * 2.0,
      (Math.random() - 0.5) * 4.0
    );
  }

  update(dt) {
    this.particles.forEach(p => {
      if (p.life > 0) {
        p.life -= dt;

        if (p.life <= 0) {
          p.mesh.visible = false;
        } else {
          p.velocity.x *= 0.95;
          p.velocity.z *= 0.95;

          p.velocity.y += 0.8 * dt;

          p.mesh.position.addScaledVector(p.velocity, dt);

          const ageRatio = 1.0 - (p.life / p.maxLife);
          const currentScale = p.baseScale * (1.0 + ageRatio * 3.5);
          p.mesh.scale.set(currentScale, currentScale, 1);

          p.mesh.material.opacity = Math.pow(p.life / p.maxLife, 1.5);
        }
      }
    });
  }
}