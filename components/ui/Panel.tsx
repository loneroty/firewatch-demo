import type { HTMLAttributes, ReactNode } from "react";

type PanelTone = "light" | "dark" | "warm" | "subtle";
type PanelPadding = "sm" | "md" | "none";

interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: PanelPadding;
  tone?: PanelTone;
}

const toneClassNames: Record<PanelTone, string> = {
  light: "border-smoke-200 bg-white text-smoke-950 shadow-sm",
  dark: "border-white/10 bg-[#0b1728] text-white shadow-[0_24px_70px_rgb(0_0_0_/_0.18)]",
  warm: "border-ember-200 bg-ember-50 text-smoke-950 shadow-sm",
  subtle: "border-smoke-200 bg-[#f8f5ee] text-smoke-950 shadow-sm"
};

const paddingClassNames: Record<PanelPadding, string> = {
  none: "",
  sm: "p-3 md:p-4",
  md: "p-4 md:p-5"
};

export function Panel({
  children,
  className = "",
  padding = "md",
  tone = "light",
  ...props
}: PanelProps) {
  return (
    <div
      className={[
        "rounded-lg border",
        toneClassNames[tone],
        paddingClassNames[padding],
        className
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}
