import { Router } from 'express';
import path from 'node:path';
import { getJob } from '../services/jobManager.js';

const router = Router();

router.get('/:id', (req, res) => {
  const job = getJob(req.params.id);

  if (!job) {
    return res.status(404).json({ status: 'not_found' });
  }

  if (job.status === 'processing') {
    return res.json({ status: 'processing', step: job.step });
  }

  if (job.status === 'failed') {
    return res.status(500).json({ status: 'failed', error: job.error });
  }

  // completed — send the image
  res.sendFile(path.resolve(job.resultPath), {
    headers: { 'Content-Type': job.mimeType || 'image/png' },
  });
});

export default router;
