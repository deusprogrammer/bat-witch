import Phaser from 'phaser';
import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, QUALITY_HIGH, canEncodeVideo } from 'mediabunny';
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

const createMp4Writer = async (canvas, fps) => {
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
  await output.start();

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
 * and encodes it as an MP4 or GIF Blob.
 */
export const exportTimeline = async ({ game, scene, format, start, end, fps, scale, onProgress, signal }) => {
  const width = evenSize(game.canvas.width * scale);
  const height = evenSize(game.canvas.height * scale);
  const frameCanvas = document.createElement('canvas');
  frameCanvas.width = width;
  frameCanvas.height = height;
  const frameContext = frameCanvas.getContext('2d', { willReadFrequently: format === 'gif' });
  frameContext.imageSmoothingQuality = 'high';

  const frameCount = Math.max(1, Math.round(((end - start) / 1000) * fps));
  const writer = format === 'gif' ? createGifWriter(frameCanvas, fps) : await createMp4Writer(frameCanvas, fps);

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
