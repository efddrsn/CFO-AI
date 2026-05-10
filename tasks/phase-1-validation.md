# Phase 1 — Pluggy validation

> **Task pro Cowork**: validar end-to-end a fatia Pluggy da Fase 1 antes de seguir
> pra Gmail. Repo já tem typecheck/build verdes; o que falta é exercitar o
> caminho real (Pluggy sandbox → Postgres → categorização → UI).
>
> **Branch**: `claude/financial-planning-agent-kOigP` (PR #1)
> **Estado base**: commits até `5715b53` ("Phase 1 (Pluggy): connect, sync worker, sync-log diff, categorization")

---

## 0. Credenciais necessárias

Sem essas variáveis, a maioria das verificações abaixo falha. **Pare e peça ao
usuário** se alguma estiver faltando — não tente mockar.

| Var | Onde obter | Obrigatória? |
|---|---|---|
| `DATABASE_URL` | Postgres local (docker/apt) ou Supabase | ✅ |
| `JWT_SECRET` | `openssl rand -base64 32` (qualquer string ok pro teste) | ✅ |
| `PLUGGY_CLIENT_ID` | https://dashboard.pluggy.ai (free dev env) | ✅ |
| `PLUGGY_CLIENT_SECRET` | idem | ✅ |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com | ⚠️ — sem ela, categorização cai pra fallback "Não categorizado" (ainda válido pra validar pipeline) |

**Modo sandbox**: o widget Pluggy no `/connect` já passa `includeSandbox: true`
quando `NODE_ENV !== "production"`. Use o **conector "Pluggy Bank"** (sandbox)
no widget — não precisa conta real de banco.

---

## 1. Setup local (~5 min)

```sh
# 1.1 Instalar deps
pnpm install

# 1.2 Subir Postgres (qualquer caminho)
#   - apt: pg_ctlcluster 16 main start
#   - docker: docker run -d --name cfo-pg -e POSTGRES_PASSWORD=postgres \
#               -e POSTGRES_DB=cfo_ai -p 5432:5432 postgres:16
# Em qualquer caso: criar database `cfo_ai` e usuário com permissão.

# 1.3 .env raiz
cat > .env <<EOF
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cfo_ai
JWT_SECRET=$(openssl rand -base64 32)
PLUGGY_CLIENT_ID=...
PLUGGY_CLIENT_SECRET=...
ANTHROPIC_API_KEY=...
NODE_ENV=development
EOF

# (apps/web/.env, apps/etl/.env, packages/db/.env podem reusar — ver README)

# 1.4 Migrations + seed
pnpm db:migrate         # 17 tabelas
pnpm db:seed            # 68 categorias

# 1.5 Criar usuário
pnpm --filter @cfo-ai/db create-user test@cfo-ai.local 'senha-test-123' 'Test'
```

**Critério de aceite**:
- [ ] `psql -c '\dt'` lista 17 tabelas (`users, accounts, categories, transactions, sync_logs, ...`)
- [ ] `select count(*) from categories` = 68
- [ ] `select count(*) from users` = 1

---

## 2. Verificar build/typecheck (regressão — devem estar verdes)

```sh
pnpm turbo run typecheck --force
pnpm turbo run build --force
```

**Critério de aceite**:
- [ ] Typecheck: `Tasks: 7 successful, 7 total`
- [ ] Build: `Tasks: 3 successful, 3 total`
- [ ] Rotas listadas no build incluem: `/api/pluggy/connect-token`, `/api/pluggy/items`, `/api/pluggy/webhook`, `/connect`, `/sync-logs/[id]`

---

## 3. Smoke test do MCP server (regressão Fase 0)

```sh
# Inicializa + tools/list — deve retornar 6 tools
DATABASE_URL=$DATABASE_URL node -e "
const { spawn } = require('node:child_process');
const child = spawn('apps/mcp/node_modules/.bin/tsx', ['apps/mcp/src/index.ts'], { stdio: ['pipe','pipe','pipe'], env: process.env });
let buf=''; child.stdout.on('data',d=>{buf+=d.toString();while(buf.includes('\n')){const i=buf.indexOf('\n');const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;try{const r=JSON.parse(l);if(r.id===1)child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:2,method:'tools/list'})+'\n');if(r.id===2){console.log('Tools:',r.result.tools.map(t=>t.name).join(', '));child.kill();process.exit(0)}}catch{}}});
child.stdin.write(JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1.0'}}})+'\n');
setTimeout(()=>{child.kill();process.exit(1)},10000);
"
```

**Critério de aceite**:
- [ ] Stdout = `Tools: list_accounts, list_transactions, list_pending_syncs, approve_sync, reject_sync, expense_summary`

---

## 4. Pluggy: connect-token (auth + criação de token)

```sh
# 4.1 Subir o web app
pnpm --filter @cfo-ai/web dev &
# espera healthcheck
until curl -sf http://localhost:3000/api/health > /dev/null; do sleep 1; done

# 4.2 Login
curl -s -c /tmp/cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"test@cfo-ai.local","password":"senha-test-123"}'
# → {"ok":true}

# 4.3 Criar connect-token (vai bater na Pluggy real)
curl -s -b /tmp/cookies.txt -X POST http://localhost:3000/api/pluggy/connect-token \
  -H 'Content-Type: application/json' -d '{}'
# → {"accessToken":"<jwt-curto>"}
```

**Critério de aceite**:
- [ ] Health: `{"status":"ok","db":"ok"}`
- [ ] Login: `{"ok":true}` + cookie `cfo_session`
- [ ] connect-token: 200 com `accessToken` não-vazio (validação real contra Pluggy auth)
- [ ] Sem credenciais Pluggy: 502 com `pluggy_error` (testar comentando vars no .env)

---

## 5. Pluggy widget no /connect (manual ou via browser tool)

**Se o ambiente tiver browser/Playwright disponível:**

```sh
# Abre /connect, esperar o botão aparecer, clicar, completar fluxo sandbox
# usando conector "Pluggy Bank" com credentials user/user.
```

Se não houver browser, **ao menos validar SSR**:
```sh
curl -s -b /tmp/cookies.txt http://localhost:3000/connect | grep -E "Conectar via Pluggy|Open Finance BR"
```

**Critério de aceite**:
- [ ] HTML servido contém o botão e o título "Open Finance BR (Pluggy)"
- [ ] (Browser) Widget Pluggy abre, fluxo sandbox completa, retorna `item.id`
- [ ] (Browser) Após sucesso, callback `/api/pluggy/items` cria account + integration_credential. Verificar com:
  ```sh
  PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai -c \
    "SELECT name, type, source, source_account_id FROM accounts WHERE source='pluggy';"
  PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai -c \
    "SELECT provider, account_link, expires_at FROM integration_credentials;"
  ```

**Se não houver browser**: usar a API Pluggy direto pra criar um item sandbox e simular o callback:
```sh
# Pegar accessToken (passo 4.3) e POSTar pra Pluggy /items com conector sandbox 0
# (o Cowork pode pular este passo e marcar como "needs browser" — relate isso no resultado)
```

---

## 6. Worker pluggy-sync end-to-end

**Pré-condição**: ter ao menos um item Pluggy registrado em `integration_credentials`
(passo 5).

```sh
pnpm pluggy-sync --days 30
```

Saída esperada:
```
Syncing all Pluggy items (30d window)...
Done: N item(s) synced.
  <itemId>: +X new, Y dup, Z err (sync_log <uuid>)
```

Validações no banco:
```sh
PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai <<'SQL'
SELECT id, source, status, summary FROM sync_logs ORDER BY started_at DESC LIMIT 1;
SELECT count(*), status FROM transactions GROUP BY status;
SELECT date, original_description, amount_cents, currency, category_id, installment_number, installment_total
  FROM transactions WHERE status='pending_sync' ORDER BY date DESC LIMIT 10;
SQL
```

**Critério de aceite**:
- [ ] `sync_logs` tem entry com `source='pluggy'`, `status='pending_review'`
- [ ] `summary` JSON tem `inserted`, `skippedDuplicates`, `errors`, `accountsScanned`
- [ ] `diff` JSON tem array com até 200 entradas, cada uma com `status: inserted|duplicate|error`
- [ ] Pelo menos 1 transação em `status='pending_sync'`
- [ ] `raw_json.pluggy` preserva o payload original; `raw_json.categorization` tem `source` (rule|llm|fallback), `confidence`, `rationale`
- [ ] Re-rodar `pnpm pluggy-sync` deve dar `inserted=0, skippedDuplicates>=N` (idempotência via `(account_id, source_txn_id)`)

---

## 7. Categorização funcionou?

Olhar 5 transações aleatórias e validar:

```sql
SELECT
  t.original_description,
  t.amount_cents,
  c.name AS category,
  s.name AS subcategory,
  t.raw_json->'categorization'->>'source' AS cat_source,
  t.raw_json->'categorization'->>'confidence' AS confidence,
  t.raw_json->'categorization'->>'rationale' AS rationale
FROM transactions t
LEFT JOIN categories c ON c.id = t.category_id
LEFT JOIN categories s ON s.id = t.subcategory_id
WHERE t.status='pending_sync'
ORDER BY random() LIMIT 5;
```

**Critério de aceite (com `ANTHROPIC_API_KEY` set)**:
- [ ] Pelo menos algumas transações têm `cat_source='llm'` com `confidence > 0.6`
- [ ] `rationale` contém texto humano (não vazio)
- [ ] Categoria atribuída faz sentido (ex.: "Salário" → categoria pai "Renda")
- [ ] Categorias inválidas/desconhecidas resultam em fallback "Não categorizado" — não em erro

**Sem `ANTHROPIC_API_KEY`**:
- [ ] Todas as txns ficam em "Não categorizado" com `cat_source='fallback'` e rationale = "ANTHROPIC_API_KEY missing — skipping LLM"
- [ ] Ou seja: pipeline não quebra sem LLM.

---

## 8. Approve flow via API + UI

```sh
SYNC_ID=$(PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai -tAc \
  "SELECT id FROM sync_logs WHERE status='pending_review' ORDER BY started_at DESC LIMIT 1")

# Detalhe da página
curl -s -b /tmp/cookies.txt "http://localhost:3000/sync-logs/$SYNC_ID" | \
  grep -E "Sync · pluggy|pending_review|Transações neste sync"

# Approve via API
curl -s -b /tmp/cookies.txt -X POST "http://localhost:3000/api/sync-logs/$SYNC_ID/approve"
# → {"ok":true}

# Verificar transição
PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai -c \
  "SELECT status FROM sync_logs WHERE id='$SYNC_ID';"
PGPASSWORD=postgres psql -h localhost -U postgres -d cfo_ai -c \
  "SELECT count(*), status FROM transactions WHERE sync_log_id='$SYNC_ID' GROUP BY status;"
```

**Critério de aceite**:
- [ ] HTML do `/sync-logs/<id>` lista transações com colunas (Data, Descrição, Conta, Categoria, Valor, Status)
- [ ] Após approve: `sync_logs.status='approved'`, `approved_at` preenchido
- [ ] Todas as txns deste sync passam de `pending_sync` → `active`
- [ ] Re-aprovar mesmo sync retorna 409 `invalid_state`

---

## 9. Approve via MCP tool (cross-check)

Repetir o fluxo (rodar `pluggy-sync` de novo gera novo SyncLog), mas dessa vez
aprovar via MCP server:

```sh
DATABASE_URL=$DATABASE_URL node -e "
const { spawn } = require('node:child_process');
const child = spawn('apps/mcp/node_modules/.bin/tsx', ['apps/mcp/src/index.ts'], { stdio: ['pipe','pipe','pipe'], env: process.env });
const send = (id, method, params) => child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');
let pending = null;
let buf=''; child.stdout.on('data',d=>{buf+=d.toString();while(buf.includes('\n')){const i=buf.indexOf('\n');const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;try{const r=JSON.parse(l);
  if(r.id===1) send(2,'tools/call',{name:'list_pending_syncs',arguments:{}});
  if(r.id===2){const arr=JSON.parse(r.result.content[0].text);if(arr.length===0){console.log('No pending');child.kill();process.exit(0)}pending=arr[0];send(3,'tools/call',{name:'approve_sync',arguments:{sync_log_id:pending.id}})}
  if(r.id===3){console.log('Approve via MCP:',r.result.content[0].text);child.kill();process.exit(0)}
}catch{}}});
send(1,'initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'test',version:'1.0'}});
setTimeout(()=>{child.kill();process.exit(1)},10000);
"
```

**Critério de aceite**:
- [ ] `list_pending_syncs` via MCP retorna o sync correto
- [ ] `approve_sync` retorna `{ok:true,status:'approved'}` e o DB confirma a transição

---

## 10. Webhook de Pluggy (assinatura opcional)

```sh
curl -s -X POST http://localhost:3000/api/pluggy/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"item/updated","itemId":"00000000-0000-0000-0000-000000000000"}'
# → {"ok":true}  (item inexistente é OK — só atualiza last_refresh_at se existir)

# Com PLUGGY_WEBHOOK_SECRET configurado, sem header → 403
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:3000/api/pluggy/webhook \
  -H 'Content-Type: application/json' \
  -d '{"event":"item/updated","itemId":"00000000-0000-0000-0000-000000000000"}'
# → 403 (se PLUGGY_WEBHOOK_SECRET set)
```

**Critério de aceite**:
- [ ] Sem secret configurado: aceita qualquer POST e retorna 200
- [ ] Com `PLUGGY_WEBHOOK_SECRET` no `.env`: 403 sem `x-pluggy-secret`, 200 com header correto
- [ ] Path `/api/pluggy/webhook` está em `PUBLIC_PATHS` (não exige login)

---

## 11. Erros esperados / paths negativos

Validar que falhas comuns falham bem (não quebram tudo):

| Cenário | Esperado |
|---|---|
| `pluggy-sync` sem `PLUGGY_CLIENT_ID/SECRET` | sai com erro claro, não cria sync_log corrompido |
| `pluggy-sync` sem items registrados | "Done: 0 item(s) synced" — exit 0 |
| `pluggy-sync` com clientId inválido | logs do `Pluggy auth failed` no stderr; sync_log marcado como `failed` ou nem cria |
| `/api/pluggy/items` com `itemId` malformado | 400 `invalid_body` |
| Approve de sync já aprovado | 409 `invalid_state` |
| Login com senha errada | 401 `invalid_credentials` |

---

## Output esperado da task

Quando terminar, postar comentário no PR (ou retornar ao usuário) com:

1. **Resumo binário**: pass/fail por seção (1-11 acima).
2. **Logs relevantes** dos passos 4, 6, 7, 8 (3 linhas cada, suficiente pra
   confirmar que rodou).
3. **Bugs encontrados**: lista com arquivo:linha + descrição. **Não tente
   consertar** — só reportar — exceto se for óbvio (typo, import faltante).
4. **Itens marcados como skipped** (ex.: passo 5 widget sem browser).
5. **Sugestões pra Fase 1.5 (Gmail)** se houver dependência ou refactor visível.

Não rodar Gmail nem alertas de re-consent — esses ainda não foram implementados.

## Pontas soltas conhecidas (não são bugs, antecipa o feedback)

- `cache_control` no `@cfo-ai/agent` é cast pra `unknown as TextBlockParam[]`
  porque o SDK 0.32.x ainda não tipou prompt caching. API aceita.
- `installment_group_id` fica null no Pluggy import — Pluggy não fornece;
  agrupar parcelas é trabalho do reconciler (não está no escopo da Fase 1).
- Pluggy `/items` POST não persiste `encryptedToken` real (Pluggy não retorna
  token reutilizável; o `item_id` basta). Coluna fica em string vazia.
- Sem teste unitário ainda — toda validação é integração / SQL.
