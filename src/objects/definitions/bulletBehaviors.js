import { integrateOverAge } from '../utils/bulletUtils';

export const bulletBehaviors = {
    /**
     * outwardVelocity and angularVelocity may be numbers or functions of the bullet's age; functions
     * are integrated over the bullet's life, so bullets speed up and turn as the values change.
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
