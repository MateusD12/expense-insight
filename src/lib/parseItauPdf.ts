import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - vite handles ?url
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export type { ParsedTransaction, ParsedInvoice } from "./invoiceTypes";
import type { ParsedInvoice, ParsedTransaction } from "./invoiceTypes";

const CLASSIF_KEYWORDS = new Set([
  "supermercado", "restaurante", "lazer", "saude", "saúde",
  "educação", "educacao", "outros", "serviços", "servicos",
  "transporte", "vestuário", "vestuario", "farmácia", "farmacia",
  "combustível", "combustivel", "supermarket",
]);

const SECTION_OPENERS = [
  "lançamentos", "lancamentos",
  "compras parceladas", "compras nacionais", "compras internacionais",
  "lançamentos no cartão", "lancamentos no cartao",
];

const SECTION_CLOSERS = [
  "total dos lançamentos", "total dos lancamentos",
  "próximas faturas", "proximas faturas",
  "limites de crédito", "limites de credito",
  "encargos cobrados", "demonstrativo de encargos",
  "informações gerais",
];

const SKIP_LINE_KEYWORDS = [
  "pagamento efetuado", "pagto efetuado", "estorno", "saldo anterior",
  "saldo da fatura anterior", "juros", "iof", "anuidade diferenciada",
  "encargos", "multa",
];

function parseValor(s: string): number {
  // Remove espaços internos (PDF pode separar dígitos), pontos de milhar, vira "," em "."
  const clean = s.replace(/\s+/g, "").replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(clean);
}

function parseDataDDMM(dia: string, mes: string, refYear: number, refMonth: number): string {
  const d = parseInt(dia, 10);
  const m = parseInt(mes, 10);
  let y = refYear;
  if (m > refMonth) y = refYear - 1;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function inferClassificacao(line: string): string {
  const lower = line.toLowerCase();
  for (const kw of CLASSIF_KEYWORDS) {
    if (lower.includes(kw)) {
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

function lineLooksLikeSkip(lower: string): boolean {
  return SKIP_LINE_KEYWORDS.some((k) => lower.includes(k));
}

function buildTransactionFromLine(
  linha: string,
  refYear: number,
  refMonth: number,
  cartao: string,
  fatura: string,
): ParsedTransaction | null {
  // DD/MM <descrição> <valor BR>
  const m = linha.match(/^(\d{2})\/(\d{2})\s+(.+?)\s+(-?[\d.\s]+,\d{2})\s*$/);
  if (!m) return null;
  const [, dia, mes, descRaw, valorStr] = m;
  const valor = parseValor(valorStr);
  if (isNaN(valor) || valor <= 0) return null;

  const desc = descRaw.replace(/\s+/g, " ").trim();
  const classificacao = inferClassificacao(desc);

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
    const parts = desc.split(" ");
    const idxClass = parts.findIndex((p) => CLASSIF_KEYWORDS.has(p.toLowerCase()));
    if (idxClass > 0) {
      estabelecimentoBase = parts.slice(0, idxClass).join(" ").trim();
      estabelecimento = estabelecimentoBase;
    }
  }

  return {
    data: parseDataDDMM(dia, mes, refYear, refMonth),
    estabelecimento,
    estabelecimentoBase,
    classificacao,
    valor,
    parcela,
    totalParcela,
    cartao,
    fatura,
  };
}

export async function parseItauPdf(file: File): Promise<ParsedInvoice> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  // Reconstrói texto agrupando por Y com tolerância e ordenando por X
  let fullText = "";
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const items = (content.items as any[]).filter((it) => typeof it.str === "string");

    // Agrupa items em "linhas" usando tolerância de Y (~2px)
    type Item = { x: number; y: number; str: string };
    const arr: Item[] = items.map((it) => ({
      x: it.transform[4],
      y: it.transform[5],
      str: it.str,
    }));

    // Ordena top->bottom (Y desc), então agrupa por proximidade
    arr.sort((a, b) => b.y - a.y);
    const groups: Item[][] = [];
    const TOL = 2;
    for (const it of arr) {
      const g = groups[groups.length - 1];
      if (g && Math.abs(g[0].y - it.y) <= TOL) {
        g.push(it);
      } else {
        groups.push([it]);
      }
    }

    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const lineText = g.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (lineText) fullText += lineText + "\n";
    }
    fullText += "\n";
  }

  console.log(`[parseItauPdf] páginas=${pdf.numPages}, linhas=${fullText.split("\n").length}`);

  // Cartão
  const cartaoMatch = fullText.match(/(\d{4})\.X{4}\.X{4}\.(\d{4})/i)
    || fullText.match(/final\s+(\d{4})/i)
    || fullText.match(/Cart[aã]o[^\d]*\d{4}\.?X{0,4}\.?X{0,4}\.?(\d{4})/i);
  const cartao = cartaoMatch ? cartaoMatch[cartaoMatch.length - 1] : "0000";

  // Vencimento
  const vencMatch = fullText.match(/Vencimento[:\s]+(\d{2})\/(\d{2})\/(\d{4})/i);
  if (!vencMatch) throw new Error("Não foi possível identificar a data de vencimento da fatura.");
  const [, venDia, venMes, venAno] = vencMatch;
  const vencimento = `${venAno}-${venMes}-${venDia}`;
  const fatura = `${venAno}-${venMes}-01`;
  const refYear = parseInt(venAno, 10);
  const refMonth = parseInt(venMes, 10);

  // Total da fatura — busca priorizada (rótulo mais específico primeiro)
  const totalRegexesPriorizados = [
    /O\s+total\s+da\s+sua\s+fatura\s+é[^\d]*R\$?\s*([\d][\d.\s]*,\d{2})/i,
    /Total\s+desta\s+fatura[^\d-]*R?\$?\s*([\d][\d.\s]*,\d{2})/i,
    /Com\s+vencimento\s+em[\s\S]{0,80}?R\$\s*([\d][\d.\s]*,\d{2})/i,
    /Total\s+a\s+pagar[^\d-]*R?\$?\s*([\d][\d.\s]*,\d{2})/i,
    /Valor\s+total\s+da\s+fatura[^\d-]*R?\$?\s*([\d][\d.\s]*,\d{2})/i,
  ];
  let totalFatura = 0;
  for (const re of totalRegexesPriorizados) {
    const mm = fullText.match(re);
    if (mm) {
      const v = parseValor(mm[1]);
      if (!isNaN(v) && v > 0) {
        totalFatura = v;
        console.log(`[parseItauPdf] total detectado via ${re} → ${v}`);
        break;
      }
    }
  }

  // Helper de dedup com chave normalizada (alfanum + lowercase)
  const dedupTransacoes = (txs: ParsedTransaction[]): ParsedTransaction[] => {
    const seen = new Set<string>();
    const out: ParsedTransaction[] = [];
    for (const t of txs) {
      const estabNorm = t.estabelecimento.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const key = `${t.data}|${estabNorm}|${t.valor.toFixed(2)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(t);
    }
    return out;
  };

  // Parse de transações: seção reativa (reabre a cada "Lançamentos")
  const linhas = fullText.split("\n");
  const transacoesSecao: ParsedTransaction[] = [];
  let inSection = false;
  let sectionsOpened = 0;

  for (const linha of linhas) {
    const lower = linha.toLowerCase();

    if (SECTION_OPENERS.some((k) => lower.includes(k))) {
      inSection = true;
      sectionsOpened++;
      continue;
    }
    if (SECTION_CLOSERS.some((k) => lower.includes(k))) {
      inSection = false;
      continue;
    }
    if (!inSection) continue;
    if (lineLooksLikeSkip(lower)) continue;

    const tx = buildTransactionFromLine(linha, refYear, refMonth, cartao, fatura);
    if (tx) transacoesSecao.push(tx);
  }

  const transacoesSecaoDedup = dedupTransacoes(transacoesSecao);
  console.log(`[parseItauPdf] seções abertas=${sectionsOpened}, transações (seção)=${transacoesSecao.length}, dedup=${transacoesSecaoDedup.length}`);

  // Modo seção é o padrão. Fallback só se modo seção retornou ZERO.
  if (transacoesSecaoDedup.length > 0) {
    const soma = transacoesSecaoDedup.reduce((s, t) => s + t.valor, 0);
    console.log(`[parseItauPdf] usando modo seção, soma=${soma.toFixed(2)}, totalFatura=${totalFatura}`);
    return { cartao, vencimento, fatura, totalFatura, transacoes: transacoesSecaoDedup };
  }

  console.log(`[parseItauPdf] modo seção vazio — ativando fallback permissivo`);
  const permissivas: ParsedTransaction[] = [];
  for (const linha of linhas) {
    const lower = linha.toLowerCase();
    if (lineLooksLikeSkip(lower)) continue;
    if (/vencimento|data\s+estabelecimento|valor\s+em\s+r\$/.test(lower)) continue;
    const tx = buildTransactionFromLine(linha, refYear, refMonth, cartao, fatura);
    if (tx) permissivas.push(tx);
  }
  const dedup = dedupTransacoes(permissivas);
  console.log(`[parseItauPdf] fallback transações=${dedup.length}, soma=${dedup.reduce((s, t) => s + t.valor, 0).toFixed(2)}`);
  return { cartao, vencimento, fatura, totalFatura, transacoes: dedup };
}
