import type { ReactNode } from "react";

interface ActionBarProps {
  children: ReactNode;
  className?: string;
}

export function ActionBar({ children, className = "" }: ActionBarProps) {
  return (
    <div
      className={[
        "flex flex-wrap items-center gap-2 rounded-lg border border-smoke-200 bg-white p-2 shadow-sm",
        className
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
