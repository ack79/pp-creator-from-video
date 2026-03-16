import { Router, Request, Response } from 'express';
import path from 'node:path';
import { getJob } from '../services/jobManager.js';

const router = Router();

router.get('/:id', (req: Request<{ id: string }>, res: Response) => {
  const job = getJob(req.params.id);

  if (!job) {
    res.status(404).json({ status: 'not_found' });
    return;
  }

  if (job.status === 'processing') {
    res.json({ status: 'processing', step: job.step });
    return;
  }

  if (job.status === 'failed') {
    res.status(500).json({ status: 'failed', error: job.error });
    return;
  }

  // completed — send the image
  if (!job.resultPath) {
    res.status(500).json({ status: 'failed', error: 'Result file missing' });
    return;
  }

  res.sendFile(path.resolve(job.resultPath), {
    headers: { 'Content-Type': job.mimeType || 'image/png' },
  });
});

router.get('/:id/prompt', (req: Request<{ id: string }>, res: Response) => {
  const job = getJob(req.params.id);
  if (!job || !job.prompt) {
    res.status(404).json({ status: 'not_found' });
    return;
  }
  res.json({ prompt: job.prompt });
});

router.get('/:id/frames', (req: Request<{ id: string }>, res: Response) => {
  const job = getJob(req.params.id);
  if (!job || !job.framePaths) {
    res.status(404).json({ status: 'not_found' });
    return;
  }
  res.json({ frames: job.framePaths.map((_, i) => i) });
});

router.get('/:id/frames/:index', (req: Request<{ id: string; index: string }>, res: Response) => {
  const job = getJob(req.params.id);
  const index = parseInt(req.params.index, 10);
  if (!job || !job.framePaths || isNaN(index) || index < 0 || index >= job.framePaths.length) {
    res.status(404).json({ status: 'not_found' });
    return;
  }
  res.sendFile(path.resolve(job.framePaths[index]), {
    headers: { 'Content-Type': 'image/jpeg' },
  });
});

export default router;
