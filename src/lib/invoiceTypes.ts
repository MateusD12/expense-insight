export interface ParsedTransaction {
  data: string; // YYYY-MM-DD
  estabelecimento: string;
  estabelecimentoBase: string; // sem "XX/YY"
  classificacao: string;
  valor: number;
  parcela: number;
  totalParcela: number;
  cartao: string;
  fatura: string; // YYYY-MM-01
}

export interface ParsedInvoice {
  cartao: string;
  vencimento: string; // YYYY-MM-DD
  fatura: string; // YYYY-MM-01
  totalFatura: number;
  transacoes: ParsedTransaction[];
}

export const MESES_PT: Record<string, number> = {
  jan: 1,
  fev: 2,
  mar: 3,
  abr: 4,
  mai: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  set: 9,
  out: 10,
  nov: 11,
  dez: 12,
};

export function parseValorBR(s: string): number {
  const clean = s.replace(/\./g, "").replace(",", ".").trim();
  return parseFloat(clean);
}

export function inferClassificacaoFromName(name: string): string {
  const l = name.toLowerCase();
  if (/(super|mercado|pao|padaria|hortifruti|acougue|açougue)/.test(l)) return "Alimentação";
  if (/(restaur|burger|pizza|sushi|lanch|bar|cafe|café|ifood|rappi)/.test(l)) return "Alimentação";
  if (/(uber|99|cabify|posto|combust|gasolin|estacion)/.test(l)) return "Transporte";
  if (/(farma|drogaria|hospital|clinic|saude|saúde|odonto)/.test(l)) return "Saúde";
  if (/(escola|curso|udemy|alura|coursera|faculdade|livraria)/.test(l)) return "Estudos";
  if (/(netflix|spotify|prime|disney|hbo|youtube|apple\.com|google)/.test(l)) return "Assinaturas";
  if (/(cinema|park|game|steam|playstation|xbox|lazer)/.test(l)) return "Lazer";
  if (/(magalu|amazon|mercado livre|shopee|aliexpress|loja|store|shop)/.test(l)) return "Compras";
  if (/(constru|pisos|tinta|material|casa|decor|leroy)/.test(l)) return "Casa";
  return "Outros";
}
