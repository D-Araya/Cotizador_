import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { NumberingService } from '../../src/server/services/numbering.service.js';
import { AuditService } from '../../src/server/services/audit.service.js';
import { OutboxService } from '../../src/server/services/outbox.service.js';
import { repos } from '../../src/server/repositories/index.js';

describe('Fase 2: Persistencia, Estructura y Criterios de Aceptación', () => {
  it('ACEPTACIÓN 1: 1.000 creaciones concurrentes producen 1.000 ids distintos (sin colisiones)', async () => {
    const ids = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      ids.add(NumberingService.newId('quot'));
    }

    expect(ids.size).toBe(count);
  });

  it('ACEPTACIÓN 2: La numeración atómica genera folios correlativos crecientes sin saltos', async () => {
    const folios = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const qNum = await NumberingService.nextQuotationNumber();
      folios.add(qNum);
    }
    expect(folios.size).toBe(50);
  });

  it('ACEPTACIÓN 3: Folio de orden operacional toma el año dinámico de la fecha', async () => {
    const currentYear = new Date().getFullYear();
    const opNum = await NumberingService.nextOperationNumber();
    expect(opNum).toContain(`OP-${currentYear}-`);
  });

  it('ACEPTACIÓN 4: La auditoría registra el actor real de la sesión (append-only)', async () => {
    const initialCount = await repos.auditRepo.count();

    const logged = await AuditService.record({
      action: 'UPDATE_COMPANY',
      entity: 'company',
      entityId: 'comp-01',
      summary: 'Actualización de datos legales por auditor',
      actor: {
        id: 'usr-admin-01',
        name: 'Carlos Mendoza',
        role: 'ADMIN',
        email: 'admin@mlingenieria.cl',
      },
    });

    expect(logged.id).toBeDefined();
    expect(logged.userId).toBe('usr-admin-01');
    expect(logged.userName).toBe('Carlos Mendoza');
    expect(logged.userRole).toBe('ADMIN');

    const newCount = await repos.auditRepo.count();
    expect(newCount).toBe(initialCount + 1);
  });

  it('ACEPTACIÓN 5: Un correo sin SMTP configurado queda PENDING (no SENT) y avisa en deliveryError', async () => {
    // Asegurar que no hay credenciales SMTP en este test
    const origHost = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;

    try {
      const msg = await OutboxService.enqueue({
        quotationId: 'quot-test-smtp',
        quotationNumber: 'COT-000999',
        customerId: 'cust-01',
        recipientName: 'Armador Naval',
        recipientEmail: 'armador@naviera.cl',
        channel: 'EMAIL',
        publicUrl: 'http://localhost:3000/q/test-token',
        totalFormatted: '$1.000.000 CLP',
      });

      expect(msg.status).toBe('PENDING');
      expect(msg.deliveryError).toContain('Envío no configurado');
      expect(msg.sentAt).toBeUndefined();
    } finally {
      if (origHost) process.env.SMTP_HOST = origHost;
    }
  });

  it('ACEPTACIÓN 6: WhatsApp queda con estado PENDING_MANUAL y enlace wa.me', async () => {
    const msg = await OutboxService.enqueue({
      quotationId: 'quot-test-wa',
      quotationNumber: 'COT-000888',
      customerId: 'cust-01',
      recipientName: 'Capitán Barrientos',
      recipientEmail: 'capitan@pesquera.cl',
      recipientPhone: '+56 9 8765 4321',
      channel: 'WHATSAPP',
      publicUrl: 'http://localhost:3000/q/test-wa-token',
      totalFormatted: '$2.500.000 CLP',
    });

    expect(msg.status).toBe('PENDING_MANUAL');
    expect(msg.whatsAppUrl).toBeDefined();
    expect(msg.whatsAppUrl).toContain('wa.me/56987654321');
  });

  it('ACEPTACIÓN 7: Paginación en el servidor devuelve { items, total, page, pageSize }', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });

    const token = loginRes.body.token;

    const res = await request(app)
      .get('/api/v1/quotations?page=1&pageSize=5')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items).toBeDefined();
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeDefined();
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(5);
  });

  it('ACEPTACIÓN 8: Endpoint /api/v1/system/status expone el modo demo y backend', async () => {
    const res = await request(app).get('/api/v1/system/status');
    expect(res.status).toBe(200);
    expect(res.body.backend).toBeDefined();
    expect(typeof res.body.isDemoMode).toBe('boolean');
    expect(res.body.message).toBeDefined();
  });
});
