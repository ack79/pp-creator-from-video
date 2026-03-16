import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  geminiApiKey: process.env.GEMINI_API_KEY,
  profilePrompt: process.env.PROFILE_PROMPT ||
    'Transform this photo into a high-quality, attractive social media profile picture. Keep the person\'s face and features exactly the same. Clean soft blurred background, natural studio lighting. Professional portrait photography style. Square crop, centered face.',
  jobTtlMs: parseInt(process.env.JOB_TTL_MS || '3600000', 10),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),
  frameRate: parseInt(process.env.FRAME_RATE || '2', 10),
};
