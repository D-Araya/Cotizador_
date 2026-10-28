import { describe, it, expect } from 'vitest';
import { NumberingService } from '../../src/server/services/numbering.service.js';

describe('NumberingService Unit Tests (src/server/services/numbering.service.ts)', () => {
  it('genera folios de cotización con formato COT-XXXXXX de 6 dígitos', async () => {
    const num1 = await NumberingService.nextQuotationNumber();
    const num2 = await NumberingService.nextQuotationNumber();

    expect(num1).toMatch(/^COT-\d{6}$/);
    expect(num2).toMatch(/^COT-\d{6}$/);
    expect(num1).not.toBe(num2);
  });

  it('genera folios de documento de cobro con formato DC-XXXXXX de 6 dígitos', async () => {
    const num1 = await NumberingService.nextInvoiceNumber();
    const num2 = await NumberingService.nextInvoiceNumber();

    expect(num1).toMatch(/^DC-\d{6}$/);
    expect(num2).toMatch(/^DC-\d{6}$/);
    expect(num1).not.toBe(num2);
  });

  it('genera folios de orden operacional con formato OP-YYYY-XXXX', async () => {
    const fixedDate = new Date(2026, 9, 27);
    const num = await NumberingService.nextOperationNumber(fixedDate);

    expect(num).toMatch(/^OP-2026-\d{4}$/);
  });

  it('newId genera UUIDs válidos con o sin prefijo', () => {
    const idWithPrefix = NumberingService.newId('line');
    const idWithoutPrefix = NumberingService.newId();

    expect(idWithPrefix.startsWith('line-')).toBe(true);
    expect(idWithPrefix.length).toBeGreaterThan(36);
    expect(idWithoutPrefix).toMatch(/^[0-9a-f-]{36}$/);
  });
});
