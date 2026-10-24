import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';

describe('Quotation Wizard Steps & Autosave Integration (PATCH /quotations/:id & PUT /quotations/:id/extra-costs)', () => {
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

  it('Paso 1: Permite crear un borrador de cotización', async () => {
    const state = dbStore.getState();
    const customer = state.customers[0];
    const contact = state.contacts.find((c) => c.customerId === customer.id) || state.contacts[0];

    const res = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        contactId: contact.id,
        currency: 'CLP',
      });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.quotationNumber).toMatch(/^COT-\d{6}$/);
  });

  it('Autoguardado y Paso 4 (PATCH /api/v1/quotations/:id): Actualiza notas, textos, términos y validez', async () => {
    const state = dbStore.getState();
    const customer = state.customers[0];
    const contact = state.contacts.find((c) => c.customerId === customer.id) || state.contacts[0];

    // Crear cotización
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        contactId: contact.id,
        currency: 'CLP',
      });
    const quoteId = createRes.body.id;

    // PATCH autoguardado del borrador
    const patchRes = await request(app)
      .patch(`/api/v1/quotations/${quoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        presentationText: 'Nueva carta de presentación técnica actualizada.',
        notes: 'Notas actualizadas para pruebas en astillero.',
        terms: 'Condiciones de pago especiales a 30 días.',
        validityDays: 20,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.id).toBe(quoteId);
    expect(patchRes.body.presentationText).toBe('Nueva carta de presentación técnica actualizada.');
    expect(patchRes.body.notes).toBe('Notas actualizadas para pruebas en astillero.');
    expect(patchRes.body.terms).toBe('Condiciones de pago especiales a 30 días.');
    expect(patchRes.body.validityDays).toBe(20);

    // Verificar persistencia en store
    const inStore = dbStore.getState().quotations.find((q) => q.id === quoteId);
    expect(inStore?.presentationText).toBe('Nueva carta de presentación técnica actualizada.');
    expect(inStore?.validityDays).toBe(20);
  });

  it('Paso 3 (PUT /api/v1/quotations/:id/extra-costs): Guarda costos adicionales informativos', async () => {
    const state = dbStore.getState();
    const customer = state.customers[0];
    const contact = state.contacts.find((c) => c.customerId === customer.id) || state.contacts[0];

    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        contactId: contact.id,
        currency: 'CLP',
      });
    const quoteId = createRes.body.id;

    const extraCostsPayload = [
      {
        name: 'Movilización técnica para inspección en muelle',
        unit: 'VISITA',
        price: 85000,
        quantity: 2,
        notes: 'Sujeto a confirmación de atraque',
      },
      {
        name: 'Certificación externa por casa clasificadora',
        unit: 'GLOBAL',
        price: 250000,
        quantity: 1,
      },
    ];

    const res = await request(app)
      .put(`/api/v1/quotations/${quoteId}/extra-costs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ extraCosts: extraCostsPayload });

    expect(res.status).toBe(200);
    expect(res.body.extraCosts).toHaveLength(2);
    expect(res.body.extraCosts[0].name).toBe('Movilización técnica para inspección en muelle');
    expect(res.body.extraCosts[0].subtotal).toBe(170000);
    expect(res.body.extraCosts[1].subtotal).toBe(250000);
    expect(res.body.extraCostsTotal).toBe(420000);

    // Los costos extra no deben distorsionar la venta neta ni el total comercial de la cotización
    expect(res.body.totalSale).toBe(0);
    expect(res.body.grandTotal).toBe(0);
  });

  it('Seguridad y Validación: Un asesor no puede modificar cotizaciones de otro asesor', async () => {
    const state = dbStore.getState();
    // Buscar o crear cotización de admin
    const customer = state.customers[0];
    const contact = state.contacts[0];

    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        contactId: contact.id,
        salesRepId: 'usr-admin-01',
      });
    const quoteId = createRes.body.id;

    // Intento del asesor smorales de modificar vía PATCH
    const patchRes = await request(app)
      .patch(`/api/v1/quotations/${quoteId}`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ presentationText: 'Intento no autorizado' });

    expect(patchRes.status).toBe(403);
    expect(patchRes.body.title).toBe('Acceso denegado');

    // Intento del asesor de modificar costos extra vía PUT
    const extraRes = await request(app)
      .put(`/api/v1/quotations/${quoteId}/extra-costs`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ extraCosts: [] });

    expect(extraRes.status).toBe(403);
    expect(extraRes.body.title).toBe('Acceso denegado');
  });

  it('Cotizaciones aceptadas son inmutables para PATCH y PUT extra-costs', async () => {
    const state = dbStore.getState();
    const customer = state.customers[0];
    const contact = state.contacts[0];

    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: customer.id,
        contactId: contact.id,
      });
    const quoteId = createRes.body.id;

    // Simular aceptación
    const quot = state.quotations.find((q) => q.id === quoteId)!;
    quot.status = 'ACCEPTED';

    const patchRes = await request(app)
      .patch(`/api/v1/quotations/${quoteId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ presentationText: 'Modificación post-aceptación' });

    expect(patchRes.status).toBe(400);
    expect(patchRes.body.title).toBe('Cotización no editable');

    const extraRes = await request(app)
      .put(`/api/v1/quotations/${quoteId}/extra-costs`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ extraCosts: [] });

    expect(extraRes.status).toBe(400);
    expect(extraRes.body.title).toBe('Cotización no editable');
  });
});
