/**
 * 🎟️ Cupons — validação real (data, valor mínimo, escopo, limite de usos).
 */
import { commit, db, nextId } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';

export function evaluateCoupon(code, subtotal, items = []) {
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) return { ok: false, error: 'Informe um cupom.' };

  const coupon = db().coupons.find((item) => item.code.toUpperCase() === clean);
  if (!coupon) return { ok: false, error: 'Cupom não encontrado.' };
  if (!coupon.isActive) return { ok: false, error: 'Este cupom está desativado.' };

  const today = new Date();
  const validUntil = new Date(`${coupon.validUntil}T23:59:59`);
  if (Number.isFinite(validUntil.getTime()) && today > validUntil) {
    return { ok: false, error: 'Este cupom está expirado.' };
  }
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) {
    return { ok: false, error: 'Este cupom atingiu o limite de utilizações.' };
  }
  if (subtotal < Number(coupon.minPurchase || 0)) {
    return {
      ok: false,
      error: `O valor mínimo para este cupom é ${Number(coupon.minPurchase).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
      })}.`
    };
  }

  let base = subtotal;
  if (coupon.scope === 'specific_product' && coupon.specificProductId) {
    const item = items.find((entry) => entry.productId === coupon.specificProductId);
    if (!item) return { ok: false, error: 'Este cupom vale apenas para um produto específico.' };
    base = Number(item.price || 0) * Number(item.quantity || 0);
  }

  let discount =
    coupon.discountType === 'percentage' ? (base * Number(coupon.discountValue)) / 100 : Number(coupon.discountValue);
  if (coupon.maxDiscount) discount = Math.min(discount, Number(coupon.maxDiscount));
  discount = Math.max(0, Math.min(discount, subtotal));

  return { ok: true, coupon, discount: Number(discount.toFixed(2)) };
}

export function listCoupons() {
  return db().coupons.slice().sort((a, b) => b.validUntil.localeCompare(a.validUntil));
}

export function createCoupon(input) {
  const code = String(input.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new HttpError(400, 'Código inválido (3 a 24 caracteres alfanuméricos).', 'invalid_code');
  if (db().coupons.some((coupon) => coupon.code.toUpperCase() === code)) {
    throw new HttpError(409, 'Já existe um cupom com este código.', 'duplicate_code');
  }
  const discountValue = Number(input.discountValue);
  if (!(discountValue > 0)) throw new HttpError(400, 'Valor de desconto inválido.', 'invalid_discount');

  const coupon = {
    id: nextId('coup'),
    code,
    discountType: input.discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue,
    minPurchase: Math.max(0, Number(input.minPurchase || 0)),
    maxDiscount: input.maxDiscount ? Math.max(0, Number(input.maxDiscount)) : undefined,
    validUntil: String(input.validUntil || new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)),
    maxUses: input.maxUses ? Math.max(0, Number(input.maxUses)) : undefined,
    usedCount: 0,
    isActive: input.isActive !== false,
    scope: input.scope === 'specific_product' ? 'specific_product' : 'global',
    specificProductId: input.specificProductId || undefined,
    description: String(input.description || '').trim()
  };

  commit((data) => {
    data.coupons.unshift(coupon);
  }, { event: 'coupon.created', payload: { id: coupon.id } });

  return coupon;
}

export function updateCoupon(id, patch) {
  const exists = db().coupons.some((coupon) => coupon.id === id);
  if (!exists) throw new HttpError(404, 'Cupom não encontrado.', 'not_found');
  return commit((data) => {
    const index = data.coupons.findIndex((coupon) => coupon.id === id);
    data.coupons[index] = { ...data.coupons[index], ...patch, id };
    return data.coupons[index];
  }, { event: 'coupon.updated', payload: { id } });
}

export function toggleCoupon(id) {
  return commit((data) => {
    const coupon = data.coupons.find((item) => item.id === id);
    if (!coupon) throw new HttpError(404, 'Cupom não encontrado.', 'not_found');
    coupon.isActive = !coupon.isActive;
    return coupon;
  }, { event: 'coupon.toggled', payload: { id } });
}

export function deleteCoupon(id) {
  commit((data) => {
    data.coupons = data.coupons.filter((coupon) => coupon.id !== id);
  }, { event: 'coupon.deleted', payload: { id } });
  return { ok: true };
}
