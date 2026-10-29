# 🌸 Aura Rosa · Flor de Seda

E-commerce de moda feminina com **backend real**, painel administrativo em **caminho criptografado + porta separada** e **bot de Telegram operacional** (notificações e comandos por botões).

> Tudo o que aparece na loja e no painel vem do banco de dados. Não há pedidos, avaliações, carrinhos, métricas ou "aprovações de pagamento" simuladas.

---

## 1. Como rodar

```bash
npm install
npm run dev        # loja + painel + bot (desenvolvimento, HMR)
```

| Serviço | Endereço |
| :--- | :--- |
| Loja | http://localhost:3000 |
| Painel administrativo | http://localhost:3100/`<caminho-criptografado>`/ |

O caminho do painel **não é fixo**: ele é derivado por HMAC-SHA256 de um segredo local e é impresso no console ao iniciar. Para produção:

```bash
npm run build
npm start
```

### Primeiro acesso

O servidor cria o administrador na primeira execução:

- **Usuário:** definido em `ADMIN_USER` (`.env.local`)
- **Senha:** definida em `ADMIN_PASSWORD`; se ficar vazia, uma senha aleatória é gerada e exibida **uma única vez** no console
- **2FA:** TOTP (Google Authenticator, Authy, 1Password…). O segredo inicial é impresso no console; troque em **Segurança → Credenciais**

> Troque a senha e o 2FA no primeiro acesso. Tudo fica registrado na trilha de auditoria.

---

## 2. Bot do Telegram (notificações + operação)

O bot avisa e **executa ações reais**:

| Evento | Notificação |
| :--- | :--- |
| Compra criada | cliente, itens, frete, total, forma de pagamento |
| Pagamento confirmado | valor e status |
| Entrada / saída de estoque | variação, saldo, motivo, responsável |
| Estoque baixo | variação e quantidade restante |
| Carrinho abandonado | valor, itens e inatividade |
| Conta criada | nome, e-mail, telefone |
| Entrada/saída financeira e alertas de segurança | valor e contexto |

**Painel por botões** (`/painel`): confirmar pagamento, iniciar separação, marcar enviado/entregue, cancelar (com estorno de estoque), ajustar estoque, marcar carrinho como contatado e gerar um **link de uso único** para abrir o painel web.

### Configurando em 4 passos

1. Crie um bot com o [@BotFather](https://t.me/BotFather) e copie o token.
2. Envie `/start` para o seu bot.
3. Abra o painel → **Bot Telegram** → cole o token → **Validar e conectar**.
   O servidor chama `getMe` na API oficial do Telegram e descobre o chat automaticamente; token inválido é recusado pelo próprio Telegram.
4. Clique em **Enviar teste** e depois em `/painel` no Telegram.

Também é possível configurar por variáveis de ambiente (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `TELEGRAM_ADMIN_IDS`).

### Webhook (produção com HTTPS)

```env
TELEGRAM_WEBHOOK_URL=https://admin.sualoja.com.br/telegram/webhook
TELEGRAM_WEBHOOK_SECRET=um-segredo-longo-e-aleatorio
```

Com isso o polling é desligado automaticamente.

---

## 3. Segurança do painel

- **Caminho cifrado**: `/` + HMAC-SHA256(segredo local) — não reversível, estável entre reinícios. Pode ser rotacionado no painel.
- **Porta separada** (`ADMIN_PORT`): a porta administrativa responde **404 em tudo** que não seja o caminho cifrado.
- **Dois fatores reais**: senha com scrypt + TOTP (RFC 6238). O código pode ser enviado pelo Telegram.
- **Sessões opacas** de 256 bits, guardadas apenas como hash no servidor, cookie `HttpOnly` + `SameSite=Strict`.
- **Bloqueio progressivo** por IP após tentativas falhas, com trilha de auditoria e notificação no Telegram.
- A loja **não expõe nenhum atalho** para o painel: o acesso é pelo link do bot ou pela URL impressa no console.

Chaves mestras: `server/data/keys.json` (gerado na primeira execução, permissão restrita). **Faça backup dele** — sem ele os segredos salvos (token do bot, segredo 2FA) não podem ser decifrados.

---

## 4. Fluxo de pagamento (honesto por padrão)

- **Pix**: o servidor gera um **BR Code válido** (EMV + CRC16) com chave, valor e identificador do pedido. A confirmação é feita pela loja (painel ou botão no Telegram) ou futuramente por webhook de gateway.
- **Cartão / boleto**: o pedido é registrado como *aguardando pagamento*; a loja envia o link/instruções e confirma manualmente. Nenhum pagamento é "aprovado" automaticamente.
- Todo pedido é recalculado no servidor: preço, cupom, frete e desconto do Pix **nunca** vêm do navegador.

---

## 5. Estrutura

```
server/
  config.js              configuração e chaves
  index.js               loja + painel + agendador
  lib/                   criptografia, banco, Pix, HTTP, Telegram
  services/              catálogo, pedidos, estoque, carrinhos, contas, financeiro, bot
  routes/                API pública e API administrativa
  seed/                  catálogo inicial (somente produtos)
  data/                  db.json, keys.json (não versionar)
src/
  lib/api.ts             cliente HTTP único
  context/StoreContext   estado da loja vindo da API
  admin/                 painel (login 2FA, shell, abas)
  components/            vitrine
```

Detalhes técnicos em [ARQUITETURA.md](ARQUITETURA.md).

---

## 6. Scripts

| Comando | Função |
| :--- | :--- |
| `npm run dev` | servidor com Vite em modo middleware |
| `npm run build` | build de produção (loja + painel) |
| `npm start` | servidor de produção |
| `npm run lint` | checagem de tipos |
| `node server/tools/smoke.mjs <caminho> <segredo>` | teste ponta a ponta da API |
