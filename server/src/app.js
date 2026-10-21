import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import paymentRoutes from './routes/payments.js';
import messRoutes from './routes/mess.js';
import termFeeRoutes from './routes/termFees.js';
import messageRoutes from './routes/messages.js';
import reportRoutes from './routes/reports.js';
import duplicateRoutes from './routes/duplicates.js';
import trashRoutes from './routes/trash.js';
import backupRoutes from './routes/backups.js';
import customFieldRoutes from './routes/customFields.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Builds the Express app without starting a listener, so it can be used both
// by the local server (index.js) and by the Vercel serverless entry (api/).
const app = express();

app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json({ limit: '1mb' }));
if (config.nodeEnv !== 'production') app.use(morgan('dev'));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, college: config.collegeName, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/mess', messRoutes);
app.use('/api/fees', termFeeRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/duplicates', duplicateRoutes);
app.use('/api/trash', trashRoutes);
app.use('/api/backups', backupRoutes);
app.use('/api/custom-fields', customFieldRoutes);

// When deployed as a single service (e.g. Render), the same server also hosts
// the built React site, so the SPA and its assets are served from client/dist.
const clientDist = path.resolve(__dirname, '../../client/dist');
if (config.serveClient && fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error('[api]', err);
  res.status(status).json({ message: err.message || 'Server error' });
});

export default app;
