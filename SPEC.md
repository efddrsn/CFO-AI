# CFO-AI — Especificação v0.3

> Documento vivo. Objetivo: alinhar visão, arquitetura e roadmap antes de escrever código.
> Status: **escolhas confirmadas — pronto pra começar Fase 0**.

**Decisões fechadas (v0.3):**
- Stack: TypeScript end-to-end (Next.js + Node)
- Monorepo: **Turborepo** com `apps/web`, `apps/api`, `apps/mcp`, `apps/etl`, `packages/db`, `packages/shared`
- ORM: **Drizzle** (type-safe SQL, leve, fácil de migrar)
- Hosting: Railway (api/etl/mcp) + Vercel (web)
- UI: web-first (dashboard direto)
- **Agente: MCP-first.** Tools expostas via servidor MCP local; cliente pode ser Claude Desktop, Claude Code, Cursor ou agente proativo interno (cron) — todos consomem as mesmas tools.
- LLM padrão: **Sonnet 4.6** pra categorização e análise; Opus 4.7 só pra projeções/planejamento complexo (Fase 6+)
- Notificações: Telegram (free, instant) → WhatsApp como upgrade futuro
- Refresh do Pluggy: **1×/dia**
- Orçamento: até **R$ 150/mês** em serviços externos
- Bancos do usuário: **Itaú PF, Nubank PF, Nubank PJ, Nomad, MITFCU**
- Estratégia BR: **Pluggy Development environment (free, 100 items)** como fonte primária, complementada por email/PDF parsing
- Estratégia US: **Teller.io free tier** (100 enrollments) → Plaid Limited Production como fallback
- Metas: feature do produto (usuário cria/edita no dashboard, agente acompanha) — sem seed inicial
- Categorias: taxonomia 2 níveis (ver §6.1) seedada como ponto de partida; **evolui via LLM com few-shot das correções recentes** (sem embeddings/clustering — ver §6.2)
- Ingestão: **sync approval workflow** — toda importação cria `SyncLog(pending)` revisável antes de virar canônica (inspirado no Argus)

---

## 1. Visão

Um "CFO pessoal" autônomo: agente de IA + dashboard que centraliza todos os dados financeiros do usuário (contas BR + US, cartões, investimentos, cripto), entende metas e restrições, e age proativamente — projeta cenários, alerta sobre desvios, sugere realocações, prepara relatórios sem intervenção manual.

**Princípio orientador:** minimizar trabalho do usuário em **dois eixos** — atualizar dados (ingestão) e consumir insights (visualização/decisão). Tudo que puder ser automatizado, será. O resto é "gambiarra inteligente" (parsing de email, OCR de PDF, scraping autorizado).

**Escopo inicial:** single-user (você). Multi-tenant fica como decisão futura — muda muita coisa em segurança/billing/permissões.

---

## 2. Casos de uso (o que o agente faz)

### Passivo / observabilidade
- "Qual meu net worth hoje, em BRL e USD?"
- "Quanto gastei em restaurante esse mês vs últimos 6?"
- "Mostra o cashflow projetado dos próximos 12 meses"
- "Quais transações pareceram fora do padrão essa semana?"

### Planejamento
- "Tenho meta de X em Y meses — é factível com a renda atual? O que precisa mudar?"
- "Se eu aplicar R$ Z agora a 110% CDI, o que acontece com meu colchão?"
- "Vou comprar um carro de R$ 80k em 6 meses — projeta 3 cenários (à vista, financiado, consórcio)"

### Proativo (sem o usuário perguntar)
- Alerta semanal: "Você gastou 130% do orçamento em delivery — projeção do mês excede meta por R$ 600"
- Alerta de oportunidade: "Sobrou R$ 5k na conta corrente parado há 14 dias; rendendo só CDI da conta. Sugestão: alocar em [X]"
- Alerta de risco: "Cartão Itaú fecha em 3 dias com R$ 12k — saldo BRL não cobre, precisa transferir do US"
- Relatório mensal automático no email com gráficos e narrativa

---

## 3. Restrições e premissas

- **Usuário único** (você). Auth simples; sem multi-tenant.
- **Privacidade total**: dados não saem da sua infra (Railway + Supabase sob sua conta). Tokens/credenciais em vault.
- **Orçamento**: ≤ **R$ 150/mês** em serviços externos. Cabe (ver §5.1).
- **Latência aceitável**: dados podem ter até 24h de defasagem. Não é trading.
- **LGPD**: como single-user, baixa exposição. Mesmo assim, criptografia at-rest e em trânsito.
- **Editabilidade**: o usuário precisa conseguir mexer em categorização, regras, metas, premissas de projeção sem mexer em código.

---

## 4. Fontes de dados — mapa da realidade

### 🇧🇷 Brasil

| Fonte | Como acessar | Custo | Trabalho do usuário |
|---|---|---|---|
| **Pluggy Development environment** ⭐ | Conta Dashboard Pluggy (free dev) com **limite de 100 items** — suficiente pra single-user. OFB regulado + "conexão direta" (scraping autorizado da Pluggy) em ~80 instituições. | **R$ 0** (permanente, não é trial). | Widget de consentimento OFB (~1min, renova a cada 12 meses) |
| **MeuPluggy (`meu.pluggy.ai`)** | Interface consumer da Pluggy — usuário conecta contas e gerencia consentimentos. Útil como UX de fallback se quisermos. | Grátis. | Mesma renovação OFB. |
| **Pluggy Production** | Plano pago, sem limite de items. | **R$ 2.500+/mês**. Não cabe no orçamento. | — |
| **Belvo** | Similar. Sandbox grátis (25 links). | "Launch" a partir de **US$ 1.000/mês + 12m contrato**. | — |
| **Faturas por email (Nubank, Itaú, etc.)** | Gmail API → PDF → Claude (Haiku 4.5) extrai transações. | Tokens LLM (~centavos/fatura). | Configurar Gmail OAuth uma vez. |
| **Notificações Itaú por email** | Itaú permite ativar email pra cada transação (Pix, cartão, débito). Gratuito. | Grátis. | Ativar uma vez no app Itaú. |
| **pynubank (não-oficial)** | Lib Python; faz login com CPF+senha. | Grátis. | Setup 2FA; pode quebrar. |
| **CSV/OFX manual** | Download pelo internet banking. | Grátis. | ~5min/mês/banco. |

**Decisão BR:** **Pluggy Dev env** como fonte primária (cobre Itaú, Nubank PF/PJ, BB, Inter, XP, etc.) + **email/PDF parsing** como complemento (preenche gaps conhecidos do Pluggy: parcelados, Pix no crédito, transferências sem beneficiário). Nomad fica fora do Pluggy (US-based) → statement mensal manual + email parsing.

### 🇺🇸 Estados Unidos

| Fonte | Como acessar | Custo | Notas |
|---|---|---|---|
| **Plaid** | API. "Limited Production" dá **200 calls grátis por produto** com dados live; pay-as-you-go depois. | Auth ~$1-2 one-time/item, Transactions ~$0.30-0.60/call ou **subscription ~$1.50/user/mês**, Investments e Liabilities têm subscription separada, Balance ~$0.10/call. Sem free tier de produção. | Cobertura excelente (Chase, BofA, Wells, Citi, Schwab, Amex, IBKR). Padrão da indústria. |
| **Teller.io** | API REST limpa. **Tier "development" gratuito com até 100 enrollments**, mesmo dataset de produção. | Grátis no tier dev (suficiente pra single-user). Pago é ~$0.25-1/account/mês. | **Melhor escolha pra single-user**. Cobertura US-only menor que Plaid em brokerages — pra investments, complementar com Schwab API direto. |
| **Schwab Developer API** | OAuth direto, conta individual já habilita. | Grátis. | Holdings, transações, P&L. Access token expira em 30min, refresh token em 7 dias. |
| **Fidelity** | **Bloqueou screen-scraping em 2023**, sem API retail. | — | Acesso só via Plaid (após production approval, com delay) ou import manual. |
| **Amex/Chase/Capital One** | Via Plaid/Teller. Amex tem export CSV manual também. | — | — |
| **Email parsing** | Mesmo padrão do BR — statements PDF mensais. | Tokens LLM. | Bom fallback. |

**Decisão recomendada:** **Teller.io** como primária (free tier resolve 100% do uso pessoal). **Schwab API direto** pra brokerage. Plaid só se Teller não cobrir algum banco específico.

### 🪙 Cripto

- **Exchanges** (Binance, Coinbase, Kraken, etc.): API keys com permissão **read-only** ("Enable Reading" / `wallet:*:read` / "Query funds"). Use **CCXT** — lib unificada Python/JS que normaliza schema entre 100+ exchanges. ~1 dia pra cobrir todas.
- **On-chain (carteiras por endereço)**: read-only é grátis. Pra portfolio agregado por wallet em qualquer chain, **Zerion API** ou **Zapper API** já entregam holdings normalizados (mata necessidade de Etherscan + Alchemy + parser por chain).

### 📈 Investimentos BR (corretoras)
- B3 / Investidor.gov: portal do CPF tem extrato consolidado, mas API pública limitada.
- XP, BTG, Rico: via Open Finance (Pluggy Dev env cobre).
- Tesouro Direto: via OFB (Pluggy) ou scraping do portal.

---

## 4.5. Plano específico por banco (do usuário)

| Banco | Fonte primária | Complemento | Setup (1×) | Manutenção |
|---|---|---|---|---|
| **Itaú PF** | Pluggy Dev (OFB) | Notificações por email pra cada transação (Pix/cartão/débito) + OFX manual mensal pra reconciliar | Consentimento OFB no widget Pluggy + ativar notif email no app Itaú + Gmail OAuth | ~2min/mês (OFX backup) |
| **Nubank PF** | Pluggy Dev (conexão direta) | Email Pix recebido + PDF fatura mensal (Gmail) | Consent Pluggy + Gmail OAuth | 0min |
| **Nubank PJ** | Pluggy Dev | Agendar envio recorrente OFX/CSV no app Nubank PJ por email | Consent Pluggy + agendamento + Gmail OAuth | 0min |
| **Nomad** | Statement mensal por email + parsing PDF | Confirmações de transferência por email (real-time) | Gmail OAuth + ativar statement | ~3min/mês |
| **MITFCU** | Teller.io (free dev tier) | Plaid Limited Production como fallback se Teller não cobrir | OAuth via Teller Connect | 0min |

**Setup inicial total:** ~1h. **Trabalho mensal recorrente:** ~5-10min (Itaú backup + Nomad statement). Tudo o resto roda sozinho.

**Cobertura esperada de transações automáticas:**
- Itaú: ~95% (Pluggy + email backup pra divergências)
- Nubank PF: ~92% (Pluggy cobre maioria; email pega Pix; gaps em parcelado/Pix-crédito)
- Nubank PJ: ~98% (extrato OFX agendado é canônico)
- Nomad: ~80% (movimentação baixa, statement mensal já pega tudo)
- MITFCU: ~98% (Teller é confiável)

---

## 5. Arquitetura proposta

**MCP-first**: a inteligência vive em qualquer cliente MCP (Claude Desktop pra conversa interativa; agente proativo interno pra cron). Os dois consomem as mesmas tools expostas pelo servidor MCP, que é uma camada fina sobre a API.

```
┌─────────────────────────────────────────────────────────┐
│ CLIENTES (escolha do usuário)                           │
│ • Claude Desktop  • Claude Code  • Cursor               │
│ • Agente proativo interno (cron, Sonnet 4.6)            │
└─────────────────────────────────────────────────────────┘
                          │ MCP (stdio/SSE)
                          ▼
┌─────────────────────────────────────────────────────────┐
│ apps/mcp — MCP Server (TS)                              │
│ Tools (camada fina sobre API):                          │
│  • list_transactions, query_transactions                │
│  • get_balances, get_net_worth, get_cashflow            │
│  • list_accounts, list_categories                       │
│  • list_pending_syncs, approve_sync, reject_sync        │
│  • bulk_categorize, recategorize_one                    │
│  • list_goals, update_goal_progress                     │
│  • project_cashflow, what_if                            │
│  • list_proposals, accept_proposal, reject_proposal     │
│  • create_alert, list_alerts                            │
└─────────────────────────────────────────────────────────┘
                          │ HTTP/JSON + JWT
                          ▼
┌─────────────────────────────────────────────────────────┐
│ apps/api — Next.js API routes (TS)                      │
│  • REST endpoints (read+write)                          │
│  • Auth single-user (password + JWT)                    │
│  • Service layer (business logic)                       │
└─────────────────────────────────────────────────────────┘
                          │
       ┌──────────────────┼──────────────────┐
       ▼                  ▼                  ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ apps/web     │   │ apps/etl     │   │ Postgres     │
│ (Next.js)    │   │ (cron        │   │ (Supabase)   │
│              │   │  workers)    │   │              │
│ Dashboard    │   │              │   │ Tabelas:     │
│ Tremor       │   │ Conectores:  │   │ accounts     │
│ Editor de    │   │ • Pluggy     │   │ transactions │
│  regras,     │   │ • Teller     │   │ balances     │
│  categorias, │   │ • Schwab     │   │ categories   │
│  metas       │   │ • Gmail+PDF  │   │ goals, rules │
│ Aprovação    │   │ • CCXT       │   │ sync_logs    │
│  de sync e   │   │ → cria       │   │ proposals    │
│  proposals   │   │ SyncLog      │   │ alerts       │
│              │   │ pendente     │   │              │
└──────────────┘   └──────────────┘   └──────────────┘
                                              │
                                              ▼
                                      ┌──────────────┐
                                      │ Supabase     │
                                      │ Vault        │
                                      │ (tokens)     │
                                      └──────────────┘
```

**Por que MCP-first:**
- Claude Desktop / Cursor já são clientes de chat polidos — não construímos UI de chat
- Mesmo conjunto de tools serve agente interativo (humano) e proativo (cron)
- Plug-in fácil de novos clientes (Telegram bot pode ser MCP client futuramente)
- Testabilidade: tools têm contratos, podem ser testadas isoladas

### Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript end-to-end** (Node + Next.js) | Stack unificada, ExcelJS/SheetJS nativos, Vercel AI SDK pra streaming, deploy mais simples. Subpacote Python só se precisar (ex.: `pynubank`, OCR mais pesado). |
| Frontend | **Next.js 16 + shadcn/ui + Tremor** | Tremor cobre todos os charts financeiros. TanStack Table pra grid de transações editável. Vercel AI SDK pra chat com streaming. |
| Banco | **Postgres** (Supabase ou Neon) | Free tier generoso, RLS se virar multi-user. **DuckDB** opcional pra análises ad-hoc / projeções (lê Parquet, ótimo pra what-if rápido sem mexer no Postgres). |
| Agente (proativo interno) | **Claude Agent SDK + Sonnet 4.6** (default), Opus 4.7 só pra projeções complexas (Fase 6+) | MCP-first: o servidor MCP expõe tools; o agente interno consome via MCP local. Prompt caching pra contexto fixo (regras, metas, schema). Anthropic [finance agent templates](https://github.com/anthropics/financial-services) como referência. |
| Agente (interativo) | **Claude Desktop / Claude Code / Cursor** consumindo o MCP server | Sem chat UI custom. Você usa o cliente que preferir. |
| Hosting | **Railway** (backend/cron) + **Vercel** (frontend) | ~$10-15 USD/mês. |
| Vault | **Supabase Vault** (libsodium) | Tokens Pluggy item_id, Teller access_token, Gmail refresh_token, exchange API keys. |
| Notificações | **Telegram Bot** (primário) + **Resend** (email fallback) | WhatsApp Business Cloud API fica como upgrade na Fase 5/6. |
| Observabilidade | **Sentry + Axiom** | — |

### 5.1 Orçamento mensal (cabe nos R$ 150)

| Serviço | Custo estimado |
|---|---|
| Railway (backend + cron) | ~R$ 50-75 (US$ 10-15) |
| Vercel free tier | R$ 0 |
| Supabase free tier (até 500MB DB, suficiente pra anos) | R$ 0 |
| Pluggy Development env | R$ 0 |
| Teller.io dev tier | R$ 0 |
| Schwab API | R$ 0 |
| Resend free (3k emails/mês) | R$ 0 |
| Telegram Bot | R$ 0 |
| Anthropic API (Sonnet 4.6 categorização + agente proativo, com prompt caching) | ~R$ 30-80 |
| **Total mensal estimado** | **~R$ 80-155** |

Cabe nos R$ 150 com folga. Estimativa Sonnet 4.6: ~1k txns/mês × ~$0.005 (com cache) = ~$5/mês categorização; cron diário do agente proativo ~$5-15/mês. Subir pra Opus 4.7 só em queries pontuais que justifiquem (planejamento, what-if complexo).

### 5.2 Decisão: web-first

Postgres é fonte de verdade desde o dia 1. Dashboard web já no MVP. **Excel/Google Sheets** entra apenas como **export sob demanda** (relatório mensal automático, planilha what-if pra brincar fora do app). Não há "Excel como source of truth" — evita retrabalho de migração.

---

## 6. Modelo de dados (esboço)

```sql
-- Contas (qualquer fonte: banco BR, US, cartão, investimento, cripto)
accounts(id, name, type, institution, currency, source, source_account_id,
         is_active, created_at)

-- Transações canônicas (após normalização das fontes)
transactions(id, account_id, date, posted_date, amount, currency,
             original_description, description,
             category_id, subcategory_id,
             counterparty, notes,
             -- parcelas (inspirado no Argus, resolve gap conhecido do Pluggy):
             installment_number, installment_total, installment_group_id,
             -- proveniência e estado:
             source_txn_id, raw_json,
             sync_log_id,            -- referência ao SyncLog que criou/atualizou
             status,                  -- 'pending_sync' | 'active' | 'rejected'
             deleted_at,              -- soft delete
             created_at, updated_at)

-- Sync logs (workflow de aprovação inspirado no Argus)
sync_logs(id, source, account_id,
          started_at, finished_at,
          status,         -- 'running' | 'pending_review' | 'approved' | 'rejected' | 'failed'
          summary_json,   -- contagens: criadas, atualizadas, divergências
          diff_json,      -- preview do que muda (pra UI de aprovação)
          approved_by, approved_at,
          error_message)

-- Saldos (snapshot diário pra séries temporais)
balances(account_id, date, balance, currency)

-- Categorias (editáveis pelo usuário)
categories(id, name, parent_id, kind, color, icon)
  -- kind ∈ {income, expense, transfer, investment}

-- Regras de categorização (declarativas, editáveis)
rules(id, priority, match_type, pattern, set_category_id, set_tags[])
  -- match_type ∈ {regex, contains, counterparty, mcc, llm_classifier}

-- Metas
goals(id, name, type, target_amount, target_date,
      currency, current_amount, on_track,
      strategy_json)
  -- type ∈ {emergency_fund, purchase, retirement, debt_payoff, custom}

-- Premissas / parâmetros de projeção (editáveis)
assumptions(id, key, value_json, valid_from, valid_to)
  -- ex: cdi_rate, usd_brl_forecast, salary_growth, inflation

-- Projeções (output do agente, regeneradas)
projections(id, scenario_name, generated_at, horizon_months,
            data_json, narrative)

-- Alertas (output proativo)
alerts(id, severity, kind, title, body_md,
       triggered_at, acknowledged_at, action_taken)

-- Tokens de integração (criptografados)
integration_credentials(id, provider, account_link, encrypted_token,
                        expires_at, last_refresh_at)

-- Tags livres (camada flexível acima das categorias)
transaction_tags(transaction_id, tag, source)
  -- source ∈ {user, agent, rule}

-- Banco de correções (few-shot pro LLM categorizador) — substitui embeddings
correction_examples(id, original_description, counterparty, amount, currency,
                    chosen_category_id, chosen_subcategory_id,
                    user_id, applied_at)
  -- LRU: mantém últimas N=50 correções pro prompt few-shot

-- Propostas do agente sobre evolução da taxonomia
category_proposals(id, kind, payload_json, rationale_md,
                   confidence, status, generated_at, decided_at, decided_by)
  -- kind ∈ {new_category, split, merge, rename, archive, new_subcategory}
  -- status ∈ {pending, accepted, rejected, dismissed, auto_applied}

-- Histórico de mudanças em categorias (preserva integridade de relatórios passados)
category_history(id, category_id, change_type, before_json, after_json,
                 applied_at, proposal_id)
```

**Notas de design:**
- `transactions.status = 'pending_sync'` enquanto SyncLog não foi aprovado → relatórios filtram por `status = 'active'`. Aprovação é uma operação atômica que move todas as txns do sync.
- Sem `pgvector` / embeddings: categorização é regras + LLM com few-shot do `correction_examples` (ver §6.2).
- `installment_group_id` agrupa as N parcelas da mesma compra (ex: "iPhone 12x" gera 12 transactions com mesmo `installment_group_id`); facilita cancelamentos e visualização agrupada.

### 6.1 Taxonomia inicial de categorias (seed)

Princípios: separa **investimentos** e **transferências internas** como `kind` próprio (não poluem "gasto"); cobre realidade cross-border BR+US (subcategoria "Aporte US", "Spread câmbio"); editável pelo usuário via dashboard.

| Pai | kind | Filhos |
|---|---|---|
| **Renda** | income | Salário, Pró-labore/PJ, Investimentos (juros/dividendos), Aluguel recebido, Reembolsos, Outros |
| **Moradia** | expense | Aluguel/financiamento, Condomínio, IPTU, Energia/Água/Gás, Internet, Manutenção/Reformas, Mobiliário |
| **Alimentação** | expense | Mercado, Restaurante, Delivery, Cafeteria/bebidas |
| **Transporte** | expense | Combustível, Estacionamento/pedágio, Uber/táxi, Transporte público, Manutenção do carro, IPVA/seguro |
| **Saúde** | expense | Plano de saúde, Consultas, Farmácia, Academia, Terapia |
| **Educação** | expense | Cursos, Livros, Assinaturas educacionais |
| **Lazer** | expense | Streaming/assinaturas, Viagens, Bares/eventos, Hobbies, Jogos |
| **Compras pessoais** | expense | Vestuário, Eletrônicos, Beleza, Presentes |
| **Pets** | expense | Ração/vet/pet shop |
| **Família/Filhos** | expense | (opcional, ativar se aplicável) |
| **Impostos** | expense | IRPF, Outros |
| **Tarifas financeiras** | expense | Tarifas bancárias, Juros pagos, Spread câmbio |
| **Investimentos** | investment | Aporte renda fixa BR, Aporte renda variável BR, Aporte cripto, Aporte US (brokerage), Resgate |
| **Transferências internas** | transfer | Entre contas próprias (BR↔US, etc.), Pagamento de cartão |
| **Não categorizado** | expense | (fallback) |

A migration inicial cria essas categorias; CRUD no dashboard permite renomear/criar/desativar.

### 6.2 Categorização e evolução da taxonomia (LLM direto, sem embeddings)

**Por que sem embeddings/clustering**: volume baixo (~1k txns/mês), texto pobre semanticamente (`"PIX TRANSF JOAO 12345"`, `"AMZN MKTP US*A12B3"`), Sonnet 4.6 com prompt caching custa ~$5/mês — overhead de pgvector + clustering + retraining não compensa. LLM direto é simples, auto-explicável e mais preciso pra esse contexto.

#### Pipeline de categorização (cada transação nova)

```
1. Regras determinísticas (regex/contains/counterparty)
   ↓ se nenhuma bate
2. Sonnet 4.6 com prompt cacheado:
   - Lista atual de categorias + subcategorias
   - Últimas 30-50 correções do usuário (correction_examples, LRU)
   - Texto da transação (description, counterparty, amount, account_type)
   ↓
3. Output: { category_id, subcategory_id, confidence, rationale }
   ↓ se confidence < 0.6
4. Fallback: "Não categorizado" + entra na fila de revisão
```

Prompt caching: lista de categorias + correction_examples ficam em **cache prefix** (TTL 5min, refresh on demand). Custo efetivo de input cai 90% — só o texto da txn nova consome tokens normais.

#### Aprende com correções

Toda vez que você recategoriza no dashboard:
1. **Cria `correction_example`** — entra na fila LRU pro próximo few-shot.
2. **Se for counterparty exato** (ex: "STARLINK BR"), cria/atualiza uma `rule` determinística → próximas transações nem chegam ao LLM.
3. **Se mais de 5 correções similares aconteceram** (mesmo destino, contrapartes parecidas), abre `category_proposal(kind=new_subcategory)` perguntando se é hora de criar uma subcategoria nova.

#### Evolução da taxonomia (cron semanal)

Agente proativo (Sonnet 4.6) roda 1×/semana com tools:
- `list_uncategorized_recent(days=90)` — lê transações em fallback
- `list_category_stats` — % do gasto por categoria, contagem, variância, recorrência
- `list_recent_corrections(limit=100)` — pra detectar padrões

E gera propostas via tool `create_category_proposal`:
- **Nova categoria/subcategoria**: lê N transações não-categorizadas, identifica grupos semânticos (LLM faz isso direto, sem clustering numérico) e propõe categoria nova com nome + lista de transações afetadas + regra sugerida.
- **Split**: categoria > 15% do gasto com bimodalidade clara em valores/recorrência → propõe split.
- **Archive/merge**: categoria com < 3 txns em 6 meses → propõe arquivar ou mergear.

Tudo entra em `category_proposals(status=pending)` → você aprova com 1 clique no dashboard ou via tool MCP `accept_proposal` chamada do Claude Desktop.

**Garantias:**
- `category_history` preserva estado anterior → relatórios históricos não quebram (queries usam `as-of date` resolution).
- Auto-aplicação só pra mudanças de baixíssimo risco (typo em rename, criação de subcategoria com confidence > 0.95 e ≥ 10 exemplos).
- Splits, merges e archive sempre exigem aprovação humana.

---

## 7. Roadmap por fases

Cada fase é entregável, gera valor sozinha, e a próxima depende da anterior só estruturalmente.

### Fase 0 — Fundação (3-5 dias)
- [ ] **Turborepo** com workspaces: `apps/web` (Next.js), `apps/api` (Next API routes), `apps/mcp` (MCP server), `apps/etl` (workers/cron), `packages/db` (schema Drizzle), `packages/shared` (types/utils)
- [ ] Postgres (Supabase) + migrations Drizzle
- [ ] Schema do §6 (incluindo `sync_logs`, installments, soft delete) + seed da taxonomia §6.1
- [ ] CLI: `import-csv <arquivo> --account <id>` que cria `SyncLog(pending_review)` (OFX/CSV)
- [ ] Auth single-user (password + JWT)
- [ ] Deploy Railway (api/etl/mcp) + Vercel (web), healthcheck e logs
- **Deliverable:** subir CSVs manuais → SyncLog pendente; aprovar/rejeitar via UI; ver transações ativas.

### Fase 1 — Ingestão BR via Pluggy + email (5-7 dias) ⭐
- [ ] Cadastro Dashboard Pluggy (dev env), criar `clientId`/`clientSecret`
- [ ] Pluggy Connect widget no app web — conectar Itaú PF, Nubank PF, Nubank PJ
- [ ] Worker de sync diário (Pluggy `/items/{id}/transactions`, `/accounts`) → cria `SyncLog(pending_review)` com diff
- [ ] Mapear `installment_*` quando Pluggy retornar parcelado
- [ ] Conector Gmail (OAuth) + filtros: `todomundo@nubank.com.br`, notificações Itaú, Nomad
- [ ] Pipeline: PDF/email → Sonnet 4.6 → transações estruturadas → SyncLog pendente
- [ ] Reconciliação: dedup por (account_id, source_txn_id) preferencial; fallback hash(descrição, valor, data)
- [ ] UI de aprovação de sync: lista de SyncLogs pendentes com diff (criadas/atualizadas/divergências)
- [ ] Re-consent OFB: alerta 30 dias antes do vencimento (12 meses)
- **Deliverable:** transações entram como pendentes; você aprova em lote pelo dashboard ou via tool MCP no Claude Desktop.

### Fase 2 — Dashboard MVP + categorização (5-7 dias)
- [ ] Telas Tremor: Net Worth, Cashflow mensal, Top categorias, Por conta, Lista de transações
- [ ] Filtros (período, conta, categoria, tags, status)
- [ ] CRUD de regras de categorização (regex/contains/counterparty)
- [ ] Pipeline de categorização (§6.2): **regras determinísticas → Sonnet 4.6 com prompt cache + few-shot** das `correction_examples`
- [ ] Aprendizado por correção: recategorização do usuário (a) cria `correction_example` (LRU N=50); (b) cria/atualiza `rule` se contraparte exato; (c) aplica retroativamente em similares (com confirmação se >10 txns)
- [ ] Tabelas `transaction_tags`, `correction_examples`, `category_history`
- [ ] Export XLSX/Google Sheets do mês corrente
- **Deliverable:** dashboard decente; sistema já aprende quando você corrige.

### Fase 3 — US (Teller + Schwab + cripto) (3-5 dias)
- [ ] Teller Connect OAuth → MITFCU + qualquer outro US
- [ ] (Opcional) Schwab Developer API se houver brokerage
- [ ] FX: cache de taxas BCB/AwesomeAPI em `fx_rates(date, pair)`; converter na query
- [ ] Cripto via CCXT (Binance/Coinbase read-only) se aplicável
- **Deliverable:** net worth consolidado BR+US+(cripto) em BRL e USD.

### Fase 4 — MCP server + agente externo (3-5 dias) ⭐
- [ ] `apps/mcp`: servidor MCP (TS) que wrapa a API
- [ ] Tools (lista no diagrama §5): query/list de transações, balances, accounts, categories; sync approval; bulk_categorize; goals; cashflow; proposals; alerts
- [ ] Auth da MCP server → API via service token
- [ ] Configuração de exemplo pra Claude Desktop (`claude_desktop_config.json`)
- [ ] README com prompts de exemplo ("aprove os syncs pendentes", "categoriza essas transações", "qual meu cashflow projetado")
- **Deliverable:** abre Claude Desktop, conversa com seu CFO. Sem chat UI custom.

### Fase 5 — Proatividade + evolução da taxonomia (6-8 dias)
- [ ] Telegram Bot setup + token no vault
- [ ] Agente proativo interno (Sonnet 4.6 + Claude Agent SDK) consumindo as MESMAS MCP tools
- [ ] Cron diário: detecta outliers, projeção de orçamento, fechamento de cartão sem saldo, OFB consent expirando → escreve em `alerts` + envia Telegram
- [ ] Cron semanal de evolução da taxonomia (§6.2): agente lê uncategorized + stats e propõe via `create_category_proposal`
- [ ] UI de aprovação 1-clique de proposals no dashboard (e via tool MCP `accept_proposal`)
- [ ] Relatório semanal Telegram + PDF mensal por email (Resend)
- **Deliverable:** segunda-feira: 1 mensagem no Telegram com semana financeira + fila de proposals no dashboard.

### Fase 6 — Planejamento avançado (contínuo)
- [ ] Engine de projeção determinística (cashflow + investment growth com CDI/SELIC/USD)
- [ ] Monte Carlo opcional pra cenários com volatilidade
- [ ] Editor de cenários no dashboard ("what-if")
- [ ] Tracking de metas com alertas de desvio
- [ ] Sugestões de realocação — aqui sim vale **Opus 4.7** pra raciocínio mais profundo (cron mensal, custo justifica)
- [ ] **Upgrade futuro**: WhatsApp Business Cloud API substituindo Telegram

---

## 7.1 Concorrência e gap

| Produto | Tem agente? | Gap que CFO-AI explora |
|---|---|---|
| **Copilot Money** (US) | Não — só categorização ML + insights estáticos | Planejamento autônomo, what-if conversacional |
| **Monarch** (US) | Não — dashboards colaborativos | Decisão e ação, restrições explícitas |
| **Origin** (US) | Wealth planning humano, não autônomo | Autonomia 24/7 + multi-país |
| **Empower** (ex-Personal Capital) | Não — view holístico free | Mesmo gap |
| **Mobills/Organizze** (BR) | OFB sim, IA real não | Agente proativo + cross-border |
| **Olivia AI** (BR) | Tinha proposta de IA — **fechou em 2022** | Mercado BR órfão de IA financeira |
| **Jota** (BR) | IA via WhatsApp + OFB | Mais focado em PF básica, sem cross-border |

**Gap claro:** (a) **cross-border BR+EUA** (ninguém faz bem), (b) **agente que decide e age** (não só mostra), (c) **planejamento com restrições explícitas** (metas, caps, tax-aware).

---

## 8. Riscos & decisões em aberto

1. **Limite de 100 items do Pluggy Dev env.** Folga gigantesca pra single-user (5-10 contas), mas se o produto crescer pra multi-user, precisa virar Production (R$ 2.5k/mês). Aceitável agora.
2. **Limitações conhecidas do Pluggy** (reportadas pela comunidade): parcelados às vezes inconsistentes, Pix no crédito pode não vir, transferências sem nome de beneficiário em alguns casos. **Mitigação:** email/PDF parsing como complemento + reconciliação por `source_txn_id` + flag de divergência no dashboard.
3. **Renovação de consent OFB a cada 12 meses** é a pior fricção do produto. UX precisa antecipar (alerta 30d antes, deep-link pro widget de re-consent).
4. **Categorização LLM pode alucinar.** Mitigação: ordem **regras determinísticas → Sonnet 4.6 com few-shot das correções recentes** + threshold de confidence (< 0.6 vai pra "Não categorizado"). Sem embeddings — texto bancário é pobre semanticamente, LLM direto é mais preciso e auto-explicável (você lê o `rationale`).
5. **FX histórico**: armazenar sempre em currency original; converter na query com taxa do dia da transação (cache em `fx_rates(date, pair, rate)`).
6. **MITFCU pode não estar no Teller**. Fallback: Plaid Limited Production (200 calls grátis/produto) → se passar disso, pay-as-you-go (~$1.50/user/mês). Cabe no orçamento.
7. **pynubank fica como opcional** — se o Pluggy Dev cobrir bem o Nubank na prática, dispensável. Decidir depois da Fase 1.
8. **Multi-tenant futuro?** Decisão adiada. Se sim, vai precisar Pluggy Production + RLS + billing — mudança grande.
9. **Retenção legal (BACEN)**: dados financeiros têm retenção mínima de 10 anos para instituições reguladas. Single-user importa pouco.

---

## 9. Decisões pendentes (a resolver durante implementação)

Nenhum bloqueador imediato. A próxima etapa é começar a Fase 0. Pequenas escolhas que podem aparecer:

1. **Backend framework**: Next.js API routes (tudo em um) vs Hono separado em `apps/api` — Next API é suficiente pro MVP; separar só se virar gargalo.
2. **Workers**: Trigger.dev / BullMQ no Redis / cron simples — começar com **cron simples no Railway** (1 job/dia pra Pluggy sync); upgrade pra Trigger.dev se tiver muitas tasks paralelas.
3. **Auth UI**: usar Clerk (free tier generoso, 5min de setup) ou rolar próprio? Como é single-user, **password + JWT próprio** é suficiente e zero custo.

---

## Inspirações de outros projetos

**[gbrancaglione/argus](https://github.com/gbrancaglione/argus)** (Rails + MCP server + Vite/React, foco em cartão de crédito) — adotamos:
- **Arquitetura MCP-first**: tools como contrato; agente fica fora da app
- **Sync approval workflow**: importações criam `SyncLog(pending_review)` com diff, aprovado em lote
- **Installment fields** em transactions (resolve gap conhecido do Pluggy em parcelados)
- **Soft delete** em transactions

Não adotamos: stack Rails (mantemos TS), labels-only sem hierarquia (mantemos categorias hierárquicas + tags), Vite minimal (Next+Tremor é melhor pra dashboards financeiros).

---

## Referências

- [Pluggy pricing](https://www.pluggy.ai/pricing)
- [Pluggy docs (dev env, 100 items limit)](https://docs.pluggy.ai/page/faq)
- [MeuPluggy (consumer)](https://meu.pluggy.ai/)
- [pluggyai/meu-pluggy GitHub](https://github.com/pluggyai/meu-pluggy)
- [Belvo pricing](https://belvo.com/plans-and-pricing/)
- [Plaid pricing](https://plaid.com/pricing/)
- [Teller.io](https://teller.io/)
- [Schwab Developer Portal](https://developer.schwab.com/)
- [Anthropic finance agent templates](https://github.com/anthropics/financial-services)
- [pynubank](https://github.com/andreroggeri/pynubank)
- [Open Finance Brasil](https://openfinancebrasil.org.br/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [gbrancaglione/argus](https://github.com/gbrancaglione/argus) — projeto de referência (sync approval, MCP-first)
