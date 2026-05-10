import Papa from "papaparse";
import { z } from "zod";

/**
 * CSV mínimo aceito (header obrigatório):
 *   date,description,amount[,currency][,counterparty][,source_txn_id]
 *
 * - date: ISO yyyy-mm-dd OU dd/mm/yyyy
 * - amount: número (pode usar vírgula ou ponto). Negativo = débito, positivo = crédito.
 * - currency: opcional, default = currency da conta
 */
export type ParsedRow = {
  date: string; // yyyy-mm-dd
  description: string;
  amountCents: number;
  currency?: string;
  counterparty?: string;
  sourceTxnId?: string;
};

const RawRow = z.object({
  date: z.string().min(1),
  description: z.string().min(1),
  amount: z.string().min(1),
  currency: z.string().optional(),
  counterparty: z.string().optional(),
  source_txn_id: z.string().optional(),
});

function normalizeDate(input: string): string {
  const s = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  throw new Error(`Data inválida: "${input}" (use yyyy-mm-dd ou dd/mm/yyyy)`);
}

function parseAmount(input: string): number {
  const s = input.trim().replace(/\s/g, "");
  // BR style: "1.234,56" → "1234.56"
  const normalized = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".")
    ? s.replace(/\./g, "").replace(",", ".")
    : s.replace(/,/g, "");
  const n = Number(normalized);
  if (!Number.isFinite(n)) throw new Error(`Valor inválido: "${input}"`);
  return Math.round(n * 100);
}

export function parseCsv(content: string): ParsedRow[] {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (result.errors.length > 0) {
    throw new Error(
      `Erros parsing CSV: ${result.errors.map((e) => e.message).join("; ")}`,
    );
  }

  return result.data.map((row, i) => {
    const parsed = RawRow.safeParse(row);
    if (!parsed.success) {
      throw new Error(
        `Linha ${i + 2}: ${parsed.error.errors.map((e) => e.message).join(", ")}`,
      );
    }
    return {
      date: normalizeDate(parsed.data.date),
      description: parsed.data.description.trim(),
      amountCents: parseAmount(parsed.data.amount),
      currency: parsed.data.currency?.toUpperCase().trim() || undefined,
      counterparty: parsed.data.counterparty?.trim() || undefined,
      sourceTxnId: parsed.data.source_txn_id?.trim() || undefined,
    };
  });
}
