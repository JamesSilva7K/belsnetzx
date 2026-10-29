import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, AlertTriangle, Info, Loader2, Image as ImageIcon, Upload, Link as LinkIcon } from 'lucide-react';

export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

export function formatBRL(value: number | undefined | null): string {
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/* ------------------------------- Botões ------------------------------- */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'outline' | 'danger' | 'success' | 'subtle';
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
};

export function Button({ variant = 'subtle', size = 'md', loading, icon, className, children, ...rest }: ButtonProps) {
  const variants: Record<string, string> = {
    primary: 'bg-rose-500 text-white hover:bg-rose-400 border-transparent shadow-[0_8px_24px_-12px_rgba(244,114,182,0.9)]',
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    danger: 'bg-red-500/15 text-red-300 border-red-500/30 hover:bg-red-500/25',
    outline: 'bg-transparent text-stone-200 border-stone-700 hover:border-stone-500 hover:text-white',
    ghost: 'bg-transparent text-stone-300 border-transparent hover:text-white hover:bg-white/5',
    subtle: 'bg-white/5 text-stone-200 border-white/10 hover:bg-white/10'
  };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------- Cartões ------------------------------- */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <section className={cn('admin-card p-5', className)}>{children}</section>;
}

export function SectionTitle({
  title,
  subtitle,
  action
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold text-[var(--admin-text-main)]">{title}</h2>
        {subtitle ? <p className="mt-1 text-xs text-[var(--admin-text-muted)]">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  trend
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: 'default' | 'good' | 'warn' | 'bad' | 'rose';
  trend?: number;
}) {
  const tones: Record<string, string> = {
    default: 'text-[var(--admin-text-main)]',
    good: 'text-emerald-500 dark:text-emerald-300',
    warn: 'text-amber-500 dark:text-amber-300',
    bad: 'text-red-500 dark:text-red-300',
    rose: 'text-rose-500 dark:text-rose-300'
  };
  return (
    <div className="admin-card p-4 transition-all">
      <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--admin-text-subtle)]">{label}</p>
      <p className={cn('mt-2 text-xl font-semibold tabular-nums', tones[tone])}>{value}</p>
      {typeof trend === 'number' ? (
        <p className={cn('mt-1 text-[11px]', trend >= 0 ? 'text-emerald-500' : 'text-red-500')}>
          {trend >= 0 ? '▲' : '▼'} {Math.abs(trend).toFixed(1)}%
        </p>
      ) : null}
      {hint ? <p className="mt-1 text-[11px] text-[var(--admin-text-muted)]">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------- Selos ------------------------------- */

export function Badge({
  children,
  tone = 'neutral',
  className
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'good' | 'warn' | 'bad' | 'info' | 'rose';
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: 'bg-stone-500/10 text-stone-600 dark:text-stone-300 border-stone-500/20',
    good: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    warn: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    bad: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30',
    info: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
    rose: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/30'
  };
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------- Tabelas ------------------------------- */

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--admin-border)]">
            {head.map((title) => (
              <th key={title} className="whitespace-nowrap px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--admin-text-subtle)]">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--admin-border)]">{children}</tbody>
      </table>
      {empty ? <p className="py-8 text-center text-xs text-[var(--admin-text-subtle)]">Nenhum registro ainda.</p> : null}
    </div>
  );
}

export function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={cn('px-3 py-3 align-middle text-[var(--admin-text-main)]', className)}>{children}</td>;
}

/* ------------------------------- Formulário ------------------------------- */

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-[var(--admin-text-subtle)]">{label}</span>
      {children}
      {hint ? <span className="mt-1 block text-[11px] text-[var(--admin-text-subtle)]">{hint}</span> : null}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-[var(--admin-input-border)] bg-[var(--admin-input-bg)] px-3 py-2.5 text-sm text-[var(--admin-input-text)] outline-none transition placeholder:text-[var(--admin-input-placeholder)] focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return <input {...props} ref={ref} className={cn(inputClass, props.className)} />;
  }
);

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, 'min-h-[90px] resize-y', props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputClass, 'appearance-none', props.className)} />;
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-3 text-sm text-[var(--admin-text-main)]"
    >
      <span
        className={cn(
          'relative h-5 w-9 rounded-full border transition-colors',
          checked ? 'border-rose-500 bg-rose-500' : 'border-[var(--admin-input-border)] bg-[var(--admin-input-bg)]'
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all shadow-sm',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </span>
      {label}
    </button>
  );
}

/* ------------------------------- Modal ------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  wide
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const modalNode = (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={cn(
          'relative z-10 flex flex-col w-full max-h-[88vh] rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl overflow-hidden my-auto',
          wide ? 'max-w-4xl' : 'max-w-lg'
        )}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75), 0 0 0 1px var(--admin-border)'
        }}
      >
        <header className="shrink-0 flex items-start justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--admin-text-main)]">{title}</h3>
            {subtitle ? <p className="mt-0.5 text-xs text-[var(--admin-text-muted)]">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--admin-text-muted)] hover:bg-black/10 dark:hover:bg-white/10 hover:text-[var(--admin-text-main)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {children}
        </div>

        {footer ? (
          <footer className="shrink-0 flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-3.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );

  return createPortal(modalNode, document.body);
}

/* ------------------------------- Estados ------------------------------- */

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[#2b2b34] px-6 py-12 text-center">
      <p className="text-sm font-medium text-stone-300">{title}</p>
      {description ? <p className="max-w-sm text-xs text-stone-500">{description}</p> : null}
      {action}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-stone-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label || 'Carregando…'}
    </div>
  );
}

/* ------------------------------- Image Uploader Inteligente ------------------------------- */

export function ImageUploader({
  value,
  onChange,
  label,
  hint,
  compact = false
}: {
  value: string;
  onChange: (val: string) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || !files[0]) return;
    const file = files[0];
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (typeof e.target?.result === 'string') {
        onChange(e.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            if (typeof ev.target?.result === 'string') {
              onChange(ev.target.result);
            }
          };
          reader.readAsDataURL(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  return (
    <div className="space-y-1.5" onPaste={handlePaste}>
      {label ? (
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-stone-300">{label}</label>
          <span className="text-[10px] text-stone-500">Arquivo, Arrastar, Print (Ctrl+V) ou URL</span>
        </div>
      ) : null}

      <div
        className={cn(
          'relative flex flex-col items-center justify-center rounded-xl border border-dashed transition-all',
          dragOver ? 'border-rose-400 bg-rose-500/10' : 'border-[#2d2d37] bg-[#121217] hover:border-stone-600',
          compact ? 'p-2.5' : 'p-4'
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {value ? (
          <div className="relative group w-full flex items-center justify-center">
            <img
              src={value}
              alt="Preview"
              className={cn(
                'rounded-lg object-contain bg-black/40 border border-white/10 shadow-md',
                compact ? 'max-h-20' : 'max-h-36'
              )}
            />
            <button
              type="button"
              onClick={() => onChange('')}
              className="absolute top-1 right-1 rounded-full bg-red-600/90 text-white p-1 shadow-lg hover:bg-red-500"
              title="Remover imagem"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center cursor-pointer text-center py-2"
            onClick={() => fileInputRef.current?.click()}
          >
            <ImageIcon className="h-6 w-6 text-stone-500 mb-1" />
            <p className="text-xs font-medium text-stone-300">
              Clique para selecionar ou arraste o arquivo aqui
            </p>
            <p className="text-[11px] text-stone-500 mt-0.5">
              Você também pode colar um print direto com <kbd className="px-1 py-0.5 bg-stone-800 rounded border border-stone-700 text-stone-300">Ctrl + V</kbd>!
            </p>
          </div>
        )}

        <div className="mt-2.5 w-full flex gap-1.5">
          <Input
            value={value.startsWith('data:') ? '[Imagem Carregada do Computador/Print]' : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Ou cole a URL da imagem aqui (https://...)"
            className="text-xs font-mono"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
          >
            Anexar
          </Button>
        </div>
      </div>
      {hint ? <p className="text-[11px] text-stone-500">{hint}</p> : null}
    </div>
  );
}

/* ------------------------------- Toasts ------------------------------- */

type Toast = { id: number; message: string; tone: 'success' | 'error' | 'info' };

const ToastContext = createContext<{ push: (message: string, tone?: Toast['tone']) => void }>({ push: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast['tone'] = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 5000);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              'admin-enter pointer-events-auto flex items-start gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl backdrop-blur',
              toast.tone === 'success' && 'border-emerald-500/30 bg-emerald-950/80 text-emerald-200',
              toast.tone === 'error' && 'border-red-500/30 bg-red-950/80 text-red-200',
              toast.tone === 'info' && 'border-sky-500/30 bg-sky-950/80 text-sky-100'
            )}
          >
            {toast.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : toast.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
