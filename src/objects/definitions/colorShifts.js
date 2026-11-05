import { clamp, hsv, mix, palette, toTint } from '../utils/bulletUtils';
import { FLAG_PALETTES } from './flagPalettes';

/**
 * Factories for BulletEmitter's `color` option. Each returns a color(context)
 * function (see BulletEmitter.js for the context fields; these use age, bulletIndex and bulletCount).
 *   color: colorShifts.rainbow({ speed: 0.3, spread: 1 })
 * Colors may be 0xRRGGBB, '#RRGGBB' or {r, g, b}.
 */
export const colorShifts = {
    // Cycles through the rainbow; spread offsets the hue across the bullets of a wave.
    rainbow: ({ speed = 0.5, spread = 0, saturation = 1, value = 1 } = {}) =>
        ({ age, bulletIndex = 0, bulletCount = 1 }) => hsv(age * speed + spread * (bulletIndex / bulletCount), saturation, value),

    // Oscillates smoothly between two colors.
    pulse: ({ from = 0xff66cc, to = 0x66ccff, frequency = 4 } = {}) => {
        const a = toTint(from);
        const b = toTint(to);
        return ({ age }) => mix(a, b, 0.5 + 0.5 * Math.sin(age * frequency));
    },

    // Blends from one color to another over `duration` seconds, then holds.
    fade: ({ from = 0xffffff, to = 0xff3333, duration = 2 } = {}) => {
        const a = toTint(from);
        const b = toTint(to);
        return ({ age }) => mix(a, b, age / duration);
    },

    // White-hot at spawn, cooling through yellow and orange to red.
    heat: ({ duration = 3 } = {}) =>
        ({ age }) => hsv(0.16 * (1 - clamp(age / duration)), clamp(age / (duration / 2)), 1),

    // Blinks to `flash` for `flashDuration` seconds every `interval` seconds.
    strobe: ({ base = 0xff5555, flash = 0xffffff, interval = 0.5, flashDuration = 0.1 } = {}) => {
        const a = toTint(base);
        const b = toTint(flash);
        return ({ age }) => (age % interval < flashDuration ? b : a);
    },

    // Cycles through any list of colors; spread offsets each bullet by that many colors across the ring.
    palette: ({ colors, speed = 2, spread = 0, blend = 0.35 } = {}) => {
        const tints = colors.map(toTint);
        return ({ age, bulletIndex = 0, bulletCount = 1 }) => palette(tints, age * speed + spread * (bulletIndex / bulletCount), blend);
    },

    // Pulses through a pride flag's stripes, e.g. colorShifts.flag({ flag: 'trans' }). See flagPalettes.js.
    flag: ({ flag = 'trans', ...options } = {}) =>
        colorShifts.palette({ colors: FLAG_PALETTES[flag] ?? FLAG_PALETTES.trans, ...options })
};
