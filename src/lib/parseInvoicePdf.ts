import { parseItauPdf } from "./parseItauPdf";
import { parseNubankPdf, extractPdfLines } from "./parseNubankPdf";
import type { ParsedInvoice } from "./invoiceTypes";

export type BankName = "Itaú" | "Nubank";

export interface DetectedInvoice {
  banco: BankName;
  invoice: ParsedInvoice;
}

export async function parseInvoicePdf(file: File): Promise<DetectedInvoice> {
  // Lê linhas para detectar banco
  const lines = await extractPdfLines(file);
  const text = lines.join("\n").toLowerCase();

  if (text.includes("nubank") || text.includes("nu pagamentos") || text.includes("nu financeira")) {
    const invoice = await parseNubankPdf(file);
    return { banco: "Nubank", invoice };
  }
  if (text.includes("itaú") || text.includes("itau ") || text.includes("banco itau") || text.includes("itaucard")) {
    const invoice = await parseItauPdf(file);
    return { banco: "Itaú", invoice };
  }

  // Fallback: tenta Itaú (formato original)
  const invoice = await parseItauPdf(file);
  return { banco: "Itaú", invoice };
}

export type { ParsedInvoice } from "./invoiceTypes";
