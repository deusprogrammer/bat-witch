import Bullet from '../Bullet';

export const resolveValue = (value, ...args) => typeof value === 'function' ? value(...args) : value;

export const resolveProjectileCount = (bulletEmitter, waveIndex) => {
    return Math.max(0, Math.floor(Number(resolveValue(bulletEmitter.projectilesPerWave, waveIndex)) || 0));
}

export const calculateBurstSpacing = (projectilesPerWave) => {
    return (2 * Math.PI) / projectilesPerWave;
}

export const spawnBullet = (bulletEmitter, { waveIndex, spawnTime }, { bulletIndex, projectileCount, baseAngle, rotates }) => {
    const args = [waveIndex, bulletIndex, projectileCount];
    const velocity = resolveValue(bulletEmitter.velocity, ...args);
    const outwardVelocity = bulletEmitter.outwardVelocity;
    const color = bulletEmitter.color;
    const size = bulletEmitter.size;

    const bullet = new Bullet(bulletEmitter.scene, {
        origin: bulletEmitter.origin,
        parent: bulletEmitter.origin,
        followParent: bulletEmitter.followParent,
        timeSource: bulletEmitter.timeSource,
        spawnTime,
        texture: resolveValue(bulletEmitter.texture, ...args),
        color: typeof color === 'function'
            ? (age) => color(age, ...args)
            : color,
        size: typeof size === 'function'
            ? (age) => size(age, ...args)
            : size,
        behavior: {
            type: "orbit",
            outwardVelocity: typeof outwardVelocity === 'function'
                ? (age) => outwardVelocity(age, velocity, waveIndex, bulletIndex)
                : velocity,
            angularVelocity: rotates ? resolveValue(bulletEmitter.angularVelocity, ...args) : 0,
            spinVelocity: Number(resolveValue(bulletEmitter.spinVelocity, ...args)) || 0,
            startAngle: baseAngle + resolveValue(bulletEmitter.startAngle, ...args)
        }
    });
    bulletEmitter.bullets.add(bullet);
}

export const emitRing = (bulletEmitter, wave, rotates) => {
    const projectileCount = resolveProjectileCount(bulletEmitter, wave.waveIndex);
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
