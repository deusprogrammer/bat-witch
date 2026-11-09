import { createWaveform, decodeAudio } from './objects/utils/audioWaveform.js';

/**
 * Plays one track in step with the playground timeline: timeline time = song time.
 * While it's playing, the timeline reads its position from the audio clock so bullets stay in sync.
 */
export default class PlaygroundAudio {
  constructor() {
    this.context = new AudioContext();
    this.gain = this.context.createGain();
    this.gain.connect(this.context.destination);
    this.buffer = null;
    this.waveform = null;
    this.name = '';
    this.url = null;
    this.source = null;
    this.startedAt = 0;
    this.offset = 0;
  }

  get loaded() {
    return Boolean(this.buffer);
  }

  get playing() {
    return Boolean(this.source);
  }

  /** True once the browser allows audio (it stays suspended until a user gesture). */
  get running() {
    return this.context.state === 'running';
  }

  /** Song position in ms, read from the audio hardware clock. */
  get position() {
    if (!this.source) return this.offset;
    return this.offset + (this.context.currentTime - this.startedAt) * 1000;
  }

  get duration() {
    return this.buffer ? this.buffer.duration * 1000 : 0;
  }

  /** source: URL string or File. */
  async load(source) {
    let bytes;
    let name;
    if (typeof source === 'string') {
      const response = await fetch(source);
      if (!response.ok) throw new Error(`Could not load ${source} (${response.status}).`);
      bytes = await response.arrayBuffer();
      name = decodeURIComponent(source.split('/').pop());
    } else {
      bytes = await source.arrayBuffer();
      name = source.name;
    }

    const buffer = await decodeAudio(bytes, this.context);
    this.stop();
    this.buffer = buffer;
    this.waveform = createWaveform(buffer);
    this.name = name;
    this.url = typeof source === 'string' ? source : null;
  }

  unload() {
    this.stop();
    this.buffer = null;
    this.waveform = null;
    this.name = '';
    this.url = null;
  }

  resume() {
    if (!this.running) this.context.resume().catch(() => {});
  }

  play(fromMs) {
    if (!this.buffer) return;
    this.stop();
    this.resume();
    this.offset = Math.max(0, fromMs);
    if (this.offset >= this.duration) return;

    const source = this.context.createBufferSource();
    source.buffer = this.buffer;
    source.connect(this.gain);
    source.start(0, this.offset / 1000);
    source.onended = () => {
      if (this.source === source) {
        this.offset = this.duration;
        this.source = null;
      }
    };
    this.startedAt = this.context.currentTime;
    this.source = source;
  }

  stop() {
    if (!this.source) return;
    this.offset = this.position;
    const source = this.source;
    this.source = null;
    source.onended = null;
    source.stop();
    source.disconnect();
  }

  setVolume(volume) {
    this.gain.gain.value = volume;
  }
}
