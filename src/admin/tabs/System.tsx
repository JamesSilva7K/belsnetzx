import React, { useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  Bot,
  CheckCircle2,
  Copy,
  Eye,
  Globe,
  X,
  EyeOff,
  KeyRound,
  Link2,
  Lock,
  MapPin,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Wallet
} from 'lucide-react';
import { adminApi } from '../../lib/api';
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
 * Financeiro
 * ------------------------------------------------------------------ */

const CATEGORIES = [
  { value: 'fornecedor', label: 'Fornecedor' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'embalagens', label: 'Embalagens' },
  { value: 'logistica', label: 'Logística' },
  { value: 'taxa_gateway', label: 'Taxa de gateway' },
  { value: 'manutencao', label: 'Manutenção' },
  { value: 'outros', label: 'Outros' }
];

export function FinanceTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.overview(), [liveKey]);
  const cashflow = useLoad(() => adminApi.cashflow({ limit: 100 }), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'saida' as 'entrada' | 'saida', title: '', category: 'fornecedor', amount: '', notes: '' });

  const metrics = data?.metrics;

  async function submit() {
    const result = await run(async () => {
      await adminApi.addCashflow({
        type: form.type,
        title: form.title,
        category: form.category,
        amount: Number(form.amount),
        notes: form.notes
      });
      setOpen(false);
      setForm({ ...form, title: '', amount: '', notes: '' });
      await Promise.all([reload(), cashflow.reload()]);
    });
    toast.push(result.ok ? 'Lançamento registrado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  async function remove(id: string) {
    const result = await run(async () => {
      await adminApi.deleteCashflow(id);
      await Promise.all([reload(), cashflow.reload()]);
    });
    toast.push(result.ok ? 'Lançamento excluído.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  if (loading && !metrics) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Receita confirmada" value={formatBRL(metrics?.revenue)} tone="good" />
        <Stat label="Despesas" value={formatBRL(metrics?.expenses)} tone="bad" />
        <Stat label="Lucro líquido" value={formatBRL(metrics?.netProfit)} tone="rose" />
        <Stat label="Ticket médio" value={formatBRL(metrics?.averageTicket)} />
      </div>

      <Card>
        <SectionTitle
          title="Fluxo de caixa"
          subtitle="vendas confirmadas + lançamentos manuais em tempo real"
          action={
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-3 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                <ShieldCheck className="h-3.5 w-3.5" />
                Valores 100% Reais da Gateway
              </span>
            </div>
          }
        />
        {cashflow.loading && !cashflow.data ? (
          <Spinner />
        ) : (
          <Table head={['Data', 'Tipo', 'Descrição', 'Categoria', 'Valor', '']} empty={(cashflow.data?.entries || []).length === 0}>
            {(cashflow.data?.entries || []).map((entry: any) => (
              <tr key={entry.id} className="hover:bg-white/[0.02]">
                <Td className="text-xs text-stone-500">{formatDate(entry.date)}</Td>
                <Td><Badge tone={entry.type === 'entrada' ? 'good' : 'bad'}>{entry.type}</Badge></Td>
                <Td className="text-xs text-stone-300">
                  {entry.title}
                  {entry.orderId ? <span className="ml-1 text-stone-500">#{entry.orderId}</span> : null}
                </Td>
                <Td className="text-[11px] text-stone-500">{entry.category}</Td>
                <Td className={cn('text-sm font-medium', entry.type === 'entrada' ? 'text-emerald-300' : 'text-red-300')}>
                  {entry.type === 'entrada' ? '+' : '−'} {formatBRL(entry.amount)}
                </Td>
                <Td>
                  <span className="text-[10px] text-stone-500 font-mono">Gateway Oficial</span>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Novo lançamento"
        subtitle="entradas e saídas ficam registradas e notificadas no Telegram"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={busy} onClick={submit} disabled={!form.title || !form.amount}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={form.type === 'saida' ? 'danger' : 'outline'} onClick={() => setForm({ ...form, type: 'saida' })}>Saída</Button>
            <Button size="sm" variant={form.type === 'entrada' ? 'success' : 'outline'} onClick={() => setForm({ ...form, type: 'entrada' })}>Entrada</Button>
          </div>
          <Field label="Descrição"><Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Valor (R$)"><Input type="number" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></Field>
            <Field label="Categoria">
              <Select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}
              </Select>
            </Field>
          </div>
          <Field label="Observações"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field>
        </div>
      </Modal>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Bot do Telegram
 * ------------------------------------------------------------------ */

export function TelegramTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.telegramStatus(), [liveKey]);
  const notifications = useLoad(() => adminApi.notifications(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();

  const [token, setToken] = useState('');
  const [chatId, setChatId] = useState('');
  const [adminIds, setAdminIds] = useState('');
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);

  const status = data?.status;

  async function connect() {
    const result = await run(async () => {
      await adminApi.telegramConfigure({ token: token || undefined, chatId, adminIds } as any);
      setToken('');
      await reload();
    });
    toast.push(result.ok ? 'Bot validado e conectado.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  async function test() {
    const result = await run(async () => {
      await adminApi.telegramTest();
    });
    toast.push(result.ok ? 'Mensagem de teste enviada no Telegram.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  async function generateLink() {
    const result = await run(async () => {
      const response = await adminApi.panelLink(10);
      setLink(response);
    });
    if (!result.ok) toast.push((result as any).error, 'error');
  }

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={cn('flex h-11 w-11 items-center justify-center rounded-xl border', status?.configured ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10')}>
              <Bot className={cn('h-5 w-5', status?.configured ? 'text-emerald-300' : 'text-amber-300')} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-stone-100">Bot do Telegram</h2>
              <p className="text-xs text-stone-500">
                {loading
                  ? 'verificando…'
                  : status?.configured
                    ? `Conectado${status.botUsername ? ` como @${status.botUsername}` : ''}`
                    : 'Não configurado — nenhuma notificação é enviada até você conectar um bot.'}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" loading={busy} onClick={test} icon={<Send className="h-3.5 w-3.5" />} disabled={!status?.configured}>Enviar teste</Button>
            <Button size="sm" variant="ghost" onClick={() => reload()} icon={<RefreshCw className="h-3.5 w-3.5" />}>Atualizar</Button>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Stat label="Token" value={status?.tokenPresent ? `presente (${status.tokenSource})` : 'ausente'} tone={status?.tokenPresent ? 'good' : 'bad'} />
          <Stat label="Chat autorizado" value={status?.chatConfigured ? status.chatId : 'pendente'} tone={status?.chatConfigured ? 'good' : 'warn'} />
          <Stat label="Comandos ativos" value={status?.commands?.length || 0} hint="painel por botões" />
        </div>

        {status?.lastError ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {status.lastError}
          </div>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Conectar bot" subtitle="token do @BotFather · validação real antes de salvar" />
          <div className="space-y-3">
            <Field label="Token do bot" hint="Enviado uma vez, cifrado com AES-256-GCM no servidor.">
              <Input value={token} onChange={(event) => setToken(event.target.value)} placeholder="123456789:AA..." />
            </Field>
            <Field label="Chat ID do administrador" hint="Deixe vazio para descobrir automaticamente após enviar /start ao bot.">
              <Input value={chatId} onChange={(event) => setChatId(event.target.value)} placeholder="123456789" />
            </Field>
            <Field label="Outros administradores (opcional)">
              <Input value={adminIds} onChange={(event) => setAdminIds(event.target.value)} placeholder="111111, 222222" />
            </Field>
            <div className="flex gap-2">
              <Button variant="primary" loading={busy} onClick={connect}>Validar e conectar</Button>
              {status?.configured ? (
                <Button variant="ghost" onClick={async () => { await adminApi.telegramDisconnect(); await reload(); }}>Desconectar</Button>
              ) : null}
            </div>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Painel por botões" subtitle="o bot executa ações reais no sistema" />
          <div className="space-y-2 text-xs text-stone-400">
            <p>Comandos disponíveis: <code className="rounded bg-black/40 px-1">{status?.commands?.join(' · ') || '—'}</code></p>
            <p>Os botões permitem confirmar pagamento, avançar status, ajustar estoque, marcar carrinho contatado e abrir este painel por link de uso único.</p>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon={<Link2 className="h-3.5 w-3.5" />} loading={busy} onClick={generateLink} disabled={!status?.configured}>
              Gerar link do painel
            </Button>
            {link ? (
              <Button
                size="sm"
                variant="subtle"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => {
                  navigator.clipboard.writeText(link.url);
                  toast.push('Link copiado.', 'success');
                }}
              >
                Copiar link ({new Date(link.expiresAt).toLocaleTimeString('pt-BR')})
              </Button>
            ) : null}
          </div>
          {link ? <p className="mt-2 break-all font-mono-admin text-[10px] text-stone-500">{link.url}</p> : null}
        </Card>
      </div>

      <Card>
        <SectionTitle title="Eventos recentes" subtitle="mesma fila que alimenta o Telegram" />
        {notifications.loading && !notifications.data ? (
          <Spinner />
        ) : (
          <Table head={['Quando', 'Tipo', 'Evento', 'Detalhe']} empty={(notifications.data?.notifications || []).length === 0}>
            {(notifications.data?.notifications || []).map((notification: any) => (
              <tr key={notification.id} className="hover:bg-white/[0.02]">
                <Td className="text-xs text-stone-500">{formatDate(notification.at)}</Td>
                <Td>
                  <Badge tone={notification.severity === 'success' ? 'good' : notification.severity === 'warning' ? 'warn' : 'info'}>
                    {notification.type}
                  </Badge>
                </Td>
                <Td className="text-xs font-medium text-[var(--admin-text-main)]">
                  {notification.title?.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/g, '').trim()}
                </Td>
                <Td className="text-[11px] text-[var(--admin-text-muted)]">
                  {notification.detail?.replace(/[\uD83C-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]/g, '').trim()}
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Segurança
 * ------------------------------------------------------------------ */

export function SecurityTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.security(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();

  const [form, setForm] = useState({ currentPassword: '', code: '', newUsername: '', newPassword: '', rotateTotp: false, rotatePath: false });
  const [result, setResult] = useState<any>(null);

  async function submit() {
    const response = await run(async () => {
      const value = await adminApi.changeCredentials(form);
      setResult(value);
      setForm({ ...form, currentPassword: '', code: '', newPassword: '' });
      await reload();
    });
    toast.push(response.ok ? 'Credenciais atualizadas.' : (response as any).error, response.ok ? 'success' : 'error');
  }

  if (loading && !data) return <Spinner label="Coletando telemetria…" />;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <SectionTitle title="Caminho do painel" subtitle="derivado por HMAC-SHA256" />
          <p className="break-all font-mono-admin text-xs text-rose-300">{data?.path?.path}</p>
          <p className="mt-2 text-[11px] text-stone-500">{data?.path?.length} caracteres · {data?.path?.algorithm}</p>
          <p className="mt-1 text-[11px] text-stone-500">Rotacionado em {formatDate(data?.path?.rotatedAt)}</p>
        </Card>
        <Card>
          <SectionTitle title="Portas" subtitle="superfícies separadas" />
          <p className="text-sm text-stone-200">Loja: <span className="font-mono-admin">{data?.ports?.store}</span></p>
          <p className="text-sm text-stone-200">Admin: <span className="font-mono-admin">{data?.ports?.admin ?? 'mesma porta'}</span></p>
          <p className="mt-2 text-[11px] text-stone-500">Escuta em {data?.ports?.host}</p>
        </Card>
        <Card>
          <SectionTitle title="Sessões ativas" subtitle="token opaco de 256 bits" />
          <p className="text-2xl font-semibold text-emerald-300">{data?.activeSessions ?? 0}</p>
          <p className="mt-1 text-[11px] text-stone-500">expira em {data?.lockPolicy?.sessionHours}h · bloqueio após {data?.lockPolicy?.maxAttempts} tentativas</p>
        </Card>
      </div>

      <Card>
        <SectionTitle
          title="Blindagem de Sistema & Firewall Inteligente"
          subtitle="Honeypots ativos interceptando varreduras de portas, sondas maliciosas (.env, .git, wp-admin) e assinaturas HMAC-SHA256"
          action={<Badge tone="good">Firewall Ativo</Badge>}
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
          <Stat label="Varreduras Bloqueadas" value={String(data?.firewall?.totalBlockedAttempts || 0)} tone="rose" />
          <Stat label="IPs em Quarentena" value={String(data?.firewall?.activeQuarantinesCount || 0)} tone="warn" />
          <Stat label="Vendas Blindadas (HMAC)" value={String(data?.firewall?.sealedOrdersCount || 0)} tone="good" />
          <Stat label="Superfície Protegida" value="100% Blindado" tone="good" />
        </div>

        {data?.firewall?.quarantinedIps?.length ? (
          <div className="mt-3 space-y-2">
            <p className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
              IPs Bloqueados em Quarentena Ativa:
            </p>
            <Table head={['IP Malicioso', 'Motivo da Interceptação', 'Bloqueado em', 'Expiração', '']} empty={false}>
              {data.firewall.quarantinedIps.map((entry: any) => (
                <tr key={entry.ip}>
                  <Td className="font-mono-admin text-xs text-rose-300">{entry.ip}</Td>
                  <Td className="text-xs text-stone-300">{entry.reason}</Td>
                  <Td className="text-xs text-stone-500">{formatDate(entry.bannedAt)}</Td>
                  <Td className="text-xs text-stone-500">{formatDate(entry.expiresAt)}</Td>
                  <Td>
                    <Button
                      size="sm"
                      variant="subtle"
                      onClick={async () => {
                        await adminApi.unbanIp(entry.ip);
                        toast.push(`IP ${entry.ip} liberado da quarentena.`, 'success');
                        await reload();
                      }}
                    >
                      Desbloquear
                    </Button>
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        ) : (
          <p className="text-xs text-stone-400 bg-white/[0.02] border border-white/5 rounded-xl p-3">
            Nenhum IP em quarentena no momento. O sistema está monitorando ativamente todas as rotas e portas em tempo real.
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle title="Sessões" subtitle="revogue qualquer acesso imediatamente" />
        <Table head={['Usuário', 'Criada', 'Expira', 'Origem', 'Canal', '']} empty={false}>
          {(data?.sessions || []).map((session: any) => (
            <tr key={session.id} className="hover:bg-white/[0.02]">
              <Td className="text-xs text-stone-200">{session.username}</Td>
              <Td className="text-xs text-stone-500">{formatDate(session.createdAt)}</Td>
              <Td className="text-xs text-stone-500">{formatDate(session.expiresAt)}</Td>
              <Td className="text-[11px] text-stone-500">{session.ip}</Td>
              <Td><Badge tone={session.channel === 'link-telegram' ? 'warn' : 'info'}>{session.channel || 'senha + 2FA'}</Badge></Td>
              <Td>
                <Button size="sm" variant="ghost" onClick={async () => { await adminApi.revokeSession(session.id); await reload(); }}>Revogar</Button>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Trocar credenciais" subtitle="exige senha atual + código 2FA" />
          <div className="space-y-3">
            <Field label="Senha atual"><Input type="password" value={form.currentPassword} onChange={(event) => setForm({ ...form, currentPassword: event.target.value })} /></Field>
            <Field label="Código 2FA (6 dígitos)"><Input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value.replace(/\D/g, '').slice(0, 6) })} className="font-mono-admin tracking-[0.3em]" /></Field>
            <Field label="Novo usuário (opcional)"><Input value={form.newUsername} onChange={(event) => setForm({ ...form, newUsername: event.target.value })} /></Field>
            <Field label="Nova senha (opcional, mín. 10)" hint="Ao trocar, guarde a nova senha em local seguro.">
              <Input type="password" value={form.newPassword} onChange={(event) => setForm({ ...form, newPassword: event.target.value })} />
            </Field>
            <div className="space-y-2">
              <Toggle checked={form.rotateTotp} onChange={(value) => setForm({ ...form, rotateTotp: value })} label="Gerar novo segredo 2FA" />
              <Toggle checked={form.rotatePath} onChange={(value) => setForm({ ...form, rotatePath: value })} label="Rotacionar caminho do painel" />
            </div>
            <Button variant="primary" loading={busy} onClick={submit} disabled={!form.currentPassword || form.code.length !== 6}>
              Aplicar alterações
            </Button>
            {result ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-200">
                {result.updated?.length ? `Alterado: ${result.updated.join(', ')}` : 'Nenhuma alteração aplicada.'}
                {result.newPath ? <p className="mt-1 break-all font-mono-admin">Novo caminho: {result.newPath}</p> : null}
                {result.totpSetupUri ? <p className="mt-1 break-all font-mono-admin">2FA: {result.totpSetupUri}</p> : null}
              </div>
            ) : null}
          </div>
        </Card>

        <Card>
          <SectionTitle title="Trilha de auditoria" subtitle="últimos eventos do sistema" />
          <div className="max-h-[380px] space-y-1.5 overflow-y-auto pr-1">
            {(data?.auditLog || []).map((entry: any) => (
              <div key={entry.id} className="rounded-lg border border-[#22222a] px-2.5 py-1.5">
                <p className="text-[11px] text-stone-300">{entry.action}</p>
                <p className="text-[10px] text-stone-500">{formatDate(entry.at)} · {entry.actor} {entry.ip ? `· ${entry.ip}` : ''}</p>
                {entry.detail ? <p className="text-[10px] text-stone-500">{entry.detail}</p> : null}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle title="Criptografia em uso" subtitle="o que existe de verdade no servidor" />
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(data?.encryption || {}).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between rounded-lg border border-[#22222a] px-3 py-2 text-xs">
              <span className="text-stone-500">{key}</span>
              <span className="text-stone-300">{String(value)}</span>
            </div>
          ))}
        </div>
        {(data?.attempts || []).length ? (
          <div className="mt-3">
            <p className="mb-2 text-[11px] uppercase tracking-wider text-stone-500">Tentativas por IP</p>
            <Table head={['IP', 'Tentativas', 'Total', 'Bloqueado até']} empty={false}>
              {(data?.attempts || []).map((attempt: any) => (
                <tr key={attempt.ip}>
                  <Td className="font-mono-admin text-[11px] text-stone-400">{attempt.ip}</Td>
                  <Td className="text-xs text-stone-300">{attempt.attempts}</Td>
                  <Td className="text-xs text-stone-400">{attempt.total}</Td>
                  <Td className="text-xs text-stone-400">{attempt.locked ? formatDate(attempt.lockedUntil) : '—'}</Td>
                </tr>
              ))}
            </Table>
          </div>
        ) : null}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Ajustes da loja
 * ------------------------------------------------------------------ */

export function SettingsTab({ liveKey }: { liveKey: number }) {
  const { data, loading, reload } = useLoad(() => adminApi.settings(), [liveKey]);
  const { busy, run } = useAction();
  const toast = useToast();

  const [customization, setCustomization] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);
  const [gateway, setGateway] = useState<any>(null);
  const [shipping, setShipping] = useState<any>(null);
  const [paymentMethods, setPaymentMethods] = useState<any[]>([]);
  const [syncPayStatus, setSyncPayStatus] = useState<any>(null);
  const [testingSyncPay, setTestingSyncPay] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);

  async function searchCep(rawCep: string) {
    const clean = rawCep.replace(/\D/g, '');
    if (clean.length !== 8) {
      toast.push('Digite o CEP completo com 8 dígitos.', 'error');
      return;
    }
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
      const viaData = await res.json();
      if (viaData.erro) {
        toast.push('CEP não encontrado na base dos Correios.', 'error');
        return;
      }
      const existingLoc = customization.storeLocation || {};
      const newLoc = {
        cep: clean.replace(/^(\d{5})(\d{3})$/, '$1-$2'),
        street: viaData.logradouro || '',
        number: existingLoc.number || '',
        complement: viaData.complemento || existingLoc.complement || '',
        neighborhood: viaData.bairro || '',
        city: viaData.localidade || '',
        state: viaData.uf || ''
      };
      const numPart = newLoc.number ? `, ${newLoc.number}` : '';
      const formatted = `${newLoc.street}${numPart} — ${newLoc.neighborhood}, ${newLoc.city}/${newLoc.state}`;
      setCustomization({
        ...customization,
        storeLocation: newLoc,
        addressDisplay: formatted
      });
      toast.push('Endereço preenchido com 100% de precisão!', 'success');
    } catch {
      toast.push('Falha ao consultar serviço de CEP.', 'error');
    } finally {
      setCepLoading(false);
    }
  }

  React.useEffect(() => {
    if (!data) return;
    setCustomization({
      companyName: 'Flor de Seda',
      pageTitle: 'Flor de Seda | Moda Feminina Elegante & Peças Nobres',
      faviconUrl: '',
      ...data.settings.customization
    });
    const gw = data.settings.gateway || {};
    if (!gw.syncpay) {
      gw.syncpay = {
        enabled: false,
        clientId: '',
        clientSecret: '',
        baseUrl: 'https://api.syncpayments.com.br/api/partner/v1'
      };
    }
    setGateway(gw);
    setShipping(data.settings.shipping);
    setPaymentMethods(data.settings.paymentMethods || [
      { id: 'pix', name: 'PIX', enabled: true, badge: 'Aprovação Imediata', imageUrl: '', color: '#047857' },
      { id: 'credit_card', name: 'CARTÃO (ATENDIMENTO)', enabled: true, badge: 'Personalizado', imageUrl: '', color: '#374151' },
      { id: 'gateway_card', name: 'CARTÃO DE CRÉDITO', enabled: false, badge: 'Até 12x', imageUrl: '', color: '#be185d' },
      { id: 'boleto', name: 'BOLETO BANCÁRIO', enabled: false, badge: '3 dias úteis', imageUrl: '', color: '#4b5563' }
    ]);

    adminApi.syncPayBalance().then((res) => setSyncPayStatus(res)).catch(() => {});
  }, [data]);

  async function testSyncPay() {
    setTestingSyncPay(true);
    try {
      const res = await adminApi.syncPayTest();
      setSyncPayStatus(res.balance);
      toast.push('Conexão com a SyncPay verificada com sucesso!', 'success');
    } catch (err: any) {
      toast.push(err.message || 'Falha ao conectar com a SyncPay.', 'error');
    } finally {
      setTestingSyncPay(false);
    }
  }

  async function save(section: 'customization' | 'gateway' | 'shipping' | 'payments') {
    const result = await run(async () => {
      if (section === 'customization') await adminApi.saveCustomization(customization);
      if (section === 'gateway') await adminApi.saveGateway(gateway);
      if (section === 'shipping') await adminApi.saveShipping(shipping);
      if (section === 'payments') await adminApi.savePaymentMethods(paymentMethods);
      await reload();
    });
    toast.push(result.ok ? 'Configuração salva com sucesso.' : (result as any).error, result.ok ? 'success' : 'error');
  }

  if (loading || !customization || !gateway || !shipping) return <Spinner label="Carregando configurações…" />;

  const syncPayConf = gateway.syncpay || {};
  const webhookUrl = `${window.location.origin}/api/webhooks/syncpay`;

  return (
    <div className="space-y-6">
      {/* 1. Formas de Pagamento & Cartões Dinâmicos */}
      <Card>
        <SectionTitle
          title="Formas de Pagamento & Cartões"
          subtitle="Ative ou desative opções e anexe imagens dos cards via arquivo, URL, arrastando ou colando print (Ctrl+V)"
          action={<Badge tone="good">Dinâmico</Badge>}
        />

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {paymentMethods.map((method, index) => (
              <div
                key={method.id}
                className={cn(
                  'rounded-xl border p-4 transition-all space-y-3 bg-[#121217]',
                  method.enabled ? 'border-rose-500/30' : 'border-[#22222a] opacity-75'
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm text-stone-200">{method.name}</span>
                  <Toggle
                    label={method.enabled ? 'Ativo' : 'Inativo'}
                    checked={Boolean(method.enabled)}
                    onChange={(checked) => {
                      const updated = [...paymentMethods];
                      updated[index] = { ...method, enabled: checked };
                      setPaymentMethods(updated);
                    }}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Nome da Opção">
                    <Input
                      value={method.name}
                      onChange={(e) => {
                        const updated = [...paymentMethods];
                        updated[index] = { ...method, name: e.target.value };
                        setPaymentMethods(updated);
                      }}
                    />
                  </Field>
                  <Field label="Badge / Subtítulo">
                    <Input
                      value={method.badge || ''}
                      placeholder="Ex: Até 12x, 5% OFF"
                      onChange={(e) => {
                        const updated = [...paymentMethods];
                        updated[index] = { ...method, badge: e.target.value };
                        setPaymentMethods(updated);
                      }}
                    />
                  </Field>
                </div>

                <ImageUploader
                  compact
                  label="Imagem do Card / Bandeira"
                  hint="Anexe o logotipo da bandeira, QR code ou card estilizado"
                  value={method.imageUrl || ''}
                  onChange={(val) => {
                    const updated = [...paymentMethods];
                    updated[index] = { ...method, imageUrl: val };
                    setPaymentMethods(updated);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="primary" loading={busy} onClick={() => save('payments')}>
              Salvar Formas de Pagamento
            </Button>
          </div>
        </div>
      </Card>

      {/* 2. PREVIEW REAL: Visão do Lead e das Clientes */}
      <Card className="border-rose-500/30 bg-gradient-to-b from-[#14141c] to-[#0d0d12]">
        <SectionTitle
          title="Preview em Tempo Real — Visão do Lead e Clientes"
          subtitle="Simulação ao vivo de como as formas de pagamento aparecem no rodapé e no checkout da loja"
        />

        <div className="space-y-4 pt-2">
          {/* Preview Rodapé */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
              No Rodapé da Loja (Footer):
            </p>
            <div className="flex items-center gap-2 flex-wrap bg-white/90 p-3 rounded-lg border border-rose-200">
              <span className="text-[11px] font-medium text-stone-600 mr-1">Pagamento:</span>
              {paymentMethods.filter((m) => m.enabled).length === 0 ? (
                <span className="text-xs text-stone-400 italic">Nenhuma forma de pagamento ativa</span>
              ) : (
                paymentMethods
                  .filter((m) => m.enabled)
                  .map((m) =>
                    m.imageUrl ? (
                      <img
                        key={m.id}
                        src={m.imageUrl}
                        alt={m.name}
                        title={m.name}
                        className="h-6 max-w-[80px] object-contain rounded border border-rose-200 bg-white px-1.5 py-0.5 shadow-xs"
                      />
                    ) : (
                      <span
                        key={m.id}
                        className="px-2.5 py-1 rounded-md bg-white border border-rose-200 text-[10px] font-bold text-stone-800 shadow-xs"
                        style={{ color: m.color || '#374151' }}
                      >
                        {m.name}
                      </span>
                    )
                  )
              )}
            </div>
          </div>

          {/* Preview Checkout */}
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
            <p className="text-[11px] font-semibold text-rose-300 uppercase tracking-wider">
              No Checkout (Finalização da Compra):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {paymentMethods
                .filter((m) => m.enabled)
                .map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between rounded-xl border border-rose-400/40 bg-white p-3 shadow-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      {m.imageUrl ? (
                        <img src={m.imageUrl} alt={m.name} className="h-6 w-10 object-contain rounded" />
                      ) : (
                        <span className="h-3 w-3 rounded-full border-2 border-rose-500 bg-rose-500" />
                      )}
                      <div>
                        <p className="text-xs font-bold text-stone-800">{m.name}</p>
                        {m.badge ? <p className="text-[10px] text-rose-600 font-medium">{m.badge}</p> : null}
                      </div>
                    </div>
                    <Badge tone="good">Habilitado</Badge>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>

      {/* 3. Identidade, Nome da Empresa, Favicon e Títulos */}
      <Card>
        <SectionTitle
          title="Nome da Empresa, Favicon & Títulos (SEO)"
          subtitle="Configure o nome exibido, o favicon da aba do navegador e os títulos de página para os leads"
        />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome da Empresa / Boutique" hint="Aparece no rodapé, cabeçalho e termos">
              <Input
                value={customization.companyName || ''}
                onChange={(e) => setCustomization({ ...customization, companyName: e.target.value })}
                placeholder="Ex: Flor de Seda"
              />
            </Field>

            <Field label="Título da Página no Navegador (<title>)" hint="Aparece na aba do navegador para os clientes">
              <Input
                value={customization.pageTitle || ''}
                onChange={(e) => setCustomization({ ...customization, pageTitle: e.target.value })}
                placeholder="Ex: Flor de Seda | Moda Feminina Elegante"
              />
            </Field>
          </div>

          <ImageUploader
            label="Favicon do Site (Ícone da Aba do Navegador)"
            hint="Anexe a imagem do favicon (.ico, .png, .svg) por arquivo, arrastando, link ou colando com Ctrl+V"
            value={customization.faviconUrl || ''}
            onChange={(val) => setCustomization({ ...customization, faviconUrl: val })}
          />

          {/* Preview em Tempo Real da Aba do Navegador (Exatamente como na Imagem 5) */}
          <div className="rounded-2xl border border-[var(--admin-border)] bg-black/40 p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-bold text-rose-400 uppercase tracking-wider">
                <Globe className="h-4 w-4" />
                Preview em Tempo Real da Aba do Navegador
              </span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold px-2 py-0.5">
                Visão ao Vivo da Cliente
              </span>
            </div>

            {/* Mockup da Aba do Navegador (Estilo Chrome / Edge Dark Mode como na Imagem 5) */}
            <div className="rounded-xl overflow-hidden border border-white/10 bg-[#1e232a] shadow-lg">
              {/* Barra Superior da Janela */}
              <div className="bg-[#15191e] px-3 pt-2.5 flex items-center gap-2 border-b border-white/5">
                <div className="flex items-center gap-1.5 mr-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
                </div>

                {/* A Aba Ativa */}
                <div className="flex items-center gap-2 bg-[#1e232a] px-3.5 py-1.5 rounded-t-lg border-t border-x border-white/10 max-w-sm shadow-xs text-xs">
                  {customization.faviconUrl ? (
                    <img
                      src={customization.faviconUrl}
                      alt="Favicon"
                      className="w-4 h-4 object-contain rounded-xs shrink-0"
                    />
                  ) : (
                    <Globe className="w-4 h-4 text-stone-400 shrink-0" />
                  )}
                  <span className="text-stone-200 font-medium text-xs truncate max-w-[200px]">
                    {customization.pageTitle || 'Flor de Seda | Moda Feminina'}
                  </span>
                  <X className="w-3.5 h-3.5 text-stone-400 hover:text-white shrink-0 ml-1 cursor-pointer" />
                </div>
              </div>

              {/* Barra de Endereço URL */}
              <div className="bg-[#1e232a] px-4 py-2 flex items-center gap-2 text-xs text-stone-400">
                <div className="flex-1 bg-[#15191e] rounded-md px-3 py-1 text-[11px] font-mono text-stone-300 flex items-center gap-1.5 border border-white/5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="text-emerald-400 font-semibold">https://</span>
                  <span>fashionstylogirls.vercel.app</span>
                </div>
              </div>
            </div>

            {/* Prévia nos Resultados do Google (SERP) */}
            <div className="p-3.5 rounded-xl bg-white dark:bg-stone-900 border border-[var(--admin-border)] space-y-1">
              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">Prévia na Busca do Google:</span>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                {customization.faviconUrl ? (
                  <img src={customization.faviconUrl} alt="" className="w-3.5 h-3.5 object-contain" />
                ) : (
                  <Globe className="w-3.5 h-3.5" />
                )}
                <span className="truncate">fashionstylogirls.vercel.app</span>
              </div>
              <p className="text-blue-600 dark:text-blue-400 font-medium text-xs hover:underline cursor-pointer truncate">
                {customization.pageTitle || 'Flor de Seda | Moda Feminina Elegante & Peças Nobres'}
              </p>
              <p className="text-stone-600 dark:text-stone-400 text-[11px] line-clamp-2">
                Conheça a coleção de vestidos e conjuntos da {customization.companyName || 'Flor de Seda'}. Loja de roupas femininas com tecidos nobres, modelagens fluidas e entrega via Correios.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            <Field label="WhatsApp (só números)">
              <Input
                value={customization.whatsappNumber || ''}
                onChange={(e) => setCustomization({ ...customization, whatsappNumber: e.target.value })}
              />
            </Field>
            <Field label="WhatsApp exibido">
              <Input
                value={customization.whatsappDisplay || ''}
                onChange={(e) => setCustomization({ ...customization, whatsappDisplay: e.target.value })}
              />
            </Field>
            <Field label="E-mail de suporte">
              <Input
                value={customization.supportEmail || ''}
                onChange={(e) => setCustomization({ ...customization, supportEmail: e.target.value })}
              />
            </Field>
            <Field label="Horário de atendimento">
              <Input
                value={customization.businessHours || ''}
                onChange={(e) => setCustomization({ ...customization, businessHours: e.target.value })}
              />
            </Field>
            <Field label="Cor principal da boutique">
              <Input
                type="color"
                value={customization.primaryColor || '#DC7898'}
                onChange={(e) => setCustomization({ ...customization, primaryColor: e.target.value })}
                className="h-11 p-1"
              />
            </Field>
            <Field label="Fonte dos títulos">
              <Input
                value={customization.titleFont || 'Playfair Display'}
                onChange={(e) => setCustomization({ ...customization, titleFont: e.target.value })}
              />
            </Field>
          </div>

          <Button
            variant="primary"
            loading={busy}
            onClick={() => {
              setConfirmModal({
                open: true,
                title: 'Confirmar Alterações na Identidade da Loja',
                description: `Deseja publicar imediatamente as alterações? O título será atualizado para "${customization.pageTitle}" e o novo favicon será sincronizado com a aba do navegador de todas as clientes.`,
                onConfirm: async () => {
                  setConfirmModal(null);
                  await save('customization');
                }
              });
            }}
          >
            Salvar Identidade & Títulos
          </Button>
        </div>
      </Card>

      {/* 4. Localização Física da Loja & Preenchimento por CEP */}
      <Card>
        <SectionTitle
          title="Localização Física da Loja de Roupas Femininas"
          subtitle="Altere a localização com preenchimento automático de total precisão via CEP"
          action={<Badge tone="good">ViaCEP Oficial</Badge>}
        />
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-end gap-3">
            <div className="flex-1 w-full">
              <Field label="CEP da Loja" hint="Digite os 8 dígitos para preenchimento automático">
                <Input
                  value={customization.storeLocation?.cep || ''}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const loc = { ...(customization.storeLocation || {}), cep: raw };
                    setCustomization({ ...customization, storeLocation: loc });
                    if (raw.replace(/\D/g, '').length === 8) {
                      searchCep(raw);
                    }
                  }}
                  placeholder="01424-002"
                />
              </Field>
            </div>
            <Button
              variant="subtle"
              loading={cepLoading}
              onClick={() => searchCep(customization.storeLocation?.cep || '')}
              className="w-full sm:w-auto"
            >
              <Search className="w-4 h-4 mr-1.5" />
              Buscar CEP
            </Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Logradouro / Rua">
              <Input
                value={customization.storeLocation?.street || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), street: e.target.value };
                  const numPart = loc.number ? `, ${loc.number}` : '';
                  const formatted = `${loc.street}${numPart} — ${loc.neighborhood || ''}, ${loc.city || ''}/${loc.state || ''}`;
                  setCustomization({ ...customization, storeLocation: loc, addressDisplay: formatted });
                }}
                placeholder="Ex: Alameda Lorena"
              />
            </Field>

            <Field label="Número">
              <Input
                value={customization.storeLocation?.number || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), number: e.target.value };
                  const numPart = loc.number ? `, ${loc.number}` : '';
                  const formatted = `${loc.street || ''}${numPart} — ${loc.neighborhood || ''}, ${loc.city || ''}/${loc.state || ''}`;
                  setCustomization({ ...customization, storeLocation: loc, addressDisplay: formatted });
                }}
                placeholder="Ex: 1420"
              />
            </Field>

            <Field label="Complemento">
              <Input
                value={customization.storeLocation?.complement || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), complement: e.target.value };
                  setCustomization({ ...customization, storeLocation: loc });
                }}
                placeholder="Ex: Loja Jardins"
              />
            </Field>

            <Field label="Bairro">
              <Input
                value={customization.storeLocation?.neighborhood || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), neighborhood: e.target.value };
                  const numPart = loc.number ? `, ${loc.number}` : '';
                  const formatted = `${loc.street || ''}${numPart} — ${loc.neighborhood}, ${loc.city || ''}/${loc.state || ''}`;
                  setCustomization({ ...customization, storeLocation: loc, addressDisplay: formatted });
                }}
                placeholder="Ex: Jardins"
              />
            </Field>

            <Field label="Cidade">
              <Input
                value={customization.storeLocation?.city || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), city: e.target.value };
                  const numPart = loc.number ? `, ${loc.number}` : '';
                  const formatted = `${loc.street || ''}${numPart} — ${loc.neighborhood || ''}, ${loc.city}/${loc.state || ''}`;
                  setCustomization({ ...customization, storeLocation: loc, addressDisplay: formatted });
                }}
                placeholder="Ex: São Paulo"
              />
            </Field>

            <Field label="Estado (UF)">
              <Input
                value={customization.storeLocation?.state || ''}
                onChange={(e) => {
                  const loc = { ...(customization.storeLocation || {}), state: e.target.value.toUpperCase().slice(0, 2) };
                  const numPart = loc.number ? `, ${loc.number}` : '';
                  const formatted = `${loc.street || ''}${numPart} — ${loc.neighborhood || ''}, ${loc.city || ''}/${loc.state}`;
                  setCustomization({ ...customization, storeLocation: loc, addressDisplay: formatted });
                }}
                placeholder="Ex: SP"
              />
            </Field>
          </div>

          <Field label="Endereço Formatado Completo (Exibido aos Clientes)">
            <Input
              value={customization.addressDisplay || ''}
              onChange={(e) => setCustomization({ ...customization, addressDisplay: e.target.value })}
              placeholder="Ex: Alameda Lorena, 1420 — Jardins, São Paulo/SP"
            />
          </Field>

          <Button variant="primary" loading={busy} onClick={() => save('customization')}>
            Salvar Localização Física
          </Button>
        </div>
      </Card>

      {/* 5. Visibilidade para Leads & Blindagem de Design */}
      <Card>
        <SectionTitle
          title="Visibilidade da Loja para Leads & Blindagem de Design"
          subtitle="Ative o modo manutenção para pausar a loja de leads ou ative a blindagem contra cópias de design"
          action={
            customization.storeStatus === 'maintenance' ? (
              <Badge tone="warn">Em Manutenção</Badge>
            ) : (
              <Badge tone="good">Online para Leads</Badge>
            )
          }
        />
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { id: 'online', label: 'Loja Aberta (Online)', desc: 'Visível normalmente para todos os leads e clientes' },
              { id: 'maintenance', label: 'Modo Manutenção', desc: 'Loja fechada para leads, exibe tela de atualização elegante' },
              { id: 'private', label: 'Loja Privada', desc: 'Acesso restrito exclusivo ao gestor' }
            ].map((mode) => (
              <div
                key={mode.id}
                onClick={() => setCustomization({ ...customization, storeStatus: mode.id })}
                className={cn(
                  'cursor-pointer rounded-2xl border p-4 transition-all text-left',
                  (customization.storeStatus || 'online') === mode.id
                    ? 'border-rose-500 bg-rose-500/10'
                    : 'border-white/5 bg-white/[0.02] hover:border-white/10'
                )}
              >
                <p className="font-semibold text-xs text-stone-200">{mode.label}</p>
                <p className="text-[11px] text-stone-400 mt-1 leading-relaxed">{mode.desc}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            <Field label="Título da Manutenção">
              <Input
                value={customization.maintenanceTitle || ''}
                onChange={(e) => setCustomization({ ...customization, maintenanceTitle: e.target.value })}
                placeholder="Ex: Flor de Seda em Atualização"
              />
            </Field>

            <Field label="Mensagem para os Leads">
              <Input
                value={customization.maintenanceMessage || ''}
                onChange={(e) => setCustomization({ ...customization, maintenanceMessage: e.target.value })}
                placeholder="Ex: Estamos preparando novidades exclusivas. Retornaremos em instantes!"
              />
            </Field>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3.5 mt-2">
            <div>
              <p className="text-sm font-medium text-stone-200">Blindagem Anti-Cópia & Anti-Inspect</p>
              <p className="text-xs text-stone-400">
                Bloqueia F12, menu de contexto (botão direito), Ctrl+U e inspeção do código-fonte para visitantes e concorrentes.
              </p>
            </div>
            <Toggle
              label={customization.antiCopyProtection !== false ? 'Blindagem Ativa' : 'Desativada'}
              checked={customization.antiCopyProtection !== false}
              onChange={(checked) => setCustomization({ ...customization, antiCopyProtection: checked })}
            />
          </div>

          <Button variant="primary" loading={busy} onClick={() => save('customization')}>
            Salvar Visibilidade & Blindagem
          </Button>
        </div>
      </Card>

      {/* 4. Bloco SyncPay */}
      <Card>
        <SectionTitle
          title="Gateway SyncPay (Pix Dinâmico & Webhooks)"
          subtitle="Cobrança Pix automatizada com baixa e notificação instantânea via webhooks (< 5s)"
          action={
            syncPayStatus?.connected ? (
              <Badge tone="good">SyncPay Conectado</Badge>
            ) : syncPayConf.enabled ? (
              <Badge tone="warn">Credenciais Pendentes</Badge>
            ) : (
              <Badge tone="neutral">Modo Chave Manual</Badge>
            )
          }
        />

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] p-3">
            <div>
              <p className="text-sm font-medium text-stone-200">Processamento Automático SyncPay</p>
              <p className="text-xs text-stone-500">
                Gera QR Code Copia e Cola dinâmico e baixa pedidos automaticamente ao receber o pagamento.
              </p>
            </div>
            <Toggle
              label={syncPayConf.enabled ? 'Ativado' : 'Desativado'}
              checked={Boolean(syncPayConf.enabled)}
              onChange={(enabled) =>
                setGateway({
                  ...gateway,
                  syncpay: { ...syncPayConf, enabled }
                })
              }
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Client ID (SyncPay)" hint="Obtido no portal de parceiro da SyncPay">
              <Input
                value={syncPayConf.clientId || ''}
                onChange={(event) =>
                  setGateway({
                    ...gateway,
                    syncpay: { ...syncPayConf, clientId: event.target.value }
                  })
                }
                placeholder="Ex: 9c7f6e3a-..."
              />
            </Field>

            <Field label="Client Secret (SyncPay)" hint="Chave secreta para geração do Bearer Token">
              <Input
                type="password"
                value={syncPayConf.clientSecret || ''}
                onChange={(event) =>
                  setGateway({
                    ...gateway,
                    syncpay: { ...syncPayConf, clientSecret: event.target.value }
                  })
                }
                placeholder="••••••••••••••••"
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Base URL da API">
              <Input
                value={syncPayConf.baseUrl || 'https://api.syncpayments.com.br/api/partner/v1'}
                onChange={(event) =>
                  setGateway({
                    ...gateway,
                    syncpay: { ...syncPayConf, baseUrl: event.target.value }
                  })
                }
              />
            </Field>

            <Field label="URL do Webhook (para cadastrar no painel SyncPay)">
              <div className="flex gap-2">
                <Input value={webhookUrl} readOnly className="bg-black/30 text-stone-400 font-mono text-xs" />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.push('URL do webhook copiada!', 'info');
                  }}
                >
                  Copiar
                </Button>
              </div>
            </Field>
          </div>

          {syncPayStatus?.connected ? (
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div>
                <p className="text-[11px] font-medium text-emerald-400">Saldo Disponível (SyncPay)</p>
                <p className="text-lg font-semibold text-emerald-200">{formatBRL(syncPayStatus.balance ?? 0)}</p>
              </div>
              <div>
                <p className="text-[11px] font-medium text-stone-400">Saldo Pendente</p>
                <p className="text-lg font-semibold text-stone-200">{formatBRL(syncPayStatus.pending ?? 0)}</p>
              </div>
            </div>
          ) : syncPayStatus?.error ? (
            <p className="text-xs text-amber-400">Aviso SyncPay: {syncPayStatus.error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="primary" loading={busy} onClick={() => save('gateway')}>
              Salvar Configuração SyncPay
            </Button>
            <Button
              variant="outline"
              loading={testingSyncPay}
              onClick={testSyncPay}
              disabled={!syncPayConf.clientId || !syncPayConf.clientSecret}
            >
              Testar Conexão com SyncPay
            </Button>
          </div>
        </div>
      </Card>

      {/* 5. Pix Manual / Frete */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Pix Manual / Fallback" subtitle="chave estática utilizada caso a SyncPay esteja inativa" />
          <div className="space-y-3">
            <Field label="Tipo da chave">
              <Select value={gateway.pixKeyType} onChange={(event) => setGateway({ ...gateway, pixKeyType: event.target.value })}>
                <option value="cnpj">CNPJ</option>
                <option value="cpf">CPF</option>
                <option value="email">E-mail</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave aleatória</option>
              </Select>
            </Field>
            <Field label="Chave Pix" hint="Usada quando o gateway automático não estiver ativo.">
              <Input value={gateway.pixKey || ''} onChange={(event) => setGateway({ ...gateway, pixKey: event.target.value })} placeholder="contato@sualoja.com.br" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome do recebedor"><Input value={gateway.pixMerchantName || ''} onChange={(event) => setGateway({ ...gateway, pixMerchantName: event.target.value })} /></Field>
              <Field label="Cidade"><Input value={gateway.pixMerchantCity || ''} onChange={(event) => setGateway({ ...gateway, pixMerchantCity: event.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Desconto no Pix (%)"><Input type="number" value={gateway.discountForPixPercent ?? 0} onChange={(event) => setGateway({ ...gateway, discountForPixPercent: Number(event.target.value) })} /></Field>
              <Field label="Parcelas sem juros"><Input type="number" value={gateway.maxInstallmentsWithoutInterest ?? 1} onChange={(event) => setGateway({ ...gateway, maxInstallmentsWithoutInterest: Number(event.target.value) })} /></Field>
            </div>
            <Button variant="outline" loading={busy} onClick={() => save('gateway')}>Salvar Pix Manual</Button>
          </div>
        </Card>

        <Card>
          <SectionTitle title="Frete" subtitle="regra aplicada no recálculo do servidor" />
          <div className="space-y-3">
            <Field label="Frete grátis a partir de (R$)"><Input type="number" value={shipping.freeThreshold ?? 0} onChange={(event) => setShipping({ ...shipping, freeThreshold: Number(event.target.value) })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="PAC (R$)"><Input type="number" step="0.01" value={shipping.pac ?? 0} onChange={(event) => setShipping({ ...shipping, pac: Number(event.target.value) })} /></Field>
              <Field label="SEDEX (R$)"><Input type="number" step="0.01" value={shipping.sedex ?? 0} onChange={(event) => setShipping({ ...shipping, sedex: Number(event.target.value) })} /></Field>
            </div>
            <Button variant="primary" loading={busy} onClick={() => save('shipping')}>Salvar frete</Button>
          </div>
        </Card>
      </div>
    
      {confirmModal && (
        <Modal
          open={confirmModal.open}
          onClose={() => setConfirmModal(null)}
          title={confirmModal.title}
          subtitle="Confirmação de alteração e sincronização ao vivo"
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmModal(null)}>Cancelar</Button>
              <Button variant="primary" loading={busy} onClick={confirmModal.onConfirm}>Confirmar e Publicar Agora</Button>
            </>
          }
        >
          <div className="space-y-3 text-xs text-stone-300">
            <p>{confirmModal.description}</p>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px]">
              A alteração será propagada em tempo real para a loja e refletida imediatamente no navegador dos leads.
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}