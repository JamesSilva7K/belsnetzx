/** Utilitários HTTP: cookies, rate limit, guarda de origem e erros. */
import { config } from '../config.js';
import { HttpError } from './errors.js';

export function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

export function parseCookies(header = '') {
  const output = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) output[key] = decodeURIComponent(value);
  }
  return output;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true, sameSite = 'Strict', path = '/' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, `Path=${path}`, `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (config.isProduction) parts.push('Secure');
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  const existing = res.getHeader('Set-Cookie');
  const header = Array.isArray(existing) ? [...existing, parts.join('; ')] : existing ? [existing, parts.join('; ')] : [parts.join('; ')];
  res.setHeader('Set-Cookie', header);
}

export function clearCookie(res, name, path = '/') {
  setCookie(res, name, '', { maxAge: 0, path });
}

export function bearerToken(req) {
  const header = req.headers.authorization || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return null;
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) return forwarded.split(',')[0].trim();
  return (req.socket?.remoteAddress || 'local').replace('::ffff:', '');
}

/** Bloqueia requisições de escrita vindas de outra origem (CSRF). */
export function originGuard(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const origin = req.headers.origin;
  if (!origin) return next();

  const allowed = new Set([config.publicUrl, config.adminPublicUrl]);
  try {
    const host = new URL(origin);
    const reqHost = req.headers['x-forwarded-host'] || req.headers.host;
    if (host.host === reqHost) return next();
    if (host.hostname === 'localhost' || host.hostname === '127.0.0.1') return next();
    if (allowed.has(host.origin)) return next();
    if (host.hostname.endsWith('.trycloudflare.com')) return next();
  } catch {
    return next(new HttpError(403, 'Origem inválida.', 'invalid_origin'));
  }
  return next(new HttpError(403, 'Requisição bloqueada: origem não autorizada.', 'blocked_origin'));
}

const buckets = new Map();

/** Rate limit simples por IP + rota. */
export function rateLimit({ windowMs = 60000, max = 30, key = 'default' } = {}) {
  return (req, res, next) => {
    const ip = clientIp(req);
    const id = `${key}:${ip}`;
    const now = Date.now();
    const bucket = buckets.get(id) || { count: 0, resetAt: now + windowMs };
    if (now > bucket.resetAt) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(id, bucket);

    if (buckets.size > 5000) {
      for (const [entryKey, value] of buckets) {
        if (now > value.resetAt) buckets.delete(entryKey);
      }
    }

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      return next(new HttpError(429, 'Limite de requisições atingido. Aguarde um instante.', 'rate_limited'));
    }
    return next();
  };
}

export function notFound(message = 'Recurso não encontrado.') {
  return new HttpError(404, message, 'not_found');
}

export function errorHandler(error, req, res, _next) {
  const status = error instanceof HttpError ? error.status : 500;
  if (status >= 500) console.error('[http]', req.method, req.originalUrl, error);
  res.status(status).json({
    ok: false,
    error: status >= 500 ? 'Erro interno no servidor.' : error.message,
    code: error.code || 'error'
  });
}
