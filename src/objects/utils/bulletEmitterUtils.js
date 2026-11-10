import Bullet from '../Bullet';

/**
 * A parameter is either a plain value or a function of a context object (see BulletEmitter.js
 * for the fields). Functions are called; plain values are returned as-is.
 */
export const resolveValue = (value, context) => typeof value === 'function' ? value(context) : value;

/** Direction is radians or a non-zero [x, y] vector; vector magnitude does not affect speed. */
export const directionAngle = (direction) => {
    if (typeof direction === 'number' && Number.isFinite(direction)) return direction;
    if (Array.isArray(direction) && direction.length === 2
        && direction.every(value => typeof value === 'number' && Number.isFinite(value))
        && (direction[0] !== 0 || direction[1] !== 0)) {
        return Math.atan2(direction[1], direction[0]);
    }
    throw new TypeError('Direction must be finite radians or a non-zero [x, y] vector.');
};

/** How many bullets a wave fires. projectilesPerWave gets { waveIndex, time }. */
export const resolveProjectileCount = (bulletEmitter, { waveIndex, spawnTime }) => {
    const count = resolveValue(bulletEmitter.projectilesPerWave, { waveIndex, time: spawnTime / 1000 });
    return Math.max(0, Math.floor(Number(count) || 0));
}

/**
 * Creates the context object handed to one bullet's parameter functions, and returns `at(age)`,
 * which updates it for a moment in the bullet's life and returns it.
 *
 * The same object is reused for every call (velocity, spin, color and size are evaluated every
 * integration step for every bullet, so allocating a fresh object each time would be costly).
 * Read from it; don't keep a reference to it.
 */
const createBulletContext = ({ waveIndex, bulletIndex, bulletCount, spawnSeconds }) => {
    const context = {
        waveIndex,           // which wave of the volley fired this bullet (0, 1, 2, ...)
        bulletIndex,         // this bullet's position in its wave (0 to bulletCount - 1)
        bulletCount,         // how many bullets the wave fired; bulletIndex / bulletCount = fraction of the way around the ring
        time: spawnSeconds,  // emitter clock in seconds (the song position when timeSource is a song clock)
        age: 0,              // seconds since this bullet spawned
        velocity: 0          // resolved `velocity`; only meaningful inside outwardVelocity
    };
    const at = (age) => {
        context.age = age;
        context.time = spawnSeconds + age;
        return context;
    };
    return { at };
};

/**
 * For rates (velocities): a function becomes rate(age), a number stays a number.
 * Behaviors only integrate functions, so constant rates keep the cheap `rate * age` path.
 */
const rateOverAge = (rate, at) => typeof rate === 'function'
    ? (age) => Number(rate(at(age))) || 0
    : Number(rate) || 0;

/**
 * For looks (color, size): a function becomes value(age); anything else passes through
 * unchanged, since colors can also be strings like '#ff8800' or {r, g, b}.
 */
const valueOverAge = (value, at) => typeof value === 'function'
    ? (age) => value(at(age))
    : value;

/**
 * Turns the emitter's parameters into functions of the bullet's age for the 'orbit' behavior
 * (definitions/bulletBehaviors.js), which integrates them over the bullet's life.
 */
const orbitBehavior = (bulletEmitter, at, { rotates }) => {
    const { velocity, outwardVelocity, angularVelocity, spinVelocity } = bulletEmitter;

    // outwardVelocity replaces velocity, but can read it as context.velocity.
    let outward = rateOverAge(velocity, at);
    if (typeof outwardVelocity === 'function') {
        const resolveVelocity = typeof velocity === 'function'
            ? (context) => Number(velocity(context)) || 0
            : () => Number(velocity) || 0;
        outward = (age) => {
            const context = at(age);
            context.velocity = resolveVelocity(context);
            return Number(outwardVelocity(context)) || 0;
        };
    }

    return {
        type: 'orbit',
        outwardVelocity: outward,
        // Non-rotating patterns (burst, linear) fly straight out.
        angularVelocity: rotates ? rateOverAge(angularVelocity, at) : 0,
        spinVelocity: rateOverAge(spinVelocity, at)
    };
};

/**
 * Spawns one bullet of a wave.
 * baseAngle is the bullet's offset from the emitter's direction.
 */
export const spawnBullet = (bulletEmitter, { waveIndex, spawnTime, origin = bulletEmitter.origin }, { bulletIndex, bulletCount, baseAngle, rotates }) => {
    const spawnSeconds = spawnTime / 1000;
    const { at } = createBulletContext({ waveIndex, bulletIndex, bulletCount, spawnSeconds });

    // Texture, launch angle and initial sprite rotation are fixed at spawn.
    const texture = resolveValue(bulletEmitter.texture, at(0));
    const startAngle = baseAngle + directionAngle(resolveValue(bulletEmitter.direction, at(0)));
    const startRotation = (bulletEmitter.alignToDirection ? startAngle : 0)
        + resolveValue(bulletEmitter.startRotation ?? 0, at(0));

    const bullet = new Bullet(bulletEmitter.scene, {
        origin,
        parent: origin,
        followParent: bulletEmitter.followParent,
        timeSource: bulletEmitter.timeSource,
        spawnTime,
        texture,
        // The Bullet re-evaluates these every frame with its current age.
        color: valueOverAge(bulletEmitter.color, at),
        size: valueOverAge(bulletEmitter.size, at),
        behavior: {
            ...orbitBehavior(bulletEmitter, at, { rotates }),
            startAngle,
            startRotation,
            alignToDirection: bulletEmitter.alignToDirection
        },
        onAdvance: bulletEmitter.onBulletAdvance,
        onSpawn: bulletEmitter.onBulletSpawn,
        onDestroy: bulletEmitter.onBulletDestroy
    });
    bulletEmitter.bullets.add(bullet);
}

/** Fires a full ring of bullets spaced evenly around the origin. */
export const emitRing = (bulletEmitter, wave, { rotates }) => {
    emitSpread(bulletEmitter, wave, {
        bulletCount: resolveProjectileCount(bulletEmitter, wave), spread: 2 * Math.PI, rotates
    });
}

const emitSpread = (bulletEmitter, wave, { bulletCount, spread, rotates = false }) => {
    const fullRing = Math.abs(spread) === 2 * Math.PI;
    const spacing = bulletCount > 1 ? spread / (fullRing ? bulletCount : bulletCount - 1) : 0;
    const firstAngle = fullRing || bulletCount <= 1 ? 0 : -spread / 2;
    for (let bulletIndex = 0; bulletIndex < bulletCount; bulletIndex++) {
        spawnBullet(bulletEmitter, wave, {
            bulletIndex, bulletCount, baseAngle: firstAngle + bulletIndex * spacing, rotates
        });
    }
};

/** Centers a cone on direction; full circles omit the duplicate endpoint. */
export const emitCone = (bulletEmitter, wave) => {
    const bulletCount = resolveProjectileCount(bulletEmitter, wave);
    const coneAngle = Number(resolveValue(bulletEmitter.coneAngle, {
        waveIndex: wave.waveIndex, time: wave.spawnTime / 1000
    })) || 0;
    emitSpread(bulletEmitter, wave, { bulletCount, spread: coneAngle });
};

/** Fires a single bullet along direction. */
export const emitLinear = (bulletEmitter, wave) => {
    emitSpread(bulletEmitter, wave, { bulletCount: 1, spread: 0 });
}
