import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'

interface EcosystemChartProps {
  data: Record<string, number>
}

export function EcosystemChart({ data }: EcosystemChartProps) {
  const chartData = Object.entries(data).map(([name, value]) => ({
    name,
    value,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="hsl(var(--border))"
          vertical={false}
        />
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{
            fill: 'hsl(var(--muted-foreground))',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          allowDecimals={false}
          tick={{
            fill: 'hsl(var(--muted-foreground))',
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
        />
        <Tooltip
          cursor={{ fill: 'hsl(var(--accent))' }}
          contentStyle={{
            backgroundColor: 'hsl(var(--popover))',
            border: '1px solid hsl(var(--border))',
            borderRadius: 8,
            fontSize: 12,
            fontFamily: 'JetBrains Mono, monospace',
          }}
          labelStyle={{ color: 'hsl(var(--foreground))' }}
          itemStyle={{ color: 'hsl(var(--primary))' }}
        />
        <Bar
          dataKey="value"
          fill="hsl(var(--primary))"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
