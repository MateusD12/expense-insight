import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import {
  ParsedInvoice,
  ParsedTransaction,
  MESES_PT,
  parseValorBR,
  inferClassificacaoFromName,
} from "./invoiceTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractPdfLines(file: File): Promise<string[]> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const allLines: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as any[];
    const lines: Record<number, { x: number; str: string }[]> = {};
    for (const it of items) {
      const y = Math.round(it.transform[5]);
      const x = it.transform[4];
      if (!lines[y]) lines[y] = [];
      lines[y].push({ x, str: it.str });
    }
    const sortedY = Object.keys(lines).map(Number).sort((a, b) => b - a);
    for (const y of sortedY) {
      const lineText = lines[y].sort((a, b) => a.x - b.x).map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (lineText) allLines.push(lineText);
    }
  }
  return allLines;
}

export async function parseNubankPdf(file: File): Promise<ParsedInvoice> {
  const lines = await extractPdfLines(file);
  const fullText = lines.join("\n");

  // Vencimento: "Data de vencimento: 02 ABR 2026" ou "VENCIMENTO 02 ABR 2026"
  const vencMatch = fullText.match(/(?:vencimento[:\s]+)(\d{1,2})\s+([A-Za-zçÇ]{3,})\s+(\d{4})/i);
  if (!vencMatch) throw new Error("Não foi possível identificar o vencimento da fatura Nubank.");
  const venDia = parseInt(vencMatch[1], 10);
  const venMesAbbr = vencMatch[2].slice(0, 3).toLowerCase();
  const venMes = MESES_PT[venMesAbbr];
  const venAno = parseInt(vencMatch[3], 10);
  if (!venMes) throw new Error(`Mês inválido no vencimento: ${vencMatch[2]}`);

  const vencimento = `${venAno}-${String(venMes).padStart(2, "0")}-${String(venDia).padStart(2, "0")}`;
  const fatura = `${venAno}-${String(venMes).padStart(2, "0")}-01`;

  // Total da fatura
  const totalMatch = fullText.match(/(?:total\s+(?:da\s+)?fatura|valor\s+total)[^\d-]*R?\$?\s*([\d.,]+)/i);
  const totalFatura = totalMatch ? parseValorBR(totalMatch[1]) : 0;

  // Cartão (default — pode ter vários, pegamos o primeiro encontrado)
  const cardMatch = fullText.match(/[•\u2022\*]{2,}\s*(\d{4})/) || fullText.match(/final\s+(\d{4})/i);
  const cartaoDefault = cardMatch ? cardMatch[1] : "0000";

  const transacoes: ParsedTransaction[] = [];
  let inTransactions = false;
  let inPayments = false;

  // Regex de transação Nubank:
  // "23 FEV •••• 4008 Eben Pisos e Construc - Parcela 7/12 R$ 304,06"
  // ou sem cartão: "23 FEV Descrição R$ 304,06"
  const txRegex = /^(\d{1,2})\s+([A-Za-zçÇ]{3,})\s+(?:[•\u2022\*]{2,}\s*(\d{4})\s+)?(.+?)\s+R?\$?\s*(-?[\d.,]+)$/;

  for (const linha of lines) {
    const lower = linha.toLowerCase();

    if (/transa[cç][õo]es\s+de/.test(lower) || /^transa[cç][õo]es$/.test(lower)) {
      inTransactions = true;
      inPayments = false;
      continue;
    }
    if (/^pagamentos/.test(lower) || /\bpagamento efetuado\b/.test(lower)) {
      inPayments = true;
      continue;
    }
    if (/total\s+da\s+fatura|resumo|encargos|limite/.test(lower)) {
      inTransactions = false;
      continue;
    }
    if (!inTransactions || inPayments) continue;

    const m = linha.match(txRegex);
    if (!m) continue;

    const [, diaS, mesAbbr, cardDigits, descRaw, valorStr] = m;
    const mesKey = mesAbbr.slice(0, 3).toLowerCase();
    const mes = MESES_PT[mesKey];
    if (!mes) continue;

    const valor = parseValorBR(valorStr);
    if (isNaN(valor) || valor <= 0) continue; // ignora pagamentos negativos

    const dia = parseInt(diaS, 10);
    let ano = venAno;
    if (mes > venMes) ano = venAno - 1;
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

    // Detecta parcela: "- Parcela X/Y" ou "Parcela X/Y"
    let estabelecimento = descRaw.trim();
    let estabelecimentoBase = estabelecimento;
    let parcela = 1;
    let totalParcela = 1;
    const pMatch = estabelecimento.match(/^(.*?)\s*[-–]?\s*Parcela\s+(\d{1,2})\/(\d{1,2})\s*$/i);
    if (pMatch) {
      estabelecimentoBase = pMatch[1].trim().replace(/[-–]\s*$/, "").trim();
      parcela = parseInt(pMatch[2], 10);
      totalParcela = parseInt(pMatch[3], 10);
      estabelecimento = `${estabelecimentoBase} ${parcela}/${totalParcela}`;
    }

    const classificacao = inferClassificacaoFromName(estabelecimentoBase);
    const cartao = cardDigits || cartaoDefault;

    transacoes.push({
      data,
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

  return {
    cartao: cartaoDefault,
    vencimento,
    fatura,
    totalFatura,
    transacoes,
  };
}
