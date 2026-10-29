/**
 * 🛡️ Aura Rosa — Blindagem e Firewall Inteligente
 * -------------------------------------------------
 * • Detecção e isolamento de scanners de portas e vulnerabilidades (Honeypot Traps)
 * • Quarentena automática de IPs maliciosos
 * • Criptografia e selo inviolável de integridade de vendas (HMAC-SHA256)
 * • Métricas reais de segurança auditáveis no painel administrativo
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { commit, db } from '../lib/db.js';
import { clientIp } from '../lib/http.js';
import { nowIso } from '../lib/format.js';

// Padrões de requisições maliciosas típicas de bots, crawlers agressivos e scanners de portas/vulnerabilidades
const PROBE_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/\.aws/i,
  /\/wp-admin/i,
  /\/wp-login\.php/i,
  /\/xmlrpc\.php/i,
  /\/phpmyadmin/i,
  /\/pma/i,
  /\/actuator/i,
  /\/setup\.php/i,
  /\/shell/i,
  /\/eval-stdin\.php/i,
  /\/server-status/i,
  /\/cgi-bin/i,
  /\/solr/i,
  /\/telescope/i,
  /\/swagger/i,
  /\/api\/v1\/swagger/i,
  /\/console\//i,
  /\/boaform/i,
  /\/owa\//i,
  /\/admin\.php/i,
  /\/manager\/html/i
];

// Cache em memória de IPs em quarentena rápida
const activeQuarantine = new Map(); // ip -> { bannedAt, expiresAt, reason, attempts }

/** Inicializa estado de segurança no banco de dados se ausente */
function ensureSecurityDb() {
  const current = db();
  if (!current.security) {
    commit((data) => {
      data.security = {
        enabled: true,
        quarantine: {},
        incidents: [],
        blockedRequestsCount: 0
      };
    });
  }
}

/** Verifica se um IP está atualmente em quarentena */
export function isIpQuarantined(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return false;
  
  const now = Date.now();
  const cached = activeQuarantine.get(ip);
  if (cached) {
    if (now < cached.expiresAt) return true;
    activeQuarantine.delete(ip);
  }

  ensureSecurityDb();
  const persistent = db().security?.quarantine?.[ip];
  if (persistent) {
    const expiresAt = new Date(persistent.expiresAt).getTime();
    if (now < expiresAt) {
      activeQuarantine.set(ip, { ...persistent, expiresAt });
      return true;
    }
  }

  return false;
}

/** Coloca um IP em quarentena imediata */
export function quarantineIp(ip, reason = 'Ataque ou varredura de portas/arquivos sensíveis detectada', durationMs = 24 * 60 * 60 * 1000) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return;

  const now = Date.now();
  const expiresAt = now + durationMs;
  const entry = {
    ip,
    bannedAt: new Date(now).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    reason,
    attempts: (activeQuarantine.get(ip)?.attempts || 0) + 1
  };

  activeQuarantine.set(ip, entry);

  try {
    commit((data) => {
      if (!data.security) {
        data.security = { enabled: true, quarantine: {}, incidents: [], blockedRequestsCount: 0 };
      }
      data.security.quarantine[ip] = entry;
      data.security.blockedRequestsCount = (data.security.blockedRequestsCount || 0) + 1;
      data.security.incidents.unshift({
        id: `sec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        ip,
        reason,
        timestamp: entry.bannedAt
      });
      // Mantém histórico limpo e eficiente dos últimos 100 incidentes
      if (data.security.incidents.length > 100) {
        data.security.incidents = data.security.incidents.slice(0, 100);
      }
    });
  } catch (err) {
    console.error('[security] Falha ao registrar quarentena:', err.message);
  }
}

/** Desbloqueia manualmente um IP da quarentena */
export function unbanIp(ip) {
  activeQuarantine.delete(ip);
  commit((data) => {
    if (data.security?.quarantine?.[ip]) {
      delete data.security.quarantine[ip];
    }
  });
}

/** Middleware da blindagem: intercepta sondagens maliciosas e descobrimento de rotas/portas */
export function firewallShield(req, res, next) {
  const ip = clientIp(req);
  const urlPath = req.originalUrl || req.url || '';

  // 1. Se o IP já está em quarentena, bloqueia com 403 e conexão finalizada
  if (isIpQuarantined(ip)) {
    res.setHeader('Connection', 'close');
    return res.status(403).json({
      ok: false,
      error: 'Acesso bloqueado por diretrizes de segurança e firewall ativo.',
      code: 'ip_quarantined'
    });
  }

  // 2. Verifica se a rota requisitada é uma sonda maliciosa
  const isProbe = PROBE_PATTERNS.some((pattern) => pattern.test(urlPath));
  if (isProbe) {
    quarantineIp(ip, `Varredura suspeita detectada na rota: ${urlPath.slice(0, 50)}`);
    res.setHeader('Connection', 'close');
    return res.status(403).json({
      ok: false,
      error: 'Requisição inválida. IP adicionado à quarentena de segurança.',
      code: 'security_probe_blocked'
    });
  }

  next();
}

/** Gera selo de integridade criptográfica inviolável para cada venda */
export function signSaleOrder(order) {
  const payload = [
    order.id,
    order.total,
    order.lead?.cpf || '',
    order.lead?.email || '',
    order.createdAt,
    order.shipping?.method || '',
    order.shipping?.cost || 0
  ].join('||');

  const signature = crypto
    .createHmac('sha256', config.masterKey)
    .update(payload)
    .digest('hex');

  const publicHash = crypto
    .createHash('sha256')
    .update(`${order.id}:${signature.slice(0, 16)}:${order.total}`)
    .digest('hex');

  return {
    algorithm: 'HMAC-SHA256',
    signature,
    shortHash: publicHash.slice(0, 16).toUpperCase(),
    fullHash: publicHash,
    sealedAt: nowIso(),
    verified: true
  };
}

/** Verifica se a assinatura da venda permanece íntegra e sem adulterações */
export function verifySaleOrder(order) {
  if (!order || !order.securitySeal?.signature) {
    return { verified: false, reason: 'Selo de segurança ausente' };
  }

  const payload = [
    order.id,
    order.total,
    order.lead?.cpf || '',
    order.lead?.email || '',
    order.createdAt,
    order.shipping?.method || '',
    order.shipping?.cost || 0
  ].join('||');

  const expectedSignature = crypto
    .createHmac('sha256', config.masterKey)
    .update(payload)
    .digest('hex');

  const isValid = crypto.timingSafeEqual(
    Buffer.from(order.securitySeal.signature),
    Buffer.from(expectedSignature)
  );

  return {
    verified: isValid,
    sealedAt: order.securitySeal.sealedAt,
    shortHash: order.securitySeal.shortHash
  };
}

/** Retorna métricas reais de segurança para o painel administrativo */
export function getSecurityOverview() {
  ensureSecurityDb();
  const sec = db().security || { quarantine: {}, incidents: [], blockedRequestsCount: 0 };
  const quarantinedList = Object.values(sec.quarantine || {});
  const now = Date.now();
  const activeBans = quarantinedList.filter((entry) => new Date(entry.expiresAt).getTime() > now);

  const orders = db().orders || [];
  const sealedOrdersCount = orders.filter((o) => Boolean(o.securitySeal?.verified)).length;

  return {
    firewallActive: true,
    activeQuarantinesCount: activeBans.length,
    totalBlockedAttempts: sec.blockedRequestsCount || 0,
    sealedOrdersCount,
    totalOrdersCount: orders.length,
    quarantinedIps: activeBans.slice(0, 20),
    recentIncidents: (sec.incidents || []).slice(0, 15)
  };
}

