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
} from '../../modules/types.js';

export interface PaginationParams {
  page?: number;
  pageSize?: number;
  q?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface QuotationRepository {
  findById(id: string): Promise<Quotation | null>;
  findByNumber(quotationNumber: string): Promise<Quotation | null>;
  findByPublicToken(token: string): Promise<Quotation | null>;
  list(params?: PaginationParams & { salesRepId?: string; customerId?: string }): Promise<PaginatedResult<Quotation>>;
  create(quotation: Quotation): Promise<Quotation>;
  update(id: string, partial: Partial<Quotation>): Promise<Quotation | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface CustomerRepository {
  findById(id: string): Promise<Customer | null>;
  list(params?: PaginationParams): Promise<PaginatedResult<Customer>>;
  create(customer: Customer): Promise<Customer>;
  update(id: string, partial: Partial<Customer>): Promise<Customer | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface ContactRepository {
  findById(id: string): Promise<Contact | null>;
  findByTokenHash(tokenHash: string): Promise<Contact | null>;
  listByCustomerId(customerId: string): Promise<Contact[]>;
  create(contact: Contact): Promise<Contact>;
  update(id: string, partial: Partial<Contact>): Promise<Contact | null>;
  delete(id: string): Promise<boolean>;
}

export interface CatalogRepository {
  findById(id: string): Promise<CatalogItem | null>;
  list(params?: PaginationParams & { categoryId?: string; type?: string }): Promise<PaginatedResult<CatalogItem>>;
  create(item: CatalogItem): Promise<CatalogItem>;
  update(id: string, partial: Partial<CatalogItem>): Promise<CatalogItem | null>;
  delete(id: string): Promise<boolean>;
  listCategories(): Promise<Category[]>;
  count(): Promise<number>;
}

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByQuotationId(quotationId: string): Promise<Invoice | null>;
  list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<Invoice>>;
  create(invoice: Invoice): Promise<Invoice>;
  update(id: string, partial: Partial<Invoice>): Promise<Invoice | null>;
  count(): Promise<number>;
}

export interface OperationRepository {
  findById(id: string): Promise<OperationOrder | null>;
  findByQuotationId(quotationId: string): Promise<OperationOrder | null>;
  list(params?: PaginationParams & { customerId?: string; quotationIds?: string[] }): Promise<PaginatedResult<OperationOrder>>;
  create(operation: OperationOrder): Promise<OperationOrder>;
  update(id: string, partial: Partial<OperationOrder>): Promise<OperationOrder | null>;
  count(): Promise<number>;
}

export interface AuditRepository {
  create(log: AuditLog): Promise<AuditLog>;
  list(params?: PaginationParams & { entity?: string; action?: string; userId?: string }): Promise<PaginatedResult<AuditLog>>;
  count(): Promise<number>;
}

export interface NotificationRepository {
  findById(id: string): Promise<OutboxMessage | null>;
  list(params?: PaginationParams & { status?: string; channel?: string }): Promise<PaginatedResult<OutboxMessage>>;
  create(msg: OutboxMessage): Promise<OutboxMessage>;
  update(id: string, partial: Partial<OutboxMessage>): Promise<OutboxMessage | null>;
  findPending(): Promise<OutboxMessage[]>;
  count(): Promise<number>;
}

export interface CompanyRepository {
  get(): Promise<CompanySettings>;
  update(partial: Partial<CompanySettings>): Promise<CompanySettings>;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  list(params?: PaginationParams): Promise<PaginatedResult<User>>;
  create(user: User): Promise<User>;
  update(id: string, partial: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
}

export interface CounterRepository {
  getNextSequence(counterName: 'quotation' | 'invoice' | 'operation'): Promise<number>;
}
