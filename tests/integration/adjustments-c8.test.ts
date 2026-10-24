import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';

describe('Ajustes, comentarios y sanitización del portal/público (C1 y C8)', () => {
  it('1. POST /public/quotations/:token/request-adjustment valida campos requeridos', async () => {
    const state = dbStore.getState();
    const quote = state.quotations.find((q) => q.publicToken);
    expect(quote).toBeDefined();

    const res = await request(app)
      .post(`/api/v1/public/quotations/${quote!.publicToken}/request-adjustment`)
      .send({ message: '' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Mensaje requerido');
  });

  it('2. Solicitud pública de ajuste registra en historial, genera outbox y devuelve DTO sanitizado', async () => {
    const state = dbStore.getState();
    const quote = state.quotations.find((q) => q.publicToken);
    const initialHistLength = quote!.statusHistory.length;
    const initialOutboxLength = state.outbox.length;

    const res = await request(app)
      .post(`/api/v1/public/quotations/${quote!.publicToken}/request-adjustment`)
      .send({ message: 'Favor recalcular plazo de entrega a 10 días y considerar pintura epóxica.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.quotation).toBeDefined();

    // Sanitización estricta: nada de costos ni márgenes
    const jsonStr = JSON.stringify(res.body.quotation);
    expect(jsonStr.toLowerCase()).not.toContain('"cost"');
    expect(jsonStr.toLowerCase()).not.toContain('"profit"');

    // Historial actualizado
    expect(quote!.statusHistory.length).toBe(initialHistLength + 1);
    const lastEntry = quote!.statusHistory[quote!.statusHistory.length - 1];
    expect(lastEntry.comment).toContain('recalcular plazo de entrega');
    expect(lastEntry.actorRole).toBe('CUSTOMER_CONTACT');

    // Outbox actualizado con notificación al comercial
    expect(state.outbox.length).toBeGreaterThan(initialOutboxLength);
    const latestOutbox = state.outbox[0];
    expect(latestOutbox.subject).toContain('Solicitud de ajuste');
  });

  it('3. POST /portal/quotations/:id/request-adjustment exige autenticación de cliente', async () => {
    const state = dbStore.getState();
    const quote = state.quotations[0];

    const unauthRes = await request(app)
      .post(`/api/v1/portal/quotations/${quote.id}/request-adjustment`)
      .send({ message: 'Modificación' });

    expect(unauthRes.status).toBe(401);
  });

  it('4. POST /portal/quotations/:id/request-adjustment no permite modificar cotizaciones ajenas', async () => {
    const state = dbStore.getState();
    // Encuentra una cotización que NO sea de cust-01 (ej. cust-02)
    const otherCustQuote = state.quotations.find((q) => q.customerId !== 'cust-01');
    expect(otherCustQuote).toBeDefined();

    // magic_demo_token_mbarrientos_2026 pertenece a cust-01 (Marcelo Barrientos)
    const res = await request(app)
      .post(`/api/v1/portal/quotations/${otherCustQuote!.id}/request-adjustment`)
      .set('Authorization', 'Bearer magic_demo_token_mbarrientos_2026')
      .send({ message: 'Intento de ajuste en cliente ajeno' });

    expect(res.status).toBe(404);
  });

  it('5. El timeline del portal no filtra comentarios con márgenes ni notas internas', async () => {
    const state = dbStore.getState();
    const cust1Quote = state.quotations.find((q) => q.customerId === 'cust-01')!;

    // Agregar un comentario interno con margen
    cust1Quote.statusHistory.push({
      id: 'test-internal-01',
      fromStatus: 'DRAFT',
      toStatus: 'SENT',
      actor: 'Victoria Villegas (Admin)',
      actorRole: 'ADMIN',
      comment: 'Revisión interna confidencial: margen aplicado 35% y costo secreto 1200000',
      timestamp: new Date().toISOString(),
    });

    const res = await request(app)
      .get('/api/v1/portal/timeline')
      .set('Authorization', 'Bearer magic_demo_token_mbarrientos_2026');

    expect(res.status).toBe(200);
    const bodyStr = JSON.stringify(res.body);
    expect(bodyStr.toLowerCase()).not.toContain('confidencial');
    expect(bodyStr.toLowerCase()).not.toContain('costo secreto');
  });
});
