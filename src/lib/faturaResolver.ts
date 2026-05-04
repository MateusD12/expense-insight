import { addMonths, format, parseISO, differenceInCalendarMonths } from "date-fns";

export interface InvoiceCutoff {
  id: string;
  banco: string;
  cartao: string;
  fatura: string; // YYYY-MM-DD (day=01)
  data_corte: string; // YYYY-MM-DD
  data_vencimento: string; // YYYY-MM-DD
}

const faturaPlusMonths = (faturaISO: string, months: number) => {
  const d = parseISO(faturaISO.length === 7 ? `${faturaISO}-01` : faturaISO);
  const next = addMonths(d, months);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
};

/**
 * Resolves which fatura (YYYY-MM-DD, day=01) a purchase belongs to,
 * based on configured cutoffs for the given card.
 *
 * Regra: compras com data <= data_corte entram naquela fatura.
 * Compras posteriores ao último corte conhecido avançam para faturas
 * subsequentes (1 mês por intervalo de mês entre o corte e a compra).
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

  // Primeira fatura cujo corte ainda "abraça" a compra
  const match = cardCutoffs.find((c) => dataCompra <= c.data_corte);
  if (match) return match.fatura;

  // Compra é depois do último corte conhecido — avançar a partir da última fatura
  const last = cardCutoffs[cardCutoffs.length - 1];
  if (last) {
    const monthsAhead = Math.max(
      1,
      differenceInCalendarMonths(parseISO(dataCompra), parseISO(last.data_corte)) + 1,
    );
    return faturaPlusMonths(last.fatura, monthsAhead);
  }

  // Sem cortes cadastrados: fallback "mês da compra + 1"
  const d = parseISO(dataCompra);
  const next = addMonths(d, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Fatura "foco" do dashboard = a menor fatura ainda em aberto considerando
 * o vencimento (não o corte). Enquanto qualquer cartão tiver fatura de mai/26
 * com vencimento futuro, mai/26 continua sendo a fatura foco.
 */
export function getFaturaAtual(cutoffs: InvoiceCutoff[]): string {
  const today = format(new Date(), "yyyy-MM-dd");
  const open = cutoffs
    .filter((c) => c.data_vencimento >= today)
    .sort((a, b) => a.fatura.localeCompare(b.fatura));
  if (open.length > 0) return open[0].fatura;

  const now = new Date();
  const next = addMonths(now, 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Effective fatura para uma despesa.
 *
 * Regras:
 * - Sem fatura salva: resolvemos pelos cortes.
 * - Parcela > 1: respeitamos a fatura salva (sequência da compra parcelada).
 * - Caso contrário: se a fatura salva for incompatível com o corte vigente
 *   (ex.: compra depois do corte daquela fatura), recalculamos para refletir
 *   a regra dos cortes. Caso a fatura salva ainda seja válida, mantemos.
 */
export function effectiveFatura(
  expense: {
    banco: string;
    cartao: string;
    data: string | null;
    fatura: string | null;
    fatura_original: string | null;
    parcela?: number;
    total_parcela: number;
    [key: string]: any;
  },
  cutoffs: InvoiceCutoff[],
): string | null {
  if (!expense.data) return expense.fatura ?? null;

  // Parcelas > 1 mantêm a sequência salva
  if ((expense.total_parcela || 1) > 1) return expense.fatura ?? null;

  const resolved = resolveFatura(expense.banco, expense.cartao, expense.data, cutoffs);
  if (!expense.fatura) return resolved;

  // Existe corte para essa fatura salva? Se a compra é depois do corte dela,
  // a fatura salva está errada — usar a resolvida.
  const savedKey = expense.fatura.slice(0, 7);
  const cutoffForSaved = cutoffs.find(
    (c) =>
      c.banco === expense.banco &&
      c.cartao === expense.cartao &&
      c.fatura.slice(0, 7) === savedKey,
  );
  if (cutoffForSaved && expense.data > cutoffForSaved.data_corte) {
    return resolved;
  }
  return expense.fatura;
}
