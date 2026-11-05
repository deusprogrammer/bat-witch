import Phaser from 'phaser';
import PlaygroundScene from './scenes/PlaygroundScene.js';
import { BUILT_IN_PRESETS, COLOR_SHIFT_PRESETS, DEFAULT_SETTINGS, SIZE_SHIFT_PRESETS } from './playgroundPresets.js';
import { ExportCancelledError, exportTimeline } from './playgroundExport.js';
import { BULLET_TEXTURES } from './objects/definitions/bulletTextures.js';
import { backOut, clamp, hsv, mix, palette, rgb } from './objects/utils/bulletUtils.js';
import { FLAG_PALETTES } from './objects/definitions/flagPalettes.js';

const WIDTH = 540;
const HEIGHT = 720;
const STORAGE_KEY = 'bulletPlayground.presets';

const settings = { ...DEFAULT_SETTINGS };
// Last valid text for each field, so expressions can be saved and copied as strings.
const sources = {};

const timeline = {
  duration: 20000,
  loop: true,
  playing: true
};

const EXPRESSION_HELPERS = { hsv, rgb, mix, clamp, backOut, palette, FLAGS: FLAG_PALETTES };

const PER_WAVE = { vars: ['i'], sample: [1], hint: '<code>i</code> = wave index' };
const PER_BULLET = {
  vars: ['i', 'j', 'n'],
  sample: [1, 1, 8],
  hint: '<code>i</code> = wave index, <code>j</code> = bullet index, <code>n</code> = bullets in wave'
};

const controls = [
  { key: 'velocity', label: 'Velocity (px/s)', min: -1500, max: 1500, step: 10, ...PER_BULLET },
  {
    key: 'outwardVelocity',
    label: 'Outward velocity over time (px/s)',
    optional: true,
    vars: ['t', 'v', 'i', 'j'],
    sample: [1, 100, 1, 1],
    hint: 'Optional; overrides velocity. <code>t</code> = bullet age (s), <code>v</code> = resolved velocity, <code>i</code>/<code>j</code> = wave/bullet index. e.g. <code>v * (1 + Math.sin(t * 4))</code>'
  },
  {
    key: 'color',
    label: 'Color (tint)',
    optional: true,
    color: true,
    vars: ['t', 'i', 'j', 'n'],
    sample: [1, 1, 1, 8],
    snippets: COLOR_SHIFT_PRESETS,
    hint: 'Optional; blank = untinted. <code>#ff8800</code>, <code>0xff8800</code> or an expression using <code>t</code> = bullet age (s), <code>i</code>/<code>j</code>/<code>n</code>, <code>hsv(h, s, v)</code> (0–1), <code>rgb(r, g, b)</code> (0–255) and <code>mix(colorA, colorB, f)</code>, <code>palette(FLAGS.trans, t * 2)</code>. e.g. <code>hsv(t * 0.3 + j / n)</code>'
  },
  {
    key: 'size',
    label: 'Size (px tall)',
    min: 4,
    max: 128,
    step: 1,
    vars: ['t', 'i', 'j', 'n'],
    sample: [1, 1, 1, 8],
    snippets: SIZE_SHIFT_PRESETS,
    hint: '<code>t</code> = bullet age (s), <code>i</code>/<code>j</code>/<code>n</code>; also <code>clamp(x, min, max)</code> and <code>backOut(x)</code>. e.g. <code>32 + 8 * Math.sin(t * 6)</code>'
  },
  { key: 'angularVelocity', label: 'Angular velocity (rad/s)', min: -10, max: 10, step: 0.05, patterns: ['orbit_burst'], ...PER_BULLET },
  { key: 'spinVelocity', label: 'Spin velocity (rad/s)', min: -20, max: 20, step: 0.1, ...PER_BULLET },
  { key: 'startAngle', label: 'Start angle offset (rad)', min: -3.14, max: 3.14, step: 0.01, ...PER_BULLET },
  { key: 'projectilesPerWave', label: 'Projectiles per wave', min: 1, max: 360, step: 1, patterns: ['orbit_burst', 'burst'], ...PER_WAVE },
  {
    key: 'waveInterval',
    label: 'Wave interval (ms since previous wave)',
    min: 0,
    max: 2000,
    step: 10,
    ...PER_WAVE,
    hint: '<code>i</code> = wave index, e.g. <code>200 + Math.sin(i * 0.8) * 150</code>'
  },
  { key: 'waveCount', label: 'Waves per volley', min: 1, max: 50, step: 1 },
  { key: 'fireCooldown', label: 'Volley cooldown (ms)', min: 100, max: 15000, step: 100 },
  { key: 'originX', label: 'Emitter X', min: 0, max: WIDTH, step: 1 },
  { key: 'originY', label: 'Emitter Y', min: 0, max: HEIGHT, step: 1 }
];

const parseControlValue = (control, text) => {
  const expression = String(text ?? '').trim();
  if (!expression) {
    if (control.optional) return undefined;
    throw new Error('A value is required.');
  }

  if (control.color && /^#[0-9a-f]{6}$/i.test(expression)) {
    return parseInt(expression.slice(1), 16);
  }

  const number = Number(expression);
  if (Number.isFinite(number)) return number;
  if (!control.vars) throw new Error('Must be a number.');

  const helperNames = Object.keys(EXPRESSION_HELPERS);
  const helpers = Object.values(EXPRESSION_HELPERS);
  const evaluate = new Function(...control.vars, ...helperNames, `"use strict"; return (${expression});`);
  if (!Number.isFinite(Number(evaluate(...control.sample, ...helpers)))) {
    throw new Error('Expression must evaluate to a number.');
  }

  return (...args) => Number(evaluate(...control.vars.map((_, index) => args[index]), ...helpers)) || 0;
};

let game;

const withScene = (callback) => {
  const scene = game?.scene.getScene('PlaygroundScene');
  if (scene && scene.emitter) callback(scene);
};

const settingsChanged = () => withScene(scene => scene.markDirty());

// ---- Parameter form ----

const controlsContainer = document.getElementById('numeric-controls');
const controlRows = [];

const snippetOptions = (snippets) => {
  const option = (snippet) => `<option value="${snippets.indexOf(snippet)}">${snippet.name}</option>`;
  const groups = [...new Set(snippets.map(snippet => snippet.group))];
  return groups.map(group => {
    const options = snippets.filter(snippet => snippet.group === group).map(option).join('');
    return group ? `<optgroup label="${group}">${options}</optgroup>` : options;
  }).join('');
};

for (const control of controls) {
  const row = document.createElement('label');
  row.className = 'control';
  row.innerHTML = `
    <span>${control.label}</span>
    ${control.min === undefined ? '' : `<input type="range" min="${control.min}" max="${control.max}" step="${control.step}">`}
    <input type="text" spellcheck="false">
    ${control.snippets ? `<select class="snippets" aria-label="${control.label} presets"><option value="">Quick presets…</option>${snippetOptions(control.snippets)}</select>` : ''}
    ${control.hint ? `<span class="hint">${control.hint}</span>` : ''}
    <span class="error"></span>`;

  const slider = row.querySelector('input[type=range]');
  const textInput = row.querySelector('input[type=text]');
  const error = row.querySelector('.error');

  const setValid = (value, text) => {
    settings[control.key] = value;
    sources[control.key] = text;
    if (slider && typeof value === 'number') slider.value = value;
    error.textContent = '';
    textInput.classList.remove('invalid');
    settingsChanged();
  };

  const applyText = (text) => {
    try {
      setValid(parseControlValue(control, text), String(text ?? '').trim());
      return true;
    } catch (parseError) {
      error.textContent = parseError.message;
      textInput.classList.add('invalid');
      return false;
    }
  };

  textInput.addEventListener('input', () => applyText(textInput.value));

  slider?.addEventListener('input', () => {
    textInput.value = slider.value;
    setValid(Number(slider.value), slider.value);
  });

  const setText = (text) => {
    textInput.value = text ?? '';
    return applyText(textInput.value);
  };

  const snippetSelect = row.querySelector('select.snippets');
  snippetSelect?.addEventListener('change', () => {
    const snippet = control.snippets[snippetSelect.value];
    if (snippet) setText(snippet.expression);
    snippetSelect.value = '';
  });

  controlsContainer.appendChild(row);
  controlRows.push({ control, row, setText });
}

const patternSelect = document.getElementById('pattern');
const textureSelect = document.getElementById('texture');
const autoFireInput = document.getElementById('auto-fire');

for (const key of Object.keys(BULLET_TEXTURES)) {
  const option = document.createElement('option');
  option.value = key;
  option.textContent = key;
  textureSelect.appendChild(option);
}

textureSelect.addEventListener('change', () => {
  settings.texture = textureSelect.value;
  settingsChanged();
});

const updatePatternControls = () => {
  for (const { control, row } of controlRows) {
    const enabled = !control.patterns || control.patterns.includes(settings.pattern);
    row.classList.toggle('disabled', !enabled);
    row.querySelectorAll('input').forEach(input => { input.disabled = !enabled; });
  }
};

patternSelect.addEventListener('change', () => {
  settings.pattern = patternSelect.value;
  updatePatternControls();
  settingsChanged();
});

autoFireInput.addEventListener('change', () => {
  settings.autoFire = autoFireInput.checked;
  settingsChanged();
});

// ---- Presets ----

const presetSelect = document.getElementById('preset');
const presetNameInput = document.getElementById('preset-name');
const presetStatus = document.getElementById('preset-status');

let statusTimer;
const showStatus = (message, isError = false) => {
  presetStatus.textContent = message;
  presetStatus.classList.toggle('error-text', isError);
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => { presetStatus.textContent = ''; }, 3000);
};

const loadSavedPresets = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
  } catch {
    return {};
  }
};

const storeSavedPresets = (presets) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
};

const serializeSettings = () => {
  const result = { pattern: settings.pattern, texture: settings.texture, autoFire: settings.autoFire };
  for (const { control } of controlRows) {
    const text = sources[control.key];
    if (text === undefined || text === '') continue;
    const number = Number(text);
    result[control.key] = Number.isFinite(number) && !control.color ? number : text;
  }
  return result;
};

const applyPreset = (presetSettings) => {
  const merged = { ...DEFAULT_SETTINGS, ...presetSettings };

  settings.pattern = merged.pattern;
  patternSelect.value = merged.pattern;
  settings.texture = merged.texture in BULLET_TEXTURES ? merged.texture : DEFAULT_SETTINGS.texture;
  textureSelect.value = settings.texture;
  settings.autoFire = Boolean(merged.autoFire);
  autoFireInput.checked = settings.autoFire;

  const invalid = controlRows
    .filter(({ control, setText }) => !setText(merged[control.key]))
    .map(({ control }) => control.key);

  updatePatternControls();
  settingsChanged();
  return invalid;
};

const renderPresetOptions = (selectedValue = presetSelect.value) => {
  const saved = loadSavedPresets();
  const option = (value, label) => {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  };

  presetSelect.replaceChildren(option('', 'Choose a preset…'));

  const builtInGroup = document.createElement('optgroup');
  builtInGroup.label = 'Built-in';
  for (const preset of BUILT_IN_PRESETS) {
    builtInGroup.appendChild(option(`builtin:${preset.name}`, preset.name));
  }
  presetSelect.appendChild(builtInGroup);

  const savedNames = Object.keys(saved).sort((a, b) => a.localeCompare(b));
  if (savedNames.length) {
    const savedGroup = document.createElement('optgroup');
    savedGroup.label = 'Saved';
    for (const name of savedNames) savedGroup.appendChild(option(`saved:${name}`, name));
    presetSelect.appendChild(savedGroup);
  }

  presetSelect.value = [...presetSelect.options].some(o => o.value === selectedValue) ? selectedValue : '';
  document.getElementById('delete-preset').disabled = !presetSelect.value.startsWith('saved:');
};

const findPreset = (value) => {
  if (value.startsWith('builtin:')) {
    const name = value.slice('builtin:'.length);
    return { name, settings: BUILT_IN_PRESETS.find(preset => preset.name === name)?.settings };
  }
  if (value.startsWith('saved:')) {
    const name = value.slice('saved:'.length);
    return { name, settings: loadSavedPresets()[name] };
  }
  return null;
};

presetSelect.addEventListener('change', () => {
  renderPresetOptions(presetSelect.value);
  const preset = findPreset(presetSelect.value);
  if (!preset?.settings) return;

  const invalid = applyPreset(preset.settings);
  presetNameInput.value = preset.name;
  withScene(scene => scene.reset());
  if (invalid.length) {
    showStatus(`Loaded "${preset.name}" with invalid fields: ${invalid.join(', ')}`, true);
  } else {
    showStatus(`Loaded "${preset.name}".`);
  }
});

document.getElementById('save-preset').addEventListener('click', () => {
  const name = presetNameInput.value.trim();
  if (!name) {
    showStatus('Enter a name to save this preset.', true);
    presetNameInput.focus();
    return;
  }

  const saved = loadSavedPresets();
  if (saved[name] && !confirm(`Overwrite saved preset "${name}"?`)) return;

  try {
    storeSavedPresets({ ...saved, [name]: serializeSettings() });
    renderPresetOptions(`saved:${name}`);
    showStatus(`Saved "${name}".`);
  } catch (storageError) {
    showStatus(`Could not save: ${storageError.message}`, true);
  }
});

document.getElementById('delete-preset').addEventListener('click', () => {
  const value = presetSelect.value;
  if (!value.startsWith('saved:')) return;

  const name = value.slice('saved:'.length);
  if (!confirm(`Delete saved preset "${name}"?`)) return;

  const saved = loadSavedPresets();
  delete saved[name];
  try {
    storeSavedPresets(saved);
    renderPresetOptions('');
    showStatus(`Deleted "${name}".`);
  } catch (storageError) {
    showStatus(`Could not delete: ${storageError.message}`, true);
  }
});

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // Fall back for insecure contexts or denied clipboard permission.
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard is unavailable.');
};

document.getElementById('copy-json').addEventListener('click', async () => {
  try {
    await copyText(JSON.stringify(serializeSettings(), null, 2));
    showStatus('Copied settings JSON to the clipboard.');
  } catch (copyError) {
    showStatus(`Copy failed: ${copyError.message}`, true);
  }
});

applyPreset(DEFAULT_SETTINGS);
renderPresetOptions('');

// ---- Timeline ----

const playButton = document.getElementById('play-pause');
const scrubber = document.getElementById('scrubber');
const timeReadout = document.getElementById('time-readout');
const durationInput = document.getElementById('timeline-length');
const loopInput = document.getElementById('timeline-loop');

let scrubbing = false;
let resumeAfterScrub = false;

const formatTime = (ms) => `${(ms / 1000).toFixed(2)}s`;

const renderTimeline = (time) => {
  const label = timeline.playing ? 'Pause' : 'Play';
  playButton.textContent = timeline.playing ? '❚❚' : '▶';
  playButton.setAttribute('aria-label', label);
  playButton.title = label;
  playButton.setAttribute('aria-pressed', String(timeline.playing));
  scrubber.max = timeline.duration;
  if (!scrubbing) scrubber.value = time;
  timeReadout.textContent = `${formatTime(scrubbing ? Number(scrubber.value) : time)} / ${formatTime(timeline.duration)}`;
};

playButton.addEventListener('click', () => {
  withScene(scene => {
    // Restart from the beginning when pressing play at the end of a non-looping timeline.
    if (!timeline.playing && scene.currentTime >= timeline.duration) scene.seek(0);
  });
  timeline.playing = !timeline.playing;
  renderTimeline(Number(scrubber.value));
});

scrubber.addEventListener('pointerdown', () => {
  if (scrubbing) return;
  scrubbing = true;
  resumeAfterScrub = timeline.playing;
  timeline.playing = false;
});

const endScrub = () => {
  if (!scrubbing) return;
  scrubbing = false;
  timeline.playing = resumeAfterScrub;
};

scrubber.addEventListener('input', () => {
  withScene(scene => scene.seek(Number(scrubber.value)));
  renderTimeline(Number(scrubber.value));
});
scrubber.addEventListener('change', endScrub);
window.addEventListener('pointerup', endScrub);

durationInput.value = timeline.duration / 1000;
durationInput.addEventListener('change', () => {
  const seconds = Number(durationInput.value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    durationInput.value = timeline.duration / 1000;
    return;
  }
  timeline.duration = Math.round(seconds * 1000);
  withScene(scene => {
    if (scene.currentTime > timeline.duration) scene.seek(timeline.duration);
  });
  renderTimeline(Math.min(Number(scrubber.value), timeline.duration));
});

loopInput.checked = timeline.loop;
loopInput.addEventListener('change', () => {
  timeline.loop = loopInput.checked;
});

renderTimeline(0);

// ---- Game ----

game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#0a0a1a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.NO_CENTER
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [new PlaygroundScene({ settings, timeline, onTimelineUpdate: renderTimeline })]
});

document.getElementById('fire').addEventListener('click', () => withScene(scene => scene.fire()));
document.getElementById('reset').addEventListener('click', () => withScene(scene => scene.reset()));

// ---- Export ----

const exportFormat = document.getElementById('export-format');
const exportFps = document.getElementById('export-fps');
const exportStart = document.getElementById('export-start');
const exportEnd = document.getElementById('export-end');
const exportScale = document.getElementById('export-scale');
const exportSize = document.getElementById('export-size');
const exportProgress = document.getElementById('export-progress');
const exportButton = document.getElementById('export-start-button');
const exportCancel = document.getElementById('export-cancel');
const exportStatus = document.getElementById('export-status');
const exportInputs = [exportFormat, exportFps, exportStart, exportEnd, exportScale, exportButton];

const EXPORT_DEFAULTS = {
  mp4: { fps: 30, scale: 1 },
  gif: { fps: 20, scale: 0.5 }
};

let exportAbort = null;

const readExportRange = () => {
  const durationSeconds = timeline.duration / 1000;
  const start = Math.min(Math.max(0, Number(exportStart.value) || 0), durationSeconds);
  const end = Math.min(Math.max(start, Number(exportEnd.value) || durationSeconds), durationSeconds);
  return { start: start * 1000, end: end * 1000 };
};

const updateExportSummary = () => {
  const { start, end } = readExportRange();
  const scale = Number(exportScale.value);
  const width = Math.round((WIDTH * scale) / 2) * 2;
  const height = Math.round((HEIGHT * scale) / 2) * 2;
  const frames = Math.max(1, Math.round(((end - start) / 1000) * Number(exportFps.value)));
  exportSize.textContent = `${width}×${height}, ${frames} frames`;
};

const applyExportDefaults = () => {
  const defaults = EXPORT_DEFAULTS[exportFormat.value];
  exportFps.value = defaults.fps;
  exportScale.value = defaults.scale;
  updateExportSummary();
};

const showExportStatus = (message, isError = false) => {
  exportStatus.textContent = message;
  exportStatus.classList.toggle('error-text', isError);
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

const exportFilename = (format) => {
  const name = presetNameInput.value.trim() || 'bullet-pattern';
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'bullet-pattern';
  return `${slug}.${format}`;
};

const setExporting = (exporting) => {
  document.body.classList.toggle('exporting', exporting);
  document.querySelectorAll('.lock-during-export').forEach(element => { element.inert = exporting; });
  exportInputs.forEach(input => { input.disabled = exporting; });
  exportCancel.hidden = !exporting;
  exportProgress.hidden = !exporting;
};

exportFormat.addEventListener('change', applyExportDefaults);
[exportFps, exportStart, exportEnd, exportScale].forEach(input => input.addEventListener('input', updateExportSummary));

durationInput.addEventListener('change', () => {
  const durationSeconds = timeline.duration / 1000;
  exportStart.max = durationSeconds;
  exportEnd.max = durationSeconds;
  exportEnd.value = durationSeconds;
  updateExportSummary();
});

exportButton.addEventListener('click', () => withScene(async (scene) => {
  const { start, end } = readExportRange();
  if (end <= start) {
    showExportStatus('End time must be after the start time.', true);
    return;
  }

  const format = exportFormat.value;
  const resumeTime = scene.currentTime;
  const wasPlaying = timeline.playing;
  timeline.playing = false;
  exportAbort = new AbortController();
  exportProgress.value = 0;
  setExporting(true);
  showExportStatus('Rendering frames…');

  try {
    const blob = await exportTimeline({
      game,
      scene,
      format,
      start,
      end,
      fps: Number(exportFps.value),
      scale: Number(exportScale.value),
      signal: exportAbort.signal,
      onProgress: (progress) => {
        exportProgress.value = progress;
        showExportStatus(`Rendering frames… ${Math.round(progress * 100)}%`);
      }
    });

    downloadBlob(blob, exportFilename(format));
    showExportStatus(`Exported ${exportFilename(format)} (${(blob.size / 1024 / 1024).toFixed(1)} MB).`);
  } catch (exportError) {
    if (exportError instanceof ExportCancelledError) {
      showExportStatus('Export cancelled.');
    } else {
      console.error(exportError);
      showExportStatus(`Export failed: ${exportError.message}`, true);
    }
  } finally {
    exportAbort = null;
    setExporting(false);
    scene.seek(resumeTime);
    timeline.playing = wasPlaying;
  }
}));

exportCancel.addEventListener('click', () => exportAbort?.abort());

exportEnd.value = timeline.duration / 1000;
exportStart.max = exportEnd.max = timeline.duration / 1000;
applyExportDefaults();

export default game;
