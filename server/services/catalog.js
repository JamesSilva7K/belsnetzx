/**
 *  Catálogo — leitura e manutenção de produtos
 * Nota e número de avaliações são sempre derivados das avaliações reais.
 */
import { db, commit, nextId } from '../lib/db.js';
import { HttpError, assert } from '../lib/errors.js';
import { slugify } from '../lib/format.js';

function reviewStats() {
  const stats = new Map();
  for (const review of db().reviews) {
    const current = stats.get(review.productId) || { sum: 0, count: 0 };
    current.sum += Number(review.rating) || 0;
    current.count += 1;
    stats.set(review.productId, current);
  }
  return stats;
}

export function totalStock(inventory) {
  return Object.values(inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

export function decorate(product, stats) {
  const stat = stats.get(product.id);
  const stock = totalStock(product.inventory);
  return {
    ...product,
    totalStock: stock,
    inStock: stock > 0,
    rating: stat ? Number((stat.sum / stat.count).toFixed(1)) : 0,
    reviewsCount: stat ? stat.count : 0
  };
}

export function listProducts() {
  const stats = reviewStats();
  return db()
    .products.map((product) => decorate(product, stats))
    .sort((a, b) => Number(b.isFeatured) - Number(a.isFeatured) || a.name.localeCompare(b.name, 'pt-BR'));
}

export function getProduct(id) {
  const product = db().products.find((item) => item.id === id);
  if (!product) return null;
  return decorate(product, reviewStats());
}

export function productCategories() {
  return [...new Set(db().products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export function createProduct(input) {
  const name = String(input.name || '').trim();
  assert(name.length >= 2, 400, 'Informe o nome do produto.', 'invalid_name');

  const sizes = Array.isArray(input.sizes) && input.sizes.length ? input.sizes : ['PP', 'P', 'M', 'G', 'GG'];
  const colors = Array.isArray(input.colors) && input.colors.length ? input.colors : [{ name: 'Único', hex: '#DC7898' }];

  const inventory = {};
  const providedInventory = input.inventory && typeof input.inventory === 'object' ? input.inventory : {};
  const defaultStock = Number(input.initialStock ?? 0);
  for (const size of sizes) {
    for (const color of colors) {
      const key = `${size}-${color.name}`;
      inventory[key] = Math.max(0, Number(providedInventory[key] ?? defaultStock));
    }
  }

  const product = {
    id: `prod-${slugify(name).slice(0, 28)}-${Date.now().toString(36).slice(-4)}`,
    name,
    sku: String(input.sku || '').trim() || `FDS-${slugify(name).slice(0, 10).toUpperCase()}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
    category: String(input.category || 'Vestidos').trim(),
    price: Math.max(0, Number(input.price || 0)),
    compareAtPrice: input.compareAtPrice ? Math.max(0, Number(input.compareAtPrice)) : undefined,
    costPrice: Math.max(0, Number(input.costPrice || 0)),
    description: String(input.description || '').trim(),
    fabric: String(input.fabric || '').trim(),
    care: String(input.care || '').trim(),
    images: (Array.isArray(input.images) ? input.images : []).filter(Boolean),
    sizes,
    colors,
    inventory,
    rating: 0,
    reviewsCount: 0,
    isNewArrival: Boolean(input.isNewArrival),
    isBestSeller: Boolean(input.isBestSeller),
    isFeatured: Boolean(input.isFeatured),
    inStock: totalStock(inventory) > 0,
    tags: Array.isArray(input.tags) ? input.tags : []
  };

  commit((data) => {
    data.products.unshift(product);
  }, { event: 'product.created', payload: { id: product.id } });

  return product;
}

export function updateProduct(id, patch) {
  const existing = db().products.find((item) => item.id === id);
  if (!existing) throw new HttpError(404, 'Produto não encontrado.', 'not_found');

  const updated = commit((data) => {
    const target = data.products.find((item) => item.id === id);
    const merged = { ...target, ...patch, id: target.id };
    merged.price = Math.max(0, Number(merged.price || 0));
    merged.costPrice = Math.max(0, Number(merged.costPrice || 0));
    if (merged.inventory) {
      merged.inventory = Object.fromEntries(
        Object.entries(merged.inventory).map(([key, value]) => [key, Math.max(0, Number(value || 0))])
      );
    }
    merged.inStock = totalStock(merged.inventory) > 0;
    data.products = data.products.map((item) => (item.id === id ? merged : item));
    return merged;
  }, { event: 'product.updated', payload: { id } });

  return decorate(updated, reviewStats());
}

export function deleteProduct(id) {
  const exists = db().products.some((item) => item.id === id);
  if (!exists) throw new HttpError(404, 'Produto não encontrado.', 'not_found');
  commit((data) => {
    data.products = data.products.filter((item) => item.id !== id);
  }, { event: 'product.deleted', payload: { id } });
  return { ok: true };
}

export function upsertReview({ productId, customerId, authorName, rating, comment, fitFeedback }) {
  const product = db().products.find((item) => item.id === productId);
  if (!product) throw new HttpError(404, 'Produto não encontrado.', 'not_found');

  const score = Math.min(5, Math.max(1, Number(rating) || 0));
  assert(score > 0, 400, 'Informe uma nota de 1 a 5.', 'invalid_rating');
  assert(String(comment || '').trim().length >= 5, 400, 'Escreva um comentário com pelo menos 5 caracteres.', 'invalid_comment');

  const review = commit((data) => {
    const record = {
      id: nextId('rev'),
      productId,
      customerId: customerId || null,
      userName: String(authorName || 'Cliente').trim(),
      rating: score,
      comment: String(comment).trim().slice(0, 900),
      date: new Date().toISOString(),
      fitFeedback: fitFeedback || 'fiel ao tamanho',
      helpfulCount: 0
    };
    data.reviews.unshift(record);
    return record;
  }, { event: 'review.created', payload: { productId } });

  return review;
}

export function listReviews(productId) {
  const reviews = db().reviews.filter((review) => !productId || review.productId === productId);
  return reviews.sort((a, b) => new Date(b.date) - new Date(a.date));
}
