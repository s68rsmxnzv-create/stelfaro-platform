import { describe, expect, it } from 'vitest';
import { detectFiscalDocument, formatFiscalDocument, looksLikeForeignId } from '../../../packages/ui/src/support/fiscalDocument';

describe('detectFiscalDocument', () => {
  it('detecta DUI de 9 digitos sin cambios de comportamiento', () => {
    const result = detectFiscalDocument('012345678', 'dui_or_nit', false, 'passport');
    expect(result.valid).toBe(true);
    expect(result.typeCode).toBe('13');
    expect(result.typeLabel).toBe('DUI');
    expect(result.number).toBe('01234567-8');
  });

  it('detecta NIT de 14 digitos sin cambios de comportamiento', () => {
    const result = detectFiscalDocument('03061904881023', 'dui_or_nit', false, 'passport');
    expect(result.valid).toBe(true);
    expect(result.typeCode).toBe('36');
    expect(result.typeLabel).toBe('NIT');
  });

  it('no detecta pasaporte si allowForeignId es false', () => {
    const result = detectFiscalDocument('PA1234567', 'dui_or_nit', false, 'passport');
    expect(result.valid).toBe(false);
    expect(result.typeCode).toBe('');
  });

  it('detecta pasaporte por defecto cuando hay letras y allowForeignId es true', () => {
    const result = detectFiscalDocument('pa 1234567', 'dui_or_nit', true, 'passport');
    expect(result.valid).toBe(true);
    expect(result.typeCode).toBe('03');
    expect(result.number).toBe('PA1234567');
  });

  it('detecta carne de residente cuando foreignIdKind es residentCard', () => {
    const result = detectFiscalDocument('cr9988776', 'dui_or_nit', true, 'residentCard');
    expect(result.valid).toBe(true);
    expect(result.typeCode).toBe('02');
  });

  it('rechaza un documento extranjero demasiado corto', () => {
    const result = detectFiscalDocument('AB12', 'dui_or_nit', true, 'passport');
    expect(result.valid).toBe(false);
  });

  it('nunca detecta pasaporte cuando allowedTypes es nit', () => {
    const result = detectFiscalDocument('PA1234567', 'nit', true, 'passport');
    expect(result.valid).toBe(false);
    expect(result.typeCode).toBe('');
  });

  it('rechaza un DUI con todos los digitos iguales', () => {
    const result = detectFiscalDocument('000000000', 'dui_or_nit', false, 'passport');
    expect(result.valid).toBe(false);
    expect(result.typeCode).toBe('');
  });
});

describe('formatFiscalDocument', () => {
  it('formatea DUI con guion sin cambios de comportamiento', () => {
    expect(formatFiscalDocument('012345678', 'dui_or_nit', false)).toBe('01234567-8');
  });

  it('formatea pasaporte en mayusculas sin guiones cuando allowForeignId es true', () => {
    expect(formatFiscalDocument('pa 1234567', 'dui_or_nit', true)).toBe('PA1234567');
  });
});

describe('looksLikeForeignId', () => {
  it('es true si el valor tiene letras', () => {
    expect(looksLikeForeignId('PA1234567')).toBe(true);
  });

  it('es false si el valor es solo digitos', () => {
    expect(looksLikeForeignId('012345678')).toBe(false);
  });
});
