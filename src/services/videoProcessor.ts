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

    const bestFramePath = await runPythonScript(job.inputPath, jobDir);

    updateJob(jobId, { step: 'detecting_faces' });
    // Face detection happened inside the Python script already
    // Verify the output exists
    await fs.access(bestFramePath);

    // Step 2: Generate profile picture via Gemini
    updateJob(jobId, { step: 'generating_image' });

    const { buffer, mimeType, ext } = await generateProfilePicture(bestFramePath);
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

function runPythonScript(inputPath: string, outputDir: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('python3', [
      path.resolve('scripts/extract_best_frame.py'),
      inputPath,
      outputDir,
      String(config.frameRate),
    ]);

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code: number | null) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Python script exited with code ${code}`));
      } else {
        const outputPath = stdout.trim();
        if (!outputPath) {
          reject(new Error('Python script produced no output path'));
        } else {
          resolve(outputPath);
        }
      }
    });

    proc.on('error', (err: Error) => {
      reject(new Error(`Failed to spawn Python script: ${err.message}`));
    });
  });
}
