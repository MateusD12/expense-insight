import { addMonths, format } from "date-fns";

export interface InvoiceCutoff {
  id: string;
  banco: string;
  cartao: string;
  fatura: string; // YYYY-MM-DD
  data_corte: string; // YYYY-MM-DD
  data_vencimento: string; // YYYY-MM-DD
}

/**
 * Resolves which fatura (YYYY-MM-DD, day=01) a purchase belongs to,
 * based on configured cutoffs for the given card.
 *
 * Rule: the first cutoff whose data_corte >= dataCompra wins.
 * Fallback (no matching cutoff): purchase month + 1, day 01.
 */
export function resolveFatura(
  banco: string,
  cartao: string,
  dataCompra: string,
  cutoffs: InvoiceCutoff[],
): string {
  const cardCutoffs = cutoffs
    .filter((c) => c.banco === banco && c.cartao === cartao)
    .sort((a, b) => a.data_corte.localeCompare(b.data_corte));

  const match = cardCutoffs.find((c) => c.data_corte >= dataCompra);
  if (match) return match.fatura;

  // Fallback: previous behaviour
  const d = new Date(dataCompra + "T12:00:00");
  const next = addMonths(d, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Returns the "fatura atual" — the first open invoice (cutoff in the future)
 * across all configured cards. Falls back to next month if none configured.
 */
export function getFaturaAtual(cutoffs: InvoiceCutoff[]): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const open = cutoffs
    .filter((c) => c.data_corte >= today)
    .sort((a, b) => a.data_corte.localeCompare(b.data_corte));
  if (open.length > 0) return open[0].fatura;

  const now = new Date();
  const next = addMonths(now, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Effective fatura for an expense.
 *
 * Regra: a fatura salva no banco é a verdade. O usuário pode ter escolhido
 * manualmente (ex.: comprou em 25/04 mas decidiu jogar para junho), e essa
 * escolha precisa ser preservada — mesmo que a data de corte resolva outro mês.
 *
 * Só resolvemos via cutoffs quando NÃO há fatura salva (legado/import sem mês).
 */
export function effectiveFatura(
  expense: {
    banco: string;
    cartao: string;
    data: string | null;
    fatura: string | null;
    fatura_original: string | null;
    total_parcela: number;
    [key: string]: any;
  },
  cutoffs: InvoiceCutoff[],
): string | null {
  if (expense.fatura) return expense.fatura;
  if (!expense.data) return null;
  return resolveFatura(expense.banco, expense.cartao, expense.data, cutoffs);
}
