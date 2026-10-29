/**
 * Teste manual: valida que a integração com o Telegram conversa com a API real
 * do Telegram (um token inválido deve ser recusado pelo próprio Telegram).
 * Uso: node server/tools/telegram-probe.mjs <caminho-admin> <segredo-totp>
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';
const ADMIN_PATH = process.argv[2];
const TOTP_SECRET = process.argv[3];

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const crypto = await import('node:crypto');

function b32(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of input.toUpperCase().replace(/=+$/, '')) {
    const index = B32.indexOf(char);
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function totp(secret) {
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const mac = crypto.createHmac('sha1', b32(secret)).update(buffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

async function call(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

const login = await call(`${ADMIN_PATH}/api/auth/login`, {
  method: 'POST',
  body: JSON.stringify({ username: 'supremo', password: 'AuraRosa-2026-Supremo-K9vQ7z' })
});
if (login.status !== 200) {
  console.error('Falha no login:', login.body);
  process.exit(1);
}

const verify = await call(`${ADMIN_PATH}/api/auth/verify`, {
  method: 'POST',
  body: JSON.stringify({ challengeId: login.body.challengeId, code: totp(TOTP_SECRET) })
});
if (verify.status !== 200) {
  console.error('Falha no 2FA:', verify.body);
  process.exit(1);
}

const header = { Authorization: `Bearer ${verify.body.token}` };
const result = await call(`${ADMIN_PATH}/api/telegram/configure`, {
  method: 'POST',
  headers: header,
  body: JSON.stringify({ token: '123456789:AAfake-token-para-teste', chatId: '1' })
});

console.log(`status=${result.status}`);
console.log(`resposta=${JSON.stringify(result.body)}`);

const good = result.status === 400 && /Telegram|token/i.test(result.body.error || '');
console.log(good ? '✅ Telegram recusou o token falso (integração real funcionando)' : '❌ comportamento inesperado');
process.exit(good ? 0 : 1);
