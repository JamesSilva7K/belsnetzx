import React, { useEffect, useState } from 'react';
import { ArrowRight, Fingerprint, Lock, ShieldCheck, AlertTriangle } from 'lucide-react';
import { adminApi, adminToken, ApiError } from '../lib/api';
import { Button, Field, Input } from './ui';

interface Props {
  onAuthenticated: (session: { username: string; expiresAt: string }) => void;
  pathInfo: { path: string; algorithm: string; length: number } | null;
}

export default function AuthScreen({ onAuthenticated, pathInfo }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [entryBusy, setEntryBusy] = useState(true);

  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';

  // Link de uso único enviado pelo bot do Telegram (?k=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('k');
    if (!token) {
      setEntryBusy(false);
      return;
    }
    window.history.replaceState(null, '', window.location.pathname);
    adminApi
      .entry(token)
      .then((result) => {
        adminToken.set(result.token);
        onAuthenticated(result.session);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Link inválido.');
        setEntryBusy(false);
      });
  }, [onAuthenticated]);

  async function submitCredentials(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await adminApi.login(username.trim(), password);
      adminToken.set(result.token);
      onAuthenticated(result.session);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao autenticar. Verifique usuário e senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-grid-glow flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/10 shadow-lg shadow-rose-950/20">
            <Lock className="h-6 w-6 text-rose-300" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold text-stone-100 tracking-tight">Central de Comando</h1>
          <p className="mt-1 text-xs text-stone-400">Aura Rosa · Acesso Administrativo Direto</p>
        </div>

        <div className="admin-card p-6 shadow-xl border border-stone-800/80 bg-stone-900/90 backdrop-blur-md rounded-2xl">
          {entryBusy ? (
            <p className="py-8 text-center text-sm text-stone-400">Validando seu link seguro…</p>
          ) : (
            <form onSubmit={submitCredentials} className="space-y-4">
              <Field label="Usuário">
                <Input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  placeholder="Seu usuário"
                  autoFocus
                  required
                />
              </Field>
              <Field label="Senha">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Sua senha de acesso"
                  required
                />
              </Field>

              {error ? (
                <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                variant="primary"
                className="w-full h-11 text-sm font-medium tracking-wide shadow-md shadow-rose-900/30 transition-all hover:scale-[1.01]"
                loading={busy}
                icon={<ArrowRight className="h-4 w-4" />}
              >
                Entrar no painel
              </Button>

              <p className="text-center text-[11px] leading-relaxed text-stone-500">
                Acesso protegido com criptografia de ponta a ponta.
                <br />
                Bloqueio automático contra tentativas repetidas.
              </p>
            </form>
          )}
        </div>

        <div className="mt-6 space-y-1 text-center text-[10px] text-stone-600">
          <p className="flex items-center justify-center gap-1">
            <ShieldCheck className="h-3 w-3 text-emerald-500/80" /> {pathInfo?.algorithm || 'caminho derivado por HMAC'} · conexão {secure ? 'HTTPS' : 'HTTP local'}
          </p>
          <p className="font-mono-admin">{pathInfo ? `${pathInfo.path} · ${pathInfo.length} caracteres` : ''}</p>
          <p className="flex items-center justify-center gap-1">
            <Fingerprint className="h-3 w-3" /> sessão vinculada a este dispositivo e registrada em auditoria
          </p>
        </div>
      </div>
    </div>
  );
}
