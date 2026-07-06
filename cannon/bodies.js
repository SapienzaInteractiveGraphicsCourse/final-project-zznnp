const physicsObjects = [];

const _syncOffset = new THREE.Vector3();

function syncPhysics() {
  for (let i = 0; i < physicsObjects.length; i++) {
    const obj  = physicsObjects[i];
    const mesh = obj.mesh;
    const body = obj.body;

    mesh.position.x = body.position.x;
    mesh.position.y = body.position.y;
    mesh.position.z = body.position.z;

    mesh.quaternion.x = body.quaternion.x;
    mesh.quaternion.y = body.quaternion.y;
    mesh.quaternion.z = body.quaternion.z;
    mesh.quaternion.w = body.quaternion.w;

    if (obj.offsetPos) {
      _syncOffset.copy(obj.offsetPos);
      _syncOffset.applyQuaternion(mesh.quaternion);
      mesh.position.x += _syncOffset.x;
      mesh.position.y += _syncOffset.y;
      mesh.position.z += _syncOffset.z;
    }

    if (obj.offsetQuat) {
      mesh.quaternion.multiply(obj.offsetQuat);
    }
  }
}