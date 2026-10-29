import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/validators';
import { 
  X, 
  Trash2, 
  ShoppingBag, 
  ArrowRight, 
  Tag, 
  Sparkles, 
  CheckCircle2, 
  Truck,
  AlertCircle,
  ShieldCheck,
  Lock
} from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const {
    isCartOpen,
    setIsCartOpen,
    cart,
    removeFromCart,
    updateCartQuantity,
    cartTotals,
    appliedCoupon,
    couponError,
    applyCouponCode,
    removeCoupon,
    setIsCheckoutOpen
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [couponLoading, setCouponLoading] = useState(false);

  if (!isCartOpen) return null;

  // Frete grátis definido pelo servidor (configuração real da loja)
  const FREE_SHIPPING_THRESHOLD = cartTotals.freeShippingThreshold;
  const progressToFreeShipping = Math.min(100, (cartTotals.subtotal / FREE_SHIPPING_THRESHOLD) * 100);
  const remainingForFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - cartTotals.subtotal);

  const handleApplyCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim() || couponLoading) return;
    setCouponLoading(true);
    const ok = await applyCouponCode(couponInput);
    setCouponLoading(false);
    if (ok) {
      setCouponInput('');
    }
  };

  const handleProceedToCheckout = () => {
    setIsCartOpen(false);
    setIsCheckoutOpen(true);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <div className="w-screen max-w-md bg-[#FFFCFD] shadow-[0_30px_100px_-30px_rgba(157,60,90,0.55)] flex flex-col border-l border-rose-200/70 rounded-l-[28px] overflow-hidden animate-slide-left">
          
          {/* Header */}
          <div className="p-5 border-b border-rose-100 flex items-center justify-between bg-gradient-to-r from-rose-50/90 via-white to-rose-50/70">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#E88BA7] to-[#C66382] text-white flex items-center justify-center shadow-[0_10px_24px_-12px_rgba(198,99,130,0.9)]">
                <ShoppingBag className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#B65C7B] leading-none">
                  Aura Rosa
                </span>
                <h3 className="font-serif text-lg sm:text-xl font-medium text-stone-900 tracking-tight mt-1">
                  Sua Sacola ({cartTotals.itemsCount})
                </h3>
              </div>
            </div>
            
            <button
              onClick={() => setIsCartOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200/70 bg-white/80 text-stone-400 transition-colors hover:border-rose-300 hover:text-stone-700"
              aria-label="Fechar sacola"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Free Shipping Progress Bar - Delicate Rosé & Champagne */}
          <div className="p-4 bg-gradient-to-r from-[#FFF5F8] via-[#FFF9FA] to-[#FCEEF2] border-b border-rose-100 text-xs">
            <div className="flex items-center justify-between font-medium mb-1.5">
              <span className="flex items-center gap-1.5 text-stone-700">
                <Truck className="w-4 h-4 text-[#DC7898]" />
                {remainingForFreeShipping > 0 ? (
                  <>Faltam <strong className="text-[#DC7898] font-bold">{formatCurrency(remainingForFreeShipping)}</strong> para <strong className="text-stone-900 font-bold">Frete Grátis</strong>!</>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" /> Parabéns! Você ganhou Frete Grátis ♡
                  </span>
                )}
              </span>
              <span className="text-[11px] font-bold text-[#DC7898] bg-white px-2 py-0.5 rounded-full border border-rose-200/80 shadow-2xs">
                {Math.round(progressToFreeShipping)}%
              </span>
            </div>
            
            <div className="w-full h-2 rounded-full bg-white border border-rose-200/80 overflow-hidden p-0.5 shadow-inner">
              <div 
                className="h-full bg-gradient-to-r from-[#F48FB1] via-[#E283A1] to-[#DC7898] rounded-full transition-all duration-500"
                style={{ width: `${progressToFreeShipping}%` }}
              />
            </div>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-5 divide-y divide-rose-100/80">
            {cart.length > 0 ? (
              cart.map((item) => (
                <div key={item.cartItemId} className="py-4 first:pt-0 last:pb-0 flex gap-4">
                  {/* Thumbnail */}
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-26 rounded-2xl object-cover object-top border border-rose-100/90 flex-shrink-0 shadow-2xs"
                  />

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-fashion text-sm font-normal text-[#2D2427] line-clamp-1 leading-snug">
                          {item.name}
                        </h4>
                        <button
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-stone-400 hover:text-rose-600 p-1 transition-colors"
                          title="Remover peça"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Variant tags */}
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-stone-600">
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200/70 font-semibold text-[#DC7898]">
                          Tam: {item.selectedSize}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span
                            className="w-2.5 h-2.5 rounded-full border border-stone-300 shadow-2xs"
                            style={{ backgroundColor: item.selectedColor.hex }}
                          />
                          <span className="text-stone-500 font-light">{item.selectedColor.name}</span>
                        </span>
                      </div>
                    </div>

                    {/* Price and Quantity Controller */}
                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-rose-200 rounded-full bg-white p-0.5 shadow-2xs">
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, item.quantity - 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-stone-600 hover:bg-rose-50 text-xs transition-colors"
                        >
                          -
                        </button>
                        <span className="w-7 text-center text-xs font-bold text-stone-900">{item.quantity}</span>
                        <button
                          onClick={() => updateCartQuantity(item.cartItemId, item.quantity + 1)}
                          disabled={item.quantity >= item.maxStock}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-stone-600 hover:bg-rose-50 text-xs disabled:opacity-30 transition-colors"
                        >
                          +
                        </button>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold text-[#DC7898]">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                        {item.quantity > 1 && (
                          <p className="text-[10px] text-stone-400">
                            {formatCurrency(item.price)} cada
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-full bg-[#FFF5F8] border border-rose-200 flex items-center justify-center text-[#DC7898] mb-4 shadow-inner">
                  <ShoppingBag className="w-7 h-7" />
                </div>
                <h4 className="font-fashion text-xl font-normal text-[#2D2427] mb-1">
                  Sua sacola está vazia
                </h4>
                <p className="text-xs text-stone-500 max-w-xs mb-6 font-light">
                  Explore nossos vestidos, conjuntos de linho e novidades românticas.
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="px-6 py-2.5 rounded-full bg-[#DC7898] hover:bg-[#D46889] text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Explorar Coleções
                </button>
              </div>
            )}
          </div>

          {/* Footer Area with Coupon and Checkout */}
          {cart.length > 0 && (
            <div className="p-5 border-t border-rose-200/80 bg-gradient-to-b from-white to-[#FFF8FA] space-y-4">
              
              {/* Coupon Applicator */}
              <div>
                {appliedCoupon ? (
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-emerald-600" />
                      <div>
                        <span className="font-bold tracking-wider">{appliedCoupon.code}</span>
                        <span className="text-[11px] block text-emerald-700">
                          {appliedCoupon.discountType === 'percentage' 
                            ? `${appliedCoupon.discountValue}% OFF aplicado` 
                            : `${formatCurrency(appliedCoupon.discountValue)} de desconto`}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={removeCoupon}
                      className="text-stone-400 hover:text-stone-700 font-semibold text-xs"
                    >
                      Remover
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleApplyCoupon} className="space-y-1">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="CUPOM DE DESCONTO"
                          value={couponInput}
                          onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                          className="w-full bg-white border border-rose-200 rounded-xl pl-9 pr-3 py-2 text-xs font-medium uppercase tracking-wider text-stone-800 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                        />
                      </div>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-[#2D2427] hover:bg-[#43353A] text-white rounded-xl text-xs font-semibold transition-colors shadow-2xs whitespace-nowrap"
                      >
                        Aplicar
                      </button>
                    </div>
                    {couponError && (
                      <p className="text-[11px] text-rose-600 flex items-center gap-1 font-medium pt-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        {couponError}
                      </p>
                    )}
                  </form>
                )}
              </div>

              {/* Totals Summary */}
              <div className="space-y-1.5 text-xs text-stone-600 pt-2 border-t border-rose-100">
                <div className="flex justify-between">
                  <span>Subtotal:</span>
                  <span className="font-medium text-stone-900">{formatCurrency(cartTotals.subtotal)}</span>
                </div>

                {cartTotals.discount > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Desconto do Cupom:</span>
                    <span>-{formatCurrency(cartTotals.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Frete:</span>
                  <span>
                    {cartTotals.shipping === 0 ? (
                      <strong className="text-emerald-700 font-bold">GRÁTIS</strong>
                    ) : (
                      formatCurrency(cartTotals.shipping)
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-base font-bold text-stone-900 pt-2 border-t border-rose-200">
                  <span>Total:</span>
                  <span className="text-[#DC7898] text-xl">{formatCurrency(cartTotals.total)}</span>
                </div>

                <p className="text-[11px] text-stone-500 text-center font-light pt-0.5">
                  ou até 3x de <strong className="text-stone-700">{formatCurrency(cartTotals.total / 3)}</strong> sem juros no cartão
                </p>
              </div>

              {/* Checkout Button */}
              <button
                onClick={handleProceedToCheckout}
                className="w-full py-4 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs sm:text-sm font-bold tracking-wider uppercase shadow-md shadow-rose-200/60 hover:shadow-lg transition-all flex items-center justify-center gap-2 group"
              >
                <Lock className="w-4 h-4 text-white" />
                <span>Finalizar Compra Segura</span>
                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
              </button>

              {/* SSL and Trust badges */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-stone-500 pt-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Compra 100% Criptografada & Entrega Garantida</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
