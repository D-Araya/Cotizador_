import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';
import { formatMoney } from '../../src/shared-kernel/formatMoney.js';
import { computeTotals } from '../../src/shared-kernel/pricing/computeTotals.js';

describe('P3 Acceptance Rules & Feature Verification (l, m, n)', () => {
  let adminToken: string;
  let repToken: string;

  beforeAll(async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    repToken = repLogin.body.token;
  });

  // =========================================================================
  // P3.l: EXCEPCIÓN DE MARGEN CON APROBACIÓN
  // =========================================================================
  describe('P3.l EXCEPCIÓN DE MARGEN CON APROBACIÓN', () => {
    it('P3.l: Piso duro configurable debe ser menor que el mínimo corporativo', async () => {
      // Intento de configurar piso duro >= mínimo (ej. mínimo 28%, piso duro 30%)
      const resInvalid = await request(app)
        .put('/api/v1/company')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minMarginPct: 28.0,
          hardMinMarginPct: 30.0,
        });

      expect(resInvalid.status).toBe(400);
      expect(resInvalid.body.title).toBe('Piso duro inválido');

      // Configuración válida: mínimo 28%, piso duro 18%
      const resValid = await request(app)
        .put('/api/v1/company')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          minMarginPct: 28.0,
          hardMinMarginPct: 18.0,
        });

      expect(resValid.status).toBe(200);
      expect(resValid.body.hardMinMarginPct).toBe(18.0);
      expect(resValid.body.minMarginPct).toBe(28.0);
    });

    it('P3.l: Cotización con margen bajo el piso duro siempre se bloquea (422)', async () => {
      const state = dbStore.getState();
      const customer = state.customers[0];
      const catItem = state.catalogItems[0]; // unitCost ej. 1.200.000

      // Crear cotización borrador
      const createRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${repToken}`)
        .send({
          customerId: customer.id,
          currency: 'CLP',
        });
      expect(createRes.status).toBe(201);
      const quoteId = createRes.body.id;

      // Asignar precio con margen del 10% (inferior al piso duro del 18%)
      // Si cost = 100, price = 111.11 => margin 10%
      const cost = catItem.unitCost;
      const priceLow = Math.round(cost / (1 - 0.10));

      const linesRes = await request(app)
        .put(`/api/v1/quotations/${quoteId}/lines`)
        .set('Authorization', `Bearer ${repToken}`)
        .send({
          lines: [
            {
              catalogItemId: catItem.id,
              quantity: 1,
              price: priceLow,
            },
          ],
        });

      expect(linesRes.status).toBe(422);
      expect(linesRes.body.title).toBe('Margen insuficiente');
      expect(linesRes.body.detail).toContain('piso duro no negociable');
    });

    it('P3.l: Margen entre el piso duro y el mínimo pasa a PENDING_APPROVAL con motivo del asesor', async () => {
      const state = dbStore.getState();
      const customer = state.customers[0];
      const catItem = state.catalogItems[0];

      // Crear cotización borrador
      const createRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${repToken}`)
        .send({
          customerId: customer.id,
          currency: 'CLP',
        });
      const quoteId = createRes.body.id;

      // Margen del 22% (entre piso duro 18% y mínimo 28%)
      const cost = catItem.unitCost;
      const priceException = Math.round(cost / (1 - 0.22));

      const linesRes = await request(app)
        .put(`/api/v1/quotations/${quoteId}/lines`)
        .set('Authorization', `Bearer ${repToken}`)
        .send({
          lines: [
            {
              catalogItemId: catItem.id,
              quantity: 1,
              price: priceException,
            },
          ],
          marginExceptionReason: 'Cliente corporativo solicita descuento por contrato anual de flota',
        });

      // No se bloquea: pasa a PENDING_APPROVAL
      expect(linesRes.status).toBe(200);
      expect(linesRes.body.status).toBe('PENDING_APPROVAL');
      expect(linesRes.body.marginApprovalStatus).toBe('PENDING');
      expect(linesRes.body.marginExceptionReason).toContain('contrato anual de flota');

      // Intentar enviar al cliente en PENDING_APPROVAL debe fallar con 400
      const sendRes = await request(app)
        .post(`/api/v1/quotations/${quoteId}/send`)
        .set('Authorization', `Bearer ${repToken}`);

      expect(sendRes.status).toBe(400);
      expect(sendRes.body.title).toBe('Pendiente de aprobación');
    });

    it('P3.l: Asesor no-admin NO puede aprobar la excepción (403)', async () => {
      const state = dbStore.getState();
      const pendingQuote = state.quotations.find((q) => q.status === 'PENDING_APPROVAL');
      expect(pendingQuote).toBeDefined();

      const res = await request(app)
        .post(`/api/v1/quotations/${pendingQuote!.id}/approve-margin`)
        .set('Authorization', `Bearer ${repToken}`)
        .send({ comment: 'Intento no autorizado' });

      expect(res.status).toBe(403);
    });

    it('P3.l: ADMIN aprueba con comentario, queda marginException=true y visible en dashboards y auditoría', async () => {
      const state = dbStore.getState();
      const pendingQuote = state.quotations.find((q) => q.status === 'PENDING_APPROVAL');
      expect(pendingQuote).toBeDefined();

      // ADMIN aprueba la excepción
      const approveRes = await request(app)
        .post(`/api/v1/quotations/${pendingQuote!.id}/approve-margin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Aprobado por Gerencia Comercial debido a volumen estratégico' });

      expect(approveRes.status).toBe(200);
      expect(approveRes.body.status).toBe('DRAFT');
      expect(approveRes.body.marginException).toBe(true);
      expect(approveRes.body.marginApprovalStatus).toBe('APPROVED');
      expect(approveRes.body.marginApprovalComment).toContain('Aprobado por Gerencia');

      // Ahora que está aprobada por excepción, SÍ se puede enviar al cliente
      const sendRes = await request(app)
        .post(`/api/v1/quotations/${pendingQuote!.id}/send`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(sendRes.status).toBe(200);
      expect(sendRes.body.status).toBe('SENT');

      // Visible en dashboard de métricas
      const dashRes = await request(app)
        .get('/api/v1/dashboard/pipeline-metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(dashRes.status).toBe(200);
      expect(dashRes.body.marginExceptions).toBeDefined();
      expect(dashRes.body.marginExceptions.count).toBeGreaterThanOrEqual(1);

      // Audit logs contiene el registro
      const auditRes = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(auditRes.status).toBe(200);
      const auditEntry = auditRes.body.find((a: any) => a.action === 'MARGIN_EXCEPTION_APPROVED');
      expect(auditEntry).toBeDefined();
    });

    it('P3.l: ADMIN rechaza con comentario obligatorio', async () => {
      const state = dbStore.getState();
      const customer = state.customers[0];
      const catItem = state.catalogItems[0];

      // Crear cotización y llevar a PENDING_APPROVAL
      const createRes = await request(app)
        .post('/api/v1/quotations')
        .set('Authorization', `Bearer ${repToken}`)
        .send({ customerId: customer.id, currency: 'CLP' });
      const quoteId = createRes.body.id;

      const priceException = Math.round(catItem.unitCost / (1 - 0.23));
      await request(app)
        .put(`/api/v1/quotations/${quoteId}/lines`)
        .set('Authorization', `Bearer ${repToken}`)
        .send({
          lines: [{ catalogItemId: catItem.id, quantity: 1, price: priceException }],
          marginExceptionReason: 'Petición de descuento de cliente',
        });

      // Rechazar sin comentario debe fallar (400)
      const rejectFail = await request(app)
        .post(`/api/v1/quotations/${quoteId}/reject-margin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: '' });
      expect(rejectFail.status).toBe(400);

      // Rechazar con comentario válido
      const rejectSuccess = await request(app)
        .post(`/api/v1/quotations/${quoteId}/reject-margin`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ comment: 'Rechazado: no se justifican los costos operacionales del servicio' });

      expect(rejectSuccess.status).toBe(200);
      expect(rejectSuccess.body.marginApprovalStatus).toBe('REJECTED');
      expect(rejectSuccess.body.marginException).toBeFalsy();
    });
  });

  // =========================================================================
  // P3.m: MONEDA UF Y CONVERSIÓN A CLP
  // =========================================================================
  describe('P3.m MONEDA UF CON CONVERSIÓN A CLP', () => {
    it('P3.m: Actualización configurable del valor del día de la UF', async () => {
      const ufRateVal = 38950.50;

      const res = await request(app)
        .post('/api/v1/company/uf-rate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ufRate: ufRateVal });

      expect(res.status).toBe(200);
      expect(res.body.ufRate).toBe(ufRateVal);
      expect(res.body.ufRateUpdatedAt).toBeDefined();

      const compRes = await request(app)
        .get('/api/v1/company')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(compRes.body.ufRate).toBe(ufRateVal);
    });

    it('P3.m: computeTotals y formatMoney soportan UF y conversión', () => {
      const ufRate = 38000;
      const totals = computeTotals(
        [{ cost: 600000, price: 1000000, quantity: 1, marginPct: 40 }],
        28.0,
        19.0,
        0,
        18.0,
        ufRate
      );

      expect(totals.ufRate).toBe(ufRate);
      expect(totals.netSubtotal).toBe(1000000);
      expect(totals.grandTotal).toBe(1190000);
      // 1.190.000 / 38.000 = 31.32 UF
      expect(totals.ufGrandTotal).toBeCloseTo(31.32, 1);

      const formattedUf = formatMoney(31.32, 'UF');
      expect(formattedUf).toContain('UF');
      expect(formattedUf).toContain('31');
    });

    it('P3.m: Vista pública expone valores en UF cuando está configurada', async () => {
      const state = dbStore.getState();
      const quote = state.quotations.find((q) => q.status === 'SENT' && q.publicToken);
      expect(quote).toBeDefined();

      const publicRes = await request(app).get(`/api/v1/public/quotations/${quote!.publicToken}`);
      expect(publicRes.status).toBe(200);
      expect(publicRes.body.quotation.ufRate).toBeDefined();
      expect(publicRes.body.quotation.ufGrandTotal).toBeDefined();
    });
  });

  // =========================================================================
  // P3.n: ADJUNTOS (ENLACES A ARCHIVOS) EN COTIZACIONES Y ENTREGABLES
  // =========================================================================
  describe('P3.n ADJUNTOS Y ENLACES A ARCHIVOS', () => {
    it('P3.n: Agregar y eliminar enlaces adjuntos en cotización con validación de URL y auditoría', async () => {
      const state = dbStore.getState();
      const quote = state.quotations[0];

      // 1. URL inválida debe ser rechazada (400)
      const failRes = await request(app)
        .post(`/api/v1/quotations/${quote.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Plano General',
          url: 'no-es-una-url-valida',
        });
      expect(failRes.status).toBe(400);

      // 2. URL válida agregada con éxito
      const addRes = await request(app)
        .post(`/api/v1/quotations/${quote.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Plano de Líneas de Agua DWG',
          url: 'https://drive.google.com/file/d/12345/view',
          description: 'Revisión final firmada por perito naval',
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.id).toBeDefined();
      expect(addRes.body.name).toBe('Plano de Líneas de Agua DWG');
      expect(addRes.body.url).toBe('https://drive.google.com/file/d/12345/view');
      const attachmentId = addRes.body.id;

      // 3. Verificado en cotización
      const getQuote = await request(app)
        .get(`/api/v1/quotations/${quote.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getQuote.body.attachments).toBeDefined();
      const found = getQuote.body.attachments.find((a: any) => a.id === attachmentId);
      expect(found).toBeDefined();

      // 4. Verificado en auditoría
      const auditRes = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`);
      const auditAdd = auditRes.body.find((a: any) => a.action === 'ADD_ATTACHMENT');
      expect(auditAdd).toBeDefined();

      // 5. Eliminar adjunto
      const delRes = await request(app)
        .delete(`/api/v1/quotations/${quote.id}/attachments/${attachmentId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(204);

      // 6. Confirmar eliminación
      const getQuoteAfter = await request(app)
        .get(`/api/v1/quotations/${quote.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const foundAfter = (getQuoteAfter.body.attachments || []).find((a: any) => a.id === attachmentId);
      expect(foundAfter).toBeUndefined();
    });

    it('P3.n: Agregar y eliminar enlaces adjuntos en entregables de operaciones', async () => {
      const state = dbStore.getState();
      const operation = state.operations[0];
      expect(operation).toBeDefined();
      const deliverable = operation.deliverables?.[0];
      expect(deliverable).toBeDefined();

      // 1. Agregar enlace a entregable
      const addRes = await request(app)
        .post(`/api/v1/operations/${operation.id}/deliverables/${deliverable!.id}/attachments`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Certificado de Estabilidad DIRECTEMAR PDF',
          url: 'https://storage.mlingenieria.cl/certificados/estabilidad-2026.pdf',
          description: 'Visado por autoridad marítima',
        });

      expect(addRes.status).toBe(201);
      expect(addRes.body.id).toBeDefined();
      expect(addRes.body.name).toBe('Certificado de Estabilidad DIRECTEMAR PDF');
      const dattId = addRes.body.id;

      // 2. Visible en la orden de operaciones
      const clientOpRes = await request(app)
        .get(`/api/v1/operations/${operation.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(clientOpRes.status).toBe(200);
      const clientDel = clientOpRes.body.deliverables.find((d: any) => d.id === deliverable!.id);
      expect(clientDel.attachments).toBeDefined();
      expect(clientDel.attachments.some((a: any) => a.id === dattId)).toBe(true);

      // 3. Eliminar enlace del entregable
      const delRes = await request(app)
        .delete(`/api/v1/operations/${operation.id}/deliverables/${deliverable!.id}/attachments/${dattId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(delRes.status).toBe(204);

      // 4. Confirmar que ya no está
      const clientOpAfter = await request(app)
        .get(`/api/v1/operations/${operation.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      const clientDelAfter = clientOpAfter.body.deliverables.find((d: any) => d.id === deliverable!.id);
      expect((clientDelAfter.attachments || []).some((a: any) => a.id === dattId)).toBe(false);
    });
  });
});
