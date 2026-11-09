import Phaser from 'phaser';

// Velocity is AMPLITUDE * sin(t) px/s, so the exact position is AMPLITUDE * (1 - cos(t)) px from the start.
const AMPLITUDE = 100;

const SLICE_WIDTH = 0.01;  // 10ms

export default class SandboxScene extends Phaser.Scene {
  totalMovement = 0;
  lastSlice = 0;

  constructor() {
    super({ key: 'SandboxScene' });
  }

  preload() {
    this.load.image('bullet', 'assets/bullet.png');
  }

  create() {
    this.elapsed = 0; // seconds since the scene started

    this.sprite = this.add.image(0, this.scale.height / 2, 'bullet');
    this.sprite.setOrigin(0, 0.5);
    this.sprite.setScale(32 / this.sprite.height);
    this.sprite.setTint(0xff69b4);

    // Answer key: moves using the exact integral of the velocity, to compare against.
    this.reference = this.add.image(0, this.scale.height / 2 - 60, 'bullet');
    this.reference.setOrigin(0, 0.5);
    this.reference.setScale(32 / this.reference.height);
    this.reference.setTint(0x14c8b4);
  }

  integrate(age, fn) {
    // Get slice widths from cache
    let nSlices = Math.trunc(age / SLICE_WIDTH);

    // Find the slice to start calculating at
    let startSlice = this.lastSlice;
    
    // Calculate all of the whole slices area's and then add to total
    for (let i = startSlice; i < nSlices; i++) {
      let sliceStartTime = i * SLICE_WIDTH;
      let sliceMidPoint = sliceStartTime + SLICE_WIDTH/2;
      let area = fn(sliceMidPoint) * SLICE_WIDTH;

      this.totalMovement += area;
    }

    // Calculate the leftover slice (don't cache this)
    let diff = age - nSlices * SLICE_WIDTH;
    let diffMidPoint = nSlices * SLICE_WIDTH + diff / 2;
    let diffArea = fn(diffMidPoint) * diff;
    this.lastSlice = nSlices;

    return this.totalMovement + diffArea;
  }

  update(time, delta) {
    this.elapsed += delta / 1000;

    this.reference.x = AMPLITUDE * (1 - Math.cos(this.elapsed));
    this.sprite.x = AMPLITUDE * this.integrate(this.elapsed, (x) => Math.sin(x));
  }
}
