/**
 * 🤖 Serviço do bot do Telegram (tempo de execução)
 * -------------------------------------------------
 * Guarda o token de forma cifrada, mantém o long polling, entrega notificações
 * com botões acionáveis e expõe status real para o painel.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { commit, db } from '../lib/db.js';
import { brl, dateTimeBR, escapeHtml } from '../lib/format.js';
import { createTelegramClient, TelegramError } from '../lib/telegram-client.js';
import { decrypt, encrypt } from '../lib/crypto.js';

const VAULT_KEY = crypto.scryptSync(config.masterKey, 'aura-rosa::telegram::v1', 32);

let client = null;
let clientToken = '';
let profile = null;
let polling = false;
let pollingStop = false;
let lastError = '';
let startedAt = null;

export function storedToken() {
  const data = db();
  if (data.telegram.tokenEncrypted) {
    try {
      return decrypt(data.telegram.tokenEncrypted, VAULT_KEY, 'telegram-token');
    } catch (error) {
      console.error('[telegram] Não foi possível decifrar o token salvo:', error.message);
    }
  }
  return config.telegram.token || '';
}

export function activeToken() {
  return storedToken();
}

export function botClient() {
  const token = activeToken();
  if (!token) return null;
  if (!client || clientToken !== token) {
    client = createTelegramClient(token);
    clientToken = token;
    profile = null;
  }
  return client;
}

export function adminChatId() {
  const data = db();
  return (
    data.telegram.chatId ||
    config.telegram.chatId ||
    data.telegram.adminIds?.[0] ||
    config.telegram.adminIds[0] ||
    ''
  );
}

export function isConfigured() {
  return Boolean(activeToken() && adminChatId());
}

export async function sendTelegramMessage(chatId, html, options = {}) {
  const api = botClient();
  if (!api) throw new TelegramError('Bot não configurado');
  return api.sendMessage(chatId, html, options);
}

export async function sendToAdmin(html, options = {}) {
  const chatId = adminChatId();
  if (!chatId) throw new TelegramError('Chat do administrador não configurado');
  return sendTelegramMessage(chatId, html, options);
}

export async function refreshProfile() {
  const api = botClient();
  if (!api) {
    profile = null;
    return null;
  }
  try {
    profile = await api.getMe();
    commit((data) => {
      data.telegram.botUsername = profile.username || '';
      data.telegram.lastError = '';
      data.telegram.lastActivityAt = new Date().toISOString();
    });
    return profile;
  } catch (error) {
    lastError = error.message;
    commit((data) => {
      data.telegram.lastError = error.message;
    });
    throw error;
  }
}

export async function status() {
  const data = db();
  const token = activeToken();
  return {
    configured: Boolean(token && adminChatId()),
    tokenPresent: Boolean(token),
    tokenSource: data.telegram.tokenEncrypted ? 'vault' : config.telegram.token ? 'env' : 'none',
    chatConfigured: Boolean(adminChatId()),
    chatId: adminChatId() ? `${String(adminChatId()).slice(0, 3)}…${String(adminChatId()).slice(-3)}` : '',
    adminIds: (data.telegram.adminIds?.length ? data.telegram.adminIds : config.telegram.adminIds).length,
    botUsername: profile?.username || data.telegram.botUsername || '',
    botName: profile?.first_name || '',
    polling,
    startedAt: startedAt || data.telegram.startedAt,
    lastActivityAt: data.telegram.lastActivityAt,
    lastError: lastError || data.telegram.lastError || '',
    webhookMode: Boolean(config.telegram.webhookUrl),
    commands: COMMANDS.map((command) => command.command)
  };
}

export async function configure({ token, chatId, adminIds, enabled = true }) {
  let resolvedChat = chatId ? String(chatId).trim() : '';
  const resolvedToken = token ? String(token).trim() : activeToken();

  if (!resolvedToken) throw new TelegramError('Informe o token do bot (BotFather).');

  // Valida o token de verdade antes de salvar qualquer coisa
  const probe = createTelegramClient(resolvedToken);
  const me = await probe.getMe();

  if (!resolvedChat) {
    // tenta descobrir o chat via getUpdates (mensagem /start já enviada)
    try {
      const updates = await probe.getUpdates(0, 0);
      const candidate = updates
        ?.slice()
        .reverse()
        .map((update) => update.message?.chat?.id || update.callback_query?.message?.chat?.id)
        .find(Boolean);
      if (candidate) resolvedChat = String(candidate);
    } catch {
      /* sem updates pendentes */
    }
  }

  const ids = (adminIds || [])
    .map((id) => String(id).trim())
    .filter(Boolean);

  if (resolvedChat && !ids.includes(resolvedChat)) ids.unshift(resolvedChat);

  commit((data) => {
    data.telegram.tokenEncrypted = encrypt(resolvedToken, VAULT_KEY, 'telegram-token');
    data.telegram.chatId = resolvedChat;
    data.telegram.adminIds = ids;
    data.telegram.enabled = Boolean(enabled);
    data.telegram.botUsername = me.username || '';
    data.telegram.lastError = '';
    data.telegram.lastActivityAt = new Date().toISOString();
    data.auditLog.unshift({
      id: `aud-${Date.now()}`,
      at: new Date().toISOString(),
      actor: 'painel',
      action: 'telegram.configured',
      detail: `Bot @${me.username || me.id} conectado${resolvedChat ? ` • chat ${resolvedChat}` : ' • chat pendente'}.`,
      ip: ''
    });
  });

  client = null;
  clientToken = '';
  await refreshProfile();

  if (!polling) startPolling();

  return status();
}

export async function testMessage() {
  const me = profile || (await refreshProfile());
  const text = [
    '✅ <b>Teste de conexão — Aura Rosa</b>',
    '',
    `Bot: @${escapeHtml(me?.username || 'desconhecido')}`,
    `Horário: ${dateTimeBR(new Date().toISOString())}`,
    '',
    '<i>Se você recebeu esta mensagem, as notificações de vendas, estoque, carrinhos e contas estão ativas.</i>'
  ].join('\n');
  await sendToAdmin(text);
  commit((data) => {
    data.telegram.lastActivityAt = new Date().toISOString();
    data.telegram.lastError = '';
  });
  return { ok: true };
}

export async function disconnect() {
  pollingStop = true;
  polling = false;
  commit((data) => {
    data.telegram.tokenEncrypted = '';
    data.telegram.chatId = '';
    data.telegram.adminIds = [];
    data.telegram.enabled = false;
    data.telegram.botUsername = '';
    data.telegram.lastError = '';
  });
  client = null;
  clientToken = '';
  profile = null;
  return status();
}

/* ------------------------------------------------------------------ *
 * Long polling
 * ------------------------------------------------------------------ */

export function startPolling() {
  if (polling) return;
  if (!activeToken()) return;
  if (config.telegram.webhookUrl) {
    beginWebhook();
    return;
  }

  polling = true;
  pollingStop = false;
  startedAt = new Date().toISOString();
  commit((data) => {
    data.telegram.startedAt = startedAt;
  });

  (async () => {
    let backoff = 1000;
    while (!pollingStop) {
      try {
        const api = botClient();
        if (!api) break;
        const offset = Number(db().telegram.lastUpdateId || 0) + 1;
        const updates = await api.getUpdates(offset, 50);
        if (updates?.length) {
          const { handleUpdate } = await import('./telegram-bot.js');
          for (const update of updates) {
            try {
              await handleUpdate(update);
            } catch (error) {
              console.error('[telegram] Erro ao tratar update:', error.message);
            }
            commit((data) => {
              data.telegram.lastUpdateId = update.update_id;
              data.telegram.lastActivityAt = new Date().toISOString();
            });
          }
        }
        backoff = 1000;
      } catch (error) {
        lastError = error.message;
        if (error.status === 401 || error.status === 404) {
          console.error('[telegram] Token inválido — polling interrompido.');
          commit((data) => {
            data.telegram.lastError = 'Token inválido ou revogado.';
          });
          break;
        }
        console.error('[telegram] Falha no polling:', error.message);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        backoff = Math.min(backoff * 2, 30000);
      }
    }
    polling = false;
  })();
}

async function beginWebhook() {
  try {
    const api = botClient();
    if (!api) return;
    await api.setWebhook(config.telegram.webhookUrl, config.telegram.webhookSecret);
    console.log(`[telegram] Webhook registrado em ${config.telegram.webhookUrl}`);
  } catch (error) {
    console.error('[telegram] Falha ao registrar webhook:', error.message);
  }
}

export function stopPolling() {
  pollingStop = true;
}

export const COMMANDS = [
  { command: 'painel', description: 'Abrir o painel de botões' },
  { command: 'resumo', description: 'Métricas do dia em tempo real' },
  { command: 'pedidos', description: 'Pedidos recentes e ações' },
  { command: 'estoque', description: 'Estoque e alertas' },
  { command: 'carrinhos', description: 'Carrinhos abandonados' },
  { command: 'clientes', description: 'Clientes e contas novas' },
  { command: 'link', description: 'Link seguro do painel' },
  { command: 'status', description: 'Saúde do sistema' },
  { command: 'ajuda', description: 'Lista de comandos' }
];

export async function registerCommands() {
  const api = botClient();
  if (!api) return;
  try {
    await api.setMyCommands(COMMANDS);
  } catch (error) {
    console.error('[telegram] Falha ao registrar comandos:', error.message);
  }
}

/* ------------------------------------------------------------------ *
 * Notificações (sink)
 * ------------------------------------------------------------------ */

const TYPE_ICONS = {
  order_created: '🛒',
  order_paid: '💰',
  order_status: '🔄',
  stock_in: '📦',
  stock_out: '📤',
  low_stock: '⚠️',
  cart_abandoned: '🧺',
  cart_contacted: '📨',
  account_created: '👤',
  cash_in: '💵',
  cash_out: '💸',
  security_alert: '🔐'
};

function money(value) {
  return brl(value);
}

export function formatNotification(notification) {
  const meta = notification.meta || {};
  const lines = [];
  lines.push(`<b>${escapeHtml(notification.title)}</b>`);
  lines.push('');

  switch (notification.type) {
    case 'order_created':
    case 'order_paid': {
      lines.push(`👤 <b>${escapeHtml(meta.customer || '')}</b>`);
      lines.push(`📧 ${escapeHtml(meta.email || '')} • 📱 ${escapeHtml(meta.phone || '')}`);
      if (meta.city) lines.push(`📍 ${escapeHtml(meta.city)}`);
      lines.push('');
      (meta.items || []).forEach((item) => lines.push(`• ${escapeHtml(item)}`));
      lines.push('');
      lines.push(`💳 ${escapeHtml(meta.paymentLabel || '')}`);
      lines.push(`🚚 ${escapeHtml(meta.shippingLabel || '')}`);
      lines.push(
        `Subtotal ${money(meta.subtotal)}${meta.discount ? ` • desconto ${money(meta.discount)}` : ''} • frete ${money(meta.shipping)}`
      );
      lines.push(`<b>Total ${money(meta.total)}</b>`);
      lines.push(`<i>${dateTimeBR(notification.at)}</i>`);
      break;
    }
    case 'order_status': {
      lines.push(`👤 ${escapeHtml(meta.customer || '')}`);
      lines.push(`💵 ${money(meta.total)}`);
      if (meta.trackingCode) lines.push(`🔗 Rastreio <code>${escapeHtml(meta.trackingCode)}</code>`);
      if (meta.actor) lines.push(`<i>por ${escapeHtml(meta.actor)}</i>`);
      lines.push(`<i>${dateTimeBR(notification.at)}</i>`);
      break;
    }
    case 'stock_in':
    case 'stock_out': {
      lines.push(`🧵 <b>${escapeHtml(meta.productName || '')}</b>`);
      lines.push(`Variação: ${escapeHtml(meta.variantKey || '')}`);
      lines.push(`Quantidade: <b>${meta.quantity}</b> • Saldo: <b>${meta.balanceAfter}</b>`);
      lines.push(`Motivo: ${escapeHtml(meta.reasonLabel || meta.reason || '')}`);
      if (meta.note) lines.push(`Obs.: ${escapeHtml(meta.note)}`);
      lines.push(`<i>por ${escapeHtml(meta.actor || '')} • ${dateTimeBR(notification.at)}</i>`);
      break;
    }
    case 'low_stock': {
      lines.push(`🧵 ${escapeHtml(meta.productName || '')}`);
      lines.push(`Variação ${escapeHtml(meta.variantKey || '')} com <b>${meta.balanceAfter}</b> unidade(s).`);
      lines.push(`Valor de custo em estoque: ${money(meta.stockValue)}`);
      break;
    }
    case 'cart_abandoned': {
      lines.push(`🧺 ${meta.itemsCount} item(ns) • <b>${money(meta.subtotal)}</b>`);
      lines.push(`Parado há ${meta.minutesIdle} min`);
      if (meta.email) lines.push(`📧 ${escapeHtml(meta.email)}`);
      (meta.productNames || []).slice(0, 5).forEach((name) => lines.push(`• ${escapeHtml(name)}`));
      break;
    }
    case 'account_created': {
      lines.push(`👤 <b>${escapeHtml(meta.name || '')}</b>`);
      lines.push(`📧 ${escapeHtml(meta.email || '')} • 📱 ${escapeHtml(meta.phone || '')}`);
      if (meta.city) lines.push(`📍 ${escapeHtml(meta.city)}`);
      lines.push(`<i>${dateTimeBR(notification.at)}</i>`);
      break;
    }
    case 'cash_in':
    case 'cash_out': {
      lines.push(`📄 ${escapeHtml(meta.title || '')}`);
      lines.push(`Categoria: ${escapeHtml(meta.categoryLabel || '')}`);
      lines.push(`Valor: <b>${money(meta.amount)}</b>`);
      if (meta.notes) lines.push(`Obs.: ${escapeHtml(meta.notes)}`);
      lines.push(`<i>por ${escapeHtml(meta.actor || '')} • ${dateTimeBR(notification.at)}</i>`);
      break;
    }
    case 'security_alert': {
      if (meta.username) lines.push(`Usuário: <code>${escapeHtml(meta.username)}</code>`);
      if (meta.ip) lines.push(`IP: <code>${escapeHtml(meta.ip)}</code>`);
      lines.push(`<i>${dateTimeBR(notification.at)}</i>`);
      break;
    }
    default: {
      lines.push(escapeHtml(notification.detail || ''));
      lines.push(`<i>${dateTimeBR(notification.at)}</i>`);
    }
  }

  return lines.join('\n');
}

export function keyboardFor(notification) {
  const meta = notification.meta || {};
  const rows = [];

  if (['order_created', 'order_paid', 'order_status'].includes(notification.type) && meta.orderId) {
    const id = meta.orderId;
    if (notification.type === 'order_created') {
      rows.push([
        { text: '💰 Marcar pago', callback_data: `o:p:${id}` },
        { text: '📦 Separação', callback_data: `o:s:${id}` }
      ]);
    }
    if (notification.type === 'order_paid') {
      rows.push([{ text: '📦 Iniciar separação', callback_data: `o:s:${id}` }]);
    }
    rows.push([
      { text: '🔎 Detalhes', callback_data: `o:v:${id}` },
      { text: '❌ Cancelar', callback_data: `o:c!${id}` }
    ]);
  }

  if (notification.type === 'cart_abandoned' && meta.cartId) {
    rows.push([{ text: '📨 Marcar como contatado', callback_data: `ct:c:${meta.cartId}` }]);
  }

  if (notification.type === 'stock_in' || notification.type === 'stock_out') {
    rows.push([{ text: '📦 Ver estoque', callback_data: 'menu:stock' }]);
  }

  if (notification.type === 'account_created') {
    rows.push([{ text: '👤 Ver clientes', callback_data: 'menu:clients' }]);
  }

  rows.push([{ text: '🏠 Painel', callback_data: 'menu:root' }]);
  return { inline_keyboard: rows };
}

export async function deliverNotification(notification) {
  if (!isConfigured()) return;
  if (!['order_created', 'order_paid', 'order_status', 'stock_in', 'stock_out', 'low_stock', 'cart_abandoned', 'account_created', 'cash_in', 'cash_out', 'security_alert'].includes(notification.type)) {
    return;
  }
  const chatId = adminChatId();
  const html = `${TYPE_ICONS[notification.type] || '🔔'} ${formatNotification(notification)}`;
  await sendTelegramMessage(chatId, html, { reply_markup: keyboardFor(notification) });
  commit((data) => {
    data.telegram.lastActivityAt = new Date().toISOString();
  });
}
