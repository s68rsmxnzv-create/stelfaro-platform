export type FiscalDocumentDetection = {
  valid: boolean;
  type: string;
  typeCode?: string;
  typeLabel: string;
  number: string;
  message: string;
};

export type FiscalDocumentAllowedTypes = 'dui_or_nit' | 'nit';
export type ForeignIdKind = 'passport' | 'residentCard';

export function looksLikeForeignId(value: string): boolean {
  return /[A-Za-z]/.test(value);
}

export function detectFiscalDocument(
  value: string,
  allowedTypes: FiscalDocumentAllowedTypes,
  allowForeignId: boolean,
  foreignIdKind: ForeignIdKind,
  force: boolean = false
): FiscalDocumentDetection {
  if (allowForeignId && allowedTypes !== 'nit' && (force || looksLikeForeignId(value))) {
    return detectForeignId(value, foreignIdKind);
  }

  const digits = value.replace(/\D+/g, '');
  const isPlaceholder = /^(\d)\1+$/.test(digits);

  if ((digits.length === 9 || digits.length === 14) && isPlaceholder) {
    return {
      valid: false,
      type: '',
      typeCode: '',
      typeLabel: '',
      number: value,
      message: 'El documento no puede tener todos los dígitos iguales. Ingresa el DUI o NIT real.'
    };
  }

  if (allowedTypes !== 'nit' && digits.length === 9) {
    return {
      valid: true,
      type: 'DUI/NIT homologado',
      typeCode: '13',
      typeLabel: 'DUI',
      number: `${digits.slice(0, 8)}-${digits.slice(8)}`,
      message: 'Validaremos compatibilidad del certificado contra este documento homologado.'
    };
  }

  if (digits.length === 14) {
    return {
      valid: true,
      type: 'NIT',
      typeCode: '36',
      typeLabel: 'NIT',
      number: `${digits.slice(0, 4)}-${digits.slice(4, 10)}-${digits.slice(10, 13)}-${digits.slice(13)}`,
      message: 'Formato NIT largo detectado.'
    };
  }

  return {
    valid: false,
    type: '',
    typeCode: '',
    typeLabel: '',
    number: value,
    message: allowedTypes === 'nit'
      ? 'Ingresa NIT largo de 14 digitos.'
      : allowForeignId
        ? 'Ingresa DUI/NIT homologado, NIT de 14 digitos, o pasaporte/carné de residente.'
        : 'Ingresa DUI/NIT homologado de 9 digitos o NIT de 14 digitos.'
  };
}

function detectForeignId(value: string, foreignIdKind: ForeignIdKind): FiscalDocumentDetection {
  const normalized = value.replace(/\s+/g, '').toUpperCase();
  const isResidentCard = foreignIdKind === 'residentCard';

  if (normalized.length < 6 || normalized.length > 20) {
    return {
      valid: false,
      type: '',
      typeCode: '',
      typeLabel: '',
      number: value,
      message: 'El pasaporte o carné de residente debe tener entre 6 y 20 caracteres.'
    };
  }

  return {
    valid: true,
    type: isResidentCard ? 'Carné de Residente' : 'Pasaporte',
    typeCode: isResidentCard ? '02' : '03',
    typeLabel: isResidentCard ? 'Carné' : 'Pasaporte',
    number: normalized,
    message: isResidentCard
      ? 'Documento de carné de residente detectado.'
      : 'Documento de pasaporte detectado.'
  };
}

export function formatFiscalDocument(
  value: string,
  allowedTypes: FiscalDocumentAllowedTypes,
  allowForeignId: boolean,
  force: boolean = false
): string {
  if (allowForeignId && allowedTypes !== 'nit' && (force || looksLikeForeignId(value))) {
    return value.replace(/\s+/g, '').toUpperCase().slice(0, 20);
  }

  const digits = value.replace(/\D+/g, '').slice(0, 14);

  if (allowedTypes === 'nit') {
    return [
      digits.slice(0, 4),
      digits.slice(4, 10),
      digits.slice(10, 13),
      digits.slice(13, 14)
    ].filter(Boolean).join('-');
  }

  if (digits.length <= 8) {
    return digits;
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 8)}-${digits.slice(8)}`;
  }

  return [
    digits.slice(0, 4),
    digits.slice(4, 10),
    digits.slice(10, 13),
    digits.slice(13, 14)
  ].filter(Boolean).join('-');
}
