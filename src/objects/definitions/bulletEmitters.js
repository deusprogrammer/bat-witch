import { emitLinear, emitRing } from '../utils/bulletEmitterUtils';

/**
 * Patterns for BulletEmitter's `pattern` option. Each fires one wave.
 *   orbit_burst  a ring of bullets that also circles the origin (uses angularVelocity)
 *   burst        a ring of bullets flying straight out
 *   linear       one bullet, straight down by default (steer it with startAngle)
 */
export const bulletEmitters = {
    orbit_burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: true }),
    burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: false }),
    linear: (bulletEmitter, wave) => emitLinear(bulletEmitter, wave)
}
