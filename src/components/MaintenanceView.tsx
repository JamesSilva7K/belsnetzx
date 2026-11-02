import React from 'react';
import { useStore } from '../context/StoreContext';
import { IconWhatsApp } from './ui/vector';
import { Lock, Sparkles } from 'lucide-react';

export const MaintenanceView: React.FC = () => {
  const { customization } = useStore();
  const whatsappDigits = (customization?.whatsappNumber || '11987441290').replace(/\D/g, '');

  return (
    <div className="min-h-screen bg-[#FFF9FA] flex flex-col items-center justify-center p-6 text-center select-none relative overflow-hidden">
      {/* Background ambient accents */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-[#DC7898]/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full bg-white/95 backdrop-blur-md border border-rose-200/80 rounded-3xl p-8 sm:p-10 shadow-xl relative z-10">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-[#DC7898] shadow-inner">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-medium tracking-tight text-[#2D2427] mb-2">
          {customization?.companyName || 'Flor de Seda'}
        </h1>
        <p className="text-xs uppercase tracking-widest text-[#DC7898] font-bold mb-6">
          Loja de Moda Feminina
        </p>

        <div className="bg-rose-50/60 border border-rose-100 rounded-2xl p-5 mb-8 text-left">
          <h2 className="text-sm font-semibold text-stone-800 mb-1.5 flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#DC7898]" />
            {customization?.maintenanceTitle || 'Loja em Manutenção Programada'}
          </h2>
          <p className="text-xs text-stone-600 font-light leading-relaxed">
            {customization?.maintenanceMessage ||
              'Estamos organizando novas coleções e peças exclusivas na loja. Retornaremos em instantes para recebê-la com todo o carinho!'}
          </p>
        </div>

        <div className="space-y-3">
          <a
            href={`https://wa.me/55${whatsappDigits}?text=${encodeURIComponent(
              customization?.greetingMessage || 'Olá! Vim pelo site da Flor de Seda e gostaria de ser atendida.'
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3 px-5 rounded-2xl bg-[#25D366] hover:bg-[#1EBE5D] text-white font-medium text-xs sm:text-sm flex items-center justify-center gap-2.5 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <IconWhatsApp size={18} />
            <span>Falar com Atendimento no WhatsApp</span>
          </a>

          <a
            href="/janaadmin1978/"
            className="inline-block text-[11px] text-stone-600 hover:text-stone-800 transition-colors pt-2 underline underline-offset-4"
          >
            Área de Acesso do Gestor
          </a>
        </div>
      </div>

      <p className="text-[11px] text-stone-600 mt-8 relative z-10 font-light">
        {customization?.addressDisplay || 'Alameda Lorena, 1420 — Jardins, São Paulo/SP'}
      </p>
    </div>
  );
};

