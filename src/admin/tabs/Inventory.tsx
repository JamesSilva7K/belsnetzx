import React, { useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Boxes,
  Eye,
  Image as ImageIcon,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Tag,
  Trash2,
  TriangleAlert
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import type { Product } from '../../types';
import { useAction, useLoad } from '../useLoad';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  SectionTitle,
  Select,
  Spinner,
  Stat,
  Table,
  Td,
  Textarea,
  Toggle,
  ImageUploader,
  cn,
  formatBRL,
  formatDate,
  useToast
} from '../ui';

/* ------------------------------------------------------------------ *
 * Estoque
 * ------------------------------------------------------------------ */

const REASONS_IN = [
  { value: 'compra_fornecedor', label: 'Compra de fornecedor' },
  { value: 'devolucao', label: 'Devolução de cliente' },
  { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
  { value: 'bonificacao', label: 'Bonificação' },
  { value: 'transferencia', label: 'Transferência' }
];

const REASONS_OUT = [
  { value: 'venda', label: 'Venda' },
  { value: 'perda_avaria', label: 'Perda / avaria' },
  { value: 'ajuste_inventario', label: 'Ajuste de inventário' },
  { value: 'uso_interno', label: 'Uso interno' },
  { value: 'transferencia', label: 'Transferência' }
];

export function StockTab({ liveKey }: { liveKey: number }) {
  const { data, loading, error, reload } = useLoad(() => adminApi.stock(), [liveKey]);
  const movements = useLoad(() => adminApi.movements({ limit: 40 }), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ productId: '', variantKey: '', type: 'entrada' as 'entrada' | 'saida', quantity: '1', reason: 'compra_fornecedor', note: '' });

  const products = data?.products || [];
  const selectedProduct = products.find((product) => product.id === form.productId);
  const variants = Object.keys(selectedProduct?.inventory || {});

  function openMove(productId: string, variantKey: string, type: 'entrada' | 'saida') {
    setForm({
      productId,
      variantKey,
      type,
      quantity: '1',
      reason: type === 'entrada' ? 'compra_fornecedor' : 'ajuste_inventario',
      note: ''
    });
    setOpen(true);
  }

  async function submitMove() {
    const result = await run(async () => {
      await adminApi.moveStock({
        productId: form.productId,
        variantKey: form.variantKey,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason,
        note: form.note
      });
      setOpen(false);
      await Promise.all([reload(), movements.reload()]);
    });
    toast.push(result.ok ? 'Movimento registrado e notificado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  async function quickMove(productId: string, variantKey: string, delta: number) {
    const result = await run(async () => {
      await adminApi.moveStock({
        productId,
        variantKey,
        type: delta > 0 ? 'entrada' : 'saida',
        quantity: Math.abs(delta),
        reason: 'ajuste_inventario',
        note: 'Ajuste rápido pelo painel'
      });
      await Promise.all([reload(), movements.reload()]);
    });
    if (!result.ok) toast.push((result as any).error, 'error');
  }

  if (loading && !data) return <Spinner label="Lendo estoque…" />;
  if (error) return <Card><p className="text-sm text-red-300">{error}</p></Card>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Unidades" value={data?.totals.units ?? 0} />
        <Stat label="Custo do estoque" value={formatBRL(data?.totals.costValue)} />
        <Stat label="Valor de venda" value={formatBRL(data?.totals.saleValue)} tone="good" />
        <Stat label="Variações críticas" value={data?.criticalCount ?? 0} tone={data?.criticalCount ? 'warn' : 'default'} hint={`limite ≤ ${data?.lowStockThreshold} un.`} />
      </div>

      <Card>
        <SectionTitle
          title="Inventário por variação"
          subtitle="cada lançamento gera movimento auditável e alerta no Telegram"
          action={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => openMove(products[0]?.id || '', Object.keys(products[0]?.inventory || {})[0] || '', 'entrada')}>Novo movimento</Button>}
        />
        {products.length === 0 ? (
          <EmptyState title="Nenhum produto cadastrado" description="Cadastre produtos na aba Catálogo para gerenciar o estoque." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {products.map((product: any) => (
              <div key={product.id} className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] p-3.5 shadow-sm hover:border-rose-500/30 transition-all">
                <div className="flex items-start gap-3 mb-2.5">
                  {product.images?.[0] ? (
                    <img src={product.images[0]} alt="" className="h-12 w-12 rounded-xl object-cover border border-[var(--admin-border)] shrink-0 shadow-xs" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/10 dark:bg-white/5 border border-[var(--admin-border)] shrink-0">
                      <ImageIcon className="h-5 w-5 text-stone-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="truncate">
                        <p className="text-sm font-semibold text-[var(--admin-text-main)] truncate">{product.name}</p>
                        <p className="text-[11px] text-[var(--admin-text-subtle)]">{product.sku} · {product.category}</p>
                      </div>
                      <Badge tone={product.total === 0 ? 'bad' : product.critical.length ? 'warn' : 'good'}>
                        {product.total} un.
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-2 space-y-1">
                  {Object.entries(product.inventory).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between rounded-lg bg-black/20 px-2 py-1">
                      <span className="text-[11px] text-stone-400">{key}</span>
                      <div className="flex items-center gap-1">
                        <button
                          className="rounded px-1.5 text-xs text-stone-400 hover:bg-white/10 hover:text-white disabled:opacity-30"
                          disabled={busy || Number(value) <= 0}
                          onClick={() => quickMove(product.id, key, -1)}
                        >
                          −
                        </button>
                        <span className={cn('w-7 text-center text-xs tabular-nums', Number(value) <= (data?.lowStockThreshold || 3) ? 'text-amber-300' : 'text-stone-200')}>
                          {String(value)}
                        </span>
                        <button className="rounded px-1.5 text-xs text-stone-400 hover:bg-white/10 hover:text-white" disabled={busy} onClick={() => quickMove(product.id, key, 1)}>
                          +
                        </button>
                        <button className="ml-1 rounded px-1 text-[10px] text-stone-500 hover:text-rose-300" onClick={() => openMove(product.id, key, 'entrada')}>
                          lançar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle title="Últimos movimentos" subtitle="entradas e saídas reais" />
        {movements.loading && !movements.data ? (
          <Spinner />
        ) : (
          <Table head={['Data', 'Tipo', 'Produto', 'Variação', 'Qtd', 'Saldo', 'Motivo', 'Responsável']} empty={(movements.data?.movements || []).length === 0}>
            {(movements.data?.movements || []).map((movement: any) => (
              <tr key={movement.id} className="hover:bg-white/[0.02]">
                <Td className="text-xs text-stone-500">{formatDate(movement.at)}</Td>
                <Td>
                  <Badge tone={movement.type === 'entrada' ? 'good' : 'warn'}>
                    {movement.type === 'entrada' ? <ArrowDownLeft className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                    {movement.type}
                  </Badge>
                </Td>
                <Td className="text-xs text-stone-300">{movement.productName}</Td>
                <Td className="text-[11px] text-stone-400">{movement.variantKey}</Td>
                <Td className="text-xs text-stone-200">{movement.quantity}</Td>
                <Td className="text-xs text-stone-400">{movement.balanceAfter}</Td>
                <Td className="text-[11px] text-stone-500">{movement.reason}{movement.note ? ` · ${movement.note}` : ''}</Td>
                <Td className="text-[11px] text-stone-500">{movement.actor}</Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Registrar movimento de estoque"
        subtitle="entradas e saídas disparam notificação no Telegram"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={submitMove} disabled={!form.productId || !form.variantKey}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={form.type === 'entrada' ? 'success' : 'outline'} onClick={() => setForm({ ...form, type: 'entrada', reason: 'compra_fornecedor' })}>
              <ArrowDownLeft className="h-3.5 w-3.5" /> Entrada
            </Button>
            <Button size="sm" variant={form.type === 'saida' ? 'danger' : 'outline'} onClick={() => setForm({ ...form, type: 'saida', reason: 'ajuste_inventario' })}>
              <ArrowUpRight className="h-3.5 w-3.5" /> Saída
            </Button>
          </div>
          <Field label="Produto">
            <Select
              value={form.productId}
              onChange={(event) => {
                const product = products.find((entry: any) => entry.id === event.target.value);
                setForm({ ...form, productId: event.target.value, variantKey: Object.keys(product?.inventory || {})[0] || '' });
              }}
            >
              {products.map((product: any) => (
                <option key={product.id} value={product.id}>{product.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Variação">
            <Select value={form.variantKey} onChange={(event) => setForm({ ...form, variantKey: event.target.value })}>
              {variants.map((variant) => (
                <option key={variant} value={variant}>{variant}</option>
              ))}
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantidade">
              <Input type="number" min={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} />
            </Field>
            <Field label="Motivo">
              <Select value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })}>
                {(form.type === 'entrada' ? REASONS_IN : REASONS_OUT).map((reason) => (
                  <option key={reason.value} value={reason.value}>{reason.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Observação (opcional)">
            <Input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
          </Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Catálogo
 * ------------------------------------------------------------------ */

const EMPTY_PRODUCT = {
  name: '',
  sku: '',
  category: 'Vestidos',
  price: '',
  compareAtPrice: '',
  costPrice: '',
  description: '',
  fabric: '',
  care: '',
  images: '',
  sizes: 'PP, P, M, G, GG',
  colors: 'Rosa (#F7B7CA), Marfim (#FFFBF5)',
  initialStock: '0',
  isNewArrival: false,
  isFeatured: false
};

function parseColors(raw: string) {
  return raw
    .split(',')
    .map((entry) => {
      const match = entry.match(/^\s*(.+?)\s*\((#?[0-9a-fA-F]{3,8})\)\s*$/);
      if (match) return { name: match[1], hex: match[2].startsWith('#') ? match[2] : `#${match[2]}` };
      return { name: entry.trim(), hex: '#DC7898' };
    })
    .filter((color) => color.name);
}

export function CatalogTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.products(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<any>(EMPTY_PRODUCT);
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [search, setSearch] = useState('');

  const products = data?.products || [];

  const filteredProducts = products.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term) || p.category.toLowerCase().includes(term);
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_PRODUCT);
    setOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: String(product.price),
      compareAtPrice: product.compareAtPrice ? String(product.compareAtPrice) : '',
      costPrice: String(product.costPrice),
      description: product.description,
      fabric: product.fabric,
      care: product.care,
      images: product.images.join(', '),
      sizes: product.sizes.join(', '),
      colors: product.colors.map((color) => `${color.name} (${color.hex})`).join(', '),
      initialStock: '0',
      isNewArrival: Boolean(product.isNewArrival),
      isFeatured: Boolean(product.isFeatured)
    });
    setOpen(true);
  }

  async function save() {
    const payload = {
      name: form.name,
      sku: form.sku,
      category: form.category,
      price: Number(form.price),
      compareAtPrice: form.compareAtPrice ? Number(form.compareAtPrice) : undefined,
      costPrice: Number(form.costPrice),
      description: form.description,
      fabric: form.fabric,
      care: form.care,
      images: form.images.split(',').map((url: string) => url.trim()).filter(Boolean),
      sizes: form.sizes.split(',').map((size: string) => size.trim()).filter(Boolean),
      colors: parseColors(form.colors),
      initialStock: Number(form.initialStock),
      isNewArrival: form.isNewArrival,
      isFeatured: form.isFeatured
    };

    const result = await run(async () => {
      if (editing) await adminApi.updateProduct(editing.id, payload);
      else await adminApi.createProduct(payload);
      setOpen(false);
      await reload();
    });
    toast.push(result.ok ? (editing ? 'Produto atualizado.' : 'Produto criado.') : (result as any).error, result.ok ? 'success' : 'error');
  }

  async function remove(product: Product) {
    if (!window.confirm(`Remover "${product.name}" do catálogo? Esta ação não afeta pedidos já registrados.`)) return;
    const result = await run(async () => {
      await adminApi.deleteProduct(product.id);
      await reload();
    });
    toast.push(result.ok ? 'Produto removido.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  const previewPhotos = form.images ? form.images.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
  const previewColors = parseColors(form.colors || '');
  const previewSizes = form.sizes ? form.sizes.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--admin-text-main)]">Catálogo de Produtos</h2>
            <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">
              {products.length} produto(s) cadastrados · Fotos de alta definição e estoque real
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Alternador de Visualização Grid / Tabela */}
            <div className="flex items-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-input-bg)] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'grid'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]'
                )}
                title="Visualização em Cards Modernos"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span>Cards</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
                  viewMode === 'table'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]'
                )}
                title="Visualização em Tabela Compacta"
              >
                <List className="h-3.5 w-3.5" />
                <span>Tabela</span>
              </button>
            </div>

            <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={openCreate}>
              Novo produto
            </Button>
          </div>
        </div>

        {loading && products.length === 0 ? (
          <Spinner />
        ) : products.length === 0 ? (
          <EmptyState title="Catálogo vazio" description="Cadastre o primeiro produto para abrir a loja." />
        ) : viewMode === 'grid' ? (
          /* Cards Modernos com Imagens */
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const margin = product.price > 0 ? Math.round(((product.price - (product.costPrice || 0)) / product.price) * 100) : 0;
              return (
                <div
                  key={product.id}
                  className="group relative flex flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] shadow-xs hover:shadow-lg hover:border-rose-500/40 transition-all duration-300 overflow-hidden"
                >
                  {/* Foto Principal */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden bg-black/5 dark:bg-black/20">
                    {product.images?.[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-stone-400">
                        <ImageIcon className="h-10 w-10 stroke-1" />
                      </div>
                    )}

                    {/* Badges de Destaque / Novidade / Categoria */}
                    <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1.5 z-10">
                      <span className="rounded-lg bg-black/60 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white tracking-wide border border-white/10 uppercase">
                        {product.category}
                      </span>
                      {product.isNewArrival && (
                        <span className="rounded-lg bg-rose-500/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          NOVIDADE
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2.5 right-2.5 z-10">
                      <Badge tone={(product.totalStock ?? 0) === 0 ? 'bad' : (product.totalStock ?? 0) <= 3 ? 'warn' : 'good'}>
                        {product.totalStock ?? 0} un.
                      </Badge>
                    </div>

                    {/* Ações Rápidas no Hover */}
                    <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <span className="text-[11px] font-medium text-white/90 truncate">
                        {product.colors?.length || 0} cores • {product.sizes?.length || 0} tam.
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="rounded-lg bg-white/20 backdrop-blur-md p-1.5 text-white hover:bg-white hover:text-black transition-colors"
                          title="Editar produto"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(product)}
                          className="rounded-lg bg-red-600/80 backdrop-blur-md p-1.5 text-white hover:bg-red-500 transition-colors"
                          title="Remover produto"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Informações do Produto */}
                  <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-mono-admin text-[var(--admin-text-subtle)] uppercase tracking-wider">{product.sku}</p>
                        {product.reviewsCount > 0 && (
                          <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-500">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {product.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-sm text-[var(--admin-text-main)] mt-0.5 line-clamp-1" title={product.name}>
                        {product.name}
                      </h3>
                    </div>

                    {/* Cores */}
                    {product.colors && product.colors.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        {product.colors.slice(0, 5).map((c: any, i: number) => (
                          <span
                            key={i}
                            title={c.name}
                            className="h-3.5 w-3.5 rounded-full border border-black/20 shadow-xs"
                            style={{ backgroundColor: c.hex || '#ccc' }}
                          />
                        ))}
                        {product.colors.length > 5 && (
                          <span className="text-[10px] text-[var(--admin-text-subtle)] font-medium">+{product.colors.length - 5}</span>
                        )}
                      </div>
                    )}

                    {/* Preços e Margem */}
                    <div className="pt-2 border-t border-[var(--admin-border)] flex items-end justify-between">
                      <div>
                        <p className="text-base font-bold text-rose-500 dark:text-rose-400 tracking-tight">
                          {formatBRL(product.price)}
                        </p>
                        {product.compareAtPrice ? (
                          <p className="text-[11px] text-[var(--admin-text-subtle)] line-through">
                            {formatBRL(product.compareAtPrice)}
                          </p>
                        ) : (
                          <p className="text-[11px] text-[var(--admin-text-subtle)]">
                            Custo: {formatBRL(product.costPrice)}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="inline-block rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.5 text-[10px] font-semibold">
                          Margem {margin}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Tabela Compacta */
          <Table head={['Produto', 'Categoria', 'Preço', 'Custo', 'Estoque', 'Avaliações', '']} empty={false}>
            {filteredProducts.map((product) => (
              <tr key={product.id} className="hover:bg-white/[0.02]">
                <Td>
                  <div className="flex items-center gap-2.5">
                    {product.images?.[0] ? (
                      <img src={product.images[0]} alt="" className="h-10 w-10 rounded-xl object-cover border border-[var(--admin-border)] shadow-xs" />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5"><ImageIcon className="h-4 w-4 text-stone-600" /></div>
                    )}
                    <div>
                      <p className="text-sm font-semibold text-[var(--admin-text-main)]">{product.name}</p>
                      <p className="text-[11px] text-[var(--admin-text-subtle)]">{product.sku}</p>
                    </div>
                  </div>
                </Td>
                <Td className="text-xs text-[var(--admin-text-muted)]">{product.category}</Td>
                <Td className="text-sm font-semibold text-[var(--admin-text-main)]">{formatBRL(product.price)}</Td>
                <Td className="text-xs text-[var(--admin-text-muted)]">{formatBRL(product.costPrice)}</Td>
                <Td>
                  <Badge tone={(product.totalStock ?? 0) === 0 ? 'bad' : (product.totalStock ?? 0) <= 3 ? 'warn' : 'good'}>
                    {product.totalStock ?? 0} un.
                  </Badge>
                </Td>
                <Td className="text-xs text-[var(--admin-text-muted)]">
                  {product.reviewsCount > 0 ? (
                    <span className="flex items-center gap-1 text-amber-500 font-semibold">
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                      {product.rating.toFixed(1)} ({product.reviewsCount})
                    </span>
                  ) : '—'}
                </Td>
                <Td>
                  <div className="flex gap-1">
                    <button className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-[var(--admin-item-hover)] hover:text-[var(--admin-text-main)]" onClick={() => openEdit(product)}><Pencil className="h-3.5 w-3.5" /></button>
                    <button className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-red-500/10 hover:text-red-500" onClick={() => remove(product)}><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? 'Editar produto' : 'Novo produto'}
        subtitle="Configure preços, galeria de fotos, variantes e visualize o preview ao vivo para os leads"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={save} disabled={!form.name || !form.price}>Salvar produto</Button>
          </>
        }
      >
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Formulário (7 colunas) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] p-4 space-y-3">
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Identificação</p>
              <Field label="Nome da Peça"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Ex: Vestido Longo Plissado Romantique" /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="SKU (opcional)"><Input value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="FDS-VES-001" /></Field>
                <Field label="Categoria"><Input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} placeholder="Ex: Vestidos" /></Field>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] p-4 space-y-3">
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Preços & Custos</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Preço de venda"><Input type="number" step="0.01" value={form.price} onChange={(event) => setForm({ ...form, price: event.target.value })} placeholder="299.90" /></Field>
                <Field label="Preço de R$"><Input type="number" step="0.01" value={form.compareAtPrice} onChange={(event) => setForm({ ...form, compareAtPrice: event.target.value })} placeholder="359.90" /></Field>
                <Field label="Custo da peça"><Input type="number" step="0.01" value={form.costPrice} onChange={(event) => setForm({ ...form, costPrice: event.target.value })} placeholder="110.00" /></Field>
              </div>
              {!editing ? <Field label="Estoque inicial por variação"><Input type="number" min={0} value={form.initialStock} onChange={(event) => setForm({ ...form, initialStock: event.target.value })} /></Field> : null}
            </div>

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] p-4 space-y-3">
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Fotos do Produto</p>
              <ImageUploader
                label="Anexar Fotos (Arquivo, Arrastar, Print Ctrl+V ou Link)"
                hint="Anexe fotos em alta resolução para exibição aos leads"
                value=""
                onChange={(val) => {
                  if (!val) return;
                  const current = form.images ? form.images.split(',').map((u: string) => u.trim()).filter(Boolean) : [];
                  setForm({ ...form, images: [...current, val].join(', ') });
                  toast.push('Foto anexada!', 'success');
                }}
              />

              {previewPhotos.length > 0 && (
                <div className="space-y-1.5 pt-2">
                  <p className="text-[11px] font-medium text-[var(--admin-text-subtle)]">Fotos da Galeria ({previewPhotos.length}):</p>
                  <div className="flex gap-2 flex-wrap">
                    {previewPhotos.map((imgUrl: string, idx: number) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-[var(--admin-border)] bg-black/20 shadow-xs">
                        <img src={imgUrl} alt="" className="h-16 w-16 object-cover" />
                        <button
                          type="button"
                          onClick={() => {
                            const list = [...previewPhotos];
                            list.splice(idx, 1);
                            setForm({ ...form, images: list.join(', ') });
                          }}
                          className="absolute top-1 right-1 rounded-full bg-red-600 text-white p-1 hover:bg-red-500 shadow-md transition-colors"
                          title="Remover foto"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] p-4 space-y-3">
              <p className="text-xs font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wider">Variações & Detalhes</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tamanhos (separados por vírgula)"><Input value={form.sizes} onChange={(event) => setForm({ ...form, sizes: event.target.value })} placeholder="PP, P, M, G, GG" /></Field>
                <Field label="Cores (Nome e Hex)"><Input value={form.colors} onChange={(event) => setForm({ ...form, colors: event.target.value })} placeholder="Rosa (#F9D5E5), Champagne (#F7E7CE)" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tecido"><Input value={form.fabric} onChange={(event) => setForm({ ...form, fabric: event.target.value })} placeholder="Chiffon de Seda Toque Nobre" /></Field>
                <Field label="Cuidados"><Input value={form.care} onChange={(event) => setForm({ ...form, care: event.target.value })} placeholder="Lavagem delicada à mão" /></Field>
              </div>
              <Field label="Descrição"><Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Descreva os diferenciais da peça para a cliente..." /></Field>
              <div className="flex items-center gap-4 pt-1">
                <Toggle checked={form.isNewArrival} onChange={(value) => setForm({ ...form, isNewArrival: value })} label="Marcar como Novidade" />
                <Toggle checked={form.isFeatured} onChange={(value) => setForm({ ...form, isFeatured: value })} label="Destacar na Home" />
              </div>
            </div>
          </div>

          {/* Coluna da Direita: Preview em Tempo Real da Visão do Lead (5 colunas) */}
          <div className="lg:col-span-5">
            <div className="sticky top-2 rounded-2xl border border-rose-500/30 bg-gradient-to-b from-[#15151c] to-[#0d0d12] p-4 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-rose-500/20 pb-3">
                <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
                  <Eye className="h-4 w-4" />
                  Preview ao Vivo do Lead
                </span>
                <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
                  Sincronizado
                </span>
              </div>

              {/* Card da Loja */}
              <div className="rounded-2xl border border-white/10 bg-white dark:bg-stone-900 shadow-md overflow-hidden text-stone-900 dark:text-stone-100">
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-stone-100 dark:bg-stone-800">
                  {previewPhotos[0] ? (
                    <img src={previewPhotos[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-stone-400">
                      <ImageIcon className="h-12 w-12 stroke-1" />
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 flex flex-wrap gap-1">
                    <span className="rounded-md bg-stone-900/80 backdrop-blur-md px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                      {form.category || 'Categoria'}
                    </span>
                    {form.isNewArrival && (
                      <span className="rounded-md bg-rose-500 px-2 py-0.5 text-[9px] font-bold text-white uppercase tracking-wider">
                        Novidade
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-3.5 space-y-2">
                  <p className="font-semibold text-sm line-clamp-1 text-stone-900 dark:text-stone-100">
                    {form.name || 'Nome do Vestido / Peça'}
                  </p>

                  <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold text-rose-600 dark:text-rose-400">
                      {form.price ? formatBRL(Number(form.price)) : 'R$ 0,00'}
                    </span>
                    {form.compareAtPrice ? (
                      <span className="text-xs text-stone-400 line-through">
                        {formatBRL(Number(form.compareAtPrice))}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    em até 3x de {form.price ? formatBRL(Number(form.price) / 3) : 'R$ 0,00'} sem juros
                  </p>

                  {/* Cores */}
                  {previewColors.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      {previewColors.map((c: any, i: number) => (
                        <span
                          key={i}
                          title={c.name}
                          className="h-3 w-3 rounded-full border border-black/20 shadow-xs"
                          style={{ backgroundColor: c.hex }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Tamanhos */}
                  {previewSizes.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap pt-1">
                      {previewSizes.map((s: string, i: number) => (
                        <span key={i} className="rounded border border-stone-200 dark:border-stone-700 px-1.5 py-0.5 text-[9px] font-medium text-stone-600 dark:text-stone-300">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="pt-2">
                    <button
                      type="button"
                      disabled
                      className="w-full rounded-xl bg-rose-500 py-2 text-center text-xs font-semibold text-white shadow-sm"
                    >
                      Comprar Agora
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Cupons
 * ------------------------------------------------------------------ */

export function CouponsTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.coupons(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    minPurchase: '',
    maxUses: '',
    validUntil: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    description: ''
  });

  async function create() {
    const result = await run(async () => {
      await adminApi.createCoupon({
        code: form.code.toUpperCase(),
        discountType: form.discountType,
        discountValue: Number(form.discountValue),
        minPurchase: form.minPurchase ? Number(form.minPurchase) : 0,
        maxUses: form.maxUses ? Number(form.maxUses) : undefined,
        validUntil: form.validUntil,
        description: form.description
      });
      setOpen(false);
      setForm({ ...form, code: '', discountValue: '', minPurchase: '', maxUses: '', description: '' });
      await reload();
    });
    toast.push(result.ok ? 'Cupom criado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Cupons"
          subtitle="validação real de data, valor mínimo, escopo e limite de uso"
          action={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>Novo cupom</Button>}
        />
        {loading && !data ? (
          <Spinner />
        ) : (
          <Table head={['Código', 'Desconto', 'Mínimo', 'Usos', 'Validade', 'Status', '']} empty={(data?.coupons || []).length === 0}>
            {(data?.coupons || []).map((coupon) => (
              <tr key={coupon.id} className="hover:bg-white/[0.02]">
                <Td className="font-mono-admin text-xs text-rose-300">{coupon.code}</Td>
                <Td className="text-sm text-stone-200">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : formatBRL(coupon.discountValue)}</Td>
                <Td className="text-xs text-stone-400">{formatBRL(coupon.minPurchase)}</Td>
                <Td className="text-xs text-stone-400">{coupon.usedCount}{coupon.maxUses ? `/${coupon.maxUses}` : ''}</Td>
                <Td className="text-xs text-stone-400">{coupon.validUntil}</Td>
                <Td><Badge tone={coupon.isActive ? 'good' : 'neutral'}>{coupon.isActive ? 'ativo' : 'inativo'}</Badge></Td>
                <Td>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" loading={busy} onClick={async () => { await adminApi.toggleCoupon(coupon.id); await reload(); }}>Alternar</Button>
                    <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-500/10 hover:text-red-300" onClick={async () => { await adminApi.deleteCoupon(coupon.id); await reload(); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo cupom"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={create} disabled={!form.code || !form.discountValue}>Criar cupom</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Código"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })} placeholder="BEMVINDA10" /></Field>
          <Field label="Tipo">
            <Select value={form.discountType} onChange={(event) => setForm({ ...form, discountType: event.target.value })}>
              <option value="percentage">Percentual</option>
              <option value="fixed">Valor fixo</option>
            </Select>
          </Field>
          <Field label={form.discountType === 'percentage' ? 'Desconto (%)' : 'Desconto (R$)'}>
            <Input type="number" value={form.discountValue} onChange={(event) => setForm({ ...form, discountValue: event.target.value })} />
          </Field>
          <Field label="Compra mínima (R$)"><Input type="number" value={form.minPurchase} onChange={(event) => setForm({ ...form, minPurchase: event.target.value })} /></Field>
          <Field label="Limite de usos"><Input type="number" value={form.maxUses} onChange={(event) => setForm({ ...form, maxUses: event.target.value })} /></Field>
          <Field label="Válido até"><Input type="date" value={form.validUntil} onChange={(event) => setForm({ ...form, validUntil: event.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Descrição"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field></div>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Banners
 * ------------------------------------------------------------------ */

export function BannersTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.banners(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ badge: '', title: '', subtitle: '', ctaText: 'Ver coleção', imageUrl: '', categoryFilter: 'Vestidos', active: true });

  async function create() {
    const result = await run(async () => {
      await adminApi.createBanner({ ...form });
      setOpen(false);
      await reload();
    });
    toast.push(result.ok ? 'Banner criado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  const banners = data?.banners || [];

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle
          title="Banners da vitrine"
          subtitle="conteúdo exibido no carrossel da home"
          action={<Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>Novo banner</Button>}
        />
        {loading && banners.length === 0 ? (
          <Spinner />
        ) : banners.length === 0 ? (
          <EmptyState title="Nenhum banner" description="O carrossel usa apenas conteúdo real cadastrado aqui." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {banners.map((banner) => (
              <div key={banner.id} className="overflow-hidden rounded-xl border border-[#26262e]">
                {banner.imageUrl ? <img src={banner.imageUrl} alt="" className="h-32 w-full object-cover" /> : null}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <Badge tone={banner.active ? 'good' : 'neutral'}>{banner.active ? 'ativo' : 'inativo'}</Badge>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={async () => { await adminApi.updateBanner(banner.id, { active: !banner.active }); await reload(); }}>Alternar</Button>
                      <button className="rounded-lg p-1.5 text-stone-400 hover:bg-red-500/10 hover:text-red-300" onClick={async () => { await adminApi.deleteBanner(banner.id); await reload(); }}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-stone-200">{banner.title}</p>
                  <p className="text-[11px] text-stone-500">{banner.subtitle}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo banner"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={create} disabled={!form.title}>Criar</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Selo"><Input value={form.badge} onChange={(event) => setForm({ ...form, badge: event.target.value })} /></Field>
          <Field label="Título"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <div className="sm:col-span-2"><Field label="Subtítulo"><Input value={form.subtitle} onChange={(event) => setForm({ ...form, subtitle: event.target.value })} /></Field></div>
          <Field label="Texto do botão"><Input value={form.ctaText} onChange={(event) => setForm({ ...form, ctaText: event.target.value })} /></Field>
          <Field label="Categoria"><Input value={form.categoryFilter} onChange={(event) => setForm({ ...form, categoryFilter: event.target.value })} /></Field>
          <div className="sm:col-span-2">
            <ImageUploader
              label="Imagem do Banner"
              hint="Anexe o banner promocional do computador, arraste, cole print (Ctrl+V) ou coloque a URL"
              value={form.imageUrl}
              onChange={(val) => setForm({ ...form, imageUrl: val })}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
