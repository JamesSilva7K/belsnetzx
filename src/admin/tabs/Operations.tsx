import React, { useMemo, useState } from 'react';
import {
  BadgeDollarSign,
  RefreshCw,
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
  Wallet,
  Copy,
  Check,
  CreditCard,
  QrCode,
  Filter,
  ChevronDown,
  ChevronUp
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
  const [newStatus, setNewStatus] = useState<string>('');
  const [statusNote, setStatusNote] = useState<string>('');
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
                    <Button size="sm" variant="ghost" onClick={() => { setSelected(order); setTracking(order.trackingCode || ''); setNewStatus(order.orderStatus); setStatusNote(''); }}>
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
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] uppercase tracking-wider text-stone-500">Itens do Pedido ({selected.items.length})</p>
                <span className="text-[10px] text-stone-400 font-mono-admin">Status de Envio: {selected.orderStatus.replace(/_/g, ' ')}</span>
              </div>
              <div className="space-y-2">
                {selected.items.map((item) => {
                  const itemStatus = 
                    selected.orderStatus === 'entregue' ? 'Entregue' :
                    selected.orderStatus === 'enviado' ? 'Em trânsito' :
                    selected.orderStatus === 'em_separacao' ? 'No atelier' :
                    selected.orderStatus === 'pago' ? 'Pronto para separação' :
                    selected.orderStatus === 'cancelado' ? 'Cancelado' : 'Aguardando pagamento';
                  const itemTone = STATUS_TONE[selected.orderStatus] || 'neutral';

                  return (
                    <div key={item.cartItemId} className="flex items-center justify-between gap-3 border-b border-[#1d1d23] pb-2 last:border-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-10 h-12 rounded-lg object-cover border border-[#26262e] shrink-0" />
                        ) : (
                          <div className="w-10 h-12 rounded-lg bg-[#16161a] border border-[#26262e] flex items-center justify-center text-stone-500 shrink-0">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-stone-200 line-clamp-1">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500 mt-0.5">
                            <span>Qtd: <strong className="text-stone-300">{item.quantity}</strong></span>
                            <span>·</span>
                            <span>Tam: <strong className="text-stone-300">{item.selectedSize}</strong></span>
                            {item.selectedColor && (
                              <>
                                <span>·</span>
                                <span>Cor: <strong className="text-stone-300">{item.selectedColor.name}</strong></span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-stone-200 block">{formatBRL(item.price * item.quantity)}</span>
                        <Badge tone={itemTone} className="text-[9px] mt-0.5">{itemStatus}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Gerenciador Inteligente de Status & Sincronização em Tempo Real */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-rose-300 uppercase tracking-wider">
                    Gerenciador Inteligente de Status & Rastreio
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Atualização em tempo real sincronizada diretamente na visão da cliente.
                  </p>
                </div>
                <Badge tone={STATUS_TONE[selected.orderStatus] || 'neutral'}>
                  Status Atual: {selected.orderStatus.replace(/_/g, ' ')}
                </Badge>
              </div>

              {/* Botões Rápidos de Etapas do Pedido */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                {[
                  { key: 'aguardando_pagamento', label: '1. Aguardando', icon: Clock },
                  { key: 'pago', label: '2. Pago', icon: BadgeDollarSign },
                  { key: 'em_separacao', label: '3. No Atelier', icon: Package },
                  { key: 'enviado', label: '4. Enviado', icon: Truck },
                  { key: 'entregue', label: '5. Entregue', icon: CheckCircle2 }
                ].map((step) => {
                  const Icon = step.icon;
                  const isCurrent = selected.orderStatus === step.key;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => setNewStatus(step.key)}
                      className={cn(
                        'flex items-center gap-1.5 p-2 rounded-lg text-left text-xs font-medium transition-all border cursor-pointer',
                        isCurrent
                          ? 'border-rose-400 bg-rose-500/20 text-rose-200 shadow-xs'
                          : newStatus === step.key
                          ? 'border-stone-500 bg-white/10 text-stone-200'
                          : 'border-[#26262e] bg-[#16161a] text-stone-400 hover:border-stone-600'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 shrink-0', isCurrent ? 'text-rose-300' : 'text-stone-500')} />
                      <span className="truncate">{step.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-3 sm:grid-cols-3 pt-1">
                <div>
                  <Field label="Novo Status">
                    <Select value={newStatus} onChange={(e) => setNewStatus(e.target.value)}>
                      <option value="aguardando_pagamento">Aguardando pagamento</option>
                      <option value="pago">Pago / Confirmado</option>
                      <option value="em_separacao">Em separação no atelier</option>
                      <option value="enviado">Enviado / Em trânsito</option>
                      <option value="entregue">Entregue</option>
                      <option value="cancelado">Cancelado (estorno)</option>
                    </Select>
                  </Field>
                </div>
                <div>
                  <Field label="Código de Rastreio (Correios)">
                    <Input
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      placeholder="Ex: BR123456789SP"
                    />
                  </Field>
                </div>
                <div>
                  <Field label="Nota / Observação">
                    <Input
                      value={statusNote}
                      onChange={(e) => setStatusNote(e.target.value)}
                      placeholder="Ex: Embalado com carinho"
                    />
                  </Field>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#26262e]">
                <div className="flex flex-wrap gap-2">
                  {selected.paymentStatus === 'pendente' && (
                    <Button
                      variant="success"
                      size="sm"
                      icon={<BadgeDollarSign className="h-3.5 w-3.5" />}
                      loading={busy}
                      onClick={() => act(() => adminApi.payOrder(selected.id), 'Pagamento confirmado e registrado no financeiro.')}
                    >
                      Confirmar Pagamento Imediato
                    </Button>
                  )}
                  {selected.orderStatus !== 'cancelado' && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Ban className="h-3.5 w-3.5" />}
                      loading={busy}
                      onClick={() => act(() => adminApi.setOrderStatus(selected.id, 'cancelado', 'Cancelado pela administração'), 'Pedido cancelado e estoque retornado.')}
                    >
                      Cancelar Pedido
                    </Button>
                  )}
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                  loading={busy}
                  onClick={async () => {
                    await run(async () => {
                      let updated = selected;
                      if (tracking && tracking !== selected.trackingCode) {
                        const res = await adminApi.setTracking(selected.id, tracking);
                        updated = res.order;
                      }
                      if (newStatus && newStatus !== selected.orderStatus) {
                        const res = await adminApi.setOrderStatus(selected.id, newStatus, statusNote);
                        updated = res.order;
                      }
                      setSelected(updated);
                      await reload();
                      toast.push(`Pedido ${selected.id} atualizado e sincronizado em tempo real.`, 'success');
                      setStatusNote('');
                    });
                  }}
                >
                  Salvar e Sincronizar em Tempo Real
                </Button>
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
                    Ver Perfil & Compras
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {selectedCustomer && (
        <CustomerProfileModal
          customerSummary={selectedCustomer}
          onClose={() => setSelectedCustomer(null)}
        />
      )}
    </div>
  );
}

function CustomerProfileModal({
  customerSummary,
  onClose
}: {
  customerSummary: any;
  onClose: () => void;
}) {
  const { data, loading } = useLoad(
    () => adminApi.customer(customerSummary.id),
    [customerSummary.id]
  );
  const customer = data?.customer || customerSummary;

  // Filtros avançados para as compras da cliente
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('recente');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const rawOrders: any[] = customer?.orders || [];

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredOrders = useMemo(() => {
    return rawOrders
      .filter((ord: any) => {
        if (search.trim()) {
          const q = search.trim().toLowerCase();
          const matchId = ord.id.toLowerCase().includes(q);
          const matchItem = (ord.items || []).some((it: any) => it.name.toLowerCase().includes(q));
          if (!matchId && !matchItem) return false;
        }

        if (paymentFilter !== 'all') {
          if (ord.paymentMethod !== paymentFilter) return false;
        }

        if (statusFilter !== 'all') {
          if (ord.orderStatus !== statusFilter) return false;
        }

        if (dateFilter !== 'all') {
          const orderTime = new Date(ord.createdAt).getTime();
          const now = Date.now();
          if (dateFilter === '7d' && now - orderTime > 7 * 864e5) return false;
          if (dateFilter === '30d' && now - orderTime > 30 * 864e5) return false;
          if (dateFilter === '90d' && now - orderTime > 90 * 864e5) return false;
          if (dateFilter === 'year' && new Date(ord.createdAt).getFullYear() !== new Date().getFullYear()) return false;
        }

        const min = parseFloat(priceMin);
        if (!isNaN(min) && min > 0 && ord.total < min) return false;
        const max = parseFloat(priceMax);
        if (!isNaN(max) && max > 0 && ord.total > max) return false;

        return true;
      })
      .sort((a: any, b: any) => {
        if (sortFilter === 'maior_valor') return b.total - a.total;
        if (sortFilter === 'menor_valor') return a.total - b.total;
        if (sortFilter === 'antigo') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [rawOrders, search, paymentFilter, statusFilter, dateFilter, sortFilter, priceMin, priceMax]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      paymentFilter !== 'all' ||
      statusFilter !== 'all' ||
      dateFilter !== 'all' ||
      sortFilter !== 'recente' ||
      priceMin ||
      priceMax
  );

  const clearFilters = () => {
    setSearch('');
    setPaymentFilter('all');
    setStatusFilter('all');
    setDateFilter('all');
    setSortFilter('recente');
    setPriceMin('');
    setPriceMax('');
  };

  const ticketMedio = customer.ordersCount > 0 ? customer.totalSpent / customer.ordersCount : 0;

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={customer.fullName}
      subtitle={`Cliente ID: ${customer.id} · Cadastrada em ${formatDate(customer.createdAt)}`}
      wide
    >
      <div className="space-y-5">
        {/* Métricas da Cliente */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Total de Pedidos" value={customer.ordersCount || 0} />
          <Stat label="Total Gasto" value={formatBRL(customer.totalSpent || 0)} tone="good" />
          <Stat label="Ticket Médio" value={formatBRL(ticketMedio)} tone="good" />
          <Stat label="Último Login" value={customer.lastLoginAt ? formatDate(customer.lastLoginAt) : '—'} />
        </div>

        {/* Informações Pessoais & Contato */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-text-subtle)]">Dados Cadastrais</p>
            <p className="text-sm font-semibold text-[var(--admin-text-main)]">{customer.fullName}</p>
            <p className="text-xs text-[var(--admin-text-muted)] font-mono-admin">CPF: {customer.cpf}</p>
            <p className="text-xs text-[var(--admin-text-muted)] flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-stone-500" /> {customer.email}
            </p>
            <p className="text-xs text-[var(--admin-text-muted)] flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-stone-500" /> {customer.phone}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3.5 space-y-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-text-subtle)]">Atendimento Direto</p>
            <div className="flex flex-col gap-2 pt-1">
              <a
                href={`https://wa.me/55${customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá, ${customer.fullName}! Aqui é da equipe Aura Rosa Boutique.`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1EBE5D] text-white py-2 px-3 text-xs font-semibold transition-all shadow-xs"
              >
                <span>Chamar no WhatsApp</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>

              <a
                href={`mailto:${customer.email}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-white/10 text-[var(--admin-text-main)] py-2 px-3 text-xs font-medium transition-all border border-[var(--admin-border)]"
              >
                <Mail className="h-3.5 w-3.5" />
                <span>Enviar E-mail</span>
              </a>
            </div>
          </div>
        </div>

        {/* HISTÓRICO DE COMPRAS DA CLIENTE COM FILTROS */}
        <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] pb-3">
            <div>
              <h4 className="text-sm font-semibold text-[var(--admin-text-main)] flex items-center gap-2">
                <Package className="h-4 w-4 text-rose-400" />
                <span>Histórico de Compras da Cliente</span>
                <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-bold text-rose-400">
                  {rawOrders.length}
                </span>
              </h4>
              <p className="text-xs text-[var(--admin-text-muted)] mt-0.5">
                Todas as compras já realizadas, detalhadas por produtos, preços e forma de pagamento.
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs text-rose-400 hover:text-rose-300 underline font-medium cursor-pointer"
              >
                Limpar filtros
              </button>
            )}
          </div>

          {/* Barra de Filtros Inteligentes */}
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            {/* Busca por Produto ou ID */}
            <div className="sm:col-span-2">
              <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                Buscar Produto ou Pedido
              </label>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-stone-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome do produto, código #AUR ou ID..."
                  className="pl-8 text-xs py-1.5"
                />
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                Forma de Pagamento
              </label>
              <Select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value)}
                className="text-xs py-1.5"
              >
                <option value="all">Todas as Formas</option>
                <option value="pix">PIX</option>
                <option value="credit_card">Cartão de Crédito</option>
                <option value="boleto">Boleto Bancário</option>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                Status do Pedido
              </label>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-xs py-1.5"
              >
                <option value="all">Todos os Status</option>
                <option value="pago">Pago / Confirmado</option>
                <option value="em_separacao">Em Separação</option>
                <option value="enviado">Enviado</option>
                <option value="entregue">Entregue</option>
                <option value="aguardando_pagamento">Aguardando Pagamento</option>
                <option value="cancelado">Cancelado</option>
              </Select>
            </div>

            {/* Período */}
            <div>
              <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                Período / Data
              </label>
              <Select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs py-1.5"
              >
                <option value="all">Todo o Período</option>
                <option value="7d">Últimos 7 dias</option>
                <option value="30d">Últimos 30 dias</option>
                <option value="90d">Últimos 90 dias</option>
                <option value="year">Este ano</option>
              </Select>
            </div>

            {/* Ordenação */}
            <div>
              <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                Ordenar Por
              </label>
              <Select
                value={sortFilter}
                onChange={(e) => setSortFilter(e.target.value)}
                className="text-xs py-1.5"
              >
                <option value="recente">Mais Recente</option>
                <option value="antigo">Mais Antigo</option>
                <option value="maior_valor">Maior Valor (R$)</option>
                <option value="menor_valor">Menor Valor (R$)</option>
              </Select>
            </div>

            {/* Faixa de Preço */}
            <div className="sm:col-span-2 flex items-end gap-2">
              <div className="flex-1">
                <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                  Preço Mínimo (R$)
                </label>
                <Input
                  type="number"
                  placeholder="0,00"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="text-xs py-1.5"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block mb-1">
                  Preço Máximo (R$)
                </label>
                <Input
                  type="number"
                  placeholder="Ex: 500,00"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="text-xs py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Contador de Pedidos Filtrados */}
          <div className="flex items-center justify-between text-xs text-[var(--admin-text-muted)] pt-1">
            <span>
              Exibindo <strong className="text-[var(--admin-text-main)]">{filteredOrders.length}</strong> de <strong className="text-[var(--admin-text-main)]">{rawOrders.length}</strong> compras
            </span>
          </div>

          {/* Lista de Compras */}
          {loading ? (
            <Spinner label="Carregando compras da cliente..." />
          ) : filteredOrders.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-[var(--admin-border)] text-center text-xs text-[var(--admin-text-muted)]">
              {hasActiveFilters
                ? 'Nenhuma compra encontrada para os filtros selecionados.'
                : 'Esta cliente ainda não possui compras registradas.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((ord: any) => {
                const isExpanded = expandedOrderId === ord.id;
                const isPaid = ord.paymentStatus === 'confirmado' || ord.orderStatus === 'pago';
                const isPix = ord.paymentMethod === 'pix';

                return (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-card-bg)] shadow-xs overflow-hidden"
                  >
                    {/* Cabeçalho do Pedido */}
                    <div className="p-3.5 bg-black/5 dark:bg-white/[0.02] border-b border-[var(--admin-border)] flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono-admin font-bold text-[var(--admin-text-main)]">
                            {ord.id}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopy(ord.id)}
                            className="p-1 rounded text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)]"
                            title="Copiar ID do pedido"
                          >
                            {copiedId === ord.id ? (
                              <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </button>
                        </div>
                        <p className="text-[11px] text-[var(--admin-text-muted)] mt-0.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          <span>{formatDate(ord.createdAt)}</span>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* Selo Forma de Pagamento */}
                        {isPix ? (
                          <Badge tone="good">
                            <QrCode className="h-3 w-3 mr-0.5" /> PIX
                          </Badge>
                        ) : (
                          <Badge tone="info">
                            <CreditCard className="h-3 w-3 mr-0.5" /> Cartão
                          </Badge>
                        )}

                        {/* Selo Status */}
                        <Badge
                          tone={
                            ord.orderStatus === 'entregue'
                              ? 'good'
                              : ord.orderStatus === 'enviado'
                              ? 'info'
                              : ord.orderStatus === 'em_separacao'
                              ? 'rose'
                              : isPaid
                              ? 'good'
                              : 'warn'
                          }
                        >
                          {ord.orderStatus.replace(/_/g, ' ')}
                        </Badge>

                        <span className="font-semibold text-sm text-emerald-600 dark:text-emerald-400 tabular-nums ml-2">
                          {formatBRL(ord.total)}
                        </span>
                      </div>
                    </div>

                    {/* Rastreio dos Correios (se houver) */}
                    {ord.trackingCode && (
                      <div className="px-3.5 py-1.5 bg-sky-500/10 border-b border-sky-500/20 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
                          <Truck className="h-3.5 w-3.5" />
                          <span>Rastreio:</span>
                          <strong className="font-mono-admin text-[var(--admin-text-main)]">{ord.trackingCode}</strong>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(ord.trackingCode)}
                            className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-medium cursor-pointer"
                          >
                            {copiedId === ord.trackingCode ? 'Copiado!' : 'Copiar'}
                          </button>
                          <a
                            href={`https://rastreamento.correios.com.br/app/index.php?codigo=${ord.trackingCode}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 font-semibold flex items-center gap-0.5"
                          >
                            <span>Abrir</span>
                            <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        </div>
                      </div>
                    )}

                    {/* Itens Comprados */}
                    <div className="p-3.5 space-y-2">
                      {(ord.items || []).map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2.5">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-10 w-9 rounded-lg object-cover border border-[var(--admin-border)] shrink-0"
                              />
                            ) : (
                              <div className="h-10 w-9 rounded-lg bg-stone-500/10 border border-[var(--admin-border)] flex items-center justify-center shrink-0">
                                <Package className="h-4 w-4 text-stone-500" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-[var(--admin-text-main)]">{item.name}</p>
                              <p className="text-[11px] text-[var(--admin-text-muted)]">
                                {item.quantity}× {formatBRL(item.price)}
                                {item.selectedSize ? ` · Tam: ${item.selectedSize}` : ''}
                                {item.selectedColor?.name ? ` · Cor: ${item.selectedColor.name}` : ''}
                              </p>
                            </div>
                          </div>
                          <span className="font-medium text-[var(--admin-text-main)] tabular-nums">
                            {formatBRL(item.price * item.quantity)}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Rodapé com detalhes expansíveis */}
                    <div className="px-3.5 py-2 bg-black/5 dark:bg-white/[0.01] border-t border-[var(--admin-border)] flex items-center justify-between text-xs">
                      <button
                        type="button"
                        onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                        className="text-[11px] text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <span>{isExpanded ? 'Ocultar detalhes' : 'Ver detalhamento financeiro & entrega'}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>

                      <span className="text-[11px] text-[var(--admin-text-muted)]">
                        {ord.items?.length || 0} {(ord.items?.length || 0) === 1 ? 'item' : 'itens'}
                      </span>
                    </div>

                    {/* Área Expandida com endereço e resumo */}
                    {isExpanded && (
                      <div className="p-3.5 bg-black/10 dark:bg-white/[0.02] border-t border-[var(--admin-border)] text-xs space-y-2">
                        <div className="grid sm:grid-cols-2 gap-2 text-[11px] text-[var(--admin-text-muted)] pb-2 border-b border-[var(--admin-border)]">
                          <div>
                            <span className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block">Entrega</span>
                            <p>{ord.lead?.street}, {ord.lead?.number} {ord.lead?.complement ? `· ${ord.lead.complement}` : ''}</p>
                            <p>{ord.lead?.neighborhood} · {ord.lead?.city}/{ord.lead?.state} · CEP {ord.lead?.cep}</p>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold uppercase text-[var(--admin-text-subtle)] block">Envio</span>
                            <p>{ord.shippingMethod || 'PAC'}</p>
                          </div>
                        </div>

                        <div className="space-y-1 text-xs max-w-xs ml-auto text-[var(--admin-text-muted)]">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="text-[var(--admin-text-main)]">{formatBRL(ord.subtotal)}</span>
                          </div>
                          {ord.discount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                              <span>Desconto:</span>
                              <span>-{formatBRL(ord.discount)}</span>
                            </div>
                          )}
                          <div className="flex justify-between">
                            <span>Frete:</span>
                            <span className="text-[var(--admin-text-main)]">{ord.shippingCost > 0 ? formatBRL(ord.shippingCost) : 'Grátis'}</span>
                          </div>
                          <div className="flex justify-between font-semibold text-[var(--admin-text-main)] pt-1 border-t border-[var(--admin-border)]">
                            <span>Total Final:</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBRL(ord.total)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
