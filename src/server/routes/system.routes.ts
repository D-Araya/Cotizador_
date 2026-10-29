import express, { Request, Response } from 'express';
import { dbStore } from '../../modules/db/store.js';
import { authenticateStaff, requireAdmin } from '../middleware/auth.js';
import { repos } from '../repositories/index.js';
import { restoreBackupSchema } from '../schemas.js';
import { sendProblem, sanitizeObjectKeys } from '../security.js';
import { AuditService } from '../services/audit.service.js';
import { SeedService } from '../services/seed.service.js';

export const systemRouter = express.Router();

// Estado del sistema y backend de persistencia (Abierto para que el frontend sepa si mostrar modo demo)
systemRouter.get('/system/status', (_req: Request, res: Response) => {
  res.json({
    backend: repos.backend,
    isDemoMode: repos.isDemoMode,
    message: repos.isDemoMode
      ? 'Modo demostración: los datos no se guardan'
      : 'Modo persistente activo (Firestore)',
  });
});

// Semilla idempotente (requiere ADMIN)
systemRouter.post('/system/seed', authenticateStaff, requireAdmin, async (req: Request, res: Response) => {
  const result = await SeedService.seedIfEmpty();
  await AuditService.logFromReq(
    req,
    'SYSTEM_SEED',
    'system',
    'database',
    result.seeded ? 'Carga inicial de datos completada' : 'Intento de semilla omitido (no vacía)'
  );
  res.json(result);
});

// Descargar backup (requiere ADMIN)
systemRouter.get('/system/backup', authenticateStaff, requireAdmin, async (req: Request, res: Response) => {
  const state = dbStore.getState();

  // Sanitizar: no incluir passwordHash, passwordSalt ni tokens en el archivo descargable
  const sanitizedUsers = state.users.map((u) => {
    const { passwordHash, passwordSalt, ...safe } = u;
    return safe;
  });

  const sanitizedContacts = state.contacts.map((c) => {
    const { portalTokenHash, ...safe } = c;
    return safe;
  });

  const backupData = {
    exportedAt: new Date().toISOString(),
    version: '2.0.0',
    company: state.company,
    users: sanitizedUsers,
    customers: state.customers,
    contacts: sanitizedContacts,
    categories: state.categories,
    catalogItems: state.catalogItems,
    quotations: state.quotations,
    invoices: state.invoices,
    operations: state.operations,
    outbox: state.outbox,
    auditLogs: state.auditLogs,
  };

  await AuditService.logFromReq(
    req,
    'DOWNLOAD_BACKUP',
    'system',
    'backup',
    'Descargó copia de seguridad completa del sistema'
  );

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="backup_ml_naval_${Date.now()}.json"`);
  res.json(backupData);
});

// Restaurar backup (requiere ADMIN y validación estricta zod)
systemRouter.post('/system/restore', authenticateStaff, requireAdmin, async (req: Request, res: Response) => {
  const parseResult = restoreBackupSchema.safeParse(req.body);
  if (!parseResult.success) {
    return sendProblem(
      res,
      400,
      'Archivo de respaldo inválido',
      'El esquema del archivo de respaldo no es válido o está corrupto.',
      { errors: parseResult.error.issues }
    );
  }

  const data = sanitizeObjectKeys(parseResult.data);
  const state = dbStore.getState();
  const beforeCounts = {
    quotations: state.quotations.length,
    customers: state.customers.length,
    catalogItems: state.catalogItems.length,
  };

  if (data.company) state.company = { ...state.company, ...data.company };
  if (data.customers) state.customers = data.customers as any;
  if (data.contacts) state.contacts = data.contacts as any;
  if (data.categories) state.categories = data.categories as any;
  if (data.catalogItems) state.catalogItems = data.catalogItems as any;
  if (data.quotations) state.quotations = data.quotations as any;
  if (data.invoices) state.invoices = data.invoices as any;
  if (data.operations) state.operations = data.operations as any;

  await AuditService.logFromReq(
    req,
    'RESTORE_BACKUP',
    'system',
    'backup',
    `Restauró respaldo del sistema (${data.quotations?.length || 0} cotizaciones)`
  );

  res.json({
    success: true,
    message: 'Sistema restaurado con éxito',
    restoredCounts: {
      before: beforeCounts,
      after: {
        quotations: state.quotations.length,
        customers: state.customers.length,
        catalogItems: state.catalogItems.length,
      },
    },
  });
});
