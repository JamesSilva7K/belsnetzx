/**
 * Carrinhos — rastreamento real de intenção de compra.
 * O carrinho vive no navegador da cliente, mas cada alteração é espelhada no
 * servidor para que o abandono seja detectado de verdade (sem dados inventados).
 */
import { config } from '../config.js';
import { commit, db, nextId } from '../lib/db.js';
import { brl, normalizeEmail, nowIso } from '../lib/format.js';
import { notify } from './notify.js';

export function syncCart({ sessionId, items = [], email = '' }) {
 if (!sessionId || String(sessionId).length < 8) {
 return { ok: false, error: 'sessionId inválido' };
 }

 const cleanItems = (Array.isArray(items) ? items : [])
 .map((item) => ({
 productId: String(item.productId || ''),
 name: String(item.name || '').slice(0, 120),
 quantity: Math.max(0, Math.trunc(Number(item.quantity || 0))),
 price: Math.max(0, Number(item.price || 0)),
 size: String(item.selectedSize || item.size || ''),
 color: String(item.selectedColor?.name || item.color || ''),
 image: String(item.image || '')
 }))
 .filter((item) => item.productId && item.quantity > 0);

 const subtotal = Number(cleanItems.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
 const itemsCount = cleanItems.reduce((sum, item) => sum + item.quantity, 0);

 const cart = commit((data) => {
 let record = data.carts.find((entry) => entry.sessionId === sessionId);
 if (!record) {
 record = {
 id: nextId('cart'),
 sessionId,
 email: normalizeEmail(email),
 items: [],
 itemsCount: 0,
 subtotal: 0,
 status: 'active',
 createdAt: nowIso(),
 updatedAt: nowIso(),
 abandonedNotifiedAt: null,
 contactedAt: null,
 convertedOrderId: null
 };
 data.carts.unshift(record);
 }

 record.items = cleanItems;
 record.itemsCount = itemsCount;
 record.subtotal = subtotal;
 record.updatedAt = nowIso();
 if (email) record.email = normalizeEmail(email);

 if (cleanItems.length === 0) {
 record.status = 'empty';
 } else if (record.status === 'empty' || record.status === 'abandoned') {
 record.status = 'active';
 record.abandonedNotifiedAt = null;
 }

 if (data.carts.length > 500) data.carts.length = 500;
 return record;
 }, { event: 'cart.synced', payload: { id: sessionId } });

 return { ok: true, cart };
}

export function listCarts({ status = null, limit = 100 } = {}) {
 return db()
 .carts.filter((cart) => (status ? cart.status === status : cart.itemsCount > 0))
 .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
 .slice(0, limit)
 .map((cart) => ({
 ...cart,
 minutesIdle: Math.round((Date.now() - new Date(cart.updatedAt).getTime()) / 60000)
 }));
}

export function markCartContacted(cartId, { actor = 'painel' } = {}) {
 const cart = commit((data) => {
 const record = data.carts.find((entry) => entry.id === cartId);
 if (!record) return null;
 record.contactedAt = nowIso();
 record.contactedBy = actor;
 return record;
 }, { event: 'cart.contacted', payload: { id: cartId } });

 if (cart) {
 notify({
 type: 'cart_contacted',
 title: ' Carrinho marcado como contatado',
 detail: `${cart.itemsCount} item(ns) • ${brl(cart.subtotal)} • ${cart.email || 'sem e-mail'}`,
 meta: { cartId: cart.id, items: cart.itemsCount, subtotal: cart.subtotal, email: cart.email, actor }
 });
 }
 return cart;
}

/** Varredura periódica: detecta abandono real por inatividade e avisa uma única vez. */
export function scanAbandonedCarts() {
 const limitMs = config.cartAbandonMinutes * 60 * 1000;
 const now = Date.now();
 const candidates = db().carts.filter(
 (cart) =>
 cart.status === 'active' &&
 cart.itemsCount > 0 &&
 !cart.abandonedNotifiedAt &&
 now - new Date(cart.updatedAt).getTime() >= limitMs
 );

 const detected = [];
 for (const cart of candidates) {
 const updated = commit((data) => {
 const record = data.carts.find((entry) => entry.id === cart.id);
 record.status = 'abandoned';
 record.abandonedNotifiedAt = nowIso();
 data.counters.cartsAbandoned += 1;
 return record;
 }, { event: 'cart.abandoned', payload: { id: cart.id } });

 detected.push(updated);

 notify({
 type: 'cart_abandoned',
 title: ` Carrinho abandonado — ${brl(cart.subtotal)}`,
 detail: `${cart.itemsCount} item(ns) sem finalizar há ${config.cartAbandonMinutes} min • ${cart.email || 'cliente sem cadastro'}`,
 severity: 'warning',
 meta: {
 cartId: cart.id,
 itemsCount: cart.itemsCount,
 subtotal: cart.subtotal,
 email: cart.email,
 minutesIdle: Math.round((now - new Date(cart.updatedAt).getTime()) / 60000),
 productNames: cart.items.map((item) => `${item.quantity}x ${item.name}`)
 }
 });
 }
 return detected;
}
