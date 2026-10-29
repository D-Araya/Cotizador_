import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import nodemailer from 'nodemailer';
import { computeTotals } from '../../src/shared-kernel/pricing/computeTotals.js';
import { toPublicQuotationDTO, toClientInvoiceDTO, toClientOperationDTO } from '../../src/server/dto.js';
import { authenticateStaff, requireRole, requireAdmin, authenticateClient } from '../../src/server/middleware/auth.js';
import { createStaffToken, generateMagicLinkToken, generatePublicQuotationToken } from '../../src/server/auth.js';
import { OutboxService } from '../../src/server/services/outbox.service.js';
import { AuditService } from '../../src/server/services/audit.service.js';
import { SeedService } from '../../src/server/services/seed.service.js';
import { applyInvoiceOverdueCheck, buildPaymentSchedule } from '../../src/server/routes/invoices.routes.js';
import {
  quotationAttachmentSchema,
  publicQuotationAcceptSchema,
  companyUpdateSchema,
  geminiAnalyzeSchema,
  quotationLineInputSchema,
  recordPaymentSchema,
} from '../../src/server/schemas.js';
import { dbStore } from '../../src/modules/db/store.js';
import { repos } from '../../src/server/repositories/index.js';
import { Quotation, Invoice, OperationOrder } from '../../src/modules/types.js';

describe('Suite Exhaustiva de Casos de Borde, Lógica Central y Validaciones Críticas', () => {
  beforeEach(() => {
    dbStore.reset();
    vi.restoreAllMocks();
  });

  // ============================================================================
  // 1. MOTOR CANÓNICO DE PRECIOS Y MARGEN (computeTotals) - CASOS LÍMITE
  // ============================================================================
  describe('1. computeTotals - Condiciones Límite, Excepciones y Precisión Decimal', () => {
    it('lanza excepción cuando el descuento global es negativo o >= 100%', () => {
      const lines = [{ cost: 10000, price: 20000, quantity: 1 }];
      expect(() => computeTotals(lines, 25, 19, -0.01)).toThrow(
        'El descuento global debe estar entre 0% y menos del 100%'
      );
      expect(() => computeTotals(lines, 25, 19, 100)).toThrow(
        'El descuento global debe estar entre 0% y menos del 100%'
      );
      expect(() => computeTotals(lines, 25, 19, 120)).toThrow(
        'El descuento global debe estar entre 0% y menos del 100%'
      );
    });

    it('lanza excepción cuando el descuento por línea es negativo o >= 100%', () => {
      expect(() =>
        computeTotals([{ cost: 10000, price: 20000, quantity: 1, discountPct: -1 }], 25, 19)
      ).toThrow('El descuento de línea debe estar entre 0% y menos del 100%');

      expect(() =>
        computeTotals([{ cost: 10000, price: 20000, quantity: 1, discountPct: 100 }], 25, 19)
      ).toThrow('El descuento de línea debe estar entre 0% y menos del 100%');
    });

    it('lanza excepción cuando el margen por línea es negativo o >= 100%', () => {
      expect(() =>
        computeTotals([{ cost: 10000, marginPct: -0.5, quantity: 1 }], 25, 19)
      ).toThrow('El margen no puede ser negativo');

      expect(() =>
        computeTotals([{ cost: 10000, marginPct: 100, quantity: 1 }], 25, 19)
      ).toThrow('El margen no puede ser mayor o igual al 100%');

      expect(() =>
        computeTotals([{ cost: 10000, marginPct: 150, quantity: 1 }], 25, 19)
      ).toThrow('El margen no puede ser mayor o igual al 100%');
    });

    it('compara rawMarginPct contra minMarginPct SIN redondeo previo (regla crítica anti-fuga de margen)', () => {
      // Costo: 75001, Precio: 100000 -> Margen exacto = 24.999%
      // Redondeado a 2 decimales es 25.00%, pero rawMarginPct (24.999) < 25 -> meetsMinimum DEBE ser false
      const res = computeTotals([{ cost: 75001, price: 100000, quantity: 1 }], 25, 19);
      expect(res.marginPct).toBe(25); // Redondeado visualmente a 2 decimales
      expect(res.rawMarginPct).toBeCloseTo(24.999, 3);
      expect(res.meetsMinimum).toBe(false);
      expect(res.shortfall).toBe(2); // 75001 / 0.75 = 100001.33 -> faltan 2 pesos (ROUND_UP)
    });

    it('combina descuento por línea + descuento global + conversión UF con redondeo exacto', () => {
      // Costo 50.000, Precio base 100.000, Cant 2, Desc línea 10% -> unitPrice efectivo = 90.000, subtotal línea = 180.000
      // Ahorro línea = (100.000 - 90.000) * 2 = 20.000
      // Descuento global 5% sobre 180.000 = 9.000 -> netSubtotal = 171.000
      // Ahorro total = 20.000 + 9.000 = 29.000
      // Costo total = 100.000 -> Utilidad = 71.000 -> Margen = 71000 / 171000 = 41.52%
      const res = computeTotals(
        [{ cost: '50000', price: '100000', quantity: '2', discountPct: '10' }],
        '28',
        '19',
        '5',
        '18',
        '38500'
      );

      expect(res.grossNetSubtotal).toBe(200000);
      expect(res.lines[0].originalUnitPrice).toBe(100000);
      expect(res.lines[0].unitPrice).toBe(90000);
      expect(res.lines[0].discountAmount).toBe(20000);
      expect(res.lines[0].subtotal).toBe(180000);
      expect(res.discountAmount).toBe(9000);
      expect(res.totalSavings).toBe(29000);
      expect(res.netSubtotal).toBe(171000);
      expect(res.taxAmount).toBe(32490); // 171000 * 0.19
      expect(res.grandTotal).toBe(203490);
      expect(res.meetsMinimum).toBe(true);
      expect(res.ufNetSubtotal).toBe(4.44);
      expect(res.ufGrandTotal).toBe(5.29);
    });

    it('maneja lista de líneas vacía y ufRate inválido o cero sin lanzar error ni dividir por cero', () => {
      const resEmpty = computeTotals([], 28, 19, 0, 18, 0);
      expect(resEmpty.netSubtotal).toBe(0);
      expect(resEmpty.grandTotal).toBe(0);
      expect(resEmpty.marginPct).toBe(0);
      expect(resEmpty.meetsMinimum).toBe(false);
      expect(resEmpty.shortfall).toBe(0);
      expect(resEmpty.ufNetSubtotal).toBeUndefined();
      expect(resEmpty.ufGrandTotal).toBeUndefined();
    });

    it('usa el costo como precio base cuando no se provee ni price ni marginPct', () => {
      const res = computeTotals([{ cost: 45000.4, quantity: 1 }], 25, 19);
      expect(res.lines[0].unitPrice).toBe(45001); // ROUND_UP al peso
      expect(res.lines[0].cost).toBe(45000.4);
    });
  });

  // ============================================================================
  // 2. SANITIZACIÓN DE DTOs PÚBLICOS Y PORTAL (src/server/dto.ts)
  // ============================================================================
  describe('2. DTOs de Sanitización (toPublicQuotationDTO, toClientInvoiceDTO, toClientOperationDTO)', () => {
    const sampleInternalQuote: Quotation = {
      id: 'quot-sec-99',
      quotationNumber: 'COT-000099',
      quotationGroupId: 'grp-99',
      revision: 2,
      publicToken: 'pub_tok_99',
      customerId: 'cust-01',
      customerBusinessName: 'Austral Salmón & Mar SpA',
      contactId: 'cont-01',
      salesRepId: 'usr-sales-01',
      salesRepName: 'Sebastián Morales',
      status: 'ACCEPTED',
      createdAt: '2026-09-01T10:00:00Z',
      updatedAt: '2026-09-05T12:00:00Z',
      sentAt: '2026-09-01T11:00:00Z',
      acceptedAt: '2026-09-05T12:00:00Z',
      validityDays: 15,
      currency: 'CLP',
      subtotal: 1000000,
      netSubtotal: 1000000,
      taxRatePct: 19,
      taxAmount: 190000,
      grandTotal: 1190000,
      total: 1190000,
      // Campos sensibles internos que JAMÁS deben exponerse
      totalCost: 600000,
      profit: 400000,
      marginPct: 40,
      minMarginPctApplied: 28,
      internalNotes: 'NOTA CONFIDENCIAL: No bajar de $1.000.000 bajo ningún concepto',
      marginException: true,
      marginExceptionReason: 'Cliente estratégico',
      marginApprovalComment: 'Aprobado por Gerencia con margen reducido',
      acceptedOffline: true,
      offlinePurchaseOrderNumber: 'OC-NAVAL-8821',
      offlineAcceptedBy: 'Sebastián Morales',
      offlineNote: 'Orden recepcionada por correo',
      lines: [
        {
          id: 'l-1',
          type: 'SERVICE',
          name: 'Estudio de Estabilidad',
          skuOrCode: 'SRV-EST-01',
          unit: 'GLOBAL',
          quantity: 1,
          cost: 600000,
          costTotal: 600000,
          marginPct: 40,
          price: 1000000,
          subtotal: 1000000,
        },
      ],
      statusHistory: [],
      presentationText: 'Propuesta técnica',
      notes: 'Notas',
      terms: 'Términos',
      termsAccepted: true,
      extraCosts: [],
      totalSale: 1000000,
      extraCostsTotal: 0,
    };

    it('toPublicQuotationDTO elimina todos los costos, márgenes, utilidades y notas internas', () => {
      const dto = toPublicQuotationDTO(
        sampleInternalQuote,
        {
          id: 'cust-01',
          businessName: 'Austral Salmón & Mar SpA',
          taxId: '76.543.210-4',
          address: 'Puerto Montt',
          salesRepId: 'usr-sales-01',
          active: true,
          createdAt: '2026-09-01T10:00:00Z',
        },
        {
          id: 'cont-01',
          customerId: 'cust-01',
          name: 'Matías Barrientos',
          position: 'Gerente',
          email: 'm@austral.cl',
          phone: '+56911111111',
          active: true,
          createdAt: '2026-09-01T10:00:00Z',
        },
        { name: 'Sebastián Morales', email: 'smorales@mlingenieria.cl', phone: '+56922222222' },
        { hasNewerRevision: true, latestRevisionNumber: 'COT-000099-R3', latestRevisionToken: 'tok_r3', latestRevisionId: 'quot-r3' }
      );

      const serialized = JSON.stringify(dto);
      expect(serialized).not.toContain('totalCost');
      expect(serialized).not.toContain('costTotal');
      expect(serialized).not.toContain('profit');
      expect(serialized).not.toContain('marginPct');
      expect(serialized).not.toContain('internalNotes');
      expect(serialized).not.toContain('NOTA CONFIDENCIAL');
      expect(serialized).not.toContain('marginExceptionReason');
      expect(serialized).not.toContain('marginApprovalComment');
      expect((dto.lines[0] as any).cost).toBeUndefined();
      expect((dto.lines[0] as any).marginPct).toBeUndefined();

      // Verifica metadatos de revisión y eventos de aceptación offline
      expect(dto.isLatestRevision).toBe(false);
      expect(dto.hasNewerRevision).toBe(true);
      expect(dto.latestRevisionNumber).toBe('COT-000099-R3');
      expect(dto.timelineEvents.some((e) => e.title.includes('Orden de Compra'))).toBe(true);
      expect(dto.timelineEvents.some((e) => e.description.includes('OC-NAVAL-8821'))).toBe(true);
    });

    it('toPublicQuotationDTO genera eventos adecuados para CHANGES_REQUESTED y REJECTED', () => {
      const changesQuote: Quotation = { ...sampleInternalQuote, status: 'CHANGES_REQUESTED', sentAt: undefined, validUntil: undefined };
      const dtoChanges = toPublicQuotationDTO(changesQuote);
      expect(dtoChanges.timelineEvents.some((e) => e.title === 'Ajuste Solicitado')).toBe(true);
      expect(dtoChanges.isLatestRevision).toBe(true);

      const rejectedQuote: Quotation = { ...sampleInternalQuote, status: 'REJECTED', rejectedAt: '2026-09-06T10:00:00Z' };
      const dtoRejected = toPublicQuotationDTO(rejectedQuote);
      expect(dtoRejected.timelineEvents.some((e) => e.title === 'Cotización Desestimada')).toBe(true);
    });

    it('toClientInvoiceDTO calcula paidAmount y balance seguros incluso ante sobrepagos o valores indefinidos', () => {
      const paidInv: Invoice = {
        id: 'inv-1',
        invoiceNumber: 'DC-000010',
        quotationId: 'q-1',
        quotationNumber: 'COT-000010',
        customerId: 'cust-01',
        customerBusinessName: 'Austral',
        issueDate: '2026-09-01',
        dueDate: '2026-10-01',
        subtotal: 100000,
        taxAmount: 19000,
        total: 119000,
        status: 'PAID',
        paymentTerms: 'Contado',
        items: [],
      };
      const dtoPaid = toClientInvoiceDTO(paidInv);
      expect(dtoPaid.paidAmount).toBe(119000);
      expect(dtoPaid.balance).toBe(0);

      // Sobrepago: paidAmount > total -> balance truncado a 0
      const overpaidInv: Invoice = { ...paidInv, status: 'PARTIAL', paidAmount: 150000, balance: undefined };
      const dtoOverpaid = toClientInvoiceDTO(overpaidInv);
      expect(dtoOverpaid.balance).toBe(0);
    });

    it('toClientOperationDTO mapea hitos, entregables y adjuntos anidados de forma segura', () => {
      const op: OperationOrder = {
        id: 'op-1',
        orderNumber: 'OP-2026-0001',
        quotationId: 'q-1',
        quotationNumber: 'COT-000001',
        customerId: 'cust-01',
        customerBusinessName: 'Austral',
        type: 'SERVICE_EXECUTION',
        title: 'Inspección',
        description: 'Desc',
        status: 'IN_PROGRESS',
        progressPct: 50,
        assignedStaff: 'Inspector',
        scheduledDate: '2026-09-10',
        deliveryAddress: 'Muelle',
        itemsIncluded: ['1x Inspección'],
        milestones: [{ id: 'm1', name: 'Hito 1', date: '2026-09-10', status: 'COMPLETED', completedAt: '2026-09-10T12:00:00Z' }],
        deliverables: [
          {
            id: 'd1',
            name: 'Informe PDF',
            status: 'READY',
            link: 'https://example.com/informe.pdf',
            attachments: [{ id: 'att1', name: 'Plano.pdf', url: 'https://example.com/plano.pdf', description: 'Plano visado', addedAt: '2026-09-10T12:00:00Z' }],
          },
        ],
      };

      const dto = toClientOperationDTO(op);
      expect(dto.milestones.length).toBe(1);
      expect(dto.deliverables[0].attachments.length).toBe(1);
      expect(dto.deliverables[0].attachments[0].name).toBe('Plano.pdf');
    });
  });

  // ============================================================================
  // 3. MIDDLEWARE DE AUTENTICACIÓN Y AUTORIZACIÓN (src/server/middleware/auth.ts)
  // ============================================================================
  describe('3. Middleware de Autenticación y Autorización (Staff & Portal Cliente)', () => {
    function createMockRes() {
      const res: any = {};
      res.status = vi.fn().mockReturnValue(res);
      res.contentType = vi.fn().mockReturnValue(res);
      res.json = vi.fn().mockReturnValue(res);
      return res;
    }

    it('authenticateStaff rechaza peticiones sin Bearer token o con token inválido', () => {
      const res1 = createMockRes();
      const next1 = vi.fn();
      authenticateStaff({ headers: {} } as any, res1, next1);
      expect(res1.status).toHaveBeenCalledWith(401);
      expect(next1).not.toHaveBeenCalled();

      const res2 = createMockRes();
      authenticateStaff({ headers: { authorization: 'Bearer token.invalido' } } as any, res2, next1);
      expect(res2.status).toHaveBeenCalledWith(401);
    });

    it('authenticateStaff rechaza tokens válidos si el usuario fue desactivado en la base de datos', () => {
      const state = dbStore.getState();
      const salesUser = state.users.find((u) => u.id === 'usr-sales-01')!;
      const token = createStaffToken({
        id: salesUser.id,
        email: salesUser.email,
        role: 'SALES_REP',
        name: salesUser.name,
      });

      // Desactivar usuario después de emitir el token
      salesUser.active = false;

      const res = createMockRes();
      const next = vi.fn();
      authenticateStaff({ headers: { authorization: `Bearer ${token}` } } as any, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'El usuario no existe o se encuentra inactivo.' })
      );
      expect(next).not.toHaveBeenCalled();
    });

    it('requireRole y requireAdmin bloquean peticiones sin usuario (401) o con rol insuficiente (403)', () => {
      const res401 = createMockRes();
      const next = vi.fn();
      requireAdmin({} as any, res401, next);
      expect(res401.status).toHaveBeenCalledWith(401);

      const res403 = createMockRes();
      requireAdmin({ user: { id: 'usr-sales-01', role: 'SALES_REP', email: 's@m.cl', name: 'Sebastián' } } as any, res403, next);
      expect(res403.status).toHaveBeenCalledWith(403);
      expect(next).not.toHaveBeenCalled();

      const resOk = createMockRes();
      requireRole('ADMIN', 'SALES_REP')(
        { user: { id: 'usr-sales-01', role: 'SALES_REP', email: 's@m.cl', name: 'Sebastián' } } as any,
        resOk,
        next
      );
      expect(next).toHaveBeenCalledOnce();
    });

    it('authenticateClient valida magicToken por query/header y bloquea enlaces expirados, revocados o de empresas inactivas', () => {
      const state = dbStore.getState();
      const contact = state.contacts.find((c) => c.id === 'cont-01')!;
      const { rawToken, tokenHash } = generateMagicLinkToken();
      contact.portalTokenHash = tokenHash;
      contact.portalTokenRevoked = false;
      contact.portalTokenExpiresAt = new Date(Date.now() + 86400000).toISOString();

      // 1. Acceso exitoso mediante header x-magic-token
      const reqOk: any = { headers: { 'x-magic-token': rawToken }, query: {} };
      const resOk = createMockRes();
      const nextOk = vi.fn();
      authenticateClient(reqOk, resOk, nextOk);
      expect(nextOk).toHaveBeenCalledOnce();
      expect(reqOk.clientUser?.customerId).toBe(contact.customerId);

      // 2. Enlace expirado -> 401
      contact.portalTokenExpiresAt = new Date(Date.now() - 10000).toISOString();
      const resExp = createMockRes();
      authenticateClient({ headers: {}, query: { magicToken: rawToken } } as any, resExp, vi.fn());
      expect(resExp.status).toHaveBeenCalledWith(401);
      expect(resExp.json).toHaveBeenCalledWith(
        expect.objectContaining({ detail: expect.stringContaining('ha expirado') })
      );

      // 3. Empresa asociada inactiva -> 403 Forbidden
      contact.portalTokenExpiresAt = new Date(Date.now() + 86400000).toISOString();
      const customer = state.customers.find((c) => c.id === contact.customerId)!;
      customer.active = false;
      const resInactiveCust = createMockRes();
      authenticateClient({ headers: {}, query: { magicToken: rawToken } } as any, resInactiveCust, vi.fn());
      expect(resInactiveCust.status).toHaveBeenCalledWith(403);
      expect(resInactiveCust.json).toHaveBeenCalledWith(
        expect.objectContaining({ detail: 'La empresa asociada se encuentra inactiva o no existe.' })
      );

      // 4. Token revocado -> 401
      customer.active = true;
      contact.portalTokenRevoked = true;
      const resRevoked = createMockRes();
      authenticateClient({ headers: {}, query: { magicToken: rawToken } } as any, resRevoked, vi.fn());
      expect(resRevoked.status).toHaveBeenCalledWith(401);
    });
  });

  // ============================================================================
  // 4. SERVICIOS DE BANDEJA DE SALIDA, AUDITORÍA Y SEMILLA (Outbox, Audit, Seed)
  // ============================================================================
  describe('4. OutboxService, AuditService y SeedService - Casos de Borde y Fallos SMTP', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
      process.env = { ...originalEnv };
    });

    it('OutboxService.enqueue genera enlace wa.me limpio para WHATSAPP y omite whatsAppUrl si no hay teléfono', async () => {
      const msgWithPhone = await OutboxService.enqueue({
        quotationId: 'quot-1',
        quotationNumber: 'COT-000001',
        customerId: 'cust-01',
        recipientName: 'Matías Barrientos',
        recipientEmail: 'mbarrientos@australsalmon.cl',
        recipientPhone: '+56 (9) 7654-3210',
        channel: 'WHATSAPP',
        publicUrl: 'http://localhost:3000/q/tok123',
        totalFormatted: '$1.190.000 CLP',
      });

      expect(msgWithPhone.status).toBe('PENDING_MANUAL');
      expect(msgWithPhone.whatsAppUrl).toContain('https://wa.me/56976543210?text=');

      const msgWithoutPhone = await OutboxService.enqueue({
        quotationId: 'quot-1',
        quotationNumber: 'COT-000001',
        customerId: 'cust-01',
        recipientName: 'Matías Barrientos',
        recipientEmail: 'mbarrientos@australsalmon.cl',
        channel: 'WHATSAPP',
        publicUrl: 'http://localhost:3000/q/tok123',
        totalFormatted: '$1.190.000 CLP',
      });

      expect(msgWithoutPhone.whatsAppUrl).toBeUndefined();
    });

    it('OutboxService.processMessage maneja reintentos SMTP fallidos hasta marcar FAILED al alcanzar maxAttempts', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'no-reply@mlingenieria.cl';
      process.env.SMTP_PASS = 'secret';

      const sendMailMock = vi.fn().mockRejectedValue(new Error('Connection timeout SMTP'));
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);

      // Crear mensaje en repositorio sin disparar background exitoso
      const msg = await repos.notificationRepo.create({
        id: 'out-retry-test',
        quotationId: 'quot-1',
        quotationNumber: 'COT-000001',
        recipient: 'cliente@test.cl',
        recipientEmail: 'cliente@test.cl',
        recipientName: 'Cliente',
        channel: 'EMAIL',
        status: 'PENDING',
        retries: 0,
        attempts: 2, // Ya lleva 2 intentos de 3
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        subject: 'Test',
        body: 'Body',
      });

      const afterThirdAttempt = await OutboxService.processMessage(msg.id);
      expect(afterThirdAttempt?.attempts).toBe(3);
      expect(afterThirdAttempt?.status).toBe('FAILED');
      expect(afterThirdAttempt?.deliveryError).toContain('Connection timeout SMTP');
    });

    it('OutboxService.processMessage marca SENT cuando el envío SMTP tiene éxito', async () => {
      process.env.SMTP_HOST = 'smtp.example.com';
      process.env.SMTP_USER = 'no-reply@mlingenieria.cl';
      process.env.SMTP_PASS = 'secret';

      const sendMailMock = vi.fn().mockResolvedValue({ messageId: '<ok@mlingenieria.cl>' });
      vi.spyOn(nodemailer, 'createTransport').mockReturnValue({ sendMail: sendMailMock } as any);

      const msg = await repos.notificationRepo.create({
        id: 'out-sent-test',
        quotationId: 'quot-1',
        quotationNumber: 'COT-000001',
        recipient: 'cliente@test.cl',
        recipientEmail: 'cliente@test.cl',
        recipientName: 'Cliente',
        channel: 'EMAIL',
        status: 'PENDING',
        retries: 0,
        attempts: 0,
        maxAttempts: 3,
        createdAt: new Date().toISOString(),
        subject: 'Test',
        body: 'Body',
      });

      const updated = await OutboxService.retry(msg.id);
      expect(updated?.status).toBe('SENT');
      expect(updated?.attempts).toBe(1);
      expect(updated?.sentAt).toBeDefined();
    });

    it('AuditService.getActorFromRequest identifica correctamente Staff, Cliente de Portal y Sistema, y clona snapshots', async () => {
      const staffActor = AuditService.getActorFromRequest({
        user: { id: 'u1', name: 'Admin', role: 'ADMIN', email: 'a@b.cl' },
      } as any);
      expect(staffActor.role).toBe('ADMIN');

      const clientActor = AuditService.getActorFromRequest({
        clientUser: { contactId: 'c1', customerId: 'cust1', name: 'Contacto', email: 'c@b.cl', role: 'CLIENT' },
      } as any);
      expect(clientActor.role).toBe('CLIENT');
      expect(clientActor.id).toBe('c1');

      const sysActor = AuditService.getActorFromRequest({} as any);
      expect(sysActor.role).toBe('SYSTEM');

      // Verificar inmutabilidad de before/after
      const mutableObj = { marginPct: 28 };
      const log = await AuditService.record({
        action: 'UPDATE',
        entity: 'COMPANY',
        entityId: 'comp-01',
        summary: 'Cambio margen',
        before: mutableObj,
      });
      mutableObj.marginPct = 99;
      expect(log.before.marginPct).toBe(28);
    });

    it('SeedService.seedIfEmpty es estrictamente idempotente cuando ya existen registros', async () => {
      const result = await SeedService.seedIfEmpty();
      expect(result.seeded).toBe(false);
      expect(result.reason).toContain('ya contiene datos');
    });
  });

  // ============================================================================
  // 5. PLANES DE PAGO, CASCADA DE ABONOS Y VALIDACIONES ZOD (Invoices & Schemas)
  // ============================================================================
  describe('5. Cascada de Abonos en Facturas y Esquemas de Validación Crítica', () => {
    it('applyInvoiceOverdueCheck distribuye abonos múltiples en cascada (Hito 1 PAID, Hito 2 PARTIAL)', () => {
      const futureDate = new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0];
      const schedule = buildPaymentSchedule('30% anticipo, 70% contra entrega', 1000000, '2026-09-01', futureDate);
      // Hito 1 = 300.000, Hito 2 = 700.000
      const inv: Invoice = {
        id: 'inv-cascade',
        invoiceNumber: 'DC-000999',
        quotationId: 'quot-1',
        quotationNumber: 'COT-000001',
        customerId: 'cust-01',
        customerBusinessName: 'Austral',
        issueDate: '2026-09-01',
        dueDate: futureDate,
        subtotal: 840336,
        taxAmount: 159664,
        total: 1000000,
        status: 'PENDING',
        paymentTerms: '30% anticipo, 70% contra entrega',
        items: [],
        paymentSchedule: schedule,
        payments: [
          {
            id: 'p1',
            amount: 200000,
            paymentMethod: 'TRANSFER',
            reference: 'REF-1',
            paymentDate: '2026-09-02',
            registeredAt: '2026-09-02T10:00:00Z',
            registeredBy: 'Admin',
          },
          {
            id: 'p2',
            amount: 250000, // Total pagado = 450.000 -> cubre Hito 1 (300.000) y abona 150.000 al Hito 2
            paymentMethod: 'TRANSFER',
            reference: 'REF-2',
            paymentDate: '2026-09-05',
            registeredAt: '2026-09-05T10:00:00Z',
            registeredBy: 'Admin',
          },
        ],
      };

      applyInvoiceOverdueCheck(inv);

      expect(inv.paidAmount).toBe(450000);
      expect(inv.balance).toBe(550000);
      expect(inv.status).toBe('PARTIAL');
      expect(inv.paymentSchedule![0].status).toBe('PAID');
      expect(inv.paymentSchedule![0].paidAmount).toBe(300000);
      expect(inv.paymentSchedule![1].status).toBe('PARTIAL');
      expect(inv.paymentSchedule![1].paidAmount).toBe(150000);
    });

    it('schemas.ts valida enlaces adjuntos (data:, blob:, https://) y rechaza URLs malformadas', () => {
      expect(
        quotationAttachmentSchema.safeParse({ name: 'Plano.pdf', url: 'https://docs.mlingenieria.cl/plano.pdf' }).success
      ).toBe(true);
      expect(
        quotationAttachmentSchema.safeParse({ name: 'Firma.png', url: 'data:image/png;base64,iVBORw0KGgo=' }).success
      ).toBe(true);
      expect(
        quotationAttachmentSchema.safeParse({ name: 'Malicioso', url: ' no-es-una-url ' }).success
      ).toBe(false);
    });

    it('schemas.ts valida aceptación pública, tipos MIME de Gemini y límites de descuentos/márgenes', () => {
      // Firma pública requiere termsAccepted === true literal
      expect(
        publicQuotationAcceptSchema.safeParse({
          termsAccepted: false,
          signerName: 'Matías Barrientos',
          signerPosition: 'Gerente de Flota',
        }).success
      ).toBe(false);

      // MIME types permitidos en análisis de documentos con Gemini
      expect(
        geminiAnalyzeSchema.safeParse({ imageBase64: 'YWJj', mimeType: 'application/pdf' }).success
      ).toBe(true);
      expect(
        geminiAnalyzeSchema.safeParse({ imageBase64: 'YWJj', mimeType: 'application/x-msdownload' }).success
      ).toBe(false);

      // Límites de margen y descuento en líneas (0 a 99.99)
      expect(quotationLineInputSchema.safeParse({ quantity: 1, marginPct: 100 }).success).toBe(false);
      expect(quotationLineInputSchema.safeParse({ quantity: 1, discountPct: 100 }).success).toBe(false);
      expect(quotationLineInputSchema.safeParse({ quantity: 0 }).success).toBe(false);

      // Configuración corporativa: margen mínimo no puede superar 90%
      expect(companyUpdateSchema.safeParse({ minMarginPct: 95 }).success).toBe(false);
      expect(companyUpdateSchema.safeParse({ ufRate: -100 }).success).toBe(false);

      // Registro de pagos: monto > 0 y referencia obligatoria
      expect(
        recordPaymentSchema.safeParse({ amount: 0, paymentMethod: 'TRANSFER', reference: 'REF-1' }).success
      ).toBe(false);
      expect(
        recordPaymentSchema.safeParse({ amount: 50000, paymentMethod: 'TRANSFER', reference: '   ' }).success
      ).toBe(false);
    });

    it('generatePublicQuotationToken maneja fechas validUntil inválidas haciendo fallback a Date.now()', () => {
      const { token, expiresAt } = generatePublicQuotationToken('fecha-invalida');
      expect(token.length).toBeGreaterThan(20);
      const diffDays = (new Date(expiresAt).getTime() - Date.now()) / 86400000;
      expect(diffDays).toBeGreaterThan(29);
      expect(diffDays).toBeLessThanOrEqual(30.1);
    });
  });
});
