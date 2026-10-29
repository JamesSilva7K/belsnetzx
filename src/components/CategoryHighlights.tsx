import React from 'react';
import { useStore } from '../context/StoreContext';
import { ArrowUpRight } from 'lucide-react';

interface CategoryCard {
  name: string;
  label: string;
  description: string;
  imageUrl: string;
}

const CATEGORY_CARDS: CategoryCard[] = [
  {
    name: 'Vestidos',
    label: 'Vestidos Fluídos & Longos',
    description: 'Modelagens plissadas, decotes elegantes e sedas puras.',
    imageUrl: 'https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=700&q=80'
  },
  {
    name: 'Alfaiataria',
    label: 'Alta Alfaiataria Feminina',
    description: 'Blazers acinturados e calças com corte contemporâneo.',
    imageUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=80'
  },
  {
    name: 'Conjuntos',
    label: 'Conjuntos Sofisticados',
    description: 'Harmonia perfeita em linho rústico e viscose acetinada.',
    imageUrl: 'https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=700&q=80'
  },
  {
    name: 'Tricots',
    label: 'Tricots & Canelados',
    description: 'Toque de nuvem, golas médias e maciez hipoalergênica.',
    imageUrl: 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=700&q=80'
  }
];

export const CategoryHighlights: React.FC = () => {
  const { setSelectedCategory, products } = useStore();

  const handleSelect = (category: string) => {
    setSelectedCategory(category);
    const el = document.getElementById('destaques-section') || document.getElementById('catalogo-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <section className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-10">
        <div>
          <span className="text-xs uppercase font-semibold text-rose-500 tracking-[0.2em]">Curadoria Exclusiva</span>
          <h2 className="font-serif text-2xl sm:text-3xl lg:text-4xl text-stone-900 font-medium mt-1">
            Categorias em Destaque
          </h2>
        </div>
        <p className="text-stone-500 text-sm max-w-md mt-2 sm:mt-0 font-light">
          Peças confeccionadas com tecidos premium, pensadas para valorizar sua feminilidade em qualquer ocasião.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {CATEGORY_CARDS.map((cat) => {
          const count = products.filter(p => p.category === cat.name).length;
          return (
            <button
              key={cat.name}
              onClick={() => handleSelect(cat.name)}
              className="group relative h-96 rounded-3xl overflow-hidden text-left focus:outline-none shadow-sm hover:shadow-xl transition-all duration-500"
            >
              {/* Background Image */}
              <img
                src={cat.imageUrl}
                alt={cat.label}
                className="w-full h-full object-cover object-center group-hover:scale-108 transition-transform duration-700 filter brightness-95"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-rose-950/30 to-transparent" />

              {/* Bottom Content */}
              <div className="absolute inset-0 p-6 flex flex-col justify-end text-white">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-rose-200 mb-1">
                  {count} {count === 1 ? 'modelo' : 'modelos'}
                </span>
                <h3 className="font-serif text-xl sm:text-2xl font-medium leading-snug text-white mb-1.5 flex items-center justify-between">
                  <span>{cat.label}</span>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center group-hover:bg-rose-500 group-hover:text-white transition-colors">
                    <ArrowUpRight className="w-4 h-4" />
                  </div>
                </h3>
                <p className="text-xs text-rose-100/80 line-clamp-2 font-light">
                  {cat.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
