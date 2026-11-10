export const OLLAMA_MODEL = 'gpt-oss:20b';
export const OLLAMA_URL = 'http://localhost:11434/api/chat';

const NUMERIC_ONLY = new Set(['projectilesPerWave', 'waveInterval', 'coneAngle', 'originX', 'originY']);
const INTEGER_FIELDS = new Set(['projectilesPerWave', 'waveCount']);
const VARIABLES = new Set([
  'waveIndex', 'bulletIndex', 'bulletCount', 'time', 'age', 'velocity',
  'i', 'j', 'n', 's', 't', 'v'
]);
const HELPERS = new Set(['hsv', 'rgb', 'mix', 'clamp', 'backOut', 'wave']);
const MATH_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'abs', 'min', 'max', 'floor', 'ceil', 'round', 'sqrt', 'pow',
  'atan2', 'exp', 'log', 'sign'
]);

export function createPatternSchema(controls, textures) {
  const properties = {
    pattern: { type: 'string', enum: ['orbit_burst', 'burst', 'cone', 'linear'] },
    texture: { type: 'string', enum: textures },
    autoFire: { type: 'boolean' },
    alignToDirection: { type: 'boolean' }
  };
  for (const control of controls) {
    const numeric = {
      type: INTEGER_FIELDS.has(control.key) ? 'integer' : 'number',
      ...(control.min === undefined ? {} : { minimum: control.min, maximum: control.max })
    };
    if (control.key === 'color') Object.assign(numeric, { minimum: 0, maximum: 0xffffff });
    if (control.key === 'waveInterval') numeric.minimum = 20;
    if (control.key === 'fireCooldown') numeric.minimum = 500;
    properties[control.key] = {
      description: `${control.label}${control.optional ? '; use an empty string to disable' : ''}`,
      ...(control.sample && !NUMERIC_ONLY.has(control.key)
        ? { anyOf: [numeric, { type: 'string', maxLength: 300 }] }
        : numeric)
    };
  }
  return { type: 'object', additionalProperties: false, properties, required: Object.keys(properties) };
}

// Model output is untrusted: only arithmetic, named math calls and context variables may
// reach the playground's expression compiler, never arbitrary JavaScript or property access.
export function validateAIExpression(expression) {
  if (expression === '' || /^#[0-9a-f]{6}$/i.test(expression)) return;
  const tokens = expression.match(/(?:0x[0-9a-f]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?|[a-z_$][\w$]*(?:\.[a-z_$][\w$]*)*|\*\*|===|!==|==|!=|<=|>=|&&|\|\||[+\-*/%()?:,<>\[\]!])/gi) ?? [];
  if (tokens.join('') !== expression.replace(/\s+/g, '')) {
    throw new Error('Only arithmetic expressions and supported math helpers are allowed.');
  }
  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index];
    if (!/^[a-z_$]/i.test(token)) continue;
    const mathName = token.startsWith('Math.') ? token.slice(5) : '';
    const callable = HELPERS.has(token) || MATH_FUNCTIONS.has(mathName);
    if (!VARIABLES.has(token) && token !== 'Math.PI' && token !== 'Math.E' && !callable) {
      throw new Error(`Unsupported expression name: ${token}`);
    }
    if ((tokens[index + 1] === '(') !== callable) {
      throw new Error(`Invalid use of expression name: ${token}`);
    }
  }
}

function matchesField(value, schema) {
  if (schema.anyOf) return schema.anyOf.some(option => matchesField(value, option));
  if (schema.enum && !schema.enum.includes(value)) return false;
  if (schema.type === 'boolean') return typeof value === 'boolean';
  if (schema.type === 'string') {
    return typeof value === 'string' && (schema.maxLength === undefined || value.length <= schema.maxLength);
  }
  return typeof value === 'number' && Number.isFinite(value)
    && (schema.type !== 'integer' || Number.isInteger(value))
    && (schema.minimum === undefined || value >= schema.minimum)
    && (schema.maximum === undefined || value <= schema.maximum);
}

export function validateGeneratedPattern(value, schema, validateControl) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('The model must return a settings object.');
  }
  for (const key of Object.keys(value)) {
    if (!Object.hasOwn(schema.properties, key)) throw new Error(`Unknown setting: ${key}`);
  }
  for (const [key, field] of Object.entries(schema.properties)) {
    if (!Object.hasOwn(value, key) || !matchesField(value[key], field)) {
      throw new Error(`Invalid or missing setting: ${key}`);
    }
    if (!['pattern', 'texture', 'autoFire', 'alignToDirection'].includes(key)) {
      try {
        if (typeof value[key] === 'string') {
          validateAIExpression(value[key]);
          const numericField = field.anyOf?.find(option => option.type === 'number' || option.type === 'integer');
          if (value[key].trim() && Number.isFinite(Number(value[key]))
            && numericField && !matchesField(Number(value[key]), numericField)) {
            throw new Error('Numeric value is outside the permitted range.');
          }
        }
        validateControl(key, value[key]);
      } catch (error) {
        throw new Error(`${key}: ${error.message}`);
      }
    }
  }
  if (value.projectilesPerWave * value.waveCount > 4000) {
    throw new Error('Generated pattern exceeds the limit of 4,000 bullets per volley.');
  }
  return value;
}

export async function generatePattern({ prompt, currentSettings, modifyCurrent = false, schema, signal, validate = value => value }) {
  if (!prompt.trim()) throw new Error('Describe the pattern you want to create.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 180000);
  try {
    const messages = [
      {
        role: 'system',
        content: `You design playable bullet-hell patterns for an existing engine, not images or arbitrary programs.

OUTPUT CONTRACT
Return ONLY one complete JSON settings object matching the supplied schema. Include every required key.
No markdown, commentary, functions, extra keys, audio URLs, or nested emitters.
For mode="create", set autoFire=true. For mode="modify", preserve autoFire unless the user asks to change it.
The schema is authoritative about allowed types, ranges and keys. Numeric-only fields MUST be JSON numbers.

FOLLOW THE REQUEST, NOT THE PREVIOUS PATTERN
First reason internally about the requested silhouette, firing direction, movement, rhythm, density and palette.
Choose the simplest engine pattern that actually produces those traits. Then fill all required fields.
The user request takes priority over every example below. The request includes an explicit mode:
- mode="create": design a fresh pattern from the description. No currentSettings is supplied.
  Do not assume previous geometry, position, counts, direction, timing or palette.
- mode="modify": currentSettings is the current preview, including the latest manual edits.
  Use it as the baseline. Change ONLY fields necessary to fulfill the requested modification.
  Copy unrelated values and expression strings exactly, including emitter position, texture,
  timing, geometry and autoFire. Do not reset fields just because an example uses other values.
  For "make this blue", change only color. For "make it twice as fast", scale the relevant
  motion velocity (including an outwardVelocity override if present), not firing rate or geometry.
  Do not replace a pattern with a different example when a small edit will satisfy the request.
Do not turn every request into a flower, spiral, centered radial ring, or orbiting pattern.
Do not choose orbit_burst merely because it was in currentSettings. Use it only when curved orbital
flight is requested or necessary. A spinning sprite is not an orbiting trajectory.
When the request is vague, choose a simple fitting geometry; do not add petal-shaped speed modulation.
Examples are a toolbox, not a sequence, default style, or instructions to combine them.

ENGINE GEOMETRY
The preview is 540 px wide and 720 px tall, with x increasing right and y increasing down.
Top-center (270,60) is useful for downward attacks; center (270,360) for explicitly radial designs.
direction is radians: 0 right, Math.PI/2 down, Math.PI left, -Math.PI/2 up.
- linear: one bullet per wave along direction. projectilesPerWave does not add bullets here.
- cone: projectilesPerWave evenly spaced across coneAngle, centered on direction.
- burst: projectilesPerWave evenly spaced around a full circle, offset by direction. Straight trajectories.
- orbit_burst: a full ring whose trajectories also turn around the emitter using angularVelocity.
cone, burst and linear do NOT curve from angularVelocity. Set angularVelocity=0 for these patterns.
Changing direction between waves sweeps the firing angle, but does not bend bullets already in flight.
Changing angularVelocity bends orbital flight; changing spinVelocity only rotates the bullet artwork.
alignToDirection=true rotates each sprite to its own launch angle (including its ring/cone
spread offset). startRotation adds a sprite-orientation correction in radians. A downward-pointing
heart needs startRotation=-Math.PI/2 so its point faces the launch direction. With alignment disabled,
startRotation is an absolute initial sprite rotation. Both default to false/0 when not requested.
Alignment then follows changes in the bullet's orbital angle: if the orbital angle changes from
45 degrees to 90 degrees, the sprite turns by 45 degrees too. This is radial facing, NOT the
tangent direction of travel. spinVelocity adds extra rotation on top. startRotation may be an
expression using spawn context, like direction.
Changing velocity with bulletIndex changes radial speed and therefore the ring's silhouette. Use this
only for requested lobes/petals/star-shaped fronts, not for plain rings, rain, fans or streams.
All bullets start from ONE fixed emitter position. You cannot move the emitter via origin expressions.
Rain spread across the entire top edge, multiple independent emitters, collision targeting, delayed
explosions and nested patterns cannot be implemented exactly with this schema. Approximate their
visible behavior with a fan/stream/ring where appropriate; do not invent unsupported keys.

TIME AND MOTION
velocity and outwardVelocity are px/s; size is sprite height in px; angularVelocity and spinVelocity
are rad/s; waveInterval and fireCooldown are ms. coneAngle is total spread in radians.
waveCount is waves per volley. waveInterval separates waves. fireCooldown schedules new volleys;
waveIndex starts at 0 again for each volley. To leave a gap between volleys, use fireCooldown greater
than (waveCount-1)*waveInterval. Do not accidentally stack dense overlapping volleys.
Positive velocity moves away from the origin. outwardVelocity, when enabled as an expression,
overrides velocity and can read its resolved value as the variable velocity.
Use outwardVelocity="" when no override is needed; do not cancel a shaped velocity by overriding it.

EXPRESSIONS AND CONTEXT
Only schema fields that permit strings can contain expressions. Empty string disables optional
color/outwardVelocity. color can be "#ff8800", a numeric tint, or a color expression.
Use only arithmetic, comparisons, ternaries, parentheses, context variables and the allowed calls below.
No assignments, declarations, loops, arbitrary objects, property access, function definitions or calls.
Available context (long names preferred):
- waveIndex (i): zero-based wave number within the volley.
- bulletIndex (j): zero-based bullet number in the wave.
- bulletCount (n): actual number of bullets in this wave.
- time (s): timeline seconds; at spawn for direction, continuously updated for live values.
- age (t): this bullet's age in seconds; starts at 0.
- velocity (v): resolved velocity, meaningful ONLY inside outwardVelocity.
Never use projectilesPerWave, originX, size, or other setting names as expression variables.
direction resolves once at spawn and may use waveIndex, bulletIndex, bulletCount and time.
startRotation also resolves once at spawn; it does not change direction or movement.
velocity, outwardVelocity, angularVelocity, spinVelocity, color and size are evaluated during flight.
The AI schema intentionally requires constant numbers for coneAngle, projectilesPerWave,
waveInterval, waveCount, fireCooldown, originX and originY even if manual controls support more.
Allowed constants: Math.PI, Math.E.
Allowed Math calls: ${[...MATH_FUNCTIONS].map(name => `Math.${name}`).join(', ')}.
Allowed helpers: hsv(hue,saturation=1,value=1), rgb(r,g,b), mix(colorA,colorB,f),
clamp(x,min=0,max=1), backOut(x), wave(time).
hsv inputs are 0-1 (hue wraps); rgb channels are 0-255. wave(time) is track loudness 0-1,
and is 0 without loaded audio, so give music-driven values a nonzero baseline.
palette, FLAGS, Math.random and arbitrary JavaScript are NOT supported by AI expression validation.
Keep expressions finite for age=0, time=0, bulletIndex=0 and bulletCount=1.
Do not divide by age, time or bulletIndex. Avoid poles such as tan near Math.PI/2.

DESIGN CHECKS
Use <=4000 bullets per volley (projectilesPerWave*waveCount); prefer substantially fewer.
Typical visible sizes are 12-32 px, velocities 60-250 px/s. Avoid stationary endless clutter.
Respect explicit numeric requests within the schema bounds. Use negative velocity only intentionally.
In create mode, reset irrelevant fields rather than leaking previous geometry: outwardVelocity="", spinVelocity=0,
angularVelocity=0 unless relevant, direction chosen for the request, color="" unless tint is wanted.
Before answering, check the geometry really matches the request, expressions use valid variables,
and every required key has a valid value. Do not print this reasoning.

BALANCED WORKED EXAMPLES
Each example below is a PARTIAL settings patch showing the important design choices.
For your response, supply ALL required fields, select a permitted texture, and adapt only examples
whose geometry fits the user's request. Do not copy their palette, position or counts blindly.

1. "A narrow straight blue stream shooting down"
{"pattern":"linear","originX":270,"originY":60,"direction":1.5707963267948966,"velocity":210,"outwardVelocity":"","angularVelocity":0,"spinVelocity":0,"projectilesPerWave":1,"waveCount":40,"waveInterval":60,"fireCooldown":3000,"size":14,"color":"#55aaff"}
Why: one straight shot per wave; no circular geometry, angular modulation or petal expression.

2. "An orange shotgun fan, with a pause between volleys"
{"pattern":"cone","originX":270,"originY":80,"direction":1.5707963267948966,"coneAngle":1.1,"projectilesPerWave":11,"velocity":190,"outwardVelocity":"","angularVelocity":0,"waveCount":3,"waveInterval":180,"fireCooldown":1800,"size":20,"color":"#ff9933"}
Why: a small number of simultaneous straight directions across a downward-facing spread.

3. "A green stream sweeping left and right like a searchlight"
{"pattern":"linear","originX":270,"originY":70,"direction":"Math.PI / 2 + 0.75 * Math.sin(waveIndex * 0.16)","velocity":170,"outwardVelocity":"","angularVelocity":0,"projectilesPerWave":1,"waveCount":50,"waveInterval":50,"fireCooldown":3000,"size":16,"color":"#55ff99"}
Why: each bullet flies straight, but successive shots change angle. This is NOT orbital movement.

4. "Clean concentric cyan rings expanding from the center, no rotation"
{"pattern":"burst","originX":270,"originY":360,"direction":0,"projectilesPerWave":36,"velocity":100,"outwardVelocity":"","angularVelocity":0,"waveCount":5,"waveInterval":500,"fireCooldown":3500,"size":16,"color":"#55ddff"}
Why: equal radial speeds make circles. Do not vary velocity with bulletIndex or add rotation.

5. "Alternating red and blue crossing diagonal shots from the top"
{"pattern":"cone","originX":270,"originY":60,"direction":1.5707963267948966,"coneAngle":0.9,"projectilesPerWave":2,"velocity":160,"outwardVelocity":"","angularVelocity":0,"waveCount":24,"waveInterval":140,"fireCooldown":4000,"size":20,"color":"waveIndex % 2 ? 0xff5555 : 0x5599ff"}
Why: two straight lanes form a V from a shared origin; actual intersecting independent sources
are outside this schema. Alternate wave colors without changing trajectory into a flower.

6. "A sparse rotating three-arm spiral"
{"pattern":"orbit_burst","originX":270,"originY":360,"direction":"waveIndex * 0.18","projectilesPerWave":3,"velocity":100,"outwardVelocity":"","angularVelocity":0.3,"waveCount":40,"waveInterval":90,"fireCooldown":4500,"size":18,"color":"hsv(bulletIndex / bulletCount)"}
Why: sparse radial arms plus turning trajectories; this is appropriate only for a spiral request.

7. "Pink hearts forming a five-petal flower"
{"pattern":"burst","texture":"heart-bullet","originX":270,"originY":360,"direction":0,"projectilesPerWave":120,"velocity":"100 + 35 * Math.cos(bulletIndex * 10 * Math.PI / bulletCount)","outwardVelocity":"","angularVelocity":0,"waveCount":3,"waveInterval":700,"fireCooldown":3500,"size":18,"color":"#ff88bb"}
Why: five cycles of radial speed modulation make a five-lobed front. Use this technique ONLY
when the user requests petals/lobes. To rotate the trajectories, switch to orbit_burst and a
small angularVelocity. Hearts alone mean a texture, NOT a request for flower geometry.

8. "Music-reactive downward fan, still visible without a song"
{"pattern":"cone","originX":270,"originY":70,"direction":1.5707963267948966,"coneAngle":0.8,"projectilesPerWave":7,"velocity":"90 + 100 * wave(time)","outwardVelocity":"","angularVelocity":0,"waveCount":30,"waveInterval":120,"fireCooldown":4500,"size":"14 + 10 * wave(time)","color":"hsv(0.55 + 0.15 * wave(time))"}
Why: audio modulates speed and appearance, not an unrelated radial shape. The baseline works in silence.

AUTHORITATIVE OUTPUT SCHEMA
${JSON.stringify(schema)}`
      },
      {
        role: 'user',
        content: JSON.stringify({
          request: prompt,
          mode: modifyCurrent ? 'modify' : 'create',
          ...(modifyCurrent ? {
            currentSettings: Object.fromEntries(Object.keys(schema.properties)
              .filter(key => Object.hasOwn(currentSettings, key) || ['color', 'outwardVelocity'].includes(key))
              .map(key => [key, currentSettings[key] ?? '']))
          } : {})
        })
      }
    ];
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(OLLAMA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          stream: false,
          think: 'medium',
          format: schema,
          options: { temperature: 0.3, num_predict: 4096, num_ctx: 16384 },
          messages
        })
      });
      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(`Ollama: ${result.error || `HTTP ${response.status}`}`);
      }
      if (typeof result.message?.content !== 'string' || !result.message.content.trim()) {
        throw new Error('Ollama returned no pattern. Try a shorter description.');
      }
      try {
        let parsed;
        try {
          parsed = JSON.parse(result.message.content);
        } catch {
          throw new Error('Ollama returned invalid JSON. Your settings have not changed.');
        }
        return validate(parsed);
      } catch (error) {
        if (attempt === 1) throw error;
        messages.push(
          { role: 'assistant', content: result.message.content },
          { role: 'user', content: `The pattern was rejected: ${error.message}. Fix it and return a complete valid settings object matching the schema. Do not add new variables or keys.` }
        );
      }
    }
  } catch (error) {
    if (timedOut) throw new Error('Ollama timed out after 3 minutes. Try again with a shorter description.');
    if (controller.signal.aborted) throw new DOMException('Generation cancelled.', 'AbortError');
    if (error instanceof TypeError) {
      throw new Error('Cannot reach local Ollama. Start Ollama on localhost:11434 and allow this page origin with OLLAMA_ORIGINS (see README).');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
