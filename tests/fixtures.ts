import request from 'supertest';
import { app } from '../server.js';
import { dbStore } from '../src/modules/db/store.js';
import { Customer, Contact, CatalogItem, Quotation, User } from '../src/modules/types.js';

let cachedAdminToken: string | null = null;
let cachedRepToken: string | null = null;

export async function getAdminToken(): Promise<string> {
  if (cachedAdminToken) return cachedAdminToken;
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@mlingenieria.cl', password: 'admin123' });
  cachedAdminToken = res.body.token;
  return cachedAdminToken!;
}

export async function getRepToken(): Promise<string> {
  if (cachedRepToken) return cachedRepToken;
  const res = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'smorales@mlingenieria.cl', password: 'admin123' });
  cachedRepToken = res.body.token;
  return cachedRepToken!;
}

let cachedClientToken: string | null = null;

export async function getClientToken(): Promise<string> {
  if (cachedClientToken) return cachedClientToken;
  const adminToken = await getAdminToken();
  const { contact } = await createFixtureCustomer(adminToken);
  if ((contact as any).initialMagicToken) {
    cachedClientToken = (contact as any).initialMagicToken;
    return cachedClientToken!;
  }
  // Fallback to magic login
  const res = await request(app)
    .post('/api/v1/auth/magic-login')
    .send({ token: 'magic_demo_token_mbarrientos_2026' });
  cachedClientToken = res.body.token || 'magic_demo_token_mbarrientos_2026';
  return cachedClientToken!;
}

/**
 * Creates an isolated Customer + Contact fixture directly via API
 */
export async function createFixtureCustomer(token?: string): Promise<{ customer: Customer; contact: Contact }> {
  const authToken = token || await getAdminToken();
  const rand = Math.floor(100000 + Math.random() * 900000);
  
  const custRes = await request(app)
    .post('/api/v1/customers')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      businessName: `Test Naviera Fixture ${rand} SpA`,
      taxId: `76.${rand.toString().slice(0, 3)}.${rand.toString().slice(3, 6)}-K`,
      address: `Av. Costanera ${rand}, Puerto Montt`,
      email: `contacto${rand}@testnaviera.cl`,
      phone: '+56 9 8888 7777',
      industry: 'Acuicultura y Servicios Marítimos',
    });

  const customer = custRes.body;

  const contRes = await request(app)
    .post(`/api/v1/customers/${customer.id}/contacts`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      name: `Ing. Fixture Test ${rand}`,
      email: `testcontact${rand}@testnaviera.cl`,
      phone: '+56 9 7777 6666',
      position: 'Jefe de Flota y Operaciones',
    });

  const contact = contRes.body;
  return { customer, contact };
}

/**
 * Creates an isolated Catalog Item fixture
 */
export async function createFixtureCatalogItem(token?: string, type: 'PRODUCT' | 'SERVICE' = 'SERVICE'): Promise<CatalogItem> {
  const authToken = token || await getAdminToken();
  const rand = Math.floor(1000 + Math.random() * 9000);

  const res = await request(app)
    .post('/api/v1/catalog-items')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      type,
      name: `Servicio Naval Fixture ${rand}`,
      categoryId: 'cat-01',
      unit: type === 'SERVICE' ? 'HORA' : 'UND',
      skuOrCode: `SRV-${rand}`,
      unitCost: 150000,
      listPrice: 250000,
      description: `Descripción técnica del servicio ${rand}`,
    });

  return res.body;
}

/**
 * Creates an isolated Quotation fixture
 */
export async function createFixtureQuotation(token?: string, initialStatus: 'DRAFT' | 'SENT' | 'ACCEPTED' = 'DRAFT'): Promise<Quotation> {
  const authToken = token || await getAdminToken();
  const { customer, contact } = await createFixtureCustomer(authToken);
  const catalogItem = await createFixtureCatalogItem(authToken);

  // 1. Create Draft
  const draftRes = await request(app)
    .post('/api/v1/quotations')
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      customerId: customer.id,
      contactId: contact.id,
      title: `Cotización Fixture ${Date.now()}`,
    });

  const draft = draftRes.body;

  // 2. Add line
  const linesRes = await request(app)
    .put(`/api/v1/quotations/${draft.id}/lines`)
    .set('Authorization', `Bearer ${authToken}`)
    .send({
      lines: [
        {
          catalogItemId: catalogItem.id,
          quantity: 2,
          price: 250000,
        },
      ],
    });

  let quote = linesRes.body;

  if (initialStatus === 'SENT' || initialStatus === 'ACCEPTED') {
    // Send to client
    const sendRes = await request(app)
      .post(`/api/v1/quotations/${quote.id}/send`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        channel: 'EMAIL',
      });
    quote = sendRes.body;

    if (initialStatus === 'ACCEPTED') {
      // Offline accept with evidence
      const acceptRes = await request(app)
        .post(`/api/v1/quotations/${quote.id}/accept-offline`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          purchaseOrderNumber: `OC-${Date.now()}`,
          offlineNote: 'Aprobación directa por gerencia con orden de compra',
        });
      quote = acceptRes.body.quotation || acceptRes.body;
    }
  }

  return quote;
}
