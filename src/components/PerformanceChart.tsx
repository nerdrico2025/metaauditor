import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: "Seg", impressoes: 12400, cliques: 890, conversoes: 48 },
  { name: "Ter", impressoes: 15200, cliques: 1120, conversoes: 62 },
  { name: "Qua", impressoes: 13800, cliques: 980, conversoes: 55 },
  { name: "Qui", impressoes: 18600, cliques: 1340, conversoes: 78 },
  { name: "Sex", impressoes: 21200, cliques: 1580, conversoes: 91 },
  { name: "Sáb", impressoes: 16800, cliques: 1200, conversoes: 67 },
  { name: "Dom", impressoes: 14200, cliques: 1050, conversoes: 58 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass rounded-lg p-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} className="text-xs" style={{ color: entry.color }}>
            {entry.name}: {entry.value.toLocaleString()}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

const PerformanceChart = () => {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Performance Semanal</h3>
          <p className="text-sm text-muted-foreground">Últimos 7 dias</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-1" />
            <span className="text-xs text-muted-foreground">Impressões</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-2" />
            <span className="text-xs text-muted-foreground">Cliques</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-chart-3" />
            <span className="text-xs text-muted-foreground">Conversões</span>
          </div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorImpressoes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(195, 100%, 50%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(195, 100%, 50%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(270, 80%, 60%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(270, 80%, 60%)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorConversoes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(150, 80%, 45%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(150, 80%, 45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
          <XAxis dataKey="name" stroke="hsl(215, 20%, 55%)" fontSize={12} />
          <YAxis stroke="hsl(215, 20%, 55%)" fontSize={12} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="impressoes" name="Impressões" stroke="hsl(195, 100%, 50%)" fillOpacity={1} fill="url(#colorImpressoes)" strokeWidth={2} />
          <Area type="monotone" dataKey="cliques" name="Cliques" stroke="hsl(270, 80%, 60%)" fillOpacity={1} fill="url(#colorCliques)" strokeWidth={2} />
          <Area type="monotone" dataKey="conversoes" name="Conversões" stroke="hsl(150, 80%, 45%)" fillOpacity={1} fill="url(#colorConversoes)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
