// Loudness is measured in short windows; waveform(t) interpolates between them.
const WINDOW_SECONDS = 1 / 120;
const NORMALIZE_PERCENTILE = 0.99;

/** Decodes MP3/WAV/etc. bytes into an AudioBuffer. */
export const decodeAudio = (arrayBuffer, context = new OfflineAudioContext(1, 1, 44100)) => {
    // decodeAudioData detaches its input, so hand it a copy the caller can keep using.
    return context.decodeAudioData(arrayBuffer.slice(0));
};

/**
 * Turns an AudioBuffer into a single reusable function:
 *
 *   const waveform = createWaveform(audioBuffer);
 *   waveform(t)   // loudness at t seconds into the track, 0 (silent) to 1 (loudest)
 *
 * The raw signal swings between -1 and 1 hundreds of times per frame, which is noise at
 * 60 fps, so this returns its smoothed RMS loudness envelope instead, normalized so the loudest
 * moments (99th percentile) reach 1. Outside the track it returns 0.
 * The function also exposes `duration` (seconds) and `envelope` (the sampled values).
 */
export const createWaveform = (audioBuffer, { windowSeconds = WINDOW_SECONDS, attack = 0.01, release = 0.15 } = {}) => {
    const { sampleRate, numberOfChannels, length, duration } = audioBuffer;
    const windowSize = Math.max(1, Math.round(sampleRate * windowSeconds));
    const windowCount = Math.ceil(length / windowSize);
    const channels = Array.from({ length: numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
    const envelope = new Float32Array(windowCount);

    for (let w = 0; w < windowCount; w++) {
        const start = w * windowSize;
        const end = Math.min(length, start + windowSize);
        let sumOfSquares = 0;
        for (const data of channels) {
            for (let s = start; s < end; s++) sumOfSquares += data[s] * data[s];
        }
        envelope[w] = Math.sqrt(sumOfSquares / ((end - start) * numberOfChannels));
    }

    // Envelope follower: rises within `attack` seconds and falls over `release`, so beats hit
    // immediately but don't flicker. Set either to 0 to disable that side of the smoothing.
    const step = windowSize / sampleRate;
    const smoothing = (seconds) => (seconds > 0 ? 1 - Math.exp(-step / seconds) : 1);
    const attackRate = smoothing(attack);
    const releaseRate = smoothing(release);
    for (let w = 1; w < windowCount; w++) {
        const previous = envelope[w - 1];
        envelope[w] = previous + (envelope[w] - previous) * (envelope[w] > previous ? attackRate : releaseRate);
    }

    const sorted = Float32Array.from(envelope).sort();
    const reference = sorted[Math.floor((sorted.length - 1) * NORMALIZE_PERCENTILE)] || 1;
    for (let w = 0; w < windowCount; w++) envelope[w] = Math.min(1, envelope[w] / reference);

    const waveform = (t) => {
        const position = t / step - 0.5;
        if (!(position > -0.5 && t < duration)) return 0;
        const index = Math.max(0, Math.floor(position));
        const next = Math.min(windowCount - 1, index + 1);
        const fraction = Math.min(1, Math.max(0, position - index));
        return envelope[index] + (envelope[next] - envelope[index]) * fraction;
    };
    waveform.duration = duration;
    waveform.envelope = envelope;
    return waveform;
};

/** Fetches, decodes and analyzes an audio file in one go. Accepts a URL, File/Blob or ArrayBuffer. */
export const loadWaveform = async (source, context) => {
    let bytes = source;
    if (typeof source === 'string') {
        const response = await fetch(source);
        if (!response.ok) throw new Error(`Could not load ${source} (${response.status}).`);
        bytes = await response.arrayBuffer();
    } else if (source instanceof Blob) {
        bytes = await source.arrayBuffer();
    }
    const audioBuffer = await decodeAudio(bytes, context);
    return { audioBuffer, waveform: createWaveform(audioBuffer) };
};

/**
 * A clock for a BulletEmitter's `timeSource`: `now` is the elapsed playtime of a Phaser
 * sound in ms. In game code: `createWaveform(scene.cache.audio.get('song'))` gives the waveform
 * (WebAudio mode), and `timeSource: soundClock(scene.sound.add('song'))` keeps bullets in song time.
 */
export const soundClock = (sound) => ({
    get now() {
        return sound.seek * 1000;
    }
});
