import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';
import { createJob } from '../services/jobManager.js';
import { processVideo } from '../services/videoProcessor.js';

const ALLOWED_MIMES = ['video/mp4', 'video/webm'];
const ALLOWED_EXTS = ['.mp4', '.webm'];

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const id = uuidv4();
    (_req as Request).jobId = id;
    const jobDir = path.join('/tmp/jobs', id);
    fs.mkdirSync(jobDir, { recursive: true });
    cb(null, jobDir);
  },
  filename(_req, file, cb) {
    const ext = file.originalname.endsWith('.webm') ? '.webm' : '.mp4';
    cb(null, `input${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_MIMES.includes(file.mimetype) || ALLOWED_EXTS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'video'));
    }
  },
});

const router = Router();

router.post('/', upload.single('video'), (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'No video file provided' });
    return;
  }

  const id = req.jobId!;
  const inputPath = req.file.path;
  const country = typeof req.body.country === 'string' && req.body.country.trim()
    ? req.body.country.trim()
    : undefined;

  createJob(id, inputPath, country);

  // Fire-and-forget
  processVideo(id);

  res.status(202).json({ id });
});

// Multer error handling
router.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({ error: `File too large. Max size: ${config.maxFileSizeMb}MB` });
      return;
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(415).json({ error: 'Only MP4 and WebM video files are accepted' });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  _next(err);
});

export default router;
