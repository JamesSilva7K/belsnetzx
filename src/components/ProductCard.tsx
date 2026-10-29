import React, { useState } from 'react';
import { Product } from '../types';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/validators';
import { Sparkles } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const { setSelectedProductDetail } = useStore();
  const [selectedColorIndex, setSelectedColorIndex] = useState(0);

  const activeColor = product.colors[selectedColorIndex] || product.colors[0];

  // Calculate discount percentage if compareAtPrice is present
  const discountPercent = product.compareAtPrice && product.compareAtPrice > product.price
    ? Math.round(((product.compareAtPrice - product.price) / product.compareAtPrice) * 100)
    : null;

  // Max 3 installments without interest as shown in the reference image (ex: 3x de R$ 63,30 sem juros)
  const installmentValue = product.price / 3;

  return (
    <div 
      className="group flex flex-col cursor-pointer transition-all duration-300"
      onClick={() => setSelectedProductDetail(product)}
    >
      {/* 1. Image Container with generous rounded corners like reference */}
      <div className="relative aspect-[3/4] w-full overflow-hidden rounded-[26px] bg-[#F7EAEB]/80 shadow-xs group-hover:shadow-lg transition-all duration-500">
        <img
          src={product.images[0]}
          alt={product.name}
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
        />

        {/* Badges Container (Top Left) */}
        <div className="absolute top-3.5 left-3.5 flex flex-col items-start gap-2 z-10 pointer-events-none">
          {/* Circular % OFF Badge */}
          {discountPercent && (
            <div className="w-11 h-11 rounded-full bg-white text-[#DC7898] shadow-sm flex flex-col items-center justify-center font-bold text-[10px] leading-tight border border-rose-100">
              <span className="leading-none">{discountPercent}%</span>
              <span className="text-[9px] leading-none uppercase">OFF</span>
            </div>
          )}

          {/* Capsule ✨ NOVO Badge */}
          {product.isNewArrival && (
            <div className="px-2.5 py-1 rounded-full bg-[#E07A9A] text-white text-[10px] font-bold tracking-wider uppercase shadow-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-white fill-white" />
              <span>NOVO</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Product Details - Centered Typography like Reference Image */}
      <div className="pt-3 pb-1 flex flex-col items-center text-center">
        
        {/* Title */}
        <h3 className="font-sans text-xs sm:text-sm font-medium text-stone-800 line-clamp-1 group-hover:text-[#DC7898] transition-colors">
          {product.name}
        </h3>

        {/* Color Swatch Dots */}
        <div className="flex items-center justify-center gap-1.5 my-1.5">
          {product.colors.map((color, idx) => (
            <button
              key={color.name}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedColorIndex(idx);
              }}
              title={color.name}
              className={`w-3.5 h-3.5 rounded-full border transition-all ${
                idx === selectedColorIndex 
                  ? 'ring-1.5 ring-[#DC7898] ring-offset-1 scale-110' 
                  : 'border-stone-300 opacity-80 hover:opacity-100'
              }`}
              style={{ backgroundColor: color.hex }}
            />
          ))}
        </div>

        {/* Pricing Line: R$ 239,90  R$ 189,90 */}
        <div className="flex items-baseline justify-center gap-2">
          {product.compareAtPrice && (
            <span className="text-xs text-stone-400 line-through">
              {formatCurrency(product.compareAtPrice)}
            </span>
          )}
          <span className="text-sm sm:text-base font-bold text-[#DC7898]">
            {formatCurrency(product.price)}
          </span>
        </div>

        {/* Installment Line: 3x de R$ 63,30 sem juros */}
        <p className="text-[11px] text-stone-500 font-normal mt-0.5">
          3x de <strong className="text-stone-700 font-semibold">{formatCurrency(installmentValue)}</strong> sem juros
        </p>
      </div>
    </div>
  );
};
