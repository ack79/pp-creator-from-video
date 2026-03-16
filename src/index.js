import express from 'express';
import fs from 'node:fs';
import { config } from './config.js';
import { startCleanup } from './services/jobManager.js';
import uploadRouter from './routes/upload.js';
import resultRouter from './routes/result.js';

const app = express();
app.use(express.json());

app.use('/upload', uploadRouter);
app.use('/result', resultRouter);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Ensure tmp directory exists
fs.mkdirSync('/tmp/jobs', { recursive: true });

const cleanupInterval = startCleanup();

const server = app.listen(config.port, () => {
  console.log(`Server running on port ${config.port}`);
});

// Graceful shutdown
function shutdown() {
  clearInterval(cleanupInterval);
  server.close(() => process.exit(0));
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
