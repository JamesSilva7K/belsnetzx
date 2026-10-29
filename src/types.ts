export interface ProductColor {
  name: string;
  hex: string;
}

export interface ProductInventoryVariant {
  size: string;
  colorName: string;
  stock: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  compareAtPrice?: number;
  costPrice: number;
  description: string;
  fabric: string;
  care: string;
  images: string[];
  sizes: string[];
  colors: ProductColor[];
  inventory: Record<string, number>; // key: `${size}-${colorName}`, value: stock count
  rating: number;
  reviewsCount: number;
  isNewArrival?: boolean;
  isBestSeller?: boolean;
  isFeatured?: boolean;
  inStock: boolean;
  totalStock?: number;
  tags?: string[];
}

export interface Review {
  id: string;
  productId: string;
  userName: string;
  userEmail: string;
  rating: number;
  comment: string;
  date: string;
  verifiedBuyer: boolean;
  fitFeedback: 'fiel ao tamanho' | 'ficou pequeno' | 'ficou grande';
  helpfulCount: number;
}

export interface CartItem {
  cartItemId: string;
  productId: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  selectedSize: string;
  selectedColor: ProductColor;
  quantity: number;
  maxStock: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minPurchase: number;
  maxDiscount?: number;
  validUntil: string;
  maxUses?: number;
  usedCount: number;
  isActive: boolean;
  scope: 'global' | 'specific_product';
  specificProductId?: string;
  description?: string;
}

export interface LeadInfo {
  fullName: string;
  cpf: string;
  email: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  notes?: string;
}

export type OrderPaymentStatus = 'confirmado' | 'pendente' | 'cancelado';
export type OrderFulfillmentStatus = 
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_separacao'
  | 'enviado'
  | 'entregue'
  | 'cancelado';

export interface Order {
  id: string;
  createdAt: string;
  lead: LeadInfo;
  items: CartItem[];
  subtotal: number;
  discount: number;
  couponCodeApplied?: string;
  shippingMethod: 'PAC' | 'SEDEX' | 'Atelier';
  shippingCost: number;
  total: number;
  paymentMethod: 'pix' | 'credit_card' | 'boleto';
  paymentStatus: OrderPaymentStatus;
  orderStatus: OrderFulfillmentStatus;
  trackingCode?: string;
  paymentDetails?: {
    pixCopyPaste?: string;
    pixQrCodeUrl?: string;
    cardLast4?: string;
    cardBrand?: string;
    installments?: number;
    boletoBarcode?: string;
  };
  gatewayTransactionId: string;
  securitySeal?: {
    algorithm: string;
    signature: string;
    shortHash: string;
    fullHash?: string;
    sealedAt: string;
    verified: boolean;
  };
  history: Array<{
    status: OrderFulfillmentStatus;
    timestamp: string;
    note?: string;
  }>;
}

export interface CashFlowEntry {
  id: string;
  type: 'entrada' | 'saida';
  title: string;
  category: 'venda' | 'fornecedor' | 'marketing' | 'embalagens' | 'logistica' | 'taxa_gateway' | 'manutencao' | 'outros';
  amount: number;
  date: string;
  orderId?: string;
  notes?: string;
}

export interface Banner {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  ctaText: string;
  categoryFilter?: string;
  imageUrl: string;
  alignment: 'left' | 'center' | 'right';
  active: boolean;
}

export interface GatewaySettings {
  provider: 'mercadopago' | 'asaas' | 'pagbank' | 'stripe';
  isLiveMode: boolean;
  pixKey: string;
  pixKeyType: 'cnpj' | 'cpf' | 'email' | 'telefone' | 'aleatoria';
  autoConfirmPixInSeconds: number; // 0 = manual, 8 = simulação em 8s
  maxInstallmentsWithoutInterest: number;
  discountForPixPercent: number;
  notificationEmail: string;
}

export interface CustomerUser {
  id: string;
  fullName: string;
  email: string;
  cpf: string;
  phone: string;
  addresses: LeadInfo[];
}

export interface UserBodyProfile {
  height: number;
  weight: number;
  bust: number;
  waist: number;
  hip: number;
  fitPreference: 'justo' | 'padrao' | 'solto';
}

export interface SocialAccountSetting {
  platform: 'instagram' | 'tiktok' | 'facebook' | 'pinterest' | 'whatsapp';
  handle: string;
  url: string;
  isVerified: boolean;
  lastChecked?: string;
  followerCountEstimate?: string;
  notes?: string;
}

export interface StoreCustomizationSettings {
  // Support & Contact
  whatsappNumber: string; // "11987441290"
  whatsappDisplay: string; // "(11) 98744-1290"
  phoneSecondary: string;
  supportEmail: string;
  businessHours: string;
  addressDisplay: string;
  greetingMessage: string;

  // Colors
  primaryColor: string; // default: "#DC7898"
  primaryHoverColor: string; // default: "#C66382"
  accentColor: string; // default: "#9F4E6A"
  headerBgColor: string; // default: "#DC7898"
  headerTextColor: string; // default: "#FFFFFF"
  palettePreset: string; // 'flor_de_seda' | 'rose_romance' | 'nude_chic' | 'lavanda' | 'pessego' | 'sage' | 'custom'

  // Fonts
  titleFont: string; // 'Playfair Display' | 'Cormorant Garamond' | 'Prata' | 'Cinzel' | 'Italiana'
  bodyFont: string; // 'Plus Jakarta Sans' | 'Montserrat' | 'Outfit' | 'Inter'

  // Social Networks
  socials: {
    instagram: SocialAccountSetting;
    tiktok: SocialAccountSetting;
    facebook: SocialAccountSetting;
    pinterest: SocialAccountSetting;
    whatsapp: SocialAccountSetting;
  };
}
