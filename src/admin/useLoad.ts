import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../lib/api';

/**
 * Carrega um recurso da API e recarrega quando `deps` mudam.
 * `liveKey` é usado pelo painel para atualizar após eventos em tempo real.
 */
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const result = await loaderRef.current();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar os dados.');
    } finally {
      setLoading(false);
    }
  }, [deps.map(String).join('|'), ...deps]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { data, setData, loading, error, reload };
}

/** Ação assíncrona com estado de envio e mensagem de erro. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      return { ok: true as const };
    } catch (err) {
      return { ok: false as const, error: err instanceof ApiError ? err.message : 'Falha na operação.' };
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
