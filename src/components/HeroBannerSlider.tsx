import React from 'react';
import { useStore } from '../context/StoreContext';
import { ArrowRight, Heart } from 'lucide-react';

export const HeroBannerSlider: React.FC = () => {
  const { setSelectedCategory } = useStore();

  const handleCta = () => {
    setSelectedCategory('Todos');
    const el = document.getElementById('destaques-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden bg-[#F6E5E8] min-h-[460px] sm:min-h-[520px] lg:min-h-[580px] flex items-center">
      
      {/* Background with soft architectural arches & floral model */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1800&q=80"
          alt="Nova Coleção Primavera Flor de Seda"
          className="w-full h-full object-cover object-right lg:object-center filter brightness-[0.96]"
        />
        {/* Soft pink gradient overlays mimicking the studio lighting in Image 2 */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#F7E7EA] via-[#F7E7EA]/85 to-transparent sm:via-[#F7E7EA]/75 lg:from-[#F7E7EA] lg:via-[#F7E7EA]/70" />
      </div>

      {/* Editorial Content Container */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 w-full py-16">
        <div className="max-w-xl">
          
          {/* Tag: ♥ NOVA ESTAÇÃO */}
          <div className="inline-flex items-center gap-1.5 text-[#DC7898] text-xs sm:text-sm font-semibold tracking-[0.2em] uppercase mb-4 animate-fade-in">
            <Heart className="w-3.5 h-3.5 fill-[#DC7898]" />
            <span>NOVA ESTAÇÃO</span>
          </div>

          {/* Title: Nova Coleção Primavera */}
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl font-medium tracking-tight text-[#2D2427] leading-[1.12] mb-4">
            Nova Coleção<br />Primavera
          </h1>

          {/* Subtitle: Peças delicadas para cada momento seu */}
          <p className="text-stone-600 text-sm sm:text-base font-light leading-relaxed mb-8 max-w-md">
            Peças delicadas para cada momento seu. Tecidos nobres, estampas autorais e caimento feito para valorizar sua feminilidade.
          </p>

          {/* CTA Button: VER COLEÇÃO */}
          <div>
            <button
              onClick={handleCta}
              className="inline-flex items-center gap-2 bg-[#DC7898] hover:bg-[#D36789] text-white px-8 py-3.5 rounded-full font-semibold text-xs sm:text-sm tracking-wider uppercase shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all group"
            >
              <span>VER COLEÇÃO</span>
              <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
