export function annexWhatsAppUrl(
  phone: string,
  bookLabel: string,
  shareUrl: string,
  expiresAt: number,
): string {
  let digits = (phone || '').replace(/\D/g, '');
  if (digits.length === 8) digits = `503${digits}`;
  if (!digits) return '';

  const expires = new Date(expiresAt * 1000).toLocaleString('es-SV', { dateStyle: 'medium', timeStyle: 'short' });
  const lines = [
    `Hola \u{1F44B}`,
    '',
    `\u{1F4C4} Te comparto el anexo fiscal *${bookLabel}*.`,
    `\u{1F517} ${shareUrl}`,
    '',
    `⚠️ Este enlace vence el ${expires}.`,
  ];

  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(lines.join('\n'))}`;
}
