/**
 *  Configurações da loja (identidade visual, gateway Pix, frete e banners).
 */
import { commit, db, nextId } from '../lib/db.js';
import { HttpError } from '../lib/errors.js';
import { nowIso } from '../lib/format.js';

function deepMerge(base, patch) {
  const output = { ...base };
  for (const [key, value] of Object.entries(patch || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value) && base?.[key] && typeof base[key] === 'object') {
      output[key] = deepMerge(base[key], value);
    } else {
      output[key] = value;
    }
  }
  return output;
}

export function getSettings() {
  return db().settings;
}

export function publicSettings() {
  const { customization, gateway, shipping, paymentMethods } = db().settings;
  return {
    customization,
    shipping,
    paymentMethods: paymentMethods || [],
    pix: {
      configured: Boolean(gateway.pixKey || gateway.syncpay?.enabled),
      keyType: gateway.pixKeyType,
      discountForPixPercent: Number(gateway.discountForPixPercent || 0),
      maxInstallmentsWithoutInterest: Number(gateway.maxInstallmentsWithoutInterest || 1)
    }
  };
}

export function updateCustomization(patch) {
  return commit((data) => {
    data.settings.customization = deepMerge(data.settings.customization, patch);
    return data.settings.customization;
  }, { event: 'settings.customization', payload: {} });
}

export function updatePaymentMethods(list) {
  return commit((data) => {
    data.settings.paymentMethods = Array.isArray(list) ? list : data.settings.paymentMethods;
    return data.settings.paymentMethods;
  }, { event: 'settings.paymentMethods', payload: {} });
}

export function updateGateway(patch) {
  return commit((data) => {
    data.settings.gateway = deepMerge(data.settings.gateway, patch);
    return data.settings.gateway;
  }, { event: 'settings.gateway', payload: {} });
}

export function updateShipping(patch) {
  return commit((data) => {
    data.settings.shipping = deepMerge(data.settings.shipping, patch);
    return data.settings.shipping;
  }, { event: 'settings.shipping', payload: {} });
}

export function listBanners({ onlyActive = false } = {}) {
  return db()
    .banners.filter((banner) => (onlyActive ? banner.active : true))
    .slice()
    .sort((a, b) => Number(b.active) - Number(a.active));
}

export function createBanner(input) {
  if (!String(input.title || '').trim()) throw new HttpError(400, 'Informe o título do banner.', 'invalid_title');
  const banner = {
    id: nextId('ban'),
    badge: String(input.badge || '').trim(),
    title: String(input.title).trim(),
    subtitle: String(input.subtitle || '').trim(),
    ctaText: String(input.ctaText || 'Ver coleção').trim(),
    categoryFilter: input.categoryFilter || undefined,
    imageUrl: String(input.imageUrl || '').trim(),
    alignment: ['left', 'center', 'right'].includes(input.alignment) ? input.alignment : 'left',
    active: input.active !== false,
    createdAt: nowIso()
  };
  commit((data) => {
    data.banners.push(banner);
  }, { event: 'banner.created', payload: { id: banner.id } });
  return banner;
}

export function updateBanner(id, patch) {
  return commit((data) => {
    const index = data.banners.findIndex((banner) => banner.id === id);
    if (index < 0) throw new HttpError(404, 'Banner não encontrado.', 'not_found');
    data.banners[index] = { ...data.banners[index], ...patch, id };
    return data.banners[index];
  }, { event: 'banner.updated', payload: { id } });
}

export function deleteBanner(id) {
  commit((data) => {
    data.banners = data.banners.filter((banner) => banner.id !== id);
  }, { event: 'banner.deleted', payload: { id } });
  return { ok: true };
}
