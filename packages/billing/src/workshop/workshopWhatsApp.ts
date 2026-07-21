import type { WorkshopOrder } from '@stelfaro/api-client';

const conditionLabels: Record<string, string> = { scratches: 'Rayones', dents: 'Golpes', cracked: 'Quebraduras', missing_parts: 'Piezas faltantes', moisture: 'Humedad visible', opened: 'Abierto previamente', tampered_screws: 'Tornillos manipulados', no_accessories: 'Sin accesorios' };
const powerLabels: Record<string, string> = { on: 'Enciende', off: 'No enciende', not_tested: 'No comprobado' };
const deviceLabels: Record<string, string> = { phone: 'Celular', tablet: 'Tablet', laptop: 'Laptop', desktop: 'Computadora', console: 'Consola', controller: 'Mando', instrument: 'Instrumento', tv: 'Televisor', audio: 'Equipo de audio', other: 'Equipo electrónico' };
const emoji = { greeting: '\u{1F44B}', receipt: '\u{1F527}', ticket: '\u{1F3AB}', calendar: '\u{1F4C5}', device: '\u{1F4F1}', fault: '\u{1F6E0}\u{FE0F}', condition: '\u{1F50D}', accessories: '\u{1F392}', money: '\u{1F4B5}', status: '\u{1F4CC}' };
const money = (value: number) => new Intl.NumberFormat('es-SV', { style: 'currency', currency: 'USD' }).format(value);

export function workshopWhatsAppUrl(value: WorkshopOrder | WorkshopOrder[]): string {
  const orders = Array.isArray(value) ? value : [value];
  const order = orders[0];
  if (!order) return '';
  let phone = (order.customer.phone || '').replace(/\D/g, '');
  if (phone.length === 8) phone = `503${phone}`;
  if (!phone) return '';
  const lines = [
    `Hola *${order.customer.name}* ${emoji.greeting}`, '', `${emoji.receipt} *COMPROBANTE DE RECEPCIÓN*`, `${emoji.ticket} *Orden:* ${order.ticket}`,
    `${emoji.calendar} *Fecha:* ${new Date(order.received_at).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' })}`, `• Equipos recibidos: ${orders.length}`,
  ];
  orders.forEach((item, index) => {
    const identifier = item.device.imei ? `IMEI: ${item.device.imei}` : item.device.serial_number ? `Serie: ${item.device.serial_number}` : 'Sin identificador visible';
    const conditions = item.physical_conditions.map(condition => conditionLabels[condition] || condition);
    if (item.physical_condition) conditions.push(item.physical_condition);
    lines.push('', `${emoji.device} *EQUIPO ${index + 1}*`, `• ${deviceLabels[item.device.type] || item.device.type}: ${item.device.brand} ${item.device.model}`, ...(item.device.color ? [`• Color: ${item.device.color}`] : []), `• ${identifier}`, `• Encendido: ${powerLabels[item.device.power_status] || item.device.power_status}`, ...(item.device.is_locked ? [`• Acceso para revisión: ${item.device.has_access_secret ? 'Sí, fue proporcionado' : 'No fue proporcionado'}`] : []), `${emoji.fault} *Falla:* ${item.reported_fault}`, ...(conditions.length ? [`${emoji.condition} *Condición:* ${conditions.join(' · ')}`] : []), ...(item.accessories.length ? [`${emoji.accessories} *Accesorios:* ${item.accessories.join(', ')}`] : []), `${emoji.money} Estimado: ${item.estimated_total !== null ? money(item.estimated_total) : 'Pendiente'} · Anticipo: ${money(item.paid_total)}`);
  });
  lines.push(
    '', `${emoji.money} *TOTALES REGISTRADOS*`, `• Monto estimado: ${money(orders.reduce((sum, item) => sum + Number(item.estimated_total || 0), 0))}`,
    `• Anticipo recibido: ${money(orders.reduce((sum, item) => sum + Number(item.paid_total || 0), 0))}`, `• Saldo estimado: ${money(orders.reduce((sum, item) => sum + Number(item.balance || 0), 0))}`,
    '', `${emoji.status} Los equipos quedaron registrados y pendientes de revisión técnica.`,
    'Conserva este mensaje como constancia de recepción. El diagnóstico y el valor final serán confirmados antes de realizar trabajos adicionales.',
  );
  return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(lines.join('\n'))}`;
}
