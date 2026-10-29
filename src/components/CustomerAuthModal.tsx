import React, { useState } from 'react';
import { useStore } from '../context/StoreContext';
import { ModalShell } from './ui/ModalShell';
import { formatCPF, validateCPF, formatPhone, validateEmail, formatCurrency } from '../utils/validators';
import { 
  X, 
  User, 
  ShoppingBag, 
  Heart, 
  Package, 
  Truck, 
  LogOut, 
  Sparkles, 
  Lock, 
  CheckCircle2,
  ExternalLink,
  Mail,
  Eye,
  EyeOff,
  FileText,
  Phone,
  Gift,
  Ruler
} from 'lucide-react';

export const CustomerAuthModal: React.FC = () => {
  const {
    isAuthOpen,
    setIsAuthOpen,
    customerUser,
    login,
    register,
    logout,
    orders,
    wishlist,
    products,
    addToCart,
    setSelectedProductDetail,
    openProvadorVirtual,
    customization
  } = useStore();

  const [authMode, setAuthMode] = useState<'login' | 'register' | 'profile'>(
    customerUser ? 'profile' : 'login'
  );

  // Login inputs
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Register inputs
  const [regName, setRegName] = useState('');
  const [regCpf, setRegCpf] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);

  if (!isAuthOpen) return null;

  // Pedidos reais desta cliente (a API já filtra pelo e-mail autenticado)
  const customerOrders = orders;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);

    if (!validateEmail(loginEmail)) {
      setLoginError('Por favor, informe um endereço de e-mail válido.');
      return;
    }
    if (loginPassword.length < 8) {
      setLoginError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }

    setLoginLoading(true);
    const result = await login(loginEmail.trim(), loginPassword);
    setLoginLoading(false);

    if (!result.ok) {
      setLoginError(result.error || 'Não foi possível entrar.');
      return;
    }
    setLoginPassword('');
    setAuthMode('profile');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);

    if (regName.trim().split(' ').length < 2) {
      setRegError('Digite seu nome e sobrenome completo.');
      return;
    }

    if (!validateCPF(regCpf)) {
      setRegError('CPF inválido de acordo com a Receita Federal.');
      return;
    }

    if (!validateEmail(regEmail)) {
      setRegError('Digite um e-mail válido.');
      return;
    }

    if (regPhone.replace(/\D/g, '').length < 10) {
      setRegError('Telefone com DDD inválido.');
      return;
    }

    if (regPassword.length < 8) {
      setRegError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setRegLoading(true);
    const result = await register({
      name: regName.trim(),
      cpf: regCpf,
      email: regEmail.trim().toLowerCase(),
      phone: regPhone,
      password: regPassword
    });
    setRegLoading(false);

    if (!result.ok) {
      setRegError(result.error || 'Não foi possível criar sua conta.');
      return;
    }
    setRegPassword('');
    setAuthMode('profile');
  };

  const handleLogout = async () => {
    await logout();
    setAuthMode('login');
  };

  const wishedProducts = products.filter(p => wishlist.includes(p.id));

  return (
    <ModalShell
      open={isAuthOpen}
      onClose={() => setIsAuthOpen(false)}
      icon={<User size={22} />}
      eyebrow="Flor de Seda"
      title={customerUser ? `Olá, ${customerUser.name}` : 'Acesso da cliente'}
      subtitle={
        customerUser
          ? 'Pedidos, medidas e favoritos em um só lugar'
          : 'Entre ou crie sua conta para acompanhar pedidos e medidas'
      }
      size="md"
      bodyClassName="!p-0"
    >
        {/* Exclusive Boutique Perks Strip */}
        {!customerUser && (
          <div className="px-6 py-2.5 bg-gradient-to-r from-[#FFF5F8] to-[#FFF9FA] border-b border-rose-100 flex items-center justify-around text-[11px] text-stone-600">
            <span className="flex items-center gap-1.5 font-medium text-stone-700">
              <Package className="w-3.5 h-3.5 text-[#DC7898]" />
              Pedidos e rastreio
            </span>
            <span className="w-1 h-1 rounded-full bg-rose-200" />
            <span className="flex items-center gap-1.5 font-medium text-stone-700">
              <Ruler className="w-3.5 h-3.5 text-[#DC7898]" />
              Medidas no provador
            </span>
            <span className="w-1 h-1 rounded-full bg-rose-200" />
            <span className="flex items-center gap-1.5 font-medium text-stone-700">
              <Heart className="w-3.5 h-3.5 text-[#DC7898]" />
              Lista de desejos
            </span>
          </div>
        )}

        {/* Pill Navigation Toggle (if not logged in) */}
        {!customerUser && (
          <div className="p-4 pb-0 bg-white">
            <div className="flex bg-rose-50/80 p-1 rounded-full border border-rose-200/80 text-xs font-semibold">
              <button
                type="button"
                onClick={() => { setAuthMode('login'); setLoginError(null); }}
                className={`flex-1 py-2 rounded-full transition-all text-center ${
                  authMode === 'login'
                    ? 'bg-[#DC7898] text-white shadow-xs font-bold'
                    : 'text-stone-600 hover:text-[#DC7898]'
                }`}
              >
                Já sou Cliente (Entrar)
              </button>
              <button
                type="button"
                onClick={() => { setAuthMode('register'); setRegError(null); }}
                className={`flex-1 py-2 rounded-full transition-all text-center ${
                  authMode === 'register'
                    ? 'bg-[#DC7898] text-white shadow-xs font-bold'
                    : 'text-stone-600 hover:text-[#DC7898]'
                }`}
              >
                Criar Nova Conta
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          
          {/* 1. LOGIN FORM */}
          {authMode === 'login' && !customerUser && (
            <form onSubmit={handleLogin} className="space-y-4 max-w-md mx-auto py-2 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  E-mail Cadastrado
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-stone-700">
                    Sua Senha
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const whatsapp = (customization?.whatsappNumber || '').replace(/\D/g, '');
                      window.open(
                        `https://wa.me/55${whatsapp}?text=${encodeURIComponent('Olá! Preciso redefinir a senha da minha conta.')}`,
                        '_blank',
                        'noopener'
                      );
                    }}
                    className="text-[11px] text-[#DC7898] hover:underline"
                  >
                    Esqueceu?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {loginError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {loginError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold tracking-wider uppercase shadow-md shadow-rose-200/60 hover:shadow-lg transition-all"
              >
                Entrar na Minha Conta
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setAuthMode('register')}
                  className="text-xs text-[#DC7898] hover:text-[#C65677] font-medium"
                >
                  Não tem conta? Criar minha conta
                </button>
              </div>
            </form>
          )}

          {/* 2. REGISTER FORM */}
          {authMode === 'register' && !customerUser && (
            <form onSubmit={handleRegister} className="space-y-3.5 max-w-lg mx-auto py-1 animate-fade-in">
              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Nome Completo *
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    placeholder="Ex: Amanda Silva Castro"
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    CPF (Validação Oficial) *
                  </label>
                  <div className="relative">
                    <FileText className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="000.000.000-00"
                      maxLength={14}
                      value={regCpf}
                      onChange={(e) => setRegCpf(formatCPF(e.target.value))}
                      className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-stone-700 block mb-1">
                    WhatsApp com DDD *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      placeholder="(11) 98765-4321"
                      maxLength={15}
                      value={regPhone}
                      onChange={(e) => setRegPhone(formatPhone(e.target.value))}
                      className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  E-mail *
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    placeholder="seu.email@exemplo.com"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-700 block mb-1">
                  Crie sua Senha (mínimo 6 dígitos) *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type={showRegPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    className="w-full bg-white border border-rose-200 rounded-2xl pl-10 pr-10 py-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-[#DC7898]/40 focus:border-[#DC7898] shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRegPassword(!showRegPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700"
                  >
                    {showRegPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {regError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                  {regError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#DC7898] via-[#E283A1] to-[#D46889] hover:from-[#D46889] hover:to-[#C65677] text-white text-xs font-bold tracking-wider uppercase shadow-md shadow-rose-200/60 hover:shadow-lg transition-all"
              >
                Concluir Cadastro & Ganhar 10% OFF
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setAuthMode('login')}
                  className="text-xs text-stone-500 hover:text-[#DC7898]"
                >
                  Já possui conta? <span className="underline font-semibold text-[#DC7898]">Fazer Login</span>
                </button>
              </div>
            </form>
          )}

          {/* 3. LOGGED IN CUSTOMER PROFILE VIEW */}
          {customerUser && (
            <div className="space-y-6 animate-fade-in">
              {/* Profile Card */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-[#FFF5F8] via-white to-[#FCEEF2] border border-rose-200/80 flex items-center justify-between">
                <div>
                  <h4 className="font-fashion text-lg font-medium text-stone-900">{customerUser.name}</h4>
                  <p className="text-xs text-stone-500 font-mono mt-0.5">{customerUser.email}</p>
                  <p className="text-xs text-stone-500">CPF: {customerUser.cpf} • WhatsApp: {customerUser.phone}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="px-3.5 py-1.5 rounded-full bg-white border border-rose-200 text-stone-600 hover:text-rose-700 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:bg-rose-50 transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sair</span>
                </button>
              </div>

              {/* Orders History */}
              <div>
                <h4 className="font-serif text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#DC7898]" />
                  <span>Seus Pedidos ({customerOrders.length})</span>
                </h4>

                {customerOrders.length > 0 ? (
                  <div className="space-y-3">
                    {customerOrders.map((ord) => (
                      <div key={ord.id} className="p-4 rounded-2xl bg-white border border-rose-100 shadow-2xs text-xs space-y-2">
                        <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                          <span className="font-mono font-bold text-stone-800">{ord.id}</span>
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 font-semibold text-[10px]">
                            {ord.orderStatus === 'em_separacao' ? 'Em Separação no Atelier' : ord.orderStatus}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-stone-600">
                          <span>{ord.items.length} {ord.items.length === 1 ? 'peça' : 'peças'}</span>
                          <span className="font-bold text-[#DC7898]">{formatCurrency(ord.total)}</span>
                        </div>
                        {ord.trackingCode && (
                          <div className="pt-1 flex items-center gap-1.5 text-stone-500 text-[11px]">
                            <Truck className="w-3.5 h-3.5 text-[#DC7898]" />
                            <span>Rastreio Correios: <strong className="font-mono text-stone-800">{ord.trackingCode}</strong></span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-rose-50/40 border border-dashed border-rose-200 text-center text-xs text-stone-500">
                    Você ainda não realizou pedidos na Flor de Seda.
                  </div>
                )}
              </div>

              {/* Wishlist Favorites */}
              {wishedProducts.length > 0 && (
                <div>
                  <h4 className="font-serif text-base font-bold text-stone-900 mb-3 flex items-center gap-2">
                    <Heart className="w-4 h-4 text-[#DC7898] fill-[#DC7898]" />
                    <span>Peças Favoritas ({wishedProducts.length})</span>
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    {wishedProducts.map((p) => (
                      <div
                        key={p.id}
                        onClick={() => {
                          setSelectedProductDetail(p);
                          setIsAuthOpen(false);
                        }}
                        className="cursor-pointer group p-2.5 rounded-2xl bg-white border border-rose-100 shadow-2xs hover:shadow-md transition-all flex items-center gap-3"
                      >
                        <img src={p.images[0]} alt={p.name} className="w-12 h-14 rounded-xl object-cover" />
                        <div className="overflow-hidden">
                          <p className="font-medium text-xs text-stone-900 line-clamp-1 group-hover:text-[#DC7898]">
                            {p.name}
                          </p>
                          <span className="text-xs font-bold text-[#DC7898]">{formatCurrency(p.price)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
    </ModalShell>
  );
};
