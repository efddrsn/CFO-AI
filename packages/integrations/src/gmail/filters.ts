/**
 * Filtros conhecidos de email pra ingestão.
 * Cada filtro vira uma query Gmail + hint pro parser LLM de qual instituição/conta
 * o email representa.
 */

export type EmailKind = "transaction_notification" | "statement_pdf" | "receipt";

export interface EmailFilter {
  /** Identificador único (estável) usado em logs e dedup. */
  key: string;
  /** Query Gmail (https://support.google.com/mail/answer/7190). */
  query: string;
  /** Pra orientar o parser LLM. */
  institution: string;
  kind: EmailKind;
  /** Nome amigável da conta CFO-AI esperada (resolução via banco). */
  defaultAccountHint?: string;
  /** Dicas pro parser: ex. "Pix recebido", "fatura mensal". */
  hint?: string;
}

/**
 * Filtros padrão pros bancos do MVP (Itaú, Nubank PF/PJ, Nomad).
 * Ajuste `after:` na chamada pra pegar só mensagens recentes.
 */
export const DEFAULT_FILTERS: EmailFilter[] = [
  {
    key: "nubank_pix_received",
    query: 'from:todomundo@nubank.com.br ("recebeu" OR "Pix recebido")',
    institution: "Nubank",
    kind: "transaction_notification",
    hint: "Pix recebido — texto curto com remetente e valor",
  },
  {
    key: "nubank_invoice_pdf",
    query: 'from:todomundo@nubank.com.br subject:(fatura) has:attachment filename:pdf',
    institution: "Nubank",
    kind: "statement_pdf",
    hint: "Fatura mensal do cartão Nubank em PDF",
  },
  {
    key: "itau_transaction_notification",
    query: 'from:(itau-unibanco.com.br OR itau.com.br) subject:(transação OR Pix OR débito OR crédito OR compra)',
    institution: "Itaú",
    kind: "transaction_notification",
    hint: "Notificação Itaú de transação individual",
  },
  {
    key: "nomad_statement",
    query: 'from:(nomadglobal.com OR benomad.com) subject:(extrato OR statement)',
    institution: "Nomad",
    kind: "statement_pdf",
    hint: "Statement mensal Nomad",
  },
];

export function buildQuery(filter: EmailFilter, afterDate?: Date): string {
  if (!afterDate) return filter.query;
  const yyyy = afterDate.getFullYear();
  const mm = String(afterDate.getMonth() + 1).padStart(2, "0");
  const dd = String(afterDate.getDate()).padStart(2, "0");
  return `${filter.query} after:${yyyy}/${mm}/${dd}`;
}
