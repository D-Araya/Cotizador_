import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';
import { dbStore } from '../../src/modules/db/store.js';

describe('Sincronización Portales Admin, Asesor y Cliente (Austral Salmón & Mar SpA)', () => {
  let adminToken: string;
  let clientToken: string;
  let createdQuoteId: string;
  let publicToken: string;

  beforeAll(async () => {
    // 1. Iniciar sesión como Admin
    const adminLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    expect(adminLoginRes.status).toBe(200);
    adminToken = adminLoginRes.body.token;

    // 2. Iniciar sesión como Cliente (Austral Salmón & Mar SpA)
    const clientLoginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mbarrientos@australsalmon.cl', password: 'admin123' });
    expect(clientLoginRes.status).toBe(200);
    expect(clientLoginRes.body.role).toBe('CUSTOMER_CONTACT');
    expect(clientLoginRes.body.user.customerId).toBe('cust-01');
    expect(clientLoginRes.body.redirectTo).toBe('/portal/dashboard');
    clientToken = clientLoginRes.body.token;
  });

  it('1. Admin crea borrador de cotización para Austral Salmón & Mar SpA con líneas válidas', async () => {
    // Crear borrador
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: 'cust-01', // Austral Salmón & Mar SpA
        contactId: 'cont-01',   // Ing. Matías Barrientos
        salesRepId: 'usr-admin-01',
        currency: 'CLP',
      });

    expect(createRes.status).toBe(201);
    createdQuoteId = createRes.body.id;
    expect(createRes.body.status).toBe('DRAFT');
    expect(createRes.body.customerId).toBe('cust-01');

    // Agregar líneas de catálogo con margen adecuado (>25%)
    const catalogItem = dbStore.getState().catalogItems[0];
    const linesRes = await request(app)
      .put(`/api/v1/quotations/${createdQuoteId}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [
          {
            catalogItemId: catalogItem.id,
            quantity: 2,
            price: 2500000,
            marginPct: 35.0,
            discountPct: 0,
            description: 'Servicio de prueba de inclinación',
          },
        ],
      });

    expect(linesRes.status).toBe(200);
  });

  it('2. Admin envía la cotización: el estado debe ser SENT (Enviada), NUNCA VIEWED', async () => {
    const sendRes = await request(app)
      .post(`/api/v1/quotations/${createdQuoteId}/send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(sendRes.status).toBe(200);
    expect(sendRes.body.status).toBe('SENT');
    expect(sendRes.body.publicToken).toBeDefined();
    publicToken = sendRes.body.publicToken;
  });

  it('3. Si personal interno (Admin) abre o previsualiza la cotización, NO debe pasar a VIEWED', async () => {
    // Vista previa por parte del staff con token de administrador
    const staffViewRes = await request(app)
      .post(`/api/v1/public/quotations/${publicToken}/view`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});

    expect(staffViewRes.status).toBe(200);
    expect(staffViewRes.body.status).toBe('SENT');
    expect(staffViewRes.body.isStaffPreview).toBe(true);

    // Verificar en BD que sigue en estado SENT
    const quoteInDb = dbStore.getState().quotations.find((q) => q.id === createdQuoteId);
    expect(quoteInDb?.status).toBe('SENT');
    expect(quoteInDb?.firstViewedAt).toBeUndefined();
  });

  it('4. El personal no puede forzar manualmente el estado a VIEWED vía API de estado', async () => {
    const manualStatusRes = await request(app)
      .post(`/api/v1/quotations/${createdQuoteId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'VIEWED' });

    expect(manualStatusRes.status).toBe(400);
    expect(manualStatusRes.body.title).toBe('Operación no permitida');
  });

  it('5. El cliente de Austral Salmón consulta el portal y su cotización recién enviada está disponible', async () => {
    const portalQuotationsRes = await request(app)
      .get('/api/v1/portal/quotations')
      .set('Authorization', `Bearer ${clientToken}`);

    expect(portalQuotationsRes.status).toBe(200);
    expect(Array.isArray(portalQuotationsRes.body)).toBe(true);

    // Debe contener la cotización enviada
    const found = portalQuotationsRes.body.find((q: any) => q.id === createdQuoteId);
    expect(found).toBeDefined();
    expect(found.status).toBe('SENT');
  });

  it('6. Solo cuando el cliente real visualiza la cotización, cambia de SENT a VIEWED', async () => {
    // El cliente abre su enlace público (sin token de personal interno)
    const clientViewRes = await request(app)
      .post(`/api/v1/public/quotations/${publicToken}/view`)
      .send({});

    expect(clientViewRes.status).toBe(200);
    expect(clientViewRes.body.status).toBe('VIEWED');

    // Verificar en BD que ahora sí está VIEWED y tiene firstViewedAt
    const quoteInDb = dbStore.getState().quotations.find((q) => q.id === createdQuoteId);
    expect(quoteInDb?.status).toBe('VIEWED');
    expect(quoteInDb?.firstViewedAt).toBeDefined();
  });

  it('7. Alternador de usuarios (switch-user) permite cambiar fluidamente entre Admin, Asesor y Cliente', async () => {
    // Cambiar a Asesor Comercial
    const switchToAdvisor = await request(app)
      .post('/api/v1/auth/switch-user')
      .send({ email: 'smorales@mlingenieria.cl' });

    expect(switchToAdvisor.status).toBe(200);
    expect(switchToAdvisor.body.role).toBe('SALES_REP');

    // Cambiar a Cliente Austral Salmón
    const switchToClient = await request(app)
      .post('/api/v1/auth/switch-user')
      .send({ email: 'mbarrientos@australsalmon.cl' });

    expect(switchToClient.status).toBe(200);
    expect(switchToClient.body.role).toBe('CUSTOMER_CONTACT');
    expect(switchToClient.body.redirectTo).toBe('/portal/dashboard');
  });
});
