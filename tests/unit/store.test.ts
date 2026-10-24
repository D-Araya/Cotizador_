import { describe, it, expect, beforeEach } from 'vitest';
import { dbStore, initialCompany } from '../../src/modules/db/store.ts';

describe('MemoryStore Unit Tests', () => {
  beforeEach(() => {
    dbStore.reset();
  });

  it('proporciona el estado inicial completo', () => {
    const state = dbStore.getState();
    expect(state.users.length).toBeGreaterThan(0);
    expect(state.customers.length).toBeGreaterThan(0);
    expect(state.contacts.length).toBeGreaterThan(0);
    expect(state.categories.length).toBeGreaterThan(0);
    expect(state.catalogItems.length).toBeGreaterThan(0);
    expect(state.quotations.length).toBe(30); // 30 seed quotations
    expect(state.invoices.length).toBeGreaterThan(0);
    expect(state.operations.length).toBeGreaterThan(0);
    expect(state.company.minMarginPct).toBe(initialCompany.minMarginPct);
  });

  it('permite leer y actualizar la configuración de la empresa', () => {
    const company = dbStore.getCompany();
    expect(company.name).toBe(initialCompany.name);

    const updated = dbStore.updateCompany({ minMarginPct: 28, taxRatePct: 18 });
    expect(updated.minMarginPct).toBe(28);
    expect(dbStore.getCompany().minMarginPct).toBe(28);
  });

  it('genera correlativos de cotizaciones consecutivos y formateados COT-000XXX', () => {
    const q1 = dbStore.getNextQuotationNumber();
    const q2 = dbStore.getNextQuotationNumber();
    expect(q1).toMatch(/^COT-\d{6}$/);
    expect(q2).toMatch(/^COT-\d{6}$/);

    const num1 = parseInt(q1.replace('COT-', ''), 10);
    const num2 = parseInt(q2.replace('COT-', ''), 10);
    expect(num2).toBe(num1 + 1);
  });

  it('agrega mensajes a la bandeja outbox y les asigna ID y fecha', () => {
    const initialCount = dbStore.getState().outbox.length;
    const msg = dbStore.addOutbox({
      quotationId: 'quot-test-1',
      channel: 'EMAIL',
      recipient: 'cliente@empresa.com',
      recipientName: 'Carlos Test',
      subject: 'Prueba de Cotización',
      body: 'Cuerpo del mensaje de prueba',
    });

    expect(msg.id).toBeDefined();
    expect(msg.createdAt).toBeDefined();
    expect(['PENDING', 'SENT']).toContain(msg.status);
    expect(msg.retries).toBe(0);
    expect(dbStore.getState().outbox.length).toBe(initialCount + 1);
    expect(dbStore.getState().outbox[0].id).toBe(msg.id);
  });

  it('el método reset() restaura el estado limpio original', () => {
    dbStore.updateCompany({ minMarginPct: 99 });
    dbStore.getState().customers.push({
      id: 'cust-temp',
      businessName: 'Temporal',
      taxId: '20999999999',
      address: 'Calle Falsa',
      salesRepId: 'usr-1',
      active: true,
      createdAt: new Date().toISOString(),
    });

    dbStore.reset();
    expect(dbStore.getCompany().minMarginPct).toBe(initialCompany.minMarginPct);
    expect(dbStore.getState().customers.find((c) => c.id === 'cust-temp')).toBeUndefined();
  });
});
