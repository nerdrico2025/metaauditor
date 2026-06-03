import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTheme } from "@/components/theme-provider";

export interface PerformanceChartProps {
  chartView: 'metrics' | 'costs';
  data?: Array<{
    date: string;
    impressions: number;
    clicks: number;
    conversions: number;
    cpm: number;
    cpc: number;
    spend: number;
  }>;
}

const CustomTooltip = ({ active, payload, label, chartView }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-popover/90 backdrop-blur-md rounded-xl p-4 border border-border shadow-2xl">
        <p className="text-sm font-bold text-foreground mb-3">{label}</p>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <p className="text-xs font-medium text-muted-foreground">
                <span className="font-bold text-foreground mr-1">{entry.name}:</span>
                {chartView === 'costs' ? `R$ ${(entry.value || 0).toFixed(2)}` : (entry.value || 0).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

const PerformanceChart = ({ chartView, data }: PerformanceChartProps) => {
  const { theme } = useTheme();
  const isMetrics = chartView === 'metrics';

  // Format data for display
  const formattedData = (data || []).map(item => ({
    ...item,
    name: new Date(item.date).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
  }));

  if (!data || data.length === 0) {
    return <div className="flex h-full items-center justify-center text-muted-foreground">Sem dados para o período</div>;
  }

  return (
    <div className="h-full w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formattedData}>
          <defs>
            {isMetrics ? (
              <>
                <linearGradient id="colorImpressoes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorConversas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
              </>
            ) : (
              <>
                <linearGradient id="colorCPM" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCPC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                </linearGradient>
              </>
            )}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="name"
            stroke="var(--muted-foreground)"
            fontSize={11}
            fontWeight="bold"
            tick={{ fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            dy={10}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={11}
            fontWeight="bold"
            tick={{ fill: 'var(--muted-foreground)' }}
            axisLine={false}
            tickLine={false}
            dx={-10}
            tickFormatter={(value) => chartView === 'costs' ? `R$${value}` : `${value >= 1000 ? (value / 1000).toFixed(1) + 'k' : value}`}
          />
          <Tooltip content={<CustomTooltip chartView={chartView} />} cursor={{ stroke: 'var(--border)', strokeWidth: 2 }} />
          {isMetrics ? (
            <>
              <Area
                type="monotone"
                dataKey="impressions"
                name="Impressões"
                stroke="#00d4ff"
                fillOpacity={1}
                fill="url(#colorImpressoes)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="clicks"
                name="Cliques"
                stroke="#a78bfa"
                fillOpacity={1}
                fill="url(#colorCliques)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="conversions"
                name="Conversas"
                stroke="#fbbf24"
                fillOpacity={1}
                fill="url(#colorConversas)"
                strokeWidth={3}
              />
            </>
          ) : (
            <>
              <Area
                type="monotone"
                dataKey="cpm"
                name="CPM"
                stroke="#00d4ff"
                fillOpacity={1}
                fill="url(#colorCPM)"
                strokeWidth={3}
              />
              <Area
                type="monotone"
                dataKey="cpc"
                name="CPC"
                stroke="#a78bfa"
                fillOpacity={1}
                fill="url(#colorCPC)"
                strokeWidth={3}
              />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
