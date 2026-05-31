interface Props {
  data: { date: string; count: number }[];
}

/**
 * Hand-rolled 14-day SVG bar chart. Avoids pulling recharts (~150kb).
 */
export function MessagesByDayChart({ data }: Props) {
  // Pad to 14 buckets so empty days render as zero bars.
  const filled = padFourteenDays(data);
  const max = Math.max(1, ...filled.map((d) => d.count));
  const w = 28;
  const gap = 8;
  const totalW = filled.length * (w + gap);

  return (
    <svg
      viewBox={`0 0 ${totalW} 140`}
      className="w-full"
      role="img"
      aria-label="Сообщения по дням за 14 дней"
    >
      {filled.map((d, i) => {
        const h = (d.count / max) * 100;
        return (
          <g key={d.date} transform={`translate(${i * (w + gap)},0)`}>
            <rect
              x={0}
              y={120 - h}
              width={w}
              height={Math.max(2, h)}
              rx={4}
              className="fill-primary/70 transition-all hover:fill-primary"
            >
              <title>{`${d.date}: ${d.count}`}</title>
            </rect>
            <text
              x={w / 2}
              y={134}
              textAnchor="middle"
              className="fill-muted-foreground text-[8px]"
            >
              {d.date.slice(5)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function padFourteenDays(data: { date: string; count: number }[]): { date: string; count: number }[] {
  const byDate = new Map(data.map((d) => [d.date, d.count]));
  const out: { date: string; count: number }[] = [];
  const today = new Date();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    out.push({ date: key, count: byDate.get(key) ?? 0 });
  }
  return out;
}
