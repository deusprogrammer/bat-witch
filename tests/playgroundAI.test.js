import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  createPatternSchema, generatePattern, OLLAMA_MODEL, OLLAMA_URL,
  validateAIExpression, validateGeneratedPattern
} from '../src/playgroundAI.js';

const controls = [
  { key: 'velocity', label: 'Velocity', min: -1500, max: 1500, sample: {} },
  { key: 'direction', label: 'Direction', sample: {} },
  { key: 'color', label: 'Color', optional: true, sample: {} },
  { key: 'startRotation', label: 'Initial rotation', min: -6.28, max: 6.28, sample: {} },
  { key: 'waveInterval', label: 'Wave interval', min: 0, max: 2000, sample: {} },
  { key: 'waveCount', label: 'Wave count', min: 1, max: 50 },
  { key: 'projectilesPerWave', label: 'Bullet count', min: 1, max: 360, sample: {} },
  { key: 'fireCooldown', label: 'Cooldown', min: 100, max: 15000 }
];
const schema = createPatternSchema(controls, ['bullet', 'heart-bullet']);
const pattern = {
  pattern: 'orbit_burst', texture: 'heart-bullet', autoFire: true,
  alignToDirection: false, startRotation: 0,
  velocity: 100, direction: 'waveIndex * 0.2', color: 'hsv(age * 0.2)',
  waveInterval: 250, waveCount: 10, projectilesPerWave: 50, fireCooldown: 5000
};
const validate = value => validateGeneratedPattern(value, schema, () => {});

test('builds a closed schema with bounded counts and editable expressions', () => {
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, Object.keys(schema.properties));
  assert.equal(schema.properties.projectilesPerWave.type, 'integer');
  assert.equal(schema.properties.waveInterval.minimum, 20);
  assert.equal(schema.properties.fireCooldown.minimum, 500);
  assert.equal(schema.properties.velocity.anyOf[1].type, 'string');
  assert.equal(schema.properties.alignToDirection.type, 'boolean');
  assert.equal(schema.properties.startRotation.anyOf[1].type, 'string');
});

test('accepts settings and checks every field with the existing parser callback', () => {
  const parsed = [];
  assert.equal(validateGeneratedPattern(pattern, schema, (key, value) => parsed.push([key, value])), pattern);
  assert.equal(parsed.length, controls.length);
});

test('rejects missing, unknown, mistyped, nonfinite and excessive values before applying', () => {
  for (const invalid of [
    null, [], {}, { ...pattern, audio: 'http://example.test/track.mp3' },
    { ...pattern, childEmitter: {} }, { ...pattern, texture: 'missing' },
    { ...pattern, autoFire: 'true' }, { ...pattern, alignToDirection: 'true' },
    { ...pattern, waveCount: 1.5 },
    { ...pattern, velocity: Infinity }, { ...pattern, velocity: '90000' },
    { ...pattern, waveInterval: 0 }, { ...pattern, projectilesPerWave: 360, waveCount: 50 },
    { ...pattern, color: 'a'.repeat(301) }
  ]) assert.throws(() => validate(invalid));
  assert.throws(() => validateGeneratedPattern(pattern, schema, () => {
    throw new Error('Expression must evaluate to a number.');
  }), /Expression must evaluate/);
});

test('accepts only arithmetic and named expression helpers, not arbitrary JavaScript', () => {
  for (const expression of [
    '', '#ff88aa', '0xff88aa', 'Math.PI / 2', '[0, -1]',
    '110 + 45 * Math.cos(bulletIndex * 10 * Math.PI / bulletCount)',
    'waveIndex % 2 ? hsv(age * 0.3) : rgb(255, 0, 100)',
    'mix(0xff66cc, 0x66ccff, clamp(age / 2))', '100 + 200 * wave(time)'
  ]) assert.doesNotThrow(() => validateAIExpression(expression), expression);
  for (const expression of [
    'fetch("http://example.test")', 'window.alert(1)', 'globalThis', 'Math.random()',
    'Math.constructor', 'wave.constructor', 'age.constructor', 'age = 2',
    '(() => 123)()', 'Math.sin["constructor"]', 'while(true){}', 'age; 5'
  ]) assert.throws(() => validateAIExpression(expression), undefined, expression);
});

test('requests local structured output, excludes noneditable settings, and parses the response', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, OLLAMA_URL);
    const body = JSON.parse(options.body);
    assert.equal(body.model, OLLAMA_MODEL);
    assert.equal(body.stream, false);
    assert.equal(body.options.num_ctx, 16384);
    const instructions = body.messages[0].content;
    for (const example of [
      'narrow straight blue stream', 'orange shotgun fan', 'searchlight',
      'concentric cyan rings', 'crossing diagonal shots', 'three-arm spiral',
      'five-petal flower', 'Music-reactive downward fan'
    ]) assert.ok(instructions.includes(example), `Missing example: ${example}`);
    assert.match(instructions, /Change ONLY fields necessary/);
    assert.match(instructions, /Hearts alone mean a texture, NOT a request for flower geometry/);
    assert.deepEqual(body.format, schema);
    const user = JSON.parse(body.messages[1].content);
    assert.equal(user.mode, 'create');
    assert.equal(Object.hasOwn(user, 'currentSettings'), false);
    assert.equal(user.request, 'Pink flower');
    return Response.json({ message: { content: JSON.stringify(pattern) } });
  });
  assert.deepEqual(await generatePattern({
    prompt: 'Pink flower', schema, currentSettings: { ...pattern, childEmitter: {}, audio: 'private.mp3' }
  }), pattern);
});

test('modify mode includes only current editable settings and requests preservation', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    const body = JSON.parse(options.body);
    const user = JSON.parse(body.messages[1].content);
    assert.equal(user.mode, 'modify');
    assert.equal(user.request, 'Make this blue');
    assert.deepEqual(user.currentSettings, { ...pattern, autoFire: false });
    assert.match(body.messages[0].content, /Copy unrelated values and expression strings exactly/);
    return Response.json({ message: { content: JSON.stringify({ ...user.currentSettings, color: '#0000ff' }) } });
  });
  const result = await generatePattern({
    prompt: 'Make this blue', schema, modifyCurrent: true,
    currentSettings: { ...pattern, autoFire: false, childEmitter: {}, audio: 'private.mp3' }
  });
  assert.deepEqual(result, { ...pattern, autoFire: false, color: '#0000ff' });
});

test('surfaces service errors, invalid output and connection failures', async (t) => {
  const request = () => generatePattern({ prompt: 'Pattern', schema, currentSettings: pattern });
  const mock = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'model missing' }, { status: 404 }));
  await assert.rejects(request, /model missing/);
  mock.mock.mockImplementation(async () => Response.json({ message: { content: 'not JSON' } }));
  await assert.rejects(request, /invalid JSON/);
  mock.mock.mockImplementation(async () => Response.json({ message: {} }));
  await assert.rejects(request, /no pattern/);
  mock.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(request, /Cannot reach local Ollama/);
  await assert.rejects(() => generatePattern({ prompt: ' ', schema, currentSettings: pattern }), /Describe/);
});

test('cancels the request instead of returning a pattern', async (t) => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    return new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
    });
  });
  const request = generatePattern({ prompt: 'Pattern', schema, currentSettings: pattern, signal: controller.signal });
  controller.abort();
  await assert.rejects(request, error => error.name === 'AbortError');
});

test('allows one correction with validation feedback and never accepts invalid output', async (t) => {
  let attempts = 0;
  const mock = t.mock.method(globalThis, 'fetch', async (_url, options) => {
    attempts++;
    const messages = JSON.parse(options.body).messages;
    if (attempts === 2) {
      assert.match(messages.at(-1).content, /Unknown setting: childEmitter/);
    }
    return Response.json({
      message: { content: JSON.stringify(attempts === 1 ? { ...pattern, childEmitter: {} } : pattern) }
    });
  });
  const request = () => generatePattern({ prompt: 'Flower', schema, currentSettings: pattern, validate });
  assert.deepEqual(await request(), pattern);
  assert.equal(attempts, 2);
  attempts = 0;
  mock.mock.mockImplementation(async () => {
    attempts++;
    return Response.json({ message: { content: JSON.stringify({ ...pattern, childEmitter: {} }) } });
  });
  await assert.rejects(request, /Unknown setting: childEmitter/);
  assert.equal(attempts, 2);
});
