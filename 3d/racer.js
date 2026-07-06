class RacerController {
  constructor(scene, camera, world) {
    this.scene = scene;
    this.camera = camera;
    this.world = world;
    this.mesh = new THREE.Group();
    this.mesh.visible = false;
    this.scene.add(this.mesh);

    this.bones = {};
    this.animator = null;
    this.visible = false;

    const physicsMaterial = (typeof racerMaterial !== 'undefined') ? racerMaterial : new CANNON.Material('racerMaterial');

    this.body = new CANNON.Body({
      mass: 70,
      material: physicsMaterial,
      type: CANNON.Body.DYNAMIC,
      fixedRotation: true,
      linearDamping: 0.0,
      collisionFilterGroup: window.COLLISION_GROUP_CAR,
      collisionFilterMask: window.COLLISION_GROUP_WALL | window.COLLISION_GROUP_CHECKPOINT | window.COLLISION_GROUP_ROAD | window.COLLISION_GROUP_OFFROAD
    });

    this.body.allowSleep = false;

    const feetSphere = new CANNON.Sphere(0.4);
    this.body.addShape(feetSphere, new CANNON.Vec3(0, -0.5, 0));
  }

  loadGLTF(gltf) {
    const model = gltf.scene;

    model.scale.set(0.95, 0.95, 0.95);

    const BONE_MAP = {
      'upper_armL': 'upperArmL',
      'upper_armR': 'upperArmR',
      'forearmL': 'forearmL',
      'forearmR': 'forearmR',
      'shoulderL': 'shoulderL',
      'shoulderR': 'shoulderR',
      'thighL': 'thighL',
      'thighR': 'thighR',
      'shinL': 'shinL',
      'shinR': 'shinR',
      'footL': 'footL',
      'footR': 'footR',
      'toeL': 'toeL',
      'toeR': 'toeR',
      'handL': 'handL',
      'handR': 'handR',
      'head': 'head',
      'neck': 'neck',
      'spine': 'spine',
      'spine001': 'spine001',
      'spine002': 'spine002',
      'pelvis': 'pelvis',
      'root': 'root'
    };

    model.traverse(node => {
      if (node.isSkinnedMesh || node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          const mats = Array.isArray(node.material) ? node.material : [node.material];
          mats.forEach(mat => {
            mat.metalness = 0.0;
            mat.roughness = 0.8;
          });
        }

        if (node.isSkinnedMesh && node.skeleton) {
          node.skeleton.bones.forEach(bone => {
            const key = BONE_MAP[bone.name];
            if (key && !this.bones[key]) {
              this.bones[key] = bone;
            }
          });
        }
      }

      if (node.isBone || node.type === 'Bone') {
        const key = BONE_MAP[node.name];
        if (key && !this.bones[key]) {
          this.bones[key] = node;
        }
      }
    });

    this.mesh.add(model);

    if (typeof window.RacerAnimation === 'function') {
      this.animator = new window.RacerAnimation(this.bones);
    }

    const foundKeys = Object.keys(this.bones);
  }

  spawn(customPos = null, customAngle = null) {
    this.mesh.visible = true;
    this.visible = true;

    if (customPos) {
      this.body.position.copy(customPos);
    } else {
      this.body.position.set(81.2, 1.0, -7.16);
    }

    if (customAngle !== null) {
      this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), customAngle);
      this.mesh.rotation.y = customAngle;
    } else {
      this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
      this.mesh.rotation.y = -Math.PI / 2;
    }

    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);

    if (!this.body.world) {
      this.world.addBody(this.body);
    }
  }

  reset() {
    this.body.position.set(81.2, 2.0, -7.16);
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), -Math.PI / 2);
    this.mesh.rotation.y = -Math.PI / 2;
    this.body.velocity.set(0, 0, 0);
    this.body.angularVelocity.set(0, 0, 0);
  }

  hide() {
    this.mesh.visible = false;
    this.visible = false;
    if (this.animator) this.animator.stop();

    if (this.world.bodies.includes(this.body)) {
      this.world.removeBody(this.body);
    }
  }

  update(dt, keys) {
    if (!this.visible) return;

    let isMoving = false;

    const isRunning = keys.shift === true;
    const speed = isRunning ? 8.5 : 4.5;

    const camDir = new THREE.Vector3();
    this.camera.getWorldDirection(camDir);
    camDir.y = 0;

    const moveDir = new THREE.Vector3();

    if (camDir.lengthSq() > 0.001) {
      camDir.normalize();
      const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0)).normalize();

      if (keys.w) { moveDir.add(camDir); isMoving = true; }
      if (keys.s) { moveDir.sub(camDir); isMoving = true; }
      if (keys.a) { moveDir.sub(right); isMoving = true; }
      if (keys.d) { moveDir.add(right); isMoving = true; }
    }

    if (isMoving && moveDir.lengthSq() > 0.001) {
      moveDir.normalize();

      this.body.velocity.x = moveDir.x * speed;
      this.body.velocity.z = moveDir.z * speed;

      const targetAngle = Math.atan2(moveDir.x, moveDir.z);
      let diff = targetAngle - this.mesh.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.mesh.rotation.y += diff * 15 * dt;

      if (this.animator) {
        this.animator.setMode(isRunning ? 'run' : 'walk');
      }

    } else {
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;

      if (this.animator) {
        this.animator.setMode('idle');
      }
    }

    this.mesh.position.set(this.body.position.x, this.body.position.y - 0.9, this.body.position.z);
  }
}
window.RacerController = RacerController;