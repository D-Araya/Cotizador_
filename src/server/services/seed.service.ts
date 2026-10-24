import { repos } from '../repositories/index.js';
import { dbStore } from '../../modules/db/store.js';

export class SeedService {
  /**
   * Carga la semilla inicial de forma estrictamente idempotente.
   * Solo si el repositorio de usuarios o cotizaciones está completamente vacío.
   */
  static async seedIfEmpty(): Promise<{ seeded: boolean; reason?: string }> {
    const quoteCount = await repos.quotationRepo.count();
    const userCount = await repos.userRepo.count();

    if (quoteCount > 0 || userCount > 0) {
      return { seeded: false, reason: 'La base de datos ya contiene datos registrados.' };
    }

    const state = dbStore.getState();

    // 1. Usuarios
    for (const u of state.users) {
      await repos.userRepo.create(u);
    }

    // 2. Empresa
    await repos.companyRepo.update(state.company);

    // 3. Clientes y Contactos
    for (const c of state.customers) {
      await repos.customerRepo.create(c);
    }
    for (const ct of state.contacts) {
      await repos.contactRepo.create(ct);
    }

    // 4. Catálogo
    for (const item of state.catalogItems) {
      await repos.catalogRepo.create(item);
    }

    // 5. Cotizaciones
    for (const q of state.quotations) {
      await repos.quotationRepo.create(q);
    }

    // 6. Documentos de cobro
    for (const inv of state.invoices) {
      await repos.invoiceRepo.create(inv);
    }

    // 7. Órdenes
    for (const op of state.operations) {
      await repos.operationRepo.create(op);
    }

    // 8. Notificaciones outbox
    for (const m of state.outbox) {
      await repos.notificationRepo.create(m);
    }

    // 9. Auditoría inicial
    for (const log of state.auditLogs) {
      await repos.auditRepo.create(log);
    }

    console.log('🌱 [Seed] Base de datos inicializada exitosamente con datos semilla.');
    return { seeded: true };
  }
}
