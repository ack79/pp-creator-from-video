import 'dotenv/config';
import type { Config } from './types.js';

if (!process.env.GEMINI_API_KEY) {
  throw new Error('GEMINI_API_KEY environment variable is required');
}

export const config: Config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: process.env.GEMINI_API_KEY,
  jobTtlMs: parseInt(process.env.JOB_TTL_MS || '3600000', 10),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  frameRate: parseInt(process.env.FRAME_RATE || '2', 10),
  numFrames: parseInt(process.env.NUM_FRAMES || '3', 10),
};
