import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite handles ?url
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type { ParsedTransaction, ParsedInvoice } from "./invoiceTypes";
import type { ParsedInvoice, ParsedTransaction } from "./invoiceTypes";

const MESES: Record<string, number> = {
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
  jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const CLASSIF_KEYWORDS = new Set([
  "supermercado", "restaurante", "lazer", "saude", "saúde", "sauúde",
  "educação", "educacao", "outros", "serviços", "servicos",
  "transporte", "vestuário", "vestuario", "farmácia", "farmacia",
  "combustível", "combustivel", "supermarket",
]);

function parseValor(s: string): number {
  // "1.234,56" -> 1234.56
  const clean = s.replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(clean);
}

function parseDataDDMM(dia: string, mes: string, refYear: number, refMonth: number): string {
  // Ajuste de ano: se mês da transação > mês do vencimento, é do ano anterior
  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  let y = refYear;
  if (m > refMonth) y = refYear - 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function detectParcela(estabelecimento: string): { base: string; parcela: number; total: number } {
  // padrão "XX/YY" no final
  const m = estabelecimento.match(/^(.*?)\s+(\d{1,2})\/(\d{1,2})\s*$/);
  if (m) {
    return {
      base: m[1].trim(),
      parcela: parseInt(m[2], 10),
      total: parseInt(m[3], 10),
    };
  }
  return { base: estabelecimento.trim(), parcela: 1, total: 1 };
}

function inferClassificacao(line: string): string {
  const lower = line.toLowerCase();
  for (const kw of CLASSIF_KEYWORDS) {
    if (lower.includes(kw)) {
      // Normalizar
      if (kw.startsWith("super") || kw === "supermarket") return "Alimentação";
      if (kw === "restaurante") return "Alimentação";
      if (kw === "lazer") return "Lazer";
      if (kw.startsWith("sa")) return "Saúde";
      if (kw.startsWith("educ")) return "Estudos";
      if (kw.startsWith("serv")) return "Outros";
      if (kw.startsWith("transp")) return "Transporte";
      if (kw.startsWith("vest")) return "Compras";
      if (kw.startsWith("farm")) return "Saúde";
      if (kw.startsWith("comb")) return "Carro";
      return "Outros";
    }
  }
  return "Outros";
}

export async function parseItauPdf(file: File): Promise<ParsedInvoice> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Concatena texto de todas as páginas em ordem, com quebras de linha
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    // Agrupa por Y para reconstruir linhas
    const items = content.items as any[];
    const lines: Record<number, string[]> = {};
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      if (!lines[y]) lines[y] = [];
      lines[y].push(it.str);
    }
    const sortedY = Object.keys(lines)
      .map(Number)
      .sort((a, b) => b - a); // top to bottom
    for (const y of sortedY) {
      const lineText = lines[y].join(" ").replace(/\s+/g, " ").trim();
      if (lineText) fullText += lineText + "\n";
    }
  }

  // Cartão: "4705.XXXX.XXXX.2596"
  const cartaoMatch = fullText.match(/(\d{4})\.X{4}\.X{4}\.(\d{4})/i)
    || fullText.match(/Cart[aã]o[^\d]*\d{4}\.?X{0,4}\.?X{0,4}\.?(\d{4})/i);
  const cartao = cartaoMatch ? cartaoMatch[cartaoMatch.length - 1] : "0000";

  // Vencimento: "Vencimento: 06/04/2026" ou "Vencimento 06/04/2026"
  const vencMatch = fullText.match(/Vencimento[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!vencMatch) throw new Error("Não foi possível identificar a data de vencimento da fatura.");
  const venDia = vencMatch[1];
  const venMes = vencMatch[2];
  const venAno = vencMatch[3];
  const vencimento = `${venAno}-${venMes}-${venDia}`;
  const fatura = `${venAno}-${venMes}-01`;
  const refYear = parseInt(venAno, 10);
  const refMonth = parseInt(venMes, 10);

  // Total da fatura
  const totalMatch = fullText.match(/Total\s+desta\s+fatura[^\d-]*([\d.,]+)/i)
    || fullText.match(/total\s+da\s+sua\s+fatura\s+é[^\d]*R\$\s*([\d.,]+)/i);
  const totalFatura = totalMatch ? parseValor(totalMatch[1]) : 0;

  // Transações: cada linha começa com DD/MM seguido de descrição e termina com valor
  // Padrão: "23/02 GUEDES BARSAO PAULOBR restaurante SAO PAULO 43,00"
  const linhas = fullText.split("\n");
  const transacoes: ParsedTransaction[] = [];

  // Marcadores de seção: só processa após "Lançamentos" e antes de "Total" / "próximas faturas"
  let inLancamentos = false;
  for (const linha of linhas) {
    const lower = linha.toLowerCase();
    if (lower.includes("lançamentos") || lower.includes("lancamentos")) {
      inLancamentos = true;
      continue;
    }
    if (!inLancamentos) continue;
    if (
      lower.includes("total dos lançamentos") ||
      lower.includes("total dos lancamentos") ||
      lower.includes("próximas faturas") ||
      lower.includes("proximas faturas") ||
      lower.includes("limites de crédito") ||
      lower.includes("encargos cobrados")
    ) {
      inLancamentos = false;
      continue;
    }

    // Regex: DD/MM <descrição> <valor>  (valor pode ter sinal)
    const m = linha.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.]+,\d{2})\s*$/);
    if (!m) continue;

    const [, dia, mes, descRaw, valorStr] = m;
    const valor = parseValor(valorStr);
    if (isNaN(valor) || valor <= 0) continue; // ignora pagamentos negativos

    const desc = descRaw.replace(/\s+/g, " ").trim();
    const classificacao = inferClassificacao(desc);

    // Remove a parte de classificação/cidade do nome para detectar parcela
    // Ex: "A PETITOSA RAC 01/04 lazer SAO PAULO" -> primeiro pega "A PETITOSA RAC 01/04"
    // Estratégia: procura "XX/YY" em qualquer lugar
    const parcMatch = desc.match(/(.*?)\s+(\d{1,2})\/(\d{1,2})(\s+|$)/);
    let estabelecimento = desc;
    let estabelecimentoBase = desc;
    let parcela = 1;
    let totalParcela = 1;
    if (parcMatch) {
      estabelecimentoBase = parcMatch[1].trim();
      parcela = parseInt(parcMatch[2], 10);
      totalParcela = parseInt(parcMatch[3], 10);
      estabelecimento = `${estabelecimentoBase} ${parcela}/${totalParcela}`;
    } else {
      // Pega só a primeira "palavra-bloco" antes da classificação
      const parts = desc.split(" ");
      const idxClass = parts.findIndex((p) => CLASSIF_KEYWORDS.has(p.toLowerCase()));
      if (idxClass > 0) {
        estabelecimentoBase = parts.slice(0, idxClass).join(" ").trim();
        estabelecimento = estabelecimentoBase;
      }
    }

    transacoes.push({
      data: parseDataDDMM(dia, mes, refYear, refMonth),
      estabelecimento,
      estabelecimentoBase,
      classificacao,
      valor,
      parcela,
      totalParcela,
      cartao,
      fatura,
    });
  }

  return { cartao, vencimento, fatura, totalFatura, transacoes };
}
