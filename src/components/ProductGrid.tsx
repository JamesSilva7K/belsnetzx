import React from 'react';
import { useStore } from '../context/StoreContext';
import { ProductCard } from './ProductCard';
import { AlertCircle, SlidersHorizontal, Sparkles } from 'lucide-react';

export const ProductGrid: React.FC = () => {
  const {
    products,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    selectedSizeFilter,
    setSelectedSizeFilter,
    sortBy,
    setSortBy,
    customization,
    loading,
    error,
    refresh
  } = useStore();

  const categories = [
    'Todos',
    'Novidades',
    'Vestidos',
    'Blusas & Camisas',
    'Calças & Jeans',
    'Conjuntos',
    'Alfaiataria',
    'Tricots',
    'Saias'
  ];

  // Filtering
  const filteredProducts = products.filter((prod) => {
    // Novidades filter
    if (selectedCategory === 'Novidades') {
      const isNew = prod.isNewArrival === true || prod.tags?.some(t => t.toLowerCase().includes('novidade') || t.toLowerCase().includes('primavera'));
      if (!isNew) return false;
    } else if (selectedCategory !== 'Todos' && prod.category !== selectedCategory) {
      return false;
    }
    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchName = prod.name.toLowerCase().includes(q);
      const matchDesc = prod.description.toLowerCase().includes(q);
      const matchCat = prod.category.toLowerCase().includes(q);
      if (!matchName && !matchDesc && !matchCat) return false;
    }
    // Size
    if (selectedSizeFilter !== 'Todos') {
      const hasSize = prod.sizes.some((s) => s.includes(selectedSizeFilter));
      if (!hasSize) return false;
    }
    return true;
  });

  // Sorting
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    if (sortBy === 'menor-preco') return a.price - b.price;
    if (sortBy === 'maior-preco') return b.price - a.price;
    if (sortBy === 'novidades' || selectedCategory === 'Novidades') return (b.isNewArrival ? 1 : 0) - (a.isNewArrival ? 1 : 0);
    return (b.isBestSeller ? 1 : 0) - (a.isBestSeller ? 1 : 0);
  });

  return (
    <section 
      id="destaques-section" 
      className="py-12 sm:py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-28"
    >
      <div id="catalogo-section" className="scroll-mt-28" />

      {/* Title Destaques in Serif font matching Flor de Seda branding */}
      <div className="text-center mb-10">
        <span 
          className="text-xs font-semibold uppercase tracking-[0.25em] inline-flex items-center gap-1.5 mb-1"
          style={{ color: customization.primaryColor }}
        >
          <Sparkles className="w-3.5 h-3.5" style={{ color: customization.primaryColor }} />
          {selectedCategory === 'Novidades' ? 'Lançamentos Exclusivos' : 'Curadoria Especial'}
        </span>
        <h2 className="font-serif text-3xl sm:text-4xl text-[#2D2427] font-medium tracking-tight">
          {selectedCategory === 'Novidades' ? 'Novidades da Estação' : selectedCategory === 'Todos' ? 'Destaques' : selectedCategory}
        </h2>
        <div 
          className="w-12 h-[2.5px] mx-auto mt-2.5 rounded-full"
          style={{ backgroundColor: customization.primaryColor }}
        />
        {selectedCategory === 'Novidades' && (
          <p className="text-xs text-stone-500 mt-2 font-light">
            Coleção recém-chegada com tecidos nobres, fluidez e acabamentos delicados.
          </p>
        )}
      </div>

      {/* Filter and Sorting Bar - Stable non-shifting layout */}
      <div className="bg-white/70 backdrop-blur-xs border border-rose-100 rounded-3xl p-3 sm:p-4 mb-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Category Pills (fixed dimensions, flex-shrink-0 to avoid button shifting on click) */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 lg:pb-0 scrollbar-none no-scrollbar flex-nowrap w-full lg:w-auto">
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(cat);
                    if (cat === 'Novidades') setSortBy('novidades');
                  }}
                  style={isSelected ? { backgroundColor: customization.primaryColor, borderColor: customization.primaryColor } : {}}
                  className={`flex-shrink-0 whitespace-nowrap px-4 py-2 rounded-full text-xs font-medium transition-all duration-150 focus:outline-none select-none flex items-center gap-1.5 ${
                    isSelected
                      ? 'text-white shadow-xs'
                      : 'bg-white hover:bg-rose-50 text-stone-600 border border-rose-200/80 hover:text-[#DC7898]'
                  }`}
                >
                  {cat === 'Novidades' && <Sparkles className="w-3 h-3 text-amber-300" />}
                  <span>{cat}</span>
                </button>
              );
            })}
          </div>

          {/* Quick Sorting Dropdown */}
          <div className="flex items-center justify-between lg:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-rose-100 flex-shrink-0">
            <span className="text-xs text-stone-500 whitespace-nowrap font-medium flex items-center gap-1">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#DC7898]" />
              <span>Ordenar:</span>
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-white border border-rose-200 text-stone-700 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs cursor-pointer"
            >
              <option value="destaque">Mais Vendidos</option>
              <option value="novidades">Lançamentos</option>
              <option value="menor-preco">Menor Preço</option>
              <option value="maior-preco">Maior Preço</option>
            </select>
          </div>
        </div>
      </div>

      {/* Search active notice */}
      {searchQuery && (
        <div className="mb-6 flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-[#DC7898]">
          <span>
            Exibindo resultados para: <strong className="text-stone-900">"{searchQuery}"</strong> ({sortedProducts.length} itens)
          </span>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-semibold underline text-stone-700 hover:text-black"
          >
            Limpar busca
          </button>
        </div>
      )}

      {/* Products Grid: 4 columns matching Flor de Seda with min-h to prevent layout jumps */}
      <div className="min-h-[500px]">
        {error ? (
          <div className="text-center py-16 px-4 bg-white rounded-3xl border border-rose-200 max-w-md mx-auto my-8">
            <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
            <h3 className="text-stone-800 font-serif text-lg font-medium mb-1">Não foi possível carregar o catálogo</h3>
            <p className="text-stone-500 text-xs mb-4">{error}</p>
            <button
              onClick={() => refresh()}
              className="px-6 py-2.5 rounded-full bg-[#DC7898] hover:bg-[#D36789] text-white text-xs font-semibold shadow-xs"
            >
              Tentar novamente
            </button>
          </div>
        ) : loading && products.length === 0 ? (
          <div className="text-center py-20 text-stone-400 text-xs">Carregando peças da coleção…</div>
        ) : sortedProducts.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-7 animate-fade-in">
            {sortedProducts.map((prod) => (
              <ProductCard key={prod.id} product={prod} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 px-4 bg-white rounded-3xl border border-dashed border-rose-200 max-w-md mx-auto my-8">
            <AlertCircle className="w-10 h-10 text-rose-300 mx-auto mb-3" />
            <h3 className="text-stone-800 font-serif text-lg font-medium mb-1">
              Nenhuma peça encontrada
            </h3>
            <p className="text-stone-500 text-xs mb-4">
              Não encontramos peças para a categoria "{selectedCategory}".
            </p>
            <button
              onClick={() => {
                setSelectedCategory('Todos');
                setSearchQuery('');
              }}
              className="px-6 py-2.5 rounded-full bg-[#DC7898] hover:bg-[#D36789] text-white text-xs font-semibold shadow-xs"
            >
              Ver Todas as Peças
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
