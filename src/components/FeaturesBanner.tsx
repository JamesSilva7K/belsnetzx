import React from 'react';
import { Ruler, ShieldCheck, Store, Truck } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { formatCurrency } from '../utils/validators';

export const FeaturesBanner: React.FC = () => {
  const { shippingConfig, pixConfig, customization } = useStore();

  const features = [
    {
      icon: Truck,
      title: 'Frete calculado no checkout',
      description: `PAC, SEDEX ou retirada no atelier. Frete grátis a partir de ${formatCurrency(
        shippingConfig.freeThreshold
      )} e acompanhamento pelo código de rastreio.`
    },
    {
      icon: Ruler,
      title: 'Provador com a sua medida',
      description:
        'Nossa tabela cruza suas medidas com cada modelagem e mostra o caimento por região antes de comprar.'
    },
    {
      icon: ShieldCheck,
      title: pixConfig.configured ? 'Pix com código oficial' : 'Pagamento acompanhado',
      description: pixConfig.configured
        ? 'O código Pix é gerado pelo sistema no padrão do Banco Central e a confirmação fica registrada no painel da loja.'
        : 'Cada pedido é conferido pelo atelier antes da confirmação de pagamento — sem cobranças automáticas.'
    },
    {
      icon: Store,
      title: 'Atendimento direto',
      description: `${customization.businessHours} · WhatsApp ${customization.whatsappDisplay}.`
    }
  ];

  return (
    <section className="bg-gradient-to-b from-rose-50/70 to-white py-6 sm:py-10 border-b border-rose-100 w-full max-w-full overflow-hidden">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 w-full max-w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 w-full max-w-full">
          {features.map((feat, index) => {
            const Icon = feat.icon;
            return (
              <div
                key={index}
                className="flex items-start gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl bg-white/80 border border-rose-100/80 shadow-xs hover:border-rose-200 hover:shadow-sm transition-all w-full min-w-0 max-w-full"
              >
                <div className="p-2.5 sm:p-3 rounded-2xl bg-rose-50 text-[#C66382] flex-shrink-0">
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={1.6} />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-stone-800 font-sans tracking-tight truncate">{feat.title}</h4>
                  <p className="text-[11px] sm:text-xs text-stone-500 mt-0.5 sm:mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none">{feat.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};
