/**
 * 🚀 Servidor Aura Rosa
 * -------------------------------------------------
 * • Loja (SPA + API pública) na porta STORE_PORT
 * • Painel administrativo em caminho criptografado, opcionalmente em ADMIN_PORT
 * • Bot do Telegram (long polling ou webhook) e rotinas de vigilância
 */
import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { config } from './config.js';
import { commit, db } from './lib/db.js';
import { adminPathInfo, ensureBootstrapAdmin } from './services/admin-auth.js';
import { registerSink } from './services/notify.js';
import { deliverNotification, refreshProfile, registerCommands, startPolling, stopPolling, status as telegramStatus } from './services/telegram-service.js';
import { scanAbandonedCarts } from './services/carts.js';
import publicRouter from './routes/public.js';
import adminRouter from './routes/admin.js';
import { errorHandler, originGuard } from './lib/http.js';
import { firewallShield } from './services/security.js';

const ADMIN_PREFIX = adminPathInfo().path;

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  // CSP: bloqueia injeção de scripts externos em ambos os apps
  if (!config.isProduction) {
    // Dev: unsafe-eval necessário para o Vite HMR
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' ws: wss: https:; frame-ancestors 'none';"
    );
  } else {
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'none';"
    );
  }
  next();
}

async function createViteMiddleware() {
  if (config.isProduction) return null;
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: {
      middlewareMode: true,
      allowedHosts: true
    },
    appType: 'spa'
  });
  return vite;
}

function prodFile(name) {
  const file = path.join(config.distDir, name);
  return fs.existsSync(file) ? file : null;
}

function serveIndex(res, name) {
  const file = prodFile(name);
  if (!file) {
    res.status(503).type('text/plain').send('Build ausente. Rode "npm run build" antes de iniciar em produção.');
    return;
  }
  res.sendFile(file);
}

async function buildApps() {
  const vite = await createViteMiddleware();

  const applyFrontend = (app) => {
    if (vite) {
      app.use('/assets', express.static(path.join(config.rootDir, 'public'), { fallthrough: true }));
      app.use((req, res, next) => vite.middlewares(req, res, next));
      return;
    }
    app.use(express.static(config.distDir, { index: false, maxAge: '1h' }));
  };

  /* ------------------------- Loja ------------------------- */
  const store = express();
  store.disable('x-powered-by');
  store.set('trust proxy', 1);

  store.use(securityHeaders);
  store.use(firewallShield); // Blindagem ativa: bloqueia sondagens maliciosas e quarentena de IPs
  store.use(express.json({ limit: '256kb' }));
  store.use(originGuard); // Proteção CSRF: bloqueia requisições de escrita de outras origens
  store.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  store.use('/api', publicRouter);
  store.use('/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint não encontrado.', code: 'not_found' });
  });

  store.get('/health', (req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

  /* ------------------------ Painel ------------------------ */
  store.use(ADMIN_PREFIX + '/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  store.use(ADMIN_PREFIX + '/api', adminRouter);
  store.use(ADMIN_PREFIX + '/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint administrativo não encontrado.', code: 'not_found' });
  });
  // Página do painel: servida tanto em "<prefixo>" quanto em "<prefixo>/..."
  // (sem redirecionar, para não criar laço com o roteamento não-estrito do Express)
  const adminPage = (req, res, next) => {
    if (vite) {
      req.url = '/admin.html';
      return vite.middlewares(req, res, next);
    }
    return serveIndex(res, 'admin.html');
  };

  store.get(ADMIN_PREFIX, adminPage);
  store.get(new RegExp(`^${ADMIN_PREFIX}/.*`), adminPage);

  applyFrontend(store);
  store.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    if (vite) return vite.middlewares(req, res, next);
    return serveIndex(res, 'index.html');
  });
  store.use(errorHandler);

  /* -------------------- Porta do admin -------------------- */
  const adminApp = express();
  adminApp.disable('x-powered-by');
  adminApp.set('trust proxy', 1);
  adminApp.use(securityHeaders);
  adminApp.use(firewallShield);
  adminApp.use(express.json({ limit: '256kb' }));
  adminApp.use(originGuard); // Proteção CSRF também na porta administrativa

  adminApp.use(ADMIN_PREFIX + '/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  adminApp.use(ADMIN_PREFIX + '/api', adminRouter);
  adminApp.use(ADMIN_PREFIX + '/api', (req, res) => {
    res.status(404).json({ ok: false, error: 'Endpoint administrativo não encontrado.', code: 'not_found' });
  });

  adminApp.get(ADMIN_PREFIX, adminPage);
  adminApp.get(new RegExp(`^${ADMIN_PREFIX}/.*`), adminPage);

  if (vite) {
    // Na porta administrativa apenas os módulos necessários ao painel são expostos
    adminApp.use((req, res, next) => {
      if (
        req.method === 'GET' &&
        (req.path.startsWith('/src/') ||
          req.path.startsWith('/assets') ||
          req.path.startsWith('/@') ||
          req.path === '/admin.html' ||
          /\.(js|mjs|tsx?|css|json|woff2?|svg|png|jpg|ico)$/.test(req.path))
      ) {
        return vite.middlewares(req, res, next);
      }
      return next();
    });
  } else {
    adminApp.use('/assets', express.static(path.join(config.distDir, 'assets'), { maxAge: '1h' }));
  }

  // Qualquer outro caminho na porta administrativa responde 404 (superfície mínima)
  adminApp.use((req, res) => res.status(404).type('text/plain').send('Not found'));
  adminApp.use(errorHandler);

  return { store, adminApp, vite };
}

function startScheduler() {
  const cartTimer = setInterval(() => {
    try {
      const detected = scanAbandonedCarts();
      if (detected.length) console.log(`[carrinhos] ${detected.length} carrinho(s) abandonado(s) detectado(s).`);
    } catch (error) {
      console.error('[carrinhos] Falha na varredura:', error.message);
    }
  }, 60000);

  const sessionTimer = setInterval(() => {
    try {
      const data = db();
      const expired = data.adminSessions.some((session) => new Date(session.expiresAt).getTime() < Date.now());
      if (expired) {
        commit((store) => {
          store.adminSessions = store.adminSessions.filter(
            (session) => new Date(session.expiresAt).getTime() > Date.now()
          );
        });
      }
    } catch (error) {
      console.error('[sessões] Falha na limpeza:', error.message);
    }
  }, 3600000);

  return () => {
    clearInterval(cartTimer);
    clearInterval(sessionTimer);
  };
}

async function main() {
  const bootstrap = ensureBootstrapAdmin();

  registerSink('telegram', deliverNotification);

  const { store, adminApp, vite } = await buildApps();

  const storeServer = http.createServer(store);
  const adminServer = config.adminPort ? http.createServer(adminApp) : null;

  await new Promise((resolve, reject) => {
    storeServer.once('error', reject);
    storeServer.listen(config.storePort, config.host, resolve);
  });

  if (adminServer) {
    await new Promise((resolve, reject) => {
      adminServer.once('error', reject);
      adminServer.listen(config.adminPort, config.host, resolve);
    });
  }

  const stopScheduler = startScheduler();

  console.log('');
  console.log('  🌸  AURA ROSA — sistema no ar');
  console.log('  ─────────────────────────────────────────────');
  console.log(`  Loja:            http://localhost:${config.storePort}`);
  if (config.adminPort) console.log(`  Painel admin:    http://localhost:${config.adminPort}${ADMIN_PREFIX}/`);
  console.log(`  Caminho cifrado: ${ADMIN_PREFIX}/  (derivado por HMAC)`);
  console.log(`  Ambiente:        ${config.env}${vite ? ' • Vite (HMR ativo)' : ' • build estático'}`);
  console.log(`  Dados:           ${path.join(config.dataDir, 'db.json')}`);

  const telegram = await telegramStatus().catch(() => null);
  console.log(`  Telegram:        ${telegram?.configured ? `conectado${telegram.botUsername ? ` (@${telegram.botUsername})` : ''}` : 'não configurado'}`);

  if (bootstrap) {
    console.log('');
    console.log('  ⚠️  CREDENCIAIS INICIAIS DO ADMINISTRADOR (mostradas uma única vez)');
    console.log(`      usuário: ${bootstrap.username}`);
    if (bootstrap.generated) {
      console.log(`      senha:   ${bootstrap.password}`);
      console.log('      Guarde esta senha agora. Ela não é exibida novamente.');
    } else {
      console.log('      senha:   definida em ADMIN_PASSWORD (.env.local)');
    }
    console.log(`      2FA:     configure o app autenticador com o segredo ${bootstrap.totpSecret}`);
    console.log('      Abra Segurança > Credenciais no painel para trocar tudo.');
    console.log('');
  }

  console.log('');

  if (telegram?.tokenPresent) {
    await refreshProfile().catch((error) => console.error('[telegram] Perfil:', error.message));
    await registerCommands();
    startPolling();
  }

  const shutdown = (signal) => {
    console.log(`\n[server] ${signal} recebido, encerrando…`);
    stopPolling();
    stopScheduler();
    storeServer.close();
    adminServer?.close();
    setTimeout(() => process.exit(0), 400);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((error) => {
  console.error('[server] Falha fatal na inicialização:', error);
  process.exit(1);
});
