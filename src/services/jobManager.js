import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';

const jobs = new Map();

export function createJob(id, inputPath) {
  const job = {
    id,
    status: 'processing',
    step: null,
    error: null,
    createdAt: Date.now(),
    inputPath,
    resultPath: null,
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id, updates) {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

export function getJob(id) {
  return jobs.get(id) || null;
}

export async function deleteJob(id) {
  const job = jobs.get(id);
  if (!job) return;
  const jobDir = path.dirname(job.inputPath);
  try {
    await fs.rm(jobDir, { recursive: true, force: true });
  } catch {
    // directory may already be gone
  }
  jobs.delete(id);
}

export function startCleanup() {
  const interval = setInterval(async () => {
    const now = Date.now();
    for (const [id, job] of jobs) {
      if (now - job.createdAt > config.jobTtlMs) {
        try {
          await deleteJob(id);
        } catch {
          // best-effort cleanup
        }
      }
    }
  }, 5 * 60 * 1000);
  return interval;
}
