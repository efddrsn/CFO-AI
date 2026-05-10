# CFO-AI — Especificação v0.2

> Documento vivo. Objetivo: alinhar visão, arquitetura e roadmap antes de escrever código.
> Status: **escolhas confirmadas — pronto pra começar Fase 0**.

**Decisões fechadas (v0.2):**
- Stack: TypeScript end-to-end (Next.js + Node)
- Hosting: Railway (backend/cron) + Vercel (frontend)
- UI: web-first (dashboard direto, sem Excel-first)
- Notificações: Telegram (free, instant) → WhatsApp como upgrade futuro
- Orçamento: até **R$ 150/mês** em serviços externos
- Bancos do usuário: **Itaú PF, Nubank PF, Nubank PJ, Nomad, MITFCU**
- Estratégia BR: **Pluggy Development environment (free, 100 items)** como fonte primária, complementada por email/PDF parsing
- Estratégia US: **Teller.io free tier** (100 enrollments) → Plaid Limited Production como fallback

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

```
┌─────────────────────────────────────────────────────────┐
│ Frontend (Next.js + Tremor)                             │
│  • Dashboard (net worth, cashflow, metas)               │
│  • Chat com agente                                      │
│  • Editor de regras/categorias/metas                    │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│ API (FastAPI ou Next.js API routes)                     │
│  • Endpoints REST + SSE pra streaming do agente         │
│  • Auth (single-user, password + JWT)                   │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Agente CFO   │  │ ETL workers  │  │ Postgres     │
│ (Anthropic   │  │ (cron)       │  │ (Supabase)   │
│  SDK, Opus   │  │              │  │              │
│  4.7 +       │  │ Conectores:  │  │ Tabelas:     │
│  Haiku 4.5)  │  │ • Teller     │  │ • accounts   │
│              │  │ • Pluggy     │  │ • txns       │
│ Tools:       │  │ • Schwab     │  │ • balances   │
│ • SQL query  │  │ • Gmail+PDF  │  │ • categories │
│ • Projeções  │  │ • CSV import │  │ • goals      │
│ • Alertas    │  │ • Crypto     │  │ • rules      │
│ • Sheets     │  │              │  │ • projections│
└──────────────┘  └──────────────┘  └──────────────┘
                          │
                          ▼
                  ┌──────────────┐
                  │ Vault        │
                  │ (tokens OFB, │
                  │  Plaid, etc) │
                  └──────────────┘
```

### Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Linguagem | **TypeScript end-to-end** (Node + Next.js) | Stack unificada, ExcelJS/SheetJS nativos, Vercel AI SDK pra streaming, deploy mais simples. Subpacote Python só se precisar (ex.: `pynubank`, OCR mais pesado). |
| Frontend | **Next.js 16 + shadcn/ui + Tremor** | Tremor cobre todos os charts financeiros. TanStack Table pra grid de transações editável. Vercel AI SDK pra chat com streaming. |
| Banco | **Postgres** (Supabase ou Neon) | Free tier generoso, RLS se virar multi-user. **DuckDB** opcional pra análises ad-hoc / projeções (lê Parquet, ótimo pra what-if rápido sem mexer no Postgres). |
| Agente | **Claude Agent SDK** (Opus 4.7 + Haiku 4.5) | É um loop com tools, não um grafo multi-agent → Agent SDK > LangGraph aqui. Opus pra planejamento; Haiku pra categorização em massa. Prompt caching pra contexto fixo (regras, metas, schema). Anthropic [finance agent templates](https://github.com/anthropics/financial-services) como referência. |
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
| Anthropic API (Haiku categorização + Opus chat ocasional, com prompt caching) | ~R$ 30-60 |
| **Total mensal estimado** | **~R$ 80-135** |

Folga real: ~R$ 15-70/mês pra absorver picos de uso do agente ou eventual upgrade.

### 5.2 Decisão: web-first

Postgres é fonte de verdade desde o dia 1. Dashboard web já no MVP. **Excel/Google Sheets** entra apenas como **export sob demanda** (relatório mensal automático, planilha what-if pra brincar fora do app). Não há "Excel como source of truth" — evita retrabalho de migração.

---

## 6. Modelo de dados (esboço)

```sql
-- Contas (qualquer fonte: banco BR, US, cartão, investimento, cripto)
accounts(id, name, type, institution, currency, source, source_account_id,
         is_active, created_at)

-- Transações canônicas (após normalização das fontes)
transactions(id, account_id, date, amount, currency,
             original_description, description,
             category_id, subcategory_id,
             counterparty, tags[], notes,
             source_txn_id, raw_json,  -- auditoria/reprocessamento
             created_at, updated_at)

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
```

---

## 7. Roadmap por fases

Cada fase é entregável, gera valor sozinha, e a próxima depende da anterior só estruturalmente.

### Fase 0 — Fundação (3-5 dias)
- [ ] Monorepo (`apps/web`, `services/api`, `services/etl`, `packages/shared`)
- [ ] Postgres (Supabase) + migrations Drizzle
- [ ] Schema do §6 implementado
- [ ] CLI: `import-csv <arquivo> --account <id>` (OFX/CSV)
- [ ] Auth single-user (password + JWT)
- [ ] Deploy Railway + Vercel funcionando, healthcheck e logs
- **Deliverable:** subir CSVs manuais e ver transações em uma tabela web simples.

### Fase 1 — Ingestão BR via Pluggy + email (5-7 dias) ⭐
- [ ] Cadastro Dashboard Pluggy (dev env), criar `clientId`/`clientSecret`
- [ ] Pluggy Connect widget no app web — conectar Itaú PF, Nubank PF, Nubank PJ
- [ ] Worker de sync diário (Pluggy `/items/{id}/transactions`, `/accounts`)
- [ ] Conector Gmail (OAuth) + filtros por remetente: `todomundo@nubank.com.br`, notificações Itaú, Nomad
- [ ] Pipeline: PDF/email → Claude (Haiku 4.5) → transações estruturadas → DB
- [ ] Reconciliação: dedup por (account_id, source_txn_id) preferencial; fallback hash(descrição, valor, data)
- [ ] Re-consent OFB: alerta 30 dias antes do vencimento (12 meses)
- **Deliverable:** transações de Itaú + Nubank PF/PJ + Nomad entram automaticamente.

### Fase 2 — Dashboard MVP (4-6 dias)
- [ ] Telas Tremor: Net Worth, Cashflow mensal, Top categorias, Por conta, Lista de transações
- [ ] Filtros (período, conta, categoria, tags)
- [ ] CRUD de regras de categorização (regex/contains/counterparty)
- [ ] Categorização automática: regras → LLM (Haiku) com cache, treinado nas correções do usuário
- [ ] Export XLSX/Google Sheets do mês corrente (relatório)
- **Deliverable:** dashboard decente — abrir e entender finanças em 10s.

### Fase 3 — US (Teller + Schwab + cripto) (3-5 dias)
- [ ] Teller Connect OAuth → MITFCU + qualquer outro US se aparecer
- [ ] (Opcional) Schwab Developer API se houver brokerage relevante
- [ ] FX: cache de taxas BCB/AwesomeAPI em `fx_rates(date, pair)`; converter na query
- [ ] Cripto via CCXT (Binance/Coinbase read-only) se aplicável
- **Deliverable:** net worth consolidado BR+US+(cripto) em BRL e USD.

### Fase 4 — Agente conversacional (5-7 dias)
- [ ] API de chat com streaming (Vercel AI SDK / SSE)
- [ ] Tools do agente: `query_sql` (read-only sandbox), `get_balances`, `get_transactions`, `recategorize`, `project_cashflow`
- [ ] Prompt caching pra contexto fixo (schema, regras, metas, premissas)
- [ ] Tela de chat com markdown + gráficos inline (Tremor)
- **Deliverable:** "quanto gastei com X mês passado?", "projeta saldo se eu economizar R$ 2k/mês".

### Fase 5 — Proatividade (5-7 dias)
- [ ] Telegram Bot setup + token no vault
- [ ] Cron diário de análise (agente roda sem prompt, escreve em `alerts`)
- [ ] Tools de alerta: outliers, projeção de orçamento, oportunidade de alocação, fechamento de cartão sem saldo, OFB consent expirando
- [ ] Relatório semanal automático no Telegram + PDF mensal por email (Resend)
- **Deliverable:** acordo segunda-feira com 1 mensagem "sua semana financeira".

### Fase 6 — Planejamento avançado (contínuo)
- [ ] Engine de projeção determinística (cashflow + investment growth com CDI/SELIC/USD)
- [ ] Monte Carlo opcional pra cenários com volatilidade
- [ ] Editor de cenários no dashboard ("what-if")
- [ ] Tracking de metas com alertas de desvio
- [ ] Sugestões de realocação (regras + LLM)
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
4. **Categorização LLM pode alucinar.** Mitigação: ordem **regras determinísticas → embeddings (similaridade com txns já categorizadas) → LLM (último caso)**; LLM treina nas correções do usuário.
5. **FX histórico**: armazenar sempre em currency original; converter na query com taxa do dia da transação (cache em `fx_rates(date, pair, rate)`).
6. **MITFCU pode não estar no Teller**. Fallback: Plaid Limited Production (200 calls grátis/produto) → se passar disso, pay-as-you-go (~$1.50/user/mês). Cabe no orçamento.
7. **pynubank fica como opcional** — se o Pluggy Dev cobrir bem o Nubank na prática, dispensável. Decidir depois da Fase 1.
8. **Multi-tenant futuro?** Decisão adiada. Se sim, vai precisar Pluggy Production + RLS + billing — mudança grande.
9. **Retenção legal (BACEN)**: dados financeiros têm retenção mínima de 10 anos para instituições reguladas. Single-user importa pouco.

---

## 9. Decisões em aberto (a definir antes/durante Fase 0)

1. **Estrutura de monorepo**: pnpm workspaces ou Turborepo?
2. **ORM**: Drizzle (mais leve, type-safe SQL) ou Prisma (mais maduro)? Default: Drizzle.
3. **Categorias iniciais**: levantar lista inicial baseada nos seus extratos passados (Claude pode propor + você refinar).
4. **Dimensão das metas no MVP**: quais 2-3 metas você quer trackar de saída? (ex.: reserva de emergência, compra X, freedom number).
5. **Refresh do Pluggy**: diário (default) ou mais frequente em horário comercial? Custo é só de chamadas API, mas pode haver rate limit.

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
