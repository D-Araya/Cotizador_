import { describe, it, expect } from 'vitest';
import { portalTranslations, Language } from '../../src/ui/i18n.ts';

describe('i18n Multilingual Dictionary Tests', () => {
  const languages: Language[] = ['es', 'en', 'de'];

  it('contiene diccionarios para español, inglés y alemán', () => {
    languages.forEach((lang) => {
      expect(portalTranslations[lang]).toBeDefined();
      expect(typeof portalTranslations[lang]).toBe('object');
    });
  });

  it('todos los idiomas comparten exactamente las mismas claves de traducción (paridad total)', () => {
    const esKeys = Object.keys(portalTranslations.es).sort();
    const enKeys = Object.keys(portalTranslations.en).sort();
    const deKeys = Object.keys(portalTranslations.de).sort();

    expect(enKeys).toEqual(esKeys);
    expect(deKeys).toEqual(esKeys);
  });

  it('ninguna clave tiene un valor vacío o nulo en ningún idioma', () => {
    languages.forEach((lang) => {
      const dict = portalTranslations[lang];
      Object.entries(dict).forEach(([key, val]) => {
        expect(typeof val).toBe('string');
        expect(val.trim().length).toBeGreaterThan(0);
      });
    });
  });

  it('verifica traducciones críticas de negocio en los 3 idiomas', () => {
    expect(portalTranslations.es.portalTitle).toContain('Cliente');
    expect(portalTranslations.en.portalTitle).toContain('Portal');
    expect(portalTranslations.de.portalTitle).toContain('Kundenportal');

    expect(portalTranslations.es.acceptQuote).toBe('Aceptar Cotización');
    expect(portalTranslations.en.acceptQuote).toBe('Accept Quotation');
    expect(portalTranslations.de.acceptQuote).toBe('Angebot annehmen');

    expect(portalTranslations.es.tax).toContain('IVA');
    expect(portalTranslations.en.tax).toContain('VAT');
    expect(portalTranslations.de.tax).toContain('MwSt');
    expect(portalTranslations.es.tax).toContain('19%');
  });
});
