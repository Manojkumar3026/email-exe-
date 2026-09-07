interface BarDatum {
  label: string;
  value: number;
}

interface SenderBarChartProps {
  data: BarDatum[];
  formatValue: (value: number) => string;
}

export default function SenderBarChart({ data, formatValue }: SenderBarChartProps) {
  if (data.length === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>;
  }

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <ul className="space-y-2">
      {data.map((d) => (
        <li key={d.label} className="flex items-center gap-2 text-sm">
          <span className="w-32 shrink-0 truncate text-slate-600 dark:text-slate-300">{d.label}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: 'var(--chart-sequential)' }}
            />
          </div>
          <span className="w-20 shrink-0 text-right tabular-nums text-slate-500 dark:text-slate-400">
            {formatValue(d.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}
