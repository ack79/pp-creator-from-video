import fs from 'node:fs/promises';
import type { GenerateResult, GeminiResponse, GeminiPart, Style } from '../types.js';
import { buildPrompt } from './promptBuilder.js';
import { config } from '../config.js';

const MODEL = 'gemini-3.1-flash-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function generateProfilePicture(
  imagePaths: string[],
  style: Style,
  country?: string | null,
): Promise<GenerateResult> {
  const imageBuffers = await Promise.all(imagePaths.map(p => fs.readFile(p)));

  const imageParts = imageBuffers.map(buf => ({
    inline_data: { mime_type: 'image/jpeg', data: buf.toString('base64') },
  }));

  const promptText = buildPrompt(style, imagePaths.length, country);

  const parts = [...imageParts, { text: promptText }];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': config.geminiApiKey,
      },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: {
            aspectRatio: '1:1',
          },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText}`);
    }

    const data = await response.json() as GeminiResponse;

    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API returned no candidates');
    }

    const responseParts = candidates[0].content?.parts;
    if (!responseParts) {
      throw new Error('Gemini API returned no parts in response');
    }

    const imagePart = responseParts.find((p: GeminiPart) => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart?.inlineData) {
      console.error('Gemini response parts:', JSON.stringify(responseParts.map(p => Object.keys(p))));
      throw new Error('Gemini API did not return an image');
    }

    const mimeType = imagePart.inlineData.mimeType;
    const ext = mimeType === 'image/png' ? '.png' : '.jpg';
    return { buffer: Buffer.from(imagePart.inlineData.data, 'base64'), mimeType, ext, prompt: promptText };
  } finally {
    clearTimeout(timeout);
  }
}
