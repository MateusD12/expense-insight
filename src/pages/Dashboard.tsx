import { useState, useMemo } from "react";
import { useExpenses, type Expense } from "@/hooks/useExpenses";
import { DashboardFilters, type Filters } from "@/components/DashboardFilters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = [
  "hsl(220, 70%, 50%)", "hsl(340, 70%, 50%)", "hsl(160, 70%, 40%)",
  "hsl(30, 80%, 50%)", "hsl(270, 60%, 50%)", "hsl(190, 70%, 45%)",
  "hsl(0, 70%, 50%)", "hsl(50, 80%, 45%)", "hsl(120, 50%, 40%)", "hsl(300, 50%, 50%)",
];

const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export default function Dashboard() {
  const { data: allExpenses = [], isLoading } = useExpenses();
  const [filters, setFilters] = useState<Filters>({ fatura: "all", banco: "all", cartao: "all", classificacao: "all" });

  const filtered = useMemo(() => {
    return allExpenses.filter((e) => {
      if (filters.fatura !== "all" && e.fatura !== filters.fatura) return false;
      if (filters.banco !== "all" && e.banco !== filters.banco) return false;
      if (filters.cartao !== "all" && e.cartao !== filters.cartao) return false;
      if (filters.classificacao !== "all" && e.classificacao !== filters.classificacao) return false;
      return true;
    });
  }, [allExpenses, filters]);

  const total = filtered.reduce((s, e) => s + Number(e.valor), 0);

  const lineData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      if (e.fatura) {
        map[e.fatura] = (map[e.fatura] || 0) + Number(e.valor);
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([fatura, valor]) => ({
        name: format(new Date(fatura + "T12:00:00"), "MMM/yy", { locale: ptBR }),
        valor: Math.round(valor * 100) / 100,
      }));
  }, [filtered]);

  const pieData = useMemo(() => {
    const map: Record<string, { valor: number; cartoes: Set<string> }> = {};
    filtered.forEach((e) => {
      if (!map[e.banco]) map[e.banco] = { valor: 0, cartoes: new Set() };
      map[e.banco].valor += Number(e.valor);
      map[e.banco].cartoes.add(e.cartao);
    });
    const entries = Object.entries(map).map(([banco, { valor, cartoes }]) => ({
      name: banco,
      sub: [...cartoes].join(", "),
      valor: Math.round(valor * 100) / 100,
    }));
    const t = entries.reduce((s, e) => s + e.valor, 0);
    return entries.map((e) => ({ ...e, pct: t > 0 ? Math.round((e.valor / t) * 1000) / 10 : 0 }));
  }, [filtered]);

  const topClassificacao = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      if (e.classificacao) map[e.classificacao] = (map[e.classificacao] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, valor]) => ({ name, valor: Math.round(valor * 100) / 100 }));
  }, [filtered]);

  const topJustificativa = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((e) => {
      if (e.justificativa) map[e.justificativa] = (map[e.justificativa] || 0) + Number(e.valor);
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([name, valor]) => ({ name, valor: Math.round(valor * 100) / 100 }));
  }, [filtered]);

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Carregando...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">{filtered.length} gastos · Total: {formatCurrency(total)}</p>
      </div>

      <DashboardFilters expenses={allExpenses} filters={filters} onChange={setFilters} />

      <div className="grid gap-6 md:grid-cols-2">
        {/* Line Chart */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Evolução por Fatura</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={(v) => `R$${v}`} className="text-xs" />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line type="monotone" dataKey="valor" stroke="hsl(220, 70%, 50%)" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Pie Chart */}
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Banco</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="valor"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, pct, sub }) => `${name} (${sub}) ${pct}%`}
                  labelLine
                >
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Classificação */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top 10 por Classificação</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topClassificacao} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={75} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" fill="hsl(160, 70%, 40%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top 10 Justificativa */}
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">Top 10 por Justificativa</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={topJustificativa} layout="vertical" margin={{ left: 120 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tickFormatter={(v) => `R$${v}`} className="text-xs" />
                <YAxis type="category" dataKey="name" className="text-xs" width={115} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="valor" fill="hsl(30, 80%, 50%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
