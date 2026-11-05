// Bullet textures available to every BulletEmitter via its `texture` option.
// Images should be grayscale so the emitter's `color` tint shows true colors.
export const BULLET_TEXTURES = {
    'bullet': 'assets/bullet.png',
    'heart-bullet': 'assets/heart-bullet.png',
    'test-tube-bullet': 'assets/test-tube-bullet.png'
};

export const preloadBulletTextures = (scene) => {
    for (const [key, path] of Object.entries(BULLET_TEXTURES)) {
        scene.load.image(key, path);
    }
};
