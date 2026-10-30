import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Bell,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Image as ImageIcon,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Receipt,
  Settings2,
  ShieldCheck,
  Shirt,
  ShoppingCart,
  Store,
  Sun,
  Tag,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { adminApi, adminBaseUrl, adminToken, ApiError } from '../lib/api';
import AuthScreen from './AuthScreen';
import { Badge, Button, ToastProvider, cn, formatDate, useToast } from './ui';
import { CartsTab, CustomersTab, OrdersTab, OverviewTab } from './tabs/Operations';
import { BannersTab, CatalogTab, CouponsTab, StockTab } from './tabs/Inventory';
import { FinanceTab, SecurityTab, SettingsTab, TelegramTab } from './tabs/System';

type TabId =
  | 'visao'
  | 'pedidos'
  | 'carrinhos'
  | 'clientes'
  | 'estoque'
  | 'catalogo'
  | 'cupons'
  | 'banners'
  | 'financeiro'
  | 'bot'
  | 'seguranca'
  | 'ajustes';

const NAV: Array<{ group: string; items: Array<{ id: TabId; label: string; icon: React.ReactNode }> }> = [
  {
    group: 'Operação',
    items: [
      { id: 'visao', label: 'Visão geral', icon: <LayoutDashboard className="h-4 w-4" /> },
      { id: 'pedidos', label: 'Pedidos', icon: <Receipt className="h-4 w-4" /> },
      { id: 'carrinhos', label: 'Carrinhos', icon: <ShoppingCart className="h-4 w-4" /> },
      { id: 'clientes', label: 'Clientes', icon: <Users className="h-4 w-4" /> }
    ]
  },
  {
    group: 'Catálogo',
    items: [
      { id: 'estoque', label: 'Estoque', icon: <Boxes className="h-4 w-4" /> },
      { id: 'catalogo', label: 'Produtos', icon: <Shirt className="h-4 w-4" /> },
      { id: 'cupons', label: 'Cupons', icon: <Tag className="h-4 w-4" /> },
      { id: 'banners', label: 'Banners', icon: <ImageIcon className="h-4 w-4" /> }
    ]
  },
  {
    group: 'Sistema',
    items: [
      { id: 'financeiro', label: 'Financeiro', icon: <Wallet className="h-4 w-4" /> },
      { id: 'bot', label: 'Bot Telegram', icon: <Bot className="h-4 w-4" /> },
      { id: 'seguranca', label: 'Segurança', icon: <ShieldCheck className="h-4 w-4" /> },
      { id: 'ajustes', label: 'Ajustes', icon: <Settings2 className="h-4 w-4" /> }
    ]
  }
];

const TITLES: Record<TabId, { title: string; subtitle: string }> = {
  visao: { title: 'Visão geral', subtitle: 'números calculados a partir das operações reais' },
  pedidos: { title: 'Pedidos', subtitle: 'ciclo de vida completo com regras de transição' },
  carrinhos: { title: 'Carrinhos', subtitle: 'intenção de compra e abandono real' },
  clientes: { title: 'Clientes', subtitle: 'contas criadas na loja' },
  estoque: { title: 'Estoque', subtitle: 'entradas, saídas e saldo por variação' },
  catalogo: { title: 'Catálogo', subtitle: 'produtos, preços e variantes' },
  cupons: { title: 'Cupons', subtitle: 'regras de desconto validadas no servidor' },
  banners: { title: 'Banners', subtitle: 'conteúdo do carrossel da home' },
  financeiro: { title: 'Financeiro', subtitle: 'receita confirmada, despesas e lucro' },
  bot: { title: 'Bot Telegram', subtitle: 'notificações e operação por botões' },
  seguranca: { title: 'Segurança', subtitle: 'caminho cifrado, sessões e auditoria' },
  ajustes: { title: 'Ajustes', subtitle: 'Pix, frete e identidade da loja' }
};

function AdminShell({ session, onLogout }: { session: { username: string; expiresAt: string }; onLogout: () => void }) {
  const [tab, setTab] = useState<TabId>('visao');
  const [liveKey, setLiveKey] = useState(0);
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alerts, setAlerts] = useState<Array<{ id: string; title: string; at: string }>>([]);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return (localStorage.getItem('aura_admin_theme') as 'dark' | 'light') || 'dark';
    } catch {
      return 'dark';
    }
  });
  const toast = useToast();
  const timer = useRef<number | null>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem('aura_admin_theme', theme);
    } catch {}
  }, [theme]);

  useEffect(() => {
    const source = new EventSource(`${adminBaseUrl()}/events`, { withCredentials: true });

    source.addEventListener('ready', () => setConnected(true));
    source.addEventListener('notification', (event) => {
      try {
        const data = JSON.parse((event as MessageEvent).data);
        setLastEvent(data.title);
        setAlerts((prev) => [{ id: data.id, title: data.title, at: data.at }, ...prev].slice(0, 12));
        toast.push(data.title, data.severity === 'warning' ? 'error' : 'success');
      } catch {
        /* ignora payload inválido */
      }
      setLiveKey((value) => value + 1);
    });
    source.addEventListener('change', () => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLiveKey((value) => value + 1), 1200);
    });
    source.onerror = () => setConnected(false);

    return () => {
      source.close();
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [toast]);

  const active = TITLES[tab];

  const renderTab = () => {
    switch (tab) {
      case 'visao':
        return <OverviewTab liveKey={liveKey} onNavigate={(next) => setTab(next as TabId)} />;
      case 'pedidos':
        return <OrdersTab liveKey={liveKey} />;
      case 'carrinhos':
        return <CartsTab liveKey={liveKey} />;
      case 'clientes':
        return <CustomersTab liveKey={liveKey} />;
      case 'estoque':
        return <StockTab liveKey={liveKey} />;
      case 'catalogo':
        return <CatalogTab liveKey={liveKey} />;
      case 'cupons':
        return <CouponsTab liveKey={liveKey} />;
      case 'banners':
        return <BannersTab liveKey={liveKey} />;
      case 'financeiro':
        return <FinanceTab liveKey={liveKey} />;
      case 'bot':
        return <TelegramTab liveKey={liveKey} />;
      case 'seguranca':
        return <SecurityTab liveKey={liveKey} />;
      case 'ajustes':
        return <SettingsTab liveKey={liveKey} />;
      default:
        return null;
    }
  };

  return (
    <div className="admin-grid-glow min-h-screen bg-[var(--admin-bg)] text-[var(--admin-text-main)] transition-colors">
      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-[var(--admin-border)] bg-[var(--admin-sidebar-bg)] backdrop-blur transition-transform lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-[var(--admin-border)] px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 shadow-sm">
              <Store className="h-4 w-4 text-rose-500 dark:text-rose-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--admin-text-main)]">Aura Rosa</p>
              <p className="text-[10px] uppercase tracking-wider text-[var(--admin-text-subtle)]">central de comando</p>
            </div>
          </div>
          <button className="rounded p-1 text-[var(--admin-text-subtle)] hover:text-[var(--admin-text-main)] lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="h-[calc(100vh-4rem)] space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((group) => (
            <div key={group.group}>
              <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-text-subtle)]">{group.group}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => {
                      setTab(item.id);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition-colors',
                      tab === item.id
                        ? 'bg-rose-500/15 text-rose-600 dark:text-rose-300 font-semibold'
                        : 'text-[var(--admin-text-muted)] hover:bg-[var(--admin-item-hover)] hover:text-[var(--admin-text-main)]'
                    )}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Conteúdo */}
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-header-bg)] px-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="rounded-lg p-1.5 text-[var(--admin-text-subtle)] hover:bg-[var(--admin-item-hover)] lg:hidden" onClick={() => setSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-[var(--admin-text-main)]">{active.title}</h1>
              <p className="text-[11px] text-[var(--admin-text-subtle)]">{active.subtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={cn('hidden items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium sm:flex', connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : 'border-stone-700 text-stone-400')}>
              <span className={cn('h-1.5 w-1.5 rounded-full', connected ? 'admin-live-dot bg-emerald-500' : 'bg-stone-500')} />
              {connected ? 'tempo real' : 'reconectando'}
            </span>

            {/* Alternador de Tema Claro / Escuro */}
            <button
              onClick={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
              title={theme === 'dark' ? 'Alternar para Modo Claro' : 'Alternar para Modo Escuro'}
              className="relative rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-item-hover)] transition-all"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-rose-500" />}
            </button>

            <div className="relative">
              <button
                onClick={() => setAlertsOpen((value) => !value)}
                className="relative rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-item-hover)] transition-colors"
              >
                <Bell className="h-4 w-4" />
                {alerts.length > 0 ? <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" /> : null}
              </button>
              {alertsOpen ? (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl p-1 z-50">
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-3 py-2">
                    <p className="text-xs font-semibold text-[var(--admin-text-main)]">Eventos ao vivo</p>
                    <button className="text-[10px] text-[var(--admin-text-subtle)] hover:text-[var(--admin-text-main)]" onClick={() => { setAlerts([]); setAlertsOpen(false); }}>limpar</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="px-3 py-6 text-center text-[11px] text-[var(--admin-text-subtle)]">Nenhum evento nesta sessão.</p>
                    ) : (
                      alerts.map((alert) => (
                        <div key={alert.id} className="border-b border-[var(--admin-border)] px-3 py-2 last:border-0">
                          <p className="text-[11px] font-medium text-[var(--admin-text-main)]">{alert.title}</p>
                          <p className="text-[10px] text-[var(--admin-text-subtle)]">{formatDate(alert.at)}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="hidden items-center gap-1.5 rounded-lg border border-[var(--admin-border)] px-2.5 py-2 text-[11px] text-[var(--admin-text-muted)] hover:text-[var(--admin-text-main)] hover:bg-[var(--admin-item-hover)] sm:flex transition-colors"
            >
              <ExternalLink className="h-3.5 w-3.5" /> loja
            </a>

            <div className="hidden text-right sm:block">
              <p className="text-[11px] font-semibold text-[var(--admin-text-main)]">{session.username}</p>
              <p className="text-[10px] text-[var(--admin-text-subtle)]">sessão até {new Date(session.expiresAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
            </div>

            <Button size="sm" variant="ghost" icon={<LogOut className="h-3.5 w-3.5" />} onClick={onLogout}>
              Sair
            </Button>
          </div>
        </header>

        <main className="admin-enter px-4 py-5">
          {lastEvent ? <p className="mb-3 text-[10px] text-[var(--admin-text-subtle)]">último evento: {lastEvent}</p> : null}
          {renderTab()}
        </main>
      </div>
    </div>
  );
}



export default function AdminApp() {
  const [checking, setChecking] = useState(true);
  const [session, setSession] = useState<{ username: string; expiresAt: string } | null>(null);
  const [pathInfo, setPathInfo] = useState<any>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const check = useCallback(async () => {
    try {
      const result = await adminApi.session();
      setPathInfo(result.path);
      if (result.authenticated && result.session) {
        setSession(result.session);
      } else {
        setSession(null);
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) setSession(null);
      else setFatal(error instanceof Error ? error.message : 'Falha ao contatar o servidor.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const logout = useCallback(async () => {
    await adminApi.logout().catch(() => undefined);
    adminToken.set('');
    setSession(null);
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-stone-500">Verificando sessão segura…</div>
    );
  }

  if (fatal) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="admin-card max-w-md p-6 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-rose-400" />
          <h1 className="mt-3 text-lg font-semibold text-stone-100">Servidor indisponível</h1>
          <p className="mt-2 text-sm text-stone-400">{fatal}</p>
          <p className="mt-3 text-[11px] text-stone-500">
            Confirme se o servidor está rodando (<code>npm run dev</code>) e se você abriu o caminho criptografado correto.
          </p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Tentar novamente</Button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <ToastProvider>
        <AuthScreen onAuthenticated={(value) => setSession(value)} pathInfo={pathInfo} />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AdminShell session={session} onLogout={logout} />
    </ToastProvider>
  );
}
