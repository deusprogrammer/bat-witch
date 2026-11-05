import Phaser from 'phaser';
import Enemy from '../objects/Enemy.js';
import BulletEmitter from '../objects/BulletEmitter.js';
import { preloadBulletTextures } from '../objects/definitions/bulletTextures.js';

const MAX_FRAME_DELTA = 100;

/**
 * Bullet positions are pure functions of settings and timeline time, so any moment can be
 * reconstructed by re-emitting every wave scheduled up to that time. Playing forward only
 * emits the waves that fall inside each frame; seeking backward or changing settings rebuilds.
 */
export default class PlaygroundScene extends Phaser.Scene {
  constructor({ settings, timeline, onTimelineUpdate }) {
    super({ key: 'PlaygroundScene' });

    this.settings = settings;
    this.timeline = timeline;
    this.onTimelineUpdate = onTimelineUpdate;
    this.timelineClock = { now: 0 };
    this.manualVolleys = [];
    this.pendingSeek = null;
    this.dirty = true;
  }

  preload() {
    this.load.atlas('enemy', 'assets/enemy-sprite.png', 'assets/enemy-atlas.json');
    preloadBulletTextures(this);
  }

  create() {
    // Enemy.update() is intentionally never called; firing is driven by the timeline instead.
    this.enemy = new Enemy(this, this.settings.originX, this.settings.originY);
    this.enemy.bulletEmitter.destroy();

    this.emitter = new BulletEmitter(this, {
      origin: this.enemy,
      timeSource: this.timelineClock,
      ...this.emitterOptions()
    });
    // Bullets are advanced manually after the timeline moves so they never read a stale time.
    this.emitter.bullets.runChildUpdate = false;

    this.bulletCountText = this.add.text(8, 8, '', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#9fe8ff'
    }).setDepth(10);
  }

  emitterOptions() {
    const {
      pattern, velocity, outwardVelocity, angularVelocity, spinVelocity, startAngle, projectilesPerWave, waveCount, waveInterval, color, size, texture
    } = this.settings;
    return { pattern, velocity, outwardVelocity, angularVelocity, spinVelocity, startAngle, projectilesPerWave, waveCount, waveInterval, color, size, texture };
  }

  get currentTime() {
    return this.timelineClock.now;
  }

  markDirty() {
    this.dirty = true;
  }

  seek(time) {
    this.pendingSeek = Phaser.Math.Clamp(time, 0, this.timeline.duration);
  }

  fire() {
    const time = this.currentTime;
    this.manualVolleys.push(time);

    for (const { waveIndex, delay } of this.emitter.getWaveSchedule()) {
      if (delay === 0) this.emitter.emitWave(waveIndex, time);
    }
    this.updateBullets();
  }

  reset() {
    this.manualVolleys = [];
    this.dirty = true;
    this.seek(0);
  }

  update(time, delta) {
    this.applySettings();

    let target = this.currentTime;
    if (this.timeline.playing) {
      target += Math.min(delta, MAX_FRAME_DELTA);

      if (target >= this.timeline.duration) {
        if (this.timeline.loop) {
          target = 0;
        } else {
          target = this.timeline.duration;
          this.timeline.playing = false;
        }
      }
    }

    if (this.pendingSeek !== null) {
      target = this.pendingSeek;
      this.pendingSeek = null;
    }

    this.moveTo(target);

    this.bulletCountText.setText(`Bullets: ${this.emitter.bullets.countActive()}`);
    this.onTimelineUpdate?.(this.currentTime);
  }

  applySettings() {
    Object.assign(this.emitter, this.emitterOptions());
    this.enemy.setPosition(this.settings.originX, this.settings.originY);
  }

  moveTo(target) {
    if (this.dirty || target < this.currentTime) {
      this.rebuild(target);
    } else if (target > this.currentTime) {
      this.emitBetween(this.currentTime, target);
      this.timelineClock.now = target;
    }

    this.updateBullets();
  }

  rebuild(target) {
    this.emitter.bullets.clear(true, true);
    this.timelineClock.now = target;
    this.emitBetween(-Infinity, target);
    this.dirty = false;
  }

  /** Emits every wave whose spawn time is in (from, to]. */
  emitBetween(from, to) {
    const schedule = this.emitter.getWaveSchedule();
    const volleySpan = schedule[schedule.length - 1].delay;

    for (const volleyTime of this.volleysBetween(from - volleySpan, to)) {
      for (const { waveIndex, delay } of schedule) {
        const spawnTime = volleyTime + delay;
        if (spawnTime > from && spawnTime <= to) {
          this.emitter.emitWave(waveIndex, spawnTime);
        }
      }
    }
  }

  volleysBetween(from, to) {
    const volleys = this.manualVolleys.filter(time => time >= from && time <= to);

    if (this.settings.autoFire) {
      const cooldown = Math.max(1, this.settings.fireCooldown);
      for (let k = Math.max(0, Math.ceil(from / cooldown)); k * cooldown <= to; k++) {
        volleys.push(k * cooldown);
      }
    }

    return volleys;
  }

  updateBullets() {
    // Copy first: bullets that leave the bounds destroy themselves and leave the group mid-iteration.
    for (const bullet of [...this.emitter.bullets.getChildren()]) {
      bullet.update();
    }
  }
}
