/**
 * Teste de fumaça ponta a ponta (execução manual).
 * Valida a API pública, o checkout real, o 2FA do admin e as ações do painel.
 * Uso: node server/tools/smoke.mjs <caminho-admin> <segredo-totp>
 */
const BASE = process.env.SMOKE_BASE || 'http://127.0.0.1:3000';
const ADMIN_PATH = process.argv[2];
const TOTP_SECRET = process.argv[3];

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const crypto = await import('node:crypto');

function base32Decode(input) {
  let bits = 0;
  let value = 0;
  const out = [];
  for (const char of input.toUpperCase().replace(/=+$/, '')) {
    const index = B32.indexOf(char);
    if (index < 0) throw new Error('secret inválido');
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
  const mac = crypto.createHmac('sha1', base32Decode(secret)).update(buffer).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    const info = await fn();
    passed += 1;
    console.log(`  ✅ ${name}${info ? ` — ${info}` : ''}`);
  } catch (error) {
    failed += 1;
    console.log(`  ❌ ${name} — ${error.message}`);
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body, headers: response.headers };
}

console.log('\n🔎 Teste de fumaça — Aura Rosa\n');

let store;
await check('GET /api/health', async () => {
  const { status, body } = await api('/api/health');
  if (status !== 200 || !body.ok) throw new Error(`status ${status}`);
  return `uptime ${body.uptimeSeconds}s`;
});

await check('GET /api/store', async () => {
  const { status, body } = await api('/api/store');
  if (status !== 200 || !body.products?.length) throw new Error('catálogo vazio');
  store = body;
  return `${body.products.length} produtos, ${body.banners.length} banner(s)`;
});

const product = store.products.find((item) => Object.values(item.inventory || {}).some((qty) => qty > 2));
const variantKey = product && Object.entries(product.inventory).find(([, qty]) => qty > 2)[0];
const [size, colorName] = variantKey.split('-');

let order;
await check('POST /api/checkout (pedido real, preço recalculado no servidor)', async () => {
  const { status, body } = await api('/api/checkout', {
    method: 'POST',
    body: JSON.stringify({
      lead: {
        fullName: 'Maria Teste da Silva',
        cpf: '52998224725',
        email: 'maria.teste@example.com',
        phone: '(11) 98765-4321',
        cep: '01310-100',
        street: 'Avenida Paulista',
        number: '1000',
        neighborhood: 'Bela Vista',
        city: 'São Paulo',
        state: 'SP'
      },
      items: [{ productId: product.id, selectedSize: size, selectedColor: { name: colorName }, quantity: 1 }],
      shippingMethod: 'PAC',
      paymentMethod: 'pix'
    })
  });
  if (status !== 201) throw new Error(`status ${status}: ${body.error}`);
  order = body.order;
  if (order.paymentStatus !== 'pendente') throw new Error('status de pagamento deveria ser pendente');
  return `${order.id} • R$ ${order.total.toFixed(2)} • pix ${order.paymentDetails.pixCopyPaste ? 'gerado' : 'ausente'}`;
});

await check('GET /api/orders/:id (com e-mail)', async () => {
  const { status, body } = await api(`/api/orders/${order.id}?email=maria.teste@example.com`);
  if (status !== 200) throw new Error(`status ${status}`);
  return body.order.orderStatus;
});

await check('GET /api/orders/:id sem e-mail é negado', async () => {
  const { status } = await api(`/api/orders/${order.id}?email=outro@example.com`);
  if (status !== 404) throw new Error(`esperado 404, veio ${status}`);
  return 'proteção de dados ok';
});

await check('POST /api/auth/register (conta real)', async () => {
  const { status, body } = await api('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      name: 'Ana Teste Souza',
      email: 'ana.teste@example.com',
      cpf: '11144477735',
      phone: '(11) 91234-5678',
      password: 'SenhaForte#2026'
    })
  });
  if (status !== 201) throw new Error(`${status}: ${body.error}`);
  return body.customer.email;
});

await check('POST /api/auth/login', async () => {
  const { status, body } = await api('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'ana.teste@example.com', password: 'SenhaForte#2026' })
  });
  if (status !== 200) throw new Error(`${status}: ${body.error}`);
  return 'token de sessão emitido';
});

await check('POST /api/cart/sync', async () => {
  const { status, body } = await api('/api/cart/sync', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'smoke-session-123456',
      email: 'ana.teste@example.com',
      items: [{ productId: product.id, name: product.name, quantity: 2, price: product.price, selectedSize: size, color: colorName }]
    })
  });
  if (status !== 200 || !body.ok) throw new Error('falha ao sincronizar');
  return `R$ ${body.cart.subtotal.toFixed(2)}`;
});

let token;
await check('Admin 1/2 — login com senha', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ username: 'supremo', password: 'AuraRosa-2026-Supremo-K9vQ7z' })
  });
  if (status !== 200) throw new Error(`${status}: ${body.error}`);
  token = body.challengeId;
  return `desafio ${body.delivery}`;
});

await check('Admin 2/2 — 2FA via TOTP', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/auth/verify`, {
    method: 'POST',
    body: JSON.stringify({ challengeId: token, code: totp(TOTP_SECRET) })
  });
  if (status !== 200) throw new Error(`${status}: ${body.error}`);
  token = body.token;
  return `sessão até ${new Date(body.session.expiresAt).toLocaleTimeString('pt-BR')}`;
});

const auth = { Authorization: `Bearer ${token}` };

await check('Senha errada + 2FA inválido é bloqueado', async () => {
  const { status } = await api(`${ADMIN_PATH}/api/auth/verify`, {
    method: 'POST',
    body: JSON.stringify({ challengeId: 'inexistente', code: '000000' })
  });
  if (status !== 401) throw new Error(`esperado 401, veio ${status}`);
  return 'ok';
});

await check('GET /overview', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/overview`, { headers: auth });
  if (status !== 200) throw new Error(`${status}`);
  if (body.metrics.revenue < 0) throw new Error('receita inválida');
  return `pedidos ${body.metrics.ordersCount} • carrinhos ativos ${body.metrics.cartsActive}`;
});

await check('POST /orders/:id/pay (confirma pagamento + lança no financeiro)', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/orders/${order.id}/pay`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ note: 'teste automatizado' })
  });
  if (status !== 200) throw new Error(`${status}: ${body.error}`);
  const cash = await api(`${ADMIN_PATH}/api/cashflow`, { headers: auth });
  const entry = cash.body.entries.find((item) => item.orderId === order.id);
  if (!entry) throw new Error('lançamento financeiro não criado');
  return `${body.order.orderStatus} • lançamento R$ ${entry.amount.toFixed(2)}`;
});

await check('POST /orders/:id/status (transição inválida é rejeitada)', async () => {
  const { status } = await api(`${ADMIN_PATH}/api/orders/${order.id}/status`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ status: 'aguardando_pagamento' })
  });
  if (status !== 409) throw new Error(`esperado 409, veio ${status}`);
  return 'regra de fluxo aplicada';
});

await check('POST /stock/move (entrada real)', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/stock/move`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ productId: product.id, variantKey, type: 'entrada', quantity: 5, reason: 'compra_fornecedor' })
  });
  if (status !== 201) throw new Error(`${status}: ${body.error}`);
  return `${body.movement.type} ${body.movement.quantity} → saldo ${body.movement.balanceAfter}`;
});

await check('POST /stock/move (saída acima do saldo é bloqueada)', async () => {
  const { status } = await api(`${ADMIN_PATH}/api/stock/move`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ productId: product.id, variantKey, type: 'saida', quantity: 9999, reason: 'venda' })
  });
  if (status !== 409) throw new Error(`esperado 409, veio ${status}`);
  return 'estoque íntegro';
});

await check('GET /security', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/security`, { headers: auth });
  if (status !== 200) throw new Error(`${status}`);
  return `${body.activeSessions} sessão(ões) • ${body.auditLog.length} eventos auditados`;
});

await check('GET /telegram/status (sem token: reporta não configurado, não simula)', async () => {
  const { status, body } = await api(`${ADMIN_PATH}/api/telegram/status`, { headers: auth });
  if (status !== 200) throw new Error(`${status}`);
  if (body.status.configured !== false) throw new Error('deveria estar não configurado');
  return 'estado honesto';
});

await check('Acesso admin sem token é negado', async () => {
  const { status } = await api(`${ADMIN_PATH}/api/overview`);
  if (status !== 401) throw new Error(`esperado 401, veio ${status}`);
  return 'ok';
});

await check('Rota admin inexistente retorna 404 na loja', async () => {
  const { status } = await api('/api/overview');
  if (status !== 404) throw new Error(`esperado 404, veio ${status}`);
  return 'ok';
});

console.log(`\n${failed === 0 ? '🎉' : '⚠️'} ${passed} passaram, ${failed} falharam\n`);
process.exit(failed === 0 ? 0 : 1);
