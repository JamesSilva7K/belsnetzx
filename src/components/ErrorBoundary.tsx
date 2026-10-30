import React from 'react';

interface State {
  error: Error | null;
}

/**
 * Fronteira de erro da vitrine.
 * Se algum componente falhar, a loja continua utilizável em vez de
 * mostrar uma tela em branco.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[Aura Rosa] Falha na interface:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-[#FFF9FA] px-6">
        <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-7 text-center shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-[#C66382]">
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M12 8.5v4.2M12 16.2v.1" />
              <path d="M10.3 3.9 2.7 17a1.9 1.9 0 0 0 1.7 2.9h15.2A1.9 1.9 0 0 0 21.3 17L13.7 3.9a1.9 1.9 0 0 0-3.4 0Z" />
            </svg>
          </div>
          <h1 className="mt-4 font-serif text-xl text-stone-900">Algo saiu do previsto</h1>
          <p className="mt-2 text-xs leading-relaxed text-stone-500">
            Encontramos um erro ao exibir esta parte da loja. Seus dados e seu carrinho estão preservados.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-full bg-[#DC7898] px-5 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#C66382]"
            >
              Tentar novamente
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-full border border-rose-200 px-5 py-2.5 text-xs font-semibold text-stone-700 transition-colors hover:border-rose-300"
            >
              Recarregar a página
            </button>
          </div>
        </div>
      </div>
    );
  }
}
