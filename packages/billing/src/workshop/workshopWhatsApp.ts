import type { WorkshopOrder } from '@stelfaro/api-client';

const conditionLabels: Record<string, string> = { scratches: 'Rayones', dents: 'Golpes', cracked: 'Quebraduras', missing_parts: 'Piezas faltantes', moisture: 'Humedad visible', opened: 'Abierto previamente', tampered_screws: 'Tornillos manipulados', no_accessories: 'Sin accesorios' };
const powerLabels: Record<string, string> = { on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado' };
const deviceLabels: Record<string, string> = { phone: 'Celular', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Computadora', console: 'Consola', controller: 'Mando', instrument: 'Instrumento', tv: 'Televisor', audio: 'Equipo de audio', other: 'Equipo electrónico' };
const emoji = { greeting: '\u{1F44B}', receipt: '\u{1F527}', ticket: '\u{1F3AB}', calendar: '\u{1F4C5}', device: '\u{1F4F1}', fault: '\u{1F6E0}\u{FE0F}', condition: '\u{1F50D}', accessories: '\u{1F392}', money: '\u{1F4B5}', status: '\u{1F4CC}' };
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

export function workshopWhatsAppUrl(order: WorkshopOrder): string {
  let phone = (order.customer.phone || '').replace(/\D/g, '');
  if (phone.length === 8) phone = `503${phone}`;
  if (!phone) return '';
  const identifier = order.device.imei ? `IMEI: ${order.device.imei}` : order.device.serial_number ? `Serie: ${order.device.serial_number}` : 'Sin identificador visible';
  const conditions = order.physical_conditions.map(condition => conditionLabels[condition] || condition);
  if (order.physical_condition) conditions.push(order.physical_condition);
  const lines = [
    `Hola *${order.customer.name}* ${emoji.greeting}`, '', `${emoji.receipt} *COMPROBANTE DE RECEPCIÓN*`, `${emoji.ticket} *Orden:* ${order.ticket}`,
    `${emoji.calendar} *Fecha:* ${new Date(order.received_at).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}`, '', `${emoji.device} *EQUIPO RECIBIDO*`,
    `• ${deviceLabels[order.device.type] || order.device.type}: ${order.device.brand} ${order.device.model}`,
    ...(order.device.color ? [`• Color: ${order.device.color}`] : []), `• ${identifier}`, `• Encendido: ${powerLabels[order.device.power_status] || order.device.power_status}`,
    ...(order.device.is_locked ? [`• Acceso para revisión: ${order.device.has_access_secret ? 'Sí, fue proporcionado' : 'No fue proporcionado'}`] : []),
    '', `${emoji.fault} *FALLA REPORTADA*`, order.reported_fault,
    ...(conditions.length ? ['', `${emoji.condition} *CONDICIÓN AL RECIBIR*`, conditions.join(' · ')] : []),
    ...(order.accessories.length ? ['', `${emoji.accessories} *ACCESORIOS RECIBIDOS*`, order.accessories.join(', ')] : []),
    '', `${emoji.money} *VALORES REGISTRADOS*`, order.estimated_total !== null ? `• Monto estimado: ${money(order.estimated_total)}` : '• Monto estimado: Pendiente de diagnóstico',
    `• Anticipo recibido: ${money(order.paid_total)}`, ...(order.estimated_total !== null ? [`• Saldo estimado: ${money(order.balance)}`] : []),
    '', `${emoji.status} El equipo quedó registrado y pendiente de revisión técnica.`,
    'Conserva este mensaje como constancia de recepción. El diagnóstico y el valor final serán confirmados antes de realizar trabajos adicionales.',
  ];
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(lines.join('\n'))}`;
}
