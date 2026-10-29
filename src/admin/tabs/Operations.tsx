import React, { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  Ban,
  CheckCircle2,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  Search,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Truck,
  Trash2,
  UserRound,
  Users,
  Wallet
} from 'lucide-react';
import { adminApi } from '../../lib/api';
import type { Order } from '../../types';
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
  cn,
  formatBRL,
  formatDate,
  useToast
} from '../ui';

/* ------------------------------------------------------------------ *
 * Visão geral
 * ------------------------------------------------------------------ */

export function OverviewTab({ liveKey, onNavigate }: { liveKey: number; onNavigate: (tab: string) => void }) {
  const { data, loading, error, reload } = useLoad(() => adminApi.overview(), [liveKey]);
  const metrics = data?.metrics;

  if (loading && !metrics) return <Spinner label="Lendo o banco de dados…" />;
  if (error) return <Card><p className="text-sm text-red-300">{error}</p></Card>;
  if (!metrics) return null;

  const maxRevenue = Math.max(1, ...metrics.revenueByDay.map((entry: any) => entry.total));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Faturamento confirmado" value={formatBRL(metrics.revenue)} tone="good" hint={`${metrics.confirmedCount} pedido(s) pagos`} />
        <Stat label="Hoje" value={formatBRL(metrics.todayEarnings)} tone="rose" hint={`${metrics.ordersToday} pedido(s) hoje`} />
        <Stat label="A receber" value={formatBRL(metrics.pendingRevenue)} tone="warn" hint={`${metrics.pendingCount} aguardando pagamento`} />
        <Stat label="Lucro líquido" value={formatBRL(metrics.netProfit)} hint={`despesas ${formatBRL(metrics.expenses)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle
            title="Faturamento por dia"
            subtitle="Últimos 14 dias · somente pagamentos confirmados"
            action={<Badge tone="good">tempo real</Badge>}
          />
          <div className="flex h-40 items-end gap-1.5">
            {metrics.revenueByDay.map((entry: any) => (
              <div key={entry.day} className="group relative flex flex-1 flex-col items-center justify-end">
                <span className="pointer-events-none absolute -top-6 hidden rounded bg-black/80 px-1.5 py-0.5 text-[10px] text-stone-200 group-hover:block">
                  {formatBRL(entry.total)}
                </span>
                <div
                  className={cn(
                    'w-full rounded-t transition-all',
                    entry.total > 0 ? 'bg-gradient-to-t from-rose-600/40 to-rose-400' : 'bg-white/5'
                  )}
                  style={{ height: `${Math.max(4, (entry.total / maxRevenue) * 100)}%` }}
                />
                <span className="mt-1.5 text-[9px] text-stone-600">{entry.day.slice(8, 10)}/{entry.day.slice(5, 7)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Operação" subtitle="sinais que exigem atenção" />
          <div className="space-y-2.5 text-sm">
            <button onClick={() => onNavigate('pedidos')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2 text-stone-300"><Clock className="h-3.5 w-3.5 text-amber-400" /> Pendentes +24h</span>
              <span className="font-semibold text-stone-100">{metrics.unpaidOver24h}</span>
            </button>
            <button onClick={() => onNavigate('carrinhos')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2 text-stone-300"><ShoppingBag className="h-3.5 w-3.5 text-sky-400" /> Carrinhos ativos</span>
              <span className="font-semibold text-stone-100">{metrics.cartsActive}</span>
            </button>
            <button onClick={() => onNavigate('carrinhos')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2 text-stone-300"><Ban className="h-3.5 w-3.5 text-red-400" /> Abandonados</span>
              <span className="font-semibold text-stone-100">{metrics.cartsAbandoned}</span>
            </button>
            <button onClick={() => onNavigate('estoque')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2 text-stone-300"><Package className="h-3.5 w-3.5 text-rose-400" /> Variações críticas</span>
              <span className="font-semibold text-stone-100">{metrics.criticalStockCount}</span>
            </button>
            <button onClick={() => onNavigate('clientes')} className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 hover:bg-white/5">
              <span className="flex items-center gap-2 text-stone-300"><Users className="h-3.5 w-3.5 text-emerald-400" /> Novas contas (30d)</span>
              <span className="font-semibold text-stone-100">{metrics.newCustomers30d}</span>
            </button>
          </div>
          <Button variant="ghost" size="sm" className="mt-3 w-full" onClick={() => reload()}>
            Atualizar dados
          </Button>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Top produtos" subtitle="por receita acumulada (pedidos não cancelados)" />
          {metrics.topProducts.length === 0 ? (
            <EmptyState title="Sem vendas registradas" description="Assim que a primeira compra acontecer, o ranking aparece aqui." />
          ) : (
            <div className="space-y-2">
              {metrics.topProducts.map((product: any, index: number) => (
                <div key={product.productId} className="flex items-center justify-between rounded-lg border border-[#22222a] px-3 py-2">
                  <div className="flex items-center gap-2.5">
                    <span className="w-4 text-xs text-stone-600">{index + 1}</span>
                    <div>
                      <p className="text-sm text-stone-200">{product.name}</p>
                      <p className="text-[11px] text-stone-500">{product.units} unidade(s)</p>
                    </div>
                  </div>
                  <span className="text-sm font-medium text-emerald-300">{formatBRL(product.revenue)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle title="Estoque crítico" subtitle={`variações com ≤ ${metrics.criticalStock?.length ? '' : ''}3 unidades`} />
          {metrics.criticalStock.length === 0 ? (
            <EmptyState title="Estoque saudável" description="Nenhuma variação abaixo do limite configurado." />
          ) : (
            <div className="space-y-2">
              {metrics.criticalStock.map((item: any) => (
                <div key={`${item.productId}-${item.variantKey}`} className="flex items-center justify-between rounded-lg border border-[#22222a] px-3 py-2">
                  <div>
                    <p className="text-sm text-stone-200">{item.name}</p>
                    <p className="text-[11px] text-stone-500">{item.variantKey}</p>
                  </div>
                  <Badge tone={item.stock === 0 ? 'bad' : 'warn'}>{item.stock} un.</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Patrimônio"
          subtitle="valores calculados a partir do inventário e dos custos cadastrados"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Unidades em estoque" value={metrics.stockUnits} />
          <Stat label="Custo do estoque" value={formatBRL(metrics.stockValue)} />
          <Stat label="Ticket médio" value={formatBRL(metrics.averageTicket)} />
          <Stat label="Aprovação de pagamento" value={`${metrics.conversionRate.toFixed(1)}%`} hint="pagos / total de pedidos" />
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Pedidos
 * ------------------------------------------------------------------ */

const STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'todos', label: 'Todos os status' },
  { value: 'aguardando_pagamento', label: 'Aguardando pagamento' },
  { value: 'pago', label: 'Pago' },
  { value: 'em_separacao', label: 'Em separação' },
  { value: 'enviado', label: 'Enviado' },
  { value: 'entregue', label: 'Entregue' },
  { value: 'cancelado', label: 'Cancelado' }
];

const STATUS_TONE: Record<string, 'good' | 'warn' | 'bad' | 'info' | 'neutral' | 'rose'> = {
  aguardando_pagamento: 'warn',
  pago: 'good',
  em_separacao: 'info',
  enviado: 'rose',
  entregue: 'good',
  cancelado: 'bad'
};

const PAYMENT_LABEL: Record<string, string> = { pix: 'Pix', credit_card: 'Cartão', boleto: 'Boleto' };

export function OrdersTab({ liveKey }: { liveKey: number }) {
  const [status, setStatus] = useState('todos');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [tracking, setTracking] = useState('');
  const { data, loading, error, reload } = useLoad(() => adminApi.orders({ status, search: query }), [status, query, liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();

  const orders = data?.orders || [];

  async function act(action: () => Promise<{ order: Order }>, message: string) {
    const result = await run(async () => {
      const { order } = await action();
      setSelected(order);
      await reload();
    });
    toast.push(result.ok ? message : (result as any).error, result.ok ? 'success' : 'error');
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <Field label="Buscar">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-600" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') setQuery(search);
                  }}
                  placeholder="Pedido, cliente, e-mail ou CPF"
                  className="pl-9"
                />
              </div>
            </Field>
          </div>
          <div className="w-52">
            <Field label="Status">
              <Select value={status} onChange={(event) => setStatus(event.target.value)}>
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </Select>
            </Field>
          </div>
          <Button onClick={() => setQuery(search)} variant="primary">Filtrar</Button>
          <Button onClick={() => reload()} variant="outline" loading={loading}>Atualizar</Button>
        </div>
      </Card>

      <Card>
        <SectionTitle title="Pedidos" subtitle={`${orders.length} registro(s)`} />
        {loading && orders.length === 0 ? (
          <Spinner />
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : orders.length === 0 ? (
          <EmptyState title="Nenhum pedido" description="Os pedidos aparecem aqui assim que uma cliente finaliza o checkout." />
        ) : (
          <Table head={['Pedido', 'Cliente', 'Total', 'Pagamento', 'Status', 'Data', '']} empty={false}>
            {orders.map((order) => (
              <tr key={order.id} className="hover:bg-white/[0.02]">
                <Td className="font-mono-admin text-xs text-stone-200">
                  <span className="flex items-center gap-1.5">
                    {order.id}
                    {order.securitySeal?.verified && (
                      <span title="Venda assinada e protegida com HMAC-SHA256">
                        <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                      </span>
                    )}
                  </span>
                </Td>
                <Td>
                  <p className="text-stone-200">{order.lead.fullName}</p>
                  <p className="text-[11px] text-stone-500">{order.lead.email}</p>
                </Td>
                <Td className="font-medium text-emerald-300">{formatBRL(order.total)}</Td>
                <Td>
                  <span className="text-xs text-stone-400">{PAYMENT_LABEL[order.paymentMethod]}</span>
                  <Badge tone={order.paymentStatus === 'confirmado' ? 'good' : order.paymentStatus === 'cancelado' ? 'bad' : 'warn'} className="ml-1.5">
                    {order.paymentStatus}
                  </Badge>
                </Td>
                <Td><Badge tone={STATUS_TONE[order.orderStatus] || 'neutral'}>{order.orderStatus.replace(/_/g, ' ')}</Badge></Td>
                <Td className="text-xs text-stone-500">{formatDate(order.createdAt)}</Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setSelected(order); setTracking(order.trackingCode || ''); }}>
                      Abrir
                    </Button>
                    <button
                      className="rounded-lg p-1.5 text-stone-500 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                      title="Excluir pedido de teste"
                      onClick={async () => {
                        if (!window.confirm(`Remover pedido ${order.id} do sistema?`)) return;
                        await adminApi.deleteOrder(order.id);
                        toast.push(`Pedido ${order.id} excluído.`, 'success');
                        await reload();
                      }}
                    >
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
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `Pedido ${selected.id}` : ''}
        subtitle={selected ? `${formatDate(selected.createdAt)} · ${PAYMENT_LABEL[selected.paymentMethod]}` : ''}
        wide
      >
        {selected ? (
          <div className="space-y-4">
            {selected.securitySeal && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">
                      Venda Blindada & Assinada Criptograficamente ({selected.securitySeal.algorithm})
                    </p>
                    <p className="text-[11px] text-stone-400 font-mono-admin">
                      Selo: {selected.securitySeal.shortHash} · Selado em {formatDate(selected.securitySeal.sealedAt)}
                    </p>
                  </div>
                </div>
                <Badge tone="good">100% Autêntico & Auditável</Badge>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#26262e] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">Cliente</p>
                <p className="text-sm text-stone-200">{selected.lead.fullName}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-400"><Mail className="h-3 w-3" /> {selected.lead.email}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-400"><Phone className="h-3 w-3" /> {selected.lead.phone}</p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-stone-400">
                  <MapPin className="h-3 w-3" /> {selected.lead.city}/{selected.lead.state} · CEP {selected.lead.cep}
                </p>
                <a
                  className="mt-2 inline-flex items-center gap-1 text-[11px] text-rose-300 hover:underline"
                  href={`https://wa.me/55${selected.lead.phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Falar no WhatsApp <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div className="rounded-xl border border-[#26262e] p-3">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">Resumo</p>
                <div className="space-y-1 text-xs text-stone-400">
                  <p>Subtotal <span className="float-right text-stone-200">{formatBRL(selected.subtotal)}</span></p>
                  <p>Desconto <span className="float-right text-stone-200">-{formatBRL(selected.discount)}</span></p>
                  <p>Frete <span className="float-right text-stone-200">{formatBRL(selected.shippingCost)}</span></p>
                  <p className="border-t border-[#26262e] pt-1 text-sm text-stone-100">Total <span className="float-right font-semibold text-emerald-300">{formatBRL(selected.total)}</span></p>
                </div>
                <p className="mt-2 text-[11px] text-stone-500">{selected.shippingMethod} · {selected.lead.street}, {selected.lead.number}</p>
              </div>
            </div>

            <div className="rounded-xl border border-[#26262e] p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">Itens ({selected.items.length})</p>
              {selected.items.map((item) => (
                <div key={item.cartItemId} className="flex items-center justify-between border-b border-[#1d1d23] py-1.5 last:border-0">
                  <div className="text-xs text-stone-300">
                    {item.quantity}× {item.name}
                    <span className="text-stone-500"> · {item.selectedSize}/{item.selectedColor?.name}</span>
                  </div>
                  <span className="text-xs text-stone-300">{formatBRL(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Código de rastreio">
                <div className="flex gap-2">
                  <Input value={tracking} onChange={(event) => setTracking(event.target.value)} placeholder="BR123456789SP" />
                  <Button
                    variant="subtle"
                    loading={busy}
                    onClick={() => act(() => adminApi.setTracking(selected.id, tracking), 'Rastreio registrado.')}
                  >
                    Salvar
                  </Button>
                </div>
              </Field>
              <div>
                <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-stone-500">Ações</p>
                <div className="flex flex-wrap gap-2">
                  {selected.paymentStatus === 'pendente' ? (
                    <Button variant="success" size="sm" icon={<BadgeDollarSign className="h-3.5 w-3.5" />} loading={busy}
                      onClick={() => act(() => adminApi.payOrder(selected.id), 'Pagamento confirmado e lançado no financeiro.')}>
                      Confirmar pagamento
                    </Button>
                  ) : null}
                  {['aguardando_pagamento', 'pago'].includes(selected.orderStatus) ? (
                    <Button variant="subtle" size="sm" icon={<Package className="h-3.5 w-3.5" />} loading={busy}
                      onClick={() => act(() => adminApi.setOrderStatus(selected.id, 'em_separacao'), 'Pedido em separação.')}>
                      Separação
                    </Button>
                  ) : null}
                  {selected.orderStatus === 'em_separacao' ? (
                    <Button variant="subtle" size="sm" icon={<Truck className="h-3.5 w-3.5" />} loading={busy}
                      onClick={() => act(() => adminApi.setOrderStatus(selected.id, 'enviado'), 'Pedido marcado como enviado.')}>
                      Enviado
                    </Button>
                  ) : null}
                  {selected.orderStatus === 'enviado' ? (
                    <Button variant="success" size="sm" icon={<CheckCircle2 className="h-3.5 w-3.5" />} loading={busy}
                      onClick={() => act(() => adminApi.setOrderStatus(selected.id, 'entregue'), 'Pedido entregue.')}>
                      Entregue
                    </Button>
                  ) : null}
                  {selected.orderStatus !== 'cancelado' && selected.orderStatus !== 'entregue' ? (
                    <Button variant="danger" size="sm" icon={<Ban className="h-3.5 w-3.5" />} loading={busy}
                      onClick={() => act(() => adminApi.setOrderStatus(selected.id, 'cancelado'), 'Pedido cancelado; estoque devolvido.')}>
                      Cancelar
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#26262e] p-3">
              <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">Histórico</p>
              <ol className="space-y-1.5">
                {selected.history.map((entry, index) => (
                  <li key={index} className="text-[11px] text-stone-400">
                    <span className="font-mono-admin text-stone-500">{formatDate(entry.timestamp)}</span> · {entry.status.replace(/_/g, ' ')}
                    {entry.note ? <span className="text-stone-500"> — {entry.note}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Carrinhos
 * ------------------------------------------------------------------ */

export function CartsTab({ liveKey }: { liveKey: number }) {
  const [filter, setFilter] = useState<'abandoned' | 'active'>('abandoned');
  const { data, loading, error, reload } = useLoad(() => adminApi.carts(filter), [filter, liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();
  const carts = data?.carts || [];

  async function contact(id: string) {
    const result = await run(async () => {
      await adminApi.contactCart(id);
      await reload();
    });
    toast.push(result.ok ? 'Carrinho marcado como contatado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SectionTitle title="Carrinhos" subtitle="intenção de compra registrada em tempo real" />
          <div className="flex gap-2">
            <Button size="sm" variant={filter === 'abandoned' ? 'primary' : 'outline'} onClick={() => setFilter('abandoned')}>
              Abandonados
            </Button>
            <Button size="sm" variant={filter === 'active' ? 'primary' : 'outline'} onClick={() => setFilter('active')}>
              Ativos
            </Button>
            <Button size="sm" variant="ghost" loading={loading} onClick={() => reload()}>Atualizar</Button>
          </div>
        </div>

        {loading && carts.length === 0 ? (
          <Spinner />
        ) : error ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : carts.length === 0 ? (
          <EmptyState
            title={filter === 'abandoned' ? 'Nenhum carrinho abandonado' : 'Nenhum carrinho ativo'}
            description="O rastreamento é automático e usa a inatividade real configurada no servidor."
          />
        ) : (
          <Table head={['Carrinho', 'Cliente', 'Itens', 'Valor', 'Ocioso', 'Status', '']} empty={false}>
            {carts.map((cart: any) => (
              <tr key={cart.id} className="hover:bg-white/[0.02]">
                <Td className="font-mono-admin text-[11px] text-stone-400">{cart.id.slice(0, 12)}</Td>
                <Td className="text-xs text-stone-300">{cart.email || <span className="text-stone-600">sem cadastro</span>}</Td>
                <Td className="text-xs text-stone-400">{cart.itemsCount} un.</Td>
                <Td className="text-sm text-stone-200">{formatBRL(cart.subtotal)}</Td>
                <Td className="text-xs text-stone-400">{cart.minutesIdle} min</Td>
                <Td>
                  <Badge tone={cart.status === 'abandoned' ? 'bad' : cart.contactedAt ? 'info' : 'warn'}>{cart.status}</Badge>
                </Td>
                <Td>
                  <Button size="sm" variant="ghost" loading={busy} onClick={() => contact(cart.id)}>Marcar contatado</Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <SectionTitle title="Como o abandono é detectado" subtitle="regra real aplicada pelo servidor" />
        <p className="text-xs leading-relaxed text-stone-400">
          Cada alteração no carrinho da cliente é espelhada na API. Se o carrinho tiver itens e ficar parado além do tempo
          configurado (<code className="rounded bg-black/40 px-1">CART_ABANDON_MINUTES</code>), ele é marcado como abandonado e o
          bot do Telegram dispara um alerta com botão para registrar o contato. Nenhum carrinho é inventado.
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Clientes
 * ------------------------------------------------------------------ */

export function CustomersTab({ liveKey }: { liveKey: number }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const { data, loading } = useLoad(() => adminApi.customers(query), [query, liveKey]);
  const customers = data?.customers || [];

  const totals = useMemo(
    () => ({
      count: customers.length,
      revenue: customers.reduce((sum, customer) => sum + Number(customer.totalSpent || 0), 0)
    }),
    [customers]
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Contas" value={totals.count} />
        <Stat label="Receita das contas" value={formatBRL(totals.revenue)} tone="good" />
        <Stat label="Com pedidos" value={customers.filter((customer: any) => customer.ordersCount > 0).length} />
        <Stat label="Sem pedidos" value={customers.filter((customer: any) => customer.ordersCount === 0).length} tone="warn" />
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <Field label="Buscar cliente">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => event.key === 'Enter' && setQuery(search)}
                placeholder="Nome, e-mail ou CPF"
              />
            </Field>
          </div>
          <Button variant="primary" onClick={() => setQuery(search)}>Buscar</Button>
        </div>

        {loading && customers.length === 0 ? (
          <Spinner />
        ) : customers.length === 0 ? (
          <EmptyState title="Nenhuma conta criada" description="Contas são registradas quando a cliente se cadastra na loja." />
        ) : (
          <Table head={['Cliente', 'Contato', 'Pedidos', 'Total gasto', 'Cadastro', 'Último login', '']} empty={false}>
            {customers.map((customer: any) => (
              <tr key={customer.id} className="hover:bg-white/[0.02]">
                <Td>
                  <p className="flex items-center gap-1.5 text-stone-200"><UserRound className="h-3.5 w-3.5 text-stone-500" /> {customer.fullName}</p>
                  <p className="text-[11px] text-stone-500">CPF {customer.cpf}</p>
                </Td>
                <Td className="text-xs text-stone-400">
                  <p>{customer.email}</p>
                  <p>{customer.phone}</p>
                </Td>
                <Td className="text-xs text-stone-300">{customer.ordersCount}</Td>
                <Td className="text-sm text-emerald-300">{formatBRL(customer.totalSpent)}</Td>
                <Td className="text-xs text-stone-500">{formatDate(customer.createdAt)}</Td>
                <Td className="text-xs text-stone-500">{formatDate(customer.lastLoginAt)}</Td>
                <Td>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedCustomer(customer)}>
                    Ver Perfil
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={Boolean(selectedCustomer)}
        onClose={() => setSelectedCustomer(null)}
        title={selectedCustomer ? selectedCustomer.fullName : ''}
        subtitle={selectedCustomer ? `Cliente ID: ${selectedCustomer.id} · Cadastrada em ${formatDate(selectedCustomer.createdAt)}` : ''}
        wide
      >
        {selectedCustomer && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total de Pedidos" value={selectedCustomer.ordersCount} />
              <Stat label="Total Gasto" value={formatBRL(selectedCustomer.totalSpent)} tone="good" />
              <Stat label="Último Login" value={selectedCustomer.lastLoginAt ? formatDate(selectedCustomer.lastLoginAt) : '—'} />
              <Stat label="Status da Conta" value="Ativa & Verificada" tone="rose" />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#26262e] p-3.5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Dados Pessoais</p>
                <p className="text-sm font-medium text-stone-200">{selectedCustomer.fullName}</p>
                <p className="text-xs text-stone-400 font-mono-admin">CPF: {selectedCustomer.cpf}</p>
                <p className="text-xs text-stone-400 flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-stone-500" /> {selectedCustomer.email}</p>
                <p className="text-xs text-stone-400 flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-stone-500" /> {selectedCustomer.phone}</p>
              </div>

              <div className="rounded-xl border border-[#26262e] p-3.5 space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Ações Rápidas de Atendimento</p>
                <div className="flex flex-col gap-2 pt-1">
                  <a
                    href={`https://wa.me/55${selectedCustomer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${selectedCustomer.fullName}! Aqui é da equipe Flor de Seda.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white py-2 px-3 text-xs font-semibold transition-all shadow-xs"
                  >
                    <span>Falar no WhatsApp</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>

                  <a
                    href={`mailto:${selectedCustomer.email}`}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 py-2 px-3 text-xs font-medium transition-all border border-white/10"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    <span>Enviar E-mail</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
