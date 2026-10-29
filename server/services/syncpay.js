/**
 * ⚡ Integração Oficial com o Gateway SyncPay (SyncPayments)
 * Documentação: https://syncpay.apidog.io
 * ------------------------------------------------------------------
 * - Autenticação por Bearer Token (POST /auth-token com client_id e client_secret)
 * - Pix Cash-In dinâmico (POST /cash-in com QR Code e Copia e Cola)
 * - Consulta de saldo (GET /balance) e transações
 * - Tratamento de Webhooks assíncronos (timeout < 5s)
 */
import { config } from '../config.js';
import { db, commit, addAudit } from '../lib/db.js';
import { onlyDigits, nowIso } from '../lib/format.js';
import { markPaid } from './orders.js';

let cachedToken = null;
let tokenExpiresAt = 0;

export function getSyncPayConfig() {
  const gateway = db().settings.gateway || {};
  const syncpay = gateway.syncpay || {};
  const clientId = (syncpay.clientId || config.syncpay.clientId || '').trim();
  const clientSecret = (syncpay.clientSecret || config.syncpay.clientSecret || '').trim();
  const baseUrl = (syncpay.baseUrl || config.syncpay.baseUrl || 'https://api.syncpayments.com.br/api/partner/v1').replace(/\/+$/, '');
  const enabled = syncpay.enabled !== false && Boolean(clientId && clientSecret);

  return {
    enabled,
    clientId,
    clientSecret,
    baseUrl
  };
}

/**
 * Obtém ou reutiliza o Bearer Token da SyncPay
 */
export async function getAccessToken() {
  const conf = getSyncPayConfig();
  if (!conf.clientId || !conf.clientSecret) {
    throw new Error('Credenciais da SyncPay não configuradas (Client ID / Client Secret).');
  }

  // Se o token em cache ainda for válido por pelo menos mais 60 segundos
  if (cachedToken && Date.now() < tokenExpiresAt - 60000) {
    return cachedToken;
  }

  const response = await fetch(`${conf.baseUrl}/auth-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: conf.clientId,
      client_secret: conf.clientSecret
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson = null;
    try { errorJson = JSON.parse(errorText); } catch {}
    const msg = errorJson?.message || errorJson?.error || `Falha na autenticação SyncPay (Status ${response.status})`;
    throw new Error(msg);
  }

  const data = await response.json();
  const token = data.access_token || data.token;
  if (!token) throw new Error('SyncPay não retornou access_token.');

  cachedToken = token;
  const expiresIn = Number(data.expires_in || 3600);
  tokenExpiresAt = Date.now() + expiresIn * 1000;

  return cachedToken;
}

/**
 * Cria cobrança Pix via SyncPay (Cash-In)
 */
export async function createPixCashIn({ orderId, amount, description, client, webhookUrl }) {
  const conf = getSyncPayConfig();
  const token = await getAccessToken();

  const publicUrl = config.publicUrl || 'https://puzzles-prostores-ssl-try.trycloudflare.com';
  const targetWebhook = webhookUrl || `${publicUrl}/api/webhooks/syncpay`;

  const payload = {
    amount: Number(Number(amount).toFixed(2)),
    description: description || `Pedido ${orderId} - Flor de Seda`,
    webhook_url: targetWebhook,
    callbackUrl: targetWebhook,
    client: {
      name: String(client?.name || client?.fullName || 'Cliente').trim(),
      cpf: onlyDigits(client?.cpf || ''),
      email: String(client?.email || '').trim().toLowerCase(),
      phone: onlyDigits(client?.phone || '')
    }
  };

  const response = await fetch(`${conf.baseUrl}/cash-in`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorJson = null;
    try { errorJson = JSON.parse(errorText); } catch {}
    const msg = errorJson?.message || errorJson?.error || `Erro ao gerar Pix na SyncPay (${response.status})`;
    throw new Error(msg);
  }

  const result = await response.json();

  addAudit({
    actor: 'syncpay',
    action: 'syncpay.cashin.created',
    detail: `Pix gerado na SyncPay para pedido ${orderId} (Identifier: ${result.identifier || 'n/a'}).`,
    ip: 'server'
  });

  return {
    pixCopyPaste: result.pix_code || result.pixCode || result.emv || '',
    identifier: result.identifier || result.id || '',
    message: result.message || 'Pix gerado com sucesso'
  };
}

/**
 * Consulta em tempo real o status de uma transação na SyncPay
 */
export async function checkSyncPayTransaction(identifier) {
  if (!identifier) return null;
  const conf = getSyncPayConfig();
  if (!conf.enabled) return null;
  try {
    const token = await getAccessToken();
    const res = await fetch(`${conf.baseUrl}/transaction/${encodeURIComponent(identifier)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data || body;
  } catch (err) {
    console.error('[syncpay] Falha ao consultar transação:', err.message);
    return null;
  }
}

/**
 * Garante que a URL pública atual esteja registrada nos Webhooks da SyncPay
 */
export async function ensureSyncPayWebhook(targetUrl) {
  const conf = getSyncPayConfig();
  if (!conf.enabled) return null;
  const webhookUrl = targetUrl || `${config.publicUrl}/api/webhooks/syncpay`;

  try {
    const token = await getAccessToken();
    const listRes = await fetch(`${conf.baseUrl}/webhooks`, {
      headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
    });
    if (listRes.ok) {
      const listData = await listRes.json();
      const existing = (listData?.data || []).find((w) => w.url === webhookUrl && w.event === 'cashin');
      if (existing) return existing;
    }

    const createRes = await fetch(`${conf.baseUrl}/webhooks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        title: 'Flor de Seda Boutique - Cashin',
        url: webhookUrl,
        event: 'cashin',
        trigger_all_products: true
      })
    });
    if (createRes.ok) {
      return await createRes.json();
    }
  } catch (err) {
    console.error('[syncpay] Falha ao registrar webhook:', err.message);
  }
  return null;
}

/**
 * Consulta o saldo da conta na SyncPay
 */
export async function getSyncPayBalance() {
  const conf = getSyncPayConfig();
  if (!conf.enabled) return { enabled: false, balance: 0, pending: 0 };

  try {
    const token = await getAccessToken();
    const response = await fetch(`${conf.baseUrl}/balance`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      return { enabled: true, connected: false, error: `Status ${response.status}` };
    }

    const data = await response.json();
    return {
      enabled: true,
      connected: true,
      balance: Number(data.balance ?? data.available_balance ?? data.saldo ?? 0),
      pending: Number(data.pending_balance ?? data.blocked_balance ?? 0),
      currency: 'BRL',
      checkedAt: nowIso()
    };
  } catch (error) {
    return {
      enabled: true,
      connected: false,
      error: error.message
    };
  }
}

/**
 * Processador central dos Webhooks da SyncPay
 * Documentação: timeout máximo de 5 segundos
 */
export async function processSyncPayWebhook(body) {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Payload vazio' };
  }

  // O identificador pode vir no campo identifier, id, transaction_id, reference_id, etc.
  const identifier = String(
    body.identifier ||
    body.id ||
    body.reference_id ||
    body.transaction_id ||
    body.data?.identifier ||
    body.data?.id ||
    body.data?.reference_id ||
    ''
  ).trim();

  // O status de aprovação
  let status = String(
    body.status || body.event || body.type || body.data?.status || ''
  ).trim().toLowerCase();

  let isApproved = [
    'paid',
    'approved',
    'completed',
    'pago',
    'concluido',
    'sucesso',
    'success'
  ].some((s) => status.includes(s));

  // Se o evento foi onUpdate ou não veio explícito, consulta status direto da API SyncPay
  if (!isApproved && identifier) {
    try {
      const tx = await checkSyncPayTransaction(identifier);
      if (tx && tx.status) {
        const txStatus = String(tx.status).toLowerCase();
        if (['paid', 'approved', 'completed', 'pago'].some((s) => txStatus.includes(s))) {
          isApproved = true;
          status = txStatus;
        }
      }
    } catch {}
  }

  if (!identifier && !body.order_id && !body.txid) {
    return { ok: true, ignored: true, reason: 'Identificador ausente' };
  }

  const data = db();
  const order = data.orders.find((ord) => {
    return (
      (identifier && (ord.gatewayTransactionId === identifier || ord.paymentDetails?.identifier === identifier)) ||
      (body.order_id && ord.id === body.order_id) ||
      (body.txid && (ord.id === body.txid || ord.paymentDetails?.txid === body.txid))
    );
  });

  if (!order) {
    addAudit({
      actor: 'syncpay:webhook',
      action: 'syncpay.webhook.unmatched',
      detail: `Webhook recebido mas nenhum pedido associado encontrado (Identifier: ${identifier}, Status: ${status}).`,
      ip: 'webhook'
    });
    return { ok: true, matched: false };
  }

  // Se confirmado/pago
  if (isApproved && order.paymentStatus !== 'confirmado') {
    markPaid(order.id, {
      actor: 'syncpay:webhook',
      note: `Pagamento Pix confirmado automaticamente pela SyncPay (Identifier: ${identifier}).`
    });

    addAudit({
      actor: 'syncpay:webhook',
      action: 'syncpay.payment.confirmed',
      detail: `Pedido ${order.id} confirmado via webhook SyncPay.`,
      ip: 'webhook'
    });

    return { ok: true, orderId: order.id, status: 'confirmado' };
  }

  return { ok: true, orderId: order.id, status: order.paymentStatus };
}

