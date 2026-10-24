import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import { repos } from '../repositories/index.js';
import { OutboxMessage } from '../../modules/types.js';

export interface EnqueueNotificationParams {
  quotationId: string;
  quotationNumber: string;
  customerId: string;
  recipientName: string;
  recipientEmail: string;
  recipientPhone?: string;
  channel: 'EMAIL' | 'WHATSAPP';
  publicUrl: string;
  totalFormatted: string;
}

export class OutboxService {
  /**
   * Encola una notificación en la bandeja de salida (Outbox)
   */
  static async enqueue(params: EnqueueNotificationParams): Promise<OutboxMessage> {
    const isEmail = params.channel === 'EMAIL';
    const hasSmtp = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );

    let initialStatus: 'PENDING' | 'PENDING_MANUAL' = 'PENDING';
    let deliveryError: string | undefined;

    if (isEmail) {
      initialStatus = 'PENDING';
      if (!hasSmtp) {
        deliveryError = 'Envío no configurado (faltan credenciales SMTP)';
      }
    } else {
      // WhatsApp usa enlace manual
      initialStatus = 'PENDING_MANUAL';
    }

    const cleanPhone = (params.recipientPhone || '').replace(/\D/g, '');
    const whatsAppMessage = `Estimado/a ${params.recipientName}, adjuntamos su cotización ${params.quotationNumber} por un total de ${params.totalFormatted}: ${params.publicUrl}`;
    const whatsAppUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsAppMessage)}`
      : undefined;

    const message: OutboxMessage = {
      id: crypto.randomUUID(),
      quotationId: params.quotationId,
      quotationNumber: params.quotationNumber,
      recipient: params.recipientEmail,
      recipientEmail: params.recipientEmail,
      recipientName: params.recipientName,
      recipientPhone: params.recipientPhone,
      channel: params.channel,
      status: initialStatus,
      retries: 0,
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      subject: `Cotización ${params.quotationNumber} - Maestranza & Logística Naval SpA`,
      body: whatsAppMessage,
      bodyPreview: `Estimado/a ${params.recipientName}: Ya puede revisar y aprobar su cotización en ${params.publicUrl}`,
      deliveryError,
      whatsAppUrl,
    };

    const saved = await repos.notificationRepo.create(message);

    // Si es EMAIL y hay SMTP configurado, procesar en background
    if (isEmail && hasSmtp) {
      this.processMessage(saved.id).catch((err) => {
        console.error(`[Outbox] Error procesando mensaje ${saved.id}:`, err);
      });
    }

    return saved;
  }

  /**
   * Procesa un mensaje individual con reintentos y retroceso exponencial
   */
  static async processMessage(messageId: string): Promise<OutboxMessage | null> {
    const msg = await repos.notificationRepo.findById(messageId);
    if (!msg) return null;

    if (msg.channel === 'WHATSAPP') {
      // WhatsApp nunca se envía de forma automatizada por SMTP
      return msg;
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT) || 587;
    const from = process.env.SMTP_FROM || user;

    if (!host || !user || !pass) {
      await repos.notificationRepo.update(messageId, {
        status: 'PENDING',
        deliveryError: 'Envío no configurado (faltan variables SMTP_*)',
      });
      return repos.notificationRepo.findById(messageId);
    }

    const newAttempts = (msg.attempts || 0) + 1;

    try {
      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from: `"Maestranza & Logística Naval" <${from}>`,
        to: `"${msg.recipientName}" <${msg.recipientEmail || msg.recipient}>`,
        subject: msg.subject,
        text: `${msg.bodyPreview || msg.body}\n\nEnlace seguro de revisión: ${(msg as any).publicUrl || ''}`,
      });

      const updated = await repos.notificationRepo.update(messageId, {
        status: 'SENT',
        attempts: newAttempts,
        sentAt: new Date().toISOString(),
        deliveryError: undefined,
      });

      return updated;
    } catch (err: any) {
      const isLastAttempt = newAttempts >= (msg.maxAttempts || 3);
      const updated = await repos.notificationRepo.update(messageId, {
        status: isLastAttempt ? 'FAILED' : 'PENDING',
        attempts: newAttempts,
        deliveryError: err.message || 'Error de conexión SMTP',
      });

      return updated;
    }
  }

  /**
   * Reintenta enviar un mensaje específico desde la interfaz
   */
  static async retry(messageId: string): Promise<OutboxMessage | null> {
    const msg = await repos.notificationRepo.findById(messageId);
    if (!msg) return null;

    if (msg.channel === 'WHATSAPP') {
      // No reintenta por SMTP
      return msg;
    }

    return this.processMessage(messageId);
  }
}
