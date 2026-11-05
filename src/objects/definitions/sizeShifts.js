import { backOut, clamp } from '../utils/bulletUtils';

/**
 * Factories for BulletEmitter's `size` option. Each returns size(age, waveIndex, bulletIndex, projectileCount)
 * as a display height in px.
 *   size: sizeShifts.pulse({ base: 32, amount: 8 })
 */
export const sizeShifts = {
    // Breathes in and out around `base`.
    pulse: ({ base = 32, amount = 8, frequency = 6 } = {}) =>
        (age) => base + amount * Math.sin(age * frequency),

    // Scales from `from` to `to` over `duration` seconds, then holds. Use from > to to shrink.
    grow: ({ from = 8, to = 48, duration = 2 } = {}) =>
        (age) => from + (to - from) * clamp(age / duration),

    // Pops in from nothing with a slight overshoot.
    popIn: ({ size = 32, duration = 0.35 } = {}) =>
        (age) => size * backOut(age / duration),

    // Like pulse, but offset per bullet so a ring ripples.
    ripple: ({ base = 28, amount = 10, frequency = 5, spacing = 0.8 } = {}) =>
        (age, i, j = 0) => base + amount * Math.sin(age * frequency + j * spacing)
};
