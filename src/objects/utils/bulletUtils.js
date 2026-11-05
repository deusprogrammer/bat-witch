import Phaser from 'phaser';

const RADIUS_INTEGRATION_STEP = 1 / 240;

export const outwardDistance = (bullet, age) => {
    const {behavior: {outwardVelocity}} = bullet;
    if (typeof outwardVelocity !== 'function') {
        return outwardVelocity * age;
    }

    // Integrate in fixed steps from spawn so the result depends only on age, not frame timing.
    const integral = bullet.state.radiusIntegral;
    const midpointDistance = (start, duration) => outwardVelocity(start + duration / 2) * duration;

    while ((integral.steps + 1) * RADIUS_INTEGRATION_STEP <= age) {
        integral.distance += midpointDistance(integral.steps * RADIUS_INTEGRATION_STEP, RADIUS_INTEGRATION_STEP);
        integral.steps++;
    }

    const committedAge = integral.steps * RADIUS_INTEGRATION_STEP;
    return integral.distance + midpointDistance(committedAge, age - committedAge);
}

export const toTint = (color) => typeof color === 'number' ? color : Phaser.Display.Color.ValueToColor(color).color;

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));

// Hue wraps, so hsv(t * 0.5) cycles through the rainbow forever.
export const hsv = (h, s = 1, v = 1) => Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color;

export const rgb = (r, g, b) => Phaser.Display.Color.GetColor(r, g, b);

// Blends two 0xRRGGBB colors; f = 0 gives a, f = 1 gives b.
export const mix = (a, b, f) => {
    const t = clamp(f);
    const channel = (shift) => Math.round(((a >> shift) & 0xff) + ((((b >> shift) & 0xff) - ((a >> shift) & 0xff)) * t));
    return (channel(16) << 16) | (channel(8) << 8) | channel(0);
};

// Easing that overshoots slightly before settling at 1, for "pop in" effects.
export const backOut = (x, overshoot = 1.70158) => {
    const t = clamp(x) - 1;
    return t * t * ((overshoot + 1) * t + overshoot) + 1;
};

// Steps through a list of 0xRRGGBB colors as x increases by 1 per color, looping forever.
// Each color holds, then blends into the next over the last `blend` fraction of its step.
export const palette = (colors, x, blend = 0.35) => {
    const count = colors.length;
    if (!count) return 0xffffff;
    const position = ((x % count) + count) % count;
    const index = Math.floor(position);
    const fade = blend > 0 ? clamp((position - index - (1 - blend)) / blend) : 0;
    return mix(colors[index], colors[(index + 1) % count], fade);
};
