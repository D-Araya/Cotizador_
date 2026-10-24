import crypto from 'node:crypto';
import { repos } from '../repositories/index.js';

export class NumberingService {
  /**
   * Genera el siguiente folio correlativo de cotización (COT-000001)
   */
  static async nextQuotationNumber(): Promise<string> {
    const seq = await repos.counterRepo.getNextSequence('quotation');
    return `COT-${String(seq).padStart(6, '0')}`;
  }

  /**
   * Genera el siguiente folio correlativo de documento de cobro (DC-000001)
   */
  static async nextInvoiceNumber(): Promise<string> {
    const seq = await repos.counterRepo.getNextSequence('invoice');
    return `DC-${String(seq).padStart(6, '0')}`;
  }

  /**
   * Genera el siguiente folio de orden operacional con el año actual dinámico (OP-YYYY-0001)
   */
  static async nextOperationNumber(date: Date = new Date()): Promise<string> {
    const seq = await repos.counterRepo.getNextSequence('operation');
    const year = date.getFullYear();
    return `OP-${year}-${String(seq).padStart(4, '0')}`;
  }

  /**
   * Genera un identificador universal seguro sin colisiones
   */
  static newId(prefix?: string): string {
    const uuid = crypto.randomUUID();
    return prefix ? `${prefix}-${uuid}` : uuid;
  }
}
