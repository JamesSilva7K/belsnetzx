import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

/**
 * 🪟 Estrutura única de modal da boutique.
 * Centraliza backdrop, cabeçalho, abas, área rolável e rodapé para que
 * provador, produto, sacola, checkout e conta tenham a MESMA identidade visual.
 */
export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  icon: React.ReactNode;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  tabs?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  closeLabel?: string;
  bodyClassName?: string;
}

const SIZES: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-2xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl'
};

export const ModalShell: React.FC<ModalShellProps> = ({
  open,
  onClose,
  icon,
  eyebrow,
  title,
  subtitle,
  badge,
  tabs,
  footer,
  children,
  size = 'lg',
  closeLabel = 'Fechar',
  bodyClassName
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-stone-950/45 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-scale-up relative my-auto flex max-h-[92vh] w-full flex-col overflow-hidden rounded-[32px] border border-rose-200/70 bg-[#FFFCFD] shadow-[0_40px_120px_-40px_rgba(157,60,90,0.45)] ${SIZES[size]}`}
      >
        {/* Cabeçalho */}
        <header className="relative flex items-start justify-between gap-4 border-b border-rose-100 bg-gradient-to-r from-rose-50/90 via-white to-rose-50/60 px-5 py-4 sm:px-7 sm:py-5">
          <div
            className="pointer-events-none absolute -right-10 -top-16 h-40 w-40 rounded-full opacity-70 blur-2xl"
            style={{ background: 'radial-gradient(circle, rgba(220,120,152,0.22), transparent 70%)' }}
            aria-hidden
          />

          <div className="relative flex items-start gap-3.5">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#E88BA7] to-[#C66382] text-white shadow-[0_10px_24px_-12px_rgba(198,99,130,0.9)]">
              {icon}
            </span>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                {eyebrow ? (
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#B65C7B]">{eyebrow}</span>
                ) : null}
                {badge}
              </div>
              <h2 className="font-serif text-xl font-medium leading-tight text-stone-900 sm:text-[26px]">{title}</h2>
              {subtitle ? <p className="mt-1 text-xs font-light text-stone-500">{subtitle}</p> : null}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="relative -mr-1 -mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full border border-rose-200/70 bg-white/80 text-stone-400 transition-colors hover:border-rose-300 hover:text-stone-700"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Abas */}
        {tabs ? <div className="border-b border-rose-100 bg-white/70 px-3 py-2 sm:px-5">{tabs}</div> : null}

        {/* Conteúdo */}
        <div className={`flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6 ${bodyClassName || ''}`}>{children}</div>

        {/* Rodapé */}
        {footer ? (
          <footer className="border-t border-rose-100 bg-white/80 px-5 py-3.5 sm:px-7">{footer}</footer>
        ) : null}
      </div>
    </div>
  );
};

/** Aba em formato de pílula, usada dentro do ModalShell. */
export const ModalTab: React.FC<{
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}> = ({ active, onClick, icon, children }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-semibold transition-all sm:text-xs ${
      active
        ? 'bg-[#DC7898] text-white shadow-[0_8px_20px_-10px_rgba(220,120,152,0.9)]'
        : 'text-stone-500 hover:bg-rose-50 hover:text-stone-800'
    }`}
  >
    <span className={active ? 'text-white' : 'text-[#C66382]'}>{icon}</span>
    <span className="truncate">{children}</span>
  </button>
);

/** Rótulo de seção com numeração discreta. */
export const ModalStep: React.FC<{ index: number; children: React.ReactNode }> = ({ index, children }) => (
  <div className="flex items-center gap-2">
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-100 font-mono text-[10px] font-bold text-[#B65C7B]">
      {index}
    </span>
    <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-700">{children}</span>
  </div>
);
