# painel-adm-backend

API do painel administrativo do Gatil Irmã Francisca (gatos, financeiro e Rifa/Ação Solidária).

## Rodar

```bash
cp .env.example .env   # preencha JWT_SECRET (npm run generate-secret-key), MONGODB_*, FRONTEND_URL
npm install
npm run dev
```

## Primeiro acesso (Admin)

`POST /auth/register` só aceita um **Admin logado**. O primeiro Admin é criado pelo terminal:

```bash
ADMIN_LOGIN=fulana ADMIN_EMAIL=fulana@exemplo.org ADMIN_SENHA='Uma.Senha.Forte1' npm run criar-admin
```

## Segurança

- Sem `JWT_SECRET` (mínimo 32 caracteres) o servidor não sobe; tokens são HS256 e expiram em 7 dias.
- Login com limite de 10 tentativas erradas por IP a cada 15 minutos e a mesma resposta para usuário inexistente ou senha errada.
- `helmet` e corpo JSON limitado a 100 kB.
- Rotas internas (`/financeiro/interno/*`) exigem `x-internal-secret`, comparado em tempo constante.
- Dados pessoais dos compradores (`/rifa/*`) só com JWT.

## Rifa / Ação de Natal

| Rota (JWT) | O que faz |
|---|---|
| `GET /rifa/resumo` | Vagas: compradas, pendentes de escolha, reservadas (Pix antigo + números de compras do site ainda no prazo) e disponíveis |
| `GET /rifa/listar-rifas` | Um registro por número (sem reservas vencidas) |
| `GET /rifa/pedidos?status=&busca=` | Compras com reserva: números, valor, Pix/cartão, contato, prazos e alertas. `busca` por número, nome, e-mail ou WhatsApp |
| `GET /rifa/alertas` | Pagamento em dobro (estornar), valor divergente, pago depois da reserva vencer, números a escolher |
| `GET /rifa/exportar.csv` | Planilha dos números vendidos (sem cache; fórmulas neutralizadas) |
| `DELETE /rifa/excluir-rifa/:numero[?forcar=1]` | Número reservado agora não sai; comprado pelo site só com `forcar=1` |

As compras ficam na coleção `pedidos` do banco da rifa, gravada pelo `gatil-mercadopago-backend`; o painel só lê.

## Testes

```bash
npm test   # Vitest + supertest + MongoDB em memória
```
