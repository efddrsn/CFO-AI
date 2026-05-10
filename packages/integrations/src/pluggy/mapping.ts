import { toCents } from "@cfo-ai/shared";
import type { PluggyAccount, PluggyTransaction } from "./types";

/**
 * Mapeia tipo/subtipo Pluggy para o tipo canônico do CFO-AI.
 * Schema CFO-AI: checking | savings | credit_card | investment | brokerage | crypto_exchange | crypto_wallet | other
 */
export function mapAccountType(account: PluggyAccount): string {
  if (account.type === "CREDIT") return "credit_card";
  if (account.type === "INVESTMENT") return "investment";
  if (account.type === "LOAN") return "other";
  // BANK
  if (account.subtype === "SAVINGS_ACCOUNT") return "savings";
  return "checking";
}

export interface CfoTxnInput {
  accountId: string; // uuid da conta CFO-AI
  date: string; // yyyy-mm-dd
  amountCents: number; // negativo = saída
  currency: string;
  originalDescription: string;
  description?: string | null;
  counterparty?: string | null;
  sourceTxnId: string;
  installmentNumber?: number | null;
  installmentTotal?: number | null;
  installmentGroupId?: string | null;
  rawJson: unknown;
}

/**
 * Pluggy → CfoTxnInput.
 *
 * Convenção de sinal: Pluggy retorna `amount` sempre positivo + `type`
 * (CREDIT/DEBIT). No CFO-AI guardamos negativos pra débitos e positivos
 * pra créditos, independente do tipo da conta.
 */
export function pluggyTxnToCfo(
  cfoAccountId: string,
  txn: PluggyTransaction,
): CfoTxnInput {
  const signed = txn.type === "DEBIT" ? -txn.amount : txn.amount;
  const ic = txn.creditCardMetadata;
  const counterparty =
    txn.merchant?.name ??
    txn.merchant?.businessName ??
    txn.paymentData?.receiver?.name ??
    txn.paymentData?.payer?.name ??
    null;

  return {
    accountId: cfoAccountId,
    date: txn.date.slice(0, 10),
    amountCents: toCents(signed),
    currency: txn.currencyCode,
    originalDescription: txn.descriptionRaw ?? txn.description,
    description: txn.description,
    counterparty,
    sourceTxnId: txn.id,
    installmentNumber: ic?.installmentNumber ?? null,
    installmentTotal: ic?.totalInstallments ?? null,
    // installmentGroupId: agrupamos por (sourceCardId + base description) — Pluggy não fornece;
    // deixamos null aqui e o reconciler do ETL pode preencher se quiser.
    installmentGroupId: null,
    rawJson: txn,
  };
}
