import fs from 'node:fs/promises';
import path from 'node:path';
import type { Job, Style } from '../types.js';
import { config } from '../config.js';

const jobs = new Map<string, Job>();

export function createJob(id: string, inputPath: string, style: Style, country?: string): Job {
  const job: Job = {
    id,
    status: 'processing',
    step: null,
    error: null,
    createdAt: Date.now(),
    inputPath,
    resultPath: null,
    country: country ?? null,
    style,
  };
  jobs.set(id, job);
  return job;
}

export function updateJob(id: string, updates: Partial<Job>): Job | null {
  const job = jobs.get(id);
  if (!job) return null;
  Object.assign(job, updates);
  return job;
}

export function getJob(id: string): Job | null {
  return jobs.get(id) || null;
}

export async function deleteJob(id: string): Promise<void> {
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

export function startCleanup(): NodeJS.Timeout {
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
