/**
 * Estoque real — entradas, saídas e histórico auditável.
 * Cada movimento altera o inventário por variação e gera notificação no Telegram.
 */
import { config } from '../config.js';
import { commit, db, nextId } from '../lib/db.js';
import { HttpError, assert } from '../lib/errors.js';
import { brl, nowIso } from '../lib/format.js';
import { notify } from './notify.js';

const REASONS = {
 entrada: ['compra_fornecedor', 'devolucao', 'ajuste_inventario', 'bonificacao', 'transferencia'],
 saida: ['venda', 'perda_avaria', 'ajuste_inventario', 'uso_interno', 'transferencia']
};

export const REASON_LABELS = {
 compra_fornecedor: 'Compra de fornecedor',
 devolucao: 'Devolução de cliente',
 ajuste_inventario: 'Ajuste de inventário',
 bonificacao: 'Bonificação',
 transferencia: 'Transferência',
 venda: 'Venda',
 perda_avaria: 'Perda / avaria',
 uso_interno: 'Uso interno',
 estorno: 'Estorno de pedido'
};

export function moveStock({ productId, variantKey, type, quantity, reason, note, actor, silent = false }) {
 assert(type === 'entrada' || type === 'saida', 400, 'Tipo de movimento inválido (entrada ou saida).', 'invalid_type');
 const qty = Math.trunc(Number(quantity));
 assert(Number.isFinite(qty) && qty > 0, 400, 'Informe uma quantidade inteira maior que zero.', 'invalid_quantity');
 assert(REASONS[type].includes(reason), 400, `Motivo inválido para ${type}.`, 'invalid_reason');

 const product = db().products.find((item) => item.id === productId);
 if (!product) throw new HttpError(404, 'Produto não encontrado.', 'not_found');

 const current = Number(product.inventory?.[variantKey] ?? 0);
 if (variantKey && !(variantKey in (product.inventory || {}))) {
 throw new HttpError(404, `A variação "${variantKey}" não existe neste produto.`, 'variant_not_found');
 }
 if (type === 'saida' && qty > current) {
 throw new HttpError(409, `Estoque insuficiente: ${variantKey} tem ${current} unidade(s).`, 'insufficient_stock');
 }

 const balanceAfter = type === 'entrada' ? current + qty : current - qty;

 const result = commit((data) => {
 const target = data.products.find((item) => item.id === productId);
 target.inventory = { ...target.inventory, [variantKey]: balanceAfter };
 target.inStock = Object.values(target.inventory).reduce((sum, value) => sum + Number(value || 0), 0) > 0;

 const movement = {
 id: nextId('mov'),
 at: nowIso(),
 productId,
 productName: target.name,
 sku: target.sku,
 variantKey,
 type,
 quantity: qty,
 reason,
 note: String(note || '').trim(),
 actor: actor || 'painel',
 balanceAfter,
 unitCost: Number(target.costPrice || 0)
 };
 data.stockMovements.unshift(movement);
 if (data.stockMovements.length > 4000) data.stockMovements.length = 4000;
 if (type === 'entrada') data.counters.stockIn += qty;
 else data.counters.stockOut += qty;
 return movement;
 }, { event: 'stock.moved', payload: { productId, type, quantity: qty } });

 if (!silent) {
 const isIn = type === 'entrada';
 notify({
 type: isIn ? 'stock_in' : 'stock_out',
 title: `${isIn ? ' Entrada' : ' Saída'} de estoque — ${product.name}`,
 detail: `${qty} un. em ${variantKey} • ${REASON_LABELS[reason] || reason} • saldo ${balanceAfter}`,
 severity: isIn ? 'success' : 'info',
 meta: {
 movementId: result.id,
 productId,
 productName: product.name,
 variantKey,
 quantity: qty,
 reason,
 reasonLabel: REASON_LABELS[reason] || reason,
 actor: actor || 'painel',
 balanceAfter,
 unitCost: Number(product.costPrice || 0),
 note: String(note || '').trim()
 }
 });

 if (balanceAfter <= config.lowStockThreshold) {
 notify({
 type: 'low_stock',
 title: ` Estoque baixo — ${product.name}`,
 detail: `${variantKey} com apenas ${balanceAfter} unidade(s).`,
 severity: 'warning',
 meta: {
 productId,
 productName: product.name,
 variantKey,
 balanceAfter,
 threshold: config.lowStockThreshold,
 costPrice: Number(product.costPrice || 0),
 price: Number(product.price || 0),
 stockValue: brl(balanceAfter * Number(product.costPrice || 0))
 }
 });
 }
 }

 return result;
}

export function listMovements({ limit = 100, productId = null, type = null } = {}) {
 return db()
 .stockMovements.filter((movement) => (!productId || movement.productId === productId) && (!type || movement.type === type))
 .slice(0, Math.min(500, Math.max(1, Number(limit) || 100)));
}

export function stockOverview() {
 const data = db();
 const products = data.products.map((product) => {
 const total = Object.values(product.inventory || {}).reduce((sum, value) => sum + Number(value || 0), 0);
 const costValue = total * Number(product.costPrice || 0);
 const saleValue = total * Number(product.price || 0);
 const critical = Object.entries(product.inventory || {})
 .filter(([, value]) => Number(value) <= config.lowStockThreshold)
 .map(([key, value]) => ({ variantKey: key, stock: Number(value) }));
 return {
 id: product.id,
 name: product.name,
 sku: product.sku,
 category: product.category,
 total,
 costValue,
 saleValue,
 inventory: product.inventory,
 critical
 };
 });

 const totals = products.reduce(
 (acc, product) => {
 acc.units += product.total;
 acc.costValue += product.costValue;
 acc.saleValue += product.saleValue;
 return acc;
 },
 { units: 0, costValue: 0, saleValue: 0 }
 );

 return {
 products: products.sort((a, b) => b.saleValue - a.saleValue),
 totals,
 criticalCount: products.reduce((sum, product) => sum + product.critical.length, 0),
 lowStockThreshold: config.lowStockThreshold
 };
}
