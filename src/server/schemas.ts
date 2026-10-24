import { z } from 'zod';

// ==========================================
// AUTHENTICATION SCHEMAS
// ==========================================
export const loginSchema = z.object({
  email: z.string().trim().email('Email no válido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const magicLoginSchema = z.object({
  token: z.string().trim().min(10, 'Token de enlace mágico inválido'),
});

export const switchUserSchema = z.object({
  email: z.string().trim().email('Email no válido'),
});

// ==========================================
// QUOTATION SCHEMAS
// ==========================================
export const quotationLineInputSchema = z.object({
  catalogItemId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
  price: z.number().nonnegative('El precio no puede ser negativo').optional(),
  marginPct: z.number().min(0, 'El margen no puede ser negativo').max(99.99, 'El margen debe ser menor a 100%').optional(),
  discountPct: z.number().min(0, 'El descuento no puede ser negativo').max(99.99, 'El descuento debe ser menor al 100%').optional(),
});

export const updateQuotationLinesSchema = z.object({
  lines: z.array(quotationLineInputSchema).min(0),
  discountPct: z.number().min(0).max(99.99).optional(),
  marginExceptionReason: z.string().trim().optional(),
});

export const quotationStatusUpdateSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'CHANGES_REQUESTED', 'EXPIRED']),
  note: z.string().trim().max(1000).optional(),
  internalNotes: z.string().trim().max(2000).optional(),
});

export const quotationMarginApprovalSchema = z.object({
  comment: z.string().trim().max(1000).optional(),
});

export const quotationMarginRejectSchema = z.object({
  comment: z.string().trim().min(1, 'El comentario de rechazo de margen es obligatorio').max(1000),
});

export const quotationMarginRequestSchema = z.object({
  reason: z.string().trim().min(1, 'El motivo de la excepción de margen es obligatorio').max(1000),
});

export const quotationAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del archivo o documento es requerido'),
  url: z.string().trim().refine((val) => {
    if (val.startsWith('data:') || val.startsWith('blob:')) return true;
    try {
      new URL(val);
      return true;
    } catch {
      return false;
    }
  }, 'El enlace debe ser una URL válida o archivo codificado (data: / http: / https:)'),
  description: z.string().trim().max(500).optional(),
});

export const ufRateUpdateSchema = z.object({
  ufRate: z.number().positive('El valor de la UF debe ser mayor a 0'),
});

export const quotationCreateSchema = z.object({
  customerId: z.string().trim().min(1, 'El cliente es requerido'),
  contactId: z.string().trim().optional(),
  salesRepId: z.string().trim().optional(),
  currency: z.string().default('CLP'),
  presentationText: z.string().optional(),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  terms: z.string().optional(),
  validUntil: z.string().optional(),
  validityDays: z.number().int().positive().optional(),
  discountPct: z.number().min(0).max(99.99).optional(),
  marginExceptionReason: z.string().optional(),
  lines: z.array(quotationLineInputSchema).optional(),
});

export const quotationOfflineAcceptSchema = z.object({
  purchaseOrderNumber: z.string().trim().min(1, 'El N.º de Orden de Compra o referencia es requerido'),
  offlineNote: z.string().trim().min(3, 'El motivo o comentario de aceptación es requerido'),
});

export const quotationNextActionSchema = z.object({
  nextActionAt: z.string().trim().nullable().optional(),
  nextActionNote: z.string().trim().optional(),
});

export const quotationRejectSchema = z.object({
  lossReason: z.string().trim().min(1, 'Debe seleccionar un motivo de pérdida'),
  note: z.string().trim().max(1000).optional(),
});

export const publicQuotationAcceptSchema = z.object({
  termsAccepted: z.literal(true, { message: 'Debe aceptar los términos y condiciones' }),
  signerName: z.string().trim().min(2, 'Debe ingresar su nombre completo'),
  signerPosition: z.string().trim().min(2, 'Debe ingresar su cargo en la empresa'),
});

export const recordPaymentSchema = z.object({
  amount: z.number().positive('El monto a abonar debe ser mayor a 0'),
  paymentMethod: z.enum([
    'TRANSFER',
    'CHECK',
    'VALE_VISTA',
    'CREDIT_CARD',
    'DEBIT_CARD',
    'CASH',
    'TRANSFERENCIA_BANCARIA',
    'CHEQUE',
    'EFECTIVO',
    'TARJETA_CREDITO',
    'WEBPAY',
    'OTRO',
  ]),
  reference: z.string().trim().min(1, 'La referencia o comprobante de pago es obligatoria'),
  paymentDate: z.string().trim().optional(),
  notes: z.string().trim().max(1000).optional(),
});

// ==========================================
// CUSTOMER & CONTACT SCHEMAS (White-listed)
// ==========================================
export const customerCreateSchema = z.object({
  businessName: z.string().trim().min(2, 'La razón social es requerida'),
  taxId: z.string().trim().min(6, 'El RUT es requerido'),
  address: z.string().trim().min(2, 'La dirección es requerida'),
  salesRepId: z.string().trim().optional(),
});

export const customerUpdateSchema = z.object({
  businessName: z.string().trim().min(2).optional(),
  taxId: z.string().trim().min(6).optional(),
  address: z.string().trim().min(2).optional(),
  salesRepId: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export const contactCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre es requerido'),
  position: z.string().trim().default('Contacto'),
  email: z.string().trim().email('Email no válido'),
  phone: z.string().trim().default('+56 9 0000 0000'),
});

export const contactUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  position: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().optional(),
  active: z.boolean().optional(),
});

// ==========================================
// CATALOG SCHEMAS (including Kits - P2.j)
// ==========================================
export const kitItemInputSchema = z.object({
  catalogItemId: z.string().trim().min(1, 'El ítem del kit es requerido'),
  quantity: z.number().positive('La cantidad debe ser mayor a 0'),
});

export const catalogItemCreateSchema = z.object({
  type: z.enum(['PRODUCT', 'SERVICE']),
  name: z.string().trim().min(2, 'El nombre es requerido'),
  description: z.string().trim().default(''),
  categoryId: z.string().trim().min(1, 'Categoría requerida'),
  unitCost: z.number().nonnegative('El costo no puede ser negativo').default(0),
  listPrice: z.number().nonnegative('El precio de lista no puede ser negativo').default(0),
  unit: z.string().default('UND'),
  brand: z.string().optional(),
  sku: z.string().optional(),
  code: z.string().optional(),
  deliveryTimeDays: z.number().int().nonnegative().optional(),
  isKit: z.boolean().optional(),
  kitItems: z.array(kitItemInputSchema).optional(),
});

export const catalogItemUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  description: z.string().trim().optional(),
  categoryId: z.string().trim().optional(),
  unitCost: z.number().nonnegative().optional(),
  listPrice: z.number().nonnegative().optional(),
  unit: z.string().optional(),
  brand: z.string().optional(),
  sku: z.string().optional(),
  code: z.string().optional(),
  deliveryTimeDays: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
  isKit: z.boolean().optional(),
  kitItems: z.array(kitItemInputSchema).optional(),
});

// ==========================================
// QUOTATION TEMPLATES SCHEMAS (P2.j)
// ==========================================
export const quotationTemplateCreateSchema = z.object({
  name: z.string().trim().min(2, 'El nombre de la plantilla es requerido'),
  categoryId: z.string().trim().min(1, 'Categoría requerida'),
  description: z.string().trim().optional(),
  lines: z.array(z.object({
    catalogItemId: z.string().trim().min(1),
    quantity: z.number().positive(),
    discountPct: z.number().min(0).max(99.99).optional(),
  })).min(1, 'Debe incluir al menos una línea en la plantilla'),
  terms: z.string().trim().default(''),
  presentationText: z.string().trim().optional(),
});

export const quotationTemplateUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  categoryId: z.string().trim().optional(),
  description: z.string().trim().optional(),
  lines: z.array(z.object({
    catalogItemId: z.string().trim().min(1),
    quantity: z.number().positive(),
    discountPct: z.number().min(0).max(99.99).optional(),
  })).optional(),
  terms: z.string().trim().optional(),
  presentationText: z.string().trim().optional(),
  active: z.boolean().optional(),
});

// ==========================================
// OPERATION MILESTONES & DELIVERABLES SCHEMAS (P2.k)
// ==========================================
export const operationMilestoneInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del hito es requerido'),
  date: z.string().trim().min(1, 'La fecha del hito es requerida'),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).default('PENDING'),
});

export const operationDeliverableInputSchema = z.object({
  name: z.string().trim().min(1, 'El nombre del entregable es requerido'),
  status: z.enum(['PENDING', 'READY', 'DELIVERED']).default('PENDING'),
  link: z.string().trim().optional(),
});

// ==========================================
// COMPANY SETTINGS SCHEMA (White-listed)
// ==========================================
export const companyUpdateSchema = z.object({
  minMarginPct: z.number().min(0).max(90, 'El margen mínimo no puede superar 90%').optional(),
  hardMinMarginPct: z.number().min(0).max(90, 'El piso duro de margen no puede superar 90%').optional(),
  ufRate: z.number().positive('El valor de la UF debe ser mayor a 0').optional(),
  legalName: z.string().trim().min(2).optional(),
  rut: z.string().trim().min(6).optional(),
  address: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  defaultTerms: z.string().optional(),
  defaultPresentationText: z.string().optional(),
  sessionTimeoutMinutes: z.number().int().positive().optional(),
  lossReasons: z.array(z.string().trim().min(1)).optional(),
  pipelineProbabilities: z.record(z.string(), z.number().min(0).max(100)).optional(),
});

// ==========================================
// USER MANAGEMENT SCHEMA (ADMIN ONLY)
// ==========================================
export const userCreateSchema = z.object({
  email: z.string().trim().email('Email no válido'),
  name: z.string().trim().min(2, 'El nombre es requerido'),
  role: z.enum(['ADMIN', 'SALES_REP']),
  phone: z.string().trim().default('+56 9 0000 0000'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').optional(),
});

export const userUpdateSchema = z.object({
  name: z.string().trim().min(2).optional(),
  role: z.enum(['ADMIN', 'SALES_REP']).optional(), // Solo un ADMIN puede cambiar rol
  phone: z.string().trim().optional(),
  active: z.boolean().optional(),
});

// ==========================================
// GEMINI AI SCHEMAS
// ==========================================
export const geminiChatSchema = z.object({
  prompt: z.string().trim().min(1, 'El prompt no puede estar vacío').max(10000, 'El prompt supera el tamaño máximo permitido'),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string().max(10000),
  })).optional(),
});

export const geminiAnalyzeSchema = z.object({
  imageBase64: z.string().min(1, 'Imagen base64 requerida'),
  mimeType: z.string().regex(/^image\/(jpeg|png|webp|gif)$|^application\/pdf$/i, 'Tipo MIME de archivo no admitido'),
  prompt: z.string().max(2000).optional(),
});

// ==========================================
// BACKUP & RESTORE SCHEMA (ZOD VALIDATED)
// ==========================================
export const restoreBackupSchema = z.object({
  exportedAt: z.string().optional(),
  company: z.object({
    id: z.string(),
    minMarginPct: z.number(),
    taxRatePct: z.number(),
    currency: z.string(),
  }).passthrough(),
  categories: z.array(z.object({ id: z.string(), name: z.string() }).passthrough()),
  catalogItems: z.array(z.object({ id: z.string(), name: z.string(), unitCost: z.number(), listPrice: z.number() }).passthrough()),
  customers: z.array(z.object({ id: z.string(), businessName: z.string(), taxId: z.string() }).passthrough()),
  contacts: z.array(z.object({ id: z.string(), customerId: z.string(), name: z.string(), email: z.string() }).passthrough()),
  quotations: z.array(z.object({ id: z.string(), quotationNumber: z.string() }).passthrough()),
  users: z.array(z.object({ id: z.string(), email: z.string(), role: z.enum(['ADMIN', 'SALES_REP', 'CUSTOMER_CONTACT']) }).passthrough()).optional(),
  invoices: z.array(z.object({ id: z.string() }).passthrough()).optional(),
  operations: z.array(z.object({ id: z.string() }).passthrough()).optional(),
  auditLogs: z.array(z.object({ id: z.string() }).passthrough()).optional(),
});
