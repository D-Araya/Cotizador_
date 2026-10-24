import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';
import { computeTotals } from '../../src/shared-kernel/pricing/computeTotals.js';

describe('P1 Acceptance Rules Verification', () => {
  let staffToken: string;

  beforeAll(async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    staffToken = loginRes.body.token;
  });

  // ----------------------------------------------------
  // P1.a REVISIONES: Crear revisión de una enviada no altera la anterior
  // ----------------------------------------------------
  it('P1.a: Crear revisión de una cotización enviada no altera la anterior y asigna mismo quotationGroupId y revision correlativa', async () => {
    const state = dbStore.getState();
    const sourceQuote = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED') || state.quotations[0];
    expect(sourceQuote).toBeDefined();

    // Snapshot of source quotation
    const originalNumber = sourceQuote.quotationNumber;
    const originalStatus = sourceQuote.status;
    const originalLinesCount = sourceQuote.lines.length;
    const originalTotal = sourceQuote.grandTotal;

    // Call POST /api/v1/quotations/:id/revisions
    const res = await request(app)
      .post(`/api/v1/quotations/${sourceQuote.id}/revisions`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({});

    expect(res.status).toBe(201);
    const newRevision = res.body;

    // The new revision is DRAFT with incremented revision number and suffix -RN
    expect(newRevision.status).toBe('DRAFT');
    expect(newRevision.revision).toBe((sourceQuote.revision || 1) + 1);
    expect(newRevision.quotationNumber).toContain(`-R${newRevision.revision}`);
    expect(newRevision.quotationGroupId).toBe(sourceQuote.quotationGroupId || sourceQuote.id);
    expect(newRevision.id).not.toBe(sourceQuote.id);

    // CRITICAL: The source quotation was NOT altered in status, number, lines, or totals
    const sourceAfter = state.quotations.find((q) => q.id === sourceQuote.id);
    expect(sourceAfter!.quotationNumber).toBe(originalNumber);
    expect(sourceAfter!.status).toBe(originalStatus);
    expect(sourceAfter!.lines.length).toBe(originalLinesCount);
    expect(sourceAfter!.grandTotal).toBe(originalTotal);
    expect(sourceAfter!.supersededByQuotationId).toBe(newRevision.id);
  });

  it('P1.a: GET /api/v1/quotations/:id/revisions devuelve el historial completo del grupo', async () => {
    const state = dbStore.getState();
    const quote = state.quotations[0];

    const res = await request(app)
      .get(`/api/v1/quotations/${quote.id}/revisions`)
      .set('Authorization', `Bearer ${staffToken}`);

    expect(res.status).toBe(200);
    expect(res.body.quotationGroupId).toBeDefined();
    expect(Array.isArray(res.body.revisions)).toBe(true);
    expect(res.body.revisions.length).toBeGreaterThanOrEqual(1);
  });

  // ----------------------------------------------------
  // P1.b VIGENCIA: Una cotización vencida no se puede aceptar
  // ----------------------------------------------------
  it('P1.b: Una cotización cuya fecha de vigencia expiró pasa a EXPIRED y rechaza la aceptación', async () => {
    const state = dbStore.getState();
    const expiredQuote = state.quotations.find((q) => q.publicToken);
    expect(expiredQuote).toBeDefined();

    // Simular que venció hace 10 días
    expiredQuote!.status = 'SENT';
    expiredQuote!.sentAt = new Date(Date.now() - 30 * 86400000).toISOString();
    expiredQuote!.validityDays = 15;
    expiredQuote!.validUntil = new Date(Date.now() - 15 * 86400000).toISOString();

    // Intentar aceptar por enlace público
    const res = await request(app)
      .post(`/api/v1/public/quotations/${expiredQuote!.publicToken}/accept`)
      .send({
        signerName: 'Roberto Gómez',
        signerPosition: 'Gerente General',
        termsAccepted: true,
      });

    expect(res.status).toBe(400);
    expect(res.body.title).toContain('vencida');
    expect(expiredQuote!.status).toBe('EXPIRED');
  });

  // ----------------------------------------------------
  // P1.c SOLICITAR AJUSTE: Cambia el estado a CHANGES_REQUESTED y notifica al asesor
  // ----------------------------------------------------
  it('P1.c: Solicitar ajuste cambia el estado a CHANGES_REQUESTED y avisa al asesor por Outbox', async () => {
    const state = dbStore.getState();
    // Preparar una cotización activa
    const activeQuote = state.quotations.find((q) => q.publicToken && q.status !== 'ACCEPTED');
    expect(activeQuote).toBeDefined();
    activeQuote!.status = 'SENT';
    activeQuote!.sentAt = new Date().toISOString();
    activeQuote!.validUntil = new Date(Date.now() + 15 * 86400000).toISOString();

    const initialOutboxCount = state.outbox.length;

    const res = await request(app)
      .post(`/api/v1/public/quotations/${activeQuote!.publicToken}/request-adjustment`)
      .send({
        message: 'Por favor recalcular considerando un anticipo de 30% en vez de 50%.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(activeQuote!.status).toBe('CHANGES_REQUESTED');

    // Comprobar outbox
    expect(state.outbox.length).toBeGreaterThan(initialOutboxCount);
    const notification = state.outbox.find((o) => o.quotationId === activeQuote!.id && o.subject?.includes('Solicitud de ajuste'));
    expect(notification).toBeDefined();
    expect(notification!.body).toContain('anticipo de 30%');
  });

  // ----------------------------------------------------
  // P1.d ACEPTACIÓN CON EVIDENCIA
  // ----------------------------------------------------
  it('P1.d: La aceptación pública guarda nombre, cargo, fecha, IP, user-agent hash y hash de evidencia legal', async () => {
    const state = dbStore.getState();
    const testQuote = state.quotations.find((q) => q.publicToken);
    testQuote!.status = 'SENT';
    testQuote!.sentAt = new Date().toISOString();
    testQuote!.validUntil = new Date(Date.now() + 15 * 86400000).toISOString();

    const res = await request(app)
      .post(`/api/v1/public/quotations/${testQuote!.publicToken}/accept`)
      .set('User-Agent', 'Mozilla/5.0 TestBrowser/1.0')
      .set('X-Forwarded-For', '190.22.45.100')
      .send({
        signerName: 'Camila Valenzuela',
        signerPosition: 'Directora de Operaciones',
        termsAccepted: true,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(testQuote!.status).toBe('ACCEPTED');
    expect(testQuote!.clientSignerName).toBe('Camila Valenzuela');
    expect(testQuote!.clientSignerPosition).toBe('Directora de Operaciones');
    expect(testQuote!.clientIp).toBe('190.22.45.100');
    expect(testQuote!.clientUserAgentHash).toBeDefined();
    expect(testQuote!.clientUserAgentHash!.length).toBe(64); // SHA-256
    expect(testQuote!.acceptanceHash).toBeDefined();
    expect(testQuote!.acceptanceHash!.length).toBe(64); // SHA-256

    // Genera automáticamente documento de cobro respectivo
    const invoice = state.invoices.find((i) => i.quotationId === testQuote!.id);
    expect(invoice).toBeDefined();
    expect(invoice!.invoiceNumber).toMatch(/^DC-\d+/);
  });

  it('P1.d: Aceptación offline por el personal exige N.º de Orden de Compra y comentario, y bloquea cambio manual', async () => {
    const state = dbStore.getState();
    const quote = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED');
    expect(quote).toBeDefined();

    // 1. Bloqueo de cambio manual arbitrario a ACCEPTED
    const manualBlockRes = await request(app)
      .post(`/api/v1/quotations/${quote!.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        status: 'ACCEPTED',
        note: 'Cambio manual prohibido',
      });
    expect(manualBlockRes.status).toBe(403);

    // 2. Aceptación offline formal con Orden de Compra y comentario
    const offlineRes = await request(app)
      .post(`/api/v1/quotations/${quote!.id}/accept-offline`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        purchaseOrderNumber: 'OC-2026-CHILE-9988',
        offlineNote: 'Recibida copia timbrada por gerencia de adquisiciones.',
      });

    expect(offlineRes.status).toBe(200);
    expect(offlineRes.body.success).toBe(true);
    expect(quote!.status).toBe('ACCEPTED');
    expect(quote!.acceptedOffline).toBe(true);
    expect(quote!.offlinePurchaseOrderNumber).toBe('OC-2026-CHILE-9988');
    expect(quote!.offlineNote).toContain('Recibida copia timbrada');
  });

  // ----------------------------------------------------
  // P1.e COBRO POR HITOS
  // ----------------------------------------------------
  it('P1.e: Un cobro 50/50 muestra dos hitos y pasa por PARTIAL antes de PAID con abonos parciales', async () => {
    const state = dbStore.getState();
    const acceptedQuote = state.quotations.find((q) => q.status === 'ACCEPTED');
    expect(acceptedQuote).toBeDefined();

    // Obtener o crear la factura para la cotización
    let invoice = state.invoices.find((i) => i.quotationId === acceptedQuote!.id);
    if (!invoice) {
      const invRes = await request(app)
        .post('/api/v1/invoices')
        .set('Authorization', `Bearer ${staffToken}`)
        .send({
          quotationId: acceptedQuote!.id,
          paymentTerms: '50% anticipo, 50% contra entrega',
        });
      invoice = invRes.body;
    }

    expect(invoice!.paymentSchedule).toBeDefined();
    expect(invoice!.paymentSchedule!.length).toBe(2);
    expect(invoice!.paymentSchedule![0].percentage).toBe(50);
    expect(invoice!.paymentSchedule![1].percentage).toBe(50);
    expect(invoice!.status).toBe('PENDING');

    const halfAmount = invoice!.paymentSchedule![0].amount;

    // 1. Registrar primer abono correspondiente al primer hito (50%)
    const pay1Res = await request(app)
      .post(`/api/v1/invoices/${invoice!.id}/payments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: halfAmount,
        paymentMethod: 'TRANSFERENCIA_BANCARIA',
        reference: 'Transf-BancoChile-001',
        paymentDate: '2026-10-06',
        notes: 'Pago Hito 1 Anticipo',
      });

    expect(pay1Res.status).toBe(201);
    const updatedInvoice1 = pay1Res.body.invoice;

    // Estado debe ser PARTIAL (no PAID aún)
    expect(updatedInvoice1.status).toBe('PARTIAL');
    expect(updatedInvoice1.paidAmount).toBe(halfAmount);
    expect(updatedInvoice1.balance).toBe(invoice!.total - halfAmount);
    expect(updatedInvoice1.paymentSchedule[0].status).toBe('PAID');
    expect(updatedInvoice1.paymentSchedule[1].status).not.toBe('PAID');

    // 2. Registrar segundo abono que completa el saldo total
    const pay2Res = await request(app)
      .post(`/api/v1/invoices/${invoice!.id}/payments`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        amount: updatedInvoice1.balance,
        paymentMethod: 'WEBPAY',
        reference: 'Transbank-TBK-9922',
        paymentDate: '2026-10-06',
        notes: 'Pago Hito 2 Saldo Contra Entrega',
      });

    expect(pay2Res.status).toBe(201);
    const updatedInvoice2 = pay2Res.body.invoice;

    // Ahora sí el documento está PAID y ambos hitos están pagados
    expect(updatedInvoice2.status).toBe('PAID');
    expect(updatedInvoice2.balance).toBe(0);
    expect(updatedInvoice2.paymentSchedule[1].status).toBe('PAID');
  });

  // ----------------------------------------------------
  // P1.f DESCUENTOS Y CONTROL DE MARGEN
  // ----------------------------------------------------
  it('P1.f: Un descuento que baja el margen del mínimo bloquea el avance y calcula el faltante (shortfall)', () => {
    // Línea con costo 100 y precio 133.34 -> margen base ~ 25%
    const lines = [
      {
        cost: 100,
        price: 134,
        quantity: 1,
        discountPct: 0,
      },
    ];

    // Con margen mínimo de 25% y sin descuento cumple
    const baseTotals = computeTotals(lines, 25, 19, 0);
    expect(baseTotals.meetsMinimum).toBe(true);
    expect(baseTotals.shortfall).toBe(0);

    // Con un descuento global de 10%, el margen efectivo baja a ~16.6% (< 25%)
    const discountedTotals = computeTotals(lines, 25, 19, 10);
    expect(discountedTotals.meetsMinimum).toBe(false);
    expect(discountedTotals.shortfall).toBeGreaterThan(0);
    // El faltante indica con exactitud cuánto falta en la venta para alcanzar el 25%
    expect(discountedTotals.shortfall).toBe(13); // 134 * 0.9 = 120.6 -> requerido 133.34 -> faltan 13
  });

  it('P1.f: PUT /api/v1/quotations/:id/lines rechaza con 422 si el margen cae bajo el mínimo corporativo', async () => {
    const state = dbStore.getState();
    const draftQuote = state.quotations.find((q) => q.status === 'DRAFT') || state.quotations[0];
    draftQuote.status = 'DRAFT';
    const catItem = state.catalogItems[0];

    // Forzar margen bajo usando precio insuficiente o alto descuento
    const res = await request(app)
      .put(`/api/v1/quotations/${draftQuote.id}/lines`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({
        lines: [
          {
            catalogItemId: catItem.id,
            quantity: 1,
            price: catItem.unitCost, // margen 0%
          },
        ],
        discountPct: 0,
      });

    expect(res.status).toBe(422);
    expect(res.body.title).toBe('Margen insuficiente');
    expect(res.body.detail).toContain('inferior al mínimo corporativo');
  });

  // ----------------------------------------------------
  // P1.g IMPRESIÓN / PDF
  // ----------------------------------------------------
  it('P1.g: La vista pública contiene la estructura semántica completa para A4 sin costos al cliente', async () => {
    const state = dbStore.getState();
    const quote = state.quotations.find((q) => q.publicToken);

    const res = await request(app).get(`/api/v1/public/quotations/${quote!.publicToken}`);
    expect(res.status).toBe(200);

    const data = res.body;
    expect(data.company.name).toBeDefined();
    expect(data.company.rut).toBeDefined();
    expect(data.quotation.quotationNumber).toBeDefined();
    expect(data.quotation.validUntil).toBeDefined();
    expect(data.quotation.lines).toBeDefined();
    expect(data.quotation.grandTotal).toBeDefined();
    expect(data.quotation.terms).toBeDefined();

    // Seguridad de precios: ningún costo expuesto al cliente
    const jsonStr = JSON.stringify(data);
    expect(jsonStr).not.toContain('"cost"');
    expect(jsonStr).not.toContain('"totalCost"');
    expect(jsonStr).not.toContain('"marginPct"');
  });
});
