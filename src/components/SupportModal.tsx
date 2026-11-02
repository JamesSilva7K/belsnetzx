import React from 'react';
import { Clock, Instagram, Ruler, Sparkles } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { ModalShell } from './ui/ModalShell';
import { IconWhatsApp } from './ui/vector';

interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupportModal: React.FC<SupportModalProps> = ({ isOpen, onClose }) => {
  const { customization, openProvadorVirtual } = useStore();
  const whatsapp = (customization?.whatsappNumber || '').replace(/\D/g, '');

  return (
    <ModalShell
      open={isOpen}
      onClose={onClose}
      icon={<IconWhatsApp size={22} />}
      eyebrow="Atendimento"
      title="Fale com a nossa equipe"
      subtitle="Consultoria de estilo, medidas e acompanhamento de pedidos"
      size="md"
    >
      <div className="space-y-4">
        <a
          href={`https://wa.me/55${whatsapp}?text=${encodeURIComponent(customization?.greetingMessage || 'Olá! Gostaria de uma ajuda.')}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 transition-colors hover:border-emerald-300"
        >
          <div>
            <p className="text-sm font-semibold text-stone-900">WhatsApp oficial</p>
            <p className="text-[11px] font-light text-stone-600">{customization?.whatsappDisplay || 'Fale com uma consultora'}</p>
          </div>
          <span className="flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-[11px] font-semibold text-white">
            <IconWhatsApp size={14} className="h-3.5 w-3.5" /> Abrir conversa
          </span>
        </a>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-800">
              <Clock className="h-3.5 w-3.5 text-[#DC7898]" /> Horário
            </p>
            <p className="mt-1 text-[11px] font-light leading-relaxed text-stone-600">{customization?.businessHours || 'Consulte a nossa equipe'}</p>
          </div>

          <div className="rounded-2xl border border-rose-100 bg-rose-50/40 p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-800">
              <Instagram className="h-3.5 w-3.5 text-[#DC7898]" /> Instagram
            </p>
            <a 
              href={customization?.socials?.instagram?.url || 'https://instagram.com/flordeseda'} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="mt-1 block break-all text-[11px] font-semibold text-[#DC7898] hover:underline"
            >
              {customization?.socials?.instagram?.handle || '@flordeseda'}
            </a>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onClose();
            openProvadorVirtual();
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-rose-100 bg-white p-3.5 text-left transition-colors hover:border-rose-300"
        >
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-rose-50 text-[#C66382]">
            <Ruler className="h-4 w-4" />
          </span>
          <span className="flex-1">
            <span className="block text-[12px] font-semibold text-stone-800">Dúvida de tamanho?</span>
            <span className="block text-[10.5px] font-light text-stone-500">Abra o provador virtual e veja o caimento por região.</span>
          </span>
          <Sparkles className="h-3.5 w-3.5 text-[#DC7898]" />
        </button>

        <p className="rounded-xl bg-stone-50 p-3 text-[10px] font-light leading-relaxed text-stone-500">
          Prazos de envio, trocas e devoluções são confirmados pelo atendimento no momento da compra. O status de cada pedido fica disponível na sua conta.
        </p>
      </div>
    </ModalShell>
  );
};
