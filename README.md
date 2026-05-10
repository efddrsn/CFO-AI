# CFO-AI

Seu CFO pessoal autônomo. Veja [`SPEC.md`](./SPEC.md) pra visão, arquitetura e roadmap.

> **Status:** Fase 0 (Fundação) implementada.

## Estrutura (Turborepo)

```
apps/
  web/        Next.js 15 + Tailwind — UI + API routes (auth, transactions, sync-logs)
  mcp/        MCP server (Node) — tools consumidas por Claude Desktop / agente proativo
  etl/        Workers e CLI — começa com `import-csv`
packages/
  db/         Schema Drizzle + migrations + seed de categorias
  shared/     Types e utils compartilhados (Currency, money helpers)
```

## Pré-requisitos

- Node 22+ (`.node-version`)
- pnpm 9+
- Postgres 15+ (local ou Supabase)

## Setup local

```sh
# 1. Instalar dependências
pnpm install

# 2. Copiar env e preencher
cp .env.example .env
# Edite .env: DATABASE_URL, JWT_SECRET (openssl rand -base64 32)

# 3. Gerar migration inicial e aplicar
pnpm db:generate
pnpm db:migrate

# 4. Seed da taxonomia (§6.1 da SPEC)
pnpm db:seed

# 5. Criar seu usuário (single-user)
pnpm --filter @cfo-ai/db create-user voce@email.com 'sua-senha' 'Seu Nome'

# 6. Subir o app web
pnpm --filter @cfo-ai/web dev
# → http://localhost:3000 (login: voce@email.com / sua-senha)
```

## Importar um CSV

CSV mínimo (header obrigatório): `date,description,amount[,currency,counterparty,source_txn_id]`

Datas: `yyyy-mm-dd` ou `dd/mm/yyyy`. Valores: aceitam vírgula ou ponto como decimal; negativo = débito.

```sh
# 1. Crie uma conta no Postgres pra receber as transações.
# (UI de contas vem na Fase 2; pra Fase 0 use Drizzle Studio)
pnpm db:studio

# 2. Importe um CSV → vira SyncLog(pending_review)
pnpm import-csv apps/etl/sample.csv --account <uuid-da-conta>

# 3. Aprove em http://localhost:3000/sync-logs
```

`--auto-approve` pula a revisão (útil em scripts).

## Conectar ao Claude Desktop (MCP)

```sh
pnpm --filter @cfo-ai/mcp build
```

Adicione ao `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS):

```json
{
  "mcpServers": {
    "cfo-ai": {
      "command": "node",
      "args": ["/caminho/absoluto/CFO-AI/apps/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgresql://..."
      }
    }
  }
}
```

Reabra o Claude Desktop. Tools disponíveis na Fase 0: `list_accounts`, `list_transactions`, `list_pending_syncs`, `approve_sync`, `reject_sync`, `expense_summary`.

## Comandos úteis

```sh
pnpm dev               # roda tudo em paralelo (Turborepo)
pnpm build             # build de tudo
pnpm typecheck         # typecheck em todos os pacotes
pnpm db:studio         # Drizzle Studio (GUI do banco)
```

## Deploy

- **Postgres**: Supabase (free tier).
- **Web**: Vercel apontando pra `apps/web`. Vars: `DATABASE_URL`, `JWT_SECRET`.
- **MCP / ETL**: Railway. Var: `DATABASE_URL`.

## Próximas fases

Ver [`SPEC.md` §7](./SPEC.md). Próxima: Fase 1 — ingestão Pluggy + Gmail.
