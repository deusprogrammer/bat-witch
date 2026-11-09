import { emitCone, emitLinear, emitRing } from '../utils/bulletEmitterUtils';

/**
 * Patterns for BulletEmitter's `pattern` option. Each fires one wave.
 *   orbit_burst  a ring of bullets that also circles the origin (uses angularVelocity)
 *   burst        a ring of bullets flying straight out
 *   linear       one bullet along direction (straight down by default)
 *   cone         bullets centered on direction across coneAngle radians
 */
export const bulletEmitters = {
    cone: emitCone,
    orbit_burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: true }),
    burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: false }),
    linear: (bulletEmitter, wave) => emitLinear(bulletEmitter, wave)
}
