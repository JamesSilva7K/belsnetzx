import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { Product, CartItem, Coupon, Order, Banner, Review, ProductColor, UserBodyProfile, LeadInfo } from '../types';
import { shopApi, customerToken, ApiError, type CustomerSession, type StorePayload } from '../lib/api';
import { applyStoreMeta, setupAntiCopyShield } from '../lib/antiCopyShield';

/* ------------------------------------------------------------------ *
 * Tipos
 * ------------------------------------------------------------------ */

interface CartTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemsCount: number;
  freeShippingThreshold: number;
}

export interface StoreLocation {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
}

export interface StoreCustomization {
  companyName: string;
  pageTitle: string;
  faviconUrl: string;
  whatsappNumber: string;
  whatsappDisplay: string;
  supportEmail: string;
  businessHours: string;
  addressDisplay: string;
  storeLocation?: StoreLocation;
  storeStatus?: 'online' | 'maintenance' | 'private';
  maintenanceTitle?: string;
  maintenanceMessage?: string;
  antiCopyProtection?: boolean;
  greetingMessage: string;
  primaryColor: string;
  primaryHoverColor: string;
  accentColor: string;
  headerBgColor: string;
  headerTextColor: string;
  palettePreset: string;
  titleFont: string;
  bodyFont: string;
  socials: Record<string, { platform: string; handle: string; url: string }>;
}

interface StoreContextType {
  ready: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;

  products: Product[];
  banners: Banner[];
  customization: StoreCustomization;
  paymentMethods: Array<{ id: string; name: string; enabled: boolean; badge?: string; imageUrl?: string; description?: string; color?: string }>;
  pixConfig: { configured: boolean; discountForPixPercent: number; maxInstallments: number };
  shippingConfig: { freeThreshold: number; options: Array<{ method: string; label: string; price: number }> };

  reviews: Record<string, Review[]>;
  getProductReviews: (productId: string) => Review[];
  loadReviews: (productId: string) => Promise<void>;
  addReview: (input: {
    productId: string;
    rating: number;
    comment: string;
    fitFeedback: Review['fitFeedback'];
    name?: string;
    email?: string;
  }) => Promise<{ ok: boolean; error?: string }>;

  cart: CartItem[];
  addToCart: (product: Product, size: string, color: ProductColor, quantity?: number) => { success: boolean; message?: string };
  removeFromCart: (cartItemId: string) => void;
  updateCartQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  cartTotals: CartTotals;

  appliedCoupon: Coupon | null;
  couponError: string | null;
  applyCouponCode: (code: string) => Promise<boolean>;
  removeCoupon: () => void;

  wishlist: string[];
  toggleWishlist: (productId: string) => void;
  isInWishlist: (productId: string) => boolean;

  orders: Order[];
  createOrder: (input: {
    lead: LeadInfo;
    shippingMethod: 'PAC' | 'SEDEX' | 'Atelier';
    paymentMethod: 'pix' | 'credit_card' | 'boleto';
    cardNumber?: string;
    installments?: number;
  }) => Promise<Order>;

  customerUser: CustomerSession | null;
  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (data: { name: string; email: string; cpf: string; phone: string; password: string }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateCustomerProfile: (data: {
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
  }) => Promise<{ ok: boolean; error?: string }>;
  setCustomerUser: React.Dispatch<React.SetStateAction<CustomerSession | null>>;

  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  selectedSizeFilter: string;
  setSelectedSizeFilter: (value: string) => void;
  sortBy: string;
  setSortBy: (value: string) => void;

  isCartOpen: boolean;
  setIsCartOpen: (value: boolean) => void;
  isCheckoutOpen: boolean;
  setIsCheckoutOpen: (value: boolean) => void;
  isAuthOpen: boolean;
  setIsAuthOpen: (value: boolean) => void;
  isSizeGuideOpen: boolean;
  setIsSizeGuideOpen: (value: boolean) => void;
  selectedProductDetail: Product | null;
  setSelectedProductDetail: (product: Product | null) => void;

  userBodyProfile: UserBodyProfile | null;
  setUserBodyProfile: (profile: UserBodyProfile | null) => void;
  provadorTargetProduct: Product | null;
  openProvadorVirtual: (product?: Product | null) => void;
  appliedSizeFromProvador: string | null;
  setAppliedSizeFromProvador: (size: string | null) => void;
}

const StoreContext = createContext<StoreContextType | undefined>(undefined);

/* ------------------------------------------------------------------ *
 * Utilidades locais (apenas preferências do navegador)
 * ------------------------------------------------------------------ */

const CART_KEY = 'aura_cart_v2';
const WISHLIST_KEY = 'aura_wishlist_v2';
const BODY_KEY = 'aura_body_profile_v2';
const SESSION_KEY = 'aura_cart_session_v2';

function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage indisponível */
  }
}

function ensureCartSession(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, generated);
    return generated;
  } catch {
    return `fallback-${Date.now()}`;
  }
}

const FALLBACK_CUSTOMIZATION: StoreCustomization = {
  companyName: 'Flor de Seda',
  pageTitle: 'Flor de Seda | Moda Feminina Elegante & Peças Nobres',
  faviconUrl: '',
  whatsappNumber: '11987441290',
  whatsappDisplay: '(11) 98744-1290',
  supportEmail: 'contato@flordeseda.com.br',
  businessHours: 'Seg a Sex: 09h às 19h',
  addressDisplay: 'Alameda Lorena, 1420 — Jardins, São Paulo/SP',
  storeLocation: {
    cep: '01424-002',
    street: 'Alameda Lorena',
    number: '1420',
    complement: 'Atelier',
    neighborhood: 'Jardins',
    city: 'São Paulo',
    state: 'SP'
  },
  storeStatus: 'online',
  maintenanceTitle: 'Atelier Flor de Seda em Atualização',
  maintenanceMessage: 'Estamos organizando novas coleções e peças exclusivas no atelier. Retornaremos em instantes para recebê-la com todo o carinho!',
  antiCopyProtection: true,
  greetingMessage: 'Olá! Gostaria de tirar uma dúvida.',
  primaryColor: '#DC7898',
  primaryHoverColor: '#C66382',
  accentColor: '#9F4E6A',
  headerBgColor: '#DC7898',
  headerTextColor: '#FFFFFF',
  palettePreset: 'flor_de_seda',
  titleFont: 'Playfair Display',
  bodyFont: 'Plus Jakarta Sans',
  socials: {}
};

/* ------------------------------------------------------------------ *
 * Provider
 * ------------------------------------------------------------------ */

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<StorePayload | null>(null);

  const [reviews, setReviews] = useState<Record<string, Review[]>>({});
  const [cart, setCart] = useState<CartItem[]>(() => readLocal<CartItem[]>(CART_KEY, []));
  const [wishlist, setWishlist] = useState<string[]>(() => readLocal<string[]>(WISHLIST_KEY, []));
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerUser, setCustomerUser] = useState<CustomerSession | null>(null);

  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSizeFilter, setSelectedSizeFilter] = useState('Todos');
  const [sortBy, setSortBy] = useState('destaque');

  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSizeGuideOpen, setIsSizeGuideOpen] = useState(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<Product | null>(null);

  const [userBodyProfile, setUserBodyProfile] = useState<UserBodyProfile | null>(() =>
    readLocal<UserBodyProfile | null>(BODY_KEY, null)
  );
  const [provadorTargetProduct, setProvadorTargetProduct] = useState<Product | null>(null);
  const [appliedSizeFromProvador, setAppliedSizeFromProvador] = useState<string | null>(null);

  const openProvadorVirtual = useCallback(
    (product?: Product | null) => {
      setProvadorTargetProduct(product || selectedProductDetail || null);
      setIsSizeGuideOpen(true);
    },
    [selectedProductDetail]
  );

  const cartSessionId = useRef<string>(ensureCartSession());

  /* --------------------------- Carregamento --------------------------- */

  const loadStore = useCallback(async () => {
    setLoading(true);
    try {
      const data = await shopApi.store();
      setPayload(data);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Falha ao carregar a loja.');
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, []);

  const loadSession = useCallback(async () => {
    if (!customerToken.get()) return;
    try {
      const data = await shopApi.me();
      setCustomerUser(data.customer);
      const mine = await shopApi.myOrders().catch(() => ({ orders: [] as Order[] }));
      setOrders(mine.orders);
    } catch {
      customerToken.set('');
      setCustomerUser(null);
    }
  }, []);

useEffect(() => {
    loadStore();
    loadSession();
  }, [loadStore, loadSession]);

  /* --------------- Sincronização inteligente em tempo real (SSE + Fallback) --------------- */
  useEffect(() => {
    let source: EventSource | null = null;
    let fallbackTimer: any = null;

    try {
      source = new EventSource('/api/events');
      source.addEventListener('change', () => {
        loadStore();
        if (customerToken.get()) loadSession();
      });
      source.onerror = () => {
        if (!fallbackTimer) {
          fallbackTimer = setInterval(() => {
            loadStore();
            if (customerToken.get()) loadSession();
          }, 12000);
        }
      };
    } catch {
      fallbackTimer = setInterval(() => {
        loadStore();
        if (customerToken.get()) loadSession();
      }, 12000);
    }

    return () => {
      if (source) source.close();
      if (fallbackTimer) clearInterval(fallbackTimer);
    };
  }, [loadStore, loadSession]);

  /* ------------------------- Persistência local ------------------------- */

  useEffect(() => writeLocal(CART_KEY, cart), [cart]);
  useEffect(() => writeLocal(WISHLIST_KEY, wishlist), [wishlist]);
  useEffect(() => writeLocal(BODY_KEY, userBodyProfile), [userBodyProfile]);

  /* --------------- Sincronização real do carrinho (servidor) --------------- */

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!ready) return;
      shopApi
        .syncCart({
          sessionId: cartSessionId.current,
          email: customerUser?.email,
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            selectedSize: item.selectedSize,
            selectedColor: item.selectedColor,
            image: item.image
          }))
        })
        .catch(() => {
          /* rastreamento é best-effort; nunca interrompe a compra */
        });
    }, 900);
    return () => clearTimeout(timer);
  }, [cart, customerUser, ready]);

  /* ------------------------- Cores e tipografia ------------------------- */

  const customization = useMemo<StoreCustomization>(() => {
    const source = (payload?.settings?.customization || {}) as Partial<StoreCustomization>;
    return { ...FALLBACK_CUSTOMIZATION, ...source } as StoreCustomization;
  }, [payload]);

  useEffect(() => {
    try {
      const root = document.documentElement;
      root.style.setProperty('--color-primary', customization.primaryColor);
      root.style.setProperty('--color-primary-hover', customization.primaryHoverColor);
      root.style.setProperty('--color-accent', customization.accentColor);
      root.style.setProperty('--color-header-bg', customization.headerBgColor);
      root.style.setProperty('--font-serif', `'${customization.titleFont}', Georgia, serif`);
      root.style.setProperty('--font-sans', `'${customization.bodyFont}', system-ui, sans-serif`);

      // Atualização em tempo real do Título da Página no Navegador
      if (customization.pageTitle) {
        document.title = customization.pageTitle;
      }

      // Atualização em tempo real do Favicon no Navegador
      if (customization.faviconUrl) {
        let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'shortcut icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = customization.faviconUrl;
      }
    } catch {
      /* ignore */
    }
    const cleanup = setupAntiCopyShield(customization.antiCopyProtection !== false);
    return cleanup;
  }, [customization]);

  const products = payload?.products || [];
  const banners = payload?.banners || [];
  const paymentMethods = payload?.settings?.paymentMethods || [
    { id: 'pix', name: 'PIX', enabled: true, badge: 'Aprovação Imediata' },
    { id: 'credit_card', name: 'CARTÃO (ATENDIMENTO)', enabled: true, badge: 'Personalizado' }
  ];

  const pixConfig = useMemo(
    () => ({
      configured: Boolean(payload?.settings?.pix?.configured),
      discountForPixPercent: Number(payload?.settings?.pix?.discountForPixPercent || 0),
      maxInstallments: Number(payload?.settings?.pix?.maxInstallmentsWithoutInterest || 1)
    }),
    [payload]
  );

  const shippingConfig = useMemo(() => {
    const shipping = payload?.settings?.shipping;
    const freeThreshold = Number(shipping?.freeThreshold ?? 299);
    return {
      freeThreshold,
      options: [
        { method: 'PAC', label: 'PAC (4 a 8 dias úteis)', price: Number(shipping?.pac ?? 19.9) },
        { method: 'SEDEX', label: 'SEDEX (1 a 3 dias úteis)', price: Number(shipping?.sedex ?? 34.9) },
        { method: 'Atelier', label: 'Retirada no atelier', price: 0 }
      ]
    };
  }, [payload]);

  /* ------------------------------ Reviews ------------------------------ */

  const loadReviews = useCallback(async (productId: string) => {
    try {
      const data = await shopApi.reviews(productId);
      setReviews((prev) => ({ ...prev, [productId]: data.reviews }));
    } catch {
      /* ignore */
    }
  }, []);

  const getProductReviews = useCallback((productId: string) => reviews[productId] || [], [reviews]);

  const addReview = useCallback<StoreContextType['addReview']>(
    async (input) => {
      try {
        await shopApi.addReview({
          productId: input.productId,
          rating: input.rating,
          comment: input.comment,
          fitFeedback: input.fitFeedback,
          name: input.name,
          email: input.email
        });
        await loadReviews(input.productId);
        await loadStore();
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof ApiError ? err.message : 'Não foi possível enviar sua avaliação.' };
      }
    },
    [loadReviews, loadStore]
  );

  /* ------------------------------- Carrinho ------------------------------- */

  const addToCart = useCallback<StoreContextType['addToCart']>(
    (product, size, color, quantity = 1) => {
      const variantKey = `${size}-${color.name}`;
      const stock = Number(product.inventory?.[variantKey] ?? 0);

      if (stock <= 0) {
        return { success: false, message: 'Esta variação está esgotada no momento.' };
      }

      const cartItemId = `${product.id}-${variantKey}`;
      const existing = cart.find((item) => item.cartItemId === cartItemId);
      const nextQuantity = (existing?.quantity || 0) + quantity;

      if (nextQuantity > stock) {
        return {
          success: false,
          message: `Apenas ${stock} unidade(s) disponível(is) desta variação.`
        };
      }

      // Cálculo síncrono: o retorno não depende do updater do React
      const nextCart = existing
        ? cart.map((item) => (item.cartItemId === cartItemId ? { ...item, quantity: nextQuantity } : item))
        : [
            ...cart,
            {
              cartItemId,
              productId: product.id,
              name: product.name,
              price: product.price,
              originalPrice: product.compareAtPrice,
              image: product.images?.[0] || '',
              selectedSize: size,
              selectedColor: color,
              quantity,
              maxStock: stock
            }
          ];

      setCart(nextCart);
      setIsCartOpen(true);
      return { success: true };
    },
    [cart]
  );

  const removeFromCart = useCallback((cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  }, []);

  const updateCartQuantity = useCallback((cartItemId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) return prev.filter((item) => item.cartItemId !== cartItemId);
      return prev.map((item) =>
        item.cartItemId === cartItemId ? { ...item, quantity: Math.min(quantity, item.maxStock) } : item
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    setAppliedCoupon(null);
    setCouponError(null);
  }, []);

  /* ------------------------------- Cupons ------------------------------- */

  const applyCouponCode = useCallback(
    async (code: string) => {
      setCouponError(null);
      const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      try {
        const result = await shopApi.validateCoupon({
          code,
          subtotal,
          items: cart.map((item) => ({ productId: item.productId, price: item.price, quantity: item.quantity }))
        });
        setAppliedCoupon({
          id: result.coupon.code,
          code: result.coupon.code,
          discountType: result.coupon.discountType,
          discountValue: result.coupon.discountValue,
          minPurchase: 0,
          validUntil: '',
          usedCount: 0,
          isActive: true,
          scope: 'global',
          description: result.coupon.description
        } as Coupon);
        return true;
      } catch (err) {
        setAppliedCoupon(null);
        setCouponError(err instanceof ApiError ? err.message : 'Cupom inválido.');
        return false;
      }
    },
    [cart]
  );

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponError(null);
  }, []);

  const cartTotals = useMemo<CartTotals>(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const itemsCount = cart.reduce((sum, item) => sum + item.quantity, 0);

    let discount = 0;
    if (appliedCoupon) {
      discount =
        appliedCoupon.discountType === 'percentage'
          ? (subtotal * appliedCoupon.discountValue) / 100
          : Math.min(appliedCoupon.discountValue, subtotal);
    }

    const freeThreshold = shippingConfig.freeThreshold;
    const pac = shippingConfig.options.find((option) => option.method === 'PAC')?.price ?? 0;
    const shipping = subtotal === 0 || subtotal >= freeThreshold ? 0 : pac;

    return {
      subtotal,
      discount,
      shipping,
      total: Math.max(0, subtotal - discount + shipping),
      itemsCount,
      freeShippingThreshold: freeThreshold
    };
  }, [cart, appliedCoupon, shippingConfig]);

  /* ------------------------------ Wishlist ------------------------------ */

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((prev) => (prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]));
  }, []);

  const isInWishlist = useCallback((productId: string) => wishlist.includes(productId), [wishlist]);

  /* ------------------------------- Pedidos ------------------------------- */

  const createOrder = useCallback<StoreContextType['createOrder']>(
    async (input) => {
      const response = await shopApi.checkout({
        lead: input.lead,
        items: cart.map((item) => ({
          productId: item.productId,
          selectedSize: item.selectedSize,
          selectedColor: { name: item.selectedColor.name, hex: item.selectedColor.hex },
          quantity: item.quantity
        })),
        couponCode: appliedCoupon?.code,
        shippingMethod: input.shippingMethod,
        paymentMethod: input.paymentMethod,
        cardNumber: input.cardNumber,
        installments: input.installments,
        cartSessionId: cartSessionId.current
      });

      setCart([]);
      setAppliedCoupon(null);
      setOrders((prev) => [response.order, ...prev]);
      await loadStore();
      return response.order;
    },
    [cart, appliedCoupon, loadStore]
  );

  /* ------------------------------ Autenticação ------------------------------ */

  const login = useCallback<StoreContextType['login']>(async (email, password) => {
    try {
      const result = await shopApi.login({ email, password });
      customerToken.set(result.token);
      setCustomerUser(result.customer);
      const mine = await shopApi.myOrders().catch(() => ({ orders: [] as Order[] }));
      setOrders(mine.orders);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof ApiError ? err.message : 'Não foi possível entrar.' };
    }
  }, []);

  const register = useCallback<StoreContextType['register']>(
    async (data) => {
      try {
        const result = await shopApi.register(data);
        customerToken.set(result.token);
        setCustomerUser(result.customer);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: err instanceof ApiError ? err.message : 'Não foi possível criar sua conta.' };
      }
    },
    []
  );

  
  const updateCustomerProfile = useCallback(async (data: any) => {
    try {
      const res = await shopApi.updateProfile(data);
      if (res.ok) {
        setCustomerUser(res.customer);
        return { ok: true };
      }
      return { ok: false, error: 'Falha ao atualizar cadastro.' };
    } catch (err: any) {
      return { ok: false, error: err?.message || 'Falha ao atualizar cadastro.' };
    }
  }, []);

  const logout = useCallback(async () => {
    await shopApi.logout().catch(() => undefined);
    customerToken.set('');
    setCustomerUser(null);
    setOrders([]);
  }, []);

  const value: StoreContextType = {
    ready,
    loading,
    error,
    refresh: loadStore,

    products,
    banners,
    customization,
    paymentMethods,
    pixConfig,
    shippingConfig,

    reviews,
    getProductReviews,
    loadReviews,
    addReview,

    cart,
    addToCart,
    removeFromCart,
    updateCartQuantity,
    clearCart,
    cartTotals,

    appliedCoupon,
    couponError,
    applyCouponCode,
    removeCoupon,

    wishlist,
    toggleWishlist,
    isInWishlist,

    orders,
    createOrder,

    customerUser,
    login,
    register,
    logout,
    updateCustomerProfile,
    setCustomerUser,

    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedSizeFilter,
    setSelectedSizeFilter,
    sortBy,
    setSortBy,

    isCartOpen,
    setIsCartOpen,
    isCheckoutOpen,
    setIsCheckoutOpen,
    isAuthOpen,
    setIsAuthOpen,
    isSizeGuideOpen,
    setIsSizeGuideOpen,
    selectedProductDetail,
    setSelectedProductDetail,

    userBodyProfile,
    setUserBodyProfile,
    provadorTargetProduct,
    openProvadorVirtual,
    appliedSizeFromProvador,
    setAppliedSizeFromProvador
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) throw new Error('useStore precisa ser usado dentro de StoreProvider');
  return context;
};
