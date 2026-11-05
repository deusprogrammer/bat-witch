import Phaser from 'phaser';
import Enemy from '../objects/Enemy.js';
import BulletEmitter from '../objects/BulletEmitter.js';
import { preloadBulletTextures } from '../objects/definitions/bulletTextures.js';

const MAX_FRAME_DELTA = 100;
// Audio drifting further than this from the timeline (e.g. after a seek) is restarted in place.
const AUDIO_RESYNC_MS = 50;
const REBUILD_STEP = 500;

/**
 * Bullet positions are pure functions of settings and timeline time, so any moment can be
 * reconstructed by re-emitting every wave scheduled up to that time. Playing forward only
 * emits the waves that fall inside each frame; seeking backward or changing settings rebuilds.
 * When a track is loaded, timeline time is song time and playback follows the audio clock.
 */
export default class PlaygroundScene extends Phaser.Scene {
  constructor({ settings, timeline, audio, onTimelineUpdate }) {
    super({ key: 'PlaygroundScene' });

    this.settings = settings;
    this.timeline = timeline;
    this.audio = audio;
    this.onTimelineUpdate = onTimelineUpdate;
    this.timelineClock = { now: 0 };
    this.manualVolleys = [];
    this.volleySchedules = new Map();
    this.maxVolleySpan = 0;
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

    for (const { waveIndex, delay } of this.scheduleFor(time)) {
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
      const audio = this.audio;
      if (audio?.loaded && audio.playing && audio.running) {
        target = audio.position;
      } else {
        target += Math.min(delta, MAX_FRAME_DELTA);
      }

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
    this.syncAudio();

    this.bulletCountText.setText(`Bullets: ${this.emitter.bullets.countActive()}`);
    this.onTimelineUpdate?.(this.currentTime);
  }

  syncAudio() {
    const audio = this.audio;
    if (!audio?.loaded) return;

    if (!this.timeline.playing || this.currentTime >= audio.duration) {
      audio.stop();
    } else if (!audio.playing || Math.abs(audio.position - this.currentTime) > AUDIO_RESYNC_MS) {
      audio.play(this.currentTime);
    }
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
    this.volleySchedules.clear();
    this.maxVolleySpan = 0;

    // Fast-forward in chunks so bullets that leave the field are culled along the way, as they
    // would be during playback, instead of every bullet ever fired being integrated to `target`.
    let from = -Infinity;
    for (let time = Math.min(target, REBUILD_STEP); ; time = Math.min(target, time + REBUILD_STEP)) {
      this.timelineClock.now = time;
      this.emitBetween(from, time);
      from = time;
      if (time >= target) break;
      this.advanceBullets();
    }
    this.dirty = false;
  }

  /** Moves and culls bullets without updating their visuals (used while fast-forwarding). */
  advanceBullets() {
    for (const bullet of [...this.emitter.bullets.getChildren()]) {
      bullet.advance();
    }
  }

  /**
   * waveInterval may depend on song time, so each volley has its own schedule. Every volley up
   * to the current time has been scheduled (rebuild starts from -Infinity), so the longest
   * cached span is a safe look-back for waves that are still pending.
   */
  scheduleFor(volleyTime) {
    let schedule = this.volleySchedules.get(volleyTime);
    if (!schedule) {
      schedule = this.emitter.getWaveSchedule(volleyTime);
      this.volleySchedules.set(volleyTime, schedule);
      this.maxVolleySpan = Math.max(this.maxVolleySpan, schedule[schedule.length - 1].delay);
    }
    return schedule;
  }

  /** Emits every wave whose spawn time is in (from, to]. */
  emitBetween(from, to) {
    for (const volleyTime of this.volleysBetween(from - this.maxVolleySpan, to)) {
      for (const { waveIndex, delay } of this.scheduleFor(volleyTime)) {
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
