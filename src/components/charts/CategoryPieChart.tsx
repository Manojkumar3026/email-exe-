import { CATEGORY_LABELS, type CategoryId } from '../../types/category';
import { formatBytes } from '../../lib/util/formatBytes';

const SLOT_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
  'var(--chart-6)',
  'var(--chart-7)',
];
const OTHER_COLOR = 'var(--chart-other)';
const MAX_SLICES = 7;

interface CategoryPieChartProps {
  valuesByCategory: Partial<Record<CategoryId, number>>;
  /** How to describe each value in the legend/tooltip, e.g. formatBytes or `${n} emails`. */
  formatValue?: (value: number) => string;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`;
}

export default function CategoryPieChart({ valuesByCategory, formatValue = formatBytes }: CategoryPieChartProps) {
  const entries = Object.entries(valuesByCategory)
    .map(([category, value]) => ({ category: category as CategoryId, value: value ?? 0 }))
    .filter((e) => e.value > 0)
    .sort((a, b) => b.value - a.value);

  const top = entries.slice(0, MAX_SLICES);
  const rest = entries.slice(MAX_SLICES);
  const otherTotal = rest.reduce((sum, e) => sum + e.value, 0);

  const slices = [
    ...top.map((e, i) => ({ label: CATEGORY_LABELS[e.category], value: e.value, color: SLOT_COLORS[i] })),
    ...(otherTotal > 0 ? [{ label: 'Other', value: otherTotal, color: OTHER_COLOR }] : []),
  ];

  const total = slices.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) {
    return <p className="text-sm text-slate-500 dark:text-slate-400">No data yet.</p>;
  }

  let cumulativeAngle = 0;
  const arcs = slices.map((slice) => {
    const angle = (slice.value / total) * 360;
    const arc = { ...slice, startAngle: cumulativeAngle, endAngle: cumulativeAngle + angle };
    cumulativeAngle += angle;
    return arc;
  });

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox="0 0 120 120" className="h-40 w-40 shrink-0" role="img" aria-label="Storage by category">
        {arcs.map((arc) => (
          <path key={arc.label} d={describeArc(60, 60, 56, arc.startAngle, arc.endAngle)} fill={arc.color}>
            <title>
              {arc.label}: {formatValue(arc.value)} ({Math.round((arc.value / total) * 100)}%)
            </title>
          </path>
        ))}
        <circle cx="60" cy="60" r="30" className="fill-white dark:fill-slate-900" />
      </svg>
      <ul className="flex-1 space-y-1.5 text-sm">
        {arcs.map((arc) => (
          <li key={arc.label} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: arc.color }} />
            <span className="flex-1 truncate">{arc.label}</span>
            <span className="tabular-nums text-slate-500 dark:text-slate-400">
              {formatValue(arc.value)} · {Math.round((arc.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
