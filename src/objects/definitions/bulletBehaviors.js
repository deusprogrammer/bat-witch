import { integrateOverAge } from '../utils/bulletUtils';

export const bulletBehaviors = {
    /**
     * Moves the bullet in polar coordinates around its origin: the radius grows by
     * outwardVelocity (px/s) and the angle turns by angularVelocity (rad/s).
     * With angularVelocity = 0 this is a straight line outward; with both non-zero it's a spiral.
     *
     * outwardVelocity and angularVelocity may be numbers or functions of the bullet's age; functions
     * are integrated over the bullet's life, so bullets speed up and turn as the values change.
     * Position depends only on age, so a bullet can be placed at any moment (used for scrubbing).
     */
    orbit: (age, bullet) => {
        const {behavior: {outwardVelocity = 0, angularVelocity = 0, startAngle = 0, startRadius = 0}, state} = bullet;
        const overAge = (rate, integral) => typeof rate === 'function'
            ? integrateOverAge((a) => Number(rate(a)) || 0, age, integral)
            : rate * age;

        state.orbitAngle = startAngle + overAge(angularVelocity, state.angleIntegral);
        state.orbitRadius = startRadius + overAge(outwardVelocity, state.radiusIntegral);

        bullet.x = bullet.origin.x + Math.cos(state.orbitAngle) * state.orbitRadius;
        bullet.y = bullet.origin.y + Math.sin(state.orbitAngle) * state.orbitRadius;
    }
}
