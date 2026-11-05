import { outwardDistance } from '../utils/bulletUtils';

export const bulletBehaviors = {
    orbit: (age, bullet) => {
        const {behavior: {angularVelocity, startAngle = 0, startRadius = 0}} = bullet;
        bullet.state.orbitAngle = startAngle + angularVelocity * age;
        bullet.state.orbitRadius = startRadius + outwardDistance(bullet, age);

        bullet.x = bullet.origin.x + Math.cos(bullet.state.orbitAngle) * bullet.state.orbitRadius;
        bullet.y = bullet.origin.y + Math.sin(bullet.state.orbitAngle) * bullet.state.orbitRadius;
    }
}
