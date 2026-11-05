import { emitRing, spawnBullet } from '../utils/bulletEmitterUtils';

export const bulletEmitters = {
    orbit_burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, true),
    burst: (bulletEmitter, wave) => emitRing(bulletEmitter, wave, false),
    linear: (bulletEmitter, wave) => {
        spawnBullet(bulletEmitter, wave, {
            bulletIndex: 0,
            projectileCount: 1,
            baseAngle: Math.PI / 2,
            rotates: false
        });
    }
}
