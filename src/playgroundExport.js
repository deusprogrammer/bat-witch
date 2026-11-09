import Phaser from 'phaser';
import { AudioBufferSource, BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeAudio, canEncodeVideo } from 'mediabunny';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';

export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled.');
  }
}

// H.264 requires even dimensions.
const evenSize = (value) => Math.max(2, Math.round(value / 2) * 2);

// Runs `capture` synchronously inside Phaser's post-render event, before the WebGL drawing buffer is cleared.
const captureNextRender = (game, capture) => new Promise(resolve => {
  game.events.once(Phaser.Core.Events.POST_RENDER, () => resolve(capture()));
});

// Copies [startMs, endMs) of an AudioBuffer, so the video's audio starts at the export start time.
// Returns null if the range is entirely past the end of the track.
const sliceAudio = (buffer, startMs, endMs) => {
  const from = Math.min(buffer.length, Math.round((startMs / 1000) * buffer.sampleRate));
  const to = Math.min(buffer.length, Math.round((endMs / 1000) * buffer.sampleRate));
  if (to <= from) return null;

  const slice = new AudioBuffer({ length: to - from, numberOfChannels: buffer.numberOfChannels, sampleRate: buffer.sampleRate });
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    slice.copyToChannel(buffer.getChannelData(channel).subarray(from, to), channel);
  }
  return slice;
};

// Codec strings for a quick WebCodecs probe. canEncodeAudio can't be trusted on its own: some
// Chromium builds (e.g. VS Code's Electron browser) report codecs as supported, then refuse them
// once encoding starts. mediabunny also needs a matching AudioDecoder to time-align the audio.
const AUDIO_PROBE_CODECS = { aac: 'mp4a.40.2', opus: 'opus' };

const probeAudioDecoder = async (codec) => {
  if (typeof AudioDecoder === 'undefined') return false;
  let failed = false;
  const decoder = new AudioDecoder({ output: () => {}, error: () => { failed = true; } });
  try {
    decoder.configure({ codec: AUDIO_PROBE_CODECS[codec], sampleRate: 48000, numberOfChannels: 1 });
    // Configuration errors arrive asynchronously; flush settles once they would have.
    await decoder.flush();
    return !failed;
  } catch {
    return false;
  } finally {
    if (decoder.state !== 'closed') decoder.close();
  }
};

const probeAudioEncoder = async (codec, { numberOfChannels, sampleRate }) => {
  if (typeof AudioEncoder === 'undefined') return false;
  let failed = false;
  const encoder = new AudioEncoder({ output: () => {}, error: () => { failed = true; } });
  try {
    encoder.configure({ codec: AUDIO_PROBE_CODECS[codec], numberOfChannels, sampleRate, bitrate: 128000 });
    const numberOfFrames = 2048;
    encoder.encode(new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfChannels,
      numberOfFrames,
      timestamp: 0,
      data: new Float32Array(numberOfFrames * numberOfChannels)
    }));
    await encoder.flush();
    return !failed;
  } catch {
    return false;
  } finally {
    if (encoder.state !== 'closed') encoder.close();
  }
};

const pickAudioCodec = async (audio) => {
  for (const codec of ['aac', 'opus']) {
    if (!(await canEncodeAudio(codec, { numberOfChannels: audio.numberOfChannels, sampleRate: audio.sampleRate }))) continue;
    if (await probeAudioEncoder(codec, audio) && await probeAudioDecoder(codec)) return codec;
  }
  return null;
};

const createMp4Writer = async (canvas, fps, audio, onWarning) => {
  const { width, height } = canvas;
  if (!(await canEncodeVideo('avc', { width, height, quality: QUALITY_HIGH }))) {
    throw new Error('This browser cannot encode H.264 video. Try Chrome or Edge, or export a GIF instead.');
  }

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget()
  });
  const source = new CanvasSource(canvas, { codec: 'avc', quality: QUALITY_HIGH });
  output.addVideoTrack(source, { frameRate: fps });

  let audioSource = null;
  const audioCodec = audio && await pickAudioCodec(audio);
  if (audioCodec) {
    audioSource = new AudioBufferSource({ codec: audioCodec, quality: QUALITY_HIGH });
    output.addAudioTrack(audioSource);
  } else if (audio) {
    onWarning?.('This browser can\'t encode audio (AAC/Opus), so the video was exported without music. Chrome and Edge support it.');
  }

  await output.start();
  // The whole clip goes in up front; the in-memory muxer interleaves it with the frames on finalize.
  if (audioSource) await audioSource.add(audio);

  return {
    addFrame: (index) => source.add(index / fps, 1 / fps),
    finish: async () => {
      await output.finalize();
      return new Blob([output.target.buffer], { type: 'video/mp4' });
    },
    cancel: () => output.cancel()
  };
};

const createGifWriter = (canvas, fps) => {
  const { width, height } = canvas;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  const gif = GIFEncoder();
  const delay = Math.round(1000 / fps);

  return {
    addFrame: (index) => {
      const { data } = context.getImageData(0, 0, width, height);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), width, height, { palette, delay, repeat: index === 0 ? 0 : undefined });
    },
    finish: async () => {
      gif.finish();
      return new Blob([gif.bytes()], { type: 'image/gif' });
    },
    cancel: async () => {}
  };
};

/**
 * Renders the playground timeline frame by frame (independent of real-time playback speed)
 * and encodes it as an MP4 or GIF Blob. For MP4, pass `audioBuffer` (the full track, where
 * timeline time = song time) to add the matching stretch of it as an audio track. If the browser
 * can't encode audio, the video is exported silent and `onWarning` explains why.
 */
export const exportTimeline = async ({ game, scene, format, start, end, fps, scale, audioBuffer, onProgress, onWarning, signal }) => {
  const width = evenSize(game.canvas.width * scale);
  const height = evenSize(game.canvas.height * scale);
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const frameContext = frameCanvas.getContext('2d', { willReadFrequently: format === 'gif' });
  frameContext.imageSmoothingQuality = 'high';

  const frameCount = Math.max(1, Math.round(((end - start) / 1000) * fps));
  const audio = format === 'mp4' && audioBuffer ? sliceAudio(audioBuffer, start, end) : null;
  const writer = format === 'gif' ? createGifWriter(frameCanvas, fps) : await createMp4Writer(frameCanvas, fps, audio, onWarning);

  const hudWasVisible = scene.bulletCountText.visible;
  scene.bulletCountText.setVisible(false);

  try {
    for (let index = 0; index < frameCount; index++) {
      if (signal?.aborted) throw new ExportCancelledError();

      scene.seek(start + (index * 1000) / fps);
      await captureNextRender(game, () => frameContext.drawImage(game.canvas, 0, 0, width, height));

      await writer.addFrame(index);
      onProgress?.((index + 1) / frameCount);
    }

    return await writer.finish();
  } catch (error) {
    await writer.cancel().catch(() => {});
    throw error;
  } finally {
    scene.bulletCountText.setVisible(hudWasVisible);
  }
};
