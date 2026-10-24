import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';
import { Quotation } from '../../src/modules/types.js';

describe('P2 Acceptance Rules & Feature Verification', () => {
  let adminToken: string;
  let repToken: string;

  beforeAll(async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    adminToken = adminLogin.body.token;

    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'asesor@mlingenieria.cl', password: 'rep123' });
    repToken = repLogin.body.token;
  });

  // =========================================================================
  // ACEPTACIÓN P2.1: La vista "Hoy / Atrasadas" lista las acciones vencidas
  // =========================================================================
  describe('P2.h SEGUIMIENTO & Vista Hoy / Atrasadas', () => {
    it('Criterio 1: La vista "Hoy / Atrasadas" lista las acciones vencidas y filtra no vencidas o cerradas', async () => {
      const state = dbStore.getState();

      // Cotización 1: Vencida ayer
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
      const quoteOverdue = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED');
      expect(quoteOverdue).toBeDefined();

      await request(app)
        .patch(`/api/v1/quotations/${quoteOverdue!.id}/next-action`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nextActionAt: yesterday,
          nextActionNote: 'Llamar a Gerente de Operaciones para resolver dudas de peritaje',
        })
        .expect(200);

      // Cotización 2: Programada para dentro de 10 días (Futura, NO atrasada)
      const futureDate = new Date(Date.now() + 10 * 24 * 3600 * 1000).toISOString();
      const otherQuotes = state.quotations.filter((q) => q.id !== quoteOverdue!.id && (q.status === 'SENT' || q.status === 'VIEWED'));
      const quoteFuture = otherQuotes[0];
      expect(quoteFuture).toBeDefined();

      await request(app)
        .patch(`/api/v1/quotations/${quoteFuture.id}/next-action`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          nextActionAt: futureDate,
          nextActionNote: 'Seguimiento en dos semanas',
        })
        .expect(200);

      // Cotización 3: Aceptada (Cerrada) con fecha pasada -> NO debe aparecer
      const acceptedQuote = state.quotations.find((q) => q.status === 'ACCEPTED');
      if (acceptedQuote) {
        acceptedQuote.nextActionAt = yesterday;
        acceptedQuote.nextActionNote = 'Acción previa a cierre';
      }

      // Consulta de la vista Hoy / Atrasadas
      const res = await request(app)
        .get('/api/v1/quotations/follow-up/due')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const dueList: Quotation[] = res.body;
      expect(Array.isArray(dueList)).toBe(true);

      // Debe incluir la cotización vencida ayer
      const foundOverdue = dueList.find((q) => q.id === quoteOverdue!.id);
      expect(foundOverdue).toBeDefined();
      expect(foundOverdue!.nextActionNote).toBe('Llamar a Gerente de Operaciones para resolver dudas de peritaje');

      // NO debe incluir la cotización con acción en 10 días
      const foundFuture = dueList.find((q) => q.id === quoteFuture.id);
      expect(foundFuture).toBeUndefined();

      // NO debe incluir cotizaciones cerradas (ACCEPTED / REJECTED)
      if (acceptedQuote) {
        const foundAccepted = dueList.find((q) => q.id === acceptedQuote.id);
        expect(foundAccepted).toBeUndefined();
      }
    });

    it('P2.h: Encola recordatorio en la bandeja de salida (Outbox)', async () => {
      const state = dbStore.getState();
      const quote = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED') || state.quotations[0];

      const res = await request(app)
        .post(`/api/v1/quotations/${quote.id}/reminder`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          channel: 'EMAIL',
          note: 'Recordatorio formal de propuesta técnica para carena',
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.outboxMessage).toBeDefined();
      expect(res.body.outboxMessage.quotationId).toBe(quote.id);
      expect(res.body.outboxMessage.subject).toContain('Recordatorio Seguimiento');
    });

    it('P2.h: Rechazo con motivo de pérdida configurable por ADMIN (precio, plazo, competencia, proyecto aplazado, otro)', async () => {
      const state = dbStore.getState();
      // Crear una cotización para rechazo
      const quoteToReject = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED');
      expect(quoteToReject).toBeDefined();

      // Rechazo con motivo válido de la lista
      const resValid = await request(app)
        .post(`/api/v1/quotations/${quoteToReject!.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lossReason: 'proyecto aplazado',
          note: 'Cliente postergó carena para el segundo semestre',
        })
        .expect(200);

      expect(resValid.body.status).toBe('REJECTED');
      expect(resValid.body.lossReason).toBe('proyecto aplazado');
      expect(resValid.body.rejectedAt).toBeDefined();

      // Intentar rechazar con motivo no configurado por el ADMIN debe retornar 422
      const quote2 = state.quotations.find((q) => q.status === 'SENT' || q.status === 'VIEWED');
      if (quote2) {
        const resInvalid = await request(app)
          .post(`/api/v1/quotations/${quote2.id}/reject`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            lossReason: 'motivo_inexistente_no_autorizado',
          });
        expect(resInvalid.status).toBe(422);
      }
    });
  });

  // =========================================================================
  // ACEPTACIÓN P2.2: Los KPIs coinciden con un cálculo manual sobre 5 cotizaciones
  // =========================================================================
  describe('P2.i PIPELINE Y MÉTRICAS (KPIs en servidor)', () => {
    it('Criterio 2: Los KPIs coinciden con un cálculo manual exacto sobre 5 cotizaciones', async () => {
      const state = dbStore.getState();

      // Guardamos respaldo temporal de las cotizaciones
      const originalQuotes = [...state.quotations];

      // Definimos exactamente 5 cotizaciones con valores conocidos
      // Cotización 1: ACCEPTED, Net: 1.000.000, Cost: 600.000 (Margen: 40%),
      // Ciclo de venta: 2 días (enviada 2026-03-01, aceptada 2026-03-03), primera vista: 24 horas (2026-03-02)
      const q1 = {
        id: 'kpi-test-q1',
        quotationNumber: 'COT-TEST-001',
        revision: 1,
        customerId: 'cust-01',
        customerBusinessName: 'Naviera Test',
        contactId: 'ct-01',
        salesRepId: 'usr-admin-01',
        salesRepName: 'Administrador Principal',
        status: 'ACCEPTED',
        lines: [{
          id: 'l1',
          catalogItemId: 'serv-01',
          type: 'SERVICE',
          name: 'Servicio A',
          unit: 'GLB',
          cost: 600000,
          price: 1000000,
          quantity: 1,
          discountPct: 0,
          subtotal: 1000000,
          costTotal: 600000,
          marginPct: 40.0,
        }],
        netSubtotal: 1000000,
        taxAmount: 190000,
        grandTotal: 1190000,
        total: 1190000,
        totalCost: 600000,
        marginPct: 40.0,
        minMarginPctApplied: 28.0,
        statusHistory: [],
        createdAt: '2026-03-01T10:00:00Z',
        sentAt: '2026-03-01T10:00:00Z',
        firstViewedAt: '2026-03-02T10:00:00Z', // 24 hrs después de envío
        acceptedAt: '2026-03-03T10:00:00Z', // 2 días después de envío
      } as unknown as Quotation;

      // Cotización 2: ACCEPTED, Net: 2.000.000, Cost: 1.200.000 (Margen: 40%),
      // Ciclo de venta: 4 días (enviada 2026-03-01, aceptada 2026-03-05), primera vista: 24 horas (2026-03-02)
      const q2 = {
        id: 'kpi-test-q2',
        quotationNumber: 'COT-TEST-002',
        revision: 1,
        customerId: 'cust-01',
        customerBusinessName: 'Naviera Test',
        contactId: 'ct-01',
        salesRepId: 'usr-admin-01',
        salesRepName: 'Administrador Principal',
        status: 'ACCEPTED',
        lines: [{
          id: 'l2',
          catalogItemId: 'serv-01',
          type: 'SERVICE',
          name: 'Servicio B',
          unit: 'GLB',
          cost: 1200000,
          price: 2000000,
          quantity: 1,
          discountPct: 0,
          subtotal: 2000000,
          costTotal: 1200000,
          marginPct: 40.0,
        }],
        netSubtotal: 2000000,
        taxAmount: 380000,
        grandTotal: 2380000,
        total: 2380000,
        totalCost: 1200000,
        marginPct: 40.0,
        minMarginPctApplied: 28.0,
        statusHistory: [],
        createdAt: '2026-03-01T10:00:00Z',
        sentAt: '2026-03-01T10:00:00Z',
        firstViewedAt: '2026-03-02T10:00:00Z', // 24 hrs después de envío
        acceptedAt: '2026-03-05T10:00:00Z', // 4 días después de envío
      } as unknown as Quotation;

      // Cotización 3: REJECTED, Net: 1.500.000, Cost: 900.000,
      // Ciclo de venta: 3 días (enviada 2026-03-01, rechazada 2026-03-04), motivo: precio
      const q3 = {
        id: 'kpi-test-q3',
        quotationNumber: 'COT-TEST-003',
        revision: 1,
        customerId: 'cust-01',
        customerBusinessName: 'Naviera Test',
        contactId: 'ct-01',
        salesRepId: 'usr-admin-01',
        salesRepName: 'Administrador Principal',
        status: 'REJECTED',
        lines: [{
          id: 'l3',
          catalogItemId: 'serv-01',
          type: 'SERVICE',
          name: 'Servicio C',
          unit: 'GLB',
          cost: 900000,
          price: 1500000,
          quantity: 1,
          discountPct: 0,
          subtotal: 1500000,
          costTotal: 900000,
          marginPct: 40.0,
        }],
        netSubtotal: 1500000,
        taxAmount: 285000,
        grandTotal: 1785000,
        total: 1785000,
        totalCost: 900000,
        marginPct: 40.0,
        minMarginPctApplied: 28.0,
        statusHistory: [],
        createdAt: '2026-03-01T10:00:00Z',
        sentAt: '2026-03-01T10:00:00Z',
        rejectedAt: '2026-03-04T10:00:00Z', // 3 días después de envío
        lossReason: 'precio',
      } as unknown as Quotation;

      // Cotización 4: SENT (En pipeline), Net: 1.000.000, Cost: 600.000, sentAt: 2026-03-01
      const q4 = {
        id: 'kpi-test-q4',
        quotationNumber: 'COT-TEST-004',
        revision: 1,
        customerId: 'cust-01',
        customerBusinessName: 'Naviera Test',
        contactId: 'ct-01',
        salesRepId: 'usr-admin-01',
        salesRepName: 'Administrador Principal',
        status: 'SENT',
        lines: [{
          id: 'l4',
          catalogItemId: 'serv-01',
          type: 'SERVICE',
          name: 'Servicio D',
          unit: 'GLB',
          cost: 600000,
          price: 1000000,
          quantity: 1,
          discountPct: 0,
          subtotal: 1000000,
          costTotal: 600000,
          marginPct: 40.0,
        }],
        netSubtotal: 1000000,
        taxAmount: 190000,
        grandTotal: 1190000,
        total: 1190000,
        totalCost: 600000,
        marginPct: 40.0,
        minMarginPctApplied: 28.0,
        statusHistory: [],
        createdAt: '2026-03-01T10:00:00Z',
        sentAt: '2026-03-01T10:00:00Z',
      } as unknown as Quotation;

      // Cotización 5: DRAFT (En pipeline), Net: 500.000, Cost: 300.000
      const q5 = {
        id: 'kpi-test-q5',
        quotationNumber: 'COT-TEST-005',
        revision: 1,
        customerId: 'cust-01',
        customerBusinessName: 'Naviera Test',
        contactId: 'ct-01',
        salesRepId: 'usr-admin-01',
        salesRepName: 'Administrador Principal',
        status: 'DRAFT',
        lines: [{
          id: 'l5',
          catalogItemId: 'serv-01',
          type: 'SERVICE',
          name: 'Servicio E',
          unit: 'GLB',
          cost: 300000,
          price: 500000,
          quantity: 1,
          discountPct: 0,
          subtotal: 500000,
          costTotal: 300000,
          marginPct: 40.0,
        }],
        netSubtotal: 500000,
        taxAmount: 95000,
        grandTotal: 595000,
        total: 595000,
        totalCost: 300000,
        marginPct: 40.0,
        minMarginPctApplied: 28.0,
        statusHistory: [],
        createdAt: '2026-03-01T10:00:00Z',
      } as unknown as Quotation;

      // Asignamos exactamente estas 5 cotizaciones
      state.quotations = [q1, q2, q3, q4, q5];
      state.company.minMarginPct = 28.0;
      state.company.pipelineProbabilities = {
        DRAFT: 10,
        SENT: 30,
        VIEWED: 50,
        CHANGES_REQUESTED: 40,
        ACCEPTED: 100,
        REJECTED: 0,
        EXPIRED: 0,
      };

      try {
        const res = await request(app)
          .get('/api/v1/dashboard/pipeline-metrics')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const m = res.body;

        // 1. Tasa de cierre: Aceptadas = 2, Decididas (Aceptadas + Rechazadas) = 2 + 1 = 3 -> 2/3 = 66.7%
        expect(m.closeRate.acceptedCount).toBe(2);
        expect(m.closeRate.decidedCount).toBe(3);
        expect(m.closeRate.value).toBe(66.7);
        expect(m.closeRate.definition).toContain('Aceptadas / (Aceptadas + Rechazadas)');

        // 2. Ciclo de venta: q1 (2 días) + q2 (4 días) + q3 (3 días) = 9 días / 3 = 3.0 días
        expect(m.salesCycle.decidedCount).toBe(3);
        expect(m.salesCycle.avgDays).toBe(3.0);
        expect(m.salesCycle.definition).toBeDefined();

        // 3. Tiempo hasta primera vista: q1 (24 hrs) + q2 (24 hrs) = 48 / 2 = 24.0 horas (1.0 día)
        expect(m.timeToFirstView.viewedCount).toBe(2);
        expect(m.timeToFirstView.avgHours).toBe(24.0);
        expect(m.timeToFirstView.avgDays).toBe(1.0);
        expect(m.timeToFirstView.definition).toBeDefined();

        // 4. Pipeline ponderado:
        // Activas en pipeline: q4 (SENT: Net 1.000.000 * 30% = 300.000), q5 (DRAFT: Net 500.000 * 10% = 50.000)
        // Ponderado = 300.000 + 50.000 = 350.000
        expect(m.weightedPipeline.activeQuotesCount).toBe(2);
        expect(m.weightedPipeline.amount).toBe(350000);
        expect(m.weightedPipeline.totalPipelineNet).toBe(1500000);
        expect(m.weightedPipeline.definition).toBeDefined();

        // 5. Margen aceptado frente al mínimo:
        // Aceptadas: q1 (Net 1.000.000, Cost 600.000) + q2 (Net 2.000.000, Cost 1.200.000)
        // Total Net = 3.000.000, Total Cost = 1.800.000, Ganancia = 1.200.000 -> 1.200.000 / 3.000.000 = 40.0%
        // Minimo corporativo = 28.0% -> Delta = +12.0%
        expect(m.acceptedMargin.avgMarginPct).toBe(40.0);
        expect(m.acceptedMargin.minMarginPct).toBe(28.0);
        expect(m.acceptedMargin.deltaPct).toBe(12.0);
        expect(m.acceptedMargin.definition).toBeDefined();

        // 6. Ganadas / Perdidas por categoría y por asesor
        expect(Array.isArray(m.wonLostByCategory.items)).toBe(true);
        expect(Array.isArray(m.wonLostBySalesRep.items)).toBe(true);
        expect(m.wonLostByCategory.definition).toBeDefined();
        expect(m.wonLostBySalesRep.definition).toBeDefined();
      } finally {
        // Restaurar cotizaciones originales
        state.quotations = originalQuotes;
      }
    });
  });

  // =========================================================================
  // ACEPTACIÓN P2.3: El progreso de una orden cambia al completar un hito
  // =========================================================================
  describe('P2.k OPERACIONES POR HITOS', () => {
    it('Criterio 3: El progreso de una orden cambia estrictamente al completar un hito y elimina control libre', async () => {
      const state = dbStore.getState();

      // Creamos una orden de trabajo con 4 hitos pendientes
      const quote = state.quotations.find((q) => q.status === 'ACCEPTED') || state.quotations[0];
      const createOpRes = await request(app)
        .post('/api/v1/operations')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          quotationId: quote.id,
          type: 'SERVICE_EXECUTION',
          title: 'Prueba de Hitos Operacionales para Peritaje',
          scheduledDate: '2026-10-15',
          milestones: [
            { name: 'Hito 1: Inspección visual de casco', date: '2026-10-15', status: 'PENDING' },
            { name: 'Hito 2: Medición ultrasónica de espesores', date: '2026-10-16', status: 'PENDING' },
            { name: 'Hito 3: Cálculo estructural y tablas DIRECTEMAR', date: '2026-10-17', status: 'PENDING' },
            { name: 'Hito 4: Entrega de informe final visado', date: '2026-10-18', status: 'PENDING' },
          ],
          deliverables: [
            { name: 'Plano de distribución de espesores DWG', status: 'PENDING' },
            { name: 'Memoria técnica visada por Ingeniero Naval PDF', status: 'PENDING' },
          ],
        })
        .expect(201);

      const op = createOpRes.body;
      expect(op.progressPct).toBe(0); // 0 de 4 hitos
      expect(op.milestones.length).toBe(4);
      expect(op.deliverables.length).toBe(2);

      const ms1 = op.milestones[0];
      const ms2 = op.milestones[1];
      const ms3 = op.milestones[2];
      const ms4 = op.milestones[3];

      // Completar Hito 1: Progreso debe pasar a 25% (1/4)
      const resMs1 = await request(app)
        .patch(`/api/v1/operations/${op.id}/milestones/${ms1.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(resMs1.body.progressPct).toBe(25);
      expect(resMs1.body.status).toBe('IN_PROGRESS');

      // Completar Hito 2: Progreso debe pasar a 50% (2/4)
      const resMs2 = await request(app)
        .patch(`/api/v1/operations/${op.id}/milestones/${ms2.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(resMs2.body.progressPct).toBe(50);

      // Completar Hito 3: Progreso debe pasar a 75% (3/4)
      const resMs3 = await request(app)
        .patch(`/api/v1/operations/${op.id}/milestones/${ms3.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(resMs3.body.progressPct).toBe(75);

      // Completar Hito 4: Progreso debe pasar a 100% y orden COMPLETED automáticamente
      const resMs4 = await request(app)
        .patch(`/api/v1/operations/${op.id}/milestones/${ms4.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'COMPLETED' })
        .expect(200);

      expect(resMs4.body.progressPct).toBe(100);
      expect(resMs4.body.status).toBe('COMPLETED');
    });
  });

  // =========================================================================
  // ACEPTACIÓN P2.4: Imagen de prueba genera líneas solo con ítems del catálogo
  // =========================================================================
  describe('P2.l IA APLICADA ("Del documento al borrador")', () => {
    it('Criterio 4: El análisis de solicitud propone líneas contrastadas con catálogo sin inventar precios', async () => {
      const state = dbStore.getState();
      const catalog = state.catalogItems.filter((i) => i.active !== false);

      // Simulación de imagen que solicita ítems del catálogo y un ítem no catalogado
      const sampleItem = catalog[0];
      const res = await request(app)
        .post('/api/v1/gemini/analyze-request-image')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          simulatedText: `Solicitud técnica: 2 unidades de "${sampleItem.name}", y 1 unidad de "Servicio desconocido no existente en catálogo naval xyz"`,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.suggestedLines)).toBe(true);
      expect(res.body.suggestedLines.length).toBeGreaterThanOrEqual(1);

      // 1. Líneas coincidentes tienen los precios y costos del catálogo exactos
      const matchedLine = res.body.suggestedLines.find((l: any) => l.matched === true);
      expect(matchedLine).toBeDefined();
      expect(matchedLine.catalogItemId).toBe(sampleItem.id);
      expect(matchedLine.price).toBe(sampleItem.listPrice);
      expect(matchedLine.cost).toBe(sampleItem.unitCost);

      // 2. Líneas no coincidentes: NUNCA inventa precios ni costos (cost: 0, price: 0, 'Por cotizar')
      const unmatchedLine = res.body.suggestedLines.find((l: any) => l.matched === false);
      if (unmatchedLine) {
        expect(unmatchedLine.price).toBe(0);
        expect(unmatchedLine.cost).toBe(0);
        expect(unmatchedLine.skuOrCode).toBe('POR-COTIZAR');
      }

      // 3. La IA redacta la carta de presentación a partir de las líneas
      expect(typeof res.body.draftPresentationText).toBe('string');
      expect(res.body.draftPresentationText.length).toBeGreaterThan(30);
      expect(res.body.draftPresentationText).toContain('M&L Ingeniería Naval');
    });
  });

  // =========================================================================
  // P2.j PLANTILLAS Y KITS
  // =========================================================================
  describe('P2.j Plantillas y Kits Compuestos', () => {
    it('P2.j: Los kits compuestos suman el costo de sus ítems y calculan el precio sugerido', async () => {
      const state = dbStore.getState();
      const item1 = state.catalogItems.find((i) => i.type === 'PRODUCT' && i.unitCost > 0) || state.catalogItems[0];
      const item2 = state.catalogItems.find((i) => i.id !== item1.id && i.unitCost > 0) || state.catalogItems[1];

      const expectedCost = (item1.unitCost * 2) + (item2.unitCost * 3);
      const minMargin = state.company.minMarginPct || 28.0;
      const expectedSuggestedPrice = Math.ceil(expectedCost / (1 - minMargin / 100));

      const res = await request(app)
        .post('/api/v1/catalog-items')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'SERVICE',
          name: 'Kit Compuesto de Mantención Propulsora',
          categoryId: item1.categoryId || 'cat-01',
          isKit: true,
          kitItems: [
            { catalogItemId: item1.id, quantity: 2 },
            { catalogItemId: item2.id, quantity: 3 },
          ],
        })
        .expect(201);

      expect(res.body.isKit).toBe(true);
      expect(res.body.unitCost).toBe(expectedCost);
      expect(res.body.listPrice).toBeGreaterThanOrEqual(expectedSuggestedPrice);
    });

    it('P2.j: Plantillas de cotización con líneas y términos por categoría de servicio', async () => {
      const state = dbStore.getState();
      const item = state.catalogItems[0];

      const resCreate = await request(app)
        .post('/api/v1/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Plantilla Peritaje Estructural Buque Menor',
          categoryId: item.categoryId || 'cat-01',
          description: 'Plantilla estándar para carena e inspección',
          lines: [
            { catalogItemId: item.id, quantity: 1, discountPct: 0 },
          ],
          terms: 'Condiciones técnicas estándar para peritajes DIRECTEMAR.',
          presentationText: 'Estimado Armador, presentamos propuesta...',
        })
        .expect(201);

      expect(resCreate.body.id).toBeDefined();
      expect(resCreate.body.name).toBe('Plantilla Peritaje Estructural Buque Menor');

      const resList = await request(app)
        .get('/api/v1/templates')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(resList.body)).toBe(true);
      const found = resList.body.find((t: any) => t.id === resCreate.body.id);
      expect(found).toBeDefined();
    });
  });
});
