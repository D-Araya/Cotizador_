import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app, apiRouter } from './src/server/app.js';
import { initRepositories } from './src/server/repositories/index.js';
import { SeedService } from './src/server/services/seed.service.js';

const PORT = 3000;

// ==========================================
// FRONTEND MOUNTING (Vite Dev Middleware o Static Dist)
// ==========================================
async function startServer() {
  // Inicializar repositorios según DATA_BACKEND
  await initRepositories();

  // Semilla idempotente
  await SeedService.seedIfEmpty();

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve('dist/index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Cotizador Online backend & frontend running on http://0.0.0.0:${PORT}`);
  });
}

export { app, apiRouter };

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
  });
}
