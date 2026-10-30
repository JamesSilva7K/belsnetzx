/**
 *  Núcleo criptográfico — Aura Rosa
 * -------------------------------------------------
 * Implementações reais, sem dependências externas:
 *  - scrypt para senhas (memória endurecida, salt por usuário)
 *  - AES-256-GCM para dados sensíveis em repouso (com AAD)
 *  - HMAC-SHA256 para tokens e caminho criptografado do painel
 *  - TOTP (RFC 6238) para o segundo fator de autenticação do admin
 */
import crypto from 'node:crypto';

export function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

export function hmacSha256(secret, value) {
  return crypto.createHmac('sha256', String(secret)).update(String(value)).digest('hex');
}

/** Deriva uma chave AES-256 determinística a partir de um segredo com scrypt. */
export function deriveKey(secret, salt = 'aura-rosa::vault::v1') {
  return crypto.scryptSync(String(secret), salt, 32);
}

export function constantTimeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function timingSafeStringEqual(a, b) {
  const left = crypto.createHash('sha256').update(String(a)).digest();
  const right = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(left, right);
}

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto
    .scryptSync(String(password).normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p })
    .toString('hex');
  return { salt, hash, algorithm: `scrypt-${SCRYPT.N}-${SCRYPT.r}-${SCRYPT.p}` };
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.salt || !stored.hash) return false;
  try {
    const candidate = crypto.scryptSync(String(password).normalize('NFKC'), stored.salt, SCRYPT.keylen, {
      N: SCRYPT.N,
      r: SCRYPT.r,
      p: SCRYPT.p
    });
    const expected = Buffer.from(stored.hash, 'hex');
    return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
  } catch {
    return false;
  }
}

/** AES-256-GCM. Retorna uma string versionada: v1.<iv>.<tag>.<ciphertext> (base64url). */
export function encrypt(plaintext, key, aad = 'aura-rosa') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(String(plaintext), 'utf8')), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decrypt(payload, key, aad = 'aura-rosa') {
  if (typeof payload !== 'string') throw new Error('Payload criptografado inválido');
  const [version, ivB64, tagB64, dataB64] = payload.split('.');
  if (version !== 'v1' || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error('Formato de payload criptografado não reconhecido');
  }
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]);
  return plaintext.toString('utf8');
}

export function encryptJson(value, key, aad) {
  return encrypt(JSON.stringify(value), key, aad);
}

export function decryptJson(payload, key, aad) {
  return JSON.parse(decrypt(payload, key, aad));
}

/* ------------------------------------------------------------------ *
 * TOTP — RFC 6238 (compatível com Google Authenticator / Authy)
 * ------------------------------------------------------------------ */

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(input) {
  const clean = String(input).toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of clean) {
    const index = B32_ALPHABET.indexOf(char);
    if (index === -1) throw new Error('Segredo TOTP inválido');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret() {
  return base32Encode(crypto.randomBytes(20));
}

export function totpCode(secretBase32, { at = Date.now(), step = 30, digits = 6 } = {}) {
  const counter = Math.floor(at / 1000 / step);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', base32Decode(secretBase32)).update(buffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** digits).padStart(digits, '0');
}

export function verifyTotp(secretBase32, code, { window = 1, step = 30 } = {}) {
  const clean = String(code || '').replace(/\D/g, '');
  if (clean.length !== 6) return false;
  const now = Date.now();
  for (let offset = -window; offset <= window; offset += 1) {
    const candidate = totpCode(secretBase32, { at: now + offset * step * 1000, step });
    if (timingSafeStringEqual(candidate, clean)) return true;
  }
  return false;
}

export function totpUri({ issuer, account, secret }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: '6', period: '30' });
  return `otpauth://totp/${label}?${params.toString()}`;
}
