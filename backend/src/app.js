import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { config } from './config.js';
import { ensureDefaults } from './lib/settings.js';
import { ensureTierPricing } from './lib/pricing.js';
import { notFound, errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import photoRoutes from './routes/photos.js';
import subscriptionRoutes from './routes/subscriptions.js';
import adminRoutes from './routes/admin.js';

ensureDefaults();
ensureTierPricing();

export function createApp() {
  const app = express();
  // Required on Render / reverse proxies so req.protocol is https
  app.set('trust proxy', 1);
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));
  app.use('/uploads', (req, _res, next) => {
    import('./lib/files.js')
      .then(({ hydrateUploadFile }) => {
        const name = path.basename(req.path);
        if (name && name !== '/') hydrateUploadFile(name);
      })
      .catch(() => {})
      .finally(() => next());
  });
  app.use('/uploads', express.static(config.uploadsDir));
  app.use('/legal', express.static(path.join(config.root, 'public', 'legal')));

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'viral-velocity', ts: Date.now() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/photos', photoRoutes);
  app.use('/api/subscription', subscriptionRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
