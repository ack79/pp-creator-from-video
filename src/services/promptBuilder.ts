import type { Style } from '../types.js';

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Element Pools ───────────────────────────────────────────────

const EXPRESSIONS = {
  casual: [
    'a relaxed, natural smile',
    'a slight confident smirk',
    'a genuine mid-laugh expression with teeth visible',
    'a playful, self-assured look',
  ],
  professional: [
    'a warm, approachable professional smile',
    'a confident, composed slight smile',
    'a friendly and open expression',
  ],
  creative: [
    'a contemplative, distant gaze',
    'a confident, piercing direct stare',
    'a mysterious half-smile',
    'a candid, natural laugh caught in motion',
  ],
} as const;

const POSES = {
  casual: [
    'head tilted slightly to the left with relaxed shoulders',
    'head tilted slightly to the right, one shoulder dropped naturally',
    'chin raised slightly with a confident posture',
    'looking just slightly off-camera with a natural lean',
  ],
  professional: [
    'facing the camera with a subtle head tilt and squared shoulders',
    'a 3/4 body turn to the left, face toward camera',
    'a 3/4 body turn to the right, face toward camera',
  ],
  creative: [
    'a dramatic 3/4 profile with strong jawline visible',
    'looking back over one shoulder',
    'chin resting lightly on one hand',
    'leaning against a surface with a relaxed stance',
  ],
} as const;

const CAMERA_ANGLES = [
  'from slightly above, as if holding a phone up for a selfie',
  'at eye level with an outstretched arm',
  'from a 3/4 angle on the left side',
  'from a 3/4 angle on the right side',
] as const;

const CLOTHING = {
  casual: [
    'a fitted crew-neck t-shirt in a solid muted tone',
    'a denim jacket layered over a dark crew-neck',
    'a casual linen button-down shirt with the top button open',
    'a clean zip-up hoodie over a plain tee',
    'a bomber jacket over a simple round-neck shirt',
    'a relaxed-fit knit sweater in an earth tone',
    'a short-sleeve polo shirt',
    'a leather jacket over a minimal dark top',
    'a flannel overshirt with rolled sleeves',
    'a lightweight windbreaker, half-zipped over a tee',
  ],
  professional: [
    'a tailored navy blazer over a crisp white shirt',
    'a charcoal suit jacket with a subtle patterned tie',
    'a clean, well-fitted white dress shirt with no jacket',
    'a black merino turtleneck',
    'a light gray blazer over an open-collar shirt',
    'a dark business suit with a neat pocket square',
    'a pinstripe blazer with a light blue dress shirt',
  ],
  creative: [
    'an oversized vintage-wash denim jacket',
    'a head-to-toe black ensemble with interesting fabric texture',
    'a bold statement-color overcoat',
    'a layered look with a draped scarf or shawl',
    'a monochrome turtleneck-and-blazer combination',
    'a patterned or textured designer knit',
    'a deconstructed or asymmetric jacket',
  ],
} as const;

const BACKGROUNDS = {
  casual: [
    'a bustling shopping mall atrium with warm overhead lights',
    'a rooftop terrace with the city skyline visible at golden hour',
    'a sunny beach boardwalk with the ocean in the background',
    'a vibrant street food market with neon signs and steam rising',
    'a live concert venue with colorful stage lights behind',
    'a sports stadium with a packed crowd and green pitch',
    'a neon-lit arcade with colorful game screens glowing',
    'a sleek hotel lobby with modern furniture',
    'a balcony overlooking a city lit up at dusk',
    'an outdoor festival with string lights and a lively crowd',
  ],
  professional: [
    'a smooth, softly lit neutral studio backdrop in warm gray',
    'a modern office space with floor-to-ceiling glass and natural daylight',
    'a warm-toned conference room with wood paneling',
    'a bright minimalist workspace with clean lines',
    'a soft warm-to-cool gradient studio background',
  ],
  creative: [
    'a neon-soaked urban alley at night with colored reflections on wet pavement',
    'golden hour sunlight streaming through a window, casting dramatic long shadows',
    'a rain-slicked city street at twilight with puddle reflections',
    'a dense misty forest with soft diffused light filtering through',
    'a stark white art gallery with paintings on the walls',
    'an industrial loft with exposed brick, metal fixtures, and warm Edison bulbs',
    'a rooftop at sunset with a dramatic orange-purple sky',
  ],
} as const;

// ─── Prompt Builders ─────────────────────────────────────────────

function buildIdentityBlock(numFrames: number): string {
  return [
    `You are receiving ${numFrames} reference frames extracted from a video of the same person.`,
    'Carefully study ALL provided frames to build a complete understanding of this person\'s appearance:',
    'facial bone structure, skin tone and texture, exact hair color and style, eye color and shape,',
    'nose profile, lip shape, jawline, eyebrow shape, and any distinguishing marks such as moles,',
    'freckles, scars, dimples, facial hair, or glasses.',
    '',
    'Generate a single new portrait photograph of this exact person.',
    'The generated face MUST be immediately and unambiguously recognizable as the same individual',
    'from the reference frames. Facial feature accuracy is the highest priority.',
    '',
    'IMPORTANT: Change the person\'s clothing entirely.',
    'Do not replicate any clothing or accessories visible in the reference frames.',
  ].join('\n');
}

function buildCasualBlock(
  expression: string,
  pose: string,
  angle: string,
  clothing: string,
  background: string,
  country?: string | null,
): string {
  const locationSuffix = country ? ` in ${country}` : '';
  const cultureNote = country
    ? ` Clothing and overall style should feel natural and contemporary for someone in ${country}.`
    : '';

  return [
    `Create a natural, spontaneous-looking selfie as if taken with a phone front camera.`,
    `The person has ${expression} and is posed with ${pose}. Shot ${angle}.`,
    '',
    `Dress the person in ${clothing}.${cultureNote}`,
    '',
    `Background: ${background}${locationSuffix}.`,
    'Full sharp focus throughout the frame like a real phone front camera — not portrait mode.',
    'Lighting comes only from the environment. Imperfect, uneven ambient lighting is authentic.',
    '',
    'Preserve all natural skin texture: visible pores, fine lines, blemishes, under-eye circles,',
    'natural shine. Real unretouched skin.',
    'Square 1:1 crop, face occupying roughly 40-50% of frame height.',
    'The result should be indistinguishable from a real, unedited phone selfie.',
  ].join('\n');
}

function buildProfessionalBlock(
  expression: string,
  pose: string,
  clothing: string,
  background: string,
  country?: string | null,
): string {
  const cultureNote = country
    ? ` The attire should be appropriate for a professional context in ${country}.`
    : '';

  return [
    `Create a polished professional headshot suitable for LinkedIn or a corporate profile.`,
    `The person has ${expression} and is posed ${pose}.`,
    '',
    `Dress the person in ${clothing}.${cultureNote}`,
    '',
    `Background: ${background}.`,
    'Soft, flattering lighting — natural window light or studio softbox.',
    'Gentle bokeh on the background to keep focus on the face.',
    'Skin appears natural and well-lit with real texture complemented by flattering light direction.',
    '',
    'Square 1:1 crop, face centered, occupying roughly 50-60% of frame height.',
    'The result should look like it was taken by a professional portrait photographer.',
  ].join('\n');
}

function buildCreativeBlock(
  expression: string,
  pose: string,
  clothing: string,
  background: string,
  country?: string | null,
): string {
  const cultureNote = country
    ? ` Draw inspiration from ${country}'s contemporary fashion and visual culture.`
    : '';

  return [
    `Create a striking editorial portrait with a distinctive visual mood.`,
    `The person has ${expression} and is posed in ${pose}.`,
    '',
    `Dress the person in ${clothing}.${cultureNote}`,
    '',
    `Setting: ${background}.`,
    'Use dramatic or artistic lighting — side light, rim light, color accents,',
    'or strong directional light with deep shadows. Rich contrast and visual depth.',
    'Skin texture preserved through artistic lighting.',
    '',
    'Square 1:1 crop. Composition may be unconventional — the face can sit off-center',
    'for visual tension. The result should feel like an editorial photograph',
    'from a fashion or culture magazine.',
  ].join('\n');
}

// ─── Main Export ─────────────────────────────────────────────────

export function buildPrompt(
  style: Style,
  numFrames: number,
  country?: string | null,
): string {
  const identity = buildIdentityBlock(numFrames);

  const expression = pickRandom(EXPRESSIONS[style]);
  const pose = pickRandom(POSES[style]);
  const clothing = pickRandom(CLOTHING[style]);
  const background = pickRandom(BACKGROUNDS[style]);

  let styleBlock: string;

  switch (style) {
    case 'casual': {
      const angle = pickRandom(CAMERA_ANGLES);
      styleBlock = buildCasualBlock(expression, pose, angle, clothing, background, country);
      break;
    }
    case 'professional':
      styleBlock = buildProfessionalBlock(expression, pose, clothing, background, country);
      break;
    case 'creative':
      styleBlock = buildCreativeBlock(expression, pose, clothing, background, country);
      break;
  }

  return `${identity}\n\n${styleBlock}`;
}
