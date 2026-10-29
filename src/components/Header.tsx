import React, { useState } from 'react';
import { 
  ShoppingBag, 
  User, 
  Search, 
  HeartHandshake, 
  Instagram, 
  Facebook, 
  ChevronDown,
  X,
  Menu,
  ChevronRight
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { SupportModal } from './SupportModal';
import { IconSparkle, IconTapeMeasure } from './ui/vector';
import { formatCurrency } from '../utils/validators';

export const Header: React.FC = () => {
  const { 
    cartTotals, 
    setIsCartOpen, 
    setIsAuthOpen, 
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    customerUser,
    shippingConfig,
    openProvadorVirtual
  } = useStore();

  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isColecaoDropdownOpen, setIsColecaoDropdownOpen] = useState(false);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // A busca é local; nenhuma rota administrativa é exposta na loja.
  };

  const categories = [
    'Todos',
    'Vestidos',
    'Blusas & Camisas',
    'Calças & Jeans',
    'Conjuntos',
    'Alfaiataria',
    'Tricots',
    'Saias'
  ];

  return (
    <header className="sticky top-0 z-40 w-full transition-all shadow-xs">
      {/* 1. TOP BAR (White / Off-White delicate bar) */}
      <div className="bg-[#FAF7F8] border-b border-rose-100/60 text-[11px] sm:text-xs text-stone-600 py-1.5 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Social Icons */}
          <div className="flex items-center gap-3">
            <a 
              href="https://instagram.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-stone-500 hover:text-[#DC7898] transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-3.5 h-3.5" />
            </a>
            <a 
              href="https://facebook.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-stone-500 hover:text-[#DC7898] transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Center Message */}
          <div className="flex items-center justify-center gap-1.5 text-center font-normal tracking-wide text-stone-700">
            <IconSparkle size={12} className="text-[#C66382]" />
            <span>Seja bem-vinda e boas compras</span>
            <HeartHandshake className="h-3 w-3 text-[#C66382]" />
          </div>

          {/* Right Free Shipping Threshold */}
          <div className="hidden sm:block text-right font-medium text-stone-600">
            <span>Frete grátis acima de {formatCurrency(shippingConfig.freeThreshold)}</span>
          </div>
        </div>
      </div>

      {/* 2. MAIN HEADER (Signature Flor de Seda Rose #DC7898) */}
      <div className="bg-[#DC7898] text-white px-4 sm:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 sm:gap-8">
          
          {/* Mobile Menu Button */}
          <div className="flex items-center lg:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1 text-white hover:text-rose-100 transition-colors"
              aria-label="Menu"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Logo (Flor de Seda / moda feminina) */}
          <div className="flex-shrink-0 text-center lg:text-left">
            <button 
              onClick={() => { setSelectedCategory('Todos'); setSearchQuery(''); }}
              className="group text-left focus:outline-none"
            >
              <span className="font-serif text-2xl sm:text-3xl font-medium tracking-tight text-white block leading-none">
                Flor de Seda
              </span>
              <span className="font-script text-xs sm:text-sm text-rose-100/90 block -mt-0.5 tracking-wider italic font-light">
                moda feminina
              </span>
            </button>
          </div>

          {/* Center Search Pill */}
          <div className="flex-1 max-w-xl mx-2 sm:mx-6">
            <form onSubmit={handleSearchSubmit} className="relative w-full">
              <input
                type="text"
                placeholder="O que você está buscando?"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                className="w-full bg-white text-stone-800 text-xs sm:text-sm placeholder:text-stone-400 pl-5 pr-10 py-2.5 sm:py-3 rounded-full shadow-inner focus:outline-none focus:ring-2 focus:ring-rose-300 transition-all"
              />
              <button 
                type="submit" 
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-[#DC7898]"
                aria-label="Buscar"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Right Action Icons with Vertical Labels */}
          <div className="flex items-center gap-4 sm:gap-7">
            
            {/* Atendimento */}
            <button
              onClick={() => setIsSupportOpen(true)}
              className="flex flex-col items-center group text-white hover:text-rose-100 transition-colors focus:outline-none"
              title="Atendimento e Suporte"
            >
              <HeartHandshake className="w-5 h-5 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] sm:text-[11px] font-light mt-0.5 tracking-tight">Atendimento</span>
            </button>

            {/* Entrar / Conta */}
            <button
              onClick={() => setIsAuthOpen(true)}
              className="flex flex-col items-center group text-white hover:text-rose-100 transition-colors focus:outline-none"
              title={customerUser ? `Olá, ${customerUser.name}` : 'Login ou Cadastro'}
            >
              <div className="relative">
                <User className="w-5 h-5 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                {customerUser && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 ring-1 ring-white"></span>
                )}
              </div>
              <span className="text-[10px] sm:text-[11px] font-light mt-0.5 tracking-tight">
                {customerUser ? 'Minha Conta' : 'Entrar'}
              </span>
            </button>

            {/* Carrinho */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex flex-col items-center group text-white hover:text-rose-100 transition-colors relative focus:outline-none"
              title="Sacola de Compras"
            >
              <div className="relative">
                <ShoppingBag className="w-5 h-5 sm:w-5 sm:h-5 group-hover:scale-110 transition-transform" />
                <span className="absolute -top-1.5 -right-2.5 bg-white text-[#DC7898] font-bold text-[9px] w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {cartTotals.itemsCount}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] font-light mt-0.5 tracking-tight">Carrinho</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION SUB-BAR (Delicate white/cream bar with links) */}
      <div className="bg-white/95 backdrop-blur-md border-b border-rose-100 px-4 sm:px-8 py-2.5 hidden lg:block">
        <div className="max-w-7xl mx-auto flex items-center justify-center gap-10 text-xs sm:text-sm font-normal text-stone-700">
          <button
            onClick={() => { setSelectedCategory('Todos'); setSearchQuery(''); }}
            className={`hover:text-[#DC7898] transition-colors ${
              selectedCategory === 'Todos' ? 'text-[#DC7898] font-semibold' : ''
            }`}
          >
            Início
          </button>

          {/* Coleção Completa Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsColecaoDropdownOpen(!isColecaoDropdownOpen)}
              onMouseEnter={() => setIsColecaoDropdownOpen(true)}
              className="flex items-center gap-1 hover:text-[#DC7898] transition-colors focus:outline-none"
            >
              <span>Coleção completa</span>
              <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
            </button>

            {isColecaoDropdownOpen && (
              <div 
                onMouseLeave={() => setIsColecaoDropdownOpen(false)}
                className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-rose-100 py-2 z-50 animate-fade-in text-xs"
              >
                {categories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => {
                      setSelectedCategory(cat);
                      setIsColecaoDropdownOpen(false);
                      const el = document.getElementById('destaques-section');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="w-full text-left px-4 py-2 hover:bg-rose-50 text-stone-700 hover:text-[#DC7898] transition-colors"
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              setSelectedCategory('Vestidos');
              const el = document.getElementById('destaques-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="hover:text-[#DC7898] transition-colors"
          >
            Novidades
          </button>

          <button
            onClick={() => setIsSupportOpen(true)}
            className="hover:text-[#DC7898] transition-colors"
          >
            Contato
          </button>

          {/* Provador Virtual Link */}
          <button
            onClick={() => openProvadorVirtual(null)}
            className="text-stone-600 hover:text-[#DC7898] transition-colors flex items-center gap-1.5 font-medium"
          >
            <IconTapeMeasure size={14} className="text-[#DC7898]" />
            <span>Provador Virtual</span>
          </button>
        </div>
      </div>

      {/* MOBILE MENU DRAWER */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-rose-200 px-5 py-4 space-y-3 shadow-lg animate-fade-in text-xs text-stone-700">
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => {
                  setSelectedCategory(cat);
                  setIsMobileMenuOpen(false);
                  const el = document.getElementById('destaques-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="text-left px-3 py-2 rounded-xl bg-rose-50/60 hover:bg-rose-100 flex items-center justify-between"
              >
                <span>{cat}</span>
                <ChevronRight className="w-3 h-3 text-rose-400" />
              </button>
            ))}
          </div>

          <div className="pt-2 border-t border-rose-100 flex flex-col gap-2">
            <button
              onClick={() => {
                openProvadorVirtual(null);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-rose-50 text-left font-medium"
            >
              <IconTapeMeasure size={16} className="text-[#DC7898]" />
              <span>Provador Virtual Interativo</span>
            </button>
            <button
              onClick={() => {
                setIsSupportOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="flex items-center gap-2 p-2 rounded-xl hover:bg-rose-50 text-left"
            >
              <HeartHandshake className="w-4 h-4 text-[#DC7898]" />
              <span>Atendimento via WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* Support Modal */}
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </header>
  );
};
