interface MetricRowProps {
  detail?: string;
  label: string;
  value: number | string;
}

export function MetricRow({ detail, label, value }: MetricRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-current/10 py-3 last:border-b-0">
      <div className="min-w-0">
        <p className="text-sm font-bold opacity-70">{label}</p>
        {detail ? <p className="mt-1 text-xs leading-5 opacity-60">{detail}</p> : null}
      </div>
      <p className="shrink-0 text-right text-lg font-black">{value}</p>
    </div>
  );
}
