const formatCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const BAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-pink-500",
  "bg-teal-500", "bg-amber-500", "bg-indigo-500", "bg-rose-500", "bg-cyan-500",
];

interface Props {
  data: { name: string; valor: number }[];
  title: string;
}

export function RankedList({ data, title }: Props) {
  const max = data.length > 0 ? data[0].valor : 1;

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4">{title}</h3>
      <div className="space-y-2.5">
        {data.map((item, i) => (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-4 text-right font-mono">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs font-medium text-foreground truncate mr-2">{item.name}</span>
                <span className="text-xs font-semibold text-foreground whitespace-nowrap">{formatCurrency(item.valor)}</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full ${BAR_COLORS[i % BAR_COLORS.length]} transition-all`}
                  style={{ width: `${(item.valor / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Sem dados</p>}
      </div>
    </div>
  );
}
