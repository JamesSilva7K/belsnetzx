/**  API administrativa — montada apenas sob o caminho criptografado. */
import express from 'express';
import { config } from '../config.js';
import { db, bus } from '../lib/db.js';
import { asyncHandler, bearerToken, clearCookie, clientIp, parseCookies, rateLimit, setCookie } from '../lib/http.js';
import { HttpError } from '../lib/errors.js';
import { brl } from '../lib/format.js';
import {
  adminPathInfo,
  changeCredentials,
  consumeEntryToken,
  listSessions,
  loginLockStatus,
  resolveSession,
  revokeSession,
  securityOverview,
  loginAdmin,
  startLogin,
  logoutAdmin,
  touchSession,
  verifySecondFactor
} from '../services/admin-auth.js';
import { createProduct, deleteProduct, listProducts, listReviews, updateProduct } from '../services/catalog.js';
import { changeStatus, deleteOrder, getOrder, listOrders, markPaid, setTrackingCode } from '../services/orders.js';
import { listMovements, moveStock, stockOverview } from '../services/stock.js';
import { addCashflowEntry, clearTestData, dashboardMetrics, deleteCashflowEntry, listCashflow } from '../services/finance.js';
import { listCarts, markCartContacted } from '../services/carts.js';
import { listCustomers, customerProfile } from '../services/customers.js';
import {
  createCoupon,
  deleteCoupon,
  listCoupons,
  toggleCoupon,
  updateCoupon
} from '../services/coupons.js';
import {
  createBanner,
  deleteBanner,
  getSettings,
  listBanners,
  updateBanner,
  updateCustomization,
  updateGateway,
  updateShipping,
  updatePaymentMethods
} from '../services/settings.js';
import { configure as configureTelegram, disconnect as disconnectTelegram, status as telegramStatus, testMessage } from '../services/telegram-service.js';
import { recentNotifications } from '../services/notify.js';
import { createEntryLink } from '../services/telegram-bot.js';
import { getSyncPayBalance, getAccessToken, getSyncPayConfig } from '../services/syncpay.js';
import { getSecurityOverview, unbanIp, verifySaleOrder } from '../services/security.js';

const router = express.Router();
const COOKIE = 'aura_admin';

function candidateTokens(req) {
  return [bearerToken(req), parseCookies(req.headers.cookie).aura_admin].filter(Boolean);
}

function sessionToken(req) {
  for (const token of candidateTokens(req)) {
    if (resolveSession(token)) return token;
  }
  return candidateTokens(req)[0] || '';
}

function requireAdmin(req, res, next) {
  for (const token of candidateTokens(req)) {
    const session = resolveSession(token);
    if (session) {
      touchSession(session.id);
      req.adminSession = session;
      return next();
    }
  }
  return next(new HttpError(401, 'Sessão administrativa inválida ou expirada.', 'unauthorized'));
}

function currentSession(req) {
  return req.adminSession || resolveSession(sessionToken(req));
}

/* ---------------------------- Autenticação ---------------------------- */

router.get('/auth/session', (req, res) => {
  let session = null;
  for (const token of candidateTokens(req)) {
    session = resolveSession(token);
    if (session) break;
  }
  if (!session) return res.json({ ok: true, authenticated: false, path: adminPathInfo() });
  return res.json({
    ok: true,
    authenticated: true,
    session: {
      username: session.username,
      expiresAt: session.expiresAt,
      createdAt: session.createdAt,
      ip: session.ip,
      channel: session.channel || 'password+2fa'
    },
    path: adminPathInfo()
  });
});

router.post(
  '/auth/login',
  rateLimit({ windowMs: 60000, max: 10, key: 'admin-login' }),
  asyncHandler(async (req, res) => {
    const { username, password } = req.body || {};
    const ip = clientIp(req);
    const result = await loginAdmin({ username, password, ip, userAgent: req.headers['user-agent'] || '' });
    setCookie(res, COOKIE, result.token, { maxAge: config.adminSessionHours * 3600 * 1000 });
    res.json({ ok: true, session: result.session, token: result.token });
  })
);

router.post(
  '/auth/verify',
  rateLimit({ windowMs: 60000, max: 10, key: 'admin-verify' }),
  asyncHandler((req, res) => {
    const { challengeId, code } = req.body || {};
    const ip = clientIp(req);
    const session = verifySecondFactor({ challengeId, code, ip, userAgent: req.headers['user-agent'] || '' });
    setCookie(res, COOKIE, session.token, { maxAge: config.adminSessionHours * 3600 * 1000 });
    res.json({ ok: true, session: { username: session.username, expiresAt: session.expiresAt }, token: session.token });
  })
);

router.post(
  '/auth/entry',
  rateLimit({ windowMs: 60000, max: 10, key: 'admin-entry' }),
  asyncHandler((req, res) => {
    const { token } = req.body || {};
    const session = consumeEntryToken(token, { ip: clientIp(req), userAgent: req.headers['user-agent'] || '' });
    setCookie(res, COOKIE, session.token, { maxAge: 3600 * 1000 });
    res.json({ ok: true, session: { username: session.username, expiresAt: session.expiresAt }, token: session.token });
  })
);

router.post('/auth/logout', (req, res) => {
  logoutAdmin(sessionToken(req), { ip: clientIp(req) });
  clearCookie(res, COOKIE);
  res.json({ ok: true });
});

router.get('/auth/lock-status', (req, res) => {
  res.json({ ok: true, ...loginLockStatus(clientIp(req)) });
});

/* ------------------------------ Painel ------------------------------ */

router.use(requireAdmin);

router.get('/overview', (req, res) => {
  res.json({ ok: true, metrics: dashboardMetrics() });
});

router.get('/orders', (req, res) => {
  res.json({ ok: true, orders: listOrders({ status: req.query.status, search: req.query.search }) });
});

router.get('/orders/:id', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) throw new HttpError(404, 'Pedido não encontrado.', 'not_found');
  res.json({ ok: true, order });
});

router.post('/orders/:id/pay', (req, res) => {
  const order = markPaid(req.params.id, { actor: `admin:${req.adminSession.username}`, note: req.body?.note || '' });
  res.json({ ok: true, order });
});

router.post('/orders/:id/status', (req, res) => {
  const order = changeStatus(req.params.id, req.body?.status, {
    actor: `admin:${req.adminSession.username}`,
    note: req.body?.note || ''
  });
  res.json({ ok: true, order });
});

router.post('/orders/:id/tracking', (req, res) => {
  const order = setTrackingCode(req.params.id, req.body?.trackingCode, { actor: `admin:${req.adminSession.username}` });
  res.json({ ok: true, order });
});

router.delete('/orders/:id', (req, res) => {
  res.json(deleteOrder(req.params.id, { actor: `admin:${req.adminSession.username}` }));
});

router.get('/products', (req, res) => {
  res.json({ ok: true, products: listProducts() });
});

router.post('/products', (req, res) => {
  res.status(201).json({ ok: true, product: createProduct(req.body || {}) });
});

router.put('/products/:id', (req, res) => {
  res.json({ ok: true, product: updateProduct(req.params.id, req.body || {}) });
});

router.delete('/products/:id', (req, res) => {
  res.json(deleteProduct(req.params.id));
});

router.get('/stock', (req, res) => {
  res.json({ ok: true, ...stockOverview() });
});

router.get('/stock/movements', (req, res) => {
  res.json({
    ok: true,
    movements: listMovements({ limit: req.query.limit, productId: req.query.productId, type: req.query.type })
  });
});

router.post('/stock/move', (req, res) => {
  const movement = moveStock({ ...(req.body || {}), actor: `admin:${req.adminSession.username}` });
  res.status(201).json({ ok: true, movement });
});

router.get('/cashflow', (req, res) => {
  res.json({ ok: true, entries: listCashflow({ limit: req.query.limit, type: req.query.type }) });
});

router.post('/cashflow', (req, res) => {
  const entry = addCashflowEntry(req.body || {}, { actor: `admin:${req.adminSession.username}` });
  res.status(201).json({ ok: true, entry });
});

router.delete('/cashflow/:id', (req, res) => {
  res.json(deleteCashflowEntry(req.params.id, { actor: `admin:${req.adminSession.username}` }));
});

router.post('/finance/clear-test-data', (req, res) => {
  res.json(clearTestData({ actor: `admin:${req.adminSession.username}` }));
});

router.get('/carts', (req, res) => {
  res.json({ ok: true, carts: listCarts({ status: req.query.status || null }) });
});

router.post('/carts/:id/contacted', (req, res) => {
  res.json({ ok: true, cart: markCartContacted(req.params.id, { actor: `admin:${req.adminSession.username}` }) });
});

router.get('/customers', (req, res) => {
  res.json({ ok: true, customers: listCustomers({ search: req.query.search }) });
});

router.get('/customers/:id', (req, res) => {
  const customer = customerProfile(req.params.id);
  if (!customer) throw new HttpError(404, 'Cliente não encontrada.', 'not_found');
  res.json({ ok: true, customer });
});

router.get('/reviews', (req, res) => {
  res.json({ ok: true, reviews: listReviews(req.query.productId || null) });
});

router.get('/coupons', (req, res) => {
  res.json({ ok: true, coupons: listCoupons() });
});

router.post('/coupons', (req, res) => {
  res.status(201).json({ ok: true, coupon: createCoupon(req.body || {}) });
});

router.put('/coupons/:id', (req, res) => {
  res.json({ ok: true, coupon: updateCoupon(req.params.id, req.body || {}) });
});

router.post('/coupons/:id/toggle', (req, res) => {
  res.json({ ok: true, coupon: toggleCoupon(req.params.id) });
});

router.delete('/coupons/:id', (req, res) => {
  res.json(deleteCoupon(req.params.id));
});

router.get('/banners', (req, res) => {
  res.json({ ok: true, banners: listBanners() });
});

router.post('/banners', (req, res) => {
  res.status(201).json({ ok: true, banner: createBanner(req.body || {}) });
});

router.put('/banners/:id', (req, res) => {
  res.json({ ok: true, banner: updateBanner(req.params.id, req.body || {}) });
});

router.delete('/banners/:id', (req, res) => {
  res.json(deleteBanner(req.params.id));
});

router.get('/settings', (req, res) => {
  res.json({ ok: true, settings: getSettings() });
});

router.put('/settings/customization', (req, res) => {
  res.json({ ok: true, customization: updateCustomization(req.body || {}) });
});

router.put('/settings/gateway', (req, res) => {
  res.json({ ok: true, gateway: updateGateway(req.body || {}) });
});

router.put('/settings/payment-methods', (req, res) => {
  res.json({ ok: true, paymentMethods: updatePaymentMethods(req.body?.paymentMethods || req.body || []) });
});

router.get('/syncpay/balance', asyncHandler(async (req, res) => {
  res.json({ ok: true, ...(await getSyncPayBalance()) });
}));

router.post('/syncpay/test', asyncHandler(async (req, res) => {
  try {
    await getAccessToken();
    const balance = await getSyncPayBalance();
    res.json({ ok: true, connected: true, balance });
  } catch (error) {
    throw new HttpError(400, `Falha na conexão SyncPay: ${error.message}`, 'syncpay_error');
  }
}));

router.put('/settings/shipping', (req, res) => {
  res.json({ ok: true, shipping: updateShipping(req.body || {}) });
});

router.get('/notifications', (req, res) => {
  res.json({ ok: true, notifications: recentNotifications(Number(req.query.limit) || 60) });
});

/* ------------------------------ Telegram ------------------------------ */

router.get('/telegram/status', asyncHandler(async (req, res) => {
  res.json({ ok: true, status: await telegramStatus() });
}));

router.post('/telegram/configure', asyncHandler(async (req, res) => {
  try {
    const status = await configureTelegram({
      token: req.body?.token,
      chatId: req.body?.chatId,
      adminIds: String(req.body?.adminIds || '')
        .split(/[,\s;]+/)
        .filter(Boolean),
      enabled: req.body?.enabled !== false
    });
    res.json({ ok: true, status });
  } catch (error) {
    if (error?.name === 'TelegramError') {
      throw new HttpError(
        400,
        `O Telegram recusou o token: ${error.description || error.message}. Confira o token no @BotFather.`,
        'telegram_invalid'
      );
    }
    throw error;
  }
}));

router.post('/telegram/test', asyncHandler(async (req, res) => {
  try {
    await testMessage();
    res.json({ ok: true, message: 'Mensagem de teste enviada.' });
  } catch (error) {
    if (error?.name === 'TelegramError') {
      throw new HttpError(400, `Falha ao enviar: ${error.description || error.message}`, 'telegram_error');
    }
    throw error;
  }
}));

router.post('/telegram/disconnect', asyncHandler(async (req, res) => {
  res.json({ ok: true, status: await disconnectTelegram() });
}));

router.post('/telegram/link', (req, res) => {
  const link = createEntryLink({ minutes: Number(req.body?.minutes) || 10 });
  res.json({ ok: true, ...link });
});

/* ------------------------------ Segurança ------------------------------ */

router.get('/security', (req, res) => {
  res.json({ ok: true, ...securityOverview(), firewall: getSecurityOverview() });
});

router.get('/security/firewall', (req, res) => {
  res.json({ ok: true, ...getSecurityOverview() });
});

router.post('/security/firewall/unban', (req, res) => {
  const ip = String(req.body?.ip || '').trim();
  if (ip) unbanIp(ip);
  res.json({ ok: true, message: `IP ${ip} removido da quarentena.` });
});

router.get('/orders/:id/verify-seal', (req, res) => {
  const order = getOrder(req.params.id);
  if (!order) throw new HttpError(404, 'Pedido não encontrado.', 'not_found');
  res.json({ ok: true, orderId: order.id, ...verifySaleOrder(order) });
});

router.get('/security/sessions', (req, res) => {
  res.json({ ok: true, sessions: listSessions() });
});

router.post('/security/sessions/:id/revoke', (req, res) => {
  res.json(revokeSession(req.params.id, { actor: `admin:${req.adminSession.username}` }));
});

router.post(
  '/security/credentials',
  rateLimit({ windowMs: 300000, max: 6, key: 'admin-credentials' }),
  asyncHandler((req, res) => {
    const result = changeCredentials({
      session: req.adminSession,
      currentPassword: req.body?.currentPassword,
      code: req.body?.code,
      newUsername: req.body?.newUsername,
      newPassword: req.body?.newPassword,
      rotatePath: Boolean(req.body?.rotatePath),
      rotateTotp: Boolean(req.body?.rotateTotp)
    });
    if (result.newPath) {
      // o cookie antigo continua válido, mas a URL muda
      setCookie(res, COOKIE, sessionToken(req), { maxAge: config.adminSessionHours * 3600 * 1000 });
    }
    res.json({ ok: true, ...result });
  })
);

/* --------------------------- Tempo real (SSE) --------------------------- */

router.get('/events', (req, res) => {
  const session = resolveSession(sessionToken(req));
  if (!session) throw new HttpError(401, 'Sessão inválida.', 'unauthorized');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ at: new Date().toISOString(), username: session.username })}\n\n`);

  const forward = (event) => {
    if (!event) return; // descarta pings internos sem payload
    res.write(`event: change\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  };
  const onNotification = (notification) => {
    res.write(`event: notification\ndata: ${JSON.stringify(notification)}\n\n`);
  };

  bus.on('change', forward);
  bus.on('notification', onNotification);

  const heartbeat = setInterval(() => {
    res.write(`event: ping\ndata: ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bus.off('change', forward);
    bus.off('notification', onNotification);
  });
});

router.get('/summary/labels', (req, res) => {
  res.json({ ok: true, currency: brl(0) });
});

export { COOKIE as ADMIN_COOKIE };
export default router;
