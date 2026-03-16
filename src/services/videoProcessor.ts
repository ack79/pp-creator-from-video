import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { updateJob, getJob } from './jobManager.js';
import { generateProfilePicture } from './geminiClient.js';
import { config } from '../config.js';

export async function processVideo(jobId: string): Promise<void> {
  try {
    const job = getJob(jobId);
    if (!job) throw new Error('Job not found');

    const jobDir = path.dirname(job.inputPath);

    // Step 1: Extract frames + detect faces (Python sidecar)
    updateJob(jobId, { step: 'extracting_frames' });

    const framePaths = await runPythonScript(job.inputPath, jobDir);

    updateJob(jobId, { step: 'detecting_faces' });
    // Face detection happened inside the Python script already
    // Verify all outputs exist
    await Promise.all(framePaths.map(p => fs.access(p)));

    // Step 2: Generate profile picture via Gemini
    updateJob(jobId, { step: 'generating_image' });

    const { buffer, mimeType, ext } = await generateProfilePicture(framePaths, job.style, job.country);
    const resultPath = path.join(jobDir, `result${ext}`);
    await fs.writeFile(resultPath, buffer);

    // Step 3: Mark completed
    updateJob(jobId, { status: 'completed', step: null, resultPath, mimeType });
  } catch (err: unknown) {
    updateJob(jobId, {
      status: 'failed',
      step: null,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function runPythonScript(inputPath: string, outputDir: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      path.resolve('scripts/extract_best_frame.py'),
      inputPath,
      outputDir,
      String(config.frameRate),
      String(config.numFrames),
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
      } else {
        try {
          const result = JSON.parse(stdout.trim()) as { frames: string[] };
          if (!result.frames || result.frames.length === 0) {
            reject(new Error('Python script returned no frame paths'));
          } else {
            resolve(result.frames);
          }
        } catch {
          reject(new Error(`Failed to parse Python script output: ${stdout.trim()}`));
        }
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn Python script: ${err.message}`));
    });
  });
}
