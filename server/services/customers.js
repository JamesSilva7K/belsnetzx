/**
 * Contas de cliente — cadastro, login e sessões reais (scrypt + token opaco).
 */
import { config } from '../config.js';
import { commit, db, nextId } from '../lib/db.js';
import { HttpError, assert } from '../lib/errors.js';
import { brl, isValidCPF, isValidEmail, normalizeEmail, nowIso, onlyDigits } from '../lib/format.js';
import { constantTimeEqual, hashPassword, randomToken, sha256, verifyPassword } from '../lib/crypto.js';
import { notify } from './notify.js';

function publicCustomer(customer) {
 return {
 id: customer.id,
 name: customer.fullName,
 fullName: customer.fullName,
 email: customer.email,
 cpf: customer.cpf,
 phone: customer.phone,
 createdAt: customer.createdAt,
 lastLoginAt: customer.lastLoginAt || null,
 ordersCount: customer.ordersCount || 0,
 totalSpent: customer.totalSpent || 0,
 addresses: customer.addresses || [],
  wishlist: customer.wishlist || []
 };
}

function issueSession(data, customerId) {
 const token = randomToken(32);
 data.customerSessions.unshift({
 id: nextId('cs'),
 customerId,
 tokenHash: sha256(token),
 createdAt: nowIso(),
 expiresAt: new Date(Date.now() + config.customerSessionDays * 864e5).toISOString(),
 lastSeenAt: nowIso()
 });
 data.customerSessions = data.customerSessions.slice(0, 500);
 return token;
}

export function registerCustomer(input) {
 const fullName = String(input.name || input.fullName || '').trim();
 const email = normalizeEmail(input.email);
 const cpf = String(input.cpf || '').trim();
 const phone = String(input.phone || '').trim();
 const password = String(input.password || '');

 assert(fullName.split(/\s+/).length >= 2, 400, 'Informe seu nome completo.', 'invalid_name');
 assert(isValidEmail(email), 400, 'E-mail inválido.', 'invalid_email');
 assert(isValidCPF(cpf), 400, 'CPF inválido.', 'invalid_cpf');
 assert(onlyDigits(phone).length >= 10, 400, 'WhatsApp inválido.', 'invalid_phone');
 assert(password.length >= 8, 400, 'A senha deve ter pelo menos 8 caracteres.', 'weak_password');

 const data = db();
 if (data.customers.some((customer) => customer.email === email)) {
 throw new HttpError(409, 'Já existe uma conta com este e-mail. Faça login.', 'email_taken');
 }
 if (data.customers.some((customer) => onlyDigits(customer.cpf) === onlyDigits(cpf))) {
 throw new HttpError(409, 'Já existe uma conta com este CPF.', 'cpf_taken');
 }

 const credentials = hashPassword(password);
 const result = commit((store) => {
 const customer = {
 id: nextId('cli'),
 fullName,
 email,
 cpf,
 phone,
 credentials,
 createdAt: nowIso(),
 lastLoginAt: nowIso(),
 addresses: input.address ? [input.address] : [],
 ordersCount: 0,
 totalSpent: 0,
 marketingOptIn: Boolean(input.marketingOptIn)
 };
 store.customers.unshift(customer);
 store.counters.accountsCreated += 1;
 const token = issueSession(store, customer.id);
 return { customer, token };
 }, { event: 'customer.created', payload: { email } });

 notify({
 type: 'account_created',
 title: ' Nova conta criada',
 detail: `${fullName} • ${email} • ${phone}`,
 severity: 'info',
 meta: {
 customerId: result.customer.id,
 name: fullName,
 email,
 phone,
 cpf: cpf.replace(/\d(?=\d{3})/g, '*').slice(0, 14),
 city: input.address?.city || '',
 marketingOptIn: Boolean(input.marketingOptIn)
 }
 });

 return { token: result.token, customer: publicCustomer(result.customer) };
}

export function loginCustomer(email, password) {
 const target = normalizeEmail(email);
 const customer = db().customers.find((entry) => entry.email === target);
 if (!customer || !verifyPassword(String(password || ''), customer.credentials)) {
 throw new HttpError(401, 'E-mail ou senha incorretos.', 'invalid_credentials');
 }

 const result = commit((data) => {
 const record = data.customers.find((entry) => entry.id === customer.id);
 record.lastLoginAt = nowIso();
 const token = issueSession(data, record.id);
 return { token, customer: record };
 }, { event: 'customer.login', payload: { email: target } });

 return { token: result.token, customer: publicCustomer(result.customer) };
}

export function resolveCustomerToken(token) {
 if (!token) return null;
 const hash = sha256(token);
 const data = db(); // snapshot único — evita leitura dupla em cenários de escrita concorrente
 const session = data.customerSessions.find((entry) => constantTimeEqual(entry.tokenHash, hash));
 if (!session) return null;
 if (new Date(session.expiresAt).getTime() < Date.now()) return null;
 const customer = data.customers.find((entry) => entry.id === session.customerId);
 if (!customer) return null;
 return customer;
}

export function logoutCustomer(token) {
 if (!token) return { ok: true };
 const hash = sha256(token);
 commit((data) => {
 data.customerSessions = data.customerSessions.filter((entry) => entry.tokenHash !== hash);
 });
 return { ok: true };
}


export function updateCustomerProfile(customerId, input) {
  const data = db();
  const customer = data.customers.find((entry) => entry.id === customerId);
  if (!customer) throw new HttpError(404, 'Cliente não encontrado.', 'customer_not_found');

  const fullName = input.fullName ? String(input.fullName).trim() : customer.fullName;
  const phone = input.phone ? String(input.phone).trim() : customer.phone;
  const cpf = input.cpf ? String(input.cpf).trim() : customer.cpf;

  if (input.fullName) {
    assert(fullName.split(/\s+/).length >= 2, 400, 'Informe seu nome completo.', 'invalid_name');
  }
  if (input.phone) {
    assert(onlyDigits(phone).length >= 10, 400, 'WhatsApp inválido (informe DDD + número).', 'invalid_phone');
  }
  if (input.cpf && onlyDigits(input.cpf) !== onlyDigits(customer.cpf)) {
    assert(isValidCPF(cpf), 400, 'CPF inválido.', 'invalid_cpf');
    const duplicate = data.customers.find((c) => c.id !== customerId && onlyDigits(c.cpf) === onlyDigits(cpf));
    if (duplicate) throw new HttpError(409, 'Já existe outra conta com este CPF.', 'cpf_taken');
  }

  let newCredentials = null;
  if (input.newPassword) {
    assert(String(input.newPassword).length >= 8, 400, 'A nova senha deve ter pelo menos 8 caracteres.', 'weak_password');
    if (customer.credentials) {
      assert(input.currentPassword, 400, 'Informe a senha atual para alterá-la.', 'missing_password');
      assert(verifyPassword(String(input.currentPassword), customer.credentials), 401, 'Senha atual incorreta.', 'invalid_password');
    }
    newCredentials = hashPassword(String(input.newPassword));
  }

  const updated = commit((store) => {
    const record = store.customers.find((entry) => entry.id === customerId);
    record.fullName = fullName;
    record.phone = phone;
    record.cpf = cpf;
    if (newCredentials) {
      record.credentials = newCredentials;
    }

    if (input.address && typeof input.address === 'object' && input.address.street) {
      const addr = {
        street: String(input.address.street).trim(),
        number: String(input.address.number || '').trim(),
        complement: String(input.address.complement || '').trim(),
        neighborhood: String(input.address.neighborhood || '').trim(),
        city: String(input.address.city || '').trim(),
        state: String(input.address.state || '').trim().toUpperCase(),
        cep: String(input.address.cep || '').trim()
      };
      if (!record.addresses) record.addresses = [];
      const idx = record.addresses.findIndex((a) => a.cep === addr.cep && a.number === addr.number);
      if (idx >= 0) {
        record.addresses[idx] = addr;
      } else {
        record.addresses.unshift(addr);
      }
    }

    record.updatedAt = nowIso();
    return record;
  }, { event: 'customer.updated', payload: { id: customerId, email: customer.email } });

  notify({
    type: 'customer_updated',
    title: ' Cadastro de cliente atualizado',
    detail: `${fullName} • ${customer.email} • ${phone}`,
    severity: 'info',
    meta: { customerId, fullName, email: customer.email, phone }
  });

  return publicCustomer(updated);
}

export function customerProfile(customerId) {
 const customer = db().customers.find((entry) => entry.id === customerId);
 if (!customer) return null;
 const orders = db().orders.filter(
 (order) => normalizeEmail(order.lead.email) === customer.email || order.customerId === customerId
 );
 const paid = orders.filter((order) => order.paymentStatus === 'confirmado');
 return {
 ...publicCustomer(customer),
 ordersCount: orders.length,
 totalSpent: paid.reduce((sum, order) => sum + Number(order.total || 0), 0),
 totalSpentLabel: brl(paid.reduce((sum, order) => sum + Number(order.total || 0), 0)),
 orders: orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
 };
}

export function listCustomers({ search = '', limit = 200 } = {}) {
 const term = String(search || '').trim().toLowerCase();
 const orders = db().orders;
 return db()
 .customers.filter(
 (customer) =>
 !term ||
 customer.fullName.toLowerCase().includes(term) ||
 customer.email.includes(term) ||
 onlyDigits(customer.cpf).includes(onlyDigits(term))
 )
 .slice(0, limit)
 .map((customer) => {
 const own = orders.filter((order) => normalizeEmail(order.lead.email) === customer.email);
 const paid = own.filter((order) => order.paymentStatus === 'confirmado');
 return {
 ...publicCustomer(customer),
 ordersCount: own.length,
 totalSpent: paid.reduce((sum, order) => sum + Number(order.total || 0), 0),
 lastOrderAt: own[0]?.createdAt || null
 };
 })
 .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


export function syncCustomerWishlist(customerId, wishlist) {
  const cleanList = Array.isArray(wishlist) ? Array.from(new Set(wishlist.map(String))) : [];
  const updated = commit((store) => {
    const record = store.customers.find((entry) => entry.id === customerId);
    if (!record) throw new HttpError(404, 'Cliente não encontrado.', 'customer_not_found');
    record.wishlist = cleanList;
    return record;
  });
  return publicCustomer(updated);
}
