/**
 * Blindagem de Interface e Proteção de Design
 * -------------------------------------------------
 * • Impede cópia não autorizada do design e imagens
 * • Bloqueia atalhos de inspeção e visualização de código-fonte no storefront
 * • Preserva 100% a usabilidade de inputs de texto (CEP, CPF, etc.)
 * • Não afeta rotas administrativas
 */

export function setupAntiCopyShield(enabled = true) {
  if (typeof window === 'undefined') return () => {};

  // Se estiver no painel administrativo, nunca bloqueia nada para permitir inspeção do gestor
  const isAdmin = window.location.pathname.includes('admin') || window.location.pathname.includes('janaadmin');
  if (isAdmin || !enabled) return () => {};

  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    // Permite menu de contexto apenas em inputs de formulário para copiar/colar dados do cliente
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
      return;
    }
    e.preventDefault();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    const isCtrl = e.ctrlKey || e.metaKey;

    // Ctrl + U (Ver código fonte)
    if (isCtrl && (e.key === 'u' || e.key === 'U')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + S (Salvar página inteira)
    if (isCtrl && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Ctrl + Shift + I / C / J (DevTools / Inspecionar elemento)
    if (isCtrl && e.shiftKey && ['i', 'I', 'c', 'C', 'j', 'J'].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target && target.tagName === 'IMG') {
      e.preventDefault();
    }
  };

  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });
  document.addEventListener('dragstart', handleDragStart, { capture: true });

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
    document.removeEventListener('dragstart', handleDragStart, { capture: true });
  };
}

/** Atualiza dinamicamente o título, favicon e meta tags no navegador do cliente */
export function applyStoreMeta({
  companyName,
  pageTitle,
  faviconUrl,
  primaryColor
}: {
  companyName?: string;
  pageTitle?: string;
  faviconUrl?: string;
  primaryColor?: string;
}) {
  if (typeof document === 'undefined') return;

  const title = pageTitle || (companyName ? `${companyName} | Moda Feminina Elegante` : 'Flor de Seda');
  document.title = title;

  if (faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = faviconUrl;
  }

  if (primaryColor) {
    document.documentElement.style.setProperty('--primary-color', primaryColor);
  }
}

