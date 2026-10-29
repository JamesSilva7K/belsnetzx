/**
 * 💠 Gerador real de BR Code Pix (EMV® QRCPS-MPM)
 * -------------------------------------------------
 * Implementa o padrão do Banco Central: TLV EMV + CRC16/CCITT-FALSE.
 * O código gerado é válido e escaneável em qualquer app bancário.
 */

function tlv(id, value) {
  const size = Buffer.byteLength(value, 'utf8');
  return `${id}${String(size).padStart(2, '0')}${value}`;
}

/** CRC16/CCITT-FALSE — polinômio 0x1021, inicial 0xFFFF, sem reflexão. */
export function crc16(payload) {
  let crc = 0xffff;
  for (const byte of Buffer.from(payload, 'utf8')) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function sanitize(text, max) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .toUpperCase();
}

export function buildPixPayload({ key, merchantName, merchantCity, amount, txid = '***' }) {
  if (!key) throw new Error('Chave Pix não configurada');

  const name = sanitize(merchantName || 'LOJA', 25);
  const city = sanitize(merchantCity || 'SAO PAULO', 15);
  const reference = sanitize(txid, 25).replace(/ /g, '') || '***';

  let payload = '';
  payload += tlv('00', '01');
  payload += tlv('26', tlv('00', 'br.gov.bcb.pix') + tlv('01', key));
  payload += tlv('52', '0000');
  payload += tlv('53', '986');
  if (amount && Number(amount) > 0) payload += tlv('54', Number(amount).toFixed(2));
  payload += tlv('58', 'BR');
  payload += tlv('59', name || 'LOJA');
  payload += tlv('60', city || 'SAO PAULO');
  payload += tlv('62', tlv('05', reference));
  payload += '6304';

  return payload + crc16(payload);
}
