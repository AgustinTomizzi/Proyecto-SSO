import "./Chart.css";

interface Bar {
  label: string;
  value: number;
  color?: string;
}

export function Bars({ data, max, unit = "%" }: { data: Bar[]; max?: number; unit?: string }) {
  const top = max ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="chart-bars">
      {data.map((d) => (
        <div className="chart-bars__row" key={d.label} title={`${d.label}: ${d.value}${unit}`}>
          <span className="chart-bars__label">{d.label}</span>
          <div className="chart-bars__track">
            <div
              className="chart-bars__fill"
              style={{
                width: `${(d.value / top) * 100}%`,
                background: d.color ?? "var(--brand)",
              }}
            />
          </div>
          <span className="chart-bars__value">
            {d.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  data,
  size = 160,
  thickness = 18,
}: {
  data: { label: string; value: number; color: string }[];
  size?: number;
  thickness?: number;
}) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="chart-donut">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
          {data.map((d) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle
                key={d.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={d.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
              >
                <title>{`${d.label}: ${Math.round((d.value / total) * 100)}%`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })}
        </g>
      </svg>
      <ul className="chart-donut__legend">
        {data.map((d) => (
          <li key={d.label}>
            <span className="dot" style={{ background: d.color }} />
            {d.label} <strong>{Math.round((d.value / total) * 100)}%</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Trend({ points, height = 64, color = "var(--brand)" }: { points: number[]; height?: number; color?: string }) {
  if (points.length === 0) return null;
  const w = 240;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const step = w / (points.length - 1 || 1);
  const coords = points.map((p, i) => [i * step, height - ((p - min) / range) * (height - 8) - 4]);
  const line = coords.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${w} ${height} L0 ${height} Z`;
  return (
    <svg className="chart-trend" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
