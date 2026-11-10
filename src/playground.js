import Phaser from 'phaser';
import PlaygroundScene from './scenes/PlaygroundScene.js';
import { BUILT_IN_PRESETS, COLOR_SHIFT_PRESETS, DEFAULT_SETTINGS, SIZE_SHIFT_PRESETS } from './playgroundPresets.js';
import { ExportCancelledError, exportTimeline } from './playgroundExport.js';
import { BULLET_TEXTURES } from './objects/definitions/bulletTextures.js';
import { backOut, clamp, hsv, mix, palette, rgb } from './objects/utils/bulletUtils.js';
import { FLAG_PALETTES } from './objects/definitions/flagPalettes.js';
import PlaygroundAudio from './playgroundAudio.js';
import { directionAngle } from './objects/utils/bulletEmitterUtils.js';
import { createPatternSchema, generatePattern, validateGeneratedPattern } from './playgroundAI.js';

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

const audio = new PlaygroundAudio();

// wave(time) is the loaded track's loudness (0–1) at `time` seconds; 0 when no track is loaded.
const wave = (time) => (audio.waveform ? audio.waveform(time) : 0);

const EXPRESSION_HELPERS = { hsv, rgb, mix, clamp, backOut, palette, FLAGS: FLAG_PALETTES, wave };

// Expressions can use the engine's context field names or these short aliases.
const VARIABLE_ALIASES = {
  i: 'waveIndex',
  j: 'bulletIndex',
  n: 'bulletCount',
  s: 'time',
  t: 'age',
  v: 'velocity'
};

const varName = (long, short) => `<code>${long}</code> (<code>${short}</code>)`;
const WAVE_INDEX = varName('waveIndex', 'i');
const BULLET_VARS = `${WAVE_INDEX}, ${varName('bulletIndex', 'j')}, ${varName('bulletCount', 'n')}`;
const TIME_SPAWN = `${varName('time', 's')} = timeline/song seconds when it fires`;
const TIME_NOW = `${varName('time', 's')} = timeline/song seconds, updated every frame`;
const AGE = `${varName('age', 't')} = bullet age in seconds`;

// Sample contexts used to check that an expression evaluates to a number.
const WAVE_SAMPLE = { waveIndex: 1, time: 1 };
const BULLET_SAMPLE = { waveIndex: 1, bulletIndex: 1, bulletCount: 8, time: 1, age: 0 };
const LIVE_SAMPLE = { ...BULLET_SAMPLE, age: 1 };

const PER_WAVE = { sample: WAVE_SAMPLE, hint: `${WAVE_INDEX}, ${TIME_SPAWN}` };
const PER_BULLET = { sample: BULLET_SAMPLE, hint: `${BULLET_VARS}, ${TIME_SPAWN}` };
// Re-evaluated as the bullet flies; mixing in wave(time) makes it react to the music.
const PER_BULLET_LIVE = {
  sample: LIVE_SAMPLE,
  hint: `${BULLET_VARS}, ${TIME_NOW}, ${AGE}. e.g. <code>100 + 200 * wave(time)</code>`
};

const controls = [
  { key: 'velocity', label: 'Velocity (px/s)', min: -1500, max: 1500, step: 10, ...PER_BULLET_LIVE },
  {
    key: 'outwardVelocity',
    label: 'Outward velocity over time (px/s)',
    optional: true,
    sample: { ...LIVE_SAMPLE, velocity: 100 },
    hint: `Optional; overrides velocity. ${AGE}, ${varName('velocity', 'v')} = resolved velocity, ${BULLET_VARS}, ${TIME_NOW}. e.g. <code>velocity * (1 + Math.sin(age * 4))</code>`
  },
  {
    key: 'color',
    label: 'Color (tint)',
    optional: true,
    color: true,
    sample: LIVE_SAMPLE,
    snippets: COLOR_SHIFT_PRESETS,
    hint: `Optional; blank = untinted. <code>#ff8800</code>, <code>0xff8800</code> or an expression using ${AGE}, ${BULLET_VARS}, ${TIME_NOW}, <code>hsv(hue, sat, val)</code> (0–1), <code>rgb(r, g, b)</code> (0–255) and <code>mix(colorA, colorB, f)</code>, <code>palette(FLAGS.trans, age * 2)</code>. e.g. <code>hsv(age * 0.3 + bulletIndex / bulletCount)</code>`
  },
  {
    key: 'size',
    label: 'Size (px tall)',
    min: 4,
    max: 128,
    step: 1,
    sample: LIVE_SAMPLE,
    snippets: SIZE_SHIFT_PRESETS,
    hint: `${AGE}, ${BULLET_VARS}, ${TIME_NOW}; also <code>clamp(x, min, max)</code> and <code>backOut(x)</code>. e.g. <code>32 + 8 * Math.sin(age * 6)</code> or <code>16 + 30 * wave(time)</code>`
  },
  { key: 'angularVelocity', label: 'Angular velocity (rad/s)', min: -10, max: 10, step: 0.05, patterns: ['orbit_burst'], ...PER_BULLET_LIVE },
  { key: 'spinVelocity', label: 'Spin velocity (rad/s)', min: -20, max: 20, step: 0.1, ...PER_BULLET_LIVE },
  { key: 'startRotation', label: 'Initial rotation offset (rad)', min: -6.28, max: 6.28, step: 0.01, ...PER_BULLET,
    hint: 'Applied once at spawn, before spin. With alignment enabled, added to each bullet angle and follows orbital turns. For a downward-pointing heart, use -Math.PI / 2.' },
  { key: 'direction', label: 'Direction (radians or [x, y])', ...PER_BULLET,
    hint: 'Cone center / ring first bullet. Radians or a non-zero vector, e.g. [0, -1] points up. Expressions may use waveIndex, bulletIndex, bulletCount and time.' },
  { key: 'coneAngle', label: 'Cone total spread (rad)', min: 0, max: 6.28, step: 0.01, patterns: ['cone'], ...PER_WAVE },
  { key: 'projectilesPerWave', label: 'Projectiles per wave', min: 1, max: 360, step: 1, patterns: ['orbit_burst', 'burst', 'cone'], ...PER_WAVE },
  {
    key: 'waveInterval',
    label: 'Wave interval (ms since previous wave)',
    min: 0,
    max: 2000,
    step: 10,
    ...PER_WAVE,
    hint: `${WAVE_INDEX}, ${varName('time', 's')} = seconds of the previous wave, e.g. <code>200 + Math.sin(waveIndex * 0.8) * 150</code> or <code>300 - 220 * wave(time)</code>`
  },
  { key: 'waveCount', label: 'Waves per volley', min: 1, max: 50, step: 1 },
  { key: 'fireCooldown', label: 'Volley cooldown (ms)', min: 100, max: 15000, step: 100 },
  { key: 'originX', label: 'Emitter X', min: 0, max: WIDTH, step: 1 },
  { key: 'originY', label: 'Emitter Y', min: 0, max: HEIGHT, step: 1 }
];

const usesName = (expression, name) => new RegExp(`(?<![\\w$.])${name}(?![\\w$])`).test(expression);

/**
 * Builds the source of an arrow that takes the context object. Only the fields the expression
 * mentions (by long name or alias) are read, since these run for every bullet every step.
 */
const contextArrowSource = (expression, result) => {
  const fields = new Set();
  const aliases = [];
  for (const [alias, field] of Object.entries(VARIABLE_ALIASES)) {
    if (usesName(expression, field)) fields.add(field);
    if (usesName(expression, alias)) {
      fields.add(field);
      aliases.push(`${alias} = ${field}`);
    }
  }
  const params = fields.size ? `{ ${[...fields].join(', ')} }` : '';
  const declarations = aliases.length ? `const ${aliases.join(', ')}; ` : '';
  return `(${params}) => { ${declarations}return ${result}; }`;
};

/**
 * Turns a field's text into a value for the emitter: a number, or a function of the engine's
 * context object for expressions. Throws with a readable message when the text is invalid.
 */
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
  if (!control.sample) throw new Error('Must be a number.');

  const helperNames = Object.keys(EXPRESSION_HELPERS);
  const helpers = Object.values(EXPRESSION_HELPERS);
  // Helpers are bound once. The returned arrows destructure the context object (no allocation),
  // since audio patterns can call these millions of times while rebuilding a long song.
  const [evaluate, evaluateNumber] = new Function(
    ...helperNames,
    `"use strict"; return [${contextArrowSource(expression, `(${expression})`)}, ${contextArrowSource(expression, `Number(${expression}) || 0`)}];`
  )(...helpers);
  if (control.key === 'direction') {
    directionAngle(evaluate(control.sample));
    return evaluate;
  }
  if (!Number.isFinite(Number(evaluate(control.sample)))) {
    throw new Error('Expression must evaluate to a number.');
  }

  return evaluateNumber;
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
const alignToDirectionInput = document.getElementById('align-to-direction');

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

alignToDirectionInput.addEventListener('change', () => {
  settings.alignToDirection = alignToDirectionInput.checked;
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
  const result = {
    pattern: settings.pattern, texture: settings.texture, autoFire: settings.autoFire,
    alignToDirection: settings.alignToDirection
  };
  if (settings.childEmitter) result.childEmitter = settings.childEmitter;
  // Only tracks loaded from a URL can be saved; uploaded files have to be picked again.
  if (audio.url) result.audio = audio.url;
  for (const { control } of controlRows) {
    const text = sources[control.key];
    if (text === undefined || text === '') continue;
    const number = Number(text);
    result[control.key] = Number.isFinite(number) && !control.color ? number
      : control.key === 'direction' && Array.isArray(settings.direction) ? settings.direction : text;
  }
  return result;
};

const applyPreset = (presetSettings) => {
  const merged = { ...DEFAULT_SETTINGS, ...presetSettings };
  if (presetSettings.direction === undefined) {
    const offset = presetSettings.pattern === 'linear' ? Math.PI / 2 : 0;
    if (presetSettings.startAngle !== undefined) {
      const spread = presetSettings.pattern === 'cone' ? Number(merged.coneAngle) / 2 : 0;
      merged.direction = `(${presetSettings.startAngle}) + ${offset + spread}`;
    } else {
      merged.direction = offset;
    }
  }

  settings.pattern = merged.pattern;
  settings.childEmitter = merged.childEmitter;
  patternSelect.value = merged.pattern;
  settings.texture = merged.texture in BULLET_TEXTURES ? merged.texture : DEFAULT_SETTINGS.texture;
  textureSelect.value = settings.texture;
  settings.autoFire = Boolean(merged.autoFire);
  autoFireInput.checked = settings.autoFire;
  settings.alignToDirection = Boolean(merged.alignToDirection);
  alignToDirectionInput.checked = settings.alignToDirection;

  const invalid = controlRows
    .filter(({ control, setText }) => !setText(Array.isArray(merged[control.key])
      ? JSON.stringify(merged[control.key]) : merged[control.key]))
    .map(({ control }) => control.key);

  updatePatternControls();
  settingsChanged();
  // Presets without a track keep whatever track is loaded.
  if (merged.audio && merged.audio !== audio.url) loadTrack(merged.audio);
  return invalid;
};

// ---- Local AI pattern generation ----

const aiDialog = document.getElementById('ai-dialog');
const aiForm = document.getElementById('ai-form');
const aiPrompt = document.getElementById('ai-prompt');
const aiStatus = document.getElementById('ai-status');
const aiGenerate = document.getElementById('ai-generate');
const aiClose = document.getElementById('ai-close');
const undoAI = document.getElementById('undo-ai');
const aiSchema = createPatternSchema(controls, Object.keys(BULLET_TEXTURES));
let aiAbort = null;
let beforeAI = null;
let aiModifyCurrent = false;
let aiCreatePrompt = '';
let aiEditPrompt = '';

const showAIStatus = (message, isError = false) => {
  aiStatus.textContent = message;
  aiStatus.classList.toggle('error', isError);
};

const openAIDialog = (modifyCurrent) => {
  if (aiAbort) return;
  if (aiModifyCurrent) aiEditPrompt = aiPrompt.value;
  else aiCreatePrompt = aiPrompt.value;
  aiModifyCurrent = modifyCurrent;
  aiPrompt.value = modifyCurrent ? aiEditPrompt : aiCreatePrompt;
  document.getElementById('ai-title').textContent = modifyCurrent ? 'Edit current bullet pattern' : 'Create a bullet pattern';
  document.getElementById('ai-prompt-label').textContent = modifyCurrent ? 'Describe your changes' : 'Describe your pattern';
  document.getElementById('ai-mode-hint').textContent = modifyCurrent
    ? 'Uses the latest preview settings, including manual edits. Unrelated values should be preserved.'
    : 'Creates a fresh pattern without using the current settings.';
  aiPrompt.placeholder = modifyCurrent
    ? 'Make the bullets blue and slow them down'
    : 'A downward fan of blue bullets sweeping left and right';
  aiGenerate.textContent = modifyCurrent ? 'Apply changes and preview' : 'Generate and preview';
  showAIStatus('');
  aiDialog.showModal();
  aiPrompt.focus();
};
document.getElementById('open-ai').addEventListener('click', () => openAIDialog(false));
document.getElementById('edit-ai').addEventListener('click', () => openAIDialog(true));
aiClose.addEventListener('click', () => aiDialog.close());
aiDialog.addEventListener('close', () => aiAbort?.abort());

aiForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (aiAbort) return;
  const prompt = aiPrompt.value.trim();
  if (!prompt) {
    showAIStatus(aiModifyCurrent ? 'Describe the changes you want to make.' : 'Describe the pattern you want to create.', true);
    aiPrompt.focus();
    return;
  }
  aiAbort = new AbortController();
  aiGenerate.disabled = true;
  aiPrompt.disabled = true;
  aiClose.textContent = 'Cancel';
  aiForm.setAttribute('aria-busy', 'true');
  showAIStatus('Generating with gpt-oss:20b locally. This may take a few minutes...');
  try {
    const generated = await generatePattern({
      prompt, currentSettings: serializeSettings(), schema: aiSchema, signal: aiAbort.signal,
      modifyCurrent: aiModifyCurrent,
      validate: value => validateGeneratedPattern(value, aiSchema, (key, fieldValue) => {
        parseControlValue(controls.find(control => control.key === key), fieldValue);
      })
    });
    if (aiAbort.signal.aborted || !aiDialog.open) return;
    const previousSettings = serializeSettings();
    const invalid = applyPreset(generated);
    if (invalid.length) {
      applyPreset(previousSettings);
      throw new Error(`Invalid generated fields: ${invalid.join(', ')}`);
    }
    beforeAI = previousSettings;
    undoAI.disabled = false;
    withScene(scene => scene.reset());
    showStatus('AI pattern applied temporarily. Use Undo AI change to restore it, or Save to keep it.');
    aiDialog.close();
  } catch (error) {
    if (error.name !== 'AbortError') {
      console.error(error);
      showAIStatus(`Generation failed: ${error.message}`, true);
    }
  } finally {
    aiAbort = null;
    aiGenerate.disabled = false;
    aiPrompt.disabled = false;
    aiClose.textContent = 'Close';
    aiForm.removeAttribute('aria-busy');
  }
});

undoAI.addEventListener('click', () => {
  if (!beforeAI) return;
  applyPreset(beforeAI);
  beforeAI = null;
  undoAI.disabled = true;
  withScene(scene => scene.reset());
  showStatus('Restored settings from before the last AI change.');
});

const renderPresetOptions = (selectedValue = presetSelect.value) => {
  const saved = loadSavedPresets();
  const option = (value, label) => {
    const element = document.createElement('option');
    element.value = value;
    element.textContent = label;
    return element;
  };

  presetSelect.replaceChildren(option('', 'Choose a preset…'));

  for (const [label, withMusic] of [['Built-in', false], ['With music', true]]) {
    const group = document.createElement('optgroup');
    group.label = label;
    for (const preset of BUILT_IN_PRESETS.filter(preset => Boolean(preset.settings.audio) === withMusic)) {
      group.appendChild(option(`builtin:${preset.name}`, preset.name));
    }
    if (group.children.length) presetSelect.appendChild(group);
  }

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

// ---- Audio ----

const audioFileInput = document.getElementById('audio-file');
const audioStatus = document.getElementById('audio-status');
const audioControls = document.getElementById('audio-controls');
const audioVolume = document.getElementById('audio-volume');
const waveCanvas = document.getElementById('audio-waveform');
const DEFAULT_AUDIO_HINT = audioStatus.innerHTML;
let waveImage = null;

function setAudioStatus(html, isError = false) {
  audioStatus.innerHTML = html;
  audioStatus.classList.toggle('error-text', isError);
}

function updateAudioStatus() {
  updateExportAudioRow();
  if (!audio.loaded) {
    setAudioStatus(DEFAULT_AUDIO_HINT);
    return;
  }
  setAudioStatus(`♪ ${audio.name} (${(audio.duration / 1000).toFixed(1)}s). Timeline time = song time <code>time</code> (<code>s</code>); use <code>wave(time)</code> for its loudness (0–1).`);
}

// Pre-renders the loudness envelope once; each frame only draws it plus the playhead.
function buildWaveImage() {
  const image = document.createElement('canvas');
  image.width = waveCanvas.width;
  image.height = waveCanvas.height;
  const context = image.getContext('2d');
  const { envelope } = audio.waveform;
  const perColumn = envelope.length / image.width;
  context.fillStyle = '#4b5fae';
  for (let x = 0; x < image.width; x++) {
    let peak = 0;
    for (let k = Math.floor(x * perColumn); k < Math.floor((x + 1) * perColumn); k++) peak = Math.max(peak, envelope[k]);
    const height = Math.max(1, peak * image.height);
    context.fillRect(x, image.height - height, 1, height);
  }
  return image;
}

function renderWaveform(time) {
  if (!audio.waveform) return;
  waveImage ??= buildWaveImage();
  const context = waveCanvas.getContext('2d');
  context.clearRect(0, 0, waveCanvas.width, waveCanvas.height);
  context.drawImage(waveImage, 0, 0);
  const x = (time / audio.duration) * waveCanvas.width;
  context.fillStyle = '#ff6fa8';
  context.fillRect(Math.round(x) - 1, 0, 2, waveCanvas.height);
}

async function loadTrack(source) {
  const label = typeof source === 'string' ? decodeURIComponent(source.split('/').pop()) : source.name;
  setAudioStatus(`Loading ${label}…`);
  audio.resume();
  try {
    await audio.load(source);
  } catch (loadError) {
    console.error(loadError);
    setAudioStatus(`Could not load ${label}: ${loadError.message}`, true);
    return;
  }

  waveImage = null;
  waveCanvas.hidden = false;
  audioControls.hidden = false;
  // The timeline becomes the song: same length, and it starts over from 0.
  durationInput.value = (audio.duration / 1000).toFixed(2);
  durationInput.dispatchEvent(new Event('change'));
  withScene(scene => scene.reset());
  settingsChanged();
  updateAudioStatus();
}

audioFileInput.addEventListener('change', () => {
  const [file] = audioFileInput.files;
  if (file) loadTrack(file);
  audioFileInput.value = '';
});

audioVolume.addEventListener('input', () => audio.setVolume(Number(audioVolume.value)));
audio.setVolume(Number(audioVolume.value));

document.getElementById('audio-clear').addEventListener('click', () => {
  audio.unload();
  waveImage = null;
  waveCanvas.hidden = true;
  audioControls.hidden = true;
  settingsChanged();
  updateAudioStatus();
});

waveCanvas.addEventListener('click', (event) => {
  if (scrubber.hidden) return;
  const bounds = waveCanvas.getBoundingClientRect();
  const fraction = clamp((event.clientX - bounds.left) / bounds.width);
  audio.resume();
  withScene(scene => scene.seek(fraction * audio.duration));
});

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
  renderWaveform(scrubbing ? Number(scrubber.value) : time);
};

playButton.addEventListener('click', () => {
  audio.resume();
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
  scene: [new PlaygroundScene({ settings, timeline, audio, onTimelineUpdate: renderTimeline })]
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
const exportAudio = document.getElementById('export-audio');
const exportInputs = [exportFormat, exportFps, exportStart, exportEnd, exportScale, exportAudio, exportButton];

// The music toggle only applies to MP4 exports while a track is loaded (GIFs have no audio).
function updateExportAudioRow() {
  document.getElementById('export-audio-row').hidden = !(audio.loaded && document.getElementById('export-format').value === 'mp4');
}

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

exportFormat.addEventListener('change', () => {
  applyExportDefaults();
  updateExportAudioRow();
});
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
  let exportWarning = '';

  try {
    const blob = await exportTimeline({
      game,
      scene,
      format,
      start,
      end,
      fps: Number(exportFps.value),
      scale: Number(exportScale.value),
      audioBuffer: format === 'mp4' && audio.loaded && exportAudio.checked ? audio.buffer : null,
      signal: exportAbort.signal,
      onWarning: (message) => { exportWarning = message; },
      onProgress: (progress) => {
        exportProgress.value = progress;
        showExportStatus(`Rendering frames… ${Math.round(progress * 100)}%`);
      }
    });

    downloadBlob(blob, exportFilename(format));
    showExportStatus(`Exported ${exportFilename(format)} (${(blob.size / 1024 / 1024).toFixed(1)} MB).${exportWarning ? ` ${exportWarning}` : ''}`, Boolean(exportWarning));
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
