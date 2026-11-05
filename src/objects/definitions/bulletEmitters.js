import { emitLinear, emitRing } from '../utils/bulletEmitterUtils';

export const bulletEmitters = {
    orbit_burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: true }),
    burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, { rotates: false }),
    linear: (bulletEmitter, wave) => emitLinear(bulletEmitter, wave)
}
