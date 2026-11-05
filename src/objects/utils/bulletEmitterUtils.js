import Bullet from '../Bullet';

export const resolveValue = (value, ...args) => typeof value === 'function' ? value(...args) : value;

export const resolveProjectileCount = (bulletEmitter, { waveIndex, spawnTime }) => {
    return Math.max(0, Math.floor(Number(resolveValue(bulletEmitter.projectilesPerWave, waveIndex, spawnTime / 1000)) || 0));
}

export const calculateBurstSpacing = (projectilesPerWave) => {
    return (2 * Math.PI) / projectilesPerWave;
}

/**
 * Wraps the emitter's parameters as functions of the bullet's age for the 'orbit' behavior.
 * Every function also gets s, the emitter clock in seconds right now (the song time when the
 * timeSource is a song clock). Functions that ignore s give the same result every frame, so
 * plain math patterns and waveform-driven ones can be mixed freely.
 * Calls are positional (no spreads) because they run every integration step for every bullet.
 */
const orbitBehavior = (bulletEmitter, { waveIndex, bulletIndex, projectileCount, spawnSeconds, rotates }) => {
    const { velocity, outwardVelocity, angularVelocity, spinVelocity } = bulletEmitter;
    const i = waveIndex;
    const j = bulletIndex;
    const n = projectileCount;
    const velocityAt = typeof velocity === 'function'
        ? (s) => Number(velocity(i, j, n, s)) || 0
        : () => Number(velocity) || 0;

    return {
        type: 'orbit',
        outwardVelocity: typeof outwardVelocity === 'function'
            ? (age) => {
                const s = spawnSeconds + age;
                return outwardVelocity(age, velocityAt(s), i, j, s, n);
            }
            : (typeof velocity === 'function' ? (age) => velocityAt(spawnSeconds + age) : velocityAt()),
        angularVelocity: !rotates ? 0 : typeof angularVelocity === 'function'
            ? (age) => angularVelocity(i, j, n, spawnSeconds + age)
            : Number(angularVelocity) || 0,
        spinVelocity: typeof spinVelocity === 'function'
            ? (age) => spinVelocity(i, j, n, spawnSeconds + age)
            : Number(spinVelocity) || 0
    };
};

export const spawnBullet = (bulletEmitter, { waveIndex, spawnTime }, { bulletIndex, projectileCount, baseAngle, rotates }) => {
    // Emitter clock in seconds at spawn; the song position when timeSource is a song clock.
    const spawnSeconds = spawnTime / 1000;
    const spawnArgs = [waveIndex, bulletIndex, projectileCount, spawnSeconds];
    const { color, size } = bulletEmitter;
    const continuous = (fn) => typeof fn === 'function'
        ? (age) => fn(age, waveIndex, bulletIndex, projectileCount, spawnSeconds + age)
        : fn;

    const bullet = new Bullet(bulletEmitter.scene, {
        origin: bulletEmitter.origin,
        parent: bulletEmitter.origin,
        followParent: bulletEmitter.followParent,
        timeSource: bulletEmitter.timeSource,
        spawnTime,
        texture: resolveValue(bulletEmitter.texture, ...spawnArgs),
        color: continuous(color),
        size: continuous(size),
        behavior: {
            ...orbitBehavior(bulletEmitter, { waveIndex, bulletIndex, projectileCount, spawnSeconds, rotates }),
            startAngle: baseAngle + resolveValue(bulletEmitter.startAngle, ...spawnArgs)
        }
    });
    bulletEmitter.bullets.add(bullet);
}

export const emitRing = (bulletEmitter, wave, { rotates }) => {
    const projectileCount = resolveProjectileCount(bulletEmitter, wave);
    const spacing = calculateBurstSpacing(projectileCount);

    for (let bulletIndex = 0; bulletIndex < projectileCount; bulletIndex++) {
        spawnBullet(bulletEmitter, wave, {
            bulletIndex,
            projectileCount,
            baseAngle: bulletIndex * spacing,
            rotates
        });
    }
}

export const emitLinear = (bulletEmitter, wave) => {
    spawnBullet(bulletEmitter, wave, {
        bulletIndex: 0,
        projectileCount: 1,
        baseAngle: Math.PI / 2,
        rotates: false
    });
}
