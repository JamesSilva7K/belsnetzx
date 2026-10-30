/**
 *  Estado inicial real do sistema.
 * Nenhum pedido, cliente, avaliação, carrinho ou lançamento financeiro fictício:
 * essas coleções começam vazias e só recebem dados reais de uso.
 */
import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.join(import.meta.dirname, '..', 'seed', 'catalog.json');

function loadCatalog() {
  const raw = fs.readFileSync(catalogPath, 'utf8');
  return JSON.parse(raw);
}

export const DEFAULT_CUSTOMIZATION = {
  companyName: 'Flor de Seda',
  pageTitle: 'Flor de Seda | Moda Feminina Elegante & Peças Nobres',
  faviconUrl: '',
  whatsappNumber: '11987441290',
  whatsappDisplay: '(11) 98744-1290',
  phoneSecondary: '',
  supportEmail: 'contato@flordeseda.com.br',
  businessHours: 'Seg a Sex: 09h às 19h | Sáb: 09h às 14h',
  addressDisplay: 'Alameda Lorena, 1420 — Jardins, São Paulo/SP',
  storeLocation: {
    cep: '01424-002',
    street: 'Alameda Lorena',
    number: '1420',
    complement: 'Atelier Jardins',
    neighborhood: 'Jardins',
    city: 'São Paulo',
    state: 'SP'
  },
  storeStatus: 'online', // 'online' | 'maintenance' | 'private'
  maintenanceTitle: 'Atelier Flor de Seda em Atualização',
  maintenanceMessage: 'Estamos organizando novas coleções e peças exclusivas no atelier. Retornaremos em instantes para recebê-la com todo o carinho!',
  antiCopyProtection: true, // Blindagem contra cópia, inspect e scrapers
  greetingMessage: 'Olá! Gostaria de tirar uma dúvida sobre as peças.',
  primaryColor: '#DC7898',
  primaryHoverColor: '#C66382',
  accentColor: '#9F4E6A',
  headerBgColor: '#DC7898',
  headerTextColor: '#FFFFFF',
  palettePreset: 'flor_de_seda',
  titleFont: 'Playfair Display',
  bodyFont: 'Plus Jakarta Sans',
  socials: {
    instagram: { platform: 'instagram', handle: 'flordesedaboutique', url: 'https://instagram.com/flordesedaboutique' },
    tiktok: { platform: 'tiktok', handle: 'flordeseda.oficial', url: 'https://tiktok.com/@flordeseda.oficial' },
    facebook: { platform: 'facebook', handle: 'flordesedamodafeminina', url: 'https://facebook.com/flordesedamodafeminina' },
    pinterest: { platform: 'pinterest', handle: 'flordesedamoda', url: 'https://pinterest.com/flordesedamoda' },
    whatsapp: { platform: 'whatsapp', handle: '(11) 98744-1290', url: 'https://wa.me/5511987441290' }
  }
};

export const DEFAULT_PAYMENT_METHODS = [
  {
    id: 'pix',
    name: 'PIX',
    enabled: true,
    badge: 'Aprovação Imediata',
    imageUrl: '',
    description: 'Pagamento instantâneo via QR Code ou Copia e Cola',
    color: '#047857'
  },
  {
    id: 'credit_card',
    name: 'CARTÃO (ATENDIMENTO)',
    enabled: true,
    badge: 'Personalizado',
    imageUrl: '',
    description: 'Pagamento via link seguro ou maquininha com a consultora',
    color: '#374151'
  },
  {
    id: 'gateway_card',
    name: 'CARTÃO DE CRÉDITO ONLINE',
    enabled: false,
    badge: 'Até 12x',
    imageUrl: '',
    description: 'Visa, Mastercard, Elo, Hipercard e American Express',
    color: '#be185d'
  },
  {
    id: 'boleto',
    name: 'BOLETO BANCÁRIO',
    enabled: false,
    badge: '3 dias úteis',
    imageUrl: '',
    description: 'Compensação bancária',
    color: '#4b5563'
  }
];

export const DEFAULT_GATEWAY = {
  provider: 'manual',
  isLiveMode: false,
  pixKey: '',
  pixKeyType: 'email',
  pixMerchantName: 'FLOR DE SEDA MODA LTDA',
  pixMerchantCity: 'SAO PAULO',
  maxInstallmentsWithoutInterest: 3,
  discountForPixPercent: 0,
  notificationEmail: ''
};

export function buildSeed() {
  const now = new Date().toISOString();
  return {
    meta: {
      version: 1,
      createdAt: now,
      updatedAt: now,
      schema: 'aura-rosa/v1'
    },
    products: loadCatalog(),
    orders: [],
    orderSeq: 1000,
    customers: [],
    customerSessions: [],
    carts: [],
    cashflow: [],
    coupons: [],
    banners: [
      {
        id: 'ban-1',
        badge: 'Nova Estação',
        title: 'Nova Coleção Primavera',
        subtitle: 'Peças delicadas para cada momento seu. Silhuetas fluídas, algodão nobre e acabamentos românticos.',
        ctaText: 'Ver Coleção',
        categoryFilter: 'Vestidos',
        imageUrl:
          'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=80',
        alignment: 'left',
        active: true
      }
    ],
    reviews: [],
    settings: {
      customization: DEFAULT_CUSTOMIZATION,
      gateway: DEFAULT_GATEWAY,
      shipping: { freeThreshold: 299, pac: 19.9, sedex: 34.9, atelier: 0 },
      paymentMethods: DEFAULT_PAYMENT_METHODS
    },
    stockMovements: [],
    adminUsers: [],
    adminSessions: [],
    adminEntryTokens: [],
    auditLog: [],
    authAttempts: {},
    notifications: [],
    newsletter: [],
    telegram: {
      enabled: false,
      chatId: '',
      adminIds: [],
      tokenEncrypted: '',
      lastUpdateId: 0,
      botUsername: '',
      lastError: '',
      lastActivityAt: null,
      startedAt: null
    },
    counters: {
      ordersCreated: 0,
      ordersPaid: 0,
      cartsAbandoned: 0,
      accountsCreated: 0,
      stockIn: 0,
      stockOut: 0
    }
  };
}
