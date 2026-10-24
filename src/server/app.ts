import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import helmet from 'helmet';

import { requestIdMiddleware, globalErrorHandler } from './security.js';
import { authRouter } from './routes/auth.routes.js';
import { quotationsRouter } from './routes/quotations.routes.js';
import { publicRouter } from './routes/public.routes.js';
import { portalRouter } from './routes/portal.routes.js';
import { customersRouter } from './routes/customers.routes.js';
import { companyRouter } from './routes/company.routes.js';
import { catalogRouter } from './routes/catalog.routes.js';
import { geminiRouter } from './routes/gemini.routes.js';
import { invoicesRouter } from './routes/invoices.routes.js';
import { operationsRouter } from './routes/operations.routes.js';
import { notificationsRouter } from './routes/notifications.routes.js';
import { auditRouter } from './routes/audit.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { systemRouter } from './routes/system.routes.js';
import { templatesRouter } from './routes/templates.routes.js';

dotenv.config();

const app = express();

// Configurar confianza en el proxy de Google Cloud Run / AI Studio
app.set('trust proxy', 1);

// ==========================================
// SEGURIDAD Y MIDDLEWARES BASE
// ==========================================
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

app.use(requestIdMiddleware);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ==========================================
// API V1 ROUTER (Un archivo por recurso)
// ==========================================
const apiRouter = express.Router();

// 0. Sistema, Backups y Estado (incluye /system/status público)
apiRouter.use(systemRouter);

// 1. Identidad y autenticación
apiRouter.use('/auth', authRouter);

// 2. Cotizaciones (Core domain)
apiRouter.use('/quotations', quotationsRouter);

// 3. Vistas y decisiones públicas
apiRouter.use('/public', publicRouter);

// 4. Portal de Clientes
apiRouter.use('/portal', portalRouter);

// 5. Clientes y Contactos
apiRouter.use('/customers', customersRouter);
apiRouter.use(customersRouter); // Subrutas /contacts

// 6. Empresa y Usuarios Staff
apiRouter.use(companyRouter);

// 7. Catálogo de Productos y Servicios
apiRouter.use(catalogRouter);
apiRouter.use(templatesRouter);

// 8. Integraciones de IA con Gemini
apiRouter.use('/gemini', geminiRouter);

// 9. Documentos de Cobro (Invoices)
apiRouter.use(invoicesRouter);

// 10. Órdenes Operacionales
apiRouter.use(operationsRouter);

// 11. Bandeja de Salida (Notifications Outbox)
apiRouter.use(notificationsRouter);

// 12. Auditoría Inmutable
apiRouter.use(auditRouter);

// 13. Dashboard y Reportes
apiRouter.use(dashboardRouter);

// Montar router API v1
app.use('/api/v1', apiRouter);

// ==========================================
// SWAGGER OPENAPI CONTRACT
// ==========================================
app.get('/api/openapi.yaml', (_req: Request, res: Response) => {
  const openApiPath = path.resolve('contracts/openapi.yaml');
  if (fs.existsSync(openApiPath)) {
    res.setHeader('Content-Type', 'text/yaml');
    res.sendFile(openApiPath);
  } else {
    res.status(404).send('Not found');
  }
});

// Swagger UI: Solo disponible en desarrollo o para ADMIN autenticado
app.get('/api-docs', (req: Request, res: Response) => {
  if (process.env.NODE_ENV === 'production' && req.headers['x-admin-key'] !== process.env.ADMIN_KEY) {
    return res.status(404).send('Not found');
  }

  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Cotizador Online - Documentación OpenAPI 3.1</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; font-family: sans-serif; }
    .topbar { background: #0f172a; padding: 12px 24px; color: white; display: flex; align-items: center; justify-content: space-between; }
    .topbar h1 { margin: 0; font-size: 18px; font-weight: 600; }
    .topbar a { color: #38bdf8; text-decoration: none; font-size: 14px; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>📄 Cotizador Online &mdash; OpenAPI 3.1 Contract</h1>
    <a href="/app/dashboard">&larr; Volver al Panel</a>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/api/openapi.yaml",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    };
  </script>
</body>
</html>`);
});

// ==========================================
// MANEJADOR GLOBAL DE ERRORES (RFC 7807)
// ==========================================
app.use(globalErrorHandler);

export { app, apiRouter };
