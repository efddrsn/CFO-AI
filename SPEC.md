# CFO-AI — Especificação v0.1

> Documento vivo. Objetivo: alinhar visão, arquitetura e roadmap antes de escrever código.
> Status: **rascunho para discussão**.

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
- **Privacidade total**: dados não saem da sua infra (self-hosted ou cloud sob seu controle). Tokens/credenciais em vault.
- **Custo**: idealmente < R$ 200/mês em serviços externos no MVP. (Pluggy enterprise a R$ 2.500/mês não cabe — ver §5.)
- **Latência aceitável**: dados podem ter até 24h de defasagem. Não é trading.
- **LGPD**: como single-user, baixa exposição. Mesmo assim, criptografia at-rest e em trânsito.
- **Editabilidade**: o usuário precisa conseguir mexer em categorização, regras, metas, premissas de projeção sem mexer em código.

---

## 4. Fontes de dados — mapa da realidade

### 🇧🇷 Brasil

| Fonte | Como acessar | Custo | Trabalho do usuário |
|---|---|---|---|
| **Open Finance BR via Pluggy** | API revendedora (Pluggy é ITP regulado). OFB regulado **+ "conexão direta"** (scraping autorizado) em ~80 instituições — cobre falhas comuns do OFB puro. | Trial 14d / 20 conexões grátis. Plano básico **R$ 2.500/mês** (caro pra PF). | Widget de consentimento (~1min, renova a cada 12 meses — UX crítica) |
| **Open Finance BR via Belvo** | Similar à Pluggy, foco LATAM. Sandbox grátis (25 links). | "Launch" a partir de **US$ 1.000/mês com contrato de 12 meses**. Pior barreira que Pluggy. | Idem |
| **Open Finance BR direto (DIY)** | Exige virar instituição regulada pelo BCB ou ter parceria com uma. **Inviável pra projeto pessoal.** | — | — |
| **Nubank (pynubank, não-oficial)** | Lib Python que se autentica no app; expõe extrato e fatura. | Grátis (open source). | Login + 2FA inicial; pode quebrar se Nubank mudar API. |
| **Faturas por email (Nubank, Itaú, Inter, etc.)** | Gmail API → baixa PDF → Claude/Textract extrai transações. | Custo de tokens LLM (~centavos por fatura). | Configurar Gmail OAuth uma vez. |
| **CSV/OFX manual** | Download mensal pelo internet banking, drag-and-drop na ferramenta. | Grátis. | ~5 min/mês por banco. |
| **Pix recebimentos/envios** | Coberto via OFB (extrato) ou parsing de email/SMS. | — | — |

**Decisão recomendada:** começar com **Gmail/PDF parsing + CSV import** (zero custo, muito automático pra contas que mandam fatura por email). Adicionar Pluggy/Belvo trial (14d) pra validar OFB. Se ROI compensar e quiser pagar, sobe pro plano básico — senão, cai pra estratégia híbrida (OFB onde for grátis/barato + email parsing).

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
- XP, BTG, Rico: via Open Finance (Pluggy/Belvo) — fase 2 do OFB cobre.
- Tesouro Direto: scraping do portal ou OFB.

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
| Hosting | **Railway** ou **Fly.io** (backend/cron) + **Vercel** (frontend) | $5-20/mês. Alternativa cheap: VPS Hetzner ($5/mês) com Docker, controle total. |
| Vault | **Supabase Vault** (libsodium) ou **Doppler** | Tokens OFB, Plaid items, exchange API keys. Rotação 90d. |
| Notificações | **Telegram Bot** (free, instantâneo) ou **Resend** (email) | Pra alertas proativos. |
| Observabilidade | **Sentry + Axiom/Logfire** | — |

### Excel-first: opção MVP válida

Existem dois caminhos defensáveis. **Você decide qual.**

**A) Web-first (minha recomendação default)**
- Postgres é fonte de verdade desde o dia 1. UI web simples já no MVP.
- Excel/Sheets é **export** sob demanda (relatório mensal, planilha what-if).
- Vantagem: não precisa migrar dados depois. Pivot pra dashboard sofisticado é trivial.
- Custo: ~5 dias a mais de trabalho no MVP que Excel-first.

**B) Excel-first (validação rápida)**
- Agente gera XLSX semanal com abas (Resumo, Cashflow, Cenários, Alertas) usando ExcelJS.
- Postgres ainda existe (storage normalizado), mas não tem UI web — só o XLSX e um chat CLI/Telegram.
- Vantagem: 80% do valor com 20% do esforço de UI. Boa pra validar quais views você realmente usa antes de codificar.
- Risco: tentação de "ficar no Excel" e nunca migrar. Mitigar: marcar prazo (ex.: 4 semanas no Excel, depois obrigatório migrar).

**Recomendo B se prioridade é velocidade de validação. A se prioridade é não retrabalhar.** Ver §9 pra escolher.

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
- [ ] Repo monorepo (`apps/web`, `services/api`, `services/etl`, `packages/shared`)
- [ ] Postgres + migrations (Drizzle ou Alembic)
- [ ] Schema do §6 implementado
- [ ] CLI: `import-csv <arquivo> --account <id>` (qualquer extrato OFX/CSV)
- [ ] Auth single-user básica
- [ ] Deploy Railway + Vercel funcionando
- **Deliverable:** consigo subir CSVs manuais e ver lista de transações na web.

### Fase 1 — Ingestão "barata" (3-5 dias)
- [ ] Conector Gmail (OAuth) + filtro por remetente
- [ ] Pipeline: PDF → Claude (Haiku 4.5) → transações estruturadas → DB
- [ ] Conector pynubank (Nubank conta + cartão)
- [ ] Reconciliação básica (dedup por hash de descrição+valor+data)
- **Deliverable:** transações de Nubank + qualquer banco que mande fatura por email entram sozinhas.

### Fase 2 — Dashboard MVP (3-5 dias)
- [ ] Telas: Net Worth, Cashflow mensal, Top categorias, Por conta
- [ ] Filtros (período, conta, categoria)
- [ ] Tela de regras de categorização (CRUD)
- [ ] Categorização automática via LLM com cache (Haiku 4.5)
- [ ] Export XLSX/Sheets do mês corrente
- **Deliverable:** observabilidade visual decente.

### Fase 3 — Agente conversacional (5-7 dias)
- [ ] API de chat com streaming (SSE)
- [ ] Tools: `query_sql`, `get_balances`, `get_transactions`, `categorize`
- [ ] Prompt caching pra schema + regras + metas (contexto fixo)
- [ ] Tela de chat com markdown + gráficos inline
- **Deliverable:** "quanto gastei com X mês passado?" funciona; "projeta meu saldo se eu economizar R$ 2k/mês".

### Fase 4 — US (Teller + Schwab) (3-5 dias)
- [ ] Teller.io OAuth + sync de contas/transações
- [ ] Schwab API direto (brokerage holdings + P&L)
- [ ] Conversão FX automática (USD/BRL com taxa do dia, cacheada)
- [ ] Cripto: Binance + Coinbase read-only
- **Deliverable:** net worth consolidado BR+US+cripto em BRL e USD.

### Fase 5 — Open Finance BR (3-5 dias)
- [ ] Trial Pluggy ou Belvo, validar com 3-5 instituições
- [ ] Decisão: pagar Pluggy/Belvo OU consolidar com OFB-via-email + pynubank
- [ ] Refresh diário automatizado
- **Deliverable:** dados BR atualizando sozinhos.

### Fase 6 — Proatividade (5-7 dias)
- [ ] Cron de análise diária (agente roda sem prompt, gera alerts)
- [ ] Tools de alerta: detecção de outliers, projeção de orçamento, oportunidade de alocação
- [ ] Notificações: email + Telegram/Slack
- [ ] Relatório mensal automático (email com narrativa + PDF)
- **Deliverable:** acordo na 2ª-feira com 1 email "aqui está sua semana financeira".

### Fase 7 — Planejamento avançado (contínuo)
- [ ] Engine de projeção determinística (Monte Carlo opcional)
- [ ] Editor de cenários ("what-if")
- [ ] Tracking de metas com alertas de desvio
- [ ] Sugestões de realocação (regras + LLM)

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

1. **Pluggy/Belvo são caros pra single-user.** R$ 2.500/mês (Pluggy) ou US$ 1.000/mês + 12m (Belvo) matam o ROI. Caminhos:
   - Tentar negociar plano "indie/founder" com Pluggy
   - Trial 14d pra validar valor, depois cair em estratégia híbrida (email parsing + pynubank + CSV)
   - Aguardar OFB BR abrir tier consumer (sem ETA)
2. **pynubank é não-oficial — pode quebrar a qualquer momento.** Fallback obrigatório: CSV manual + parsing de email.
3. **Renovação de consent OFB a cada 12 meses** é o pior fricção do produto. UX precisa antecipar (notificar 30 dias antes, deep-link pro re-consent).
4. **Categorização LLM pode alucinar.** Mitigação: ordem **regras determinísticas → ML por embeddings → LLM (último caso)**; LLM treina nas correções do usuário (feedback loop).
5. **FX histórico**: armazenar sempre em currency original + converter na query com taxa do dia da transação (cache de taxas BCB/AwesomeAPI em tabela `fx_rates(date, pair, rate)`).
6. **Fidelity sem API**: se você tiver conta lá, planejar import manual + scraping autorizado de PDFs.
7. **Multi-tenant futuro?** Se sim, RLS no Supabase + billing desde já. Se não, simplifica muito.
8. **Retenção legal (BACEN)**: dados financeiros têm retenção mínima de 10 anos. Single-user importa pouco; multi-tenant precisa pensar.

---

## 9. Próximos passos pra debater

1. **Stack**: Python + Next.js, ou tudo TypeScript? (impacta velocidade)
2. **Hosting**: Railway/Vercel (fácil) vs self-host num VPS (mais privacidade)?
3. **Excel-first ou web-first?** Recomendo web-first com export Sheets — mas é defensável o contrário.
4. **Quais bancos/contas você tem hoje?** (Nubank, Itaú, Schwab, etc.) — define ordem das integrações.
5. **Prioridade entre fases**: a sequência acima é minha proposta. Quer mexer? Por exemplo, pular pra agente conversacional antes do dashboard?
6. **Orçamento mensal aceitável** pra serviços (Plaid, Pluggy, hosting, LLM tokens)?
7. **Notificação proativa**: email, Telegram, Slack, push? (todas, alguma específica?)

---

## Referências

- [Pluggy pricing](https://www.pluggy.ai/pricing)
- [Belvo pricing](https://belvo.com/plans-and-pricing/)
- [Plaid pricing](https://plaid.com/pricing/)
- [Teller.io](https://teller.io/)
- [Schwab Developer Portal](https://developer.schwab.com/)
- [Anthropic finance agent templates](https://github.com/anthropics/financial-services)
- [pynubank](https://github.com/andreroggeri/pynubank)
- [Open Finance Brasil](https://openfinancebrasil.org.br/)
