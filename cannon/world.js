const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);

world.broadphase = new CANNON.SAPBroadphase(world);

world.allowSleep = true;

world.solver.iterations = 10;

world.solver.tolerance = 0.5;

window.COLLISION_GROUP_CAR        = 1;
window.COLLISION_GROUP_WALL       = 2;
window.COLLISION_GROUP_CHECKPOINT = 4;
window.COLLISION_GROUP_ROAD       = 8;
window.COLLISION_GROUP_OFFROAD    = 16;

const groundMaterial  = new CANNON.Material('ground');
const wheelMaterial   = new CANNON.Material('wheel');
const chassisMaterial = new CANNON.Material('chassis');
const racerMaterial = new CANNON.Material('racerMaterial');


const chassisGroundContact = new CANNON.ContactMaterial(
  groundMaterial, chassisMaterial, {
    friction:                  0.1,
    restitution:               0.0,
    contactEquationStiffness:  5e6,
    contactEquationRelaxation: 4,
  }
);
world.addContactMaterial(chassisGroundContact);

const racerGroundContact = new CANNON.ContactMaterial(racerMaterial, groundMaterial, {
  friction: 0.0,
  restitution: 0.0
});
world.addContactMaterial(racerGroundContact);

world.defaultContactMaterial.friction                   = 0.05;
world.defaultContactMaterial.restitution                = 0.0;
world.defaultContactMaterial.contactEquationStiffness   = 5e6;
world.defaultContactMaterial.contactEquationRelaxation  = 4;