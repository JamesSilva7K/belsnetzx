/**
 * 🗄️ Camada de persistência — banco JSON com escrita atômica
 * -------------------------------------------------
 * - Arquivo único (server/data/db.json) gravado via tmp + rename (atômico)
 * - Cópia de segurança automática a cada 50 gravações (db.backup.json)
 * - EventEmitter para o painel em tempo real (SSE) e para o bot do Telegram
 */
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { config } from '../config.js';
import { buildSeed } from '../seed/index.js';

const DB_FILE = path.join(config.dataDir, 'db.json');
const BACKUP_FILE = path.join(config.dataDir, 'db.backup.json');

export const bus = new EventEmitter();
bus.setMaxListeners(64);

let state = null;
let writeCount = 0;

function migrate(data) {
  const seed = buildSeed();
  const merged = { ...seed, ...data };
  merged.meta = { ...seed.meta, ...(data.meta || {}) };
  merged.settings = {
    customization: { ...seed.settings.customization, ...(data.settings?.customization || {}) },
    gateway: { ...seed.settings.gateway, ...(data.settings?.gateway || {}) },
    shipping: { ...seed.settings.shipping, ...(data.settings?.shipping || {}) },
    paymentMethods: data.settings?.paymentMethods || seed.settings.paymentMethods
  };
  merged.telegram = { ...seed.telegram, ...(data.telegram || {}) };
  merged.counters = { ...seed.counters, ...(data.counters || {}) };
  merged.meta.version = seed.meta.version;
  return merged;
}

export function db() {
  if (state) return state;

  if (fs.existsSync(DB_FILE)) {
    try {
      state = migrate(JSON.parse(fs.readFileSync(DB_FILE, 'utf8')));
      return state;
    } catch (error) {
      console.error('[db] Banco corrompido, tentando backup:', error.message);
      if (fs.existsSync(BACKUP_FILE)) {
        state = migrate(JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8')));
        return state;
      }
      console.error('[db] Backup indisponível. Criando banco novo — os dados anteriores foram preservados em db.corrupted.json');
      fs.copyFileSync(DB_FILE, path.join(config.dataDir, 'db.corrupted.json'));
    }
  }

  state = buildSeed();
  persist();
  return state;
}

function persist() {
  const payload = JSON.stringify(state, null, 2);
  try {
    fs.writeFileSync(DB_FILE, payload, 'utf8');
  } catch (err) {
    try {
      const tmp = `${DB_FILE}.tmp`;
      fs.writeFileSync(tmp, payload, 'utf8');
      try { fs.unlinkSync(DB_FILE); } catch {}
      fs.renameSync(tmp, DB_FILE);
    } catch (e2) {
      console.error('[db] Falha persist:', e2.message);
    }
  }
  writeCount += 1;
  if (writeCount % 50 === 0) {
    try {
      fs.copyFileSync(DB_FILE, BACKUP_FILE);
    } catch (error) {
      console.error('[db] Falha ao gerar backup:', error.message);
    }
  }
}

/** Executa uma mutação e persiste. Retorna o valor produzido pela função. */
export function commit(mutator, { event = null, payload = null } = {}) {
  const data = db();
  const result = mutator(data);
  data.meta.updatedAt = new Date().toISOString();
  persist();
  // Sempre emite 'change' para o painel SSE; quando há evento explícito, envia dados extras
  bus.emit('change', event ? { event, payload, at: data.meta.updatedAt } : undefined);
  return result;
}

/** Leitura somente-leitura (não precisa persistir). */
export function read(fn) {
  return fn(db());
}

export function addAudit(entry) {
  return commit((data) => {
    const record = {
      id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...entry
    };
    data.auditLog.unshift(record);
    if (data.auditLog.length > 800) data.auditLog.length = 800;
    return record;
  });
}

export function addNotification(entry) {
  return commit((data) => {
    const record = {
      id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      at: new Date().toISOString(),
      ...entry
    };
    data.notifications.unshift(record);
    if (data.notifications.length > 400) data.notifications.length = 400;
    return record;
  });
}

export function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
