import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { shopApi, ApiError } from '../lib/api';
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
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail) return;
    setSubscribeError(null);
    try {
      await shopApi.newsletter(newsletterEmail.trim());
      setSubscribed(true);
      setNewsletterEmail('');
      setTimeout(() => setSubscribed(false), 5000);
    } catch (error) {
      setSubscribeError(error instanceof ApiError ? error.message : 'Não foi possível concluir sua inscrição.');
    }
  };

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

            <div className="pt-2 flex items-center gap-3">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-[#DC7898] hover:border-[#DC7898] text-stone-700 hover:text-white flex items-center justify-center transition-all shadow-2xs"
                aria-label="Instagram"
              >
                <Instagram className="w-4 h-4" />
              </a>
              <a
                href={`https://wa.me/55${(customization?.whatsappNumber || '11987441290').replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-full bg-white border border-rose-200 hover:bg-[#25D366] hover:border-[#25D366] text-[#25D366] hover:text-white flex items-center justify-center transition-all shadow-2xs group"
                aria-label="WhatsApp Oficial"
              >
                <IconWhatsApp size={18} className="w-[18px] h-[18px] transition-transform group-hover:scale-110" />
              </a>
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

          {/* Newsletter Subscription */}
          <div>
            <h4 className="font-serif text-sm font-bold text-[#2D2427] uppercase tracking-wider mb-4">
              Clube Flor de Seda
            </h4>
            <p className="text-xs text-stone-600 mb-3 font-light">
              Receba convites de lançamentos e ganhe 10% OFF na primeira compra.
            </p>
            
            <form onSubmit={handleSubscribe} className="space-y-2.5">
              <input
                type="email"
                required
                placeholder="Seu melhor e-mail"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                className="w-full bg-white border border-rose-200 rounded-xl px-3.5 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
              />
              <button
                type="submit"
                className="w-full py-2.5 bg-[#DC7898] hover:bg-[#D36789] text-white rounded-xl text-xs font-semibold transition-all shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>Cadastrar-se</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
              {subscribed && (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 p-2 rounded-xl">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                  <span>Inscrição registrada. Você receberá nossas novidades.</span>
                </div>
              )}
              {subscribeError && (
                <div className="flex items-center gap-1.5 text-[11px] text-rose-700 font-medium bg-rose-50 border border-rose-200 p-2 rounded-xl">
                  <span>{subscribeError}</span>
                </div>
              )}
            </form>
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
