/**
 * 🤖 Painel do bot no Telegram — operação real por botões
 * -------------------------------------------------
 * Tudo o que o botão faz altera o banco de dados de verdade e é registrado na
 * trilha de auditoria. O bot também entende comandos de texto com argumentos.
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { commit, db, nextId, addAudit } from '../lib/db.js';
import { brl, dateTimeBR, escapeHtml, nowIso } from '../lib/format.js';
import {
  adminChatId,
  botClient,
  formatNotification,
  isConfigured,
  sendTelegramMessage
} from './telegram-service.js';
import { adminPathPrefix } from './admin-auth.js';
import { changeStatus, getOrder, markPaid, listOrders, setTrackingCode, STATUS_LABELS, PAYMENT_LABELS } from './orders.js';
import { moveStock, stockOverview, listMovements } from './stock.js';
import { listCarts, markCartContacted } from './carts.js';
import { dashboardMetrics, financialSummary } from './finance.js';
import { listCustomers } from './customers.js';
import { recentNotifications } from './notify.js';

const awaiting = new Map(); // chatId -> { action, payload, expiresAt }
const AWAIT_TTL = 5 * 60 * 1000;

/* ------------------------------------------------------------------ */

function authorized(chatId) {
  const ids = new Set(
    [...(db().telegram.adminIds || []), ...config.telegram.adminIds, adminChatId()].map(String).filter(Boolean)
  );
  return ids.has(String(chatId));
}

function header(title, subtitle = '') {
  return `<b>${escapeHtml(title)}</b>${subtitle ? `\n<i>${escapeHtml(subtitle)}</i>` : ''}\n`;
}

function statusBadge(status) {
  return (
    {
      aguardando_pagamento: '🕓 aguardando pagamento',
      pago: '💰 pago',
      em_separacao: '📦 em separação',
      enviado: '🚚 enviado',
      entregue: '✔️ entregue',
      cancelado: '❌ cancelado'
    }[status] || status
  );
}

/* ------------------------------------------------------------------ *
 * Views
 * ------------------------------------------------------------------ */

function rootView() {
  const metrics = dashboardMetrics();
  const text =
    header('🌸 Aura Rosa — Central de Comando', 'Dados reais, atualizados agora') +
    `\n💰 Faturamento confirmado: <b>${brl(metrics.revenue)}</b>` +
    `\n📅 Hoje: <b>${brl(metrics.todayEarnings)}</b>` +
    `\n🧾 Pedidos: <b>${metrics.ordersCount}</b> • pagos: <b>${metrics.confirmedCount}</b> • pendentes: <b>${metrics.pendingCount}</b>` +
    `\n🧺 Carrinhos ativos: <b>${metrics.cartsActive}</b> • abandonados: <b>${metrics.cartsAbandoned}</b>` +
    `\n👤 Clientes: <b>${metrics.customersCount}</b>` +
    `\n📦 Estoque: <b>${metrics.stockUnits}</b> un. • críticos: <b>${metrics.criticalStockCount}</b>` +
    `\n\n${isConfigured() ? '🟢 Bot conectado' : '🟡 Bot sem chat configurado'} • ${escapeHtml(dateTimeBR(nowIso()))}`;

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [
          { text: '📊 Resumo', callback_data: 'menu:overview' },
          { text: '🧾 Pedidos', callback_data: 'menu:orders' }
        ],
        [
          { text: '📦 Estoque', callback_data: 'menu:stock' },
          { text: '🧺 Carrinhos', callback_data: 'menu:carts' }
        ],
        [
          { text: '👤 Clientes', callback_data: 'menu:clients' },
          { text: '🔔 Alertas', callback_data: 'menu:alerts' }
        ],
        [
          { text: '🔐 Link do painel', callback_data: 'menu:link' },
          { text: '🩺 Status', callback_data: 'menu:status' }
        ],
        [{ text: '🔄 Atualizar', callback_data: 'menu:root' }]
      ]
    }
  };
}

function overviewView() {
  const m = dashboardMetrics();
  const f = financialSummary();
  const series = m.revenueByDay
    .slice(-7)
    .map((entry) => `${entry.day.slice(8, 10)}/${entry.day.slice(5, 7)} ${brl(entry.total)}`)
    .join('\n');

  const text =
    header('📊 Resumo financeiro real', 'somente pedidos com pagamento confirmado') +
    `\nFaturamento: <b>${brl(f.revenue)}</b>` +
    `\nHoje: <b>${brl(f.todayEarnings)}</b> • 7 dias: <b>${brl(f.weekEarnings)}</b> • 30 dias: <b>${brl(f.monthEarnings)}</b>` +
    `\nTicket médio: <b>${brl(f.averageTicket)}</b>` +
    `\nDespesas: <b>${brl(f.expenses)}</b> • Lucro líquido: <b>${brl(f.netProfit)}</b>` +
    `\nA receber (pendente): <b>${brl(f.pendingRevenue)}</b>` +
    `\n\n📈 Últimos 7 dias\n<code>${escapeHtml(series || 'sem vendas confirmadas')}</code>` +
    `\n\n🏆 Top produtos\n${m.topProducts.length ? m.topProducts.map((p) => `• ${escapeHtml(p.name)} — ${p.units} un. (${brl(p.revenue)})`).join('\n') : '<i>sem vendas</i>'}`;

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: '🧾 Pedidos pendentes', callback_data: 'menu:orders' }],
        [{ text: '🏠 Painel', callback_data: 'menu:root' }]
      ]
    }
  };
}

function ordersView(filter = 'recent') {
  const orders = listOrders({ limit: 8 });
  const pending = orders.filter((order) => order.paymentStatus === 'pendente');
  const list = filter === 'pending' ? pending : orders;

  const text =
    header(filter === 'pending' ? '🕓 Pedidos aguardando pagamento' : '🧾 Pedidos recentes', `${list.length} pedido(s)`) +
    '\n' +
    (list
      .map(
        (order) =>
          `${statusBadge(order.orderStatus)}\n<b>${order.id}</b> • ${brl(order.total)}\n${escapeHtml(order.lead.fullName)} • ${dateTimeBR(order.createdAt)}`
      )
      .join('\n\n') || '<i>Nenhum pedido ainda.</i>');

  const rows = list.slice(0, 6).map((order) => [
    {
      text: `${order.id} • ${brl(order.total)}`,
      callback_data: `o:v:${order.id}`
    }
  ]);
  rows.push([
    { text: '🕓 Pendentes', callback_data: 'menu:orders:pending' },
    { text: '🏠 Painel', callback_data: 'menu:root' }
  ]);

  return { text, keyboard: { inline_keyboard: rows } };
}

function orderView(orderId) {
  const order = getOrder(orderId);
  if (!order) return { text: 'Pedido não encontrado.', keyboard: { inline_keyboard: [[{ text: '« Voltar', callback_data: 'menu:orders' }]] } };

  const items = order.items
    .map((item) => `• ${item.quantity}x ${escapeHtml(item.name)} — ${item.selectedSize}/${escapeHtml(item.selectedColor?.name || '')}`)
    .join('\n');

  const text = [
    `<b>🧾 Pedido ${order.id}</b>`,
    `<i>${dateTimeBR(order.createdAt)}</i>`,
    '',
    `👤 ${escapeHtml(order.lead.fullName)}`,
    `📧 ${escapeHtml(order.lead.email)} • 📱 ${escapeHtml(order.lead.phone)}`,
    `📍 ${escapeHtml(order.lead.street)}, ${escapeHtml(order.lead.number)} — ${escapeHtml(order.lead.neighborhood)}`,
    `${escapeHtml(order.lead.city)}/${escapeHtml(order.lead.state)} • CEP ${escapeHtml(order.lead.cep)}`,
    '',
    items,
    '',
    `Subtotal ${brl(order.subtotal)} • desconto ${brl(order.discount)} • frete ${brl(order.shippingCost)}`,
    `<b>Total ${brl(order.total)}</b>`,
    `💳 ${PAYMENT_LABELS[order.paymentMethod]} — ${order.paymentStatus}`,
    `🚚 ${order.shippingMethod}${order.trackingCode ? ` • <code>${escapeHtml(order.trackingCode)}</code>` : ''}`,
    `📌 ${statusBadge(order.orderStatus)}`,
    '',
    `<i>Histórico: ${order.history.length} evento(s)</i>`
  ].join('\n');

  const rows = [];
  if (order.paymentStatus === 'pendente') {
    rows.push([{ text: '💰 Confirmar pagamento', callback_data: `o:p:${order.id}` }]);
  }
  if (['pago', 'aguardando_pagamento'].includes(order.orderStatus)) {
    rows.push([{ text: '📦 Iniciar separação', callback_data: `o:s:${order.id}` }]);
  }
  if (order.orderStatus === 'em_separacao') {
    rows.push([{ text: '🚚 Marcar enviado', callback_data: `o:h:${order.id}` }]);
  }
  if (order.orderStatus === 'enviado') {
    rows.push([{ text: '✔️ Marcar entregue', callback_data: `o:d:${order.id}` }]);
  }
  rows.push([
    { text: '🔗 Rastreio', callback_data: `o:t:${order.id}` },
    { text: '❌ Cancelar', callback_data: `o:c!:${order.id}` }
  ]);
  rows.push([
    { text: '🔄 Atualizar', callback_data: `o:v:${order.id}` },
    { text: '« Pedidos', callback_data: 'menu:orders' }
  ]);

  return { text, keyboard: { inline_keyboard: rows } };
}

function stockView() {
  const overview = stockOverview();
  const movements = listMovements({ limit: 5 });
  const critical = overview.products
    .filter((product) => product.critical.length > 0)
    .slice(0, 5);

  const text =
    header('📦 Estoque em tempo real', `${overview.totals.units} unidades • custo ${brl(overview.totals.costValue)}`) +
    `\nValor de venda: <b>${brl(overview.totals.saleValue)}</b>` +
    `\nVariações críticas (≤ ${overview.lowStockThreshold}): <b>${overview.criticalCount}</b>` +
    (critical.length
      ? `\n\n⚠️ <b>Atenção</b>\n${critical
          .map((product) => `${escapeHtml(product.name)}\n${product.critical.map((c) => `  • ${escapeHtml(c.variantKey)}: ${c.stock}`).join('\n')}`)
          .join('\n')}`
      : '\n\n✅ Nenhuma variação em nível crítico.') +
    (movements.length
      ? `\n\n🧾 <b>Últimos movimentos</b>\n${movements
          .map(
            (movement) =>
              `${movement.type === 'entrada' ? '📦 +' : '📤 -'}${movement.quantity} ${escapeHtml(movement.productName)} (${escapeHtml(movement.variantKey)})`
          )
          .join('\n')}`
      : '');

  const rows = overview.products
    .filter((product) => product.total > 0)
    .slice(0, 8)
    .map((product) => [{ text: `${product.name} (${product.total})`, callback_data: `st:p:${product.id}` }]);
  rows.push([{ text: '🏠 Painel', callback_data: 'menu:root' }]);

  return { text, keyboard: { inline_keyboard: rows } };
}

function stockProductView(productId) {
  const product = db().products.find((entry) => entry.id === productId);
  if (!product) return { text: 'Produto não encontrado.', keyboard: { inline_keyboard: [[{ text: '« Estoque', callback_data: 'menu:stock' }]] } };

  const variants = Object.entries(product.inventory || {});
  const lines = variants.map(([key, value]) => `• ${escapeHtml(key)}: <b>${value}</b>`).join('\n');

  const rows = variants.slice(0, 8).map(([key], index) => {
    const label = key.length > 22 ? `${key.slice(0, 21)}…` : key;
    return [
      { text: `${label} −1`, callback_data: `st:m:${productId}:${index}:-1` },
      { text: `${label} +1`, callback_data: `st:m:${productId}:${index}:1` }
    ];
  });
  rows.push([
    { text: '➕ +5 no 1º', callback_data: `st:m:${productId}:0:5` },
    { text: '📤 −5 no 1º', callback_data: `st:m:${productId}:0:-5` }
  ]);
  rows.push([{ text: '« Estoque', callback_data: 'menu:stock' }]);

  return {
    text: [
      `<b>🧵 ${escapeHtml(product.name)}</b>`,
      `<i>${escapeHtml(product.sku)} • ${escapeHtml(product.category)}</i>`,
      '',
      `Preço ${brl(product.price)} • custo ${brl(product.costPrice)}`,
      `Estoque total: <b>${variants.reduce((sum, [, value]) => sum + Number(value || 0), 0)}</b>`,
      '',
      lines
    ].join('\n'),
    keyboard: { inline_keyboard: rows }
  };
}

function cartsView() {
  const carts = listCarts({ status: 'abandoned', limit: 6 });
  const active = listCarts({ status: 'active', limit: 50 });

  const text =
    header('🧺 Carrinhos', `${active.length} ativo(s) • ${carts.length} abandonado(s)`) +
    '\n' +
    (carts
      .map(
        (cart) =>
          `<b>${brl(cart.subtotal)}</b> • ${cart.itemsCount} item(ns) • parado há ${cart.minutesIdle} min\n${escapeHtml(cart.email || 'sem e-mail')}${cart.contactedAt ? '\n📨 já contatado' : ''}`
      )
      .join('\n\n') || '<i>Nenhum carrinho abandonado no momento.</i>');

  const rows = carts.slice(0, 5).map((cart) => [
    { text: `📨 Contatado — ${brl(cart.subtotal)}`, callback_data: `ct:c:${cart.id}` }
  ]);
  rows.push([{ text: '🏠 Painel', callback_data: 'menu:root' }]);

  return { text, keyboard: { inline_keyboard: rows } };
}

function clientsView() {
  const customers = listCustomers({ limit: 6 });
  const metrics = dashboardMetrics();

  const text =
    header('👤 Clientes', `${metrics.customersCount} conta(s) • ${metrics.newCustomers30d} nova(s) em 30 dias`) +
    '\n' +
    (customers
      .map(
        (customer) =>
          `<b>${escapeHtml(customer.fullName)}</b>\n${escapeHtml(customer.email)}\n${customer.ordersCount} pedido(s) • ${brl(customer.totalSpent)}`
      )
      .join('\n\n') || '<i>Nenhuma conta criada ainda.</i>');

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 Atualizar', callback_data: 'menu:clients' }],
        [{ text: '🏠 Painel', callback_data: 'menu:root' }]
      ]
    }
  };
}

function alertsView() {
  const notifications = recentNotifications(10);
  const text =
    header('🔔 Últimos eventos', 'registro real do sistema') +
    '\n' +
    (notifications
      .map(
        (notification) =>
          `${escapeHtml(formatNotification(notification).split('\n')[0].replace(/<[^>]+>/g, ''))}\n<i>${dateTimeBR(notification.at)}</i>`
      )
      .join('\n\n') || '<i>Nenhum evento registrado.</i>');

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 Atualizar', callback_data: 'menu:alerts' }],
        [{ text: '🏠 Painel', callback_data: 'menu:root' }]
      ]
    }
  };
}

export function createEntryLink({ minutes = 10 } = {}) {
  const token = crypto.randomBytes(24).toString('base64url');
  const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();
  commit((data) => {
    data.adminEntryTokens.unshift({
      id: nextId('ent'),
      tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
      createdAt: nowIso(),
      expiresAt,
      usedAt: null
    });
    data.adminEntryTokens = data.adminEntryTokens.slice(0, 20);
  });
  const base = config.adminPublicUrl;
  return { url: `${base}${adminPathPrefix()}/?k=${token}`, expiresAt, minutes };
}

function linkView() {
  const link = createEntryLink({ minutes: 10 });
  return {
    text: [
      '<b>🔐 Link seguro do painel</b>',
      '',
      'Link de uso único, válido por 10 minutos.',
      `Caminho criptografado: <code>${escapeHtml(adminPathPrefix())}</code>`,
      `Expira em: ${dateTimeBR(link.expiresAt)}`,
      '',
      '<i>Qualquer acesso por este link fica registrado na trilha de auditoria.</i>'
    ].join('\n'),
    keyboard: {
      inline_keyboard: [
        [{ text: '🚀 Abrir painel', url: link.url }],
        [{ text: '🔄 Gerar novo', callback_data: 'menu:link' }],
        [{ text: '🏠 Painel', callback_data: 'menu:root' }]
      ]
    }
  };
}

function statusView() {
  const metrics = dashboardMetrics();
  const data = db();
  const lastLogin = data.adminUsers.map((admin) => admin.lastLoginAt).filter(Boolean).sort().reverse()[0];

  const text = [
    '<b>🩺 Status do sistema</b>',
    '',
    `Bot: ${isConfigured() ? '🟢 conectado' : '🟡 sem chat configurado'}`,
    `Bot: @${escapeHtml(data.telegram.botUsername || 'não identificado')}`,
    `Chat: ${escapeHtml(data.telegram.chatId || config.telegram.chatId || '—')}`,
    `Última atividade: ${dateTimeBR(data.telegram.lastActivityAt)}`,
    data.telegram.lastError ? `⚠️ Erro: ${escapeHtml(data.telegram.lastError)}` : '✅ Sem erros',
    '',
    `Banco: ${data.orders.length} pedidos • ${data.carts.length} carrinhos • ${data.customers.length} clientes`,
    `Produtos: ${data.products.length} • ${metrics.stockUnits} un. em estoque`,
    `Sessões admin ativas: ${data.adminSessions.filter((session) => new Date(session.expiresAt).getTime() > Date.now()).length}`,
    `Último login admin: ${dateTimeBR(lastLogin)}`,
    '',
    `Portas: loja ${config.storePort} • admin ${config.adminPort || 'mesma porta'}`,
    `Caminho do painel: <code>${escapeHtml(adminPathPrefix())}</code>`
  ].join('\n');

  return {
    text,
    keyboard: {
      inline_keyboard: [
        [{ text: '🔄 Atualizar', callback_data: 'menu:status' }],
        [{ text: '🏠 Painel', callback_data: 'menu:root' }]
      ]
    }
  };
}

function helpView() {
  return {
    text: [
      '<b>🌸 Comandos do bot</b>',
      '',
      '/painel — painel de botões',
      '/resumo — métricas financeiras',
      '/pedidos — lista de pedidos',
      '/pedidos AUR-1001 — abre um pedido',
      '/estoque — estoque e alertas',
      '/carrinhos — carrinhos abandonados',
      '/clientes — contas criadas',
      '/link — link seguro do painel web',
      '/status — saúde do sistema',
      '',
      '<i>Todas as ações executadas por aqui alteram o sistema real e ficam auditadas.</i>'
    ].join('\n'),
    keyboard: { inline_keyboard: [[{ text: '🏠 Painel', callback_data: 'menu:root' }]] }
  };
}

/* ------------------------------------------------------------------ *
 * Renderização
 * ------------------------------------------------------------------ */

async function render(chatId, view, { messageId = null, callbackId = null, toast = null } = {}) {
  const api = botClient();
  if (!api) return;

  if (callbackId) {
    try {
      await api.answerCallbackQuery(callbackId, toast ? { text: toast, show_alert: false } : {});
    } catch {
      /* ignore */
    }
  }

  try {
    if (messageId) {
      await api.editMessageText(chatId, messageId, view.text, { reply_markup: view.keyboard });
    } else {
      await api.sendMessage(chatId, view.text, { reply_markup: view.keyboard });
    }
  } catch (error) {
    // "message is not modified" é inofensivo
    if (!/not modified/i.test(error.message)) throw error;
  }
}

/* ------------------------------------------------------------------ *
 * Entrada
 * ------------------------------------------------------------------ */

export async function handleUpdate(update) {
  const message = update.message;
  const callback = update.callback_query;

  if (message) {
    const chatId = String(message.chat.id);
    if (!authorized(chatId)) {
      await sendTelegramMessage(chatId, '🔒 Este bot é privado. Peça acesso ao administrador da loja.');
      return;
    }
    await handleMessage(chatId, message);
    return;
  }

  if (callback) {
    const chatId = String(callback.message?.chat?.id || callback.from?.id);
    if (!authorized(chatId)) {
      await botClient().answerCallbackQuery(callback.id, { text: 'Acesso não autorizado.', show_alert: true });
      return;
    }
    await handleCallback(chatId, callback);
  }
}

async function handleMessage(chatId, message) {
  const raw = String(message.text || '').trim();
  const pending = awaiting.get(chatId);
  if (pending && pending.expiresAt > Date.now() && !raw.startsWith('/')) {
    awaiting.delete(chatId);
    return handleAwaitingText(chatId, pending, raw);
  }

  if (!raw.startsWith('/')) {
    await render(chatId, rootView());
    return;
  }

  const [commandRaw, ...args] = raw.split(/\s+/);
  const command = commandRaw.replace(/^\//, '').split('@')[0].toLowerCase();

  switch (command) {
    case 'start':
    case 'painel':
      await render(chatId, rootView());
      return;
    case 'ajuda':
    case 'help':
      await render(chatId, helpView());
      return;
    case 'resumo':
      await render(chatId, overviewView());
      return;
    case 'pedidos': {
      if (args[0]) {
        await render(chatId, orderView(args[0].toUpperCase()));
        return;
      }
      await render(chatId, ordersView());
      return;
    }
    case 'estoque':
      await render(chatId, stockView());
      return;
    case 'carrinhos':
      await render(chatId, cartsView());
      return;
    case 'clientes':
      await render(chatId, clientsView());
      return;
    case 'link':
      await render(chatId, linkView());
      return;
    case 'status':
      await render(chatId, statusView());
      return;
    case 'alertas':
      await render(chatId, alertsView());
      return;
    default:
      await render(chatId, rootView());
  }
}

async function handleAwaitingText(chatId, pending, text) {
  try {
    if (pending.action === 'tracking') {
      const order = setTrackingCode(pending.payload.orderId, text, { actor: `bot:${chatId}` });
      await botClient().sendMessage(chatId, `✅ Rastreio registrado no pedido <b>${order.id}</b>:\n<code>${escapeHtml(text)}</code>`);
      await render(chatId, orderView(order.id));
      return;
    }
    if (pending.action === 'stock_quantity') {
      const quantity = Math.trunc(Number(text.replace(/[^\d-]/g, '')));
      if (!Number.isFinite(quantity) || quantity === 0) {
        await botClient().sendMessage(chatId, '⚠️ Envie um número inteiro (ex.: 12 para entrada, -3 para saída).');
        awaiting.set(chatId, pending);
        return;
      }
      const movement = moveStock({
        productId: pending.payload.productId,
        variantKey: pending.payload.variantKey,
        type: quantity > 0 ? 'entrada' : 'saida',
        quantity: Math.abs(quantity),
        reason: 'ajuste_inventario',
        note: 'Ajuste via bot Telegram',
        actor: `bot:${chatId}`
      });
      await botClient().sendMessage(
        chatId,
        `✅ ${quantity > 0 ? 'Entrada' : 'Saída'} de <b>${Math.abs(quantity)}</b> un. em ${escapeHtml(movement.productName)} (${escapeHtml(
          movement.variantKey
        )}).\nSaldo agora: <b>${movement.balanceAfter}</b>.`
      );
      await render(chatId, stockProductView(movement.productId));
      return;
    }
  } catch (error) {
    await botClient().sendMessage(chatId, `⚠️ Não foi possível concluir: ${escapeHtml(error.message)}`);
  }
}

async function handleCallback(chatId, callback) {
  const data = String(callback.data || '');
  const messageId = callback.message?.message_id;
  const [namespace, action, ...rest] = data.split(':');

  try {
    if (namespace === 'menu') {
      const viewName = action;
      const variant = rest[0];
      let view;
      switch (viewName) {
        case 'overview':
          view = overviewView();
          break;
        case 'orders':
          view = ordersView(variant === 'pending' ? 'pending' : 'recent');
          break;
        case 'stock':
          view = stockView();
          break;
        case 'carts':
          view = cartsView();
          break;
        case 'clients':
          view = clientsView();
          break;
        case 'alerts':
          view = alertsView();
          break;
        case 'link':
          view = linkView();
          break;
        case 'status':
          view = statusView();
          break;
        case 'root':
        default:
          view = rootView();
      }
      await render(chatId, view, { messageId, callbackId: callback.id });
      return;
    }

    if (namespace === 'o') {
      const orderId = rest[0] || '';
      switch (action) {
        case 'v': {
          await render(chatId, orderView(orderId), { messageId, callbackId: callback.id });
          return;
        }
        case 'p': {
          const order = markPaid(orderId, { actor: `bot:${chatId}`, note: 'Confirmado pelo bot do Telegram' });
          await render(chatId, orderView(order.id), { messageId, callbackId: callback.id, toast: `Pagamento confirmado — ${brl(order.total)}` });
          return;
        }
        case 's': {
          const order = changeStatus(orderId, 'em_separacao', { actor: `bot:${chatId}`, note: 'Separação iniciada pelo bot' });
          await render(chatId, orderView(order.id), { messageId, callbackId: callback.id, toast: 'Separação iniciada' });
          return;
        }
        case 'h': {
          const order = changeStatus(orderId, 'enviado', { actor: `bot:${chatId}`, note: 'Enviado (sem rastreio registrado)' });
          await render(chatId, orderView(order.id), { messageId, callbackId: callback.id, toast: 'Pedido marcado como enviado' });
          return;
        }
        case 'd': {
          const order = changeStatus(orderId, 'entregue', { actor: `bot:${chatId}`, note: 'Entrega confirmada pelo bot' });
          await render(chatId, orderView(order.id), { messageId, callbackId: callback.id, toast: 'Pedido entregue' });
          return;
        }
        case 'c!': {
          const id = rest[0];
          await render(
            chatId,
            {
              text: `<b>❌ Cancelar pedido ${escapeHtml(id)}?</b>\n\nO estoque volta ao inventário e, se já estava pago, um estorno é lançado no financeiro.`,
              keyboard: {
                inline_keyboard: [
                  [{ text: 'Sim, cancelar', callback_data: `o:c:${id}` }],
                  [{ text: 'Não, voltar', callback_data: `o:v:${id}` }]
                ]
              }
            },
            { messageId, callbackId: callback.id }
          );
          return;
        }
        case 'c': {
          const order = changeStatus(orderId, 'cancelado', { actor: `bot:${chatId}`, note: 'Cancelado pelo bot' });
          await render(chatId, orderView(order.id), { messageId, callbackId: callback.id, toast: 'Pedido cancelado e estoque devolvido' });
          return;
        }
        case 't': {
          awaiting.set(chatId, { action: 'tracking', payload: { orderId }, expiresAt: Date.now() + AWAIT_TTL });
          await render(
            chatId,
            {
              text: `<b>🔗 Rastreio do pedido ${escapeHtml(orderId)}</b>\n\nEnvie o código de rastreio (ex.: BR123456789SP) na próxima mensagem.`,
              keyboard: { inline_keyboard: [[{ text: '« Cancelar', callback_data: `o:v:${orderId}` }]] }
            },
            { messageId, callbackId: callback.id }
          );
          return;
        }
        default:
          await render(chatId, rootView(), { messageId, callbackId: callback.id });
      }
      return;
    }

    if (namespace === 'st') {
      if (action === 'p') {
        await render(chatId, stockProductView(rest[0]), { messageId, callbackId: callback.id });
        return;
      }
      if (action === 'm') {
        const productId = rest[0];
        const index = Number(rest[1]);
        const delta = Number(rest[2]);
        const product = db().products.find((entry) => entry.id === productId);
        const variantKey = Object.keys(product?.inventory || {})[index];
        if (!variantKey) throw new Error('Variação não encontrada.');

        const movement = moveStock({
          productId,
          variantKey,
          type: delta > 0 ? 'entrada' : 'saida',
          quantity: Math.abs(delta),
          reason: 'ajuste_inventario',
          note: 'Ajuste rápido pelo bot',
          actor: `bot:${chatId}`
        });
        await render(chatId, stockProductView(productId), {
          messageId,
          callbackId: callback.id,
          toast: `${delta > 0 ? '+' : ''}${delta} • saldo ${movement.balanceAfter}`
        });
        return;
      }
      if (action === 'q') {
        awaiting.set(chatId, {
          action: 'stock_quantity',
          payload: { productId: rest[0], variantKey: decodeURIComponent(rest[1] || '') },
          expiresAt: Date.now() + AWAIT_TTL
        });
        await render(
          chatId,
          {
            text: '<b>✏️ Ajuste manual</b>\n\nEnvie a quantidade: número positivo para entrada, negativo para saída (ex.: <code>12</code> ou <code>-3</code>).',
            keyboard: { inline_keyboard: [[{ text: '« Cancelar', callback_data: `st:p:${rest[0]}` }]] }
          },
          { messageId, callbackId: callback.id }
        );
        return;
      }
      await render(chatId, stockView(), { messageId, callbackId: callback.id });
      return;
    }

    if (namespace === 'ct') {
      if (action === 'c') {
        const cart = markCartContacted(rest[0], { actor: `bot:${chatId}` });
        await render(chatId, cartsView(), {
          messageId,
          callbackId: callback.id,
          toast: cart ? 'Carrinho marcado como contatado' : 'Carrinho não encontrado'
        });
        return;
      }
      await render(chatId, cartsView(), { messageId, callbackId: callback.id });
      return;
    }

    await render(chatId, rootView(), { messageId, callbackId: callback.id });
  } catch (error) {
    addAudit({
      actor: 'bot:telegram',
      action: 'bot.action.error',
      detail: `Ação "${data}" falhou: ${error.message}`,
      ip: ''
    });
    try {
      await botClient().answerCallbackQuery(callback.id, { text: `⚠️ ${error.message}`, show_alert: true });
    } catch {
      /* ignore */
    }
  }
}
