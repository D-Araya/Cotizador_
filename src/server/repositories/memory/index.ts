import crypto from 'node:crypto';
import { dbStore } from '../../../modules/db/store.js';
import {
  Quotation,
  Customer,
  Contact,
  CatalogItem,
  Category,
  Invoice,
  OperationOrder,
  AuditLog,
  OutboxMessage,
  CompanySettings,
  User,
} from '../../../modules/types.js';
import {
  QuotationRepository,
  CustomerRepository,
  ContactRepository,
  CatalogRepository,
  InvoiceRepository,
  OperationRepository,
  AuditRepository,
  NotificationRepository,
  CompanyRepository,
  UserRepository,
  CounterRepository,
  PaginationParams,
  PaginatedResult,
} from '../types.js';

function paginateArray<T>(items: T[], params?: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  if (!params || (params.page === undefined && params.pageSize === undefined)) {
    return { items, total };
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 20);
  const start = (page - 1) * pageSize;
  const pagedItems = items.slice(start, start + pageSize);
  return { items: pagedItems, total, page, pageSize };
}

export class MemoryQuotationRepository implements QuotationRepository {
  async findById(id: string): Promise<Quotation | null> {
    const q = dbStore.getState().quotations.find((item) => item.id === id);
    return q ? JSON.parse(JSON.stringify(q)) : null;
  }

  async findByNumber(quotationNumber: string): Promise<Quotation | null> {
    const q = dbStore.getState().quotations.find((item) => item.quotationNumber === quotationNumber);
    return q ? JSON.parse(JSON.stringify(q)) : null;
  }

  async findByPublicToken(token: string): Promise<Quotation | null> {
    const q = dbStore.getState().quotations.find((item) => item.publicToken === token);
    return q ? JSON.parse(JSON.stringify(q)) : null;
  }

  async list(params?: PaginationParams & { salesRepId?: string; customerId?: string }): Promise<PaginatedResult<Quotation>> {
    let items = [...dbStore.getState().quotations];

    if (params?.salesRepId) {
      items = items.filter((q) => q.salesRepId === params.salesRepId);
    }
    if (params?.customerId) {
      items = items.filter((q) => q.customerId === params.customerId);
    }
    if (params?.status) {
      items = items.filter((q) => q.status === params.status);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (q) =>
          q.quotationNumber.toLowerCase().includes(query) ||
          (q.title && q.title.toLowerCase().includes(query)) ||
          (q.customerBusinessName && q.customerBusinessName.toLowerCase().includes(query)) ||
          (q.salesRepName && q.salesRepName.toLowerCase().includes(query))
      );
    }

    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return paginateArray(items, params);
  }

  async create(quotation: Quotation): Promise<Quotation> {
    const cloned = JSON.parse(JSON.stringify(quotation));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().quotations.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Quotation>): Promise<Quotation | null> {
    const quotes = dbStore.getState().quotations;
    const idx = quotes.findIndex((q) => q.id === id);
    if (idx === -1) return null;
    quotes[idx] = { ...quotes[idx], ...partial, updatedAt: new Date().toISOString() };
    return JSON.parse(JSON.stringify(quotes[idx]));
  }

  async delete(id: string): Promise<boolean> {
    const quotes = dbStore.getState().quotations;
    const idx = quotes.findIndex((q) => q.id === id);
    if (idx === -1) return false;
    quotes.splice(idx, 1);
    return true;
  }

  async count(): Promise<number> {
    return dbStore.getState().quotations.length;
  }
}

export class MemoryCustomerRepository implements CustomerRepository {
  async findById(id: string): Promise<Customer | null> {
    const c = dbStore.getState().customers.find((item) => item.id === id);
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }

  async list(params?: PaginationParams): Promise<PaginatedResult<Customer>> {
    let items = [...dbStore.getState().customers];
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (c) =>
          c.businessName.toLowerCase().includes(query) ||
          (c.rut && c.rut.toLowerCase().includes(query)) ||
          (c.email && c.email.toLowerCase().includes(query))
      );
    }
    items.sort((a, b) => a.businessName.localeCompare(b.businessName));
    return paginateArray(items, params);
  }

  async create(customer: Customer): Promise<Customer> {
    const cloned = JSON.parse(JSON.stringify(customer));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().customers.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Customer>): Promise<Customer | null> {
    const customers = dbStore.getState().customers;
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    customers[idx] = { ...customers[idx], ...partial, updatedAt: new Date().toISOString() };
    return JSON.parse(JSON.stringify(customers[idx]));
  }

  async delete(id: string): Promise<boolean> {
    const customers = dbStore.getState().customers;
    const idx = customers.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    customers.splice(idx, 1);
    return true;
  }

  async count(): Promise<number> {
    return dbStore.getState().customers.length;
  }
}

export class MemoryContactRepository implements ContactRepository {
  async findById(id: string): Promise<Contact | null> {
    const c = dbStore.getState().contacts.find((item) => item.id === id);
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Contact | null> {
    const c = dbStore.getState().contacts.find(
      (item) => item.portalTokenHash === tokenHash && !item.portalTokenRevoked
    );
    return c ? JSON.parse(JSON.stringify(c)) : null;
  }

  async listByCustomerId(customerId: string): Promise<Contact[]> {
    const list = dbStore.getState().contacts.filter((c) => c.customerId === customerId);
    return JSON.parse(JSON.stringify(list));
  }

  async create(contact: Contact): Promise<Contact> {
    const cloned = JSON.parse(JSON.stringify(contact));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().contacts.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Contact>): Promise<Contact | null> {
    const contacts = dbStore.getState().contacts;
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) return null;
    contacts[idx] = { ...contacts[idx], ...partial };
    return JSON.parse(JSON.stringify(contacts[idx]));
  }

  async delete(id: string): Promise<boolean> {
    const contacts = dbStore.getState().contacts;
    const idx = contacts.findIndex((c) => c.id === id);
    if (idx === -1) return false;
    contacts.splice(idx, 1);
    return true;
  }
}

export class MemoryCatalogRepository implements CatalogRepository {
  async findById(id: string): Promise<CatalogItem | null> {
    const item = dbStore.getState().catalogItems.find((i) => i.id === id);
    return item ? JSON.parse(JSON.stringify(item)) : null;
  }

  async list(params?: PaginationParams & { categoryId?: string; type?: string }): Promise<PaginatedResult<CatalogItem>> {
    let items = [...dbStore.getState().catalogItems];
    if (params?.categoryId) {
      items = items.filter((i) => i.categoryId === params.categoryId);
    }
    if (params?.type) {
      items = items.filter((i) => i.type === params.type);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(query) ||
          (i.sku && i.sku.toLowerCase().includes(query)) ||
          (i.description && i.description.toLowerCase().includes(query))
      );
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return paginateArray(items, params);
  }

  async create(item: CatalogItem): Promise<CatalogItem> {
    const cloned = JSON.parse(JSON.stringify(item));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().catalogItems.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<CatalogItem>): Promise<CatalogItem | null> {
    const items = dbStore.getState().catalogItems;
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    items[idx] = { ...items[idx], ...partial, updatedAt: new Date().toISOString() } as CatalogItem;
    return JSON.parse(JSON.stringify(items[idx]));
  }

  async delete(id: string): Promise<boolean> {
    const items = dbStore.getState().catalogItems;
    const idx = items.findIndex((i) => i.id === id);
    if (idx === -1) return false;
    items.splice(idx, 1);
    return true;
  }

  async listCategories(): Promise<Category[]> {
    return JSON.parse(JSON.stringify(dbStore.getState().categories));
  }

  async count(): Promise<number> {
    return dbStore.getState().catalogItems.length;
  }
}

export class MemoryInvoiceRepository implements InvoiceRepository {
  async findById(id: string): Promise<Invoice | null> {
    const inv = dbStore.getState().invoices.find((i) => i.id === id);
    return inv ? JSON.parse(JSON.stringify(inv)) : null;
  }

  async findByQuotationId(quotationId: string): Promise<Invoice | null> {
    const inv = dbStore.getState().invoices.find((i) => i.quotationId === quotationId);
    return inv ? JSON.parse(JSON.stringify(inv)) : null;
  }

  async list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<Invoice>> {
    let items = [...dbStore.getState().invoices];
    if (params?.customerId) {
      items = items.filter((inv) => inv.customerId === params.customerId);
    }
    if (params?.quotationIds) {
      const qSet = new Set(params.quotationIds);
      items = items.filter((inv) => qSet.has(inv.quotationId));
    }
    if (params?.status) {
      items = items.filter((inv) => inv.status === params.status);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(query) ||
          inv.quotationNumber.toLowerCase().includes(query) ||
          inv.customerBusinessName.toLowerCase().includes(query)
      );
    }
    items.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    return paginateArray(items, params);
  }

  async create(invoice: Invoice): Promise<Invoice> {
    const cloned = JSON.parse(JSON.stringify(invoice));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().invoices.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Invoice>): Promise<Invoice | null> {
    const invoices = dbStore.getState().invoices;
    const idx = invoices.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    invoices[idx] = { ...invoices[idx], ...partial };
    return JSON.parse(JSON.stringify(invoices[idx]));
  }

  async count(): Promise<number> {
    return dbStore.getState().invoices.length;
  }
}

export class MemoryOperationRepository implements OperationRepository {
  async findById(id: string): Promise<OperationOrder | null> {
    const op = dbStore.getState().operations.find((o) => o.id === id);
    return op ? JSON.parse(JSON.stringify(op)) : null;
  }

  async findByQuotationId(quotationId: string): Promise<OperationOrder | null> {
    const op = dbStore.getState().operations.find((o) => o.quotationId === quotationId);
    return op ? JSON.parse(JSON.stringify(op)) : null;
  }

  async list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<OperationOrder>> {
    let items = [...dbStore.getState().operations];
    if (params?.customerId) {
      items = items.filter((op) => op.customerId === params.customerId);
    }
    if (params?.quotationIds) {
      const qSet = new Set(params.quotationIds);
      items = items.filter((op) => qSet.has(op.quotationId));
    }
    if (params?.status) {
      items = items.filter((op) => op.status === params.status);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (op) =>
          op.orderNumber.toLowerCase().includes(query) ||
          op.quotationNumber.toLowerCase().includes(query) ||
          op.title.toLowerCase().includes(query) ||
          op.customerBusinessName.toLowerCase().includes(query)
      );
    }
    items.sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime());
    return paginateArray(items, params);
  }

  async create(operation: OperationOrder): Promise<OperationOrder> {
    const cloned = JSON.parse(JSON.stringify(operation));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().operations.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<OperationOrder>): Promise<OperationOrder | null> {
    const operations = dbStore.getState().operations;
    const idx = operations.findIndex((o) => o.id === id);
    if (idx === -1) return null;
    operations[idx] = { ...operations[idx], ...partial };
    return JSON.parse(JSON.stringify(operations[idx]));
  }

  async count(): Promise<number> {
    return dbStore.getState().operations.length;
  }
}

export class MemoryAuditRepository implements AuditRepository {
  async create(log: AuditLog): Promise<AuditLog> {
    const cloned = JSON.parse(JSON.stringify(log));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    if (!cloned.timestamp) cloned.timestamp = new Date().toISOString();
    dbStore.getState().auditLogs.unshift(cloned);
    return cloned;
  }

  async list(params?: PaginationParams & { entity?: string; action?: string; userId?: string }): Promise<PaginatedResult<AuditLog>> {
    let items = [...dbStore.getState().auditLogs];
    if (params?.entity) {
      items = items.filter((l) => l.entity === params.entity);
    }
    if (params?.action) {
      items = items.filter((l) => l.action === params.action);
    }
    if (params?.userId) {
      items = items.filter((l) => l.userId === params.userId);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter((l) => {
        const text = (l.summary || l.description || '').toLowerCase();
        const user = (l.userName || l.actorName || '').toLowerCase();
        const entity = (l.entityId || '').toLowerCase();
        return text.includes(query) || user.includes(query) || entity.includes(query);
      });
    }
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return paginateArray(items, params);
  }

  async count(): Promise<number> {
    return dbStore.getState().auditLogs.length;
  }
}

export class MemoryNotificationRepository implements NotificationRepository {
  async findById(id: string): Promise<OutboxMessage | null> {
    const msg = dbStore.getState().outbox.find((m) => m.id === id);
    return msg ? JSON.parse(JSON.stringify(msg)) : null;
  }

  async list(params?: PaginationParams & { status?: string; channel?: string }): Promise<PaginatedResult<OutboxMessage>> {
    let items = [...dbStore.getState().outbox];
    if (params?.status) {
      items = items.filter((m) => m.status === params.status);
    }
    if (params?.channel) {
      items = items.filter((m) => m.channel === params.channel);
    }
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (m) =>
          (m.recipientEmail && m.recipientEmail.toLowerCase().includes(query)) ||
          (m.recipient && m.recipient.toLowerCase().includes(query)) ||
          (m.recipientName && m.recipientName.toLowerCase().includes(query)) ||
          (m.quotationNumber && m.quotationNumber.toLowerCase().includes(query))
      );
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return paginateArray(items, params);
  }

  async create(msg: OutboxMessage): Promise<OutboxMessage> {
    const cloned = JSON.parse(JSON.stringify(msg));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().outbox.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<OutboxMessage>): Promise<OutboxMessage | null> {
    const outbox = dbStore.getState().outbox;
    const idx = outbox.findIndex((m) => m.id === id);
    if (idx === -1) return null;
    outbox[idx] = { ...outbox[idx], ...partial };
    return JSON.parse(JSON.stringify(outbox[idx]));
  }

  async findPending(): Promise<OutboxMessage[]> {
    const pending = dbStore.getState().outbox.filter((m) => m.status === 'PENDING');
    return JSON.parse(JSON.stringify(pending));
  }

  async count(): Promise<number> {
    return dbStore.getState().outbox.length;
  }
}

export class MemoryCompanyRepository implements CompanyRepository {
  async get(): Promise<CompanySettings> {
    return JSON.parse(JSON.stringify(dbStore.getState().company));
  }

  async update(partial: Partial<CompanySettings>): Promise<CompanySettings> {
    const current = dbStore.getState().company;
    dbStore.getState().company = { ...current, ...partial };
    return JSON.parse(JSON.stringify(dbStore.getState().company));
  }
}

export class MemoryUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const u = dbStore.getState().users.find((item) => item.id === id);
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const u = dbStore.getState().users.find((item) => item.email.toLowerCase() === email.toLowerCase());
    return u ? JSON.parse(JSON.stringify(u)) : null;
  }

  async list(params?: PaginationParams): Promise<PaginatedResult<User>> {
    let items = [...dbStore.getState().users];
    if (params?.q) {
      const query = params.q.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.role.toLowerCase().includes(query)
      );
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return paginateArray(items, params);
  }

  async create(user: User): Promise<User> {
    const cloned = JSON.parse(JSON.stringify(user));
    if (!cloned.id) cloned.id = crypto.randomUUID();
    dbStore.getState().users.push(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<User>): Promise<User | null> {
    const users = dbStore.getState().users;
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return null;
    users[idx] = { ...users[idx], ...partial };
    return JSON.parse(JSON.stringify(users[idx]));
  }

  async delete(id: string): Promise<boolean> {
    const users = dbStore.getState().users;
    const idx = users.findIndex((u) => u.id === id);
    if (idx === -1) return false;
    users.splice(idx, 1);
    return true;
  }

  async count(): Promise<number> {
    return dbStore.getState().users.length;
  }
}

export class MemoryCounterRepository implements CounterRepository {
  private counters: Record<string, number> = {
    quotation: 30, // Seed quotations count
    invoice: 12,
    operation: 10,
  };

  async getNextSequence(counterName: 'quotation' | 'invoice' | 'operation'): Promise<number> {
    if (!this.counters[counterName]) {
      this.counters[counterName] = 0;
    }
    this.counters[counterName] += 1;
    return this.counters[counterName];
  }
}
