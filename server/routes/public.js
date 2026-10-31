/**  API pública — tudo o que a loja consome em tempo real. */
import express from 'express';
import { config } from '../config.js';
import { commit, db, bus } from '../lib/db.js';
import { asyncHandler, clientIp, rateLimit } from '../lib/http.js';
import { HttpError } from '../lib/errors.js';
import { normalizeEmail } from '../lib/format.js';
import { listProducts, getProduct, productCategories, listReviews, upsertReview } from '../services/catalog.js';
import { createOrder, getPublicOrder, quoteShipping, customerOrders, markPaid } from '../services/orders.js';
import { publicSettings, listBanners } from '../services/settings.js';
import { evaluateCoupon } from '../services/coupons.js';
import { syncCart } from '../services/carts.js';
import { registerCustomer, loginCustomer, resolveCustomerToken, logoutCustomer, customerProfile, updateCustomerProfile } from '../services/customers.js';
import { handleUpdate } from '../services/telegram-bot.js';
import { processSyncPayWebhook, checkSyncPayTransaction } from '../services/syncpay.js';

const router = express.Router();

function customerFromRequest(req) {
  const header = req.headers.authorization || '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  return { token, customer: resolveCustomerToken(token) };
}


/* --------------------------- Tempo real público (SSE) --------------------------- */
router.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);

  const forward = (event) => {
    if (!event) return;
    res.write(`event: change\ndata: ${JSON.stringify({ at: new Date().toISOString(), event: event.event })}\n\n`);
  };

  bus.on('change', forward);

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('change', forward);
  });
});

router.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'aura-rosa',
    version: db().meta.version,
    time: new Date().toISOString(),
    uptimeSeconds: Math.round(process.uptime())
  });
});

router.get('/store', (req, res) => {
  const data = db();
  res.json({
    ok: true,
    products: listProducts(),
    banners: listBanners({ onlyActive: true }),
    categories: productCategories(),
    settings: publicSettings(),
    features: {
      pixConfigured: Boolean(data.settings.gateway.pixKey),
      cardCheckout: false,
      telegramConfigured: Boolean(data.telegram.tokenEncrypted || config.telegram.token)
    },
    generatedAt: new Date().toISOString()
  });
});

router.get('/products', (req, res) => {
  res.json({ ok: true, products: listProducts(), categories: productCategories() });
});

router.get('/products/:id/reviews', (req, res) => {
  const product = getProduct(req.params.id);
  if (!product) throw new HttpError(404, 'Produto não encontrado.', 'not_found');
  res.json({ ok: true, reviews: listReviews(req.params.id), rating: product.rating, count: product.reviewsCount });
});

router.post(
  '/reviews',
  rateLimit({ windowMs: 60000, max: 8, key: 'review' }),
  asyncHandler((req, res) => {
    const { productId, rating, comment, fitFeedback, name, email } = req.body || {};
    const { customer } = customerFromRequest(req);
    const authorEmail = customer?.email || normalizeEmail(email || '');
    const verifiedBuyer = Boolean(
      db().orders.some(
        (order) => normalizeEmail(order.lead.email) === authorEmail && order.orderStatus === 'entregue'
      )
    );
    const review = upsertReview({
      productId,
      customerId: customer?.id || null,
      authorName: customer?.fullName || String(name || '').trim() || 'Cliente',
      rating,
      comment,
      fitFeedback
    });
    res.status(201).json({ ok: true, review: { ...review, verifiedBuyer } });
  })
);

router.get('/shipping/quote', (req, res) => {
  const subtotal = Number(req.query.subtotal || 0);
  res.json({ ok: true, ...quoteShipping(subtotal) });
});

router.post('/coupons/validate', (req, res) => {
  const { code, subtotal, items } = req.body || {};
  const result = evaluateCoupon(code, Number(subtotal || 0), items || []);
  if (!result.ok) return res.status(400).json({ ok: false, error: result.error });
  return res.json({
    ok: true,
    coupon: {
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      description: result.coupon.description
    },
    discount: result.discount
  });
});

router.post(
  '/cart/sync',
  rateLimit({ windowMs: 60000, max: 120, key: 'cart' }),
  asyncHandler((req, res) => {
    const { sessionId, items, email } = req.body || {};
    const { customer } = customerFromRequest(req);
    const result = syncCart({ sessionId, items: items || [], email: customer?.email || email || '' });
    res.json(result);
  })
);

router.post(
  '/checkout',
  rateLimit({ windowMs: 60000, max: 12, key: 'checkout' }),
  asyncHandler(async (req, res) => {
    const { customer } = customerFromRequest(req);
    const order = await createOrder(
      { ...req.body, customerId: customer?.id || null },
      { ip: clientIp(req) }
    );
    res.status(201).json({ ok: true, order });
  })
);

router.get('/orders/:id', asyncHandler(async (req, res) => {
  const order = getPublicOrder(req.params.id, req.query.email);
  if (!order) throw new HttpError(404, 'Pedido não encontrado. Confira o número e o e-mail informado.', 'not_found');

  // Se o pedido ainda estiver pendente e for Pix via SyncPay, consulta e confirma em tempo real
  if (order.paymentStatus === 'pendente' && order.paymentMethod === 'pix' && (order.gatewayTransactionId || order.paymentDetails?.identifier)) {
    const txId = order.gatewayTransactionId || order.paymentDetails?.identifier;
    try {
      const tx = await checkSyncPayTransaction(txId);
      if (tx && tx.status) {
        const txStatus = String(tx.status).toLowerCase();
        if (['paid', 'approved', 'completed', 'pago'].some((s) => txStatus.includes(s))) {
          markPaid(order.id, {
            actor: 'syncpay:realtime_check',
            note: 'Pagamento Pix verificado e confirmado em tempo real via SyncPay.'
          });
          order.paymentStatus = 'confirmado';
          order.orderStatus = 'pago';
        }
      }
    } catch (err) {
      console.warn('[orders:poll] Falha ao checar status SyncPay:', err.message);
    }
  }

  res.json({
    ok: true,
    order: {
      id: order.id,
      createdAt: order.createdAt,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      total: order.total,
      items: order.items,
      shippingMethod: order.shippingMethod,
      trackingCode: order.trackingCode,
      paymentDetails: order.paymentDetails,
      securitySeal: order.securitySeal,
      history: order.history
    }
  });
}));

router.post(
  '/auth/register',
  rateLimit({ windowMs: 300000, max: 10, key: 'register' }),
  asyncHandler((req, res) => {
    const result = registerCustomer(req.body || {});
    res.status(201).json({ ok: true, ...result });
  })
);

router.post(
  '/auth/login',
  rateLimit({ windowMs: 300000, max: 20, key: 'login' }),
  asyncHandler((req, res) => {
    const { email, password } = req.body || {};
    const result = loginCustomer(email, password);
    res.json({ ok: true, ...result });
  })
);

router.post('/auth/logout', asyncHandler((req, res) => {
  const { token } = customerFromRequest(req);
  logoutCustomer(token);
  res.json({ ok: true });
}));

router.get('/auth/me', asyncHandler((req, res) => {
  const { customer } = customerFromRequest(req);
  if (!customer) throw new HttpError(401, 'Sessão expirada.', 'unauthorized');
  res.json({ ok: true, customer: customerProfile(customer.id) });
}));

router.put('/auth/me', asyncHandler((req, res) => {
  const { customer } = customerFromRequest(req);
  if (!customer) throw new HttpError(401, 'Sessão expirada. Faça login novamente.', 'unauthorized');
  const updated = updateCustomerProfile(customer.id, req.body || {});
  res.json({ ok: true, customer: updated });
}));

router.patch('/auth/me', asyncHandler((req, res) => {
  const { customer } = customerFromRequest(req);
  if (!customer) throw new HttpError(401, 'Sessão expirada. Faça login novamente.', 'unauthorized');
  const updated = updateCustomerProfile(customer.id, req.body || {});
  res.json({ ok: true, customer: updated });
}));

router.get('/me/orders', asyncHandler((req, res) => {
  const { customer } = customerFromRequest(req);
  if (!customer) throw new HttpError(401, 'Entre na sua conta para ver seus pedidos.', 'unauthorized');
  res.json({ ok: true, orders: customerOrders(customer.email) });
}));

router.post('/newsletter', rateLimit({ windowMs: 300000, max: 6, key: 'newsletter' }), (req, res) => {
  const email = normalizeEmail(req.body?.email || '');
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new HttpError(400, 'E-mail inválido.', 'invalid_email');

  commit((data) => {
    if (data.newsletter.some((entry) => entry.email === email)) return;
    data.newsletter.push({ email, at: new Date().toISOString() });
  });
  res.status(201).json({ ok: true, message: 'Inscrição registrada.' });
});

router.post('/webhooks/syncpay', asyncHandler(async (req, res) => {
  res.status(200).json({ ok: true, received: true });
  try {
    await processSyncPayWebhook(req.body);
  } catch (error) {
    console.error('[syncpay:webhook] Erro ao processar:', error.message);
  }
}));

router.post('/webhook/syncpay', asyncHandler(async (req, res) => {
  res.status(200).json({ ok: true, received: true });
  try {
    await processSyncPayWebhook(req.body);
  } catch (error) {
    console.error('[syncpay:webhook] Erro ao processar:', error.message);
  }
}));

router.post('/telegram/webhook/:secret', asyncHandler(async (req, res) => {
  const expected = config.telegram.webhookSecret || db().telegram.webhookSecret;
  if (!expected || req.params.secret !== expected) {
    return res.status(404).json({ ok: false });
  }
  await handleUpdate(req.body || {});
  return res.json({ ok: true });
}));

export default router;
