import type { LucideIcon } from "lucide-react";

type MetricTone = "alert" | "verified" | "info" | "neutral";

interface MetricCardProps {
  label: string;
  value: number | string;
  detail: string;
  icon: LucideIcon;
  tone?: MetricTone;
}

const toneClassNames: Record<MetricTone, string> = {
  alert: "border-ember-100 bg-ember-50 text-ember-700",
  verified: "border-canopy-500/30 bg-canopy-50 text-canopy-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-smoke-200 bg-white text-smoke-700"
};

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone = "neutral"
}: MetricCardProps) {
  return (
    <article className="rounded-lg border border-smoke-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-smoke-600">{label}</p>
          <p className="mt-2 text-3xl font-bold leading-none text-smoke-950">{value}</p>
        </div>
        <span className={`rounded-lg border p-2.5 ${toneClassNames[tone]}`}>
          <Icon aria-hidden="true" size={20} />
        </span>
      </div>
      <p className="text-sm leading-6 text-smoke-600">{detail}</p>
    </article>
  );
}
