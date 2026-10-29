/**
 * 🚀 Vercel Serverless Function Entrypoint
 * -------------------------------------------------
 * Executa a API da loja e o painel administrativo de forma limpa,
 * sem erros, no ambiente serverless (Vercel Free).
 */
import express from 'express';
import { config } from '../server/config.js';
import publicRouter from '../server/routes/public.js';
import adminRouter from '../server/routes/admin.js';
import { firewallShield } from '../server/services/security.js';
import { errorHandler, originGuard } from '../server/lib/http.js';
import { adminPathInfo, ensureBootstrapAdmin } from '../server/services/admin-auth.js';

ensureBootstrapAdmin();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

function securityHeaders(req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob:; script-src 'self' 'unsafe-inline' https:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; connect-src 'self' https:; frame-ancestors 'none';"
  );
  next();
}

app.use(securityHeaders);
app.use(firewallShield);
app.use(express.json({ limit: '256kb' }));
app.use(originGuard);

const ADMIN_PREFIX = adminPathInfo().path;

// API pública
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use('/api', publicRouter);

// API administrativa (/janaadmin1978/api)
app.use(ADMIN_PREFIX + '/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(ADMIN_PREFIX + '/api', adminRouter);

app.use(errorHandler);

export default app;

