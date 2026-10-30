import React, { useState, useEffect } from 'react';
import { useStore } from '../context/StoreContext';
import type { Product } from '../types';
import { formatCurrency, fetchAddressByCep } from '../utils/validators';
import { calculateProductFit } from '../utils/fittingAlgorithm';
import { ModalShell } from './ui/ModalShell';
import { IconHanger } from './ui/vector';
import { 
  X, 
  Star, 
  Heart, 
  Truck, 
  ShieldCheck, 
  Sparkles, 
  Ruler, 
  ShoppingBag, 
  Check, 
  ThumbsUp,
  AlertCircle,
  HelpCircle,
  Clock,
  Sparkle
} from 'lucide-react';

const ProductDetailContent: React.FC<{ product: Product }> = ({ product }) => {
  const { 
    setSelectedProductDetail, 
    addToCart, 
    isInWishlist, 
    toggleWishlist,
    setIsSizeGuideOpen,
    getProductReviews,
    loadReviews,
    addReview,
    shippingConfig,
    pixConfig,
    userBodyProfile,
    openProvadorVirtual,
    appliedSizeFromProvador,
    setAppliedSizeFromProvador
  } = useStore();

  const reviews = getProductReviews(product.id);

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product.colors[0] || { name: 'Padrão', hex: '#FAD2E1' });
  const [selectedSize, setSelectedSize] = useState(product.sizes[0] || 'M');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'detalhes' | 'cuidados' | 'avaliacoes'>('detalhes');
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Cálculo de frete real (tabela da loja + frete grátis configurado)
  const [cepInput, setCepInput] = useState('');
  const [shippingCalcResult, setShippingCalcResult] = useState<{ pac: string; sedex: string; city: string } | null>(null);
  const [isCalculatingCep, setIsCalculatingCep] = useState(false);

  // New review form
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [revRating, setRevRating] = useState(5);
  const [revName, setRevName] = useState('');
  const [revEmail, setRevEmail] = useState('');
  const [revComment, setRevComment] = useState('');
  const [revFit, setRevFit] = useState<'fiel ao tamanho' | 'ficou pequeno' | 'ficou grande'>('fiel ao tamanho');
  const [reviewSuccess, setReviewSuccess] = useState(false);

  const isWished = isInWishlist(product.id);
  const variantKey = `${selectedSize}-${selectedColor.name}`;
  const currentStock = product.inventory[variantKey] ?? 0;

  // Carrega as avaliações reais deste produto
  useEffect(() => {
    loadReviews(product.id);
  }, [product.id, loadReviews]);

  // Provador Virtual Recommendation
  const recommendedFit = userBodyProfile
    ? calculateProductFit(userBodyProfile, product)
    : null;

  // Sync size when user applies size in Provador
  useEffect(() => {
    if (appliedSizeFromProvador) {
      if (product.sizes.includes(appliedSizeFromProvador)) {
        setSelectedSize(appliedSizeFromProvador);
      }
      setAppliedSizeFromProvador(null);
    }
  }, [appliedSizeFromProvador, product.sizes, setAppliedSizeFromProvador]);

  const handleAddToCart = () => {
    const res = addToCart(product, selectedSize, selectedColor, quantity);
    if (res.success) {
      setFeedbackMsg({ type: 'success', text: 'Peça adicionada à sacola.' });
      setTimeout(() => setFeedbackMsg(null), 2500);
    } else {
      setFeedbackMsg({ type: 'error', text: res.message || 'Não foi possível adicionar a peça.' });
      setTimeout(() => setFeedbackMsg(null), 3500);
    }
  };

  const handleCalculateShipping = async () => {
    if (!cepInput || cepInput.replace(/\D/g, '').length !== 8) {
      return;
    }
    setIsCalculatingCep(true);
    const addr = await fetchAddressByCep(cepInput);
    setIsCalculatingCep(false);
    if (addr) {
      const formatOption = (method: string) => {
        const option = shippingConfig.options.find((entry) => entry.method === method);
        if (!option) return '—';
        return shippingConfig.freeThreshold > 0 && product.price >= shippingConfig.freeThreshold
          ? 'GRÁTIS'
          : formatCurrency(option.price);
      };
      setShippingCalcResult({
        city: `${addr.city} - ${addr.state}`,
        pac: formatOption('PAC'),
        sedex: formatOption('SEDEX')
      });
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revName.trim() || !revComment.trim()) return;

    const result = await addReview({
      productId: product.id,
      name: revName.trim(),
      email: revEmail.trim(),
      rating: revRating,
      comment: revComment.trim(),
      fitFeedback: revFit
    });

    if (!result.ok) {
      setFeedbackMsg({ type: 'error', text: result.error || 'Não foi possível enviar sua avaliação.' });
      setTimeout(() => setFeedbackMsg(null), 4000);
      return;
    }

    setReviewSuccess(true);
    setRevName('');
    setRevEmail('');
    setRevComment('');
    setTimeout(() => {
      setReviewSuccess(false);
      setShowReviewForm(false);
    }, 2000);
  };

  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  return (
    <ModalShell
      open
      onClose={() => setSelectedProductDetail(null)}
      icon={<IconHanger size={22} />}
      eyebrow={product.category}
      title={product.name}
      subtitle={product.fabric}
      size="xl"
      bodyClassName="!p-0"
    >
        {/* Conteúdo da peça */}
        <div className="p-5 sm:p-8 lg:p-9">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* Left: Product Images Gallery (5 cols) */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              {/* Main Image */}
              <div className="relative aspect-[3/4] rounded-[26px] overflow-hidden bg-[#FAF3F5] border border-rose-100/90 shadow-sm group">
                <img
                  src={product.images[activeImageIndex] || product.images[0]}
                  alt={product.name}
                  className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                />

                {/* Wishlist toggle */}
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className={`absolute top-4 left-4 p-2.5 rounded-full backdrop-blur-md transition-all shadow-md ${
                    isWished 
                      ? 'bg-[#DC7898] text-white shadow-rose-300/50' 
                      : 'bg-white/90 hover:bg-white text-stone-700 hover:text-[#DC7898]'
                  }`}
                  aria-label="Favoritar"
                >
                  <Heart className={`w-4 h-4 ${isWished ? 'fill-current' : ''}`} />
                </button>

                {/* Discount Badge if available */}
                {discountPercent && (
                  <div className="absolute top-4 right-4 bg-white/95 border border-rose-200 text-[#DC7898] text-[11px] font-bold px-2.5 py-1 rounded-full shadow-xs">
                    {discountPercent}% OFF
                  </div>
                )}
              </div>

              {/* Thumbnails */}
              {product.images.length > 1 && (
                <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
                  {product.images.map((img, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveImageIndex(idx)}
                      className={`relative w-16 h-20 rounded-2xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                        idx === activeImageIndex 
                          ? 'border-[#DC7898] ring-2 ring-rose-200/80 scale-102' 
                          : 'border-transparent opacity-70 hover:opacity-100 hover:border-rose-200'
                      }`}
                    >
                      <img src={img} alt={`Miniatura ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Fatos verificáveis da peça */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#FFF5F8] to-[#FFF9FA] border border-rose-100/80 flex items-center justify-around text-[11px] text-stone-600">
                <span className="flex items-center gap-1.5 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Estoque por variação
                </span>
                <span className="w-1 h-1 rounded-full bg-rose-200" />
                <span className="flex items-center gap-1.5 font-medium">
                  <Truck className="w-4 h-4 text-[#DC7898]" />
                  Frete calculado no CEP
                </span>
                <span className="w-1 h-1 rounded-full bg-rose-200" />
                <span className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-4 h-4 text-[#DC7898]" />
                  Tabela própria
                </span>
              </div>
            </div>

            {/* Right: Product Details & Purchase Actions (7 cols) */}
            <div className="lg:col-span-7 flex flex-col">
              
              {/* Category & SKU */}
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="uppercase font-semibold tracking-[0.2em] text-[#DC7898] text-[11px] bg-rose-50 px-3 py-0.5 rounded-full border border-rose-200/60">
                  {product.category}
                </span>
                <span className="font-mono text-stone-400 text-[11px]">SKU: {product.sku}</span>
              </div>

              {/* Product Title in Feminine Editorial Typography */}
              <h1 className="font-fashion text-2xl sm:text-3xl lg:text-4xl font-normal text-[#2D2427] leading-tight mb-2 tracking-tight">
                {product.name}
              </h1>

              {/* Real Reviews & Verified Quality */}
              {(() => {
                const hasReviews = reviews.length > 0;
                const avgRating = hasReviews
                  ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
                  : 0;
                return (
                  <div className="flex items-center gap-2 mb-4 flex-wrap">
                    <div className="flex items-center text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3.5 h-3.5 ${
                            i < Math.round(avgRating) ? 'fill-amber-400 text-amber-400' : 'text-stone-200'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs font-bold text-stone-800">{hasReviews ? avgRating.toFixed(1) : '—'}</span>
                    <span className="text-xs text-stone-500 font-light">
                      {hasReviews 
                        ? `(${reviews.length} ${reviews.length === 1 ? 'avaliação autêntica' : 'avaliações autênticas'})`
                        : '(sem avaliações ainda — seja a primeira)'}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/70">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      Avaliações 100% Reais
                    </span>
                  </div>
                );
              })()}

              {/* Price Container */}
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#FFF8FA] via-white to-[#FCEEF2] border border-rose-200/80 mb-5 shadow-2xs">
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl sm:text-4xl font-bold text-[#DC7898] tracking-tight">
                    {formatCurrency(product.price)}
                  </span>
                  {product.compareAtPrice && (
                    <span className="text-sm text-stone-400 line-through">
                      {formatCurrency(product.compareAtPrice)}
                    </span>
                  )}
                  {discountPercent && (
                    <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-[#DC7898] text-xs font-bold uppercase">
                      Economize {formatCurrency(product.compareAtPrice! - product.price)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-600 mt-1.5 font-light">
                  {pixConfig.maxInstallments > 1 ? (
                    <>
                      em até{' '}
                      <strong className="text-[#2D2427] font-semibold">
                        {pixConfig.maxInstallments}x de {formatCurrency(product.price / pixConfig.maxInstallments)}
                      </strong>{' '}
                      no cartão
                      {pixConfig.discountForPixPercent > 0 ? (
                        <>
                          {' '}
                          ou com{' '}
                          <strong className="text-emerald-700 font-semibold">
                            {pixConfig.discountForPixPercent}% OFF no PIX
                          </strong>
                        </>
                      ) : null}
                      .
                    </>
                  ) : pixConfig.discountForPixPercent > 0 ? (
                    <>
                      com <strong className="text-emerald-700 font-semibold">{pixConfig.discountForPixPercent}% OFF no PIX</strong>.
                    </>
                  ) : (
                    <>pagamento por Pix, cartão ou boleto combinado com o atelier.</>
                  )}
                </p>
              </div>

              {/* Color Selector */}
              <div className="mb-5">
                <div className="flex items-center justify-between text-xs font-medium text-stone-700 mb-2">
                  <span>Cor selecionada: <strong className="text-[#DC7898]">{selectedColor.name}</strong></span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {product.colors.map((c) => (
                    <button
                      key={c.name}
                      onClick={() => setSelectedColor(c)}
                      className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs transition-all ${
                        selectedColor.name === c.name
                          ? 'border-[#DC7898] bg-rose-50 text-[#2D2427] ring-2 ring-rose-200 font-semibold shadow-2xs'
                          : 'border-stone-200 hover:border-rose-300 text-stone-600 bg-white'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-stone-300"
                        style={{ backgroundColor: c.hex }}
                      />
                      <span>{c.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provador Virtual Quick Recommendation Box */}
              <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-rose-50/90 via-[#FFF5F8] to-rose-50/90 border border-rose-200/90 shadow-2xs">
                {recommendedFit ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-2xl bg-[#DC7898] text-white flex items-center justify-center shadow-xs flex-shrink-0">
                        <Sparkles className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-stone-900">
                            Tamanho Sugerido: <span className="text-[#DC7898] text-sm">{recommendedFit.recommendedSize}</span>
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                            {recommendedFit.insideCount}/3 medidas na faixa
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-500 font-light mt-0.5">
                          Medidas: {userBodyProfile?.bust}cm busto • {userBodyProfile?.waist}cm cintura • {userBodyProfile?.hip}cm quadril
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {selectedSize !== recommendedFit.recommendedSize && (
                        <button
                          type="button"
                          onClick={() => setSelectedSize(recommendedFit.recommendedSize)}
                          className="px-3.5 py-1.5 rounded-full bg-[#DC7898] hover:bg-[#D46889] text-white text-[11px] font-semibold transition-all shadow-xs"
                        >
                          Usar {recommendedFit.recommendedSize}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openProvadorVirtual(product)}
                        className="text-[11px] text-[#DC7898] hover:text-[#C65677] underline font-semibold whitespace-nowrap"
                      >
                        Ajustar Medidas
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 text-xs text-stone-700">
                      <Sparkles className="w-4 h-4 text-[#DC7898] flex-shrink-0" />
                      <span>Descubra seu caimento perfeito com nosso <strong>Provador Virtual</strong>.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openProvadorVirtual(product)}
                      className="px-4 py-1.5 rounded-full bg-[#DC7898] hover:bg-[#D46889] text-white text-xs font-semibold shadow-2xs transition-colors whitespace-nowrap self-end sm:self-auto"
                    >
                      Calcular Tamanho Ideal
                    </button>
                  </div>
                )}
              </div>

              {/* Size Selector */}
              <div className="mb-6">
                <div className="flex items-center justify-between text-xs mb-2.5">
                  <span className="font-medium text-stone-700">
                    Tamanho Selecionado: <strong className="text-[#DC7898]">{selectedSize}</strong>
                  </span>
                  <button
                    onClick={() => openProvadorVirtual(product)}
                    className="text-xs font-semibold text-[#DC7898] hover:text-[#C65677] flex items-center gap-1 underline underline-offset-4"
                  >
                    <Ruler className="w-3.5 h-3.5" />
                    <span>Tabela de Medidas & Provador</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  {product.sizes.map((sz) => {
                    const vStock = product.inventory[`${sz}-${selectedColor.name}`] ?? 5;
                    const isOutOfStock = vStock <= 0;
                    const isRecommended = recommendedFit?.recommendedSize === sz;

                    return (
                      <button
                        key={sz}
                        onClick={() => setSelectedSize(sz)}
                        disabled={isOutOfStock}
                        className={`relative min-w-12 px-3.5 py-2 rounded-2xl text-xs font-semibold transition-all border ${
                          selectedSize === sz
                            ? 'bg-[#DC7898] text-white border-[#DC7898] shadow-xs ring-2 ring-rose-200'
                            : isOutOfStock
                              ? 'bg-stone-100 text-stone-300 border-stone-200 cursor-not-allowed line-through'
                              : isRecommended
                                ? 'bg-rose-50 text-[#DC7898] border-rose-300 hover:bg-rose-100 font-bold'
                                : 'bg-white hover:border-[#DC7898] text-stone-800 border-rose-200/80'
                        }`}
                      >
                        {sz}
                        {isRecommended && (
                          <span className={`absolute -top-1.5 -right-1 text-[8px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-tight shadow-2xs flex items-center gap-0.5 ${
                            selectedSize === sz ? 'bg-white text-[#DC7898]' : 'bg-[#DC7898] text-white'
                          }`}>
                            <Star className="w-2 h-2 fill-current" />
                            Ideal
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Stock alert */}
                <div className="mt-2.5 text-xs">
                  {currentStock > 0 && currentStock <= 3 ? (
                    <span className="text-[#DC7898] font-medium flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Apenas {currentStock} unidades restantes nesta variação!
                    </span>
                  ) : currentStock > 3 ? (
                    <span className="text-emerald-700 font-medium flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      Disponível no Atelier para envio imediato ({currentStock} peças)
                    </span>
                  ) : (
                    <span className="text-rose-500 font-medium">
                      Esgotado nesta numeração.
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity & Add to Cart (Signature Delicate Rose CTA) */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center border border-rose-200 rounded-full bg-white p-1 shadow-2xs">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-stone-600 hover:bg-rose-50 disabled:opacity-30 transition-colors"
                  >
                    -
                  </button>
                  <span className="w-10 text-center text-xs font-bold text-stone-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(Math.min(currentStock, quantity + 1))}
                    disabled={quantity >= currentStock}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-stone-600 hover:bg-rose-50 disabled:opacity-30 transition-colors"
                  >
                    +
                  </button>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={currentStock <= 0}
                  className="flex-1 py-4 px-8 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-md shadow-rose-200/60 hover:shadow-lg disabled:opacity-50 disabled:pointer-events-none transition-all flex items-center justify-center gap-2 group"
                >
                  <ShoppingBag className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
                  <span>Adicionar à Sacola</span>
                </button>
              </div>

              {/* Feedback Message */}
              {feedbackMsg && (
                <div
                  className={`p-3.5 mb-5 rounded-2xl border text-xs font-semibold flex items-center gap-2 animate-fade-in shadow-2xs ${
                    feedbackMsg.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  {feedbackMsg.type === 'success' ? (
                    <Check className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{feedbackMsg.text}</span>
                </div>
              )}

              {/* Cálculo de frete com a tabela real da loja */}
              <div className="p-4 rounded-2xl bg-[#FFF9FA] border border-rose-200/80 mb-6 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-stone-800 mb-2.5">
                  <Truck className="w-4 h-4 text-[#DC7898]" />
                  <span>Calcular Frete e Prazo de Entrega:</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Digite seu CEP (Ex: 01419-002)"
                    maxLength={9}
                    value={cepInput}
                    onChange={(e) => setCepInput(e.target.value)}
                    className="flex-1 bg-white border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                  <button
                    onClick={handleCalculateShipping}
                    disabled={isCalculatingCep}
                    className="px-5 py-2.5 bg-gradient-to-r from-[#DC7898] to-[#C66382] hover:from-[#C66382] hover:to-[#B65C7B] text-white rounded-xl text-xs font-semibold transition-all shadow-xs whitespace-nowrap"
                  >
                    {isCalculatingCep ? 'Calculando...' : 'Calcular'}
                  </button>
                </div>

                {shippingCalcResult && (
                  <div className="mt-3 pt-3 border-t border-rose-200/70 text-xs space-y-1 text-stone-600 animate-fade-in">
                    <p className="font-semibold text-stone-900">Entrega para {shippingCalcResult.city}:</p>
                    <div className="flex justify-between items-center text-[11px] py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        PAC Expresso: {shippingCalcResult.pac}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[11px] py-0.5">
                      <span className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                        SEDEX Especial: {shippingCalcResult.sedex}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Product Tabs Navigation */}
              <div className="border-b border-rose-100 flex gap-6 text-xs font-semibold mb-4">
                <button
                  onClick={() => setActiveTab('detalhes')}
                  className={`pb-2.5 relative transition-colors ${
                    activeTab === 'detalhes' ? 'text-[#DC7898] font-bold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Descrição & Caimento
                  {activeTab === 'detalhes' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-[#DC7898] rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('cuidados')}
                  className={`pb-2.5 relative transition-colors ${
                    activeTab === 'cuidados' ? 'text-[#DC7898] font-bold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Composição & Cuidados
                  {activeTab === 'cuidados' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-[#DC7898] rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('avaliacoes')}
                  className={`pb-2.5 relative transition-colors ${
                    activeTab === 'avaliacoes' ? 'text-[#DC7898] font-bold' : 'text-stone-500 hover:text-stone-800'
                  }`}
                >
                  Avaliações ({reviews.length})
                  {activeTab === 'avaliacoes' && (
                    <span className="absolute bottom-0 left-0 w-full h-[2.5px] bg-[#DC7898] rounded-full" />
                  )}
                </button>
              </div>

              {/* Tab Contents */}
              <div className="text-xs text-stone-600 leading-relaxed font-light">
                {activeTab === 'detalhes' && (
                  <div className="space-y-3 animate-fade-in">
                    <p>{product.description}</p>
                    <div className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-100/70 text-[11px] space-y-1 text-stone-700">
                      <p><strong>Modelagem:</strong> Desenvolvida para valorizar a cintura e permitir caimento fluido.</p>
                      <p><strong>Detalhes:</strong> Acabamentos artesanais, costura embutida e forro duplo com toque de seda.</p>
                    </div>
                  </div>
                )}

                {activeTab === 'cuidados' && (
                  <div className="space-y-2.5 animate-fade-in">
                    <p><strong>Tecido Nobre:</strong> {product.fabric}</p>
                    <p><strong>Instruções de Lavagem:</strong> {product.care}</p>
                    <p className="text-stone-500 text-[11px]">
                      Para preservar a maciez das fibras naturais, utilize sabão neutro e seque sempre à sombra.
                    </p>
                  </div>
                )}

                {activeTab === 'avaliacoes' && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-stone-900">Opiniões de quem já comprou:</span>
                      <button
                        onClick={() => setShowReviewForm(!showReviewForm)}
                        className="px-3.5 py-1 rounded-full bg-rose-100 text-[#DC7898] hover:bg-[#DC7898] hover:text-white transition-colors text-xs font-semibold"
                      >
                        {showReviewForm ? 'Fechar Formulário' : '+ Deixar Avaliação'}
                      </button>
                    </div>

                    {showReviewForm && (
                      <form onSubmit={handleSubmitReview} className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200 space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <input
                            type="text"
                            required
                            placeholder="Seu Nome Completo"
                            value={revName}
                            onChange={(e) => setRevName(e.target.value)}
                            className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs"
                          />
                          <input
                            type="email"
                            placeholder="Seu E-mail (opcional)"
                            value={revEmail}
                            onChange={(e) => setRevEmail(e.target.value)}
                            className="bg-white border border-rose-200 rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span>Nota:</span>
                          <div className="flex gap-1 text-amber-400 cursor-pointer">
                            {[1, 2, 3, 4, 5].map((st) => (
                              <button
                                key={st}
                                type="button"
                                onClick={() => setRevRating(st)}
                                className="focus:outline-none"
                              >
                                <Star className={`w-4 h-4 ${st <= revRating ? 'fill-amber-400' : 'text-stone-300'}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                        <textarea
                          required
                          rows={2}
                          placeholder="Conte como foi sua experiência com a peça, tecido e caimento..."
                          value={revComment}
                          onChange={(e) => setRevComment(e.target.value)}
                          className="w-full bg-white border border-rose-200 rounded-xl p-3 text-xs"
                        />
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-full bg-[#DC7898] hover:bg-[#D46889] text-white text-xs font-semibold"
                        >
                          Enviar Avaliação
                        </button>
                        {reviewSuccess && (
                          <span className="text-emerald-700 text-xs ml-3 font-semibold inline-flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            Avaliação enviada com sucesso!
                          </span>
                        )}
                      </form>
                    )}

                    {reviews.length > 0 ? (
                      reviews.map((rev) => (
                        <div key={rev.id} className="p-3.5 rounded-2xl bg-[#FFF9FA] border border-rose-100/80 space-y-1.5 shadow-2xs">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-stone-900">{rev.userName}</span>
                            <span className="text-[10px] text-stone-400">{rev.date}</span>
                          </div>
                          <div className="flex items-center gap-1 text-amber-400">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-stone-200'}`} />
                            ))}
                            <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ml-2 font-medium inline-flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              Compradora Verificada
                            </span>
                          </div>
                          <p className="text-stone-600 text-xs leading-relaxed">{rev.comment}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center rounded-2xl bg-gradient-to-b from-[#FFF5F8] to-white border border-rose-100/80">
                        <Sparkles className="w-5 h-5 text-[#DC7898] mx-auto mb-2" />
                        <h4 className="font-serif text-sm font-medium text-stone-800">Peça Exclusiva do Ateliê</h4>
                        <p className="text-xs text-stone-500 font-light mt-1 max-w-sm mx-auto">
                          Ainda não há avaliações registradas para este modelo. Seja a primeira a vivenciar a experiência e compartilhar suas impressões sobre o tecido e o caimento.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
    </ModalShell>
  );
};

/**
 * Wrapper com a checagem de abertura: garante que os hooks do conteúdo
 * só montem quando existe um produto selecionado (regra dos hooks).
 */
export const ProductDetailModal: React.FC = () => {
  const { selectedProductDetail } = useStore();
  if (!selectedProductDetail) return null;
  return <ProductDetailContent key={selectedProductDetail.id} product={selectedProductDetail} />;
};
