import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';

describe('Dashboards por rol, permisos y cuadre por asesor', () => {
  it('1. /auth/me devuelve la lista permissions derivada de la matriz de roles', async () => {
    // Admin login
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const adminMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminMe.status).toBe(200);
    expect(Array.isArray(adminMe.body.permissions)).toBe(true);
    expect(adminMe.body.permissions).toContain('users:manage');
    expect(adminMe.body.permissions).toContain('system:backup');
    expect(adminMe.body.permissions).toContain('catalog:create');
    expect(adminMe.body.permissions).toContain('catalog:edit');
    expect(adminMe.body.permissions).toContain('catalog:deactivate');
    expect(adminMe.body.permissions).toContain('dashboard:by_sales_rep');

    // Sales Rep login
    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    expect(repLogin.status).toBe(200);
    const repToken = repLogin.body.token;

    const repMe = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repMe.status).toBe(200);
    expect(Array.isArray(repMe.body.permissions)).toBe(true);
    expect(repMe.body.permissions).not.toContain('users:manage');
    expect(repMe.body.permissions).not.toContain('system:backup');
    expect(repMe.body.permissions).not.toContain('catalog:create');
    expect(repMe.body.permissions).not.toContain('catalog:deactivate');
    expect(repMe.body.permissions).not.toContain('dashboard:by_sales_rep');
    expect(repMe.body.permissions).toContain('dashboard:own');
  });

  it('2. El Administrador puede crear una cotización a nombre de un asesor elegido', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    // Crear cotización a nombre de Sebastián Morales (usr-sales-01)
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: 'cust-01',
        contactId: 'cnt-01',
        salesRepId: 'usr-sales-01',
        title: 'Inspección de Casco en Valdivia',
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.salesRepId).toBe('usr-sales-01');
    expect(createRes.body.salesRepName).toContain('Sebastián Morales');
  });

  it('3. Todo lo creado cuenta en algún asesor y los totales de by-sales-rep cuadran con el resumen', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const summaryRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(summaryRes.status).toBe(200);
    const summary = summaryRes.body;

    const repsRes = await request(app)
      .get('/api/v1/dashboard/by-sales-rep')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(repsRes.status).toBe(200);
    const rows = repsRes.body;
    expect(Array.isArray(rows)).toBe(true);

    const sumTotalQuotations = rows.reduce((acc: number, r: any) => acc + (r.totalQuotes || r.totalQuotations || 0), 0);
    const sumAccepted = rows.reduce((acc: number, r: any) => acc + (r.accepted || r.acceptedQuotations || 0), 0);
    const sumRejected = rows.reduce((acc: number, r: any) => acc + (r.rejected || 0), 0);
    const sumTotalSales = rows.reduce((acc: number, r: any) => acc + (r.totalSales || 0), 0);

    // Los totales del reporte por asesor deben sumar exactamente el consolidado
    expect(sumTotalQuotations).toBe(summary.totalQuotations);
    expect(sumAccepted).toBe(summary.totalAccepted);
    expect(sumRejected).toBe(summary.totalRejected);
    expect(sumTotalSales).toBe(summary.totalAcceptedSales);
  });

  it('4. SALES_REP solo ve sus propias cifras en by-sales-rep', async () => {
    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    const repsRes = await request(app)
      .get('/api/v1/dashboard/by-sales-rep')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repsRes.status).toBe(200);
    expect(repsRes.body.length).toBe(1);
    expect(repsRes.body[0].salesRepId).toBe('usr-sales-01');
  });

  it('5. SALES_REP solo visualiza su propio resumen en /dashboard/summary y no el consolidado global del ADMIN', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    // Crear una cotización exclusiva del Administrador (usr-admin-01)
    const adminQuoteRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: 'cust-01',
        contactId: 'cnt-01',
        salesRepId: 'usr-admin-01',
        title: 'Cotización Exclusiva de Gerencia Admin',
      });
    expect(adminQuoteRes.status).toBe(201);

    const globalSummaryRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(globalSummaryRes.status).toBe(200);
    expect(globalSummaryRes.body.scope).toBe('GLOBAL');

    const repSummaryRes = await request(app)
      .get('/api/v1/dashboard/summary')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repSummaryRes.status).toBe(200);
    expect(repSummaryRes.body.scope).toBe('PERSONAL');
    expect(repSummaryRes.body.salesRepId).toBe('usr-sales-01');

    // El total de cotizaciones del asesor debe ser menor que el global (ya que existe al menos la cotización del admin)
    expect(repSummaryRes.body.totalQuotations).toBeLessThan(globalSummaryRes.body.totalQuotations);
  });

  it('6. SALES_REP solo visualiza sus propias métricas en /dashboard/pipeline-metrics sin exponer métricas de ADMIN ni otros asesores', async () => {
    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    const metricsRes = await request(app)
      .get('/api/v1/dashboard/pipeline-metrics')
      .set('Authorization', `Bearer ${repToken}`);
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.scope).toBe('PERSONAL');
    expect(metricsRes.body.salesRepId).toBe('usr-sales-01');
    expect(Array.isArray(metricsRes.body.wonLostBySalesRep.items)).toBe(true);
    expect(metricsRes.body.wonLostBySalesRep.items.length).toBe(1);
    expect(metricsRes.body.wonLostBySalesRep.items[0].salesRepId).toBe('usr-sales-01');
  });

  it('7. SALES_REP recibe 403 Forbidden si intenta consultar métricas del ADMIN o de otro asesor vía salesRepId', async () => {
    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    const sumForbidden = await request(app)
      .get('/api/v1/dashboard/summary?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(sumForbidden.status).toBe(403);

    const repsForbidden = await request(app)
      .get('/api/v1/dashboard/by-sales-rep?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repsForbidden.status).toBe(403);

    const itemTypeForbidden = await request(app)
      .get('/api/v1/dashboard/by-item-type?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(itemTypeForbidden.status).toBe(403);

    const kpiForbidden = await request(app)
      .get('/api/v1/dashboard/pipeline-metrics?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(kpiForbidden.status).toBe(403);
  });

  it('8. SALES_REP solo visualiza sus propias cotizaciones en /quotations, /quotations/kpis y /quotations/follow-up/due (y recibe 403 al pedir otro salesRepId)', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    // 1. Listar cotizaciones como SALES_REP solo devuelve cotizaciones de usr-sales-01
    const repQuotesRes = await request(app)
      .get('/api/v1/quotations')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repQuotesRes.status).toBe(200);
    expect(Array.isArray(repQuotesRes.body)).toBe(true);
    expect(repQuotesRes.body.every((q: any) => q.salesRepId === 'usr-sales-01')).toBe(true);

    // 2. Intentar filtrar cotizaciones de otro asesor como SALES_REP devuelve 403
    const forbiddenList = await request(app)
      .get('/api/v1/quotations?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(forbiddenList.status).toBe(403);

    const forbiddenKpis = await request(app)
      .get('/api/v1/quotations/kpis?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(forbiddenKpis.status).toBe(403);

    const forbiddenDue = await request(app)
      .get('/api/v1/quotations/follow-up/due?salesRepId=usr-admin-01')
      .set('Authorization', `Bearer ${repToken}`);
    expect(forbiddenDue.status).toBe(403);

    // 3. KPIs de SALES_REP cuadran con su listado personal y son menores que el global del ADMIN
    const adminKpis = await request(app)
      .get('/api/v1/quotations/kpis')
      .set('Authorization', `Bearer ${adminToken}`);
    const repKpis = await request(app)
      .get('/api/v1/quotations/kpis')
      .set('Authorization', `Bearer ${repToken}`);
    expect(repKpis.status).toBe(200);
    expect(repKpis.body.total).toBe(repQuotesRes.body.length);
    expect(repKpis.body.total).toBeLessThan(adminKpis.body.total);
  });

  it('9. Protección contra colisiones de edición (expectedUpdatedAt / expectedStatus) y bloqueo de revisiones superadas (409 Conflict)', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    // Crear cotización borrador
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        customerId: 'cust-01',
        contactId: 'cnt-01',
        title: 'Cotización Control Concurrencia',
      });
    expect(createRes.status).toBe(201);
    const quote = createRes.body;

    // 1. Intentar guardar con un expectedUpdatedAt obsoleto devuelve 409 Conflict
    const stalePatch = await request(app)
      .patch(`/api/v1/quotations/${quote.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Intento con timestamp antiguo',
        expectedUpdatedAt: '2020-01-01T00:00:00.000Z',
      });
    expect(stalePatch.status).toBe(409);
    expect(stalePatch.body.title).toContain('Colisión de edición');

    // 2. Guardar con el expectedUpdatedAt vigente funciona (200 OK)
    const validPatch = await request(app)
      .patch(`/api/v1/quotations/${quote.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Actualización concurrente válida',
        expectedUpdatedAt: quote.updatedAt,
      });
    expect(validPatch.status).toBe(200);

    // 3. Agregar líneas y enviar la cotización (R1)
    await request(app)
      .put(`/api/v1/quotations/${quote.id}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [{ catalogItemId: 'prod-01', quantity: 2, price: 65000 }],
      })
      .expect(200);

    const sendRes = await request(app)
      .post(`/api/v1/quotations/${quote.id}/send`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const sentQuote = sendRes.body;

    // 4. Crear nueva revisión R2 (marca R1 como isLatestRevision=false y supersededByQuotationId=R2.id)
    const revRes = await request(app)
      .post(`/api/v1/quotations/${sentQuote.id}/revisions`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({})
      .expect(201);
    expect(revRes.body.revision).toBe(2);

    // 5. Intentar aceptar, rechazar o pedir ajustes en la revisión superada R1 desde el enlace público devuelve 409 Conflict
    const pubAcceptOld = await request(app)
      .post(`/api/v1/public/quotations/${sentQuote.publicToken}/accept`)
      .send({
        termsAccepted: true,
        signerName: 'Cliente Naval',
        signerPosition: 'Gerente Operaciones',
      });
    expect(pubAcceptOld.status).toBe(409);
    expect(pubAcceptOld.body.title).toContain('Revisión superada');

    const pubRejectOld = await request(app)
      .post(`/api/v1/public/quotations/${sentQuote.publicToken}/reject`)
      .send({ reason: 'Precio' });
    expect(pubRejectOld.status).toBe(409);

    const pubAdjustOld = await request(app)
      .post(`/api/v1/public/quotations/${sentQuote.publicToken}/request-adjustment`)
      .send({ message: 'Ajuste en versión antigua' });
    expect(pubAdjustOld.status).toBe(409);
  });
});

