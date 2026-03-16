export type Style = 'casual' | 'professional' | 'creative';

export const VALID_STYLES: readonly Style[] = ['casual', 'professional', 'creative'];

export interface Job {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  step: 'extracting_frames' | 'detecting_faces' | 'generating_image' | null;
  error: string | null;
  createdAt: number;
  inputPath: string;
  resultPath: string | null;
  framePaths?: string[];
  prompt?: string;
  mimeType?: string;
  country?: string | null;
  style: Style;
}

export interface Config {
  port: number;
  geminiApiKey: string;
  jobTtlMs: number;
  maxFileSizeMb: number;
  frameRate: number;
  numFrames: number;
}

export interface GenerateResult {
  buffer: Buffer;
  mimeType: string;
  ext: string;
  prompt: string;
}

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>;
}

declare module 'express-serve-static-core' {
  interface Request {
    jobId?: string;
  }
}
