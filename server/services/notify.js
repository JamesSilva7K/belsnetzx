/** * Central de notificações * Todo evento de negócio passa por aqui: grava no banco, publica no painel * (SSE) e encaminha para os destinos registrados (bot do Telegram). */
import { addNotification, bus, db } from '../lib/db.js'; const sinks = []; /** Registra um destino. `handler(notification)` pode ser async. */
export function registerSink(name, handler) { sinks.push({ name, handler }); return () => { const index = sinks.findIndex((sink) => sink.name === name); if (index >= 0) sinks.splice(index, 1); };
} /** * @param {object} input * @param {string} input.type order_created | order_paid | stock_in | ... * @param {string} input.title * @param {string} input.detail texto plano (usado no painel) * @param {string} [input.html] corpo HTML para o Telegram * @param {object} [input.meta] dados extras (orderId, buttons, etc.) */
export function notify(input) { const notification = addNotification({ type: input.type, title: input.title, detail: input.detail || '', html: input.html || '', meta: input.meta || {}, severity: input.severity || 'info' }); bus.emit('notification', notification); for (const sink of sinks) { Promise.resolve() .then(() => sink.handler(notification)) .catch((error) => { console.error(`[notify] Falha no destino "${sink.name}" (tipo: ${notification.type}):`, error.message); }); } return notification;
} export function recentNotifications(limit = 50) { return db().notifications.slice(0, limit);
} export function markAllRead() { return { readAt: new Date().toISOString() };
}
