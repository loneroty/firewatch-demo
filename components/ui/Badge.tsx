import type { HTMLAttributes, ReactNode } from "react";

type BadgeTone = "alert" | "danger" | "info" | "neutral" | "verified";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  tone?: BadgeTone;
}

const toneClassNames: Record<BadgeTone, string> = {
  alert: "border-ember-200 bg-ember-50 text-ember-700",
  danger: "border-red-200 bg-red-50 text-red-700",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  neutral: "border-smoke-200 bg-smoke-50 text-smoke-700",
  verified: "border-canopy-500/30 bg-canopy-50 text-canopy-700"
};

export function Badge({
  children,
  className = "",
  tone = "neutral",
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-black",
        toneClassNames[tone],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}
