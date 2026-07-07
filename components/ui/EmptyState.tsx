import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  action?: ReactNode;
  body: string;
  className?: string;
  icon: LucideIcon;
  title: string;
  tone?: "dark" | "light";
}

export function EmptyState({
  action,
  body,
  className = "",
  icon: Icon,
  title,
  tone = "light"
}: EmptyStateProps) {
  const isDark = tone === "dark";

  return (
    <div
      className={[
        "grid min-h-56 place-items-center rounded-lg border border-dashed p-6 text-center",
        isDark
          ? "border-white/15 bg-white/[0.03] text-white"
          : "border-smoke-200 bg-white text-smoke-950",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="max-w-md">
        <span
          className={[
            "mx-auto grid h-12 w-12 place-items-center rounded-md border",
            isDark
              ? "border-white/10 bg-white/[0.05] text-ember-100"
              : "border-smoke-200 bg-smoke-50 text-ember-700"
          ].join(" ")}
        >
          <Icon aria-hidden="true" size={22} />
        </span>
        <p className="mt-4 text-lg font-black">{title}</p>
        <p
          className={[
            "mt-2 text-sm leading-6",
            isDark ? "text-slate-300" : "text-smoke-600"
          ].join(" ")}
        >
          {body}
        </p>
        {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
      </div>
    </div>
  );
}
