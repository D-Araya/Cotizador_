import crypto from 'node:crypto';
import type { Firestore } from 'firebase-admin/firestore';
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

function applyMemoryPagination<T>(items: T[], params?: PaginationParams): PaginatedResult<T> {
  const total = items.length;
  if (!params || (params.page === undefined && params.pageSize === undefined)) {
    return { items, total };
  }
  const page = Math.max(1, Number(params.page) || 1);
  const pageSize = Math.max(1, Number(params.pageSize) || 20);
  const start = (page - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), total, page, pageSize };
}

export class FirestoreQuotationRepository implements QuotationRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Quotation | null> {
    const doc = await this.db.collection('quotations').doc(id).get();
    return doc.exists ? (doc.data() as Quotation) : null;
  }

  async findByNumber(quotationNumber: string): Promise<Quotation | null> {
    const snap = await this.db.collection('quotations').where('quotationNumber', '==', quotationNumber).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Quotation);
  }

  async findByPublicToken(token: string): Promise<Quotation | null> {
    const snap = await this.db.collection('quotations').where('publicToken', '==', token).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Quotation);
  }

  async list(params?: PaginationParams & { salesRepId?: string; customerId?: string }): Promise<PaginatedResult<Quotation>> {
    let query: FirebaseFirestore.Query = this.db.collection('quotations');
    if (params?.salesRepId) query = query.where('salesRepId', '==', params.salesRepId);
    if (params?.customerId) query = query.where('customerId', '==', params.customerId);
    if (params?.status) query = query.where('status', '==', params.status);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as Quotation);

    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (item) =>
          item.quotationNumber.toLowerCase().includes(q) ||
          (item.title && item.title.toLowerCase().includes(q)) ||
          (item.customerBusinessName && item.customerBusinessName.toLowerCase().includes(q))
      );
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return applyMemoryPagination(items, params);
  }

  async create(quotation: Quotation): Promise<Quotation> {
    const cloned = { ...quotation };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('quotations').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Quotation>): Promise<Quotation | null> {
    const ref = this.db.collection('quotations').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial, updatedAt: new Date().toISOString() } as Quotation;
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.db.collection('quotations').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('quotations').count().get();
    return snap.data().count;
  }
}

export class FirestoreCustomerRepository implements CustomerRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Customer | null> {
    const doc = await this.db.collection('customers').doc(id).get();
    return doc.exists ? (doc.data() as Customer) : null;
  }

  async list(params?: PaginationParams): Promise<PaginatedResult<Customer>> {
    const snap = await this.db.collection('customers').get();
    let items = snap.docs.map((d) => d.data() as Customer);
    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (c) =>
          c.businessName.toLowerCase().includes(q) ||
          (c.rut && c.rut.toLowerCase().includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      );
    }
    items.sort((a, b) => a.businessName.localeCompare(b.businessName));
    return applyMemoryPagination(items, params);
  }

  async create(customer: Customer): Promise<Customer> {
    const cloned = { ...customer };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('customers').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Customer>): Promise<Customer | null> {
    const ref = this.db.collection('customers').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial, updatedAt: new Date().toISOString() } as Customer;
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.db.collection('customers').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('customers').count().get();
    return snap.data().count;
  }
}

export class FirestoreContactRepository implements ContactRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Contact | null> {
    const doc = await this.db.collection('contacts').doc(id).get();
    return doc.exists ? (doc.data() as Contact) : null;
  }

  async findByTokenHash(tokenHash: string): Promise<Contact | null> {
    const snap = await this.db
      .collection('contacts')
      .where('portalTokenHash', '==', tokenHash)
      .where('portalTokenRevoked', '==', false)
      .limit(1)
      .get();
    return snap.empty ? null : (snap.docs[0].data() as Contact);
  }

  async listByCustomerId(customerId: string): Promise<Contact[]> {
    const snap = await this.db.collection('contacts').where('customerId', '==', customerId).get();
    return snap.docs.map((d) => d.data() as Contact);
  }

  async create(contact: Contact): Promise<Contact> {
    const cloned = { ...contact };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('contacts').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Contact>): Promise<Contact | null> {
    const ref = this.db.collection('contacts').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial } as Contact;
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.db.collection('contacts').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }
}

export class FirestoreCatalogRepository implements CatalogRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<CatalogItem | null> {
    const doc = await this.db.collection('catalogItems').doc(id).get();
    return doc.exists ? (doc.data() as CatalogItem) : null;
  }

  async list(params?: PaginationParams & { categoryId?: string; type?: string }): Promise<PaginatedResult<CatalogItem>> {
    let query: FirebaseFirestore.Query = this.db.collection('catalogItems');
    if (params?.categoryId) query = query.where('categoryId', '==', params.categoryId);
    if (params?.type) query = query.where('type', '==', params.type);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as CatalogItem);

    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.sku && i.sku.toLowerCase().includes(q)) ||
          (i.description && i.description.toLowerCase().includes(q))
      );
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return applyMemoryPagination(items, params);
  }

  async create(item: CatalogItem): Promise<CatalogItem> {
    const cloned = { ...item };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('catalogItems').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<CatalogItem>): Promise<CatalogItem | null> {
    const ref = this.db.collection('catalogItems').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial, updatedAt: new Date().toISOString() } as CatalogItem;
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.db.collection('catalogItems').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async listCategories(): Promise<Category[]> {
    const snap = await this.db.collection('categories').get();
    return snap.docs.map((d) => d.data() as Category);
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('catalogItems').count().get();
    return snap.data().count;
  }
}

export class FirestoreInvoiceRepository implements InvoiceRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<Invoice | null> {
    const doc = await this.db.collection('invoices').doc(id).get();
    return doc.exists ? (doc.data() as Invoice) : null;
  }

  async findByQuotationId(quotationId: string): Promise<Invoice | null> {
    const snap = await this.db.collection('invoices').where('quotationId', '==', quotationId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as Invoice);
  }

  async list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<Invoice>> {
    let query: FirebaseFirestore.Query = this.db.collection('invoices');
    if (params?.customerId) query = query.where('customerId', '==', params.customerId);
    if (params?.status) query = query.where('status', '==', params.status);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as Invoice);

    if (params?.quotationIds) {
      const qSet = new Set(params.quotationIds);
      items = items.filter((inv) => qSet.has(inv.quotationId));
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (inv) =>
          inv.invoiceNumber.toLowerCase().includes(q) ||
          inv.quotationNumber.toLowerCase().includes(q) ||
          inv.customerBusinessName.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime());
    return applyMemoryPagination(items, params);
  }

  async create(invoice: Invoice): Promise<Invoice> {
    const cloned = { ...invoice };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('invoices').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<Invoice>): Promise<Invoice | null> {
    const ref = this.db.collection('invoices').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial } as Invoice;
    await ref.set(updated);
    return updated;
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('invoices').count().get();
    return snap.data().count;
  }
}

export class FirestoreOperationRepository implements OperationRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<OperationOrder | null> {
    const doc = await this.db.collection('operations').doc(id).get();
    return doc.exists ? (doc.data() as OperationOrder) : null;
  }

  async findByQuotationId(quotationId: string): Promise<OperationOrder | null> {
    const snap = await this.db.collection('operations').where('quotationId', '==', quotationId).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as OperationOrder);
  }

  async list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<OperationOrder>> {
    let query: FirebaseFirestore.Query = this.db.collection('operations');
    if (params?.customerId) query = query.where('customerId', '==', params.customerId);
    if (params?.status) query = query.where('status', '==', params.status);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as OperationOrder);

    if (params?.quotationIds) {
      const qSet = new Set(params.quotationIds);
      items = items.filter((op) => qSet.has(op.quotationId));
    }
    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (op) =>
          op.orderNumber.toLowerCase().includes(q) ||
          op.quotationNumber.toLowerCase().includes(q) ||
          op.title.toLowerCase().includes(q) ||
          op.customerBusinessName.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => new Date(b.scheduledDate || '').getTime() - new Date(a.scheduledDate || '').getTime());
    return applyMemoryPagination(items, params);
  }

  async create(operation: OperationOrder): Promise<OperationOrder> {
    const cloned = { ...operation };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('operations').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<OperationOrder>): Promise<OperationOrder | null> {
    const ref = this.db.collection('operations').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial } as OperationOrder;
    await ref.set(updated);
    return updated;
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('operations').count().get();
    return snap.data().count;
  }
}

export class FirestoreAuditRepository implements AuditRepository {
  constructor(private db: Firestore) {}

  async create(log: AuditLog): Promise<AuditLog> {
    const cloned = { ...log };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    if (!cloned.timestamp) cloned.timestamp = new Date().toISOString();
    await this.db.collection('auditLogs').doc(cloned.id).set(cloned);
    return cloned;
  }

  async list(params?: PaginationParams & { entity?: string; action?: string; userId?: string }): Promise<PaginatedResult<AuditLog>> {
    let query: FirebaseFirestore.Query = this.db.collection('auditLogs');
    if (params?.entity) query = query.where('entity', '==', params.entity);
    if (params?.action) query = query.where('action', '==', params.action);
    if (params?.userId) query = query.where('userId', '==', params.userId);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as AuditLog);

    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter((l) => {
        const text = (l.summary || l.description || '').toLowerCase();
        const user = (l.userName || l.actorName || '').toLowerCase();
        const entity = (l.entityId || '').toLowerCase();
        return text.includes(q) || user.includes(q) || entity.includes(q);
      });
    }
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return applyMemoryPagination(items, params);
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('auditLogs').count().get();
    return snap.data().count;
  }
}

export class FirestoreNotificationRepository implements NotificationRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<OutboxMessage | null> {
    const doc = await this.db.collection('outbox').doc(id).get();
    return doc.exists ? (doc.data() as OutboxMessage) : null;
  }

  async list(params?: PaginationParams & { status?: string; channel?: string }): Promise<PaginatedResult<OutboxMessage>> {
    let query: FirebaseFirestore.Query = this.db.collection('outbox');
    if (params?.status) query = query.where('status', '==', params.status);
    if (params?.channel) query = query.where('channel', '==', params.channel);

    const snap = await query.get();
    let items = snap.docs.map((d) => d.data() as OutboxMessage);

    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (m) =>
          (m.recipientEmail && m.recipientEmail.toLowerCase().includes(q)) ||
          (m.recipient && m.recipient.toLowerCase().includes(q)) ||
          (m.recipientName && m.recipientName.toLowerCase().includes(q)) ||
          (m.quotationNumber && m.quotationNumber.toLowerCase().includes(q))
      );
    }
    items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return applyMemoryPagination(items, params);
  }

  async create(msg: OutboxMessage): Promise<OutboxMessage> {
    const cloned = { ...msg };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('outbox').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<OutboxMessage>): Promise<OutboxMessage | null> {
    const ref = this.db.collection('outbox').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial } as OutboxMessage;
    await ref.set(updated);
    return updated;
  }

  async findPending(): Promise<OutboxMessage[]> {
    const snap = await this.db.collection('outbox').where('status', '==', 'PENDING').get();
    return snap.docs.map((d) => d.data() as OutboxMessage);
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('outbox').count().get();
    return snap.data().count;
  }
}

export class FirestoreCompanyRepository implements CompanyRepository {
  constructor(private db: Firestore) {}

  async get(): Promise<CompanySettings> {
    const doc = await this.db.collection('system').doc('company').get();
    if (!doc.exists) {
      throw new Error('Company settings not found in Firestore');
    }
    return doc.data() as CompanySettings;
  }

  async update(partial: Partial<CompanySettings>): Promise<CompanySettings> {
    const ref = this.db.collection('system').doc('company');
    const doc = await ref.get();
    const current = doc.exists ? (doc.data() as CompanySettings) : ({} as CompanySettings);
    const updated = { ...current, ...partial };
    await ref.set(updated);
    return updated;
  }
}

export class FirestoreUserRepository implements UserRepository {
  constructor(private db: Firestore) {}

  async findById(id: string): Promise<User | null> {
    const doc = await this.db.collection('users').doc(id).get();
    return doc.exists ? (doc.data() as User) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const snap = await this.db.collection('users').where('email', '==', email.toLowerCase()).limit(1).get();
    return snap.empty ? null : (snap.docs[0].data() as User);
  }

  async list(params?: PaginationParams): Promise<PaginatedResult<User>> {
    const snap = await this.db.collection('users').get();
    let items = snap.docs.map((d) => d.data() as User);
    if (params?.q) {
      const q = params.q.toLowerCase();
      items = items.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
      );
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    return applyMemoryPagination(items, params);
  }

  async create(user: User): Promise<User> {
    const cloned = { ...user };
    if (!cloned.id) cloned.id = crypto.randomUUID();
    await this.db.collection('users').doc(cloned.id).set(cloned);
    return cloned;
  }

  async update(id: string, partial: Partial<User>): Promise<User | null> {
    const ref = this.db.collection('users').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return null;
    const updated = { ...doc.data(), ...partial } as User;
    await ref.set(updated);
    return updated;
  }

  async delete(id: string): Promise<boolean> {
    const ref = this.db.collection('users').doc(id);
    const doc = await ref.get();
    if (!doc.exists) return false;
    await ref.delete();
    return true;
  }

  async count(): Promise<number> {
    const snap = await this.db.collection('users').count().get();
    return snap.data().count;
  }
}

export class FirestoreCounterRepository implements CounterRepository {
  constructor(private db: Firestore) {}

  async getNextSequence(counterName: 'quotation' | 'invoice' | 'operation'): Promise<number> {
    const counterRef = this.db.collection('system_counters').doc(counterName);
    return this.db.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let currentVal = 0;
      if (doc.exists) {
        currentVal = doc.data()?.current || 0;
      } else {
        // Inicializar según conteo inicial de semilla
        if (counterName === 'quotation') currentVal = 30;
        if (counterName === 'invoice') currentVal = 12;
        if (counterName === 'operation') currentVal = 10;
      }
      const nextVal = currentVal + 1;
      transaction.set(counterRef, { current: nextVal, updatedAt: new Date().toISOString() });
      return nextVal;
    });
  }
}
