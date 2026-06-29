import type { LucideIcon } from "lucide-react";

interface SummaryMetricProps {
  label: string;
  value: number;
  icon: LucideIcon;
}

export function SummaryMetric({ label, value, icon: Icon }: SummaryMetricProps) {
  return (
    <div className="rounded-lg border border-smoke-200 bg-smoke-50 p-3">
      <div className="mb-2 flex items-center justify-between gap-2 text-smoke-600">
        <span className="text-xs font-medium">{label}</span>
        <Icon aria-hidden="true" size={16} />
      </div>
      <div className="text-2xl font-bold leading-none text-smoke-950">{value}</div>
    </div>
  );
}
