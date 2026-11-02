import React, { useState } from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/validators';
import { Sparkles, Heart } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { setSelectedProductDetail, isInWishlist, toggleWishlist } = useStore();
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const activeColor = product.colors[selectedColorIndex] || product.colors[0];

  // Calculate discount percentage if compareAtPrice is present
  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  const isWished = isInWishlist(product.id);

  // Max 3 installments without interest as shown in the reference image (ex: 3x de R$ 63,30 sem juros)
  const installmentValue = product.price / 3;

  return (
    <div 
      className="group flex flex-col cursor-pointer transition-all duration-300 w-full min-w-0 max-w-full select-none"
      onClick={() => setSelectedProductDetail(product)}
    >
      {/* 1. Image Container with generous rounded corners */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[18px] sm:rounded-[26px] bg-[#F7EAEB]/80 shadow-xs group-hover:shadow-lg transition-all duration-500">
        <img
          src={product.images[0]}
          alt={product.name}
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Heart Favorite Button (Top Right) - Saved in customer profile */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist(product.id);
          }}
          className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/95 hover:bg-white text-stone-700 shadow-sm flex items-center justify-center transition-all z-20 hover:scale-110 active:scale-95 border border-rose-100/60"
          title={isWished ? 'Remover das peças salvas' : 'Salvar peça no seu perfil'}
        >
          <Heart
            className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-colors ${
              isWished ? 'text-[#DC7898] fill-[#DC7898]' : 'text-stone-600 hover:text-[#DC7898]'
            }`}
          />
        </button>

        {/* Badges Container (Top Left) */}
        <div className="absolute top-2 left-2 sm:top-3.5 sm:left-3.5 flex flex-col items-start gap-1.5 z-10 pointer-events-none">
          {/* Capsule % OFF Badge (Matches Image 2) */}
          {discountPercent && (
            <div className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-white/95 text-[#DC7898] shadow-xs flex items-center justify-center font-bold text-[9px] sm:text-[11px] leading-tight border border-rose-200/90 tracking-wide">
              <span>{discountPercent}% OFF</span>
            </div>
          )}

          {/* Capsule NOVO Badge */}
          {product.isNewArrival && (
            <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-[#E07A9A] text-white text-[8.5px] sm:text-[10px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-white fill-white" />
              <span>NOVO</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Product Details - Centered Typography like Reference Image */}
      <div className="pt-2 sm:pt-3 pb-1 flex flex-col items-center text-center w-full min-w-0 px-1">
        
        {/* Title */}
        <h3 className="font-sans text-[11.5px] sm:text-sm font-medium text-stone-800 truncate w-full group-hover:text-[#DC7898] transition-colors">
          {product.name}
        </h3>

        {/* Color Swatch Dots */}
        <div className="flex items-center justify-center gap-1 sm:gap-1.5 my-1 sm:my-1.5 max-w-full overflow-hidden">
          {product.colors.map((color, idx) => (
            <button
              key={color.name}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedColorIndex(idx);
              }}
              title={color.name}
              className={`w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full border transition-all ${
                idx === selectedColorIndex 
                  ? 'ring-1.5 ring-[#DC7898] ring-offset-1 scale-110' 
                  : 'border-stone-300 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>

        {/* Pricing Line: R$ 239,90  R$ 189,90 */}
        <div className="flex items-baseline justify-center gap-1.5 sm:gap-2 flex-wrap">
          {product.compareAtPrice && (
            <span className="text-[11px] sm:text-xs text-stone-400 line-through">
              {formatCurrency(product.compareAtPrice)}
            </span>
          )}
          <span className="text-xs sm:text-base font-bold text-[#DC7898]">
            {formatCurrency(product.price)}
          </span>
        </div>

        {/* Installment Line: 3x de R$ 63,30 sem juros */}
        <p className="text-[9.5px] sm:text-xs text-stone-500 font-light mt-0.5 truncate w-full">
          3x de {formatCurrency(installmentValue)} sem juros
        </p>
      </div>
    </div>
  );
};
