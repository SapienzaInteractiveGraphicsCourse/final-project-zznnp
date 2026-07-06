class RacerAnimation {
  constructor(bones) {
    this.bones = bones;
    this.walkState = { phase: 0 };
    this.currentTween = null;
    this.currentState = 'idle';
    this.isRunning = false;

    this.baseRot = {};
    for (let key in this.bones) {
      if (this.bones[key]) {

        if (key.includes('upperArm') || key.includes('thigh')) {
          this.bones[key].rotation.reorder('ZYX');
        }

        this.baseRot[key] = {
          x: this.bones[key].rotation.x,
          y: this.bones[key].rotation.y,
          z: this.bones[key].rotation.z
        };
      }
    }

    this._applyIdlePose();
  }

  _applyIdlePose() {
    if (this.bones['upperArmL']) {
      this.bones['upperArmL'].rotation.x = this.baseRot['upperArmL'].x - 0.1;
      this.bones['upperArmL'].rotation.y = this.baseRot['upperArmL'].y + 0.2;
      this.bones['upperArmL'].rotation.z = this.baseRot['upperArmL'].z;
    }
    if (this.bones['upperArmR']) {
      this.bones['upperArmR'].rotation.x = this.baseRot['upperArmR'].x - 0.1;
      this.bones['upperArmR'].rotation.y = this.baseRot['upperArmR'].y - 0.2;
      this.bones['upperArmR'].rotation.z = this.baseRot['upperArmR'].z;
    }

    if (this.bones['forearmL']) this.bones['forearmL'].rotation.x = this.baseRot['forearmL'].x + 0.0;
    if (this.bones['forearmR']) this.bones['forearmR'].rotation.x = this.baseRot['forearmR'].x + 0.0;

    const legNarrowOffset = 0.01;
    if (this.bones['thighL']) {
      this.bones['thighL'].rotation.x = this.baseRot['thighL'].x;
      this.bones['thighL'].rotation.z = this.baseRot['thighL'].z + legNarrowOffset;
    }
    if (this.bones['thighR']) {
      this.bones['thighR'].rotation.x = this.baseRot['thighR'].x;
      this.bones['thighR'].rotation.z = this.baseRot['thighR'].z - legNarrowOffset;
    }
  }

  _createTween(duration) {
    if (this.currentTween) {
      this.currentTween.stop();
    }

    const startPhase = this.walkState.phase;
    const targetPhase = startPhase + (Math.PI * 2);

    this.currentTween = new TWEEN.Tween(this.walkState)
      .to({ phase: targetPhase }, duration)
      .repeat(Infinity)
      .onUpdate(() => {
        const sinPhase = Math.sin(this.walkState.phase);
        const cosPhase = Math.cos(this.walkState.phase);

        const shoulderSwing = this.isRunning ? 0.35 : 0.15;
        const elbowSwing    = this.isRunning ? 0.60 : 0.30;
        const legSwing      = this.isRunning ? 0.90 : 0.60;
        const kneeBend      = this.isRunning ? 1.20 : 0.80;

        if (this.bones['upperArmL']) {
          this.bones['upperArmL'].rotation.x = this.baseRot['upperArmL'].x + (sinPhase * shoulderSwing);
          this.bones['upperArmL'].rotation.y = this.baseRot['upperArmL'].y + 0.2;
          this.bones['upperArmL'].rotation.z = this.baseRot['upperArmL'].z + (sinPhase * shoulderSwing);
        }
        if (this.bones['upperArmR']) {
          this.bones['upperArmR'].rotation.x = this.baseRot['upperArmR'].x - (sinPhase * shoulderSwing);
          this.bones['upperArmR'].rotation.y = this.baseRot['upperArmR'].y - 0.2;
          this.bones['upperArmR'].rotation.z = this.baseRot['upperArmR'].z - (sinPhase * shoulderSwing);
        }

        if (this.bones['forearmL']) this.bones['forearmL'].rotation.x = this.baseRot['forearmL'].x - 0.45 + (sinPhase * elbowSwing);
        if (this.bones['forearmR']) this.bones['forearmR'].rotation.x = this.baseRot['forearmR'].x - 0.45 - (sinPhase * elbowSwing);

        if (this.bones['handL']) this.bones['handL'].rotation.x = this.baseRot['handL'].x + (cosPhase * 0.12);
        if (this.bones['handR']) this.bones['handR'].rotation.x = this.baseRot['handR'].x - (cosPhase * 0.12);

        const legNarrowOffset = 0.08;
        if (this.bones['thighL']) {
          this.bones['thighL'].rotation.x = this.baseRot['thighL'].x - (sinPhase * legSwing);
          this.bones['thighL'].rotation.z = this.baseRot['thighL'].z - legNarrowOffset;
        }
        if (this.bones['thighR']) {
          this.bones['thighR'].rotation.x = this.baseRot['thighR'].x + (sinPhase * legSwing);
          this.bones['thighR'].rotation.z = this.baseRot['thighR'].z + legNarrowOffset;
        }

        if (this.bones['shinL']) this.bones['shinL'].rotation.x = this.baseRot['shinL'].x + Math.max(0, cosPhase * kneeBend);
        if (this.bones['shinR']) this.bones['shinR'].rotation.x = this.baseRot['shinR'].x + Math.max(0, -cosPhase * kneeBend);
      });

    this.currentTween.start();
  }

  setMode(mode) {
    if (this.currentState === mode) return;
    this.currentState = mode;

    if (mode === 'idle') {
      if (this.currentTween) this.currentTween.stop();
      this.walkState.phase = 0;
      this._resetToIdle();
    } else if (mode === 'walk') {
      this.isRunning = false;
      this._createTween(1000);
    } else if (mode === 'run') {
      this.isRunning = true;
      this._createTween(550);
    }
  }

  _resetToIdle() {
    ['thighL', 'thighR', 'shinL', 'shinR', 'forearmL', 'forearmR', 'handL', 'handR', 'upperArmL', 'upperArmR'].forEach(b => {
       if (this.bones[b]) {
           this.bones[b].rotation.x = this.baseRot[b].x;
           this.bones[b].rotation.y = this.baseRot[b].y;
           this.bones[b].rotation.z = this.baseRot[b].z;
       }
    });
    this._applyIdlePose();
  }

  start() { this.setMode('walk'); }
  stop()  { this.setMode('idle'); }
}
window.RacerAnimation = RacerAnimation;