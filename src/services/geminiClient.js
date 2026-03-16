import fs from 'node:fs/promises';
import { config } from '../config.js';

const MODEL = 'gemini-3.1-flash-image-preview';
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

export async function generateProfilePicture(imagePath) {
  const imageBuffer = await fs.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');

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
        contents: [{
          parts: [
            { inline_data: { mime_type: 'image/jpeg', data: base64Image } },
            { text: config.profilePrompt },
          ],
        }],
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

    const data = await response.json();

    // Extract image from response parts
    const candidates = data.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('Gemini API returned no candidates');
    }

    const parts = candidates[0].content?.parts;
    if (!parts) {
      throw new Error('Gemini API returned no parts in response');
    }

    // Response uses camelCase (inlineData/mimeType)
    const imagePart = parts.find(p => p.inlineData?.mimeType?.startsWith('image/'));
    if (!imagePart) {
      console.error('Gemini response parts:', JSON.stringify(parts.map(p => Object.keys(p))));
      throw new Error('Gemini API did not return an image');
    }

    const mimeType = imagePart.inlineData.mimeType;
    const ext = mimeType === 'image/png' ? '.png' : '.jpg';
    return { buffer: Buffer.from(imagePart.inlineData.data, 'base64'), mimeType, ext };
  } finally {
    clearTimeout(timeout);
  }
}
