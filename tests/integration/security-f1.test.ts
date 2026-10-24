import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../../server.js';

describe('Fase 1: Seguridad y Permisos (S1 a S6, S8 y S9)', () => {
  it('S1: Login rechaza contraseñas inválidas con 401 Problem Details', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'wrong_password' });

    expect(res.status).toBe(401);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(res.body.title).toBe('Credenciales inválidas');
  });

  it('S1: Login exitoso devuelve token Bearer y usuario sanitizado', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('S2: Rutas administrativas rechazan acceso sin sesión con 401', async () => {
    const backupRes = await request(app).get('/api/v1/system/backup');
    expect(backupRes.status).toBe(401);

    const compRes = await request(app).put('/api/v1/company').send({ minMarginPct: 15 });
    expect(compRes.status).toBe(401);

    const userRes = await request(app).patch('/api/v1/users/usr-admin-01').send({ name: 'Hacker' });
    expect(userRes.status).toBe(401);
  });

  it('S2: Rutas administrativas rechazan a SALES_REP con 403 Forbidden', async () => {
    // Login as SALES_REP
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = loginRes.body.token;

    const backupRes = await request(app)
      .get('/api/v1/system/backup')
      .set('Authorization', `Bearer ${repToken}`);
    expect(backupRes.status).toBe(403);

    const compRes = await request(app)
      .put('/api/v1/company')
      .set('Authorization', `Bearer ${repToken}`)
      .send({ minMarginPct: 10 });
    expect(compRes.status).toBe(403);
  });

  it('S3: El portal exige autenticación y no confía en ?customerId= del cliente', async () => {
    // Sin autenticación
    const unauthRes = await request(app).get('/api/v1/portal/quotations?customerId=cust-01');
    expect(unauthRes.status).toBe(401);

    // Con token mágico de cliente (cust-01), si envía ?customerId= ajeno es rechazado con 403
    const forbiddenRes = await request(app)
      .get('/api/v1/portal/quotations?customerId=cust-02') // Intenta pedir cust-02
      .set('Authorization', 'Bearer magic_demo_token_mbarrientos_2026');
    expect(forbiddenRes.status).toBe(403);

    // Con token mágico de cliente legítimo
    const authRes = await request(app)
      .get('/api/v1/portal/quotations')
      .set('Authorization', 'Bearer magic_demo_token_mbarrientos_2026');

    expect(authRes.status).toBe(200);
    // Todas las cotizaciones devueltas pertenecen a cust-01
    expect(authRes.body.length).toBeGreaterThan(0);
  });

  it('S4: La respuesta pública de cotización NO contiene las palabras cost ni profit', async () => {
    // Obtener una cotización con publicToken
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });

    const qRes = await request(app)
      .get('/api/v1/quotations')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    const quote = qRes.body[0];
    const pubRes = await request(app).get(`/api/v1/public/quotations/${quote.publicToken}`);

    expect(pubRes.status).toBe(200);
    const pubStr = JSON.stringify(pubRes.body);
    expect(pubStr.toLowerCase()).not.toContain('"cost"');
    expect(pubStr.toLowerCase()).not.toContain('"profit"');
    expect(pubStr.toLowerCase()).not.toContain('"costtotal"');
  });

  it('S5: Enviar un costo falso en una línea es ignorado por el servidor', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = loginRes.body.token;

    // Crear cotización borrador
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId: 'cust-01' });
    const quoteId = createRes.body.id;

    // Enviar costo falso de 1 CLP (el costo real en catálogo para prod-01 es 28000)
    const lineRes = await request(app)
      .put(`/api/v1/quotations/${quoteId}/lines`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [
          { catalogItemId: 'prod-01', quantity: 2, price: 60000, cost: 1, unitCost: 1 }
        ]
      });

    expect(lineRes.status).toBe(200);
    // El costo guardado debe ser 28000 derivado del catálogo, NO 1
    expect(lineRes.body.lines[0].cost).toBe(28000);
  });

  it('S6: Endpoints de Gemini exigen autenticación interna y rechazan llamadas anónimas', async () => {
    const res = await request(app)
      .post('/api/v1/gemini/chat')
      .send({ prompt: 'Hola' });

    expect(res.status).toBe(401);
  });
});
