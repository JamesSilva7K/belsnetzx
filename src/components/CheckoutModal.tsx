import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import { ApiError, shopApi } from '../lib/api';
import { 
  formatCPF, 
  validateCPF, 
  formatPhone, 
  formatCEP, 
  validateEmail, 
  formatCurrency, 
  fetchAddressByCep 
} from '../utils/validators';
import { LeadInfo, Order } from '../types';
import { ModalShell } from './ui/ModalShell';
import confetti from 'canvas-confetti';
import { 
  X, 
  Check, 
  CreditCard, 
  QrCode, 
  FileText, 
  ShieldCheck, 
  Truck, 
  Copy, 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  ArrowLeft,
  Printer,
  User,
  MessageCircle
} from 'lucide-react';

export const CheckoutModal: React.FC = () => {
  const { 
    isCheckoutOpen, 
    setIsCheckoutOpen, 
    cart, 
    cartTotals, 
    appliedCoupon, 
    createOrder,
    pixConfig,
    customization,
    paymentMethods,
    customerUser,
    setIsAuthOpen
  } = useStore();

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Lead, 2: Entrega, 3: Pagamento, 4: Sucesso

  // Lead Info State
  const [lead, setLead] = useState<LeadInfo>({
    fullName: customerUser?.name || '',
    cpf: customerUser?.cpf || '',
    email: customerUser?.email || '',
    phone: customerUser?.phone || '',
    cep: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    notes: ''
  });

  // Validation Errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  // Shipping
  const [shippingMethod, setShippingMethod] = useState<'PAC' | 'SEDEX' | 'Atelier'>('SEDEX');

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<'pix' | 'credit_card' | 'boleto'>('pix');
  const [installments, setInstallments] = useState(1);
  const [cardNumber, setCardNumber] = useState('');
  const [cardHolder, setCardHolder] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  // Pix state
  const [pixTimeLeft, setPixTimeLeft] = useState(900); // 15 mins in sec
  const [pixCopied, setPixCopied] = useState(false);

  // Envio para o servidor
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Placed Order
  const [placedOrder, setPlacedOrder] = useState<Order | null>(null);

  // Sync customer user if available
  useEffect(() => {
    if (customerUser) {
      setLead(prev => ({
        ...prev,
        fullName: prev.fullName || customerUser.name,
        email: prev.email || customerUser.email,
        phone: prev.phone || customerUser.phone,
        cpf: prev.cpf || customerUser.cpf
      }));
    }
  }, [customerUser]);

  // Pix timer
  useEffect(() => {
    if (step === 3 && paymentMethod === 'pix' && pixTimeLeft > 0) {
      const timer = setInterval(() => setPixTimeLeft(prev => prev - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, paymentMethod, pixTimeLeft]);

  if (!isCheckoutOpen) return null;

  // Validation Step 1: Lead Info
  const validateStep1 = () => {
    const errs: Record<string, string> = {};

    if (!lead.fullName.trim() || lead.fullName.trim().split(' ').length < 2) {
      errs.fullName = 'Digite seu nome completo (nome e sobrenome).';
    }

    if (!validateCPF(lead.cpf)) {
      errs.cpf = 'CPF inválido. Verifique os dígitos digitados.';
    }

    if (!validateEmail(lead.email)) {
      errs.email = 'E-mail inválido. Utilize um endereço válido.';
    }

    const cleanPhone = lead.phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      errs.phone = 'Telefone/WhatsApp inválido. Digite DDD + número.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Validation Step 2: Shipping
  const validateStep2 = () => {
    const errs: Record<string, string> = {};

    const cleanCep = lead.cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      errs.cep = 'CEP deve conter 8 dígitos.';
    }

    if (!lead.street.trim()) {
      errs.street = 'Preencha o logradouro / rua.';
    }

    if (!lead.number.trim()) {
      errs.number = 'Informe o número.';
    }

    if (!lead.neighborhood.trim()) {
      errs.neighborhood = 'Informe o bairro.';
    }

    if (!lead.city.trim()) {
      errs.city = 'Informe a cidade.';
    }

    if (!lead.state.trim()) {
      errs.state = 'Informe o estado (UF).';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Handle CEP auto-fill
  const handleCepChange = async (value: string) => {
    const formatted = formatCEP(value);
    setLead(prev => ({ ...prev, cep: formatted }));

    const cleanCep = value.replace(/\D/g, '');
    if (cleanCep.length === 8) {
      setIsFetchingCep(true);
      const res = await fetchAddressByCep(cleanCep);
      setIsFetchingCep(false);
      if (res) {
        setLead(prev => ({
          ...prev,
          street: res.street,
          neighborhood: res.neighborhood,
          city: res.city,
          state: res.state
        }));
        setErrors(prev => {
          const { cep, street, neighborhood, city, state, ...rest } = prev;
          return rest;
        });
      }
    }
  };

  // Finalize order — o total é recalculado no servidor
  const handleFinalizeOrder = async () => {
    setSubmitError(null);

    if (!cart.length) {
      setSubmitError('Sua sacola está vazia.');
      return;
    }

    if (paymentMethod === 'credit_card') {
      const errs: Record<string, string> = {};
      const cleanCard = cardNumber.replace(/\D/g, '');
      if (cleanCard.length < 13) errs.card = 'Número de cartão inválido.';
      if (!cardHolder.trim()) errs.cardHolder = 'Informe o nome impresso no cartão.';
      if (!cardExpiry.trim()) errs.cardExpiry = 'Informe a validade (MM/AA).';
      if (cardCvv.length < 3) errs.cardCvv = 'CVV inválido.';
      if (Object.keys(errs).length > 0) {
        setErrors(errs);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder({
        lead,
        shippingMethod,
        paymentMethod,
        cardNumber: paymentMethod === 'credit_card' ? cardNumber : undefined,
        installments
      });
      setPlacedOrder(order);
      setStep(4);

      try {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#F43F5E', '#FDA4AF', '#F472B6', '#E11D48', '#FFD700']
        });
      } catch {}
    } catch (error) {
      setSubmitError(error instanceof ApiError ? error.message : 'Não foi possível concluir o pedido.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyPixToClipboard = () => {
    const code = placedOrder?.paymentDetails?.pixCopyPaste;
    if (!code) return;
    navigator.clipboard.writeText(code);
    setPixCopied(true);
    setTimeout(() => setPixCopied(false), 3000);
  };

  // Monitoramento inteligente em tempo real: verifica baixa do Pix via SyncPay
  useEffect(() => {
    if (step !== 4 || !placedOrder || placedOrder.paymentStatus === 'confirmado') return;

    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await shopApi.order(placedOrder.id, placedOrder.lead?.email);
        if (!active || !res?.order) return;
        if (res.order.paymentStatus === 'confirmado') {
          setPlacedOrder((prev) => (prev ? { ...prev, ...res.order } : res.order));
          try {
            confetti({
              particleCount: 150,
              spread: 100,
              origin: { y: 0.5 },
              colors: ['#10B981', '#059669', '#34D399', '#6EE7B7']
            });
          } catch {}
        }
      } catch {}
    }, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [step, placedOrder?.id, placedOrder?.paymentStatus]);

  const minutes = Math.floor(pixTimeLeft / 60);
  const seconds = pixTimeLeft % 60;

  const stepTracker = (
    <div className="flex items-center justify-center gap-2 text-[10.5px] font-medium sm:gap-7 sm:text-[11px]">
      {[
        { index: 1, label: 'Identificação' },
        { index: 2, label: 'Entrega' },
        { index: 3, label: 'Pagamento' }
      ].map((entry, position) => (
        <React.Fragment key={entry.index}>
          {position > 0 ? <div className="h-[2px] w-6 rounded-full bg-rose-100 sm:w-10" /> : null}
          <div className={`flex items-center gap-1.5 ${step >= entry.index ? 'font-bold text-[#B65C7B]' : 'text-stone-400'}`}>
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-[9px] ${
                step >= entry.index ? 'bg-[#DC7898] text-white' : 'bg-rose-50 text-stone-400'
              }`}
            >
              {step > entry.index ? <Check className="h-2.5 w-2.5" /> : entry.index}
            </span>
            <span>{entry.label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <ModalShell
      open={isCheckoutOpen}
      onClose={() => setIsCheckoutOpen(false)}
      icon={<ShieldCheck size={22} />}
      eyebrow="Checkout"
      title={step === 4 ? 'Pedido registrado' : 'Finalizar pedido'}
      subtitle={step === 4 ? 'Acompanhe o status pela sua conta ou pelo WhatsApp do atelier' : 'Identificação, entrega e pagamento seguros'}
      tabs={step < 4 ? stepTracker : undefined}
      size="xl"
    >
      <>
          {/* STEP 1: LEAD IDENTIFICATION */}
          {step === 1 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div className="text-center sm:text-left">
                <h3 className="font-serif text-xl font-medium text-stone-900">
                  Dados de Contato & Identificação do Lead
                </h3>
                <p className="text-xs text-stone-500 font-light mt-1">
                  Validação com verificação de CPF e WhatsApp para emissão do pedido e nota fiscal.
                </p>
              </div>

              {!customerUser ? (
                <div className="flex items-center justify-between rounded-2xl bg-rose-50/80 border border-rose-200/80 p-3.5 text-xs text-stone-700">
                  <span className="flex items-center gap-2">
                    <User className="h-4 w-4 text-[#DC7898]" />
                    <span>Já possui cadastro no atelier? Acesse sua conta para preenchimento automático.</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCheckoutOpen(false);
                      setIsAuthOpen(true);
                    }}
                    className="font-semibold text-[#DC7898] hover:underline shrink-0 ml-2"
                  >
                    Entrar
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-2xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Conectada como <strong>{customerUser.name}</strong> (dados preenchidos automaticamente)</span>
                  </span>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Maria Carolina Alencar"
                    value={lead.fullName}
                    onChange={(e) => setLead({ ...lead, fullName: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  {errors.fullName && <p className="text-[11px] text-rose-600 mt-1">{errors.fullName}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      CPF (Validação da Receita) *
                    </label>
                    <input
                      type="text"
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={lead.cpf}
                      onChange={(e) => setLead({ ...lead, cpf: formatCPF(e.target.value) })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.cpf && <p className="text-[11px] text-rose-600 mt-1">{errors.cpf}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      WhatsApp / Celular com DDD *
                    </label>
                    <input
                      type="text"
                      placeholder="(11) 98765-4321"
                      maxLength={15}
                      value={lead.phone}
                      onChange={(e) => setLead({ ...lead, phone: formatPhone(e.target.value) })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.phone && <p className="text-[11px] text-rose-600 mt-1">{errors.phone}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    E-mail para Acompanhamento do Pedido *
                  </label>
                  <input
                    type="email"
                    placeholder="seu.email@exemplo.com"
                    value={lead.email}
                    onChange={(e) => setLead({ ...lead, email: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                  {errors.email && <p className="text-[11px] text-rose-600 mt-1">{errors.email}</p>}
                </div>
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => {
                    if (validateStep1()) setStep(2);
                  }}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-200/60 hover:shadow-lg transition-all"
                >
                  Continuar para Entrega →
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SHIPPING ADDRESS */}
          {step === 2 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div>
                <h3 className="font-serif text-xl font-medium text-stone-900">
                  Endereço de Entrega & Modalidade de Frete
                </h3>
                <p className="text-xs text-stone-500 font-light mt-1">
                  Digite seu CEP para preenchimento automático inteligente.
                </p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      CEP * {isFetchingCep && <span className="text-rose-500 text-[10px]">(Buscando...)</span>}
                    </label>
                    <input
                      type="text"
                      placeholder="00000-000"
                      maxLength={9}
                      value={lead.cep}
                      onChange={(e) => handleCepChange(e.target.value)}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.cep && <p className="text-[11px] text-rose-600 mt-1">{errors.cep}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Rua / Logradouro *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Alameda Lorena"
                      value={lead.street}
                      onChange={(e) => setLead({ ...lead, street: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.street && <p className="text-[11px] text-rose-600 mt-1">{errors.street}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Número *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: 1420"
                      value={lead.number}
                      onChange={(e) => setLead({ ...lead, number: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.number && <p className="text-[11px] text-rose-600 mt-1">{errors.number}</p>}
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Complemento (opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Apto 82 Bloco B"
                      value={lead.complement}
                      onChange={(e) => setLead({ ...lead, complement: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Bairro *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Jardins"
                      value={lead.neighborhood}
                      onChange={(e) => setLead({ ...lead, neighborhood: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.neighborhood && <p className="text-[11px] text-rose-600 mt-1">{errors.neighborhood}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      Cidade *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: São Paulo"
                      value={lead.city}
                      onChange={(e) => setLead({ ...lead, city: e.target.value })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.city && <p className="text-[11px] text-rose-600 mt-1">{errors.city}</p>}
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-stone-700 block mb-1">
                      UF (Estado) *
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: SP"
                      maxLength={2}
                      value={lead.state}
                      onChange={(e) => setLead({ ...lead, state: e.target.value.toUpperCase() })}
                      className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs uppercase text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                    />
                    {errors.state && <p className="text-[11px] text-rose-600 mt-1">{errors.state}</p>}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    Instruções especiais ou Bilhete de Presente (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Entregar com laço rosa para presente ou deixar na portaria."
                    value={lead.notes}
                    onChange={(e) => setLead({ ...lead, notes: e.target.value })}
                    className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                  />
                </div>
              </div>

              {/* Shipping Method Selection */}
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-2">
                  Escolha o tipo de Envio:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div
                    onClick={() => setShippingMethod('SEDEX')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      shippingMethod === 'SEDEX'
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-200'
                        : 'border-stone-200 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">SEDEX Expresso</span>
                      <span className="text-xs font-bold text-rose-700">
                        {cartTotals.shipping === 0 ? 'GRÁTIS' : 'R$ 25,00'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">1 a 3 dias úteis com rastreio</p>
                  </div>

                  <div
                    onClick={() => setShippingMethod('PAC')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      shippingMethod === 'PAC'
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-200'
                        : 'border-stone-200 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">PAC Econômico</span>
                      <span className="text-xs font-bold text-rose-700">
                        {cartTotals.shipping === 0 ? 'GRÁTIS' : 'R$ 15,00'}
                      </span>
                    </div>
                    <p className="text-[11px] text-stone-500">4 a 7 dias úteis</p>
                  </div>

                  <div
                    onClick={() => setShippingMethod('Atelier')}
                    className={`p-3.5 rounded-2xl border cursor-pointer transition-all ${
                      shippingMethod === 'Atelier'
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-200'
                        : 'border-stone-200 hover:border-rose-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-stone-900">Retirada Atelier</span>
                      <span className="text-xs font-bold text-emerald-700">GRÁTIS</span>
                    </div>
                    <p className="text-[11px] text-stone-500">Jardins, São Paulo - SP</p>
                  </div>
                </div>
              </div>

              <div className="pt-4 flex items-center justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="px-5 py-2.5 rounded-full text-stone-600 hover:text-stone-900 text-xs font-medium flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar
                </button>
                <button
                  onClick={() => {
                    if (validateStep2()) setStep(3);
                  }}
                  className="px-8 py-3.5 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-rose-200/60 hover:shadow-lg transition-all"
                >
                  Ir para Pagamento →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT METHOD */}
          {step === 3 && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div>
                <h3 className="font-serif text-xl font-medium text-stone-900">
                  Forma de Pagamento Segura
                </h3>
                <p className="text-xs text-stone-500 font-light mt-1">
                  Seus dados trafegam em canal protegido. O pagamento é confirmado pela loja após a compensação.
                </p>
              </div>

              {/* Payment Method Selector Tabs */}
              {(() => {
                const pixMethod = (paymentMethods || []).find((m) => m.id === 'pix');
                const cardMethod = (paymentMethods || []).find((m) => m.id === 'credit_card');
                const boletoMethod = (paymentMethods || []).find((m) => m.id === 'boleto');

                const showPix = pixMethod ? pixMethod.enabled : true;
                const showCard = cardMethod ? cardMethod.enabled : true;
                const showBoleto = boletoMethod ? boletoMethod.enabled : false;

                const activeCount = (showPix ? 1 : 0) + (showCard ? 1 : 0) + (showBoleto ? 1 : 0);

                return (
                  <div className={`grid gap-3 ${activeCount === 1 ? 'grid-cols-1' : activeCount === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {showPix ? (
                      <button
                        onClick={() => setPaymentMethod('pix')}
                        className={`p-3.5 rounded-2xl border text-center transition-all ${
                          paymentMethod === 'pix'
                            ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-200 font-bold'
                            : 'border-stone-200 text-stone-700 hover:border-rose-200'
                        }`}
                      >
                        {pixMethod?.imageUrl ? (
                          <img src={pixMethod.imageUrl} alt="" className="h-6 mx-auto mb-1 object-contain" />
                        ) : (
                          <QrCode className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                        )}
                        <span className="text-xs block">{pixMethod?.name || 'PIX Instantâneo'}</span>
                        <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                          {pixMethod?.badge || (pixConfig.discountForPixPercent > 0 ? `+${pixConfig.discountForPixPercent}% OFF` : 'código do Banco Central')}
                        </span>
                      </button>
                    ) : null}

                    {showCard ? (
                      <button
                        onClick={() => setPaymentMethod('credit_card')}
                        className={`p-3.5 rounded-2xl border text-center transition-all ${
                          paymentMethod === 'credit_card'
                            ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-200 font-bold'
                            : 'border-stone-200 text-stone-700 hover:border-rose-200'
                        }`}
                      >
                        {cardMethod?.imageUrl ? (
                          <img src={cardMethod.imageUrl} alt="" className="h-6 mx-auto mb-1 object-contain" />
                        ) : (
                          <CreditCard className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                        )}
                        <span className="text-xs block">{cardMethod?.name || 'Cartão de Crédito'}</span>
                        <span className="text-[10px] text-stone-500 block mt-0.5">
                          {cardMethod?.badge || 'Até 6x sem juros'}
                        </span>
                      </button>
                    ) : null}

                    {showBoleto ? (
                      <button
                        onClick={() => setPaymentMethod('boleto')}
                        className={`p-3.5 rounded-2xl border text-center transition-all ${
                          paymentMethod === 'boleto'
                            ? 'border-rose-500 bg-rose-50 text-rose-950 ring-2 ring-rose-200 font-bold'
                            : 'border-stone-200 text-stone-700 hover:border-rose-200'
                        }`}
                      >
                        {boletoMethod?.imageUrl ? (
                          <img src={boletoMethod.imageUrl} alt="" className="h-6 mx-auto mb-1 object-contain" />
                        ) : (
                          <FileText className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                        )}
                        <span className="text-xs block">{boletoMethod?.name || 'Boleto Bancário'}</span>
                        <span className="text-[10px] text-stone-500 block mt-0.5">
                          {boletoMethod?.badge || 'Vencimento 3 dias'}
                        </span>
                      </button>
                    ) : null}
                  </div>
                );
              })()}

              {/* PIX VIEW */}
              {paymentMethod === 'pix' && (
                <div className="bg-rose-50/70 border border-rose-200 rounded-3xl p-6 text-center space-y-4">
                  {pixConfig.discountForPixPercent > 0 ? (
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      <Sparkles className="w-3.5 h-3.5" />
                      Desconto de {pixConfig.discountForPixPercent}% aplicado automaticamente no servidor
                    </div>
                  ) : null}

                  <div className="max-w-md mx-auto space-y-2">
                    <QrCode className="w-10 h-10 text-rose-500 mx-auto" />
                    <p className="text-sm text-stone-800 font-medium">
                      {pixConfig.configured
                        ? 'O código Pix é emitido pelo servidor ao finalizar o pedido.'
                        : 'A chave Pix da loja ainda não foi cadastrada no painel.'}
                    </p>
                    <p className="text-[11px] text-stone-500 leading-relaxed">
                      {pixConfig.configured
                        ? 'Você receberá o BR Code válido (padrão do Banco Central, com valor e identificador) e o QR Code para pagar em qualquer banco.'
                        : 'Você pode finalizar o pedido agora e combinar o pagamento diretamente com a loja pelo WhatsApp. Nenhum código inválido é gerado.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-rose-200/80">
                    <button
                      onClick={handleFinalizeOrder}
                      disabled={isSubmitting}
                      className="w-full sm:w-auto px-8 py-3 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold tracking-wider uppercase shadow-md transition-all disabled:opacity-60 flex items-center justify-center gap-2 mx-auto"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isSubmitting ? 'Registrando pedido…' : `Finalizar Pedido (${formatCurrency(cartTotals.total)})`}</span>
                    </button>
                    <p className="text-[10px] text-stone-400 mt-2">
                      O pedido fica como <strong>aguardando pagamento</strong> até a loja confirmar a compensação.
                    </p>
                  </div>
                </div>
              )}

              {/* CREDIT CARD VIEW */}
              {paymentMethod === 'credit_card' && (
                <div className="space-y-4">
                  {/* Virtual Card Preview */}
                  <div className="max-w-sm mx-auto h-44 rounded-2xl bg-gradient-to-tr from-stone-900 via-rose-950 to-stone-900 text-white p-5 shadow-xl flex flex-col justify-between border border-rose-800/40 relative overflow-hidden">
                    <div className="absolute -right-8 -bottom-8 w-32 h-32 rounded-full bg-rose-500/10 blur-xl pointer-events-none" />
                    <div className="flex justify-between items-center">
                      <span className="font-serif tracking-widest text-xs uppercase text-rose-200">AURA ROSA LUXE</span>
                      <CreditCard className="w-6 h-6 text-rose-300" />
                    </div>
                    <div>
                      <p className="font-mono text-base tracking-widest drop-shadow-xs">
                        {cardNumber ? cardNumber.replace(/(\d{4})/g, '$1 ').trim() : '•••• •••• •••• ••••'}
                      </p>
                    </div>
                    <div className="flex justify-between items-end text-[10px] uppercase tracking-wider text-rose-200/80 font-light">
                      <div>
                        <span className="text-[9px] block text-stone-400">Titular</span>
                        <span>{cardHolder || 'SEU NOME IMPRESSO'}</span>
                      </div>
                      <div>
                        <span className="text-[9px] block text-stone-400">Validade</span>
                        <span>{cardExpiry || '12/29'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Form */}
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Número do Cartão *
                      </label>
                      <input
                        type="text"
                        placeholder="0000 0000 0000 0000"
                        maxLength={19}
                        value={cardNumber}
                        onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 '))}
                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      {errors.card && <p className="text-[11px] text-rose-600 mt-1">{errors.card}</p>}
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Nome Impresso no Cartão *
                      </label>
                      <input
                        type="text"
                        placeholder="Nome como consta no cartão"
                        value={cardHolder}
                        onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-xs text-stone-800 uppercase focus:outline-none focus:ring-2 focus:ring-rose-300"
                      />
                      {errors.cardHolder && <p className="text-[11px] text-rose-600 mt-1">{errors.cardHolder}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          Validade (MM/AA) *
                        </label>
                        <input
                          type="text"
                          placeholder="MM/AA"
                          maxLength={5}
                          value={cardExpiry}
                          onChange={(e) => {
                            let val = e.target.value.replace(/\D/g, '');
                            if (val.length >= 2) val = `${val.slice(0, 2)}/${val.slice(2, 4)}`;
                            setCardExpiry(val);
                          }}
                          className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                        />
                        {errors.cardExpiry && <p className="text-[11px] text-rose-600 mt-1">{errors.cardExpiry}</p>}
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-stone-700 block mb-1">
                          CVV (Código de Segurança) *
                        </label>
                        <input
                          type="password"
                          placeholder="Ex: 123"
                          maxLength={4}
                          value={cardCvv}
                          onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                          className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                        />
                        {errors.cardCvv && <p className="text-[11px] text-rose-600 mt-1">{errors.cardCvv}</p>}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-stone-700 block mb-1">
                        Parcelamento *
                      </label>
                      <select
                        value={installments}
                        onChange={(e) => setInstallments(Number(e.target.value))}
                        className="w-full bg-white border border-rose-200 rounded-xl px-4 py-2 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-rose-300"
                      >
                        {[1, 2, 3, 4, 5, 6].map((num) => (
                          <option key={num} value={num}>
                            {num}x de {formatCurrency(cartTotals.total / num)} sem juros
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleFinalizeOrder}
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold tracking-wider uppercase shadow-md shadow-rose-200/60 hover:shadow-lg transition-all mt-4 disabled:opacity-60"
                  >
                    {isSubmitting ? 'Registrando pedido…' : `Finalizar Pedido (${formatCurrency(cartTotals.total)})`}
                  </button>
                  <p className="text-[10px] text-stone-400 text-center mt-2">
                    O cartão é apenas referência: a loja confirma o pagamento manualmente (link seguro enviado pelo WhatsApp) antes do envio.
                  </p>
                </div>
              )}

              {/* BOLETO VIEW */}
              {paymentMethod === 'boleto' && (
                <div className="bg-[#FFF9FA] border border-rose-200/80 rounded-2xl p-6 text-center space-y-4">
                  <FileText className="w-10 h-10 text-[#DC7898] mx-auto" />
                  <div>
                    <h4 className="font-semibold text-sm text-[#2D2427]">
                      Boleto Bancário
                    </h4>
                    <p className="text-xs text-stone-500 mt-1">
                      O boleto é emitido e enviado pela loja após a conferência do pedido (o sistema não possui integração bancária).
                      A confirmação do pagamento é registrada manualmente no painel.
                    </p>
                  </div>
                  <button
                    onClick={handleFinalizeOrder}
                    disabled={isSubmitting}
                    className="px-8 py-3.5 rounded-full bg-[#2D2427] hover:bg-[#43353A] text-white text-xs font-bold uppercase tracking-wider shadow-xs transition-colors disabled:opacity-60"
                  >
                    {isSubmitting ? 'Registrando…' : 'Finalizar Pedido'}
                  </button>
                </div>
              )}

              {submitError && (
                <div className="rounded-2xl border border-rose-300 bg-rose-50 px-4 py-3 text-xs text-rose-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Back button */}
              <div className="pt-2 flex justify-start">
                <button
                  onClick={() => setStep(2)}
                  className="px-5 py-2.5 rounded-full text-stone-600 hover:text-stone-900 text-xs font-medium flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Voltar para Endereço
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: SUCCESS RECEIPT */}
          {step === 4 && placedOrder && (
            <div className="max-w-2xl mx-auto space-y-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <Check className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div>
                <span className="text-xs font-bold tracking-widest text-rose-600 uppercase">
                  Recebemos seu pedido
                </span>
                <h3 className="font-serif text-2xl sm:text-3xl font-medium text-stone-900 mt-1">
                  Pedido {placedOrder.id} Registrado!
                </h3>
                <p className="text-xs text-stone-500 font-light mt-1">
                  Guarde o número do pedido. O status fica como <strong>aguardando pagamento</strong> até a confirmação.
                </p>
              </div>

              {/* Instruções de pagamento reais ou Selo de Pagamento Confirmado */}
              {placedOrder.paymentStatus === 'confirmado' ? (
                <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 space-y-2 text-center animate-fade-in shadow-sm">
                  <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-2">
                    <Check className="w-6 h-6 stroke-[3]" />
                  </div>
                  <h4 className="text-base font-bold text-emerald-900">
                    🎉 Pagamento Pix Confirmado com Sucesso!
                  </h4>
                  <p className="text-xs text-emerald-700">
                    O pagamento foi identificado e aprovado instantaneamente pelo sistema. Seu pedido já está sendo preparado com muito carinho pelo atelier Flor de Seda.
                  </p>
                </div>
              ) : placedOrder.paymentMethod === 'pix' && (
                <div className="bg-white border border-rose-200 rounded-3xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider">Pagamento via Pix</h4>
                  {placedOrder.paymentDetails?.pixCopyPaste ? (
                    <>
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          placedOrder.paymentDetails.pixCopyPaste
                        )}`}
                        alt="QR Code Pix do pedido"
                        className="mx-auto w-44 h-44 rounded-xl border border-rose-200 bg-white p-2"
                      />
                      <textarea
                        readOnly
                        value={placedOrder.paymentDetails.pixCopyPaste}
                        className="w-full h-20 rounded-xl border border-rose-200 bg-rose-50/50 p-2 font-mono text-[10px] text-stone-700"
                      />
                      <button
                        onClick={copyPixToClipboard}
                        className="w-full py-2.5 rounded-xl bg-[#2D2427] text-white text-xs font-semibold flex items-center justify-center gap-2"
                      >
                        <Copy className="w-4 h-4" />
                        {pixCopied ? 'Código copiado!' : 'Copiar código Pix (BR Code)'}
                      </button>
                      <p className="text-[11px] text-stone-500">
                        Valor: <strong>{formatCurrency(placedOrder.total)}</strong> · beneficiário {customization?.addressDisplay ? 'conforme cadastro' : 'Flor de Seda'}
                      </p>
                    </>
                  ) : (
                    <p className="text-xs text-stone-600">
                      A chave Pix da loja ainda não está configurada. Fale com o atelier pelo WhatsApp para receber o código de pagamento deste pedido.
                    </p>
                  )}
                </div>
              )}

              {/* Order Receipt Card */}
              <div className="bg-rose-50/50 border border-rose-200 rounded-3xl p-6 text-left space-y-4">
                <div className="flex flex-wrap items-center justify-between border-b border-rose-200/80 pb-3 gap-2">
                  <div>
                    <span className="text-[11px] text-stone-400 uppercase">Número do Pedido</span>
                    <p className="font-mono text-base font-bold text-rose-900">{placedOrder.id}</p>
                  </div>
                  <div>
                    <span className="text-[11px] text-stone-400 uppercase">Status do Pedido</span>
                    <p className="text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full inline-block">
                      {{
                        aguardando_pagamento: 'Aguardando Pagamento',
                        pago: 'Pago',
                        em_separacao: 'Em Separação',
                        enviado: 'Enviado',
                        entregue: 'Entregue',
                        cancelado: 'Cancelado'
                      }[placedOrder.orderStatus] || placedOrder.orderStatus}
                    </p>
                  </div>
                </div>

                {/* Items itemized */}
                <div>
                  <h4 className="text-xs font-bold text-stone-800 mb-2">Peças Selecionadas:</h4>
                  <div className="space-y-2">
                    {placedOrder.items.map((it) => (
                      <div key={it.cartItemId} className="flex items-center justify-between text-xs py-1.5 border-b border-rose-100 last:border-0">
                        <div className="flex items-center gap-3">
                          <img src={it.image} alt={it.name} className="w-10 h-12 rounded-lg object-cover" />
                          <div>
                            <p className="font-medium text-stone-900">{it.name}</p>
                            <span className="text-[10px] text-stone-500">
                              Tam: {it.selectedSize} • Cor: {it.selectedColor.name} • Qtd: {it.quantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-semibold text-stone-800">{formatCurrency(it.price * it.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Lead and Address */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-rose-200/80 text-xs text-stone-600">
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">Destinatária:</span>
                    <p className="font-semibold text-stone-900">{placedOrder.lead.fullName}</p>
                    <p>CPF: {placedOrder.lead.cpf}</p>
                    <p>WhatsApp: {placedOrder.lead.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-semibold text-stone-400 block mb-0.5">Endereço de Entrega:</span>
                    <p>{placedOrder.lead.street}, {placedOrder.lead.number} {placedOrder.lead.complement}</p>
                    <p>{placedOrder.lead.neighborhood} - {placedOrder.lead.city}/{placedOrder.lead.state}</p>
                    <p>CEP: {placedOrder.lead.cep} ({placedOrder.shippingMethod})</p>
                  </div>
                </div>

                {/* Total */}
                <div className="pt-3 border-t border-rose-200 flex justify-between items-center text-sm font-bold text-stone-900">
                  <span>Total do pedido:</span>
                  <span className="text-rose-700 text-base">{formatCurrency(placedOrder.total)}</span>
                </div>
              </div>

              {/* Actions: WhatsApp Support and Print */}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <a
                  href={`https://wa.me/55${(customization?.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Olá! Fiz o pedido ${placedOrder.id} no valor de ${formatCurrency(placedOrder.total)} e gostaria de acompanhar o preparo!`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Acompanhar no WhatsApp do Atelier</span>
                </a>

                <button
                  onClick={() => window.print()}
                  className="w-full sm:w-auto px-6 py-3 rounded-full bg-white border border-stone-200 hover:border-stone-400 text-stone-700 text-xs font-semibold shadow-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>Imprimir Comprovante</span>
                </button>
              </div>

              <div className="pt-2">
                <button
                  onClick={() => {
                    setIsCheckoutOpen(false);
                    setStep(1);
                  }}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-800 underline"
                >
                  Voltar para a Loja
                </button>
              </div>
            </div>
          )}
      </>
    </ModalShell>
  );
};
