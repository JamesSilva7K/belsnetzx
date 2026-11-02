/**
 * Pedidos — criação e ciclo de vida com regras reais.
 * O servidor recalcula preços, frete e desconto: o cliente nunca define o total.
 */
import { config } from '../config.js';
import { commit, db, nextId } from '../lib/db.js';
import { HttpError, assert } from '../lib/errors.js';
import { brl, isValidCPF, isValidEmail, maskCpf, normalizeEmail, nowIso, onlyDigits } from '../lib/format.js';
import { buildPixPayload } from '../lib/pix.js';
import { notify } from './notify.js';
import { evaluateCoupon } from './coupons.js';
import { createPixCashIn, getSyncPayConfig } from './syncpay.js';
import { signSaleOrder, verifySaleOrder } from './security.js';

const SHIPPING_LABELS = { PAC: 'PAC (4 a 8 dias úteis)', SEDEX: 'SEDEX (1 a 3 dias úteis)', Atelier: 'Retirada no atelier' };
const PAYMENT_LABELS = { pix: 'Pix', credit_card: 'Cartão de crédito', boleto: 'Boleto bancário' };

export const ORDER_FLOW = {
 aguardando_pagamento: ['pago', 'em_separacao', 'cancelado'],
 pago: ['em_separacao', 'enviado', 'entregue', 'cancelado'],
 em_separacao: ['enviado', 'entregue', 'cancelado'],
 enviado: ['entregue', 'cancelado'],
 entregue: [],
 cancelado: []
};

export const STATUS_LABELS = {
 aguardando_pagamento: 'Aguardando pagamento',
 pago: 'Pago',
 em_separacao: 'Em separação',
 enviado: 'Enviado',
 entregue: 'Entregue',
 cancelado: 'Cancelado'
};

function shippingOptions() {
 const settings = db().settings.shipping || {};
 return {
 PAC: Number(settings.pac ?? config.shippingTable.PAC),
 SEDEX: Number(settings.sedex ?? config.shippingTable.SEDEX),
 Atelier: 0
 };
}

export function quoteShipping(subtotal) {
 const table = shippingOptions();
 const freeThreshold = Number(db().settings.shipping?.freeThreshold ?? config.freeShippingThreshold);
 const free = subtotal >= freeThreshold;
 return {
 freeThreshold,
 options: Object.entries(table).map(([method, price]) => ({
 method,
 label: SHIPPING_LABELS[method] || method,
 price: free && method !== 'Atelier' ? 0 : price
 }))
 };
}

function resolveItems(rawItems) {
 const data = db();
 assert(Array.isArray(rawItems) && rawItems.length > 0, 400, 'O carrinho está vazio.', 'empty_cart');

 const resolved = [];
 for (const raw of rawItems) {
 const product = data.products.find((item) => item.id === raw.productId);
 if (!product) throw new HttpError(400, `Produto indisponível: ${raw.productId}`, 'product_not_found');

 let size = String(raw.selectedSize || raw.size || '').trim();
 let colorName = String(raw.selectedColor?.name || raw.colorName || '').trim();
 let variantKey = `${size}-${colorName}`;
 if ((!size || !colorName) && raw.variantKey && String(raw.variantKey).includes('-')) {
 const parts = String(raw.variantKey).split('-');
 size = size || parts[0];
 colorName = colorName || parts.slice(1).join('-');
 variantKey = raw.variantKey;
 }
 const quantity = Math.trunc(Number(raw.quantity));

 assert(quantity > 0, 400, `Quantidade inválida para ${product.name}.`, 'invalid_quantity');
 assert(variantKey in (product.inventory || {}), 400, `Variação inexistente: ${product.name} (${variantKey}).`, 'variant_not_found');

 const available = Number(product.inventory[variantKey] || 0);
 assert(available >= quantity, 409, `${product.name} (${variantKey}) tem apenas ${available} unidade(s) em estoque.`, 'insufficient_stock');

 const color = product.colors.find((entry) => entry.name === colorName) || { name: colorName, hex: '#DC7898' };

 resolved.push({
 product,
 variantKey,
 size,
 color,
 quantity,
 unitPrice: Number(product.price || 0)
 });
 }
 return resolved;
}

function validateLead(lead) {
 const required = ['fullName', 'cpf', 'email', 'phone', 'cep', 'street', 'number', 'neighborhood', 'city', 'state'];
 for (const field of required) {
 assert(String(lead?.[field] || '').trim().length > 0, 400, `Campo obrigatório: ${field}`, 'invalid_lead');
 }
 assert(String(lead.fullName).trim().split(/\s+/).length >= 2, 400, 'Informe o nome completo.', 'invalid_name');
 assert(isValidEmail(lead.email), 400, 'E-mail inválido.', 'invalid_email');
 assert(isValidCPF(lead.cpf), 400, 'CPF inválido.', 'invalid_cpf');
 assert(onlyDigits(lead.phone).length >= 10, 400, 'WhatsApp inválido (informe DDD + número).', 'invalid_phone');
 assert(onlyDigits(lead.cep).length === 8, 400, 'CEP inválido.', 'invalid_cep');
 assert(String(lead.state).trim().length === 2, 400, 'UF inválida.', 'invalid_state');

 return {
 fullName: String(lead.fullName).trim(),
 cpf: String(lead.cpf).trim(),
 email: normalizeEmail(lead.email),
 phone: String(lead.phone).trim(),
 cep: String(lead.cep).trim(),
 street: String(lead.street).trim(),
 number: String(lead.number).trim(),
 complement: String(lead.complement || '').trim(),
 neighborhood: String(lead.neighborhood).trim(),
 city: String(lead.city).trim(),
 state: String(lead.state).trim().toUpperCase(),
 notes: String(lead.notes || '').trim()
 };
}


export function syncCustomerWithOrder(data, order) {
  if (!order || !order.lead || !order.lead.email) return;
  const email = normalizeEmail(order.lead.email);
  const cpfDigits = onlyDigits(order.lead.cpf || '');

  let customer = data.customers.find(
    (c) => normalizeEmail(c.email) === email || (cpfDigits && c.cpf && onlyDigits(c.cpf) === cpfDigits)
  );

  const leadAddress = {
    street: order.lead.street || '',
    number: order.lead.number || '',
    complement: order.lead.complement || '',
    neighborhood: order.lead.neighborhood || '',
    city: order.lead.city || '',
    state: order.lead.state || '',
    cep: order.lead.cep || ''
  };

  if (!customer) {
    customer = {
      id: nextId('cli'),
      fullName: order.lead.fullName,
      email: email,
      cpf: order.lead.cpf,
      phone: order.lead.phone,
      createdAt: order.createdAt || nowIso(),
      lastLoginAt: null,
      addresses: leadAddress.street ? [leadAddress] : [],
      ordersCount: 0,
      totalSpent: 0,
      marketingOptIn: false
    };
    data.customers.unshift(customer);
    data.counters.accountsCreated = (data.counters.accountsCreated || 0) + 1;
  } else {
    if (!customer.addresses) customer.addresses = [];
    const hasAddr = customer.addresses.some(
      (a) => a.cep === leadAddress.cep && a.number === leadAddress.number
    );
    if (!hasAddr && leadAddress.street) {
      customer.addresses.unshift(leadAddress);
    }
    if (!customer.phone && order.lead.phone) customer.phone = order.lead.phone;
    if (!customer.cpf && order.lead.cpf) customer.cpf = order.lead.cpf;
  }

  // Vincular ID do cliente no pedido
  order.customerId = customer.id;

  // Recalcular métricas validadas e 100% reais de todos os pedidos deste cliente
  const clientOrders = data.orders.filter(
    (o) => normalizeEmail(o.lead?.email || '') === email || 
           (cpfDigits && o.lead?.cpf && onlyDigits(o.lead.cpf) === cpfDigits) || 
           o.customerId === customer.id
  );

  customer.ordersCount = clientOrders.length;
  customer.totalSpent = clientOrders
    .filter((o) => ['confirmado', 'pago'].includes(o.paymentStatus) || ['pago', 'em_separacao', 'enviado', 'entregue'].includes(o.orderStatus))
    .reduce((sum, o) => sum + Number(o.total || 0), 0);
  customer.lastOrderAt = order.createdAt || nowIso();
}

export function ensureCustomersSynced() {
  const data = db();
  if (!Array.isArray(data.orders) || data.orders.length === 0) return;
  commit((store) => {
    for (const ord of store.orders) {
      syncCustomerWithOrder(store, ord);
    }
  });
}

export async function createOrder(input, context = {}) {
 const lead = validateLead(input.lead);
 const items = resolveItems(input.items);

 const settings = db().settings;
 const subtotal = Number(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2));

 let discount = 0;
 let couponApplied = null;
 if (input.couponCode) {
 const evaluated = evaluateCoupon(
 input.couponCode,
 subtotal,
 items.map((item) => ({ productId: item.product.id, price: item.unitPrice, quantity: item.quantity }))
 );
 if (evaluated.ok) {
 discount = evaluated.discount;
 couponApplied = evaluated.coupon;
 }
 }

 const shippingMethod = ['PAC', 'SEDEX', 'Atelier'].includes(input.shippingMethod) ? input.shippingMethod : 'PAC';
 const shippingQuote = quoteShipping(subtotal).options.find((option) => option.method === shippingMethod);
 const shippingCost = Number(shippingQuote?.price ?? 0);

 const paymentMethod = ['pix', 'credit_card', 'boleto'].includes(input.paymentMethod) ? input.paymentMethod : 'pix';

 const gateway = settings.gateway || {};
 const pixDiscountPercent = paymentMethod === 'pix' ? Number(gateway.discountForPixPercent || 0) : 0;
 const baseTotal = Math.max(0, subtotal - discount + shippingCost);
 const pixDiscount = Number(((baseTotal * pixDiscountPercent) / 100).toFixed(2));
 const total = Number(Math.max(0, baseTotal - pixDiscount).toFixed(2));

 let syncPayResult = null;
 if (paymentMethod === 'pix' && getSyncPayConfig().enabled) {
 try {
 const anticipatedSeq = Number(db().orderSeq || 1000) + 1;
 syncPayResult = await createPixCashIn({
 orderId: `AUR-${anticipatedSeq}`,
 amount: total,
 description: `Pedido AUR-${anticipatedSeq} - Aura Rosa`,
 client: {
 name: lead.fullName,
 cpf: lead.cpf,
 email: lead.email,
 phone: lead.phone
 }
 });
 } catch (err) {
 console.error('[syncpay] Falha ao criar Pix dinâmico via API SyncPay:', err.message);
 }
 }

 const order = commit((data) => {
 const seq = Number(data.orderSeq || 1000) + 1;
 data.orderSeq = seq;
 const id = `AUR-${seq}`;
 const createdAt = nowIso();

 const orderItems = items.map((item) => ({
 cartItemId: `${item.product.id}-${item.variantKey}`,
 productId: item.product.id,
 name: item.product.name,
 price: item.unitPrice,
 originalPrice: item.product.compareAtPrice,
 image: item.product.images?.[0] || '',
 selectedSize: item.size,
 selectedColor: item.color,
 quantity: item.quantity,
 maxStock: Number(item.product.inventory[item.variantKey] || 0)
 }));

 // Reserva de estoque com movimento auditável
 for (const item of items) {
 const product = data.products.find((entry) => entry.id === item.product.id);
 const before = Number(product.inventory[item.variantKey] || 0);
 const after = before - item.quantity;
 product.inventory = { ...product.inventory, [item.variantKey]: after };
 product.inStock = Object.values(product.inventory).reduce((sum, value) => sum + Number(value || 0), 0) > 0;

 data.stockMovements.unshift({
 id: nextId('mov'),
 at: createdAt,
 productId: product.id,
 productName: product.name,
 sku: product.sku,
 variantKey: item.variantKey,
 type: 'saida',
 quantity: item.quantity,
 reason: 'venda',
 note: `Pedido ${id}`,
 actor: `pedido:${id}`,
 balanceAfter: after,
 unitCost: Number(product.costPrice || 0)
 });
 data.counters.stockOut += item.quantity;
 }

 let paymentDetails = {};
 if (paymentMethod === 'pix') {
 if (syncPayResult && syncPayResult.pixCopyPaste) {
 paymentDetails.pixCopyPaste = syncPayResult.pixCopyPaste;
 paymentDetails.identifier = syncPayResult.identifier;
 } else if (gateway.pixKey) {
 try {
 paymentDetails.pixCopyPaste = buildPixPayload({
 key: gateway.pixKey,
 merchantName: gateway.pixMerchantName,
 merchantCity: gateway.pixMerchantCity,
 amount: total,
 txid: `AUR${seq}`
 });
 } catch {
 paymentDetails.pixCopyPaste = '';
 }
 } else {
 paymentDetails.pixCopyPaste = '';
 }
 }
 if (paymentMethod === 'credit_card') {
 const digits = onlyDigits(input.cardNumber || '');
 if (digits.length >= 13) {
 paymentDetails.cardLast4 = digits.slice(-4);
 paymentDetails.cardBrand = detectCardBrand(digits);
 paymentDetails.installments = Math.max(1, Math.min(Number(input.installments || 1), Number(gateway.maxInstallmentsWithoutInterest || 1)));
 }
 }

 const record = {
 id,
 createdAt,
 updatedAt: createdAt,
 lead,
 customerId: input.customerId || null,
 items: orderItems,
 subtotal,
 discount,
 couponCodeApplied: couponApplied ? couponApplied.code : undefined,
 shippingMethod,
 shippingCost,
 pixDiscount,
 total,
 paymentMethod,
 paymentStatus: 'pendente',
 orderStatus: 'aguardando_pagamento',
 trackingCode: undefined,
 paymentDetails,
 gatewayTransactionId: syncPayResult?.identifier || null,
 history: [
 {
 status: 'aguardando_pagamento',
 timestamp: createdAt,
 note: `Pedido registrado no checkout (${PAYMENT_LABELS[paymentMethod]}). Aguardando confirmação de pagamento.`
 }
 ]
 };

 // Assina criptograficamente a venda (HMAC-SHA256) garantindo integridade inviolável
 record.securitySeal = signSaleOrder(record);

 data.orders.unshift(record);
 data.counters.ordersCreated += 1;

 if (couponApplied) {
 const coupon = data.coupons.find((entry) => entry.id === couponApplied.id);
 if (coupon) coupon.usedCount += 1;
 }

 // converte o carrinho rastreado, quando informado
 if (input.cartSessionId) {
 const cart = data.carts.find((entry) => entry.sessionId === input.cartSessionId && entry.status === 'active');
 if (cart) {
 cart.status = 'converted';
 cart.convertedOrderId = id;
 cart.updatedAt = createdAt;
 }
 }

 return record;
 }, { event: 'order.created', payload: { id: `AUR-${Number(db().orderSeq)}` } });

 notify({
 type: 'order_created',
 title: ` Novo pedido ${order.id}`,
 detail: `${order.lead.fullName} • ${order.items.length} item(ns) • ${brl(order.total)} • ${PAYMENT_LABELS[paymentMethod]} (aguardando pagamento)`,
 severity: 'success',
 meta: {
 orderId: order.id,
 customer: order.lead.fullName,
 email: order.lead.email,
 phone: order.lead.phone,
 cpf: maskCpf(order.lead.cpf),
 city: `${order.lead.city}/${order.lead.state}`,
 total: order.total,
 subtotal: order.subtotal,
 discount: order.discount,
 shipping: order.shippingCost,
 shippingLabel: SHIPPING_LABELS[shippingMethod],
 paymentMethod,
 paymentLabel: PAYMENT_LABELS[paymentMethod],
 items: order.items.map((item) => `${item.quantity}x ${item.name} (${item.selectedSize}/${item.selectedColor?.name})`),
 ip: context.ip || ''
 }
 });

 return order;
}

function detectCardBrand(digits) {
 if (/^4/.test(digits)) return 'Visa';
 if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
 if (/^3[47]/.test(digits)) return 'American Express';
 if (/^(606282|3841)/.test(digits)) return 'Hipercard';
 if (/^(4011|4312|4389|5041|5067|509|650|651|655)/.test(digits)) return 'Elo';
 return 'Cartão';
}

export function listOrders({ status = null, search = '', limit = 200 } = {}) {
 const term = String(search || '').trim().toLowerCase();
 return db()
 .orders.filter((order) => {
 if (status && status !== 'todos' && order.orderStatus !== status) return false;
 if (!term) return true;
 return (
 order.id.toLowerCase().includes(term) ||
 order.lead.fullName.toLowerCase().includes(term) ||
 order.lead.email.includes(term) ||
 onlyDigits(order.lead.cpf).includes(onlyDigits(term))
 );
 })
 .slice(0, limit);
}

export function getOrder(id) {
 return db().orders.find((order) => order.id === id) || null;
}

export function getPublicOrder(id, email) {
 const order = getOrder(id);
 if (!order) return null;
 if (email && normalizeEmail(order.lead.email) !== normalizeEmail(email)) return null;
 return order;
}

function findOrderIndex(data, id) {
 const index = data.orders.findIndex((order) => order.id === id);
 if (index < 0) throw new HttpError(404, 'Pedido não encontrado.', 'order_not_found');
 return index;
}

function pushHistory(order, status, note) {
 order.history.push({ status, timestamp: nowIso(), note });
 order.updatedAt = nowIso();
}

export function markPaid(orderId, { actor = 'painel', note = '' } = {}) {
 const existing = getOrder(orderId);
 if (!existing) throw new HttpError(404, 'Pedido não encontrado.', 'order_not_found');
 if (existing.paymentStatus === 'confirmado') {
 throw new HttpError(409, 'Este pedido já está com pagamento confirmado.', 'already_paid');
 }

 const updated = commit((data) => {
 const order = data.orders[findOrderIndex(data, orderId)];
 order.paymentStatus = 'confirmado';
 order.orderStatus = 'pago';
 order.updatedAt = nowIso();
 pushHistory(order, 'pago', note || `Pagamento confirmado por ${actor}.`);

 const entry = {
 id: nextId('cf'),
 type: 'entrada',
 title: `Venda confirmada — Pedido ${order.id}`,
 category: 'venda',
 amount: Number(order.total || 0),
 date: nowIso(),
 orderId: order.id,
 notes: `${PAYMENT_LABELS[order.paymentMethod]} • ${order.lead.fullName} • confirmado por ${actor}`
 };
 data.cashflow.unshift(entry);
 data.counters.ordersPaid += 1;
 return order;
 }, { event: 'order.paid', payload: { id: orderId } });

 notify({
 type: 'order_paid',
 title: ` Pagamento confirmado — ${updated.id}`,
 detail: `${updated.lead.fullName} • ${brl(updated.total)} • ${PAYMENT_LABELS[updated.paymentMethod]}`,
 severity: 'success',
 meta: { orderId: updated.id, customer: updated.lead.fullName, total: updated.total, paymentLabel: PAYMENT_LABELS[updated.paymentMethod], actor }
 });

 return updated;
}

export function changeStatus(orderId, status, { actor = 'painel', note = '' } = {}) {
  const existing = getOrder(orderId);
  if (!existing) throw new HttpError(404, 'Pedido não encontrado.', 'order_not_found');
  if (existing.orderStatus === status) return existing;

  const validStatuses = ['aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado'];
  if (!validStatuses.includes(status)) {
    throw new HttpError(400, `Status inválido: ${status}.`, 'invalid_status');
  }

  const updated = commit((data) => {
    const order = data.orders[findOrderIndex(data, orderId)];
    const prevStatus = order.orderStatus;

    if (status === 'cancelado' && prevStatus !== 'cancelado') {
      // Devolve o estoque reservado
      for (const item of order.items) {
        const product = data.products.find((entry) => entry.id === item.productId);
        if (!product) continue;
        const key = `${item.selectedSize}-${item.selectedColor?.name}`;
        const before = Number(product.inventory[key] || 0);
        product.inventory = { ...product.inventory, [key]: before + item.quantity };
        product.inStock = true;
        data.stockMovements.unshift({
          id: nextId('mov'),
          at: nowIso(),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          variantKey: key,
          type: 'entrada',
          quantity: item.quantity,
          reason: 'estorno',
          note: `Cancelamento do pedido ${order.id}`,
          actor,
          balanceAfter: before + item.quantity,
          unitCost: Number(product.costPrice || 0)
        });
        data.counters.stockIn += item.quantity;
      }

      if (order.paymentStatus === 'confirmado') {
        order.paymentStatus = 'cancelado';
        data.cashflow.unshift({
          id: nextId('cf'),
          type: 'saida',
          title: `Estorno — Pedido ${order.id}`,
          category: 'outros',
          amount: Number(order.total || 0),
          date: nowIso(),
          orderId: order.id,
          notes: `Cancelamento após pagamento confirmado (${actor})`
        });
      }
    } else if (prevStatus === 'cancelado' && status !== 'cancelado') {
      // Reativação de pedido cancelado: re-deduz estoque
      for (const item of order.items) {
        const product = data.products.find((entry) => entry.id === item.productId);
        if (!product) continue;
        const key = `${item.selectedSize}-${item.selectedColor?.name}`;
        const before = Number(product.inventory[key] || 0);
        const after = Math.max(0, before - item.quantity);
        product.inventory = { ...product.inventory, [key]: after };
        data.stockMovements.unshift({
          id: nextId('mov'),
          at: nowIso(),
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          variantKey: key,
          type: 'saida',
          quantity: item.quantity,
          reason: 'pedido',
          note: `Reativação do pedido ${order.id}`,
          actor,
          balanceAfter: after,
          unitCost: Number(product.costPrice || 0)
        });
        data.counters.stockOut += item.quantity;
      }
    }

    if (['pago', 'em_separacao', 'enviado', 'entregue'].includes(status) && order.paymentStatus !== 'confirmado') {
      order.paymentStatus = 'confirmado';
      const hasIncome = data.cashflow.some((entry) => entry.orderId === order.id && entry.type === 'entrada');
      if (!hasIncome) {
        data.cashflow.unshift({
          id: nextId('cf'),
          type: 'entrada',
          title: `Venda confirmada — Pedido ${order.id}`,
          category: 'venda',
          amount: Number(order.total || 0),
          date: nowIso(),
          orderId: order.id,
          notes: `${PAYMENT_LABELS[order.paymentMethod] || 'Pagamento'} • ${order.lead.fullName} • por ${actor}`
        });
        data.counters.ordersPaid += 1;
      }
    }

    order.orderStatus = status;
    order.updatedAt = nowIso();
    pushHistory(order, status, note || `Status alterado para ${STATUS_LABELS[status] || status} por ${actor}.`);
    syncCustomerWithOrder(data, order);
    return order;
  }, { event: 'order.status', payload: { id: orderId, status } });

  notify({
    type: 'order_status',
    title: `Pedido ${updated.id} — ${STATUS_LABELS[status] || status}`,
    detail: `${updated.lead.fullName} • ${brl(updated.total)}${note ? ` • ${note}` : ''}`,
    severity: status === 'cancelado' ? 'warning' : 'info',
    meta: { orderId: updated.id, status, customer: updated.lead.fullName, total: updated.total, actor }
  });

  return updated;
}

export function validateAndFormatTrackingCode(rawCode) {
  const code = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '');
  if (!code || code.length < 6) {
    throw new HttpError(400, 'Código de rastreio inválido. Deve ter pelo menos 6 caracteres.', 'invalid_tracking');
  }

  // Padrão oficial Correios (SRO): 2 letras + 9 dígitos + 2 letras (ex: AA123456789BR)
  const isCorreios = /^[A-Z]{2}[0-9]{9}[A-Z]{2}$/.test(code);
  const isGeneric = /^[A-Z0-9\-_]{6,32}$/.test(code);

  if (!isCorreios && !isGeneric) {
    throw new HttpError(
      400,
      'Código de rastreio inválido. Utilize o formato oficial Correios (ex: AA123456789BR) ou identificador oficial da transportadora.',
      'invalid_tracking'
    );
  }

  return {
    code,
    carrier: isCorreios ? 'Correios' : 'Transportadora',
    url: isCorreios
      ? `https://rastreamento.correios.com.br/app/index.php?codigo=${code}`
      : `https://www.google.com/search?q=${code}+rastreamento`,
    isOfficialCorreios: isCorreios
  };
}

export function setTrackingCode(orderId, trackingCode, { actor = 'painel', note = '' } = {}) {
  const verified = validateAndFormatTrackingCode(trackingCode);
  const existing = getOrder(orderId);
  if (!existing) throw new HttpError(404, 'Pedido não encontrado.', 'order_not_found');

  const updated = commit((data) => {
    const order = data.orders[findOrderIndex(data, orderId)];
    order.trackingCode = verified.code;
    order.trackingCarrier = verified.carrier;
    order.trackingUrl = verified.url;
    order.trackingDispatchedAt = nowIso();

    // Atualiza status do pedido e de todos os produtos para enviado / a caminho
    order.orderStatus = 'enviado';
    order.updatedAt = nowIso();

    pushHistory(
      order,
      'enviado',
      note || `Rastreio oficial ${verified.code} (${verified.carrier}) anexado e liberado para o cliente por ${actor}.`
    );
    syncCustomerWithOrder(data, order);
    return order;
  }, { event: 'order.tracking', payload: { id: orderId, trackingCode: verified.code, trackingUrl: verified.url } });

  notify({
    type: 'order_status',
    title: `Pedido ${updated.id} enviado`,
    detail: `Rastreio ${verified.code} (${verified.carrier}) • ${updated.lead.fullName}`,
    meta: {
      orderId: updated.id,
      status: updated.orderStatus,
      trackingCode: verified.code,
      carrier: verified.carrier,
      trackingUrl: verified.url,
      customer: updated.lead.fullName,
      total: updated.total
    }
  });

  return updated;
}

export function customerOrders(email, customerId = null, cpf = null) {
  const target = normalizeEmail(email || '');
  const cpfDigits = cpf ? onlyDigits(cpf) : null;
  return db().orders.filter((order) => {
    if (customerId && order.customerId === customerId) return true;
    if (target && normalizeEmail(order.lead?.email || '') === target) return true;
    if (cpfDigits && order.lead?.cpf && onlyDigits(order.lead.cpf) === cpfDigits) return true;
    return false;
  });
}

export function deleteOrder(id, { actor = 'painel' } = {}) {
  const existing = db().orders.find((entry) => entry.id === id);
  if (!existing) throw new HttpError(404, 'Pedido não encontrado.', 'not_found');
  commit((data) => {
    data.orders = data.orders.filter((entry) => entry.id !== id);
    data.cashflow = data.cashflow.filter((entry) => entry.orderId !== id);
    data.auditLog.unshift({
      id: nextId('aud'),
      at: nowIso(),
      actor,
      action: 'orders.deleted',
      detail: `Pedido ${id} removido do sistema.`
    });
  });
  return { ok: true, message: `Pedido ${id} removido.` };
}

export { PAYMENT_LABELS, SHIPPING_LABELS };
