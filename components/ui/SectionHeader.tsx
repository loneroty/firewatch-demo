import type { ReactNode } from "react";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  inverse?: boolean;
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  inverse = false
}: SectionHeaderProps) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p
            className={`mb-2 text-xs font-bold uppercase ${
              inverse ? "text-ember-200" : "text-ember-700"
            }`}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2
          className={`text-2xl font-bold tracking-tight md:text-3xl ${
            inverse ? "text-white" : "text-smoke-950"
          }`}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={`mt-3 text-base leading-7 ${
              inverse ? "text-slate-300" : "text-smoke-600"
            }`}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
