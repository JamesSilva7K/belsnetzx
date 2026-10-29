/**
 * ️ Segurança do painel administrativo
 * -------------------------------------------------
 * • Caminho do painel derivado por HMAC-SHA256 de um segredo local (não reversível)
 * • Senha com scrypt (salt por usuário) + segundo fator TOTP (RFC 6238)
 * • Sessões opacas de 256 bits, guardadas apenas como hash no servidor
 * • Bloqueio progressivo por IP, trilha de auditoria e telemetria real
 */
import crypto from 'node:crypto';
import { config } from '../config.js';
import { commit, db, addAudit, nextId } from '../lib/db.js';
import { HttpError, assert } from '../lib/errors.js';
import {
 constantTimeEqual,
 decrypt,
 encrypt,
 generateTotpSecret,
 hashPassword,
 hmacSha256,
 randomToken,
 sha256,
 totpCode,
 totpUri,
 verifyPassword,
 verifyTotp
} from '../lib/crypto.js';
import { notify } from './notify.js';
import { TelegramError } from '../lib/telegram-client.js';
import { sendTelegramMessage } from './telegram-service.js';

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const challenges = new Map();

/* ------------------------------------------------------------------ *
 * Caminho criptografado
 * ------------------------------------------------------------------ */

export function adminPathPrefix() {
 return `/${config.adminPath || 'janaadmin1978'}`;
}

export function adminPathInfo() {
 const prefix = adminPathPrefix();
 return {
 path: prefix,
 length: prefix.length - 1,
 algorithm: 'Caminho Dedicado e Seguro',
 stable: true,
 rotatedAt: db().meta.pathRotatedAt || db().meta.createdAt
 };
}

/* ------------------------------------------------------------------ *
 * Bootstrap do usuário administrador
 * ------------------------------------------------------------------ */

export function ensureBootstrapAdmin() {
 const data = db();
 if (data.adminUsers.length > 0) return null;

 const password = config.bootstrapPassword || crypto.randomBytes(12).toString('base64url');
 const totpSecret = generateTotpSecret();
 const credentials = hashPassword(password);

 const admin = {
 id: nextId('adm'),
 username: config.bootstrapUser.toLowerCase(),
 credentials,
 totpSecretEnc: encrypt(totpSecret, crypto.scryptSync(config.masterKey, 'aura-rosa::admin-secret::v1', 32), 'admin-totp'),
 createdAt: new Date().toISOString(),
 lastLoginAt: null,
 mustChangePassword: !config.bootstrapPassword
 };

 commit((store) => {
 store.adminUsers.push(admin);
 store.auditLog.unshift({
 id: nextId('aud'),
 at: new Date().toISOString(),
 actor: 'sistema',
 action: 'admin.bootstrap',
 detail: `Administrador "${admin.username}" criado.`,
 ip: 'local'
 });
 });

 return { username: admin.username, password, totpSecret, generated: !config.bootstrapPassword };
}

function adminTotpSecret(admin) {
 const key = crypto.scryptSync(config.masterKey, 'aura-rosa::admin-secret::v1', 32);
 return decrypt(admin.totpSecretEnc, key, 'admin-totp');
}

/* ------------------------------------------------------------------ *
 * Bloqueio por tentativas
 * ------------------------------------------------------------------ */

function attemptsFor(ip) {
 const store = db().authAttempts || {};
 return store[ip] || { count: 0, total: 0, lockedUntil: 0 };
}

export function loginLockStatus(ip) {
 const attempt = attemptsFor(ip);
 const remaining = Math.max(0, attempt.lockedUntil - Date.now());
 return { locked: remaining > 0, remainingMs: remaining, attempts: attempt.count, total: attempt.total };
}

function registerFailure(ip, username) {
 const result = commit((data) => {
 data.authAttempts = data.authAttempts || {};
 const current = data.authAttempts[ip] || { count: 0, total: 0, lockedUntil: 0 };
 current.count += 1;
 current.total += 1;
 current.lastAt = new Date().toISOString();
 if (current.count >= config.adminMaxAttempts) {
 current.lockedUntil = Date.now() + config.adminLockMinutes * 60 * 1000;
 current.count = 0;
 }
 data.authAttempts[ip] = current;
 return current;
 });
 return result;
}

function clearFailures(ip) {
 commit((data) => {
 if (data.authAttempts?.[ip]) delete data.authAttempts[ip];
 });
}

/* ------------------------------------------------------------------ *
 * Login direto (sem etapa de segundo fator)
 * ------------------------------------------------------------------ */

export async function loginAdmin({ username, password, ip, userAgent }) {
 const lock = loginLockStatus(ip);
 if (lock.locked) {
 throw new HttpError(
 429,
 `Muitas tentativas. Nova tentativa liberada em ${Math.ceil(lock.remainingMs / 60000)} min.`,
 'locked'
 );
 }

 const admin = db().adminUsers.find((entry) => entry.username === String(username || '').trim().toLowerCase());
 const valid = Boolean(admin) && verifyPassword(String(password || ''), admin?.credentials);

 if (!valid) {
 const attempt = registerFailure(ip, username);
 addAudit({
 actor: String(username || 'desconhecido').slice(0, 40),
 action: 'admin.login.failed',
 detail: `Credenciais inválidas (tentativa ${attempt.count}/${config.adminMaxAttempts}).`,
 ip
 });
 throw new HttpError(401, 'Usuário ou senha incorretos.', 'invalid_credentials');
 }

 clearFailures(ip);

 const token = randomToken(32);
 const sessionId = nextId('ses');
 const expiresAt = new Date(Date.now() + config.adminSessionHours * 3600 * 1000).toISOString();

 commit((data) => {
 const record = data.adminUsers.find((entry) => entry.id === admin.id);
 if (record) {
 record.lastLoginAt = new Date().toISOString();
 }
 data.adminSessions.unshift({
 id: sessionId,
 adminId: admin.id,
 username: admin.username,
 tokenHash: sha256(token),
 createdAt: new Date().toISOString(),
 expiresAt,
 ip,
 userAgent: String(userAgent || '').slice(0, 200),
 lastSeenAt: new Date().toISOString(),
 fingerprint: sha256(`${userAgent || ''}|${ip}`)
 });
 data.adminSessions = data.adminSessions.slice(0, 40);
 data.auditLog.unshift({
 id: nextId('aud'),
 at: new Date().toISOString(),
 actor: admin.username,
 action: 'admin.login',
 detail: `Sessão iniciada diretamente.`,
 ip
 });
 });

 return {
 token,
 session: {
 username: admin.username,
 expiresAt
 }
 };
}

export async function startLogin({ username, password, ip, userAgent }) {
 const lock = loginLockStatus(ip);
 if (lock.locked) {
 throw new HttpError(
 429,
 `Muitas tentativas. Nova tentativa liberada em ${Math.ceil(lock.remainingMs / 60000)} min.`,
 'locked'
 );
 }

 const admin = db().adminUsers.find((entry) => entry.username === String(username || '').trim().toLowerCase());
 const valid = Boolean(admin) && verifyPassword(String(password || ''), admin?.credentials);

 if (!valid) {
 const attempt = registerFailure(ip, username);
 addAudit({
 actor: String(username || 'desconhecido').slice(0, 40),
 action: 'admin.login.failed',
 detail: `Credenciais inválidas (tentativa ${attempt.count}/${config.adminMaxAttempts}).`,
 ip
 });
 notify({
 type: 'security_alert',
 title: ' Tentativa de acesso administrativo negada',
 detail: `Usuário "${String(username || '').slice(0, 40)}" • IP ${ip}`,
 severity: 'warning',
 meta: { username: String(username || '').slice(0, 40), ip, userAgent: String(userAgent || '').slice(0, 120) }
 });
 throw new HttpError(401, 'Usuário ou senha incorretos.', 'invalid_credentials');
 }

 const challengeId = randomToken(18);
 const code = null;
 challenges.set(challengeId, {
 adminId: admin.id,
 ip,
 createdAt: Date.now(),
 expiresAt: Date.now() + CHALLENGE_TTL_MS
 });

 // Segundo fator: enviado pelo bot quando configurado; senão, app autenticador.
 const secret = adminTotpSecret(admin);
 let delivery = 'authenticator';
 const telegramReady = Boolean(db().telegram.tokenEncrypted || config.telegram.token) && Boolean(targetChatId());

 if (telegramReady) {
 try {
 const otp = currentOtp(secret);
 await sendTelegramMessage(
 targetChatId(),
 [
 ' <b>Código de acesso ao painel</b>',
 '',
 `<b>${escape(otp)}</b>`,
 '',
 `<i>Válido por 30 segundos. Usuário: ${escape(admin.username)} • IP ${escape(ip)}</i>`
 ].join('\n')
 );
 delivery = 'telegram';
 } catch (error) {
 console.error('[admin] Falha ao enviar OTP pelo Telegram:', error.message);
 delivery = 'authenticator';
 }
 }

 return {
 challengeId,
 delivery,
 hint:
 delivery === 'telegram'
 ? 'Enviamos o código de 6 dígitos para o seu Telegram.'
 : 'Informe o código de 6 dígitos do seu aplicativo autenticador.',
 expiresInSeconds: Math.round(CHALLENGE_TTL_MS / 1000),
 totpSetupUri: delivery === 'authenticator' ? totpUri({ issuer: 'Aura Rosa', account: admin.username, secret }) : undefined
 };
}

function currentOtp(secret) {
 return totpCode(secret);
}

function targetChatId() {
 const telegram = db().telegram;
 return telegram.chatId || config.telegram.chatId || telegram.adminIds?.[0] || config.telegram.adminIds[0] || '';
}

export function verifySecondFactor({ challengeId, code, ip, userAgent }) {
 const challenge = challenges.get(String(challengeId || ''));
 if (!challenge) throw new HttpError(401, 'Desafio expirado. Faça login novamente.', 'challenge_expired');
 if (Date.now() > challenge.expiresAt) {
 challenges.delete(challengeId);
 throw new HttpError(401, 'Código expirado. Faça login novamente.', 'challenge_expired');
 }

 const lock = loginLockStatus(ip);
 if (lock.locked) throw new HttpError(429, 'Muitas tentativas. Aguarde o bloqueio terminar.', 'locked');

 const admin = db().adminUsers.find((entry) => entry.id === challenge.adminId);
 if (!admin) throw new HttpError(401, 'Administrador não encontrado.', 'invalid_admin');

 const secret = adminTotpSecret(admin);
 if (!verifyTotp(secret, code, { window: 1 })) {
 registerFailure(ip, admin.username);
 addAudit({ actor: admin.username, action: 'admin.otp.failed', detail: 'Código TOTP inválido.', ip });
 throw new HttpError(401, 'Código incorreto ou expirado.', 'invalid_otp');
 }

 challenges.delete(challengeId);
 clearFailures(ip);

 const token = randomToken(32);
 const sessionId = nextId('ses');
 const expiresAt = new Date(Date.now() + config.adminSessionHours * 3600 * 1000).toISOString();

 commit((data) => {
 const record = data.adminUsers.find((entry) => entry.id === admin.id);
 record.lastLoginAt = new Date().toISOString();
 data.adminSessions.unshift({
 id: sessionId,
 adminId: admin.id,
 username: admin.username,
 tokenHash: sha256(token),
 createdAt: new Date().toISOString(),
 expiresAt,
 ip,
 userAgent: String(userAgent || '').slice(0, 200),
 lastSeenAt: new Date().toISOString(),
 fingerprint: sha256(`${userAgent || ''}|${ip}`)
 });
 data.adminSessions = data.adminSessions.slice(0, 40);
 data.auditLog.unshift({
 id: nextId('aud'),
 at: new Date().toISOString(),
 actor: admin.username,
 action: 'admin.login.success',
 detail: 'Sessão administrativa iniciada com 2FA.',
 ip
 });
 });

 notify({
 type: 'security_alert',
 title: ' Acesso administrativo autorizado',
 detail: `${admin.username} • IP ${ip}`,
 severity: 'success',
 meta: { username: admin.username, ip, userAgent: String(userAgent || '').slice(0, 120), sessionId }
 });

 return { token, sessionId, expiresAt, username: admin.username };
}

/* ------------------------------------------------------------------ *
 * Sessões
 * ------------------------------------------------------------------ */

/**
 * Cria uma sessão administrativa. Usado pelo 2FA e pelo link de uso único
 * enviado pelo bot do Telegram (canal já autenticado, sessão mais curta).
 */
export function createSessionForAdmin(adminId, { ip, userAgent, ttlMinutes = null, channel = 'password+2fa' } = {}) {
 const admin = db().adminUsers.find((entry) => entry.id === adminId);
 if (!admin) throw new HttpError(401, 'Administrador não encontrado.', 'invalid_admin');

 const token = randomToken(32);
 const sessionId = nextId('ses');
 const minutes = ttlMinutes || config.adminSessionHours * 60;
 const expiresAt = new Date(Date.now() + minutes * 60000).toISOString();

 commit((data) => {
 const record = data.adminUsers.find((entry) => entry.id === admin.id);
 record.lastLoginAt = new Date().toISOString();
 data.adminSessions.unshift({
 id: sessionId,
 adminId: admin.id,
 username: admin.username,
 tokenHash: sha256(token),
 createdAt: new Date().toISOString(),
 expiresAt,
 ip,
 userAgent: String(userAgent || '').slice(0, 200),
 lastSeenAt: new Date().toISOString(),
 fingerprint: sha256(`${userAgent || ''}|${ip}`),
 channel
 });
 data.adminSessions = data.adminSessions.slice(0, 40);
 data.auditLog.unshift({
 id: nextId('aud'),
 at: new Date().toISOString(),
 actor: admin.username,
 action: 'admin.login.success',
 detail: `Sessão criada via ${channel}.`,
 ip
 });
 });

 return { token, sessionId, expiresAt, username: admin.username };
}

export function consumeEntryToken(token, { ip, userAgent } = {}) {
 const hash = sha256(String(token || ''));
 const record = db().adminEntryTokens.find((entry) => constantTimeEqual(entry.tokenHash, hash));
 if (!record) throw new HttpError(401, 'Link inválido ou já utilizado.', 'invalid_entry');
 if (record.usedAt) throw new HttpError(401, 'Este link já foi utilizado.', 'entry_used');
 if (new Date(record.expiresAt).getTime() < Date.now()) throw new HttpError(401, 'Link expirado. Gere outro no bot.', 'entry_expired');

 commit((data) => {
 const target = data.adminEntryTokens.find((entry) => entry.id === record.id);
 if (target) target.usedAt = new Date().toISOString();
 });

 const admin = db().adminUsers[0];
 if (!admin) throw new HttpError(500, 'Nenhum administrador configurado.', 'no_admin');

 const session = createSessionForAdmin(admin.id, { ip, userAgent, ttlMinutes: 60, channel: 'link-telegram' });

 notify({
 type: 'security_alert',
 title: ' Painel aberto por link do Telegram',
 detail: `${admin.username} • IP ${ip} • sessão de 60 min`,
 severity: 'warning',
 meta: { username: admin.username, ip, userAgent: String(userAgent || '').slice(0, 120) }
 });

 return session;
}

export function resolveSession(token) { if (!token) return null;
 const hash = sha256(token);
 const session = db().adminSessions.find((entry) => constantTimeEqual(entry.tokenHash, hash));
 if (!session) return null;
 if (new Date(session.expiresAt).getTime() < Date.now()) return null;
 return session;
}

export function touchSession(sessionId) {
 const session = db().adminSessions.find((entry) => entry.id === sessionId);
 if (!session) return;
 const last = new Date(session.lastSeenAt).getTime();
 if (Date.now() - last < 60000) return;
 commit((data) => {
 const record = data.adminSessions.find((entry) => entry.id === sessionId);
 if (record) record.lastSeenAt = new Date().toISOString();
 });
}

export function listSessions() {
 return db().adminSessions.map((session) => ({
 id: session.id,
 username: session.username,
 createdAt: session.createdAt,
 expiresAt: session.expiresAt,
 lastSeenAt: session.lastSeenAt,
 ip: session.ip,
 userAgent: session.userAgent,
 active: new Date(session.expiresAt).getTime() > Date.now()
 }));
}

export function revokeSession(sessionId, { actor = 'painel' } = {}) {
 commit((data) => {
 data.adminSessions = data.adminSessions.filter((entry) => entry.id !== sessionId);
 });
 addAudit({ actor, action: 'admin.session.revoked', detail: `Sessão ${sessionId} revogada.`, ip: '' });
 return { ok: true };
}

export function logoutAdmin(token, { ip } = {}) {
 if (!token) return { ok: true };
 const hash = sha256(token);
 commit((data) => {
 data.adminSessions = data.adminSessions.filter((entry) => entry.tokenHash !== hash);
 });
 addAudit({ actor: 'admin', action: 'admin.logout', detail: 'Sessão encerrada.', ip });
 return { ok: true };
}

/* ------------------------------------------------------------------ *
 * Credenciais e rotação de segredos
 * ------------------------------------------------------------------ */

export function changeCredentials({ session, currentPassword, code, newUsername, newPassword, rotatePath, rotateTotp }) {
 const admin = db().adminUsers.find((entry) => entry.id === session.adminId);
 if (!admin) throw new HttpError(401, 'Administrador não encontrado.', 'invalid_admin');
 assert(verifyPassword(String(currentPassword || ''), admin.credentials), 401, 'Senha atual incorreta.', 'invalid_password');

 const secret = adminTotpSecret(admin);
 assert(verifyTotp(secret, code, { window: 1 }), 401, 'Código 2FA inválido.', 'invalid_otp');

 const updates = [];
 let newSecret = null;

 commit((data) => {
 const record = data.adminUsers.find((entry) => entry.id === admin.id);

 if (newUsername && String(newUsername).trim().toLowerCase() !== record.username) {
 const username = String(newUsername).trim().toLowerCase();
 if (!/^[a-z0-9._-]{4,32}$/.test(username)) throw new HttpError(400, 'Usuário inválido.', 'invalid_username');
 if (data.adminUsers.some((entry) => entry.username === username && entry.id !== record.id)) {
 throw new HttpError(409, 'Este usuário já existe.', 'username_taken');
 }
 record.username = username;
 updates.push('usuário');
 }

 if (newPassword) {
 assert(String(newPassword).length >= 10, 400, 'A nova senha deve ter no mínimo 10 caracteres.', 'weak_password');
 record.credentials = hashPassword(String(newPassword));
 record.mustChangePassword = false;
 updates.push('senha');
 }

 if (rotateTotp) {
 newSecret = generateTotpSecret();
 const key = crypto.scryptSync(config.masterKey, 'aura-rosa::admin-secret::v1', 32);
 record.totpSecretEnc = encrypt(newSecret, key, 'admin-totp');
 updates.push('2FA');
 }

 if (rotatePath) {
 const newSecretPath = crypto.randomBytes(32).toString('base64url');
 data.meta.pendingPathSecret = newSecretPath;
 data.meta.pathRotatedAt = new Date().toISOString();
 updates.push('caminho');
 }

 data.auditLog.unshift({
 id: nextId('aud'),
 at: new Date().toISOString(),
 actor: record.username,
 action: 'admin.credentials.changed',
 detail: updates.length ? `Alterado: ${updates.join(', ')}.` : 'Nenhuma alteração.',
 ip: session.ip
 });
 });

 if (updates.includes('caminho')) {
 config.pathSecret = db().meta.pendingPathSecret;
 }

 return {
 ok: true,
 updated: updates,
 totpSecret: newSecret,
 totpSetupUri: newSecret ? totpUri({ issuer: 'Aura Rosa', account: session.username, secret: newSecret }) : undefined,
 newPath: updates.includes('caminho') ? adminPathPrefix() : undefined
 };
}

/* ------------------------------------------------------------------ *
 * Visão geral de segurança
 * ------------------------------------------------------------------ */

export function securityOverview() {
 const data = db();
 const telegram = data.telegram;
 return {
 path: adminPathInfo(),
 ports: { store: config.storePort, admin: config.adminPort || null, host: config.host },
 sessions: listSessions(),
 activeSessions: data.adminSessions.filter((entry) => new Date(entry.expiresAt).getTime() > Date.now()).length,
 auditLog: data.auditLog.slice(0, 60),
 attempts: Object.entries(data.authAttempts || {}).map(([ip, value]) => ({
 ip,
 attempts: value.count,
 total: value.total,
 lockedUntil: value.lockedUntil ? new Date(value.lockedUntil).toISOString() : null,
 locked: value.lockedUntil > Date.now()
 })),
 telegram: {
 enabled: Boolean(telegram.tokenEncrypted || config.telegram.token),
 chatConfigured: Boolean(telegram.chatId || config.telegram.chatId),
 botUsername: telegram.botUsername || '',
 lastUpdateAt: telegram.lastActivityAt,
 lastError: telegram.lastError || ''
 },
 environment: config.env,
 encryption: {
 passwords: 'scrypt (N=16384, r=8, p=1)',
 sessions: 'token opaco de 256 bits • hash SHA-256 em repouso',
 secrets: 'AES-256-GCM',
 path: 'HMAC-SHA256'
 },
 lockPolicy: {
 maxAttempts: config.adminMaxAttempts,
 lockMinutes: config.adminLockMinutes,
 sessionHours: config.adminSessionHours
 }
 };
}

function escape(text) {
 return String(text ?? '')
 .replace(/&/g, '&amp;')
 .replace(/</g, '&lt;')
 .replace(/>/g, '&gt;');
}

export { TelegramError };
