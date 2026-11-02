import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { IconWhatsApp } from './ui/vector';
import { 
  Instagram, 
  MessageCircle, 
  Mail, 
  ShieldCheck, 
  Heart, 
  Sparkles, 
  ArrowRight,
  Clock,
  CheckCircle2
} from 'lucide-react';

export const Footer: React.FC = () => {
  const { setSelectedCategory, customization, paymentMethods } = useStore();
      
  
  
  const instagramUrl = customization?.socials?.instagram?.url || 
    (customization?.socials?.instagram?.handle ? `https://instagram.com/${customization.socials.instagram.handle.replace(/^@/, '')}` : 'https://instagram.com');
  const tiktokUrl = customization?.socials?.tiktok?.url || 
    (customization?.socials?.tiktok?.handle ? `https://tiktok.com/@${customization.socials.tiktok.handle.replace(/^@/, '')}` : '');
  const facebookUrl = customization?.socials?.facebook?.url || 
    (customization?.socials?.facebook?.handle ? `https://facebook.com/${customization.socials.facebook.handle.replace(/^@/, '')}` : '');
  const pinterestUrl = customization?.socials?.pinterest?.url || 
    (customization?.socials?.pinterest?.handle ? `https://pinterest.com/${customization.socials.pinterest.handle.replace(/^@/, '')}` : '');
  const whatsappUrl = `https://wa.me/55${(customization?.whatsappNumber || '11987441290').replace(/\D/g, '')}?text=${encodeURIComponent(customization?.greetingMessage || 'Olá! Gostaria de atendimento.')}`;

  const instagramPosts = [
    {
      url: 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80',
      caption: 'Vestido Midi Floral Rosé em crepe georgette'
    },
    {
      url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?auto=format&fit=crop&w=600&q=80',
      caption: 'Conjunto em linho nobre e corte contemporâneo'
    },
    {
      url: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=600&q=80',
      caption: 'Plissados artesanais para momentos especiais'
    },
    {
      url: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=600&q=80',
      caption: 'Top cropped canelado com amarração delicada'
    }
  ];

  return (
    <footer className="bg-gradient-to-b from-[#FFF5F8] via-[#FFF9FA] to-[#FCEEF2] text-stone-700 pt-16 pb-12 border-t border-rose-200/80 transition-colors">
      
      {/* 1. Instagram Community Section with Delicate Pink Boutique Aesthetic */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-white/90 border border-rose-200/80 px-4 py-1.5 rounded-full shadow-2xs mb-3">
          <Instagram className="w-4 h-4 text-[#DC7898]" />
          <span className="text-xs font-semibold text-[#DC7898] uppercase tracking-[0.2em]">
            @flordesedaboutique no Instagram
          </span>
        </div>
        
        <h3 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium text-[#2D2427] mt-1 mb-3">
          Siga nosso universo de delicadeza & estilo
        </h3>
        
        <p className="text-xs sm:text-sm text-stone-500 font-light max-w-lg mx-auto mb-8">
          Inspirações diárias de composições românticas, bastidores da marca e lançamentos exclusivos.
        </p>

        {/* Instagram Grid Showcase - Delicate Curated Boutique Fashion */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          {instagramPosts.map((post, idx) => (
            <a
              key={idx}
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-square rounded-[22px] overflow-hidden block shadow-sm hover:shadow-xl transition-all duration-500 bg-white border border-rose-100"
            >
              <img
                src={post.url}
                alt={post.caption}
                className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-700"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#DC7898]/85 via-[#DC7898]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
                <div className="text-center w-full text-white">
                  <Instagram className="w-5 h-5 mx-auto mb-1.5 drop-shadow-xs" />
                  <p className="text-[11px] font-medium leading-snug drop-shadow-xs line-clamp-2">
                    {post.caption}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>

      {/* 2. Main Footer Links on Delicate Rosé & Off-White Background */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 border-t border-rose-200/70 pt-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 mb-12">
          
          {/* Brand Col */}
          <div className="lg:col-span-2 space-y-4">
            <div>
              <span className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-[#2D2427] block leading-none">
                Flor de Seda
              </span>
              <span className="font-script text-xs sm:text-sm text-[#DC7898] block italic font-light mt-0.5">
                moda feminina
              </span>
            </div>
            
            <p className="text-xs text-stone-600 leading-relaxed font-light max-w-sm">
              Um refúgio de sofisticação e feminilidade contemporânea. Cada peça é confeccionada com tecidos nobres, acabamentos refinados e entregue com uma experiência sensorial inesquecível em caixa perfumada.
            </p>

            <div className="pt-2 flex items-center gap-2.5 flex-wrap">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-[#DC7898] hover:border-[#DC7898] text-stone-700 hover:text-white flex items-center justify-center transition-all shadow-2xs group"
                title="Instagram Oficial"
              >
                <Instagram className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </a>
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-[#25D366] hover:border-[#25D366] text-[#25D366] hover:text-white flex items-center justify-center transition-all shadow-2xs group"
                title="WhatsApp Oficial"
              >
                <IconWhatsApp size={18} className="w-[18px] h-[18px] transition-transform group-hover:scale-110" />
              </a>
              {tiktokUrl && (
                <a
                  href={tiktokUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-stone-900 hover:border-stone-900 text-stone-700 hover:text-white flex items-center justify-center transition-all shadow-2xs text-xs font-bold font-mono group"
                  title="TikTok Oficial"
                >
                  <span className="group-hover:scale-110 transition-transform">TK</span>
                </a>
              )}
              {pinterestUrl && (
                <a
                  href={pinterestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-red-600 hover:border-red-600 text-stone-700 hover:text-white flex items-center justify-center transition-all shadow-2xs text-xs font-bold font-serif group"
                  title="Pinterest Oficial"
                >
                  <span className="group-hover:scale-110 transition-transform">P</span>
                </a>
              )}
            </div>
          </div>

          {/* Categories Col */}
          <div>
            <h4 className="font-serif text-sm font-bold text-[#2D2427] uppercase tracking-wider mb-4">
              Coleções
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600 font-light">
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Vestidos');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Vestidos Românticos
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Blusas & Camisas');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Blusas & Croppeds
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Calças & Jeans');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Calças & Alfaiataria
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Conjuntos');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Conjuntos em Linho
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Tricots');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Tricots Toque de Seda
                </button>
              </li>
              <li>
                <button 
                  onClick={() => {
                    setSelectedCategory('Saias');
                    const el = document.getElementById('destaques-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }} 
                  className="hover:text-[#DC7898] transition-colors"
                >
                  Saias Plissadas
                </button>
              </li>
            </ul>
          </div>

          {/* Boutique Service */}
          <div>
            <h4 className="font-serif text-sm font-bold text-[#2D2427] uppercase tracking-wider mb-4">
              Atendimento VIP
            </h4>
            <ul className="space-y-2.5 text-xs text-stone-600 font-light">
              <li className="flex items-center gap-2">
                <IconWhatsApp size={15} className="text-[#25D366] flex-shrink-0" />
                <a href={`https://wa.me/55${(customization?.whatsappNumber || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="hover:text-[#DC7898]">
                  WhatsApp: {customization?.whatsappDisplay || '—'}
                </a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#DC7898] flex-shrink-0" />
                <a href={`mailto:${customization?.supportEmail || ''}`} className="hover:text-[#DC7898]">{customization?.supportEmail || '—'}</a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-[#DC7898] flex-shrink-0" />
                <span>{customization?.businessHours || '—'}</span>
              </li>
              {customization?.addressDisplay ? <li>{customization.addressDisplay}</li> : null}
              <li className="text-emerald-700 font-medium">Garantia de 1ª Troca Grátis em até 30 dias</li>
            </ul>
          </div>

          {/* Redes Sociais e Canais Oficiais (Sem formulário de e-mail de lead) */}
          <div>
            <h4 className="font-serif text-sm font-bold text-[#2D2427] uppercase tracking-wider mb-4">
              Canais Oficiais
            </h4>
            <p className="text-xs text-stone-600 mb-3 font-light leading-relaxed">
              Acompanhe lançamentos exclusivos, bastidores das novas coleções e inspirações de looks elegantes em nossas redes.
            </p>
            
            <div className="space-y-2.5">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-rose-200 hover:border-[#DC7898] hover:bg-rose-50/50 transition-all text-xs font-semibold text-stone-800 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-[#DC7898]" />
                  <span>Instagram</span>
                </div>
                <span className="text-[11px] text-[#DC7898] font-mono group-hover:translate-x-0.5 transition-transform">
                  {customization?.socials?.instagram?.handle || '@flordeseda'}
                </span>
              </a>

              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 hover:border-emerald-400 hover:bg-emerald-100/70 transition-all text-xs font-semibold text-emerald-900 shadow-2xs group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <IconWhatsApp size={16} className="w-4 h-4 text-emerald-600" />
                  <span>WhatsApp Oficial</span>
                </div>
                <span className="text-[11px] text-emerald-700 font-medium">
                  {customization?.whatsappDisplay || '(11) 98744-1290'}
                </span>
              </a>

              <div className="p-2.5 rounded-xl bg-gradient-to-r from-rose-50 to-[#FFF9FA] border border-rose-100 text-[11px] text-stone-600 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-stone-800">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#DC7898]" />
                  <span>Atendimento Humanizado</span>
                </div>
                <p className="text-[10px] text-stone-500 leading-tight">
                  Consultoria de medidas e suporte das 09h às 19h via WhatsApp oficial.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Payment Methods and Security Badges */}
        <div className="pt-8 border-t border-rose-200/70 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-stone-600">
          <div className="flex items-center gap-2.5 flex-wrap justify-center">
            <span className="text-[11px] font-semibold tracking-wider uppercase text-stone-500 mr-1">Pagamento:</span>
            {(paymentMethods || [])
              .filter((m) => m.enabled)
              .map((m) =>
                m.imageUrl ? (
                  <img
                    key={m.id}
                    src={m.imageUrl}
                    alt={m.name}
                    title={`${m.name} — ${m.description || ''}`}
                    className="h-7 max-w-[90px] object-contain rounded-md border border-rose-200/90 bg-white px-2 py-0.5 shadow-2xs transition-transform hover:scale-105"
                  />
                ) : (
                  <span
                    key={m.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-white border border-rose-200 text-[10px] font-bold tracking-wide shadow-2xs uppercase transition-transform hover:scale-105"
                    style={{ color: m.color || '#374151' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: m.color || '#374151' }} />
                    {m.name}
                  </span>
                )
              )}
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-[11px] text-stone-600 bg-white/80 border border-rose-200/70 px-3.5 py-1.5 rounded-full shadow-2xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {typeof window !== 'undefined' && window.location.protocol === 'https:'
                  ? 'Conexão segura (HTTPS)'
                  : 'Ambiente local protegido por chave de sessão'}
              </span>
            </span>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="pt-6 text-center text-[11px] text-stone-500 font-light">
          © {new Date().getFullYear()} {customization?.companyName || 'Flor de Seda'} · Todos os direitos reservados.
        </div>
      </div>
    </footer>
  );
};
