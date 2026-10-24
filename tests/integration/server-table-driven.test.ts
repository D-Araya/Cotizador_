import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';
import {
  getAdminToken,
  getRepToken,
  getClientToken,
  createFixtureCustomer,
  createFixtureCatalogItem,
  createFixtureQuotation,
} from '../fixtures.js';

describe('Server Verification - Table Driven Permissions & Security Invariants', () => {
  let adminToken: string;
  let repToken: string;
  let clientToken: string;

  beforeAll(async () => {
    adminToken = await getAdminToken();
    repToken = await getRepToken();
    clientToken = await getClientToken();
  });

  // =========================================================================
  // 1. Matriz de Permisos Dirigida por Tabla (Rol × Endpoint × Resultado)
  // =========================================================================
  describe('1. Matriz de Permisos Dirigida por Tabla', () => {
    interface PermissionTestCase {
      name: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE';
      path: (ctx: { customerId: string; catalogItemId: string }) => string;
      body?: any;
      adminExpected: number;
      repExpected: number;
      clientExpected: number;
      anonymousExpected: number;
    }

    let fixtureCustId: string;
    let fixtureCatItemId: string;

    beforeAll(async () => {
      const { customer } = await createFixtureCustomer(adminToken);
      const catItem = await createFixtureCatalogItem(adminToken);
      fixtureCustId = customer.id;
      fixtureCatItemId = catItem.id;
    });

    const testCases: PermissionTestCase[] = [
      {
        name: 'Listar Cotizaciones Internas (/api/v1/quotations)',
        method: 'GET',
        path: () => '/api/v1/quotations',
        adminExpected: 200,
        repExpected: 200,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Dar de baja Cliente (/api/v1/customers/:id) [Solo Admin]',
        method: 'DELETE',
        path: (ctx) => `/api/v1/customers/${ctx.customerId}`,
        adminExpected: 204,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Crear Ítem en Catálogo (/api/v1/catalog-items) [Solo Admin]',
        method: 'POST',
        path: () => '/api/v1/catalog-items',
        body: {
          type: 'SERVICE',
          name: 'Servicio Permisos Test',
          categoryId: 'cat-01',
          unitCost: 100000,
          listPrice: 200000,
          skuOrCode: `SRV-PERM-${Date.now()}`,
          unit: 'GL',
        },
        adminExpected: 201,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Eliminar Ítem del Catálogo (/api/v1/catalog-items/:id) [Solo Admin]',
        method: 'DELETE',
        path: (ctx) => `/api/v1/catalog-items/${ctx.catalogItemId}`,
        adminExpected: 204,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Modificar Configuración de Empresa (/api/v1/company) [Solo Admin]',
        method: 'PUT',
        path: () => '/api/v1/company',
        body: {
          minMarginPct: 26,
          hardMinMarginPct: 18,
          ufRate: 38500,
        },
        adminExpected: 200,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Listar Usuarios del Equipo (/api/v1/users) [Solo Staff]',
        method: 'GET',
        path: () => '/api/v1/users',
        adminExpected: 200,
        repExpected: 200,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Crear Asesor Comercial (/api/v1/users) [Solo Admin]',
        method: 'POST',
        path: () => '/api/v1/users',
        body: {
          name: `Comercial Test ${Date.now()}`,
          email: `asesor.test.${Date.now()}@mlingenieria.cl`,
          role: 'SALES_REP',
          phone: '+56 9 9999 8888',
        },
        adminExpected: 201,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Exportar CSV de Auditoría (/api/v1/audit-logs/export-csv) [Solo Admin]',
        method: 'GET',
        path: () => '/api/v1/audit-logs/export-csv',
        adminExpected: 200,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Descargar Backup del Sistema (/api/v1/system/backup) [Solo Admin]',
        method: 'GET',
        path: () => '/api/v1/system/backup',
        adminExpected: 200,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
      {
        name: 'Restaurar Backup del Sistema (/api/v1/system/restore) [Solo Admin]',
        method: 'POST',
        path: () => '/api/v1/system/restore',
        body: () => {
          const s = dbStore.getState();
          return {
            company: s.company,
            categories: s.categories,
            catalogItems: s.catalogItems,
            customers: s.customers,
            contacts: s.contacts,
            quotations: s.quotations,
          };
        },
        adminExpected: 200,
        repExpected: 403,
        clientExpected: 401,
        anonymousExpected: 401,
      },
    ];

    testCases.forEach((tc) => {
      it(`Rol ADMIN -> ${tc.name} debe retornar ${tc.adminExpected}`, async () => {
        const p = tc.path({ customerId: fixtureCustId, catalogItemId: fixtureCatItemId });
        const req = request(app)[tc.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](p)
          .set('Authorization', `Bearer ${adminToken}`);
        const b = typeof tc.body === 'function' ? tc.body() : tc.body;
        if (b) req.send(b);
        const res = await req;
        expect(res.status).toBe(tc.adminExpected);
      });

      it(`Rol SALES_REP -> ${tc.name} debe retornar ${tc.repExpected}`, async () => {
        const p = tc.path({ customerId: fixtureCustId, catalogItemId: fixtureCatItemId });
        const req = request(app)[tc.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](p)
          .set('Authorization', `Bearer ${repToken}`);
        const b = typeof tc.body === 'function' ? tc.body() : tc.body;
        if (b) req.send(b);
        const res = await req;
        expect(res.status).toBe(tc.repExpected);
      });

      it(`Rol CLIENT -> ${tc.name} debe retornar ${tc.clientExpected}`, async () => {
        const p = tc.path({ customerId: fixtureCustId, catalogItemId: fixtureCatItemId });
        const req = request(app)[tc.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](p)
          .set('Authorization', `Bearer ${clientToken}`);
        const b = typeof tc.body === 'function' ? tc.body() : tc.body;
        if (b) req.send(b);
        const res = await req;
        expect([401, 403]).toContain(res.status);
      });

      it(`ANÓNIMO -> ${tc.name} debe retornar 401`, async () => {
        const p = tc.path({ customerId: fixtureCustId, catalogItemId: fixtureCatItemId });
        const req = request(app)[tc.method.toLowerCase() as 'get' | 'post' | 'put' | 'delete'](p);
        const b = typeof tc.body === 'function' ? tc.body() : tc.body;
        if (b) req.send(b);
        const res = await req;
        expect(res.status).toBe(401);
      });
    });
  });

  // =========================================================================
  // 2. Recálculo de Costos y Subtotales en el Servidor (S5)
  // =========================================================================
  describe('2. Recálculo de Costos y Subtotales en Servidor', () => {
    it('S5: El servidor ignora costos y subtotales falsificados por el cliente y recalcula con el catálogo real', async () => {
      const quote = await createFixtureQuotation(adminToken, 'DRAFT');
      const catItem = await createFixtureCatalogItem(adminToken); // Cost: 150000

      // El cliente intenta enviar un unitCost falso de $10 y subtotal falso de $10
      const patchRes = await request(app)
        .put(`/api/v1/quotations/${quote.id}/lines`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              catalogItemId: catItem.id,
              quantity: 2,
              price: 300000,
              unitCost: 10, // Falsificado!
              subtotal: 20, // Falsificado!
              totalCost: 20, // Falsificado!
            },
          ],
        });

      expect(patchRes.status).toBe(200);
      const updatedLine = patchRes.body.lines[0];

      // El servidor debe haber tomado el costo real del catálogo (150.000)
      expect(updatedLine.cost).toBe(150000);
      expect(updatedLine.costTotal).toBe(300000); // 2 * 150.000
      expect(updatedLine.subtotal).toBe(600000); // 2 * 300.000
      expect(patchRes.body.grandTotal).toBe(714000); // 600.000 * 1.19
    });
  });

  // =========================================================================
  // 3. Transiciones Inválidas de Estado (S5)
  // =========================================================================
  describe('3. Transiciones Inválidas de Estado', () => {
    it('No permite pasar un borrador vacío sin ítems a ACCEPTED', async () => {
      const { customer, contact } = await createFixtureCustomer(adminToken);
      const draftRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          customerId: customer.id,
          contactId: contact.id,
          title: 'Cotización Vacía',
        });
      const emptyDraft = draftRes.body;

      // Intento de aceptación offline de borrador vacío
      const acceptRes = await request(app)
        .post(`/api/v1/quotations/${emptyDraft.id}/accept-offline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchaseOrderNumber: 'OC-TEST-001',
          offlineNote: 'Aceptación inválida de borrador vacío',
        });

      expect([400, 422]).toContain(acceptRes.status);
    });

    it('No permite reabrir una cotización ACCEPTED volviendo a DRAFT', async () => {
      const acceptedQuote = await createFixtureQuotation(adminToken, 'ACCEPTED');

      const changeRes = await request(app)
        .post(`/api/v1/quotations/${acceptedQuote.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: 'DRAFT',
          note: 'Intento de reapertura',
        });

      expect([400, 422]).toContain(changeRes.status);
    });

    it('No permite cambiar una cotización REJECTED directamente a ACCEPTED', async () => {
      const quote = await createFixtureQuotation(adminToken, 'SENT');

      // Rechazarla
      await request(app)
        .post(`/api/v1/quotations/${quote.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lossReason: 'precio',
          note: 'Cliente consideró el precio muy alto',
        })
        .expect(200);

      // Intentar aceptar cotización ya rechazada
      const acceptRes = await request(app)
        .post(`/api/v1/quotations/${quote.id}/accept-offline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchaseOrderNumber: 'OC-FAIL-01',
          offlineNote: 'Intento de aceptar cotización rechazada',
        });

      expect([400, 422, 409]).toContain(acceptRes.status);
    });
  });

  // =========================================================================
  // 4. La Respuesta Pública No Contiene Costos ni Notas Internas (S4, C1)
  // =========================================================================
  describe('4. Sanitización Estricta en Respuesta Pública (S4, C1)', () => {
    it('S4/C1: GET /api/v1/public/quotations/:token no expone costos, utilidad, margen ni comentarios internos', async () => {
      const quote = await createFixtureQuotation(adminToken, 'SENT');
      expect(quote.publicToken).toBeDefined();

      const res = await request(app)
        .get(`/api/v1/public/quotations/${quote.publicToken}`)
        .expect(200);

      const pubQuot = res.body.quotation;

      // Invariantes de seguridad:
      expect(pubQuot.cost).toBeUndefined();
      expect(pubQuot.totalCost).toBeUndefined();
      expect(pubQuot.marginPct).toBeUndefined();
      expect(pubQuot.profit).toBeUndefined();
      expect(pubQuot.internalNotes).toBeUndefined();

      // Ninguna línea expone costo ni margen
      pubQuot.lines.forEach((line: any) => {
        expect(line.cost).toBeUndefined();
        expect(line.unitCost).toBeUndefined();
        expect(line.marginPct).toBeUndefined();
        expect(line.totalCost).toBeUndefined();
      });
    });
  });

  // =========================================================================
  // 5. ?customerId= Ajeno es Rechazado (S3)
  // =========================================================================
  describe('5. Protección de Acceso Multitenant en Portal (S3)', () => {
    it('S3: El portal rechaza con 403 Forbidden si el cliente intenta enviar ?customerId= ajeno', async () => {
      const token = await getClientToken();
      const res = await request(app)
        .get('/api/v1/portal/quotations?customerId=cust-alien-hacker-999')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
      expect(res.body.title).toContain('Acceso Denegado');
    });
  });

  // =========================================================================
  // 6. Inyección de Fórmulas en CSV Sanitizada (S9)
  // =========================================================================
  describe('6. Protección contra CSV Formula Injection (S9)', () => {
    it('S9: Caracteres de fórmula =, +, -, @ en campos de auditoría son neutralizados con un apóstrofe', async () => {
      const state = dbStore.getState();
      state.auditLogs.push({
        id: `audit-test-${Date.now()}`,
        timestamp: new Date().toISOString(),
        actorId: 'test',
        actorName: '=cmd|"/c calc"!A0',
        actorRole: 'ADMIN',
        action: '+SUM(1,2)',
        entity: '-DDE("cmd")',
        entityId: '@SYSTEM',
        description: '=1+1',
      });

      const res = await request(app)
        .get('/api/v1/audit-logs/export-csv')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const csvText = res.text;

      // Verificar que los valores peligrosos comiencen con el apóstrofe de escape
      expect(csvText).toContain("'=cmd");
      expect(csvText).toContain("'+SUM");
      expect(csvText).toContain("'-DDE");
      expect(csvText).toContain("'@SYSTEM");
      expect(csvText).toContain("'=1+1");
    });
  });

  // =========================================================================
  // 7. Revisiones Correlativas (P1.a)
  // =========================================================================
  describe('7. Trazabilidad de Revisiones (P1.a)', () => {
    it('P1.a: Crear revisión de una cotización enviada incrementa la revisión, mantiene quotationGroupId y preserva la original', async () => {
      const originalQuote = await createFixtureQuotation(adminToken, 'SENT');
      const origNumber = originalQuote.quotationNumber;

      const revRes = await request(app)
        .post(`/api/v1/quotations/${originalQuote.id}/revisions`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);

      const revision = revRes.body;

      expect(revision.status).toBe('DRAFT');
      expect(revision.revision).toBe((originalQuote.revision || 1) + 1);
      expect(revision.quotationNumber).toContain(`-R${revision.revision}`);
      expect(revision.quotationGroupId).toBe(originalQuote.quotationGroupId || originalQuote.id);

      // La cotización original permanece inalterada en estado SENT
      const state = dbStore.getState();
      const origAfter = state.quotations.find((q) => q.id === originalQuote.id);
      expect(origAfter!.quotationNumber).toBe(origNumber);
      expect(origAfter!.supersededByQuotationId).toBe(revision.id);
    });
  });

  // =========================================================================
  // 8. Control de Vigencia de Cotizaciones (P2.k)
  // =========================================================================
  describe('8. Vigencia y Expiración', () => {
    it('Cotización con fecha de vigencia pasada es marcada como EXPIRED y no puede ser aceptada por el cliente', async () => {
      const quote = await createFixtureQuotation(adminToken, 'SENT');
      const state = dbStore.getState();

      // Forzar fecha de vigencia a hace 5 días
      const storedQuote = state.quotations.find((q) => q.id === quote.id);
      storedQuote!.validUntil = new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString();

      // Intento de aceptación pública con token
      const acceptRes = await request(app)
        .post(`/api/v1/public/quotations/${quote.publicToken}/accept`)
        .send({
          signerName: 'Don Cliente',
          signerPosition: 'Gerente General',
          evidenceNote: 'Aprobación tardía',
        });

      expect([400, 422]).toContain(acceptRes.status);
    });
  });

  // =========================================================================
  // 9. Hitos de Pago en Documentos de Cobro (C6)
  // =========================================================================
  describe('9. Hitos de Pago en Documentos de Cobro (C6)', () => {
    it('Registrar abonos parciales actualiza el estado a PARTIALLY_PAID y luego a PAID al completar el 100%', async () => {
      // 1. Aceptar cotización para generar documento de cobro
      const quote = await createFixtureQuotation(adminToken, 'ACCEPTED');
      const state = dbStore.getState();
      const invoice = state.invoices.find((inv) => inv.quotationId === quote.id);
      expect(invoice).toBeDefined();

      const total = invoice!.total;
      const halfPayment = Math.floor(total / 2);

      // 2. Registrar primer abono (50%)
      const pay1Res = await request(app)
        .post(`/api/v1/invoices/${invoice!.id}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: halfPayment,
          paymentMethod: 'TRANSFERENCIA_BANCARIA',
          reference: 'TRANSF-001',
          notes: 'Anticipo 50%',
        })
        .expect(201);

      expect(pay1Res.body.invoice.status).toBe('PARTIAL');
      expect(pay1Res.body.invoice.paidAmount).toBe(halfPayment);

      // 3. Registrar segundo abono (restante)
      const remaining = total - halfPayment;
      const pay2Res = await request(app)
        .post(`/api/v1/invoices/${invoice!.id}/payments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          amount: remaining,
          paymentMethod: 'TRANSFERENCIA_BANCARIA',
          reference: 'TRANSF-002',
          notes: 'Saldo final 50%',
        })
        .expect(201);

      expect(pay2Res.body.invoice.status).toBe('PAID');
      expect(pay2Res.body.invoice.paidAmount).toBe(total);
    });
  });

  // =========================================================================
  // 10. Generación de IDs Únicos bajo Concurrencia (S8)
  // =========================================================================
  describe('10. Generación de IDs Únicos bajo Concurrencia (S8)', () => {
    it('S8: 30 creaciones concurrentes generan 30 identificadores únicos sin colisiones', async () => {
      const promises = Array.from({ length: 30 }, (_, i) =>
        request(app)
          .post('/api/v1/customers')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            businessName: `Concurrent Test Empresa ${Date.now()}-${i}-${Math.random()}`,
            taxId: `77.${Math.floor(100 + Math.random() * 800)}.${Math.floor(100 + Math.random() * 800)}-9`,
            address: 'Puerto Montt Concurrente',
            email: `concurrent${i}-${Date.now()}@test.cl`,
            phone: '+56 9 1111 2222',
            industry: 'Ingeniería Naval',
          })
      );

      const responses = await Promise.all(promises);
      const createdIds = responses.map((r) => r.body.id);

      expect(createdIds.length).toBe(30);
      const uniqueIds = new Set(createdIds);
      expect(uniqueIds.size).toBe(30);
    });
  });
});
