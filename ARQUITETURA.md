# 🌸 Aura Rosa — Arquitetura do sistema

Documento técnico do estado **real** da aplicação: o que existe, onde está e por quê.

---

## 1. Visão geral

| Camada | Tecnologia | Papel |
| :--- | :--- | :--- |
| Servidor | Node.js 24 + Express 4 (ESM) | API, painel, agendador, bot |
| Persistência | JSON atômico (`server/data/db.json`) | fonte única de verdade |
| Frontend | React 19 + TypeScript + Vite 8 | loja (SPA) |
| Painel | React 19 + TypeScript (entry separado) | operação administrativa |
| Estilo | Tailwind CSS v4 | loja clara, painel escuro |
| Bot | API oficial do Telegram (HTTP puro) | notificações + ações |
| Criptografia | `node:crypto` | scrypt, AES-256-GCM, HMAC, TOTP |

Não existem dependências de banco externo, ORM, SDK do Telegram ou biblioteca de autenticação: tudo é implementado com a biblioteca padrão do Node.

---

## 2. Processos e portas

```
http://localhost:3000   → loja (SPA) + /api/* pública + painel no caminho cifrado
http://localhost:3100   → SOMENTE o caminho cifrado do painel; todo o resto = 404
```

- `STORE_PORT` (3000) e `ADMIN_PORT` (3100) são independentes.
- O painel é servido em `/<caminho-cifrado>/`, com API em `/<caminho-cifrado>/api/*`.
- Na porta administrativa, assets e módulos são liberados; qualquer outra rota devolve `404 Not found` (superfície mínima).

---

## 3. Estrutura de arquivos

```
server/
  config.js                 env + chaves (keys.json)
  index.js                  express, vite middleware, agendador, bootstrap
  lib/
    crypto.js               scrypt, AES-256-GCM, HMAC, TOTP/base32
    db.js                   load/commit atômico, EventEmitter, auditoria
    errors.js               HttpError + assert
    format.js               moeda, datas, CPF/e-mail
    http.js                 cookies, rate limit, origin guard, errorHandler
    pix.js                  BR Code EMV + CRC16
    telegram-client.js      HTTP da Bot API (retry, 429)
  services/
    catalog.js              produtos, avaliações (nota derivada)
    coupons.js              validação real de cupom
    orders.js               criação, transições, rastreio, estorno
    stock.js                entradas/saídas + alerta de estoque baixo
    carts.js                rastreio de carrinho e abandono
    customers.js            contas e sessões (scrypt + token opaco)
    finance.js              fluxo de caixa e métricas
    settings.js             identidade, Pix, frete, banners
    notifications.js        central de eventos (notify)
    admin-auth.js           caminho, login 2FA, sessões, auditoria
    telegram-service.js     token cifrado, polling, formatação, entrega
    telegram-bot.js         painel de botões e comandos
  routes/
    public.js               /api/*
    admin.js                /<caminho>/api/*
  seed/
    catalog.json            8 produtos reais (sem métricas inventadas)
  data/                     gerado em runtime (não versionar)
```

Frontend:

```
src/
  lib/api.ts                cliente HTTP (loja + painel)
  context/StoreContext.tsx  catálogo, carrinho, cupom, conta, modais
  admin/
    main.tsx                entry do painel (admin.html)
    AdminApp.tsx            shell, navegação, SSE, toasts
    AuthScreen.tsx          senha → 2FA / link de uso único
    ui.tsx                  componentes base
    useLoad.ts              carregamento e ações assíncronas
    tabs/Operations.tsx     visão geral, pedidos, carrinhos, clientes
    tabs/Inventory.tsx      estoque, catálogo, cupons, banners
    tabs/System.tsx         financeiro, bot, segurança, ajustes
  components/               vitrine
```

---

## 4. Modelo de dados

| Coleção | Conteúdo |
| :--- | :--- |
| `products` | catálogo com inventário por variação `tamanho-cor` |
| `orders` | pedido com histórico de status, itens, frete, pagamento |
| `customers` | contas (scrypt) e endereços |
| `carts` | espelho do carrinho do navegador + status (`active`/`abandoned`/`converted`) |
| `cashflow` | entradas/saídas financeiras |
| `stockMovements` | auditoria de entradas/saídas com saldo posterior |
| `coupons`, `banners`, `reviews` | conteúdo e regras |
| `adminUsers`, `adminSessions`, `adminEntryTokens` | acesso administrativo |
| `auditLog`, `notifications`, `authAttempts` | governança e segurança |
| `settings` | identidade, Pix, frete |

`commit(mutator)` grava em `db.json.tmp` e faz `rename` atômico; a cada 50 gravações gera `db.backup.json`. Banco corrompido é preservado em `db.corrupted.json`.

---

## 5. API pública (`/api`)

| Método | Rota | Observação |
| :--- | :--- | :--- |
| GET | `/store` | catálogo + banners + configuração pública |
| GET | `/products`, `/products/:id/reviews` | vitrine |
| POST | `/checkout` | **recalcula** preços, cupom, frete e Pix |
| GET | `/orders/:id?email=` | exige o e-mail do pedido |
| POST | `/cart/sync` | rastreia carrinho para abandono real |
| POST | `/auth/register`, `/auth/login`, `/auth/logout` | contas |
| GET | `/auth/me`, `/me/orders` | sessão da cliente |
| POST | `/coupons/validate`, `/shipping/quote` | regras no servidor |
| POST | `/newsletter`, `/reviews` | conteúdo |
| POST | `/telegram/webhook/:secret` | modo webhook |

## 6. API administrativa (`/<caminho>/api`)

`auth/*` (login, verify, entry, logout, session) · `overview` · `orders` (+ pay, status, tracking) · `products` CRUD · `stock` (+ move, movements) · `cashflow` · `carts` · `customers` · `coupons` · `banners` · `settings` · `notifications` · `telegram/*` · `security/*` · `events` (SSE).

Todas as rotas (exceto `auth/*`) exigem sessão válida via cookie `HttpOnly` ou `Authorization: Bearer`.

---

## 7. Regras de negócio implementadas

- **Preço**: sempre do catálogo no servidor.
- **Cupom**: ativo, dentro da validade, compra mínima, escopo, limite de usos.
- **Frete**: tabela + frete grátis acima do limite configurado.
- **Estoque**: reservado na criação do pedido, devolvido no cancelamento (movimento `estorno`).
- **Transições**: `aguardando_pagamento → pago → em_separacao → enviado → entregue`; `cancelado` permitido até `enviado`.
- **Financeiro**: entrada lançada só na confirmação do pagamento; cancelamento pós-pago gera estorno.
- **Carrinho abandonado**: sem atualização por `CART_ABANDON_MINUTES` → status `abandoned` + notificação única.
- **Avaliações**: nota do produto é a média real; `verifiedBuyer` vem de pedido entregue.

---

## 8. Segurança

| Item | Implementação |
| :--- | :--- |
| Senhas | scrypt (N=16384, r=8, p=1), salt por usuário |
| 2FA | TOTP RFC 6238, janela ±30 s |
| Sessões | token aleatório de 256 bits; só o hash SHA-256 fica no banco |
| Dados sensíveis | AES-256-GCM (token do bot, segredo TOTP) |
| Caminho do painel | HMAC-SHA256 do segredo local |
| Força bruta | bloqueio após `ADMIN_MAX_ATTEMPTS` por `ADMIN_LOCK_MINUTES` |
| CSRF | `SameSite=Strict` + validação de `Origin` |
| Rate limit | janelas por IP em login, cadastro, checkout e carrinho |
| Auditoria | login, falhas, ações do bot, mudanças de credencial |

O antigo "painel blindado" com credenciais hardcoded no bundle e telemetria fictícia (`TLS 1.3`, IP mascarado aleatório) foi **removido**.

---

## 9. Bot do Telegram

- **Modo**: long polling (padrão) ou webhook quando `TELEGRAM_WEBHOOK_URL` existe.
- **Autorização**: apenas chat IDs cadastrados.
- **Comandos**: `/painel`, `/resumo`, `/pedidos [AUR-1000]`, `/estoque`, `/carrinhos`, `/clientes`, `/link`, `/status`, `/alertas`.
- **Botões (callback_data)**: `menu:*`, `o:v|p|s|h|d|c|t:<pedido>`, `st:p|m|q:<produto>`, `ct:c:<carrinho>`.
- **Estado de espera**: código de rastreio e ajuste manual de estoque (mapa em memória com TTL de 5 min).
- **Entrega**: `notify()` → banco → SSE → sink do Telegram (formatação HTML + teclado inline).

---

## 10. Tempo real

`EventSource` em `/<caminho>/api/events` (cookie de sessão). Eventos: `ready`, `change` (qualquer mutação) e `notification` (mesma fila do Telegram). O painel atualiza a aba ativa e exibe toast.

---

## 11. O que foi removido do projeto original

- `src/data/initialData.ts` com pedidos, fluxo de caixa, avaliações e métricas inventadas.
- `src/utils/security.ts` (hash de credenciais no `localStorage`, IP mascarado com `Math.random`).
- `src/components/AdminPanel.tsx` (1.600+ linhas com senha fixa `Supremo@...`, PIN `889922` e rota fixa `#/supremo-vault-7f9a2b8e`).
- Botão "Simular aprovação instantânea do Pix" e BR Code montado no navegador.
- Login de cliente que autenticava qualquer e-mail/senha.
- Selos falsos ("SSL 256-bit", CNPJ inventado, "gateway homologado").

Backup do estado anterior: `.backup/<data>/`.
