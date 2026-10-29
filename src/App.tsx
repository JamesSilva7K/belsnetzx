import React from 'react';
import { StoreProvider, useStore } from './context/StoreContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Header } from './components/Header';
import { HeroBannerSlider } from './components/HeroBannerSlider';
import { FeaturesBanner } from './components/FeaturesBanner';
import { CategoryHighlights } from './components/CategoryHighlights';
import { ProductGrid } from './components/ProductGrid';
import { ProductDetailModal } from './components/ProductDetailModal';
import { SizeGuideModal } from './components/SizeGuideModal';
import { CartDrawer } from './components/CartDrawer';
import { CheckoutModal } from './components/CheckoutModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { Footer } from './components/Footer';
import { MaintenanceView } from './components/MaintenanceView';

function StorefrontBody() {
  const { customization, ready } = useStore();

  if (ready && (customization?.storeStatus === 'maintenance' || customization?.storeStatus === 'private')) {
    return <MaintenanceView />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF9FA] text-stone-800 font-sans selection:bg-rose-200 selection:text-rose-950">
      <Header />
      <HeroBannerSlider />
      <FeaturesBanner />
      <CategoryHighlights />
      <ProductGrid />
      <Footer />

      <ProductDetailModal />
      <SizeGuideModal />
      <CartDrawer />
      <CheckoutModal />
      <CustomerAuthModal />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <StorefrontBody />
      </StoreProvider>
    </ErrorBoundary>
  );
}
