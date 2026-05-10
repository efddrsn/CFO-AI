/**
 * Valores monetários são armazenados em cents (integer) para evitar erros de float.
 * Helpers para converter entre representações.
 */

export const toCents = (amount: number): number => Math.round(amount * 100);

export const fromCents = (cents: number): number => cents / 100;

export const formatBRL = (cents: number): string =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    fromCents(cents),
  );

export const formatUSD = (cents: number): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    fromCents(cents),
  );
