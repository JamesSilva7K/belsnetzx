/** Utilitários de formatação e sanitização compartilhados. */

export function brl(value) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function nowIso() {
  return new Date().toISOString();
}

export function dateTimeBR(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function onlyDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

export function isValidCPF(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const calc = (slice) => {
    let sum = 0;
    for (let i = 0; i < slice; i += 1) sum += Number(cpf[i]) * (slice + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10]);
}

export function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(String(value || '').trim());
}

export function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function maskCpf(value) {
  const cpf = onlyDigits(value);
  if (cpf.length !== 11) return value || '';
  return `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**`;
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function daysAgo(days) {
  const copy = new Date();
  copy.setDate(copy.getDate() - days);
  return copy;
}

export function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
