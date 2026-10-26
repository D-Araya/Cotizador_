export type UserRole = 'ADMIN' | 'SALES_REP' | 'CUSTOMER_CONTACT';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  active: boolean;
  customerId?: string; // Para contactos de clientes
  contactId?: string;
  mustChangePassword?: boolean;
  deletedAt?: string;
  passwordHash?: string;
  passwordSalt?: string;
  permissions?: Permission[];
}

export interface Customer {
  id: string;
  businessName: string;
  taxId: string; // RUT
  rut?: string;
  email?: string;
  address: string;
  salesRepId: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  deletedAt?: string;
}

export interface Contact {
  id: string;
  customerId: string;
  name: string;
  position: string;
  email: string;
  phone: string; // WhatsApp
  active: boolean;
  portalTokenHash?: string;
  portalTokenExpiresAt?: string;
  portalTokenRevoked?: boolean;
  createdAt: string;
  deletedAt?: string;
}

export interface Category {
  id: string;
  name: string;
  description: string;
  active: boolean;
}

export type CatalogItemType = 'PRODUCT' | 'SERVICE';

export interface BaseCatalogItem {
  id: string;
  type: CatalogItemType;
  name: string;
  description: string;
  categoryId: string;
  unitCost: number;
  listPrice: number;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  sku?: string;
  isKit?: boolean;
  kitItems?: Array<{ catalogItemId: string; quantity: number }>;
}

export interface ProductCatalogItem extends BaseCatalogItem {
  type: 'PRODUCT';
  sku: string;
  unit: string; // 'UND' | 'KG' | 'M' | 'M2' | 'L' | 'CAJA'
  brand?: string;
}

export interface ServiceCatalogItem extends BaseCatalogItem {
  type: 'SERVICE';
  code?: string;
  unit: string; // 'HORA' | 'DIA' | 'MES' | 'VISITA' | 'GLOBAL'
  estimatedDuration?: string;
}

export type CatalogItem = ProductCatalogItem | ServiceCatalogItem;

export interface CompanySettings {
  id: string;
  name: string;
  legalName: string;
  rut: string;
  address: string;
  phone: string;
  email: string;
  logoUrl?: string;
  currency: string; // 'CLP' | 'USD'
  taxRatePct: number; // e.g. 19.00 (IVA)
  minMarginPct: number; // e.g. 28.00
  hardMinMarginPct?: number; // e.g. 18.00 (P3.l Piso duro no negociable)
  ufRate?: number; // e.g. 38500.00 (P3.m Valor configurable por día de la UF)
  ufRateUpdatedAt?: string;
  defaultPresentationText: string;
  defaultTerms: string;
  sessionTimeoutMinutes: number;
  lossReasons?: string[];
  pipelineProbabilities?: Record<string, number>;
}

export type QuotationStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL' // P3.l Pendiente de aprobación de margen
  | 'SENT'
  | 'VIEWED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'CHANGES_REQUESTED';

export type PaymentMilestoneStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';

export interface PaymentMilestone {
  id: string;
  label: string; // ej. "Anticipo 50%", "Contra entrega 50%"
  percentage: number;
  amount: number;
  dueDate: string;
  status: PaymentMilestoneStatus;
  paidAmount: number;
  paidAt?: string;
}

export type PaymentMethod =
  | 'TRANSFER'
  | 'CHECK'
  | 'VALE_VISTA'
  | 'CREDIT_CARD'
  | 'DEBIT_CARD'
  | 'CASH'
  | 'TRANSFERENCIA_BANCARIA'
  | 'CHEQUE'
  | 'EFECTIVO'
  | 'TARJETA_CREDITO'
  | 'WEBPAY'
  | 'OTRO';

export interface InvoicePaymentRecord {
  id: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentMethodLabel?: string;
  reference: string;
  paymentDate: string;
  notes?: string;
  registeredBy: string;
  registeredAt?: string;
  createdAt?: string;
}

export type Permission =
  | 'quotations:read_all'
  | 'quotations:read_own'
  | 'quotations:create'
  | 'quotations:edit'
  | 'quotations:create_on_behalf'
  | 'customers:create'
  | 'customers:edit'
  | 'customers:deactivate'
  | 'contacts:create'
  | 'contacts:edit'
  | 'contacts:deactivate'
  | 'contacts:send_magic_link'
  | 'catalog:create'
  | 'catalog:edit'
  | 'catalog:deactivate'
  | 'company:edit'
  | 'company:read'
  | 'users:manage'
  | 'invoices:read_all'
  | 'invoices:read_own'
  | 'invoices:register_payment'
  | 'invoices:create'
  | 'operations:read_all'
  | 'operations:read_own'
  | 'operations:update'
  | 'audit:read_all'
  | 'audit:read_own'
  | 'outbox:read_all'
  | 'outbox:read_own'
  | 'system:backup'
  | 'system:restore'
  | 'dashboard:global'
  | 'dashboard:by_sales_rep'
  | 'dashboard:own'
  | 'ai:chat';

export interface QuotationLine {
  id: string;
  catalogItemId?: string;
  type: CatalogItemType;
  skuOrCode?: string;
  name: string;
  unit: string;
  cost: number;
  price: number;
  marginPct: number;
  quantity: number;
  subtotal: number;
  costTotal: number;
  discountPct?: number;
  discountAmount?: number;
  originalUnitPrice?: number;
}

export interface ExtraCostLine {
  id: string;
  catalogItemId?: string;
  type: CatalogItemType;
  name: string;
  unit: string;
  cost: number;
  price: number;
  quantity: number;
  subtotal: number;
  notes?: string;
}

export interface StatusHistoryEntry {
  id: string;
  fromStatus: QuotationStatus | null;
  toStatus: QuotationStatus;
  actor: string;
  actorRole: UserRole | 'SYSTEM';
  comment: string;
  timestamp: string;
}

export interface Quotation {
  id: string;
  quotationNumber: string; // COT-000259 o COT-000259-R2
  quotationGroupId?: string;
  revision?: number;
  isLatestRevision?: boolean;
  supersededByQuotationId?: string;
  rootQuotationNumber?: string;
  customerId: string;
  customerBusinessName?: string;
  contactId: string;
  salesRepId: string;
  salesRepName?: string;
  title?: string;
  status: QuotationStatus;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  validityDays: number;
  validUntil?: string;
  currency?: string;
  taxRatePct?: number;
  publicToken: string;
  minMarginPctApplied: number;
  presentationText: string;
  notes: string;
  internalNotes?: string;
  terms: string;
  termsAccepted: boolean;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  lossReason?: string;
  nextActionAt?: string;
  nextActionNote?: string;
  firstViewedAt?: string;
  viewedAt?: string;
  lines: QuotationLine[];
  extraCosts: ExtraCostLine[];
  statusHistory: StatusHistoryEntry[];
  // Descuentos y ahorro
  discountPct?: number;
  discountAmount?: number;
  totalSavings?: number;
  grossSubtotal?: number;
  // Evidencia de aceptación online
  clientSignerName?: string;
  clientSignerPosition?: string;
  clientIp?: string;
  clientUserAgentHash?: string;
  acceptanceHash?: string;
  // Evidencia de aceptación offline por personal
  acceptedOffline?: boolean;
  offlinePurchaseOrderNumber?: string;
  offlineAcceptedBy?: string;
  offlineNote?: string;
  // P3.l Excepción de margen con aprobación
  marginException?: boolean;
  marginExceptionReason?: string;
  marginApprovalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'NONE';
  marginApprovedBy?: string;
  marginApprovedByName?: string;
  marginApprovedAt?: string;
  marginApprovalComment?: string;
  // P3.m Moneda UF
  ufRate?: number;
  ufNetSubtotal?: number;
  ufGrandTotal?: number;
  // P3.n Adjuntos (enlaces a archivos)
  attachments?: QuotationAttachment[];
  // Totales calculados
  totalCost: number;
  totalSale: number;
  profit: number;
  marginPct: number;
  subtotal: number;
  netSubtotal?: number;
  taxAmount: number;
  total?: number;
  grandTotal: number;
  extraCostsTotal: number;
  paymentTerms?: string;
}

export interface QuotationAttachment {
  id: string;
  name: string;
  url: string;
  description?: string;
  addedAt: string;
  addedBy?: string;
  addedByName?: string;
}

export interface DeliverableAttachment {
  id: string;
  name: string;
  url: string;
  description?: string;
  addedAt: string;
}

export interface OutboxMessage {
  id: string;
  quotationId?: string;
  quotationNumber?: string;
  channel: 'EMAIL' | 'WHATSAPP';
  recipient: string;
  recipientEmail?: string;
  recipientName: string;
  recipientPhone?: string;
  subject?: string;
  body: string;
  bodyPreview?: string;
  status: 'PENDING' | 'SENT' | 'FAILED' | 'PENDING_MANUAL';
  retries: number;
  attempts?: number;
  maxAttempts?: number;
  createdAt: string;
  sentAt?: string;
  error?: string;
  deliveryError?: string;
  whatsAppUrl?: string;
}

export type InvoiceStatus = 'PAID' | 'PENDING' | 'PARTIAL' | 'OVERDUE' | 'ISSUED' | 'CANCELLED';

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string; // DC-000001
  quotationId: string;
  quotationNumber: string;
  customerId: string;
  customerBusinessName: string;
  customerTaxId?: string;
  issueDate: string;
  dueDate: string;
  subtotal?: number;
  netSubtotal?: number;
  taxRatePct?: number;
  taxAmount: number;
  total: number;
  paidAmount?: number;
  balance?: number;
  status: InvoiceStatus;
  paymentMethod?: string;
  paymentTerms: string;
  paidAt?: string;
  items: InvoiceItem[];
  paymentSchedule?: PaymentMilestone[];
  payments?: InvoicePaymentRecord[];
}

export type OperationType = 'PRODUCT_DELIVERY' | 'SERVICE_EXECUTION';
export type OperationStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';

export type OperationMilestoneStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export interface OperationMilestone {
  id: string;
  name: string;
  date: string;
  status: OperationMilestoneStatus;
  completedAt?: string;
}

export type OperationDeliverableStatus = 'PENDING' | 'READY' | 'DELIVERED';
export interface OperationDeliverable {
  id: string;
  name: string;
  status: OperationDeliverableStatus;
  link?: string;
  attachments?: DeliverableAttachment[];
}

export interface OperationOrder {
  id: string;
  orderNumber: string; // OP-2026-0042
  quotationId: string;
  quotationNumber: string;
  customerId: string;
  customerBusinessName: string;
  type: OperationType;
  title: string;
  description: string;
  status: OperationStatus;
  progressPct: number; // 0 - 100 calculado exclusivamente desde los hitos
  assignedStaff: string;
  scheduledDate: string;
  completedDate?: string;
  deliveryAddress?: string;
  guideNumber?: string; // T001-000215
  itemsIncluded: string[];
  milestones?: OperationMilestone[];
  deliverables?: OperationDeliverable[];
}

export interface QuotationTemplateLine {
  catalogItemId: string;
  quantity: number;
  discountPct?: number;
}

export interface QuotationTemplate {
  id: string;
  name: string;
  categoryId: string;
  categoryName?: string;
  description?: string;
  lines: QuotationTemplateLine[];
  terms: string;
  presentationText?: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export type AuditLogEntity =
  | 'CATALOG'
  | 'CUSTOMERS'
  | 'CONTACTS'
  | 'QUOTATIONS'
  | 'COMPANY'
  | 'USERS'
  | 'INVOICES'
  | 'OPERATIONS'
  | 'OUTBOX'
  | 'SYSTEM';

export type AuditLogAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'STATUS_CHANGE'
  | string;

export interface AuditLog {
  id: string;
  entity: AuditLogEntity | string;
  action: AuditLogAction | string;
  entityId: string;
  entityName?: string;
  description: string;
  summary?: string;
  actorId?: string;
  actorName?: string;
  actorRole?: UserRole | 'SYSTEM';
  userId?: string;
  userName?: string;
  userRole?: string;
  timestamp: string;
  metadata?: Record<string, any>;
  before?: any;
  after?: any;
}

export type OutboxNotification = OutboxMessage;

export interface DashboardSummary {
  totalQuotations?: number;
  totalQuotes?: number;
  accepted?: number;
  totalAccepted?: number;
  sent?: number;
  totalSent?: number;
  viewed?: number;
  totalViewed?: number;
  drafts?: number;
  rejected?: number;
  totalRejected?: number;
  totalValue?: number;
  acceptedValue?: number;
  totalAcceptedSales?: number;
  acceptanceRate?: number;
  avgMargin?: number;
  avgMarginPct?: number;
  totalProfit?: number;
  activeOperations?: number;
  pendingInvoices?: number;
}

export interface SalesRepSummary {
  id?: string;
  salesRepId: string;
  salesRepName?: string;
  name?: string;
  email?: string;
  quotesCount?: number;
  totalWon?: number;
  wonCount?: number;
  conversionRate?: number;
  totalQuotations?: number;
  totalQuotes?: number;
  acceptedQuotations?: number;
  accepted?: number;
  rejected?: number;
  viewed?: number;
  sent?: number;
  totalAmount?: number;
  totalSales?: number;
  avgMarginPct?: number;
  acceptanceRate?: number;
}

export interface QuotationKpis {
  totalPipelineValue?: number;
  weightedPipelineValue?: number;
  averageTicket?: number;
  averageCycleDays?: number;
}


