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

  it('S7: Intento de suplantar rol o identidad mediante cabeceras x-user-role/x-user-id es rechazado con 401', async () => {
    // Un atacante intenta enviar x-user-role: ADMIN sin token Bearer
    const res = await request(app)
      .get('/api/v1/quotations')
      .set('x-user-role', 'ADMIN')
      .set('x-user-id', 'usr-admin-01');

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Unauthorized');
  });

  it('S8: Cuentas sin hash de contraseña configurado no pueden ser usurpadas vía /auth/login', async () => {
    // usr-client-01 existe en la BD pero no tiene passwordHash (autentica por enlace mágico)
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'mbarrientos@australsalmon.cl', password: 'attacker_password' });

    expect(res.status).toBe(401);
    expect(res.body.title).toBe('Credenciales inválidas');
  });

  it('S9: Un asesor no puede modificar líneas, enviar, rechazar ni agregar adjuntos a cotizaciones de otro asesor (Anti-IDOR)', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const repLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
    const repToken = repLogin.body.token;

    // Crear cotización perteneciente a admin
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId: 'cust-01', salesRepId: 'usr-admin-01' });
    const quoteId = createRes.body.id;

    // 1. Asesor intenta modificar líneas
    const linesRes = await request(app)
      .put(`/api/v1/quotations/${quoteId}/lines`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ lines: [{ catalogItemId: 'prod-01', quantity: 1, price: 50000 }] });
    expect(linesRes.status).toBe(403);
    expect(linesRes.body.title).toBe('Acceso denegado');

    // 2. Asesor intenta enviar la cotización
    const sendRes = await request(app)
      .post(`/api/v1/quotations/${quoteId}/send`)
      .set('Authorization', `Bearer ${repToken}`);
    expect(sendRes.status).toBe(403);

    // 3. Asesor intenta rechazar la cotización
    const rejectRes = await request(app)
      .post(`/api/v1/quotations/${quoteId}/reject`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ lossReason: 'precio' });
    expect(rejectRes.status).toBe(403);

    // 4. Asesor intenta agregar un adjunto
    const attRes = await request(app)
      .post(`/api/v1/quotations/${quoteId}/attachments`)
      .set('Authorization', `Bearer ${repToken}`)
      .send({ name: 'Plano Malicioso', url: 'https://attacker.com/doc.pdf' });
    expect(attRes.status).toBe(403);
  });

  it('S10: Los enlaces públicos protegen borradores (DRAFT) de decisiones y sanitizan estrictamente', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    // Crear borrador
    const createRes = await request(app)
      .post('/api/v1/quotations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId: 'cust-01' });
    const draftToken = createRes.body.publicToken;

    // 1. Intento de aceptar borrador devuelve 400
    const acceptRes = await request(app)
      .post(`/api/v1/public/quotations/${draftToken}/accept`)
      .send({ termsAccepted: true, signerName: 'Juan Pérez', signerPosition: 'Gerente' });
    expect(acceptRes.status).toBe(400);

    // 2. Intento de desestimar borrador devuelve 400
    const rejectRes = await request(app)
      .post(`/api/v1/public/quotations/${draftToken}/reject`)
      .send({ reason: 'No aceptado' });
    expect(rejectRes.status).toBe(400);

    // 3. Intento de solicitar ajuste a borrador devuelve 400
    const adjustRes = await request(app)
      .post(`/api/v1/public/quotations/${draftToken}/request-adjustment`)
      .send({ message: 'Cambio' });
    expect(adjustRes.status).toBe(400);
  });

  it('S11: Endpoints de categorías validan estructura y rechazan nombres vacíos con 400', async () => {
    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const res = await request(app)
      .post('/api/v1/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: ' ' });

    expect(res.status).toBe(400);
    expect(res.body.title).toBe('Datos incompletos');
  });
});
