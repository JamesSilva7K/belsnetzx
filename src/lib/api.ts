/**
 * Cliente HTTP único da aplicação.
 * Nenhum dado de negócio é inventado no navegador: tudo vem da API real.
 */
import type { Product, Order, Coupon, Banner, LeadInfo } from '../types';

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 0, code = 'error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const PUBLIC_BASE = '/api';

const CUSTOMER_TOKEN_KEY = 'aura_customer_token';

export const customerToken = {
  get(): string {
    try {
      return localStorage.getItem(CUSTOMER_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set(token: string) {
    try {
      if (token) localStorage.setItem(CUSTOMER_TOKEN_KEY, token);
      else localStorage.removeItem(CUSTOMER_TOKEN_KEY);
    } catch {
      /* modo privado */
    }
  }
};

async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  const auth = url.startsWith(PUBLIC_BASE) ? customerToken.get() : '';
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(auth ? { Authorization: `Bearer ${auth}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch {
    throw new ApiError('Não foi possível falar com o servidor. Verifique sua conexão.', 0, 'network');
  }

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || (payload && payload.ok === false)) {
    throw new ApiError(payload?.error || `Falha na requisição (${response.status})`, response.status, payload?.code);
  }
  return payload as T;
}

/* --------------------------- Loja (público) --------------------------- */

export interface StorePayload {
  products: Product[];
  banners: Banner[];
  categories: string[];
  settings: {
    customization: Record<string, any>;
    shipping: { freeThreshold: number; pac: number; sedex: number; atelier: number };
    paymentMethods?: Array<{ id: string; name: string; enabled: boolean; badge?: string; imageUrl?: string; description?: string; color?: string }>;
    pix: { configured: boolean; keyType: string; discountForPixPercent: number; maxInstallmentsWithoutInterest: number };
  };
  features: { pixConfigured: boolean; cardCheckout: boolean; telegramConfigured: boolean };
  generatedAt: string;
}

export const shopApi = {
  store: () => request<StorePayload>(`${PUBLIC_BASE}/store`),
  products: () => request<{ products: Product[]; categories: string[] }>(`${PUBLIC_BASE}/products`),
  reviews: (productId: string) =>
    request<{ reviews: any[]; rating: number; count: number }>(`${PUBLIC_BASE}/products/${productId}/reviews`),
  addReview: (body: { productId: string; rating: number; comment: string; fitFeedback: string; name?: string; email?: string }) =>
    request<{ review: any }>(`${PUBLIC_BASE}/reviews`, { method: 'POST', body: JSON.stringify(body) }),
  shippingQuote: (subtotal: number) =>
    request<{ freeThreshold: number; options: Array<{ method: string; label: string; price: number }> }>(
      `${PUBLIC_BASE}/shipping/quote?subtotal=${encodeURIComponent(subtotal)}`
    ),
  validateCoupon: (body: { code: string; subtotal: number; items: any[] }) =>
    request<{ coupon: any; discount: number }>(`${PUBLIC_BASE}/coupons/validate`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  syncCart: (body: { sessionId: string; items: any[]; email?: string }) =>
    request<{ ok: boolean; cart?: any }>(`${PUBLIC_BASE}/cart/sync`, { method: 'POST', body: JSON.stringify(body) }),
  checkout: (body: {
    lead: LeadInfo;
    items: any[];
    couponCode?: string;
    shippingMethod: 'PAC' | 'SEDEX' | 'Atelier';
    paymentMethod: 'pix' | 'credit_card' | 'boleto';
    cardNumber?: string;
    installments?: number;
    cartSessionId?: string;
  }) => request<{ order: Order }>(`${PUBLIC_BASE}/checkout`, { method: 'POST', body: JSON.stringify(body) }),
  order: (id: string, email?: string) =>
    request<{ order: Order }>(`${PUBLIC_BASE}/orders/${encodeURIComponent(id)}${email ? `?email=${encodeURIComponent(email)}` : ''}`),
  register: (body: { name: string; email: string; cpf: string; phone: string; password: string }) =>
    request<{ token: string; customer: CustomerSession }>(`${PUBLIC_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  login: (body: { email: string; password: string }) =>
    request<{ token: string; customer: CustomerSession }>(`${PUBLIC_BASE}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(body)
    }),
  logout: () => request<{ ok: boolean }>(`${PUBLIC_BASE}/auth/logout`, { method: 'POST' }),
  me: () => request<{ customer: any }>(`${PUBLIC_BASE}/auth/me`),
  updateProfile: (body: {
    fullName?: string;
    phone?: string;
    cpf?: string;
    address?: {
      cep: string;
      street: string;
      number: string;
      complement?: string;
      neighborhood: string;
      city: string;
      state: string;
    };
    currentPassword?: string;
    newPassword?: string;
  }) => request<{ ok: boolean; customer: CustomerSession }>(`${PUBLIC_BASE}/auth/me`, {
    method: 'PUT',
    body: JSON.stringify(body)
  }),
  myOrders: () => request<{ orders: Order[] }>(`${PUBLIC_BASE}/me/orders`),
  newsletter: (email: string) =>
    request<{ ok: boolean }>(`${PUBLIC_BASE}/newsletter`, { method: 'POST', body: JSON.stringify({ email }) }),
  health: () => request<{ ok: boolean; uptimeSeconds: number }>(`${PUBLIC_BASE}/health`)
};

export interface CustomerSession {
  id: string;
  name: string;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  addresses?: Array<{
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
  }>;
}

/* ------------------------ Painel (caminho cifrado) ------------------------ */

export function adminBaseUrl(): string {
  const path = window.location.pathname.replace(/\/+$/, '');
  return `${path}/api`;
}

const ADMIN_TOKEN_KEY = 'aura_admin_token';

export const adminToken = {
  get(): string {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY) || '';
    } catch {
      return '';
    }
  },
  set(token: string) {
    try {
      if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
      else localStorage.removeItem(ADMIN_TOKEN_KEY);
    } catch {
      /* modo privado */
    }
  }
};

async function adminRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = adminToken.get();
  return request<T>(`${adminBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
}

export const adminApi = {
  session: () => adminRequest<{ authenticated: boolean; session?: any; path: any }>('/auth/session'),
  login: (username: string, password: string) =>
    adminRequest<{ token: string; session: { username: string; expiresAt: string } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  verify: (challengeId: string, code: string) =>
    adminRequest<{ token: string; session: { username: string; expiresAt: string } }>('/auth/verify', {
      method: 'POST',
      body: JSON.stringify({ challengeId, code })
    }),
  entry: (token: string) =>
    adminRequest<{ token: string; session: { username: string; expiresAt: string } }>('/auth/entry', {
      method: 'POST',
      body: JSON.stringify({ token })
    }),
  logout: () => adminRequest<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  overview: () => adminRequest<{ metrics: any }>('/overview'),
  orders: (params: { status?: string; search?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as any).toString();
    return adminRequest<{ orders: Order[] }>(`/orders${query ? `?${query}` : ''}`);
  },
  order: (id: string) => adminRequest<{ order: Order }>(`/orders/${id}`),
  payOrder: (id: string, note = '') =>
    adminRequest<{ order: Order }>(`/orders/${id}/pay`, { method: 'POST', body: JSON.stringify({ note }) }),
  setOrderStatus: (id: string, status: string, note = '') =>
    adminRequest<{ order: Order }>(`/orders/${id}/status`, { method: 'POST', body: JSON.stringify({ status, note }) }),
  setTracking: (id: string, trackingCode: string, note = '') =>
    adminRequest<{ order: Order; whatsappUrl?: string; whatsappMsg?: string }>(`/orders/${id}/tracking`, {
      method: 'POST',
      body: JSON.stringify({ trackingCode, note })
    }),
  deleteOrder: (id: string) => adminRequest<{ ok: boolean }>(`/orders/${id}`, { method: 'DELETE' }),

  products: () => adminRequest<{ products: Product[] }>('/products'),
  createProduct: (body: any) => adminRequest<{ product: Product }>('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id: string, body: any) =>
    adminRequest<{ product: Product }>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteProduct: (id: string) => adminRequest<{ ok: boolean }>(`/products/${id}`, { method: 'DELETE' }),

  stock: () => adminRequest<{ products: any[]; totals: any; criticalCount: number; lowStockThreshold: number }>('/stock'),
  movements: (params: { limit?: number; productId?: string; type?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as any).toString();
    return adminRequest<{ movements: any[] }>(`/stock/movements${query ? `?${query}` : ''}`);
  },
  moveStock: (body: { productId: string; variantKey: string; type: 'entrada' | 'saida'; quantity: number; reason: string; note?: string }) =>
    adminRequest<{ movement: any }>('/stock/move', { method: 'POST', body: JSON.stringify(body) }),

  cashflow: (params: { limit?: number; type?: string } = {}) => {
    const query = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as any).toString();
    return adminRequest<{ entries: any[] }>(`/cashflow${query ? `?${query}` : ''}`);
  },
  addCashflow: (body: any) => adminRequest<{ entry: any }>('/cashflow', { method: 'POST', body: JSON.stringify(body) }),
  deleteCashflow: (id: string) => adminRequest<{ ok: boolean }>(`/cashflow/${id}`, { method: 'DELETE' }),
  clearTestData: () => adminRequest<{ ok: boolean; message: string }>('/finance/clear-test-data', { method: 'POST' }),

  carts: (status?: string) => adminRequest<{ carts: any[] }>(`/carts${status ? `?status=${status}` : ''}`),
  contactCart: (id: string) => adminRequest<{ cart: any }>(`/carts/${id}/contacted`, { method: 'POST' }),

  customers: (search = '') => adminRequest<{ customers: any[] }>(`/customers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  customer: (id: string) => adminRequest<{ customer: any }>(`/customers/${id}`),
  reviews: () => adminRequest<{ reviews: any[] }>('/reviews'),

  coupons: () => adminRequest<{ coupons: Coupon[] }>('/coupons'),
  createCoupon: (body: any) => adminRequest<{ coupon: Coupon }>('/coupons', { method: 'POST', body: JSON.stringify(body) }),
  updateCoupon: (id: string, body: any) => adminRequest<{ coupon: Coupon }>(`/coupons/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleCoupon: (id: string) => adminRequest<{ coupon: Coupon }>(`/coupons/${id}/toggle`, { method: 'POST' }),
  deleteCoupon: (id: string) => adminRequest<{ ok: boolean }>(`/coupons/${id}`, { method: 'DELETE' }),

  banners: () => adminRequest<{ banners: Banner[] }>('/banners'),
  createBanner: (body: any) => adminRequest<{ banner: Banner }>('/banners', { method: 'POST', body: JSON.stringify(body) }),
  updateBanner: (id: string, body: any) => adminRequest<{ banner: Banner }>(`/banners/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteBanner: (id: string) => adminRequest<{ ok: boolean }>(`/banners/${id}`, { method: 'DELETE' }),

  settings: () => adminRequest<{ settings: any }>('/settings'),
  saveCustomization: (body: any) => adminRequest<{ customization: any }>('/settings/customization', { method: 'PUT', body: JSON.stringify(body) }),
  saveGateway: (body: any) => adminRequest<{ gateway: any }>('/settings/gateway', { method: 'PUT', body: JSON.stringify(body) }),
  saveShipping: (body: any) => adminRequest<{ shipping: any }>('/settings/shipping', { method: 'PUT', body: JSON.stringify(body) }),
  savePaymentMethods: (methods: any[]) => adminRequest<{ paymentMethods: any[] }>('/settings/payment-methods', { method: 'PUT', body: JSON.stringify({ paymentMethods: methods }) }),
  syncPayBalance: () => adminRequest<{ enabled: boolean; connected?: boolean; balance?: number; pending?: number; error?: string }>('/syncpay/balance'),
  syncPayTest: () => adminRequest<{ ok: boolean; connected: boolean; balance: any }>('/syncpay/test', { method: 'POST' }),

  notifications: () => adminRequest<{ notifications: any[] }>('/notifications'),

  telegramStatus: () => adminRequest<{ status: any }>('/telegram/status'),
  telegramConfigure: (body: { token: string; chatId: string; adminIds: string; enabled?: boolean }) =>
    adminRequest<{ status: any }>('/telegram/configure', { method: 'POST', body: JSON.stringify(body) }),
  telegramTest: () => adminRequest<{ message: string }>('/telegram/test', { method: 'POST' }),
  telegramDisconnect: () => adminRequest<{ status: any }>('/telegram/disconnect', { method: 'POST' }),
  panelLink: (minutes = 10) => adminRequest<{ url: string; expiresAt: string }>('/telegram/link', { method: 'POST', body: JSON.stringify({ minutes }) }),

  security: () => adminRequest<any>('/security'),
  firewall: () => adminRequest<any>('/security/firewall'),
  unbanIp: (ip: string) => adminRequest<any>('/security/firewall/unban', { method: 'POST', body: JSON.stringify({ ip }) }),
  verifyOrderSeal: (id: string) => adminRequest<any>(`/orders/${id}/verify-seal`),
  sessions: () => adminRequest<{ sessions: any[] }>('/security/sessions'),
  revokeSession: (id: string) => adminRequest<{ ok: boolean }>(`/security/sessions/${id}/revoke`, { method: 'POST' }),
  changeCredentials: (body: {
    currentPassword: string;
    code: string;
    newUsername?: string;
    newPassword?: string;
    rotateTotp?: boolean;
    rotatePath?: boolean;
  }) => adminRequest<any>('/security/credentials', { method: 'POST', body: JSON.stringify(body) })
};

export function formatBRL(value: number): string {
  return (Number(value) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}
